import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createGestureGuard, createHand, sparkleAt, tapRipple } from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  SWAP_TIMING, caughtPosts, gateHit, isAllSwapped, isPostSwapped, isShellDone, leave, nextPeekInMs,
  nextPostToSwap, nextSwapStep, peek, placeSpare, postAt, seenCount, spareAt, spareById,
  spareStandingAt, swapCount, swapStart,
} from './swap.logic';
import type { SwapState } from './swap.logic';
import type { SwapLevel, SwapPost, SwapSpare } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';
// beam（偷梁换柱）：判定与类型另起一段引入 —— 老模式那几行一个字没改
import {
  BEAM_TIMING, beamPostAt, beamPostById, beamSeenCount, beamStart, check, checkCount, isBeamDone,
  isPostRebuilt, nextCheckInMs, nextPostToWork, rebuiltCount, startWork, tickWork, workRatio,
  workingPostId,
} from './swap.logic';
import type { SwapBeamState } from './swap.logic';
import type { SwapBeamLevel } from './schemas';

/**
 * 替换模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（placeMs / sweepMs / autoplayStepMs…）来自 swap.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const SWAP = {
  ...SWAP_TIMING,
  /** 点的宽容度：位置与替身都是巴掌大的圆，手指粗也点得到 */
  tapForgive: 44,
  /** 小手放在目标下面多少 */
  handDrop: 34,
  /** 提示光圈比目标大多少 */
  ringPad: 22,
  /** 点空时那圈涟漪亮多久 */
  rippleMs: 700,
  /** 拿在手上的替身往指尖上面提这么高（画在指尖正中会盖住手指） */
  carryLift: 84,
  /** 检查者的灯柱有多宽 */
  beamWidth: 138,
  /** 灯柱上下比那一排位置多照出来的高度 */
  beamPadTop: 210,
  beamPadBottom: 150,
  /** 进度槽（换好了几个位置）画在左下角 —— 右边留给院门（exit） */
  progress: { x: 40, y: 1256, w: 420, h: 38 },
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface SwapStageState {
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 已经换好的位置（替身站在那儿） */
  swapped: string[];
  /** postId → spareId：那个位置上站着的是哪一个替身（画草堆要用：站上去的就不在草堆里了） */
  covers: Record<string, string>;
  /** 被检查者看见过、还没重新换好的位置 */
  caught: string[];
  /** 手上拿着的替身；空着手就是 null */
  carrying: string | null;
  /** 手上那个替身此刻画在哪儿；空着手就是 null */
  carryingAt: { x: number; y: number } | null;
  /** 换好了几个 / 一共几个 */
  swappedCount: number;
  total: number;
  /** 被看见了几次 —— 复盘用，也记进 mistakes */
  seen: number;
  /** 距离下一次抬头还有多久（画面把这一刻度画出来） */
  nextPeekInMs: number;
  /** 刚抬头（灯正在扫）的时刻；-1 = 没在扫 */
  lastPeekAtMs: number;
  /** 刚放上去的那个位置 / 什么时候放的（落位的动画按它演） */
  lastPlacePost: string | null;
  lastPlaceAtMs: number;
  /** 上一次"样子不对"发生在什么时候（记进 mistakes 的那一下） */
  lastWrongAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 已经脱壳走掉了 */
  done: boolean;
}

export interface SwapConfig {
  level: SwapLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：营地、一排位置、地上的草堆、院门、岗楼（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: SwapLevel) => void;
  /** 每帧重画：每个位置上此刻站的是谁、草堆里还剩哪些替身、手上拿着哪一个 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: SwapStageState, level: SwapLevel) => void;
  /** 收尾：全换好了、人也走了之后的样子 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: SwapStageState, level: SwapLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 替换：把一排"还站在那儿的人"换成替身，**样子要对**；
 * 检查者每隔 peekMs 抬头看一次，没换好的位置会被看见（戳穿），要重新换。
 *
 * 三条刻意的设计：
 * - **判定全在 swap.logic 里**：点哪一个替身、放不放到这个位置、什么时刻会被看见，
 *   单测与画面用的是同一份函数，不会跑偏。
 * - **不结束**：样子不对只是放不上去（原样返回，红圈晃一下，记进 mistakes）；
 *   被检查者看见也**不结束** —— 只是那个位置要重新换（记进 mistakes）。
 *   孩子可以放心地一个一个试过去。
 * - **提示给在点上**：小手只在两步之间指路 —— 空着手就指"该拿哪一个替身"，
 *   手上有替身就指"该放到哪一个位置"；全换好了就指院门。
 */
/**
 * shell（金蝉脱壳）那条路：**一行没改**，只是从 createSwapScene 里挪成了一个具名函数；
 * beam（偷梁换柱）那一半在文件末尾另起一段，由 mode 分派（见 createSwapScene）。
 */
