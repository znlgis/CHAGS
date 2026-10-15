import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  applyStrike, beatMarks, beatProgress, canStrikeAt, effectiveLevel, hitAction, isStillnessDone,
  phaseAt, remainingInBeatMs, slotAt, stillnessStart, strikeAt,
} from './stillness.logic';
import type { BeatMark, StillnessPhase, StillnessState, StrikeResult } from './stillness.logic';
import type { StillnessLevel } from './schemas';
import type { SessionState } from './session';

/**
 * 模板常量放在模板自己文件里（不挤进 layout.ts，免得新模板之间互相踩）。
 * 坐标（出击按钮）在关卡数据里，这里只放手感。
 */
export const STILLNESS = {
  /** 出击按钮的命中宽容度：手指粗也能点得到 */
  tapForgive: 44,
  /** 一轮走完还没出手：鼓声停一下，从头再来（**零惩罚**） */
  replayHoldMs: 1600,
  /** 无头验证：把三通鼓压成几分之一 */
  autoplayFactor: 5,
  /** 无头验证：隔多久看一眼"现在该不该出手" */
  autoplayLookMs: 80,
  /** 开局先把小手放在出击按钮上一下 —— 告诉孩子可以点这里 */
  introHandMs: 2400,
  /** 该出手的窗口开了多久就把小手放上去 */
  handDelayMs: 480,
  /** 多久没动静就把"再等一等"说出来 */
  idleMs: 8000,
  /** 打赢之后看一眼战场再走 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 交给游戏画的一切：两军剪影、鼓面波纹、自己的兵晃一下又站稳 */
export interface StillnessStageState {
  /** 现在走到第几通鼓（0 起）；全部走完 = beats.length */
  index: number;
  phase: StillnessPhase;
  /** 三通鼓各自到哪儿了：rest / drum / window / passed */
  marks: BeatMark[];
  /** 这一通鼓已经响到哪儿（0..1）：鼓面波纹按它推 */
  pulse: number;
  /** 白费力气了几次 */
  early: number;
  /** 刚刚那一击的结果；还没出过手是 null —— "晃一下又站稳"的表演用它 */
  lastStrike: StrikeResult | null;
  /** 刚刚那一击过去了多久 —— 表演按它衰减 */
  sinceStrikeMs: number;
  /** 此刻出击算不算成功 —— 敌方"没劲了"的那一瞬间 */
  canStrike: boolean;
  /** 距离这一通鼓结束还有多久 */
  remainingMs: number;
  elapsedMs: number;
  /** 这一局打赢了 */
  done: boolean;
  /** 这一轮走完了、要重来（鼓声停了，谁也没出手） */
  roundOver: boolean;
}

export interface StillnessConfig {
  level: StillnessLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就把整屏交给 drawWorld */
  title?: string;
  drawWorld: (g: Phaser.GameObjects.Graphics, state: StillnessStageState) => void;
  /** 出手时游戏自己的表演（自己的兵往前一步、对方的鼓一颤） */
  onStrike?: (result: 'hit' | 'early', api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: StillnessStageState) => void;
  /** 打赢之后念的那句话 */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 忍：最难的动作是不动。
 *
 * 三条刻意的设计：
 * - **判定全在 stillness.logic 里**：场景只把墙钟喂给 `phaseAt` / `strikeAt`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **白鼓零惩罚**：鼓响的时候出手只记一次"白费力气"，不扣星、不结束 —— 接着等就是。
 * - **一轮走完可以重来**：三通鼓敲完还没出手，鼓声停一下从头再响一遍（绝不卡死）。
 *   该出手的那一通窗口开了，小手才放到按钮上：提示给在**对的时候**。
 */
export function createStillnessScene(
  ctx: GameContext,
  cfg: StillnessConfig,
): Phaser.Types.Scenes.SceneType {
  return class StillnessScene extends BaseScene {
    private level: StillnessLevel = cfg.level;
    private state: StillnessState = stillnessStart();
    private startedAt = 0;
    private finished = false;
    private roundOver = false;
    private lastPhase: StillnessPhase | null = null;
    private lastBeatId: string | null = null;
    private lastStrike: StrikeResult | null = null;
    private lastStrikeAt = 0;
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private cueGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private introUntil = 0;

    constructor() {
      super(SCENE_KEYS.stillness, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.stillness });
      this.level = effectiveLevel(cfg.level, this.autoplay, STILLNESS.autoplayFactor);
      this.startedAt = this.ctx.services.now();
      this.introUntil = this.autoplay ? 0 : STILLNESS.introHandMs;

      this.drawBackdrop(cfg.title);
      this.worldGfx = this.add.graphics().setDepth(2);
      this.cueGfx = this.add.graphics().setDepth(60);
      if (!this.autoplay) this.showHand();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 2600, STILLNESS.hintY);
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        const info = phaseAt(this.level, elapsed);
        this.syncPhase(info.beatId, info.phase);
        if (info.phase === 'done') {
          if (!this.roundOver) this.replay();
        } else {
          this.watch(elapsed, delta);
        }
      }
      this.redraw(elapsed);
    }

    /** 鼓响 / 窗口开的那一瞬：发事件、出声 —— 每一通都一样，不泄露"哪一通才算数" */
    private syncPhase(beatId: string | null, phase: StillnessPhase): void {
      if (beatId === this.lastBeatId && phase === this.lastPhase) return;
      const newBeat = beatId !== this.lastBeatId;
      this.lastBeatId = beatId;
      this.lastPhase = phase;
      if (phase === 'done' || beatId === null) return;
      if (newBeat) {
        const slot = slotAt(this.level, this.elapsed());
        this.ctx.services.audio.tone(260 - Math.min(3, slot?.index ?? 0) * 30, 150);
        this.ctx.emit('beat:enter', { beatId: 'stillness:drum:' + beatId });
        return;
      }
      if (phase === 'window') {
        this.ctx.services.audio.tone(520, 120);
        this.ctx.emit('beat:enter', { beatId: 'stillness:window:' + beatId });
      }
    }

    /** 提示与小手：只在**该出手**的窗口里出现 */
    private watch(elapsed: number, delta: number): void {
      const slot = slotAt(this.level, elapsed);
      const open = canStrikeAt(this.level, elapsed);

      if (open && slot && !this.autoplay) {
        if (elapsed - slot.windowStartMs >= STILLNESS.handDelayMs) this.showHand();
      } else if (elapsed >= this.introUntil) {
        this.hideHand();
      }

      this.idleMs += delta;
      if (this.idleMs < STILLNESS.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint, 2600, STILLNESS.hintY);
    }

    private redraw(elapsed: number): void {
      const state = this.stageState(elapsed);
      if (this.worldGfx) {
        this.worldGfx.clear();
        cfg.drawWorld(this.worldGfx, state);
      }
      const cue = this.cueGfx;
      if (!cue) return;
      cue.clear();
      if (!state.canStrike) return;
      // 该出手的那一通：按钮外圈亮起来（和 place 的 hintRing 一个意思 —— 提示给在点上）
      const slot = slotAt(this.level, elapsed);
      const openMs = slot ? elapsed - slot.windowStartMs : 0;
      const pulse = Math.min(1, Math.max(0, openMs / 620));
      const { action } = this.level;
      cue.lineStyle(10, THEME.gold, 0.9);
      cue.strokeCircle(action.x, action.y, action.radius + 28 + pulse * 16);
    }

    private stageState(elapsed: number): StillnessStageState {
      const info = phaseAt(this.level, elapsed);
      const slot = slotAt(this.level, elapsed);
      return {
        index: slot ? slot.index : this.level.beats.length,
        phase: info.phase,
        marks: beatMarks(this.level, elapsed),
        pulse: beatProgress(this.level, elapsed),
        early: this.state.early,
        lastStrike: this.lastStrike,
        sinceStrikeMs: this.lastStrike === null ? Number.POSITIVE_INFINITY : elapsed - this.lastStrikeAt,
        canStrike: !this.finished && canStrikeAt(this.level, elapsed),
        remainingMs: remainingInBeatMs(this.level, elapsed),
        elapsedMs: elapsed,
        done: this.finished && isStillnessDone(this.state),
        roundOver: this.roundOver,
      };
    }

    // ---------------- 出手 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.finished || this.roundOver) return;
      if (!hitAction(pointer.x, pointer.y, this.level, STILLNESS.tapForgive)) return;
      this.strike();
    }

    /** 出一次手（真实操作与无头验证走的是同一条路） */
    private strike(): void {
      if (this.finished || this.roundOver) return;
      const elapsed = this.elapsed();
      const result = strikeAt(this.level, elapsed);
      if (result === 'idle') return;

      const info = phaseAt(this.level, elapsed);
      this.state = applyStrike(this.level, this.state, elapsed);
      this.lastStrike = result;
      this.lastStrikeAt = elapsed;
      this.idleMs = 0;
      cfg.onStrike?.(result, { scene: this });

      if (result === 'hit') {
        this.ctx.emit('beat:enter', { beatId: 'stillness:hit:' + (info.beatId ?? '') });
        this.finish();
        return;
      }

      // 白鼓：力气白使了一次 —— 不扣星、不结束，接着等下一通
      this.ctx.emit('beat:enter', { beatId: 'stillness:early:' + (info.beatId ?? '') });
      this.ctx.emit('choice:made', {
        beatId: info.beatId ?? '',
        choiceId: 'early',
        correct: false,
        latencyMs: elapsed,
      });
      this.sfx('tap');
      this.cameras.main.shake(90, 0.0016);
      this.showHint(cfg.level.hint, 2200, STILLNESS.hintY);
    }

    /** 三通鼓都敲完了还没出手：鼓声停一下，从头再来 —— 零惩罚，也绝不会卡死 */
    private replay(): void {
      this.roundOver = true;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'stillness:round:miss' });
      this.showHint(cfg.level.hint, 2400, STILLNESS.hintY);
      const hold = this.autoplay
        ? Math.max(200, Math.round(STILLNESS.replayHoldMs / STILLNESS.autoplayFactor))
        : STILLNESS.replayHoldMs;
      this.time.delayedCall(hold, () => {
        if (this.finished) return;
        this.startedAt = this.ctx.services.now();
        this.roundOver = false;
        this.lastPhase = null;
        this.lastBeatId = null;
        this.lastStrike = null;
        this.ctx.emit('beat:enter', { beatId: 'stillness:restart' });
      });
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.state = { ...this.state, done: true };
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.action.x, this.level.action.y - 120, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      const finale = this.add.graphics().setDepth(40);
      cfg.drawFinale?.(finale, this.stageState(this.elapsed()));
      if (cfg.reveal !== undefined) {
        this.time.delayedCall(1400, () => this.showHint(cfg.reveal as string, 3200, STILLNESS.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? STILLNESS.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 小手 ----------------

    private showHand(): void {
      if (this.hand) return;
      const { action } = this.level;
      this.hand = createHand(this, action.x, action.y - action.radius - 56, 1.15);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：只在"该出手"的窗口里出手。
     * 用的是与真实操作完全相同的判定与同一条 strike() 路径。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: STILLNESS.autoplayLookMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          if (strikeAt(this.level, this.elapsed()) === 'hit') this.strike();
        },
      });
    }
  };
}
