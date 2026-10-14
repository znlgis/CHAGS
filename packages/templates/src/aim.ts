import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
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
  /** 已经射中的靶子（百步穿杨：射中的柳叶上留一个洞） */
  hitIds: string[];
  /** 距离阶梯走到第几档了（没有阶梯的关卡一直是 0） */
  rungIndex: number;
}

export interface AimApi {
  /** 射够了，收工 */
  complete(): void;
  /** 距离阶梯：往后退一档（下一片叶子才露面） */
  advance(): void;
  /** 现在唯一可以射的目标（没有阶梯时是 null，表示"活的都能射"） */
  nextActive(): string | null;
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
  /** 弓箭手站哪儿：给一个点，或者按 stage 算（百步穿杨：一档一档往后退） */
  archer: AimPoint | ((stage: AimStage) => AimPoint);
  drawScenery?: (g: Phaser.GameObjects.Graphics, stage: AimStage) => void;
  drawArcher: (g: Phaser.GameObjects.Graphics, x: number, y: number, pull: number) => void;
  /** alive = "现在可以射的就是它"（有阶梯时只有当前这一档为真）；id 用来查这一片叶子是第几档、射没射中 */
  drawTarget: (
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    alive: boolean,
    id: string,
  ) => void;
  /** 射中之后由游戏决定后续：是否结束、是否把某个目标放回来 */
  onHit: (targetId: string, api: AimApi) => void;
  /** 场景起来了（百步穿杨用它自己加"十步 / 百步"的木牌文字） */
  onReady?: (api: AimApi) => void;
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
    private hitIds: string[] = [];
    private rungIndex = 0;
    private advanceHint: Phaser.GameObjects.Graphics | null = null;
    private advanceHand: Phaser.GameObjects.Graphics | null = null;
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
        // 射中了、还没退档的时候，点木牌才是这一下该做的事
        if (this.tapAdvance(pointer.x, pointer.y)) return;
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
      cfg.onReady?.(this.api());

