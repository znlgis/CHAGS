import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  applyStrike, beatMarks, beatProgress, canStrikeAt, effectiveLevel, hitAction, isStillnessDone,
  phaseAt, remainingInBeatMs, slotAt, stillnessStart, strikeAt,
} from './stillness.logic';
import type { BeatMark, StillnessPhase, StillnessState, StrikeResult } from './stillness.logic';
// feign（假痴不癫）：第五辑给 stillness 加的第二个模式 —— 判定同样在 stillness.logic 里
import {
  effectiveFeignLevel, feignCanAct, feignPhaseAt, feignPhaseProgress,
  feignRemainingMs, feignSlotAt, feignStart, hitFeignAction, isFeignDone, tapActionFeign,
} from './stillness.logic';
import type { FeignPhase, FeignState } from './stillness.logic';
import type { StillnessLevel } from './schemas';
import type { StillnessFeignLevel } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';
// calm（空城计）：第六辑给 stillness 加的第三个模式 —— 判定同样在 stillness.logic 里
import {
  calmPhaseAt, calmPhaseProgress, calmRemainingMs, calmStart, calmTick, effectiveCalmLevel,
  hitGate, isCalmDone, openGate, replayCalm, tapCalm,
} from './stillness.logic';
import type { CalmPhase, CalmState } from './stillness.logic';
import type { StillnessCalmLevel } from './schemas';

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
  nextSceneKey?: string;
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
 * - **白鼓也记账**：鼓响的时候出手记进 mistakes（"白费力气"），不结束、不锁操作 —— 接着等就是。
 * - **一轮走完可以重来**：三通鼓敲完还没出手，鼓声停一下从头再响一遍（绝不卡死）。
 *   该出手的那一通窗口开了，小手才放到按钮上：提示给在**对的时候**。
 */
function createStillnessBideScene(
  ctx: GameContext,
  cfg: StillnessConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
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

      // 白鼓：力气白使了一次 —— 不结束、不锁操作，接着等下一通；这一下记进 mistakes
      recordAttempt(cfg.session, { ok: false });
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
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? STILLNESS.finaleHoldMs,
        sparkle: { x: this.level.action.x, y: this.level.action.y - 120, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealDelayMs: 1400,
        revealY: STILLNESS.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.stageState(this.elapsed()));
        }
      });
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

/* ---------------- feign：假痴不癫（第 27 计） ---------------- */

/**
 * 假痴不癫（feign）自己的手感常量。
 * **bide 的 STILLNESS 一个字没动** —— 新模式要的手感与老的完全不同：
 * 老的等的是"该出手的那一瞬"，新的等的是"他走开的这一段"。
 */