function createShellSwapScene(ctx: GameContext, cfg: SwapConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SwapScene extends BaseScene {
    private level: SwapLevel = cfg.level;
    private state: SwapState = swapStart(cfg.level);
    private startedAt = 0;
    private done = false;
    private misses = 0;
    private readonly gesture = createGestureGuard();
    private carrying: string | null = null;
    /** 无头验证：已经排过一次"走掉"了没有 */
    private autoplayLeaving = false;
    private carryingAt: { x: number; y: number } | null = null;
    private pointerAt: { x: number; y: number } | null = null;
    private lastPeekAt = -1;
    private lastPlacePost: string | null = null;
    private lastPlaceAt = -1;
    private lastWrongAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.swap, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /** 检查者抬头：到点就看一次（没换好的位置会被看见）—— 灯扫过去的那一下出声、发事件 */
    private watchPeek(t: number): void {
      if (this.done) return;
      const before = this.state;
      const after = peek(this.level, this.state, t);
      if (after === before) return; // 还没到点
      const caughtNow = caughtPosts(this.level, after).filter(
        (post) => !caughtPosts(this.level, before).some((item) => item.id === post.id),
      );
      this.state = after;
      this.lastPeekAt = t;
      this.idleMs = 0;
      if (caughtNow.length > 0) {
        // 被看见了：这是一次"戳穿"（事件照发，e2e 与复盘都看得见）
        // 每个被戳穿的位置都是一次没换好的尝试：记进 mistakes（不结束、不锁操作）
        caughtNow.forEach(() => recordAttempt(cfg.session, { ok: false }));
        this.ctx.emit('beat:enter', { beatId: 'swap:seen:' + seenCount(after) });
      }
      // 无头验证不出声、不表演（事件流照旧，画面与声音只给真孩子）
      if (this.autoplay) return;
      if (caughtNow.length > 0) {
        // 一声低音 + 轻微一晃 —— 这是"被看出来了"的分量，不是"答错了"
        this.ctx.services.audio.tone(196, 260);
        this.cameras.main.shake(180, 0.006);
      } else {
        this.sfx('tap');
      }
      this.time.delayedCall(SWAP.sweepMs, () => {
        if (!this.done) this.pointAtNext();
      });
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(stage);
      if (this.done && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): SwapStageState {
      return {
        elapsedMs: t,
        swapped: this.level.posts.filter((post) => isPostSwapped(this.state, post.id)).map((post) => post.id),
        covers: { ...this.state.covers },
        caught: this.state.caught,
        carrying: this.carrying,
        carryingAt: this.carrying === null ? null : this.carryingAt,
        swappedCount: swapCount(this.state),
        total: this.level.posts.length,
        seen: seenCount(this.state),
        nextPeekInMs: nextPeekInMs(this.level, this.state, t),
        lastPeekAtMs: this.lastPeekAt,
        lastPlacePost: this.lastPlacePost,
        lastPlaceAtMs: this.lastPlaceAt,
        lastWrongAtMs: this.lastWrongAt,
        misses: this.misses,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：
     * 检查者抬头的**灯柱**（从左扫到右，扫过那一排位置）、
     * 被戳穿的位置上**一直亮着的红圈**、刚放上去那一下的金圈、
     * "样子不对"的灰圈 —— 都是"刚才发生了什么"，不额外写字。
     */
    private drawMarks(stage: SwapStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const t = stage.elapsedMs;

      // 抬头的灯柱：扫过去就是一整排被看了一遍
      const sincePeek = t - stage.lastPeekAtMs;
      if (stage.lastPeekAtMs >= 0 && sincePeek >= 0 && sincePeek <= SWAP.sweepMs) {
        const p = sincePeek / SWAP.sweepMs;
        const width = this.W + SWAP.beamWidth * 2;
        const x = -SWAP.beamWidth + width * p;
        const top = Math.min(...this.level.posts.map((post) => post.y)) - SWAP.beamPadTop;
        const bottom = Math.max(...this.level.posts.map((post) => post.y)) + SWAP.beamPadBottom;
        g.fillStyle(THEME.gold, 0.16);
        g.fillRect(x - SWAP.beamWidth / 2, top, SWAP.beamWidth, bottom - top);
        g.fillStyle(THEME.gold, 0.3);
        g.fillRect(x - 3, top, 6, bottom - top);
      }

      // 被戳穿的位置：红圈一直亮着，直到重新换好
      const breathe = 0.7 + 0.3 * Math.sin(t / 220);
      for (const post of caughtPosts(this.level, this.state)) {
        g.lineStyle(9, THEME.red, 0.9 * breathe);
        g.strokeCircle(post.x, post.y, post.radius + SWAP.ringPad);
        g.lineStyle(5, THEME.red, 0.4 * breathe);
        g.strokeCircle(post.x, post.y, post.radius + SWAP.ringPad + 22);
      }

      // 刚放上去那一下：金光往外扩一圈
      const post = this.level.posts.find((item) => item.id === stage.lastPlacePost);
      const sincePlace = t - stage.lastPlaceAtMs;
      if (post !== undefined && sincePlace >= 0 && sincePlace <= SWAP.placeMs) {
        const p = sincePlace / SWAP.placeMs;
        g.lineStyle(10, THEME.gold, 0.9 * (1 - p));
        g.strokeCircle(post.x, post.y, post.radius + 14 + 54 * p);
      }

      // 样子不对：灰圈晃一下（只提示，记进 mistakes）—— 圈在手上那个替身那儿
      if (t - stage.lastWrongAtMs <= 460 && stage.lastWrongAtMs >= 0) {
        const p = (t - stage.lastWrongAtMs) / 460;
        const at = stage.carryingAt ?? { x: this.W / 2, y: this.H / 2 };
        g.lineStyle(7, THEME.inkSoft, 0.5 * (1 - p));
        g.strokeCircle(at.x, at.y, 60 + 90 * (1 - p));
      }

      // 手上的替身：脚下那一圈"拿稳了"的光
      if (stage.carryingAt !== null) {
        g.lineStyle(6, THEME.teal, 0.75);
        g.strokeCircle(stage.carryingAt.x, stage.carryingAt.y, 44);
      }
    }

    // ---------------- 点 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      // 多点触控：正在拖/拿着的时候，别的手指不参与（否则会把它接走或提前放下）
      if (!this.gesture.begin(pointer)) return;
      this.idleMs = 0;
      this.pointerAt = { x: pointer.x, y: pointer.y };
      if (this.carrying !== null) this.carryingAt = this.pointerAt;
      if (this.done) return;
      const x = pointer.x;
      const y = pointer.y;

      const spare = spareAt(this.level, x, y, SWAP.tapForgive);
      if (spare !== undefined) {
        this.pickSpare(spare);
        return;
      }
      const post = postAt(this.level, x, y, SWAP.tapForgive);
      if (post !== undefined) {
        this.placeOn(post);
        return;
      }
      if (gateHit(this.level, x, y, SWAP.tapForgive)) {
        this.tryLeave();
        return;
      }
      this.nothing(x, y);
    }

    /**
     * 手指一松：从草堆里**拖**到位置上就换好了（一次手势换一个位置）。
     * 点一下拿起、再点一下位置，也走同一条路 —— 两种手感都支持。
     */
    private onRelease(pointer: Phaser.Input.Pointer): void {
      if (!this.gesture.isActive(pointer)) return;
      this.gesture.end(pointer);
      this.pointerAt = { x: pointer.x, y: pointer.y };
      if (this.done || this.carrying === null) return;
      const post = postAt(this.level, pointer.x, pointer.y, SWAP.tapForgive);
      if (post !== undefined) this.placeOn(post);
    }

    /** 从草堆里拿起一个替身（拿在手上，跟着指尖走）—— 真实操作与无头验证同一条路 */
    private pickSpare(spare: SwapSpare): void {
      if (this.done) return;
      if (spareStandingAt(this.state, spare.id) !== undefined) {
        // 这个替身已经站在某个位置上了：点它只是没收获（零惩罚）
        this.nothing(spare.x, spare.y);
        return;
      }
      this.carrying = spare.id;
      this.carryingAt = this.pointerAt ?? { x: spare.x, y: spare.y - SWAP.carryLift };
      this.idleMs = 0;
      this.sfx('tap');
      sparkleAt(this, spare.x, spare.y, THEME.teal, 4);
      this.ctx.emit('beat:enter', { beatId: 'swap:carry:' + spare.id });
      this.pointAtNext();
    }

    /** 把手上的替身放到位置上：**样子不对就放不上去**（原样返回，记进 mistakes） */
    private placeOn(post: SwapPost): void {
      if (this.done) return;
      const spareId = this.carrying;
      if (spareId === null) {
        // 空着手点位置：只是没收获（小手会指到草堆上）
        this.nothing(post.x, post.y);
        this.pointAtNext();
        return;
      }
      const before = this.state;
      this.state = placeSpare(this.level, this.state, post.id, spareId);
      if (this.state === before) {
        // 样子不对：原样返回，只晃一下 —— 不结束、不锁操作；这一下记进 mistakes（放错了一次），
        // 替身还在手上，换一个位置再试就是
        recordAttempt(cfg.session, { ok: false });
        this.lastWrongAt = this.now();
        this.idleMs = 0;
        this.sfx('tap');
        this.ctx.emit('beat:enter', { beatId: 'swap:wrong:' + post.id + ':' + spareId });
        this.showHint(this.level.hint, 2200, SWAP.hintY);
        this.pointAtNext();
        return;
      }
      const t = this.now();
      this.lastPlacePost = post.id;
      this.lastPlaceAt = t;
      this.carrying = null;
      this.carryingAt = null;
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, post.x, post.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'swap:place:' + post.id });
      this.ctx.emit('choice:made', {
        beatId: 'swap:place',
        choiceId: post.id,
        correct: true,
        latencyMs: t,
      });
      recordAttempt(cfg.session, { ok: true });
      if (isAllSwapped(this.level, this.state)) {
        // 一排都换成替身了：院门开着小手在招手，走掉才算脱壳
        this.ctx.emit('beat:enter', { beatId: 'swap:ready' });
        this.showHint(this.level.hint, 2600, SWAP.hintY);
      }
      this.hideHand();
      this.time.delayedCall(SWAP.placeMs, () => this.pointAtNext());
    }

    /** 从院门走掉：全换好了才走得成（零惩罚：没换完点了只是没动静） */
    private tryLeave(): void {
      if (this.done) return;
      const before = this.state;
      this.state = leave(this.level, this.state, this.now());
      if (this.state === before) {
        this.nothing(this.level.exit.x, this.level.exit.y);
        return;
      }
      this.finish();
    }

    /** 点了空处 / 点了已经站上去的替身：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'swap:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done || !isShellDone(this.level, this.state)) return;
      this.done = true;
      this.carrying = null;
      this.carryingAt = null;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SWAP.finaleHoldMs,
        sparkle: { x: this.level.exit.x, y: this.level.exit.y, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: SWAP.hintY,
        finalize: () => {
          this.ctx.emit('beat:enter', { beatId: 'swap:done' });
          this.ctx.emit('choice:made', {
            beatId: 'swap:leave',
            choiceId: 'shell',
            correct: true,
            latencyMs: this.now(),
          });
        }
      });
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手放到"该动的那一处"：空着手就指该拿的替身，手上有替身就指该放的位置 */
    private pointAtNext(): void {
      if (this.done) return;
      const target = this.nextTarget();
      if (target === null) {
        this.clearRing();
        this.hideHand();
        return;
      }
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(target.x, target.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, target.radius + SWAP.ringPad);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.14,
        alpha: 0.4,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hideHand();
      this.hand = createHand(this, target.x, target.y + target.radius + SWAP.handDrop, 1.1);
    }

    private nextTarget(): { x: number; y: number; radius: number } | null {
      if (this.carrying !== null) {
        // 手上有替身：指一个"样子对得上、而且还没换好"的位置
        const spare = spareById(this.level, this.carrying);
        if (spare === undefined) return null;
        const post =
          nextPostToSwap(this.level, this.state)?.kind === spare.kind
            ? nextPostToSwap(this.level, this.state)
            : this.level.posts.find(
                (item) => item.kind === spare.kind && !isPostSwapped(this.state, item.id),
              );
        return post === undefined ? null : { x: post.x, y: post.y, radius: post.radius };
      }
      if (isAllSwapped(this.level, this.state)) {
        // 全换好了：该走掉了
        return { x: this.level.exit.x, y: this.level.exit.y, radius: this.level.exit.radius };
      }
      const step = nextSwapStep(this.level, this.state);
      return step === undefined ? null : { x: step.spare.x, y: step.spare.y, radius: step.spare.radius };
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

    private ripple(x: number, y: number, radius: number, color: number): void {
      const g = tapRipple(this, x, y, radius, color);
      this.time.delayedCall(SWAP.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：趁两次检查之间把该换的换完 ——
     * **先补被看见过、最久没换的那个**；全换好之后走到院门那里。
     * 走的是与孩子完全同一条路（连"拿在手上"这一步都走一遍）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: SWAP.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      if (isAllSwapped(this.level, this.state)) {
        this.leaveByAutoplay();
        return;
      }
      if (this.carrying !== null) {
        const spare = spareById(this.level, this.carrying);
        if (spare === undefined) return;
        const target =
          nextPostToSwap(this.level, this.state)?.kind === spare.kind
            ? nextPostToSwap(this.level, this.state)
            : this.level.posts.find(
                (item) => item.kind === spare.kind && !isPostSwapped(this.state, item.id),
              );
        if (target === undefined) return;
        // 手抬到位置上再放下去（画面上就是"递过去"）
        this.carryingAt = { x: target.x, y: target.y - SWAP.carryLift };
        this.placeOn(target);
        return;
      }
      const step = nextSwapStep(this.level, this.state);
      if (step === undefined) return;
      this.pickSpare(step.spare);
      this.carryingAt = { x: step.spare.x, y: step.spare.y - SWAP.carryLift };
      this.pointerAt = this.carryingAt;
    }

    private leaveByAutoplay(): void {
      // 无头验证的每一步都会走到这里：只排一次"走掉"，别堆一串
      if (this.autoplayLeaving) return;
      this.autoplayLeaving = true;
      this.time.delayedCall(SWAP.autoplayLeaveMs, () => {
        if (this.done) return;
        this.tryLeave();
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const t = this.now();
      this.watchPeek(t);
      this.redraw(t);
      if (this.done) return;
      // 卡住了：把关卡自己的那句话再亮一遍，并指一指该动的地方
      this.idleMs += delta;
      if (this.idleMs >= SWAP.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, SWAP.hintY);
        this.pointAtNext();
      }
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.swap });
      this.level = cfg.level;
      this.state = swapStart(this.level);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (!this.gesture.isActive(pointer)) return;
        this.pointerAt = { x: pointer.x, y: pointer.y };
        if (this.carrying !== null) this.carryingAt = this.pointerAt;
      });
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onRelease(pointer));
      // 手指/鼠标滑出画面再松手也算放下：不然手里那张卡一直挂着（同文件第二条玩法已有这行）
      this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onRelease(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 3000, SWAP.hintY);
        this.time.delayedCall(SWAP.introHandMs, () => this.pointAtNext());
      }
    }
  };
}

