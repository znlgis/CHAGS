import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  CHASE_TIMING, chaseAutoplayLevel, chaseStart, distanceBand, hitHold, holdWanted, isChaseDone,
  progressRatio, staminaRatio, tick as advanceChase,
} from './chase.logic';
import type { ChaseBand, ChaseState } from './chase.logic';
import type { ChaseLevel } from './schemas';
import type { SessionState } from './session';

/**
 * 追而不逼模板自己的常量 —— 不挤进 layout.ts，免得新模板之间互相踩。
 * 时间那两条（autoplayFactor / autoplayLookMs）来自 chase.logic：单测、画面、
 * 无头验证用的是同一份。
 */
export const CHASE = {
  ...CHASE_TIMING,
  /** 按住那颗按钮的命中宽容度：手指粗也能一按就中 */
  holdForgive: 48,
  /** 开局过一会儿就把小手放到按钮上（不让孩子干等） */
  introHintMs: 1400,
  /** 多久没动静就把提示说出来、把小手放回按钮上 */
  idleMs: 9000,
  /** 打赢之后看一眼山道再走 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度：让开上方那两条槽 */
  hintY: 400,
} as const;

/** 交给游戏画的一切：距离刻度、体力条、这段追逐的进度 */
export interface ChaseStageState {
  /** 0–100 的距离（画面按它把两个人影分开） */
  distance: number;
  /** 对方的体力 0..1 —— 体力条按它画 */
  stamina: number;
  /** 这段追逐的进度 0..1 —— 跟丢会往回走 */
  progress: number;
  /** 此刻距离落在哪一段 */
  band: ChaseBand;
  /** 此刻按住了没有 */
  holding: boolean;
  /** 逼得太近了几次 / 跟丢了几次 */
  pushy: number;
  lost: number;
  elapsedMs: number;
  /** 这一局打赢了（他心服了，不是被抓住） */
  done: boolean;
}

export interface ChaseApi {
  scene: Phaser.Scene;
  stage: ChaseStageState;
}

export interface ChaseConfig {
  level: ChaseLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：山道、树、天（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ChaseLevel) => void;
  /** 每帧重画：两个人影、距离刻度、体力条 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ChaseStageState, level: ChaseLevel) => void;
  /** 距离落进某一段时的一次表演（逼太近 → 他回头；跟丢 → 人影变小） */
  onBand?: (band: ChaseBand, api: ChaseApi) => void;
  /** 按下去 / 松开的一瞬 */
  onHold?: (holding: boolean, api: ChaseApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ChaseStageState, level: ChaseLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 追而不逼：按住追、松手放 —— 难的是把距离维持在一个区间里。
 *
 * 三条刻意的设计：
 * - **判定全在 chase.logic 里**：场景只把墙钟与"按住了没有"喂给 `advanceChase`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **按钮是一次真实的按住**：按住就追近、松手就拉开 —— 孩子的手指就是缰绳。
 * - **零惩罚**：逼太近、跟丢都只是体力回涨 / 进度后退，**不结束、不扣星**；
 *   体力见底才算成 —— 那不是"抓住他"，是他自己心服了。
 */
export function createChaseScene(ctx: GameContext, cfg: ChaseConfig): Phaser.Types.Scenes.SceneType {
  return class ChaseScene extends BaseScene {
    private level: ChaseLevel = cfg.level;
    private state: ChaseState = chaseStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    private holding = false;
    private idleMs = 0;
    private lastBand: ChaseBand = 'good';
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.chase, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.chase });
      // 无头验证：只把体力那几条速率放大 —— 距离的手感与孩子玩的一模一样
      this.level = chaseAutoplayLevel(cfg.level, this.autoplay);
      this.state = chaseStart(this.level);
      this.lastBand = this.state.band;
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.press(pointer));
      this.input.on('pointerup', () => this.release());
      this.input.on('pointerupoutside', () => this.release());
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 2600, CHASE.hintY);
        this.time.delayedCall(CHASE.introHintMs, () => this.pointAtHold());
      }
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        this.state = advanceChase(this.level, this.state, delta, this.holding);
        this.watchBand();
        this.idleMs += delta;
        if (this.idleMs >= CHASE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, CHASE.hintY);
          if (!this.holding) this.pointAtHold();
        }
        if (isChaseDone(this.level, this.state)) this.finish();
      }
      this.redraw(elapsed);
    }

    /** 距离换了一段：出声、表演一下，顺手把"该怎么按"说一遍（只在该说的时候） */
    private watchBand(): void {
      const band = this.state.band;
      if (band === this.lastBand) return;
      this.lastBand = band;
      if (band === 'good') {
        this.clearRing();
        return;
      }
      this.sfx('wrong');
      this.cameras.main.shake(90, 0.0016);
      this.ctx.emit('beat:enter', {
        beatId: band === 'tooClose' ? 'chase:pushy' : 'chase:lost',
      });
      cfg.onBand?.(band, { scene: this, stage: this.stageState(this.elapsed()) });
      // 第一次偏出去的时候把话说清楚；之后孩子自己看得见红闪与变小
      const first = band === 'tooClose' ? this.state.pushy === 1 : this.state.lost === 1;
      if (first) this.showHint(cfg.level.hint, 2400, CHASE.hintY);
    }

    private redraw(elapsed: number): void {
      const g = this.stageGfx;
      if (!g) return;
      g.clear();
      cfg.drawStage(g, this.stageState(elapsed), this.level);
    }

    private stageState(elapsed: number): ChaseStageState {
      return {
        distance: this.state.distance,
        stamina: staminaRatio(this.level, this.state),
        progress: progressRatio(this.state),
        band: distanceBand(this.level, this.state),
        holding: this.holding,
        pushy: this.state.pushy,
        lost: this.state.lost,
        elapsedMs: elapsed,
        done: this.finished && isChaseDone(this.level, this.state),
      };
    }

    // ---------------- 按住 / 松开 ----------------

    private press(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      if (!hitHold(this.level, pointer.x, pointer.y, CHASE.holdForgive)) return;
      this.idleMs = 0;
      if (this.holding) return;
      this.holding = true;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'chase:hold' });
      cfg.onHold?.(true, { scene: this, stage: this.stageState(this.elapsed()) });
    }

    private release(): void {
      if (!this.holding || this.finished) return;
      this.holding = false;
      this.ctx.emit('beat:enter', { beatId: 'chase:release' });
      cfg.onHold?.(false, { scene: this, stage: this.stageState(this.elapsed()) });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.holding = false;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.hold.x, this.level.hold.y - this.level.hold.radius, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'chase:done' });
      this.redraw(this.elapsed());
      if (this.finaleGfx) {
        cfg.drawFinale?.(this.finaleGfx, this.stageState(this.elapsed()), this.level);
      }
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, CHASE.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? CHASE.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 小手 ----------------

    private pointAtHold(): void {
      if (this.finished) return;
      const { hold } = this.level;
      this.clearRing();
      this.hideHand();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(hold.x, hold.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, hold.radius + 24);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.12,
        alpha: 0.4,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hand = createHand(this, hold.x, hold.y + 34, 1.15);
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

    /**
     * 按期看一次"该按还是该松"，按的就是那一颗按钮的那条路（只改 this.holding）。
     * 与孩子该做的事一模一样：太近就松、太远就按、在区间里朝中点收。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: CHASE.autoplayLookMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          this.holding = holdWanted(this.level, this.state);
        },
      });
    }
  };
}