export const FEIGN = {
  /** "悄悄动手"那一下的命中宽容度：手指粗也能点得到 */
  tapForgive: 52,
  /** 一轮走完还没推够：静一会儿，从头再试探一遍（**零惩罚**） */
  replayHoldMs: 1700,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 交给游戏画的一切：他正盯着 / 他走开了、推到第几步、露馅几次 */
export interface StillnessFeignStageState {
  /** 此刻是哪一次试探（整轮走完了是 null） */
  testId: string | null;
  /** test = 他正盯着（点什么都算露馅）；gap = 他走开了（这时候才能动） */
  phase: FeignPhase;
  /** 这是第几次试探（0 起）；走完了 = tests.length */
  index: number;
  /** 这一段已经走到几分了（0..1）：灯笼的光按它扫过来 */
  pulse: number;
  /** 现在是不是空档 —— 画面上"可以悄悄动手"的那圈光用它 */
  canAct: boolean;
  /** 空档里行动了几次 / 一共要几步 */
  progress: number;
  steps: number;
  /** 试探期露馅了几次（"忍不住"那几笔账，记进 mistakes） */
  slips: number;
  /** 刚刚那一下是露馅（true）还是推进一步（false）；还没动过是 null */
  lastSlip: boolean | null;
  /** 刚刚那一下过去多久了 —— 表演按它衰减 */
  sinceActionMs: number;
  /** 距离这一段结束还有多久 */
  remainingMs: number;
  elapsedMs: number;
  /** 这一局打赢了 */
  done: boolean;
  /** 一轮走完了、一次也没推够（要重来） —— 零惩罚 */
  roundOver: boolean;
}

export interface StillnessFeignConfig {
  level: StillnessFeignLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就把整屏交给 drawWorld */
  title?: string;
  drawWorld: (g: Phaser.GameObjects.Graphics, state: StillnessFeignStageState) => void;
  /** 他来了（test）/ 他走开了（gap）—— 游戏可以让那个人走位、把灯笼举起来 */
  onPhase?: (phase: FeignPhase, api: { scene: Phaser.Scene }) => void;
  /** 动了一下手：露馅了（slip）还是推进一步（step） */
  onAction?: (result: 'slip' | 'step', api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: StillnessFeignStageState) => void;
  /** 打赢之后念的那句话 */
  reveal?: string;
  finaleHoldMs?: number;
}

/** 两个模式的配置合起来 —— createStillnessScene 按 level.mode 分派 */
export type StillnessAnyConfig = StillnessConfig | StillnessFeignConfig | StillnessCalmConfig;

/**
 * 忍：最难的动作是不动。两个模式说的是同一句话，玩法却正相反：
 * - **bide（以逸待劳）**：鼓一通通地响，只有**该出手**的那一瞬是真机会；
 * - **feign（假痴不癫）**：他一次次来试探，**他盯着的时候什么都不能做**，
 *   他走开的空档里才能动一下。
 *
 * 按 `level.mode` 分派到各自的场景。两个模式共用同一份手感常量里的节拍
 * （autoplayFactor / autoplayLookMs / idleMs / finaleHoldMs）
 * 与同一条收尾流程（结算 → 揭晓语 → 下一幕）；**bide（第 4 计以逸待劳）
 * 那条路径一个字没动** —— 它只是被 mode 判断包起来了。
 */
// 重载（而不是只写联合类型）：老模式那一份配置照旧**原样**收上下文类型 ——
// 游戏包里 `drawWorld: (g, state) => …` 的参数不用手写类型，与扩展之前一字不差。
export function createStillnessScene(
  ctx: GameContext,
  cfg: StillnessConfig,
): Phaser.Types.Scenes.SceneType;
export function createStillnessScene(
  ctx: GameContext,
  cfg: StillnessFeignConfig,
): Phaser.Types.Scenes.SceneType;
export function createStillnessScene(
  ctx: GameContext,
  cfg: StillnessCalmConfig,
): Phaser.Types.Scenes.SceneType;
export function createStillnessScene(
  ctx: GameContext,
  cfg: StillnessAnyConfig,
): Phaser.Types.Scenes.SceneType {
  if (isCalmConfig(cfg)) return createStillnessCalmScene(ctx, cfg);
  if (isFeignConfig(cfg)) return createStillnessFeignScene(ctx, cfg);
  return createStillnessBideScene(ctx, cfg);
}

/**
 * 两个模式的配置是"按关卡模式分"的联合类型。
 * 判别式藏在 `cfg.level.mode` 里（两层），所以显式写成类型守卫 ——
 * 这样每条分支里 cfg 的类型都收窄成对应模式那一份，不用强转。
 */
function isFeignConfig(cfg: StillnessAnyConfig): cfg is StillnessFeignConfig {
  return cfg.level.mode === 'feign';
}

/** 同上：calm（空城计）那一份配置的判别式也在 level.mode 里 */
function isCalmConfig(cfg: StillnessAnyConfig): cfg is StillnessCalmConfig {
  return cfg.level.mode === 'calm';
}

/**
 * 假痴不癫：该沉默的时候要能忍住。
 *
 * 四条刻意的设计：
 * - **判定全在 stillness.logic 里**：场景只把墙钟喂给 `feignPhaseAt` / `tapActionFeign`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **试探期点什么都算露馅**：记进 mistakes、不结束、不锁操作，只记一笔账
 *   （画面上那几笔账看得见）—— 孩子自己会发现"忍住那几秒，空档一来就顶上去了"。
 * - **空档里小手才出现**：提示给在**对的时候**。他盯着的时候小手是收起来的 ——
 *   这本身就是"现在别动"的信号。
 * - **一轮走完可以重来**：三次试探都过去还没推够，静一下从头再试探一遍；
 *   已经推过的步数与那几笔账都留着（**零惩罚，也绝不会卡死**）。
 */
function createStillnessFeignScene(
  ctx: GameContext,
  cfg: StillnessFeignConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class StillnessFeignScene extends BaseScene {
    private level: StillnessFeignLevel = cfg.level;
    private state: FeignState = feignStart();
    private startedAt = 0;
    private finished = false;
    private roundOver = false;
    private lastPhase: FeignPhase | null = null;
    private lastTestId: string | null = null;
    private lastSlip: boolean | null = null;
    private lastActionAt = 0;
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
      this.level = effectiveFeignLevel(cfg.level, this.autoplay, STILLNESS.autoplayFactor);
      this.startedAt = this.ctx.services.now();
      this.introUntil = this.autoplay ? 0 : STILLNESS.introHandMs;

      this.drawBackdrop(cfg.title);
      this.worldGfx = this.add.graphics().setDepth(2);
      this.cueGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 2600, FEIGN.hintY);
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        const info = feignPhaseAt(this.level, elapsed);
        this.syncPhase(info.testId, info.phase);
        if (info.phase === 'done') {
          if (!this.roundOver) this.replay();
        } else {
          this.watch(elapsed, delta);
        }
      }
      this.redraw(elapsed);
    }

    /** 他来试探 / 他走开了：发事件、出声 —— 每一次都一样，不泄露"还有几次" */
    private syncPhase(testId: string | null, phase: FeignPhase): void {
      if (testId === this.lastTestId && phase === this.lastPhase) return;
      const newTest = testId !== this.lastTestId;
      this.lastTestId = testId;
      this.lastPhase = phase;
      if (phase === 'done' || testId === null) return;
      if (newTest) {
        // 他来了：脚步近了，灯笼举起来 —— 这一段什么都不能做
        this.ctx.services.audio.tone(240, 150);
        this.ctx.emit('beat:enter', { beatId: 'stillness:test:' + testId });
        cfg.onPhase?.(phase, { scene: this });
        return;
      }
      if (phase === 'gap') {
        // 他走开了：这一小段才是机会
        this.ctx.services.audio.tone(480, 120);
        this.ctx.emit('beat:enter', { beatId: 'stillness:gap:' + testId });
        cfg.onPhase?.(phase, { scene: this });
        this.idleMs = 0;
      }
    }

    /** 小手只在**空档**里出现：他盯着的时候手是收着的，这本身就是提示 */
    private watch(elapsed: number, delta: number): void {
      const canAct = feignCanAct(this.level, elapsed);
      if (canAct && !this.autoplay && elapsed >= this.introUntil) this.showHand();
      else this.hideHand();

      this.idleMs += delta;
      if (this.idleMs < STILLNESS.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint, 2600, FEIGN.hintY);
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
      if (!state.canAct) return;
      // 空档来了：动手的地方亮一圈（提示给在点上，而不是用文字喊"可以动手了"）
      const pulse = 0.5 + 0.5 * Math.sin(elapsed / 190);
      const { action } = this.level;
      cue.lineStyle(10, THEME.gold, 0.9);
      cue.strokeCircle(action.x, action.y, action.radius + 24 + pulse * 16);
    }

    private stageState(elapsed: number): StillnessFeignStageState {
      const info = feignPhaseAt(this.level, elapsed);
      const slot = feignSlotAt(this.level, elapsed);
      return {
        testId: info.testId,
        phase: info.phase,
        index: slot ? slot.index : this.level.tests.length,
        pulse: feignPhaseProgress(this.level, elapsed),
        canAct: !this.finished && !this.roundOver && feignCanAct(this.level, elapsed),
        progress: this.state.progress,
        steps: this.level.steps,
        slips: this.state.slips,
        lastSlip: this.lastSlip,
        sinceActionMs:
          this.lastSlip === null ? Number.POSITIVE_INFINITY : elapsed - this.lastActionAt,
        remainingMs: feignRemainingMs(this.level, elapsed),
        elapsedMs: elapsed,
        done: this.finished && isFeignDone(this.state),
        roundOver: this.roundOver,
      };
    }

    // ---------------- 动手 ----------------

    /**
     * 手指落在屏幕上：
     * - **试探期：点哪儿都算露馅**（他正盯着，"任何点击都算"）—— 记进 mistakes；
     * - 空档期：只有点在"悄悄动手"的地方上才算推进一步，点别处只是没收获。
     */
    private pressAt(x: number, y: number): void {
      if (this.finished || this.roundOver) return;
      this.idleMs = 0;
      const elapsed = this.elapsed();
      const phase = feignPhaseAt(this.level, elapsed).phase;
      if (phase === 'done') return;
      if (phase === 'test') {
        this.act(elapsed);
        return;
      }
      if (!hitFeignAction(x, y, this.level, FEIGN.tapForgive)) return;
      this.act(elapsed);
    }

    /** 动一下手（真实操作与无头验证走的是同一条路） */
    private act(elapsed: number): void {
      if (this.finished || this.roundOver) return;
      const info = feignPhaseAt(this.level, elapsed);
      const before = this.state;
      this.state = tapActionFeign(this.level, this.state, elapsed);
      if (this.state === before) return;

      const slipped = this.state.slips > before.slips;
      this.lastSlip = slipped;
      this.lastActionAt = elapsed;
      this.idleMs = 0;
      cfg.onAction?.(slipped ? 'slip' : 'step', { scene: this });

      if (slipped) {
        // 露馅了：记进 mistakes —— 不结束、不锁操作，接着忍就是
        recordAttempt(cfg.session, { ok: false });
        this.ctx.emit('beat:enter', { beatId: 'stillness:slip:' + (info.testId ?? '') });
        this.ctx.emit('choice:made', {
          beatId: info.testId ?? '',
          choiceId: 'slip',
          correct: false,
          latencyMs: elapsed,
        });
        this.sfx('tap');
        this.cameras.main.shake(80, 0.0014);
        this.showHint(cfg.level.hint, 2000, FEIGN.hintY);
        return;
      }

      // 空档里推进一步：悄悄地，但看得见
      this.ctx.emit('beat:enter', {
        beatId: 'stillness:step:' + this.state.progress,
      });
      this.sfx('correct');
      sparkleAt(this, this.level.action.x, this.level.action.y - 40, THEME.gold, 6);
      this.hideHand();
      if (isFeignDone(this.state)) this.finish();
    }

    /** 三次试探都过去还没推够：静一下，从头再试探一遍 —— 零惩罚，也绝不会卡死 */
    private replay(): void {
      this.roundOver = true;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'stillness:round:miss' });
      this.showHint(cfg.level.hint, 2400, FEIGN.hintY);
      const hold = this.autoplay
        ? Math.max(200, Math.round(FEIGN.replayHoldMs / STILLNESS.autoplayFactor))
        : FEIGN.replayHoldMs;
      this.time.delayedCall(hold, () => {
        if (this.finished) return;
        this.startedAt = this.ctx.services.now();
        this.roundOver = false;
        this.lastPhase = null;
        this.lastTestId = null;
        this.idleMs = 0;
        this.ctx.emit('beat:enter', { beatId: 'stillness:restart' });
      });
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.state = { ...this.state, done: true };
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? STILLNESS.finaleHoldMs,
        sparkle: { x: this.level.action.x, y: this.level.action.y - 120, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealDelayMs: 1400,
        revealY: FEIGN.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'stillness:done' });
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.stageState(this.elapsed()));
        }
      });
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
     * 无头验证：**只在空档期出手** —— 与孩子走的是同一条路（连命中判定都走一遍）。
     * 他盯着的时候一下都不点，所以无头验证跑完 slips 是 0。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: STILLNESS.autoplayLookMs,
        loop: true,
        callback: () => {
          if (this.finished || this.roundOver) return;
          if (!feignCanAct(this.level, this.elapsed())) return;
          const { action } = this.level;
          this.pressAt(action.x, action.y);
        },
      });
    }
  };
}