// ---------------- 画面用的两个小工具（口径与判定同一份，游戏包直接用） ----------------

/** 进度槽：换好了几个位置（0..total） */
export function swapProgressBar(
  g: Phaser.GameObjects.Graphics,
  level: SwapLevel,
  swappedCount: number,
): void {
  const { x, y, w, h } = SWAP.progress;
  g.fillStyle(THEME.card, 0.94);
  g.fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x, y, w, h, h / 2);
  const inner = w - 12;
  const fill = (inner * Math.min(swappedCount, level.posts.length)) / Math.max(1, level.posts.length);
  if (fill > 6) {
    g.fillStyle(THEME.gold, 1);
    g.fillRoundedRect(x + 6, y + 6, fill, h - 12, (h - 12) / 2);
  }
}

/** 下一个该换的位置（小手与提示都按它走） */
export function nextSwapPost(level: SwapLevel, state: SwapState): SwapPost | undefined {
  return nextPostToSwap(level, state);
}

/* ---------------- swap 扩展：beam（第 25 计 · 偷梁换柱） ---------------- */

/**
 * beam 的手感常量 —— 时间的那几个（autoplayStepMs / standMs / sweepMs…）来自 swap.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const SWAP_BEAM = {
  ...BEAM_TIMING,
  /** 点的宽容度：柱子是巴掌大的圆，手指粗也点得到 */
  tapForgive: 48,
  /** 小手放在柱子下面多少 */
  handDrop: 34,
  /** 提示光圈 / 进度环比柱子大多少 */
  ringPad: 22,
  /** 点空时那圈涟漪亮多久 */
  rippleMs: 700,
  /** 检查者的灯柱有多宽 */
  beamWidth: 150,
  /** 灯柱上下比这一排柱子多照出来的高度 */
  beamPadTop: 240,
  beamPadBottom: 170,
  /** 进度槽（换好了几根）画在左下角 —— 与 shell 那条同一个位置，样式一致 */
  progress: { x: 40, y: 1256, w: 420, h: 38 },
} as const;