      if (this.autoplay) {
        this.time.addEvent({
          delay: 320,
          loop: true,
          callback: () => {
            if (this.finished || this.ctx.services.now() < this.lockedUntil) return;
            if (this.needsAdvance()) {
              this.advance();
              return;
            }
            this.autoShoot();
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
      const archer = this.archerPoint();
      const direction = aimDirection(archer, to);
      if (!direction) return;
      this.arrows.push({ x: archer.x, y: archer.y, dx: direction.x, dy: direction.y });
      this.ctx.services.audio.tone(880, 70);
    }

    private autoShoot(): void {
      const active = this.activeIds();
      const target = cfg.level.targets.find((t) => active.includes(t.id));
      if (target) this.shoot({ x: target.x, y: target.y });
    }

    // ---------------- 箭 ----------------

    private stepArrows(delta: number): void {
      if (this.arrows.length === 0) return;
      const dt = delta / 1000;
      const active = this.activeIds();
      const alive = cfg.level.targets.filter((t) => active.includes(t.id));

      for (let i = this.arrows.length - 1; i >= 0; i -= 1) {
        const arrow = this.arrows[i];
        if (!arrow) continue;
        const from = { x: arrow.x, y: arrow.y };
        const to = {
          x: arrow.x + arrow.dx * cfg.level.arrowSpeed * dt,
          y: arrow.y + arrow.dy * cfg.level.arrowSpeed * dt,
        };
        const hit = firstHit(from, to, alive, cfg.level.hitRadius, this.radiusOf);
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
      if (!this.hitIds.includes(id)) this.hitIds.push(id);
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
        hitIds: [...this.hitIds],
        rungIndex: this.rungIndex,
      };
    }

    /** 弓箭手现在站哪儿（阶梯关卡会一档一档往后退） */
    private archerPoint(): AimPoint {
      return typeof cfg.archer === 'function' ? cfg.archer(this.stage()) : cfg.archer;
    }

    /**
     * 现在真正可以射的靶子。
     * 有阶梯的关卡里只有"当前这一档"算数 —— 否则一箭射最远那片，前面的练习就白搭了。
     */
    private activeIds(): string[] {
      const ladder = cfg.level.ladder;
      if (!ladder) return [...this.aliveIds];
      const rung = ladder.rungs[this.rungIndex];
      if (!rung) return [];
      return this.hitIds.includes(rung.targetId) ? [] : [rung.targetId];
    }

    /** 画成"活靶子"的条件：没有阶梯时是"还没射中"，有阶梯时是"就是这一档" */
    private drawAlive(id: string): boolean {
      if (!cfg.level.ladder) return this.aliveIds.includes(id);
      return this.activeIds().includes(id);
    }

    /** 射中了当前这一档、还有下一档要射 —— 该自己把木牌往后挪一挪了 */
    private needsAdvance(): boolean {
      const ladder = cfg.level.ladder;
      if (!ladder || this.finished) return false;
      const rung = ladder.rungs[this.rungIndex];
      if (!rung) return false;
      return this.hitIds.includes(rung.targetId) && this.rungIndex < ladder.rungs.length - 1;
    }

    private tapAdvance(x: number, y: number): boolean {
      const ladder = cfg.level.ladder;
      if (!ladder || !this.needsAdvance()) return false;
      const { x: ax, y: ay, radius } = ladder.advance;
      if (Math.hypot(x - ax, y - ay) > radius + 40) return false;
      this.advance();
      return true;
    }

    /** 该退档的时候，木牌上自己亮起来 + 一只小手 */
    private syncAdvanceHint(): void {
      const ladder = cfg.level.ladder;
      if (!ladder || !this.needsAdvance()) {
        if (this.advanceHint) {
          this.tweens.killTweensOf(this.advanceHint);
          this.advanceHint.destroy();
          this.advanceHint = null;
        }
        if (this.advanceHand) {
          this.tweens.killTweensOf(this.advanceHand);
          this.advanceHand.destroy();
          this.advanceHand = null;
        }
        return;
      }
      if (this.advanceHint) return;
      const { x, y, radius } = ladder.advance;
      const ring = this.add.graphics().setDepth(60);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(x, y, radius);
      this.advanceHint = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.advanceHand = createHand(this, x, y - 24, 1.1);
    }

    private hideAdvanceHint(): void {
      if (this.advanceHint) {
        this.tweens.killTweensOf(this.advanceHint);
        this.advanceHint.destroy();
        this.advanceHint = null;
      }
      if (this.advanceHand) {
        this.tweens.killTweensOf(this.advanceHand);
        this.advanceHand.destroy();
        this.advanceHand = null;
      }
    }

    /** 阶梯的箭头位置（每个靶子可以有自己的命中半径） */
    private radiusOf = (target: { id: string }): number => {
      const def = cfg.level.targets.find((t) => t.id === target.id);
      return def?.radius ?? cfg.level.hitRadius;
    };

    /** 阶梯：往后退一档（射中了才轮得到下一片叶子） */
    private advance(): void {
      const ladder = cfg.level.ladder;
      if (!ladder || this.finished) return;
      const rung = ladder.rungs[this.rungIndex];
      if (!rung || !this.hitIds.includes(rung.targetId)) return;
      if (this.rungIndex >= ladder.rungs.length - 1) return;
      this.rungIndex += 1;
      this.hideAdvanceHint();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'aim:advance:' + this.rungIndex });
      this.redraw();
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
        advance: () => this.advance(),
        nextActive: () => this.activeIds()[0] ?? null,
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
          cfg.drawTarget(this.world, t.kind, t.x, t.y, this.drawAlive(t.id), t.id);
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
        cfg.drawTarget(g, target.kind, target.x, target.y, this.drawAlive(target.id), target.id);
      }

      const archer = this.archerPoint();
      const pull = this.dragging && this.aimPoint ? pullAmount(archer, this.aimPoint) : 0;
      cfg.drawArcher(g, archer.x, archer.y, pull);
      this.syncAdvanceHint();

      // 瞄准线：虚线 + 箭头，给小朋友一个明确的方向感
      if (this.dragging && this.aimPoint) {
        const direction = aimDirection(archer, this.aimPoint);
        if (direction) {
          const length = 900;
          g.lineStyle(5, THEME.red, 0.55);
          for (let d = 90; d < length; d += 46) {
            g.lineBetween(
              archer.x + direction.x * d,
              archer.y + direction.y * d,
              archer.x + direction.x * (d + 22),
              archer.y + direction.y * (d + 22),
            );
          }
          g.fillStyle(THEME.red, 0.9);
          const tipX = archer.x + direction.x * length;
          const tipY = archer.y + direction.y * length;
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