/* ---------------- calm：空城计（第 32 计） ---------------- */

/**
 * 空城计（calm）自己的手感常量。
 * **bide 的 STILLNESS 与 feign 的 FEIGN 一个字没动** —— 这个模式等的东西与前两个都不一样：
 * 老的等的是"该出手的那一瞬"，feign 等的是"他走开的那一小段"，
 * 这一关等的是"他盯着看的时候，你什么都不做"。
 */
export const CALM = {
  /** 点城门的宽容度：手指粗也点得到 */
  tapForgive: 56,
  /** 一轮全看完还没忍够：他再从头盯一遍（**零惩罚**，也绝不会卡死） */
  replayHoldMs: 1800,
  /** 提示气泡的高度 */
  hintY: 268,
  /** 他退走时那句话在屏幕上留多久，之后换成本计的揭晓语 */
  leaveLineMs: 1800,
} as const;

/** 交给游戏画的一切：城门开了没有、他正盯着还是移开了目光、忍住了几轮 */
export interface StillnessCalmStageState {
  /** 城门大开没有 —— 画面上的两扇门按它开合 */
  gateOpen: boolean;
  /** gate = 还没开门；watch = 他正盯着；gap = 他移开了目光；done = 全看完了 */
  phase: CalmPhase;
  /** 这是第几轮（0 起）；还没开门是 0，全走完 = watches.length */
  index: number;
  /** 此刻是哪一轮；还没开门 / 全走完是 null */
  watchId: string | null;
  /** 这一轮走到几分了（0..1）：他目光扫过来的那道光按它推 */
  pulse: number;
  /** 忍住了几轮 / 一共要忍住几轮 */
  endured: number;
  needed: number;
  /** 动了几次（记进 mistakes 的那笔账） */
  slips: number;
  /** 哪几轮动过 —— 画面上那几笔账画在哪一轮 */
  slipWatchIds: string[];
  /** 刚刚动了一下；还没动过是 null */
  lastSlip: boolean | null;
  /** 刚刚那一下过去多久了 —— 表演按它衰减 */
  sinceActionMs: number;
  /** 距离他目光移开（盯着时）/ 再看过来（空档时）还有多久 */
  remainingMs: number;
  elapsedMs: number;
  /** 这一局过了 */
  done: boolean;
  /** 一轮全看完了、还没忍够（要重来）—— 零惩罚 */
  roundOver: boolean;
}