/** 交给游戏画的 beam 一帧（每帧一份新的） */
export interface SwapBeamStageState {
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 已经换好的柱子（按换好的先后） */
  rebuilt: string[];
  /** postId → spareId：这根柱子上立的是料堆里的哪一根新柱 */
  covers: Record<string, string>;
  /** 正拆着的那一根；没在拆就是 null */
  working: string | null;
  /** 正拆着的那一根干到几分了（0..1）—— 那圈进度环按它合拢 */
  workRatio: number;
  /** 手指按着没有：按住才往前走（画面据此画"用着力"） */
  holding: boolean;
  /** 换好了几根 / 一共几根 */
  rebuiltCount: number;
  total: number;
  /** 被清点看见过几次 —— 复盘用，也记进 mistakes */
  seen: number;
  /** 距离下一次清点还有多久（画面把这一刻度画出来） */
  nextCheckInMs: number;
  /** 刚清点完的那一刻（检查者正走一趟）；-1 = 还没清点过 */
  lastCheckAtMs: number;
  /** 刚被清点打断的那一根（红圈亮一下"这里被看见了"）；没被打断过就是 null */
  lastSeenPost: string | null;
  lastSeenAtMs: number;
  /** 刚换好的那一根 / 什么时候（新柱立起来的那一下按它演） */
  lastRebuiltPost: string | null;
  lastRebuiltAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 四根都换好了 */
  done: boolean;
}

