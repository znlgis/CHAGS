import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from '@chags/templates/core';
import type { ButcherLevel, ButcherPiece } from '@chags/templates/schemas';
import type { SessionState } from '@chags/templates';
import { drawFinale, drawGrooveArrow, drawKnife, drawOx } from '../art';
import { KNIFE, PUSH } from '../layout';
import { isButcherComplete, isHintless, pieceAt, pushOutcome } from '../logic';

export type ButcherPhase = 'blind' | 'grain' | 'free' | 'done';

export interface ButcherStageState {
  opened: string[];
  grabbed: string | null;
  nicks: number;
  phase: ButcherPhase;
}

export interface ButcherConfig {
  level: ButcherLevel;
  session: SessionState;
  nextSceneKey: string;
  titleKey: MessageKey;
  reveal?: string;
  finaleHoldMs?: number;
}

/** 无事可做多久就把小手放上去 */
const IDLE_MS = 8000;

/**
 * 庖丁解牛（游戏专属场景，与烽火 beacon、盘古 chaos 同一套做法）。
 *
 * 三段落，正好是原文的三段：
 * 1. **所见无非牛者** —— 第一刀砍在骨头上，"当"一声，刀口多一个缺口（不失败，只让他自己听见）；
 * 2. **未尝见全牛也** —— 缝亮起来，顺着缝把一块块推出去；刀口擦干净，再没添新伤；
 * 3. **以神遇而不以目视** —— 最后两块不给提示，凭记住的结构自己推。
 */