export interface StillnessCalmConfig {
  level: StillnessCalmLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就把整屏交给 drawWorld */
  title?: string;
  drawWorld: (g: Phaser.GameObjects.Graphics, state: StillnessCalmStageState) => void;
  /** 他盯过来（watch）/ 移开目光（gap）—— 游戏可以让那个人走近、把火把举起来 */
  onPhase?: (phase: CalmPhase, api: { scene: Phaser.Scene }) => void;
  /** 城门大开（开局唯一那个动作） */
  onGate?: (api: { scene: Phaser.Scene }) => void;
  /** 他盯着的时候动了一下 —— 记进 mistakes */
  onSlip?: (api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: StillnessCalmStageState) => void;
  /** 过了之后念的那句话（关键抉择的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 空城计：该不动的时候一下都不能动。
 *
 * 四条刻意的设计：
 * - **判定全在 stillness.logic 里**：场景只把墙钟（从城门大开那一刻算起）喂给
 *   calmTick / calmPhaseAt / tapCalm，单测与画面用的是同一份判定，不会跑偏。
 * - **开局只有一个动作**：大开城门。小手一直放在城门上，门一开手就收起来 ——
 *   收起来本身就是"从现在起什么都别做"的信号。
 * - **盯着的时候点哪儿都算"动了"**：记进 mistakes、不结束、不锁操作，只记一笔账 ——
 *   这一轮白忍了，下一轮照样能赢。孩子自己会发现"忍住那几秒，他就先疑心了"。
 * - **一轮全看完还没忍够就再来一遍**：忍住的轮数留着，账也留着（**零惩罚，也绝不会卡死**）。
 */
function createStillnessCalmScene(
  ctx: GameContext,
  cfg: StillnessCalmConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class StillnessCalmScene extends BaseScene {
    private level: StillnessCalmLevel = cfg.level;
    private state: CalmState = calmStart();
    private startedAt = 0;
    /** 城门大开的那一刻：判定里的 t 从这儿算起（见 stillness.logic 的 calmPhaseAt） */
    private gateOpenedAt = 0;
    private finished = false;
    private roundOver = false;
    private lastPhase: CalmPhase | null = null;
    private lastWatchId: string | null = null;
    private lastSlip: boolean | null = null;
    private lastActionAt = 0;
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private cueGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.stillness, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.stillness });
      this.level = effectiveCalmLevel(cfg.level, this.autoplay, STILLNESS.autoplayFactor);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title);
      this.worldGfx = this.add.graphics().setDepth(2);
      this.cueGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 2600, CALM.hintY);
    }

    /** 场景自己的墙钟：画面上的呼吸、闪光按它走 */
    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    /** 判定里的 t：**从城门大开那一刻算起**；门还没开就是 0（那一段没有时间轴） */
    private calmElapsed(): number {
      if (!this.state.gateOpen) return 0;
      return Math.max(0, this.ctx.services.now() - this.gateOpenedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const t = this.calmElapsed();
      if (!this.finished) {
        // 把墙钟喂给判定：他已经看完的每一轮，只要这期间没见你动，就记一笔"忍住"
        this.state = calmTick(this.level, this.state, t);
        const info = calmPhaseAt(this.level, this.state, t);
        this.syncPhase(info.watchId, info.phase);
        if (isCalmDone(this.level, this.state)) this.finish();
        else if (info.phase === 'done') {
          if (!this.roundOver) this.replay();
        } else {
          this.watch(delta);
        }
      }
      this.redraw(t);
    }

    /** 他盯过来 / 移开目光：发事件、出声 —— 每一轮都一样，不泄露"还有几轮" */
    private syncPhase(watchId: string | null, phase: CalmPhase): void {
      if (watchId === this.lastWatchId && phase === this.lastPhase) return;
      const newWatch = watchId !== this.lastWatchId;
      this.lastWatchId = watchId;
      this.lastPhase = phase;
      if (phase === 'done' || phase === 'gate' || watchId === null) return;
      if (newWatch) {
        // 他盯过来了：脚步停住、目光扫过来 —— 这一段里一下都不能动
        this.ctx.services.audio.tone(240, 150);
        this.ctx.emit('beat:enter', { beatId: 'stillness:watch:' + watchId });
        cfg.onPhase?.('watch', { scene: this });
        return;
      }
      if (phase === 'gap') {
        // 他把目光移开了：这一小段可以松口气（但动手也没用 —— 他没看）
        this.ctx.services.audio.tone(480, 120);
        this.ctx.emit('beat:enter', { beatId: 'stillness:gap:' + watchId });
        cfg.onPhase?.('gap', { scene: this });
      }
    }

    /**
     * 小手只在**城门还没开**的时候出现：门一开，手就收起来 ——
     * 收起来本身就是"从现在起什么都别做"的信号（这一关没有"该点的地方"）。
     */
    private watch(delta: number): void {
      if (this.state.gateOpen) this.hideHand();
      else this.showHand();

      this.idleMs += delta;
      if (this.idleMs < STILLNESS.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint, 2600, CALM.hintY);
    }

    private redraw(t: number): void {
      const state = this.stageState(t);
      if (this.worldGfx) {
        this.worldGfx.clear();
        cfg.drawWorld(this.worldGfx, state);
      }
      const cue = this.cueGfx;
      if (!cue) return;
      cue.clear();
      const { width, height } = this.ctx.manifest.designSize;
      // 他盯着的时候，屏幕边上亮起一圈红边 —— "现在哪儿都不能点"。
      // 提示给在"别动"上，而不是指一个地方（这一关压根没有该点的地方）。
      if (state.phase === 'watch' && !state.done) {
        const breathe = 0.5 + 0.5 * Math.sin(state.elapsedMs / 260);
        cue.lineStyle(14, THEME.redDeep, 0.18 + 0.24 * breathe);
        cue.strokeRoundedRect(10, 158, width - 20, height - 172, 40);
      }
      // 忍住了几轮 / 还要忍住几轮：右上角一排小灯（不泄露每一轮他看多久）
      const lit = Math.min(state.endured, state.needed);
      for (let i = 0; i < state.needed; i += 1) {
        const cx = width - 62 - i * 62;
        cue.fillStyle(i < lit ? THEME.gold : THEME.inkSoft, i < lit ? 1 : 0.16);
        cue.fillCircle(cx, 196, 17);
        cue.lineStyle(5, THEME.outline, 0.65);
        cue.strokeCircle(cx, 196, 17);
      }
    }

    private stageState(t: number): StillnessCalmStageState {
      const info = calmPhaseAt(this.level, this.state, t);
      return {
        gateOpen: this.state.gateOpen,
        phase: info.phase,
        index: info.index,
        watchId: info.watchId,
        pulse: calmPhaseProgress(this.level, this.state, t),
        endured: this.state.endured,
        needed: this.level.needed,
        slips: this.state.slips,
        slipWatchIds: this.state.slipWatchIds,
        lastSlip: this.lastSlip,
        sinceActionMs:
          this.lastSlip === null ? Number.POSITIVE_INFINITY : t - this.lastActionAt,
        remainingMs: calmRemainingMs(this.level, this.state, t),
        elapsedMs: this.elapsed(),
        done: this.finished && isCalmDone(this.level, this.state),
        roundOver: this.roundOver,
      };
    }

    // ---------------- 手指 ----------------

    /**
     * 手指落在屏幕上：
     * - **城门还没开**：只有点在城门上才算 —— 那是开局唯一的动作；
     * - **门开了以后**：点哪儿都算"他盯着的时候动了"（记进 mistakes，只记一笔）；
     *   他移开目光的那一段点一下什么也不算 —— 他没看见。
     */
    private pressAt(x: number, y: number): void {
      if (this.finished || this.roundOver) return;
      this.idleMs = 0;
      if (!this.state.gateOpen) {
        if (!hitGate(x, y, this.level, CALM.tapForgive)) return;
        this.raiseGate();
        return;
      }
      const t = this.calmElapsed();
      const before = this.state;
      this.state = tapCalm(this.level, this.state, t);
      if (this.state === before) return;
      this.flinch(t);
    }

    /** 大开城门 —— 开局唯一那个动作（真实操作与无头验证走的是同一条路） */
    private raiseGate(): void {
      if (this.finished || this.roundOver || this.state.gateOpen) return;
      this.state = openGate(this.level, this.state);
      this.gateOpenedAt = this.ctx.services.now();
      this.hideHand();
      this.sfx('correct');
      this.ctx.emit('beat:enter', { beatId: 'stillness:gate' });
      cfg.onGate?.({ scene: this });
    }

    /** 他盯着的时候动了一下：记进 mistakes —— 这一轮白忍了，等下一轮（不结束、不锁操作） */
    private flinch(t: number): void {
      recordAttempt(cfg.session, { ok: false });
      const info = calmPhaseAt(this.level, this.state, t);
      this.lastSlip = true;
      this.lastActionAt = t;
      this.idleMs = 0;
      this.ctx.emit('beat:enter', { beatId: 'stillness:slip:' + (info.watchId ?? '') });
      this.ctx.emit('choice:made', {
        beatId: info.watchId ?? '',
        choiceId: 'slip',
        correct: false,
        latencyMs: t,
      });
      this.sfx('tap');
      this.cameras.main.shake(90, 0.0016);
      this.showHint(cfg.level.doubtLine, 2200, CALM.hintY);
      if (!this.autoplay) this.speak(cfg.level.doubtLine);
      cfg.onSlip?.({ scene: this });
    }

    /** 一轮全看完了还没忍够：他再从头盯一遍 —— 忍住的轮数留着（零惩罚，也绝不会卡死） */
    private replay(): void {
      this.roundOver = true;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'stillness:round:miss' });
      this.showHint(cfg.level.hint, 2400, CALM.hintY);
      const hold = this.autoplay
        ? Math.max(200, Math.round(CALM.replayHoldMs / STILLNESS.autoplayFactor))
        : CALM.replayHoldMs;
      this.time.delayedCall(hold, () => {
        if (this.finished) return;
        const now = this.ctx.services.now();
        this.startedAt = now;
        this.gateOpenedAt = now;
        this.roundOver = false;
        this.idleMs = 0;
        this.state = replayCalm(this.state);
        this.lastPhase = null;
        this.lastWatchId = null;
        this.lastSlip = null;
        this.ctx.emit('beat:enter', { beatId: 'stillness:restart' });
      });
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? STILLNESS.finaleHoldMs,
        sparkle: { x: this.level.gate.x, y: this.level.gate.y - 180, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealDelayMs: CALM.leaveLineMs,
        revealY: CALM.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'stillness:done' });
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.stageState(this.calmElapsed()));
          // 他退走时说的那句话，然后是这一计的揭晓语
          this.showHint(cfg.level.leaveLine, CALM.leaveLineMs, CALM.hintY);
          if (!this.autoplay) this.speak(cfg.level.leaveLine);
        }
      });
    }

    // ---------------- 小手 ----------------

    private showHand(): void {
      if (this.hand) return;
      const { gate } = this.level;
      this.hand = createHand(this, gate.x, gate.y - gate.radius - 34, 1.15);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：先把城门打开（与孩子走的是同一条路，连命中的宽容判定都走一遍），
     * **然后一下都不点** —— 忍住就是这一关的答案。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: STILLNESS.autoplayLookMs,
        loop: true,
        callback: () => {
          if (this.finished || this.roundOver) return;
          if (this.state.gateOpen) return;
          this.pressAt(this.level.gate.x, this.level.gate.y);
        },
      });
    }
  };
}