export interface SwapBeamConfig {
  level: SwapBeamLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：大殿、一排承重柱、地上的料堆（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: SwapBeamLevel) => void;
  /** 每帧重画：每根柱子此刻是新的还是旧的、正拆着的那根干到几分了 */
  drawStage: (
    g: Phaser.GameObjects.Graphics,
    state: SwapBeamStageState,
    level: SwapBeamLevel,
  ) => void;
  /** 收尾：一排都是新柱之后的样子 */
  drawFinale?: (
    g: Phaser.GameObjects.Graphics,
    state: SwapBeamStageState,
    level: SwapBeamLevel,
  ) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 偷梁换柱：一排承重柱要换成新柱，外形一模一样。
 *
 * 三条刻意的设计：
 * - **判定全在 swap.logic 里**：按住多久算换好、清点什么时候来、清点把谁的进度清掉，
 *   单测与画面用的是同一份函数（连无头验证也走同一条 startWork / tickWork）。
 * - **零惩罚**：被清点抓个正着只是"这一根白干了"（进度清零、记一次 seen，也记进 mistakes），
 *   不结束、不锁操作；点空处、按住不足，也什么都不发生。孩子可以放心地按着重来。
 * - **提示给在点上**：小手从头到尾只指"该按住的那一根"（正拆着的那根优先）；
 *   换好一根、或者被清点打断，就再指一次 —— 绝不让孩子对着屏幕干瞪眼。
 */