export function createButcherScene(ctx: GameContext, cfg: ButcherConfig): Phaser.Types.Scenes.SceneType {
  return class ButcherScene extends BaseScene {
    private opened: string[] = [];
    private grabbed: string | null = null;
    private grabFrom = { x: 0, y: 0 };
    private nicks = 0;
    private phase: ButcherPhase = 'blind';
    private busy = false;
    private finished = false;
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.butcher, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.butcher });
      this.drawBackdrop(this.tr(cfg.titleKey));
      this.worldGfx = this.add.graphics().setDepth(2);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      // 手指拖到画布外面松开，也要按"推完了"处理（否则那块会一直黏在手上）
      this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    private redraw(): void {
      const g = this.worldGfx;
      if (!g) return;
      g.clear();
      const seamsLit = this.phase !== 'blind';
      drawOx(g, cfg.level.pieces, this.opened, this.grabbed, seamsLit);
      if (this.grabbed && this.phase === 'grain') {
        const piece = cfg.level.pieces.find((p) => p.id === this.grabbed);
        if (piece) drawGrooveArrow(g, piece);
      }
      drawKnife(g, KNIFE.x, KNIFE.y, this.nicks, this.nicks === 0);
    }

    // ---------------- 输入 ----------------

    private onDown(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.busy) return;
      this.idleMs = 0;
      this.hideHand();
      this.clearRing();
      if (this.phase === 'blind') {
        this.blindCut(pointer.x, pointer.y);
        return;
      }
      const piece = pieceAt(pointer.x, pointer.y, cfg.level, 40);
      if (!piece || this.opened.includes(piece.id)) return;
      this.grabbed = piece.id;
      this.grabFrom = { x: pointer.x, y: pointer.y };
      this.sfx('tap');
      this.redraw();
    }

    private onUp(pointer: Phaser.Input.Pointer): void {
      const id = this.grabbed;
      this.grabbed = null;
      if (!id || this.finished) return;
      const piece = cfg.level.pieces.find((p) => p.id === id);
      if (!piece) return;
      const outcome = pushOutcome(
        piece,
        { dx: pointer.x - this.grabFrom.x, dy: pointer.y - this.grabFrom.y },
        PUSH.toleranceDeg,
        PUSH.minDistance,
      );
      if (outcome === 'along') {
        this.openPiece(piece);
        return;
      }
      // 推错了：只是推不动，不算错。刀还是那把好刀
      if (outcome === 'wrong-way') {
        this.sfx('tap');
        this.cameras.main.shake(90, 0.003);
        this.ctx.emit('beat:enter', { beatId: 'butcher:wrong:' + piece.id });
      }
      this.redraw();
    }

    // ---------------- 三段 ----------------

    /** 第一刀：砍在骨头上，刀口多一个缺口 —— 这就是"所见无非牛者" */
    private blindCut(x: number, y: number): void {
      if (this.finished) return;
      this.nicks = Math.min(cfg.level.blindCuts, this.nicks + 1);
      this.sfx('wrong');
      this.cameras.main.shake(180, 0.006);
      sparkleAt(this, x, y, THEME.stone, 5);
      this.speak(cfg.level.lines.first);
      this.ctx.emit('beat:enter', { beatId: 'butcher:blind:' + this.nicks });
      if (this.nicks < cfg.level.blindCuts) {
        this.redraw();
        return;
      }
      // 砍完这一刀立刻进第二段：**中间不留"点了没反应"的空档**。
      // 上一版在这里停了 1.4 秒，慢机器上孩子的下一次拖拽会被整个吞掉
      // （CI 的双语巡检就是这么挂的：第一块骨头永远推不开）。
      this.startGrain();
    }

    /** 缝亮起来了：刀口也磨好了。不停机 —— 只有那句旁白晚一点念 */
    private startGrain(): void {
      if (this.finished || this.phase === 'grain') return;
      this.phase = 'grain';
      this.nicks = 0;
      this.busy = false;
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, KNIFE.x, KNIFE.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'butcher:phase:grain' });
      this.time.delayedCall(this.autoplay ? 300 : 1500, () => {
        if (!this.finished) this.speak(cfg.level.lines.grain);
      });
      this.redraw();
    }

    private openPiece(piece: ButcherPiece): void {
      if (this.finished || this.opened.includes(piece.id)) return;
      this.opened.push(piece.id);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.sfx('correct');
      sparkleAt(this, piece.x, piece.y, THEME.gold, 5);
      this.idleMs = 0;
      this.ctx.emit('beat:enter', { beatId: 'butcher:open:' + piece.id });
      this.redraw();

      if (isButcherComplete(cfg.level, this.opened)) {
        this.finish();
        return;
      }
      // 最后几块不给提示：以神遇而不以目视
      if (this.phase === 'grain' && isHintless(cfg.level, this.opened)) {
        this.phase = 'free';
        this.speak(cfg.level.lines.free);
        this.ctx.emit('beat:enter', { beatId: 'butcher:phase:free' });
        this.redraw();
      }
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.phase = 'done';
      this.busy = true;
      this.hideHand();
      this.clearRing();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      this.redraw();
      const finale = this.add.graphics().setDepth(40);
      drawFinale(finale, cfg.level.pieces);
      this.speak(cfg.level.lines.end);
      if (cfg.reveal !== undefined) {
        this.time.delayedCall(1400, () => this.showHint(cfg.reveal as string, 3200, 300));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? 4400, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 提示 ----------------

    private nextPiece(): ButcherPiece | undefined {
      return cfg.level.pieces.find((piece) => !this.opened.includes(piece.id));
    }

    private tick(delta: number): void {
      if (this.finished || this.busy) return;
      this.idleMs += delta;
      if (this.idleMs < IDLE_MS) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
      if (this.phase === 'blind') {
        // 先砍一刀试试 —— 不告诉他"别砍"
        if (!this.hand) this.hand = createHand(this, 375, 760, 1.15);
        return;
      }
      const piece = this.nextPiece();
      if (!piece) return;
      this.showRingAt(piece);
      if (!this.hand) this.hand = createHand(this, piece.x, piece.y, 1.15);
    }

    private showRingAt(piece: ButcherPiece): void {
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(piece.x, piece.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, piece.radius + 20);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    private clearRing(): void {
      if (!this.ring) return;
      this.tweens.killTweensOf(this.ring);
      this.ring.destroy();
      this.ring = null;
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    private runAutoplay(): void {
      this.time.addEvent({
        delay: 240,
        loop: true,
        callback: () => {
          if (this.finished || this.busy) return;
          if (this.phase === 'blind') {
            this.blindCut(375, 700);
            return;
          }
          const piece = this.nextPiece();
          if (piece) this.openPiece(piece);
        },
      });
    }
  };
}

