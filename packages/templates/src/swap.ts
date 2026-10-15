import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt, tapRipple } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  SWAP_TIMING, caughtPosts, gateHit, isAllSwapped, isPostSwapped, isShellDone, leave, nextPeekInMs,
  nextPostToSwap, nextSwapStep, peek, placeSpare, postAt, seenCount, spareAt, spareById,
  spareStandingAt, swapCount, swapStart,
} from './swap.logic';
import type { SwapState } from './swap.logic';
import type { SwapLevel, SwapPost, SwapSpare } from './schemas';
import type { SessionState } from './session';

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
  /** 被看见了几次 —— 复盘用，不扣星 */
  seen: number;
  /** 距离下一次抬头还有多久（画面把这一刻度画出来） */
  nextPeekInMs: number;
  /** 刚抬头（灯正在扫）的时刻；-1 = 没在扫 */
  lastPeekAtMs: number;
  /** 刚放上去的那个位置 / 什么时候放的（落位的动画按它演） */
  lastPlacePost: string | null;
  lastPlaceAtMs: number;
  /** 上一次"样子不对"发生在什么时候（晃一下，不扣星） */
  lastWrongAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 已经脱壳走掉了 */
  done: boolean;
}

export interface SwapConfig {
  level: SwapLevel;
  session: SessionState;
  nextSceneKey: string;
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
 * - **零惩罚**：样子不对只是放不上去（原样返回，红圈晃一下）；
 *   被检查者看见也**不结束、不扣星** —— 只是那个位置要重新换。
 *   孩子可以放心地一个一个试过去。
 * - **提示给在点上**：小手只在两步之间指路 —— 空着手就指"该拿哪一个替身"，
 *   手上有替身就指"该放到哪一个位置"；全换好了就指院门。
 */
export function createSwapScene(ctx: GameContext, cfg: SwapConfig): Phaser.Types.Scenes.SceneType {
  return class SwapScene extends BaseScene {
    private level: SwapLevel = cfg.level;
    private state: SwapState = swapStart(cfg.level);
    private startedAt = 0;
    private done = false;
    private idleMs = 0;
    private misses = 0;
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
        this.pointerAt = { x: pointer.x, y: pointer.y };
        if (this.carrying !== null) this.carryingAt = this.pointerAt;
      });
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onRelease(pointer));
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

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

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

      // 样子不对：灰圈晃一下（只提示，不扣星）—— 圈在手上那个替身那儿
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

    /** 把手上的替身放到位置上：**样子不对就放不上去**（原样返回，零惩罚） */
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
        // 样子不对：原样返回，只晃一下 —— 零惩罚，替身还在手上，换一个位置再试就是
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
      cfg.session.total += 1;
      cfg.session.correct += 1;
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
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.exit.x, this.level.exit.y, THEME.gold, 12);
      this.ctx.emit('beat:enter', { beatId: 'swap:done' });
      this.ctx.emit('choice:made', {
        beatId: 'swap:leave',
        choiceId: 'shell',
        correct: true,
        latencyMs: this.now(),
      });
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, SWAP.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? SWAP.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
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
