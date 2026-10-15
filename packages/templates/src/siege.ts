import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  frontGain, frontTap, isRelieved, isSiegeDone, nextVital, relieve, resistanceOf,
  siegeProgress, siegeStart, tapsToFinish, vitalAt,
} from './siege.logic';
import type { SiegeState } from './siege.logic';
import type { SiegeLevel, SiegeVital } from './schemas';
import type { SessionState } from './session';

/** siege 模板自己的常量：不进 layout.ts，也不跟别的模板互相踩 */
export const SIEGE = {
  /** 点要害 / 推正面的命中宽容度：小朋友手指粗，判定要比图形大 */
  tapForgive: 56,
  /** 两次推正面之间的最小间隔：一下是一下，连点也别糊成一片 */
  tapCooldownMs: 70,
  /** 阻力还没降下来时，每推这么多下再提醒一次该去哪儿 */
  tapHintEvery: 10,
  /** 点中要害之后的停顿（让孩子看清"兵马回防"） */
  relieveHoldMs: 620,
  /** 多久没动静就把小手放到下一处要害上 */
  idleMs: 9000,
  /** 解围之后看多久再进下一幕 */
  finaleHoldMs: 2600,
  /** 无头验证：起手停顿、点要害的节拍、推正面的节拍 */
  autoplayLeadMs: 240,
  autoplayStepMs: 420,
  autoplayTapMs: 90,
} as const;

/** 每一帧交给游戏画的一切（画面完全由游戏决定，模板只管数值与手感） */
export interface SiegeStageMetrics {
  width: number;
  height: number;
  /** 正面推进到多少了 */
  progress: number;
  /** 推到这个数就解围 */
  goal: number;
  /** 0..1：进度条按它画 */
  ratio: number;
  /** 现在的阻力：初始阻力减掉已回防的要害 */
  resistance: number;
  /** 已回防的要害 id */
  relieved: string[];
  /** 下一次推正面的增量（阻力大 = 推不动） */
  gain: number;
  /** 还差几下正面 */
  tapsLeft: number;
  /** 一共推了几下 */
  taps: number;
  done: boolean;
}

export interface SiegeApi {
  scene: Phaser.Scene;
}

