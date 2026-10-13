import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, sparkleAt } from '@chags/phaser-kit';
import { aimDirection, firstHit, pullAmount } from './aim.logic';
import type { AimPoint } from './aim.logic';
import { SCENE_KEYS } from './layout';
import type { AimLevel } from './schemas';
import type { SessionState } from './session';

export interface AimStage {
  width: number;
  height: number;
  aliveIds: string[];
  shots: number;
}

export interface AimApi {
  /** 射够了，收工 */
  complete(): void;
  /** 把一个目标放回来（后羿：把最后一个太阳还回来） */
  revive(id: string): void;
  /** 暂时锁住射击（用于"天黑了"这类过场） */
  lock(ms: number): void;
  aliveIds(): string[];
  /** 游戏做过场动画时用（例如加一层黑幕） */
  readonly scene: Phaser.Scene;
  redraw(): void;
}

export interface AimConfig {
  level: AimLevel;
  session: SessionState;
  nextSceneKey: string;
  titleKey: MessageKey;
  archer: AimPoint;
  drawScenery?: (g: Phaser.GameObjects.Graphics, stage: AimStage) => void;
  drawArcher: (g: Phaser.GameObjects.Graphics, x: number, y: number, pull: number) => void;
  drawTarget: (
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    alive: boolean,
  ) => void;
  /** 射中之后由游戏决定后续：是否结束、是否把某个目标放回来 */
  onHit: (targetId: string, api: AimApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, stage: AimStage) => void;
  finaleHoldMs?: number;
}

interface Arrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * 瞄准射击：从弓的位置向外拖 → 显示瞄准线 → 松手射箭。
 *
 * 判定用**线段扫过的范围**而不是点：箭一帧能飞很远，按点判会直接穿过去。
 */