function createBeamSwapScene(
  ctx: GameContext,
  cfg: SwapBeamConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SwapBeamScene extends BaseScene {
    private level: SwapBeamLevel = cfg.level;
    private state: SwapBeamState = beamStart(cfg.level);
    private startedAt = 0;
    /** 手指按着没有：按住才往前走（真实操作与无头验证都是这个开关） */
    private holding = false;
    /** 只认按住的那根手指：别的手指抬起不能算"松手"（多点触控） */
    private readonly gesture = createGestureGuard();
    private done = false;
    private misses = 0;
    private lastCheckAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.swap, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /**
     * 一帧的账：**先推、再清点**。
     * 顺序是刻意的 —— 恰好卡在同一帧干满 workMs 的那一根算换好了，清点从宽（零惩罚）。
     */
    private step(t: number, delta: number): void {
      if (this.done) return;
      const previous = this.state;
      let next = tickWork(this.level, previous, t, delta, this.holding);
      next = check(this.level, next, t);
      if (next === previous) return;
      this.state = next;

      // 清点来了：检查者走一趟（灯柱扫过去）。抓着谁只是个"被看见了"，不是惩罚
      if (checkCount(this.level, next) > checkCount(this.level, previous)) {
        this.lastCheckAt = t;
        this.idleMs = 0;
        if (next.seen > previous.seen) {
          // 被清点抓个正着：这一次换柱白干了 —— 记进 mistakes（不结束、不锁操作）
          recordAttempt(cfg.session, { ok: false });
          this.ctx.emit('beat:enter', { beatId: 'swap:seen:' + next.seen });
          if (!this.autoplay) {
            // 一声低音 + 轻微一晃 —— "被看出来了"的分量
            this.ctx.services.audio.tone(196, 260);
            this.cameras.main.shake(180, 0.006);
          }
        } else if (!this.autoplay) {
          this.sfx('tap');
        }
        if (!this.autoplay) this.time.delayedCall(SWAP_BEAM.sweepMs, () => this.pointAtNext());
      }

      // 换好了一根：新柱立起来（这一下就是"偷梁换柱"的落点）
      if (next.rebuilt.length > previous.rebuilt.length) {
        const postId = next.rebuilt[next.rebuilt.length - 1]!;
        const post = beamPostById(this.level, postId);
        this.idleMs = 0;
        this.ctx.emit('beat:enter', { beatId: 'swap:beam:' + postId });
        this.ctx.emit('choice:made', {
          beatId: 'swap:beam',
          choiceId: postId,
          correct: true,
          latencyMs: t,
        });
        recordAttempt(cfg.session, { ok: true });
        if (!this.autoplay && post !== undefined) {
          this.sfx('correct');
          sparkleAt(this, post.x, post.y - post.radius, THEME.gold, 6);
        }
        if (isBeamDone(this.level, this.state)) {
          this.finish();
          return;
        }
        if (!this.autoplay) {
          this.time.delayedCall(SWAP_BEAM.standMs, () => this.pointAtNext());
        }
      }
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(stage);
      if (this.done && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): SwapBeamStageState {
      return {
        elapsedMs: t,
        rebuilt: [...this.state.rebuilt],
        covers: { ...this.state.covers },
        working: workingPostId(this.state),
        workRatio: workRatio(this.level, this.state),
        holding: this.holding,
        rebuiltCount: rebuiltCount(this.state),
        total: this.level.posts.length,
        seen: beamSeenCount(this.state),
        nextCheckInMs: nextCheckInMs(this.level, this.state, t),
        lastCheckAtMs: this.lastCheckAt,
        lastSeenPost: this.state.lastSeenPost,
        lastSeenAtMs: this.state.lastSeenAtMs,
        lastRebuiltPost: this.state.lastRebuiltPost,
        lastRebuiltAtMs: this.state.lastRebuiltAtMs,
        misses: this.misses,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：清点的灯柱、正拆着那一根的进度环、
     * 被看见时那圈红、刚换好那一根的金光 —— 都是"刚才那一下发生了什么"，不额外写字。
     */
    private drawMarks(stage: SwapBeamStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const t = stage.elapsedMs;

      // 清点：检查者从左边走一趟，灯柱扫过一整排柱子
      const sinceCheck = t - stage.lastCheckAtMs;
      if (stage.lastCheckAtMs >= 0 && sinceCheck >= 0 && sinceCheck <= SWAP_BEAM.sweepMs) {
        const p = sinceCheck / SWAP_BEAM.sweepMs;
        const width = this.W + SWAP_BEAM.beamWidth * 2;
        const x = -SWAP_BEAM.beamWidth + width * p;
        const top =
          Math.min(...this.level.posts.map((post) => post.y)) - SWAP_BEAM.beamPadTop;
        const bottom =
          Math.max(...this.level.posts.map((post) => post.y)) + SWAP_BEAM.beamPadBottom;
        g.fillStyle(THEME.gold, 0.14);
        g.fillRect(x - SWAP_BEAM.beamWidth / 2, top, SWAP_BEAM.beamWidth, bottom - top);
        g.fillStyle(THEME.gold, 0.28);
        g.fillRect(x - 3, top, 6, bottom - top);
      }

      // 正拆着的那一根：一圈跟着进度合拢的环（按着才往前走，松手就停）
      const working = this.level.posts.find((post) => post.id === stage.working);
      if (working !== undefined && !stage.done) {
        const r = working.radius + SWAP_BEAM.ringPad;
        g.lineStyle(6, THEME.inkSoft, 0.28);
        g.strokeCircle(working.x, working.y, r);
        if (stage.workRatio > 0) {
          g.lineStyle(11, stage.holding ? THEME.teal : THEME.inkSoft, 0.92);
          g.beginPath();
          g.arc(
            working.x,
            working.y,
            r,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * stage.workRatio,
          );
          g.strokePath();
        }
      }

      // 被清点抓着的那一根：红圈亮一下（"这里被看见了"，不是惩罚）
      const seen = this.level.posts.find((post) => post.id === stage.lastSeenPost);
      const sinceSeen = t - stage.lastSeenAtMs;
      if (seen !== undefined && sinceSeen >= 0 && sinceSeen <= SWAP_BEAM.sweepMs) {
        const p = sinceSeen / SWAP_BEAM.sweepMs;
        g.lineStyle(9, THEME.red, 0.9 * (1 - p));
        g.strokeCircle(seen.x, seen.y, seen.radius + SWAP_BEAM.ringPad + 40 * p);
      }

      // 刚换好的那一根：金光往外扩一圈，再慢慢收住
      const fresh = this.level.posts.find((post) => post.id === stage.lastRebuiltPost);
      const sinceRebuilt = t - stage.lastRebuiltAtMs;
      if (fresh !== undefined && sinceRebuilt >= 0 && sinceRebuilt <= SWAP_BEAM.standMs) {
        const p = sinceRebuilt / SWAP_BEAM.standMs;
        g.lineStyle(10, THEME.gold, 0.9 * (1 - p));
        g.strokeCircle(fresh.x, fresh.y, fresh.radius + 14 + 54 * p);
      }
    }

    // ---------------- 点 ----------------

    /** 手指落下去：落在一根还没换好的柱子上就按住不放（按住才往前走） */
    private onPress(x: number, y: number): void {
      if (this.done) return;
      this.idleMs = 0;
      const post = beamPostAt(this.level, x, y, SWAP_BEAM.tapForgive);
      if (post === undefined || isPostRebuilt(this.state, post.id)) {
        this.nothing(x, y);
        return;
      }
      this.holding = true;
      const before = this.state;
      this.state = startWork(this.state, post.id, this.now());
      if (this.state === before) return; // 正拆着的就是这一根：接着干，不重复表演
      this.hideHand();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'swap:work:' + post.id });
      this.pointAtNext();
    }

    /** 手指抬起来：这一根就停在原地（进度留着，再按住接着干）—— 零惩罚 */
    private onRelease(): void {
      this.holding = false;
      if (this.done) return;
      this.ctx.emit('beat:enter', { beatId: 'swap:release' });
    }

    /** 点了空处 / 点了已经换好的柱子：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'swap:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done || !isBeamDone(this.level, this.state)) return;
      this.done = true;
      this.holding = false;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SWAP_BEAM.finaleHoldMs,
        reveal: ending.reveal,
        revealY: SWAP_BEAM.hintY,
        finalize: () => {
          const first = this.level.posts[0];
          sparkleAt(this, this.W / 2, first === undefined ? this.H / 2 : first.y, THEME.gold, 12);
          this.ctx.emit('beat:enter', { beatId: 'swap:done' });
          this.ctx.emit('choice:made', {
            beatId: 'swap:leave',
            choiceId: 'beam',
            correct: true,
            latencyMs: this.now(),
          });
        }
      });
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手放到"该按住的那一根"上：正拆着的那一根优先，否则是下一根没换好的 */
    private pointAtNext(): void {
      if (this.done) return;
      const post = nextPostToWork(this.level, this.state);
      if (post === undefined) {
        this.clearRing();
        this.hideHand();
        return;
      }
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(post.x, post.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, post.radius + SWAP_BEAM.ringPad);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.14,
        alpha: 0.4,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hideHand();
      this.hand = createHand(this, post.x, post.y + post.radius + SWAP_BEAM.handDrop, 1.1);
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

    private ripple(x: number, y: number, radius: number, color: number): void {
      const g = tapRipple(this, x, y, radius, color);
      this.time.delayedCall(SWAP_BEAM.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：走的还是**真实操作同一条路** ——
     * 隔一会儿看一次"该按哪一根"，然后**把手指按在那根柱子上不放**（走 onPress 的判定），
     * 由每一帧的 tickWork 把它推完；推完再挪到下一根，最后进 reward。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: SWAP_BEAM.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      const post = nextPostToWork(this.level, this.state);
      if (post === undefined) return;
      // 正按着这一根：让帧去推，别重复按（真实的孩子也是按着不放）
      if (workingPostId(this.state) === post.id && this.holding) return;
      this.onPress(post.x, post.y);
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const t = this.now();
      this.step(t, delta);
      this.redraw(t);
      if (this.done) return;
      // 卡住了：把关卡自己的那句话再亮一遍，并指一指该按住的那一根
      this.idleMs += delta;
      if (this.idleMs >= SWAP_BEAM.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, SWAP_BEAM.hintY);
        this.pointAtNext();
      }
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.swap });
      this.level = cfg.level;
      this.state = beamStart(this.level);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!this.gesture.begin(pointer)) return;
        this.onPress(pointer.x, pointer.y);
      });
      const release = (pointer: Phaser.Input.Pointer): void => {
        if (!this.gesture.isActive(pointer)) return;
        this.gesture.end(pointer);
        this.onRelease();
      };
      this.input.on('pointerup', release);
      // 手指滑出画面也算松手：进度不会因为一次意外一直攒着
      this.input.on('pointerupoutside', release);
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 3000, SWAP_BEAM.hintY);
        this.time.delayedCall(SWAP_BEAM.introHandMs, () => this.pointAtNext());
      }
    }
  };
}