export interface SiegeConfig {
  level: SiegeLevel;
  session: SessionState;
  nextSceneKey: string;
  /**
   * 顶栏标题。三十六计的 scene.* 文案还没登记，所以可以不传 ——
   * 不传就用内容自己的标题（ctx.content 已经按语言翻译好了）。
   */
  titleKey?: MessageKey;
  /** 整屏画面：地图、城墙、要害、进度条都按 metrics 画 */
  drawStage: (g: Phaser.GameObjects.Graphics, stage: SiegeStageMetrics) => void;
  /** 点中一处要害（游戏可以让"回防"的兵马动起来） */
  onRelieve?: (vital: SiegeVital, api: SiegeApi) => void;
  /** 推了一下正面 */
  onFrontTap?: (stage: SiegeStageMetrics, api: SiegeApi) => void;
  /** 每帧回调（会动的东西用自己的节拍） */
  onFrame?: (stage: SiegeStageMetrics, delta: number) => void;
  /** 解围的收尾表现 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, stage: SiegeStageMetrics) => void;
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * 要害：正面怎么推都推不动，去动他非救不可的地方。
 *
 * 三条刻意的设计：
 * - **推不动是算出来的，不是说出来的**：不点要害，一下只加 0.2（要一百下）；
 *   两处要害点完，阻力归零，一下加 1（二十下）。孩子自己就能感到差别。
 * - **每个要害只能点一次**：点过变"已回防"，再点不重复减阻力 —— 这本账算得清。
 * - **零惩罚**：白推一百下也不扣星、不结束，要害点过再点也只是再提醒一句。
 */
export function createSiegeScene(ctx: GameContext, cfg: SiegeConfig): Phaser.Types.Scenes.SceneType {
  return class SiegeScene extends BaseScene {
    private state: SiegeState = siegeStart();
    private finished = false;
    private busy = false;
    private idleMs = 0;
    private lastTapAt = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private tapTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
      super(SCENE_KEYS.siege, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.siege });
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => {
        this.tapTimer?.destroy();
        this.tapTimer = null;
      });

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 输入 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.busy) return;
      // 要害优先：它压在城墙的命中范围上也照样算要害
      const vital = vitalAt(pointer.x, pointer.y, cfg.level, SIEGE.tapForgive);
      if (vital) {
        this.hitVital(vital);
        return;
      }
      const { front } = cfg.level;
      if (Math.hypot(pointer.x - front.x, pointer.y - front.y) <= front.radius + SIEGE.tapForgive) {
        this.pushFront();
      }
    }

    /** 点要害：只有第一次真的减阻力 */
    private hitVital(vital: SiegeVital): void {
      if (this.finished || this.busy) return;
      if (isRelieved(this.state, vital.id)) {
        // 已经回防过了：重复点不惩罚。还有没点的要害就说一句，两处都点完了把小手放回正面
        if (nextVital(cfg.level, this.state)) {
          this.showHint(cfg.level.hint);
        } else {
          const { front } = cfg.level;
          this.pointAt(front.x, front.y, front.radius);
        }
        return;
      }
      this.state = relieve(cfg.level, this.state, vital.id);
      this.idleMs = 0;
      this.busy = true;
      this.clearRing();
      this.hideHand();
      this.sfx('unlock');
      this.cameras.main.flash(180, 255, 240, 200);
      sparkleAt(this, vital.x, vital.y, THEME.gold, 7);
      this.ctx.emit('beat:enter', { beatId: 'siege:relieve:' + vital.id });
      cfg.onRelieve?.(vital, { scene: this });
      this.redraw();
      const hold = this.autoplay
        ? Math.max(120, Math.round(SIEGE.relieveHoldMs / 3))
        : SIEGE.relieveHoldMs;
      this.time.delayedCall(hold, () => {
        this.busy = false;
        this.idleMs = 0;
      });
    }

    /** 推一下正面 */
    private pushFront(): void {
      if (this.finished || this.busy) return;
      const now = this.ctx.services.now();
      if (now - this.lastTapAt < SIEGE.tapCooldownMs) return;
      this.lastTapAt = now;

      const before = this.state;
      this.state = frontTap(cfg.level, this.state);
      this.idleMs = 0;
      this.sfx('tap');
      this.cameras.main.shake(60, 0.0015);

      const stage = this.metrics(false);
      cfg.onFrontTap?.(stage, { scene: this });

      // 阻力还在（一下推不满 1）时，别让孩子闷头推满一百下：把该去的地方指出来
      if (frontGain(cfg.level, before) < 1 && this.state.taps % SIEGE.tapHintEvery === 1) {
        this.showHint(cfg.level.hint);
        this.pointAtNextVital();
      }
      this.redraw();
      if (isSiegeDone(cfg.level, this.state.progress)) this.finish();
    }

    // ---------------- 画面 ----------------

    private metrics(done: boolean): SiegeStageMetrics {
      return {
        width: this.W,
        height: this.H,
        progress: this.state.progress,
        goal: cfg.level.goal,
        ratio: siegeProgress(cfg.level, this.state),
        resistance: resistanceOf(cfg.level, this.state),
        relieved: [...this.state.relieved],
        gain: frontGain(cfg.level, this.state),
        tapsLeft: tapsToFinish(cfg.level, this.state),
        taps: this.state.taps,
        done,
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawStage(this.stageGfx, this.metrics(this.finished));
    }

    private tick(delta: number): void {
      if (!this.finished) {
        cfg.onFrame?.(this.metrics(false), delta);
        this.idleMs += delta;
        if (this.idleMs >= SIEGE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint);
          this.pointAtNextVital();
        }
      }
      this.redraw();
    }

    /** 把小手与光圈放到下一处要害上；要害都点完了就指向正面 */
    private pointAtNextVital(): void {
      const vital = nextVital(cfg.level, this.state);
      if (!vital) {
        const { front } = cfg.level;
        this.pointAt(front.x, front.y, front.radius);
        return;
      }
      this.pointAt(vital.x, vital.y, vital.radius);
    }

    private pointAt(x: number, y: number, radius: number): void {
      this.clearRing();
      this.hideHand();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(x, y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, radius + 26);
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
      this.hand = createHand(this, x, y + radius + 30, 1.15);
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

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.tapTimer?.destroy();
      this.tapTimer = null;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'siege:done' });
      this.redraw();
      if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx, this.metrics(true));
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, cfg.revealY ?? 300));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? SIEGE.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 无头验证 ----------------

    /** 先把两处要害点掉，再连点正面 —— 与真实操作走的是同一条路 */
    private runAutoplay(): void {
      cfg.level.vital.forEach((vital, index) => {
        this.time.delayedCall(
          SIEGE.autoplayLeadMs + index * SIEGE.autoplayStepMs,
          () => this.hitVital(vital),
        );
      });
      const startAt =
        SIEGE.autoplayLeadMs + cfg.level.vital.length * SIEGE.autoplayStepMs + 260;
      this.time.delayedCall(startAt, () => {
        this.tapTimer = this.time.addEvent({
          delay: SIEGE.autoplayTapMs,
          loop: true,
          callback: () => this.pushFront(),
        });
      });
    }
  };
}