export function createAimScene(ctx: GameContext, cfg: AimConfig): Phaser.Types.Scenes.SceneType {
  return class AimScene extends BaseScene {
    private world: Phaser.GameObjects.Graphics | null = null;
    private aliveIds: string[] = [...cfg.level.targets.map((t) => t.id)];
    private arrows: Arrow[] = [];
    private dragging = false;
    private aimPoint: AimPoint | null = null;
    private shots = 0;
    private finished = false;
    private lockedUntil = 0;

    constructor() {
      super(SCENE_KEYS.aim, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.aim });
      this.drawBackdrop(this.tr(cfg.titleKey));

      this.world = this.add.graphics().setDepth(2);
      // 瞄准线要能盖住目标，单独一层
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.dragging = true;
        this.aimPoint = { x: pointer.x, y: pointer.y };
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (this.dragging) this.aimPoint = { x: pointer.x, y: pointer.y };
      });
      this.input.on('pointerup', () => this.release());
      this.input.on('pointerupoutside', () => this.release());

      this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, delta: number) => {
        this.stepArrows(delta);
        this.redraw();
      });

      this.redraw();
      this.fadeIn();

      if (this.autoplay) {
        this.time.addEvent({
          delay: 320,
          loop: true,
          callback: () => {
            if (!this.finished && this.ctx.services.now() >= this.lockedUntil) this.autoShoot();
          },
        });
      }
    }

    // ---------------- 输入 ----------------

    private release(): void {
      const point = this.aimPoint;
      this.dragging = false;
      this.aimPoint = null;
      if (!point || this.finished) return;
      if (this.ctx.services.now() < this.lockedUntil) return;
      this.shoot(point);
    }

    private shoot(to: AimPoint): void {
      const direction = aimDirection(cfg.archer, to);
      if (!direction) return;
      this.arrows.push({ x: cfg.archer.x, y: cfg.archer.y, dx: direction.x, dy: direction.y });
      this.ctx.services.audio.tone(880, 70);
    }

    private autoShoot(): void {
      const target = cfg.level.targets.find((t) => this.aliveIds.includes(t.id));
      if (target) this.shoot({ x: target.x, y: target.y });
    }

    // ---------------- 箭 ----------------

    private stepArrows(delta: number): void {
      if (this.arrows.length === 0) return;
      const dt = delta / 1000;
      const alive = cfg.level.targets.filter((t) => this.aliveIds.includes(t.id));

      for (let i = this.arrows.length - 1; i >= 0; i -= 1) {
        const arrow = this.arrows[i];
        if (!arrow) continue;
        const from = { x: arrow.x, y: arrow.y };
        const to = {
          x: arrow.x + arrow.dx * cfg.level.arrowSpeed * dt,
          y: arrow.y + arrow.dy * cfg.level.arrowSpeed * dt,
        };
        const hit = firstHit(from, to, alive, cfg.level.hitRadius);
        if (hit !== null) {
          this.arrows.splice(i, 1);
          this.registerHit(hit);
          continue;
        }
        arrow.x = to.x;
        arrow.y = to.y;
        if (arrow.x < -120 || arrow.x > this.W + 120 || arrow.y < -120 || arrow.y > this.H + 120) {
          this.arrows.splice(i, 1);
        }
      }
    }

    private registerHit(id: string): void {
      const index = this.aliveIds.indexOf(id);
      if (index < 0) return;
      this.aliveIds.splice(index, 1);
      this.shots += 1;

      const target = cfg.level.targets.find((t) => t.id === id);
      // 命中事件：调试与自动化都靠它看清"到底射中了几个"
      this.ctx.emit('beat:enter', { beatId: 'hit-' + id });
      if (target) sparkleAt(this, target.x, target.y, THEME.gold, 6);
      this.sfx('correct');
      this.cameras.main.shake(140, 0.005);

      cfg.onHit(id, this.api());
    }

    // ---------------- 对外接口 ----------------

    private stage(): AimStage {
      return {
        width: this.W,
        height: this.H,
        aliveIds: [...this.aliveIds],
        shots: this.shots,
      };
    }

    private api(): AimApi {
      return {
        complete: () => this.complete(),
        revive: (id: string) => {
          if (this.aliveIds.includes(id)) return;
          this.aliveIds.push(id);
          this.redraw();
        },
        lock: (ms: number) => {
          this.lockedUntil = this.ctx.services.now() + ms;
        },
        aliveIds: () => [...this.aliveIds],
        scene: this,
        redraw: () => this.redraw(),
      };
    }

    private complete(): void {
      if (this.finished) return;
      this.finished = true;
      this.ctx.emit('beat:enter', { beatId: 'complete' });
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      this.world?.clear();
      if (this.world) {
        cfg.drawScenery?.(this.world, this.stage());
        for (const t of cfg.level.targets) {
          cfg.drawTarget(this.world, t.kind, t.x, t.y, this.aliveIds.includes(t.id));
        }
        cfg.drawFinale?.(this.world, this.stage());
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? 2400, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 绘制 ----------------

    private redraw(): void {
      const g = this.world;
      if (!g) return;
      g.clear();

      const stage = this.stage();
      cfg.drawScenery?.(g, stage);
      for (const target of cfg.level.targets) {
        cfg.drawTarget(g, target.kind, target.x, target.y, this.aliveIds.includes(target.id));
      }

      const pull = this.dragging && this.aimPoint ? pullAmount(cfg.archer, this.aimPoint) : 0;
      cfg.drawArcher(g, cfg.archer.x, cfg.archer.y, pull);

      // 瞄准线：虚线 + 箭头，给小朋友一个明确的方向感
      if (this.dragging && this.aimPoint) {
        const direction = aimDirection(cfg.archer, this.aimPoint);
        if (direction) {
          const length = 900;
          g.lineStyle(5, THEME.red, 0.55);
          for (let d = 90; d < length; d += 46) {
            g.lineBetween(
              cfg.archer.x + direction.x * d,
              cfg.archer.y + direction.y * d,
              cfg.archer.x + direction.x * (d + 22),
              cfg.archer.y + direction.y * (d + 22),
            );
          }
          g.fillStyle(THEME.red, 0.9);
          const tipX = cfg.archer.x + direction.x * length;
          const tipY = cfg.archer.y + direction.y * length;
          const size = 20;
          g.fillTriangle(
            tipX,
            tipY,
            tipX - direction.x * size * 2 - direction.y * size,
            tipY - direction.y * size * 2 + direction.x * size,
            tipX - direction.x * size * 2 + direction.y * size,
            tipY - direction.y * size * 2 - direction.x * size,
          );
        }
      }

      for (const arrow of this.arrows) {
        g.lineStyle(7, THEME.ink, 1);
        g.lineBetween(arrow.x, arrow.y, arrow.x - arrow.dx * 44, arrow.y - arrow.dy * 44);
      }
    }
  };
}