/**
 * 进度槽：换好了几根柱子（0..total）—— 与 shell 那条同一个位置、同一个样式。
 */
export function beamProgressBar(
  g: Phaser.GameObjects.Graphics,
  level: SwapBeamLevel,
  rebuilt: number,
): void {
  const { x, y, w, h } = SWAP_BEAM.progress;
  g.fillStyle(THEME.card, 0.94);
  g.fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x, y, w, h, h / 2);
  const inner = w - 12;
  const fill = (inner * Math.min(rebuilt, level.posts.length)) / Math.max(1, level.posts.length);
  if (fill > 6) {
    g.fillStyle(THEME.gold, 1);
    g.fillRoundedRect(x + 6, y + 6, fill, h - 12, (h - 12) / 2);
  }
}

/**
 * 替换：两种玩法共用一个场景键（SCENE_KEYS.swap），按 level.mode 分派。
 * - shell（金蝉脱壳）：把一排"还站在那儿的人"换成同 kind 的替身，检查者抬头会戳穿 —— 既有路径，一行未改；
 * - beam（偷梁换柱）：按住干满 workMs 才换好一根，检查者每隔 checkMs 清点一次（被清点只是白干一根）。
 */
// 两个重载 + 一个并集的实现：老模式的调用处（传的是内联箭头函数）由第一个重载
// 做上下文类型推导，不用担心并集让回调参数变成 any —— 既有游戏包一行都不用改。
export function createSwapScene(
  ctx: GameContext,
  cfg: SwapConfig,
): Phaser.Types.Scenes.SceneType;
export function createSwapScene(
  ctx: GameContext,
  cfg: SwapBeamConfig,
): Phaser.Types.Scenes.SceneType;
export function createSwapScene(
  ctx: GameContext,
  cfg: SwapConfig | SwapBeamConfig,
): Phaser.Types.Scenes.SceneType {
  if (cfg.level.mode === 'beam') return createBeamSwapScene(ctx, cfg as SwapBeamConfig);
  return createShellSwapScene(ctx, cfg as SwapConfig);
}
