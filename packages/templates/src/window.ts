import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt, tapRipple } from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  MURK_MAX, WINDOW_WARN_MS, closeWindow, currentJob, cycleIndexAt, effectiveCycle, isJobDone,
  isMuddy, isTravelOver, isWindowDone, jobAt, jobProgress, muddyLeftMs, murkAt, nextJob, phaseAt,
  phaseProgress, phaseRemainingMs, restartTravel, stirAt, stirStart, tapAt, tapJob, travelLeftMs,
  windowStart,
} from './window.logic';
import type { StirWindowLevel, WindowPhase, WindowState } from './window.logic';

/**
 * stir 模式的关卡类型从逻辑层原样再导出一份：游戏包要用它给 `windowLevel()` 收窄返回类型
 * （schema 里 stir 是可选的，这里在类型上写死"一定有 stir"）。
 */
export type { StirWindowLevel };
import type { WindowJob, WindowLevel } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

/** 模板常量放在模板自己文件里（坐标在关卡数据里，这里只放手感） */
export const WINDOW = {
  /** 窗口打开前的征兆时长 —— 巡逻的灯刚转过去 */
  warnMs: WINDOW_WARN_MS,
  /** 活儿的命中宽容度：手指粗也能点得到 */
  tapForgive: 44,
  /** 停手这么久就把小手放到还没干完的活儿上 */
  handDelayMs: 1200,
  /** 无头验证：把"稳 / 乱"的周期压成几分之一 */
  autoplayFactor: 3,
  /** 无头验证：窗口里连点多快 */
  autoplayTapMs: 55,
  /** 多久没动静就把提示说出来 */
  idleMs: 8000,
  /** 干完活儿之后看一眼水寨再走 */
  finaleHoldMs: 4200,
  /** glimpse：一趟走完了，站住喘口气再走一遍（零惩罚） */
  tripHoldMs: 1600,
  /** glimpse：无头验证时喘气的时长 */
  autoplayTripHoldMs: 240,
  /** 提示气泡的高度 */
  hintY: 268,

  /* ---------- stir（混水摸鱼）：窗口是自己搅出来的 ---------- */
  /** 停手这么久之后（水清了就指水面，浑着就指还没摸到的鱼）把小手放过去 */
  stirIdleMs: 8000,
  /** 搅水的那圈涟漪亮多久 */
  rippleMs: 760,
  /** 搅浑之后"浑了，快抓"在气泡里停多久 */
  stirHoldMs: 1600,
} as const;

/** 交给游戏画的一切：夜里的水寨、火光、跑远的巡逻灯、每件活儿的进度 */
export interface WindowStageState {
  phase: WindowPhase;
  /** 第几个周期（0 起） */
  round: number;
  /** 这一段（稳 / 征兆 / 窗口）已经过去多少（0..1） */
  progress: number;
  /** 这一段还剩多久 */
  remainingMs: number;
  /** 每件活儿干了多少（0..1；干完的是 1） */
  work: Record<string, number>;
  /** 已经干完的活儿 */
  done: string[];
  /** 窗口关上白跑了几个半截（零惩罚，只用来复盘） */
  resets: number;
  /** 此刻能不能干活 */
  canWork: boolean;
  elapsedMs: number;
  finished: boolean;
  /** glimpse：这一轮路过的那件机会（fire 恒为 null —— 活儿都在，没有"只有这一件"） */
  activeJobId: string | null;
  /** glimpse：这一趟还剩多久；fire 恒为 0 */
  travelLeftMs: number;
  /** glimpse：这一趟走了多少（0..1）；fire 恒为 0 */
  travelProgress: number;
  /** glimpse：这一趟走完了 —— 没抓够就重走一遍（零惩罚） */
  travelOver: boolean;
  /** glimpse：这是第几趟（从 1 开始）；fire 恒为 1 */
  trip: number;
  /** glimpse：正在换趟（画面把队伍摆回起点、路程条归零） */
  restarting: boolean;
}

export interface WindowConfig {
  level: WindowLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就把整屏交给 drawWorld */
  title?: string;
  drawWorld: (g: Phaser.GameObjects.Graphics, state: WindowStageState) => void;
  /** 点活儿时的表现（船晃一下、火光跳一下） */
  onTapJob?: (job: WindowJob, api: { scene: Phaser.Scene; progress: number }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: WindowStageState) => void;
  /** 全部干完之后念的那句话 */
  reveal?: string;
  finaleHoldMs?: number;
  /** glimpse：一趟走完、要重走一遍时说的话（不传就用 level.hint） */
  tripLine?: string;
  /** glimpse：换趟时站住喘口气的时长 */
  tripHoldMs?: number;
}

/** stir（混水摸鱼）那一屏的画面状态：窗口的通用字段 + 这一塘水的水况 */
export interface StirStageState extends WindowStageState {
  /** 此刻水有多浑（0..100） */
  murk: number;
  /** 浑到 muddyAt 以上 —— 此刻才抓得动鱼 */
  muddy: boolean;
  /** 这么浑还能撑多久（水清了就是 0）—— 画面"水快清了"的钟按它画 */
  muddyLeftMs: number;
  /** 搅了几下水（复盘用，不是惩罚） */
  stirs: number;
  /** 水面的搅浑点（关卡数据里的那一圈） */
  stir: { x: number; y: number; radius: number };
}

/**
 * stir（混水摸鱼）这一路的配置。与 fire / glimpse 的 `WindowConfig` 是两份 ——
 * 老字段一个字没动，多出来的这些只有 stir 用得上。
 */
export interface WindowStirConfig {
  level: StirWindowLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就把整屏交给 drawWorld */
  title?: string;
  /** 整屏画面：水塘、水色、浑度、鱼都按 state 画 */
  drawWorld: (g: Phaser.GameObjects.Graphics, state: StirStageState) => void;
  /** 点鱼时的表现（鱼尾一摆） */
  onTapJob?: (job: WindowJob, api: { scene: Phaser.Scene; progress: number }) => void;
  /** 搅水时的表现（水花） */
  onStir?: (api: { scene: Phaser.Scene; murk: number }) => void;
  /** 水搅浑了、可以抓了的那一句（不传就用 level.hint） */
  muddyLine?: string;
  /** 水太清了、鱼摆尾滑走了的那一句（不传就用 level.hint） */
  slipLine?: string;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: StirStageState) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 时机窗口：活儿谁都会干，难的是等对时候。
 *
 * 三条刻意的设计：
 * - **判定全在 window.logic 里**：场景只把墙钟喂给 `phaseAt` / `tapJob`，
 *   单测与画面用的是同一份判定。
 * - **零惩罚**：稳的时候点活儿什么也不发生；窗口关上，没干完的进度清零，下个窗口接着干 ——
 *   干完的活儿不会被抹掉。
 * - **提示给在对的时候**：窗口开了才让小手落在还没干完的活儿上（稳的时候不引诱孩子去点）。
 *
 * glimpse（顺手牵羊）在同一个场景里加一条：**这一轮只有一件机会路过**。
 * 别处的、上一轮 / 下一轮的都点不动，但点了会记进 mistakes（只当白跑一趟）；
 * 这一趟（travelMs）走完还没抓够，就把队伍带回起点重走一遍 —— 抓到的留着，不扣星。
 *
 * 下面这一段是 **fire / glimpse 那条路（一行没改）**，只是从 createWindowScene 里
 * 挪成了一个具名函数；stir 那一半在文件末尾另起一段，由 mode 分派。
 */
function createTimedWindowScene(
  ctx: GameContext,
  cfg: WindowConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class WindowScene extends BaseScene {
    private level: WindowLevel = cfg.level;
    private state: WindowState = windowStart();
    private startedAt = 0;
    private finished = false;
    private lastPhase: WindowPhase | null = null;
    private lastRound = -1;
    /** glimpse：这一趟是第几趟（从 1 开始） */
    private trip = 1;
    /** glimpse：正在换趟（这一趟走完了，画面把队伍摆回起点） */
    private restarting = false;
    private lastTapAt = Number.NEGATIVE_INFINITY;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.window, ctx);
    }


    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /**
     * 一趟走完还没抓够：把这一趟的账结掉，站住喘口气，再走一遍（**零惩罚**）。
     * 抓到的机会留着 —— 顺手牵到的羊不会跑掉。
     */
    private restartTrip(): void {
      if (this.restarting) return;
      this.restarting = true;
      this.hideHand();
      this.state = restartTravel(this.state, this.level);
      this.ctx.emit('beat:enter', { beatId: 'window:trip:' + this.trip });
      const hold = cfg.tripHoldMs ?? WINDOW.tripHoldMs;
      this.showHint(
        cfg.tripLine ?? cfg.level.hint,
        this.autoplay ? WINDOW.autoplayTripHoldMs : hold,
        WINDOW.hintY,
      );
      this.time.delayedCall(this.autoplay ? WINDOW.autoplayTripHoldMs : hold, () => {
        if (this.finished) return;
        this.trip += 1;
        this.restarting = false;
        this.startedAt = this.ctx.services.now();
        this.lastPhase = null;
        this.lastRound = -1;
        this.idleMs = 0;
        this.ctx.emit('beat:enter', { beatId: 'window:restart' });
      });
    }

    /** 稳 → 征兆 → 窗口的每一次翻页：发事件、出声、关窗时清零 */
    private syncPhase(elapsed: number): void {
      const phase = phaseAt(this.level, elapsed, WINDOW.warnMs);
      const round = cycleIndexAt(this.level, elapsed);
      if (phase === this.lastPhase && round === this.lastRound) return;

      const prevPhase = this.lastPhase;
      const prevRound = this.lastRound;
      this.lastPhase = phase;
      this.lastRound = round;

      // 窗口关上：没干完的活儿进度清零（零惩罚）
      if (prevPhase === 'window') this.onWindowClosed(prevRound);

      if (phase === 'warn' && prevPhase !== 'warn') {
        // 巡逻的灯刚转过去 —— 征兆，不是机会
        this.ctx.services.audio.tone(420, 120);
        this.ctx.emit('beat:enter', { beatId: 'window:warn:' + (round + 1) });
        return;
      }
      if (phase === 'window' && (prevPhase !== 'window' || prevRound !== round)) {
        this.ctx.services.audio.tone(660, 150);
        this.ctx.emit('beat:enter', { beatId: 'window:open:' + (round + 1) });
        // glimpse：这一轮路过的是哪一件（复盘与自检用；fire 没有"只有这一件"）
        const passing = currentJob(this.level, elapsed);
        if (passing) this.ctx.emit('beat:enter', { beatId: 'window:glimpse:' + passing.id });
      }
    }

    private onWindowClosed(round: number): void {
      const before = this.state.resets;
      this.state = closeWindow(this.state, this.level);
      this.ctx.emit('beat:enter', { beatId: 'window:close:' + (round + 1) });
      if (this.state.resets <= before) return;
      this.ctx.emit('beat:enter', { beatId: 'window:reset:' + (round + 1) });
      this.showHint(cfg.level.hint, 2200, WINDOW.hintY);
    }

    /** 提示与小手：窗口里才把小手放到**此刻点得动**的那件上 */
    private watch(elapsed: number, delta: number): void {
      const phase = phaseAt(this.level, elapsed, WINDOW.warnMs);
      // fire：还没干完的第一件；glimpse：这一轮路过的那一件（已经抓到的就不再引孩子去点）
      const job: WindowJob | null =
        this.level.mode === 'glimpse' ? this.grabAt(elapsed) : nextJob(this.level, this.state) ?? null;
      if (
        phase === 'window' &&
        job !== null &&
        !this.autoplay &&
        elapsed - this.lastTapAt >= WINDOW.handDelayMs
      ) {
        this.showHand(job);
      } else if (phase !== 'window' || job === null) {
        this.hideHand();
      }

      this.idleMs += delta;
      if (this.idleMs < WINDOW.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint, 2600, WINDOW.hintY);
    }

    private redraw(elapsed: number): void {
      const g = this.worldGfx;
      if (!g) return;
      g.clear();
      cfg.drawWorld(g, this.stageState(elapsed));
    }

    private stageState(elapsed: number): WindowStageState {
      const phase = phaseAt(this.level, elapsed, WINDOW.warnMs);
      const work: Record<string, number> = {};
      for (const job of this.level.jobs) {
        work[job.id] = jobProgress(this.state, this.level, job.id);
      }
      const passing = this.level.mode === 'glimpse' ? currentJob(this.level, elapsed) : undefined;
      const travel = this.level.travelMs;
      return {
        phase,
        round: cycleIndexAt(this.level, elapsed),
        progress: phaseProgress(this.level, elapsed, WINDOW.warnMs),
        remainingMs: phaseRemainingMs(this.level, elapsed, WINDOW.warnMs),
        work,
        done: [...this.state.done],
        resets: this.state.resets,
        canWork:
          phase === 'window' &&
          !this.finished &&
          !this.restarting &&
          (this.level.mode !== 'glimpse' || this.grabAt(elapsed) !== null),
        elapsedMs: elapsed,
        finished: this.finished,
        activeJobId: passing?.id ?? null,
        travelLeftMs: travelLeftMs(this.level, elapsed),
        travelProgress:
          travel === undefined || travel <= 0 ? 0 : Math.min(1, Math.max(0, elapsed / travel)),
        travelOver: isTravelOver(this.level, elapsed),
        trip: this.trip,
        restarting: this.restarting,
      };
    }

    // ---------------- 点活儿 ----------------

    /**
     * 此刻抓得住的那件机会（glimpse）：这一轮路过的那件，而且还没抓到。
     * fire 没有这个概念，恒为 null。
     */
    private grabAt(elapsed: number): WindowJob | null {
      if (this.level.mode !== 'glimpse' || isTravelOver(this.level, elapsed)) return null;
      const job = currentJob(this.level, elapsed);
      return job !== undefined && !isJobDone(this.state, job.id) ? job : null;
    }

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.restarting) return;
      const job = jobAt(pointer.x, pointer.y, this.level, WINDOW.tapForgive);
      if (!job) return;
      this.idleMs = 0;
      const elapsed = this.elapsed();

      // glimpse：只有这一轮路过的那件抓得住 —— 点到别处（上一轮 / 下一轮的机会）什么也不发生；
      // 但这是孩子主动点错了目标，记一次 mistakes（不结束、不锁操作）
      if (this.level.mode === 'glimpse' && currentJob(this.level, elapsed)?.id !== job.id) {
        recordAttempt(cfg.session, { ok: false });
        this.ctx.emit('beat:enter', { beatId: 'window:missed:' + job.id });
        this.sfx('tap');
        this.showHint(cfg.level.hint, 2200, WINDOW.hintY);
        return;
      }

      if (phaseAt(this.level, elapsed, WINDOW.warnMs) !== 'window') {
        // 稳的时候靠近会被赶回来：点它什么也不发生（零惩罚，只是白跑一趟）
        this.ctx.emit('beat:enter', { beatId: 'window:blocked:' + job.id });
        this.sfx('tap');
        this.showHint(cfg.level.hint, 2200, WINDOW.hintY);
        return;
      }
      this.tapJob(job);
    }

    /** 点一下活儿（真实操作与无头验证走的是同一条路） */
    private tapJob(job: WindowJob): void {
      if (this.finished) return;
      this.lastTapAt = this.elapsed();
      this.idleMs = 0;
      // 孩子正在点的时候，小手先让开（停手超过 handDelayMs 才会再出现）
      this.hideHand();

      if (isJobDone(this.state, job.id)) {
        // 干完的活儿再点也不会变
        this.sfx('tap');
        return;
      }

      const before = jobProgress(this.state, this.level, job.id);
      this.state = tapJob(this.state, this.level, job.id);
      const after = jobProgress(this.state, this.level, job.id);
      cfg.onTapJob?.(job, { scene: this, progress: after });
      if (after <= before) return;

      if (after < 1) {
        this.sfx('tap');
        this.ctx.services.audio.tone(320 + after * 260, 60);
        return;
      }

      // 干完一件
      this.hideHand();
      this.sfx('correct');
      sparkleAt(this, job.x, job.y - 40, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'window:job:' + job.id });
      recordAttempt(cfg.session, { ok: true });
      if (isWindowDone(this.level, this.state)) this.finish();
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? WINDOW.finaleHoldMs,
        sparkle: { x: this.W / 2, y: 720, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealDelayMs: 1400,
        revealY: WINDOW.hintY,
        finalize: () => {
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.stageState(this.elapsed()));
        }
      });
    }

    // ---------------- 小手 ----------------

    private showHand(job: WindowJob): void {
      if (this.hand) return;
      this.hand = createHand(this, job.x, job.y - job.radius - 40, 1.1);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：窗口一开就对着**此刻点得动**的那件连点，用的还是同一条 tapJob() 路径。
     * （glimpse 下"点得动的"就是这一轮路过的那一件；一趟走完会被场景带回起点重走。）
     * 连点比人快得多（55ms 一下），所以压缩过的窗口也够把一件活儿干完。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: WINDOW.autoplayTapMs,
        loop: true,
        callback: () => {
          if (this.finished || this.restarting) return;
          const elapsed = this.elapsed();
          if (phaseAt(this.level, elapsed, WINDOW.warnMs) !== 'window') return;
          const job: WindowJob | null =
            this.level.mode === 'glimpse' ? this.grabAt(elapsed) : nextJob(this.level, this.state) ?? null;
          if (job) this.tapJob(job);
        },
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished && !this.restarting) {
        // glimpse：这一趟走完了 —— 没抓够就重走一遍（零惩罚，fire 永远不会走到这里）
        if (isTravelOver(this.level, elapsed)) this.restartTrip();
        else {
          this.syncPhase(elapsed);
          this.watch(elapsed, delta);
        }
      }
      this.redraw(elapsed);
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.window });
      this.level = effectiveCycle(cfg.level, this.autoplay, WINDOW.autoplayFactor);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title);
      this.worldGfx = this.add.graphics().setDepth(2);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 3000, WINDOW.hintY);
    }
  };
}

/* ---------------- stir（混水摸鱼）：窗口是自己搅出来的 ---------------- */

/**
 * 混水摸鱼：**窗口是自己搅出来的**。
 *
 * 与 fire / glimpse 的区别只有一条，但它就是这一计的全部：水本来是清的 ——
 * 点水面把水搅浑（浑度涨，封顶 100），只有浑水里鱼才慢下来、才摸得到；
 * 不搅就一直清，一直抓不到。浑度按 clearPerSec 澄清，水一清，
 * 摸到一半的那条鱼就摆尾滑走 —— **只是重来**：记进 mistakes、不结束，搅一下就能接着摸。
 */
function createStirWindowScene(
  ctx: GameContext,
  cfg: WindowStirConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class StirWindowScene extends BaseScene {
    private level: StirWindowLevel = cfg.level;
    private state: WindowState = stirStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    /** 上一帧水是浑的吗 —— 由浑转清的那一瞬要结一次账 */
    private wasMuddy = false;
    /** 水清了几回（第几塘水）—— 只是复盘与事件名用，不是惩罚 */
    private clears = 0;
    private lastTapAt = Number.NEGATIVE_INFINITY;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.window, ctx);
    }


    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /** 水清了：没摸完的清零、摸到的留着（零惩罚），只记一笔"白跑一趟"用来复盘 */
    private waterCleared(): void {
      const before = this.state.resets;
      this.state = closeWindow(this.state, this.level);
      this.clears += 1;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'window:clear:' + this.clears });
      if (this.state.resets <= before) return;
      this.ctx.emit('beat:enter', { beatId: 'window:slipped:' + this.clears });
      this.showHint(cfg.slipLine ?? this.level.hint, 2200, WINDOW.hintY);
    }

    private redraw(elapsed: number): void {
      const g = this.worldGfx;
      if (!g) return;
      g.clear();
      cfg.drawWorld(g, this.stageState(elapsed));
    }

    private stageState(elapsed: number): StirStageState {
      const work: Record<string, number> = {};
      for (const job of this.level.jobs) {
        work[job.id] = jobProgress(this.state, this.level, job.id);
      }
      const stir = this.level.stir;
      const muddy = isMuddy(this.level, this.state, elapsed);
      const murk = murkAt(this.state, elapsed);
      const leftMs = muddyLeftMs(this.level, this.state, elapsed);
      return {
        // 窗口的通用字段：stir 里"窗口"就是那一塘浑水 —— 浑着就是窗口开着
        phase: muddy ? 'window' : 'calm',
        round: this.clears,
        progress: murk / MURK_MAX,
        remainingMs: leftMs,
        work,
        done: [...this.state.done],
        resets: this.state.resets,
        canWork: muddy && !this.finished,
        elapsedMs: elapsed,
        finished: this.finished,
        activeJobId: null,
        travelLeftMs: 0,
        travelProgress: 0,
        travelOver: false,
        trip: 1,
        restarting: false,
        murk,
        muddy,
        muddyLeftMs: leftMs,
        stirs: this.state.stir?.stirs ?? 0,
        stir: { x: stir.x, y: stir.y, radius: stir.radius },
      };
    }

    // ---------------- 点 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      this.idleMs = 0;
      const elapsed = this.elapsed();
      const stir = this.level.stir;
      // 水面优先：搅水的那一圈压在鱼上面 —— 点到它就是在搅水（别把竹竿当成鱼）
      if (Math.hypot(pointer.x - stir.x, pointer.y - stir.y) <= stir.radius + WINDOW.tapForgive) {
        this.stirWater(elapsed);
        return;
      }
      const job = jobAt(pointer.x, pointer.y, this.level, WINDOW.tapForgive);
      if (!job) {
        // 点在空水面上：什么也没碰到 —— 零惩罚，只是白点一下
        this.miss(pointer.x, pointer.y);
        return;
      }
      if (!isMuddy(this.level, this.state, elapsed)) {
        this.slipAway(job, elapsed);
        return;
      }
      this.tapFish(job, elapsed);
    }

    /** 搅水（真实操作与无头验证走的是同一条路） */
    private stirWater(t: number): void {
      if (this.finished) return;
      const before = this.state;
      this.state = stirAt(this.level, this.state, t);
      if (this.state === before) return;
      const stir = this.level.stir;
      this.lastTapAt = t;
      this.idleMs = 0;
      this.hideHand();
      this.sfx('splash');
      const ripple = tapRipple(this, stir.x, stir.y, stir.radius, THEME.water);
      this.time.delayedCall(WINDOW.rippleMs, () => ripple.destroy());
      this.ctx.emit('beat:enter', { beatId: 'window:stir:' + (this.state.stir?.stirs ?? 0) });
      cfg.onStir?.({ scene: this, murk: murkAt(this.state, t) });
      if (!isMuddy(this.level, this.state, t)) return;
      // 浑了：这一塘水的窗口开了
      this.wasMuddy = true;
      this.ctx.emit('beat:enter', { beatId: 'window:muddy:' + this.clears });
      this.showHint(cfg.muddyLine ?? this.level.hint, WINDOW.stirHoldMs, WINDOW.hintY);
      this.pointAtNext();
    }

    /** 浑水里摸鱼（真实操作与无头验证走的是同一条路） */
    private tapFish(job: WindowJob, t: number): void {
      if (this.finished) return;
      this.lastTapAt = t;
      this.idleMs = 0;
      this.hideHand();
      if (isJobDone(this.state, job.id)) {
        // 摸到的鱼再点也不会变
        this.sfx('tap');
        return;
      }

      const before = jobProgress(this.state, this.level, job.id);
      // 与单测同一条判定：水浑了才推得动（tapAt 里的 stir 分支）
      this.state = tapAt(this.state, this.level, job.id, t);
      const after = jobProgress(this.state, this.level, job.id);
      cfg.onTapJob?.(job, { scene: this, progress: after });
      if (after <= before) return;

      if (after < 1) {
        this.sfx('tap');
        this.ctx.services.audio.tone(320 + after * 260, 60);
        return;
      }

      // 摸到一条
      this.hideHand();
      this.sfx('correct');
      sparkleAt(this, job.x, job.y - 40, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'window:fish:' + job.id });
      recordAttempt(cfg.session, { ok: true });
      if (isWindowDone(this.level, this.state)) this.finish();
    }

    /** 水清了：点到鱼也抓不动 —— 它摆尾滑走了（不结束、不锁操作；这一下记进 mistakes，搅一下再来） */
    private slipAway(job: WindowJob, t: number): void {
      if (this.finished) return;
      recordAttempt(cfg.session, { ok: false });
      this.lastTapAt = t;
      this.sfx('tap');
      const ripple = tapRipple(this, job.x, job.y, job.radius, THEME.inkSoft);
      this.time.delayedCall(WINDOW.rippleMs, () => ripple.destroy());
      this.ctx.emit('beat:enter', { beatId: 'window:slip:' + job.id });
      this.showHint(cfg.slipLine ?? this.level.hint, 2200, WINDOW.hintY);
      this.pointAtNext();
    }

    /** 点在空水面上：什么也没碰到（零惩罚） */
    private miss(x: number, y: number): void {
      if (this.finished) return;
      this.lastTapAt = this.elapsed();
      this.sfx('tap');
      const ripple = tapRipple(this, x, y, 44, THEME.inkSoft);
      this.time.delayedCall(WINDOW.rippleMs, () => ripple.destroy());
      this.ctx.emit('beat:enter', { beatId: 'window:miss' });
      this.showHint(cfg.level.hint, 2200, WINDOW.hintY);
      this.pointAtNext();
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? WINDOW.finaleHoldMs,
        sparkle: { x: this.W / 2, y: 720, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealDelayMs: 1400,
        revealY: WINDOW.hintY,
        finalize: () => {
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.stageState(this.elapsed()));
        }
      });
    }

    // ---------------- 小手 ----------------

    /** 把小手放到此刻该动的地方：水清了就指水面，浑着就指还没摸到的鱼 */
    private pointAtNext(): void {
      if (this.finished || this.autoplay) return;
      const elapsed = this.elapsed();
      if (!isMuddy(this.level, this.state, elapsed)) {
        const stir = this.level.stir;
        this.showHandAt(stir.x, stir.y - stir.radius - 30);
        return;
      }
      const job = nextJob(this.level, this.state);
      if (job) this.showHandAt(job.x, job.y - job.radius - 40);
    }

    private showHandAt(x: number, y: number): void {
      this.hideHand();
      this.hand = createHand(this, x, y, 1.05);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：水清了就搅，浑着就对着还没摸到的鱼连点 ——
     * 走的是与真实操作完全相同的 stirWater / tapFish 两条路。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: WINDOW.autoplayTapMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          const elapsed = this.elapsed();
          if (!isMuddy(this.level, this.state, elapsed)) {
            this.stirWater(elapsed);
            return;
          }
          const job = nextJob(this.level, this.state);
          if (job) this.tapFish(job, elapsed);
        },
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        const muddy = isMuddy(this.level, this.state, elapsed);
        // 水清了：摸到一半的那条鱼摆尾滑走 —— 没摸完的进度清零（零惩罚）
        if (this.wasMuddy && !muddy) this.waterCleared();
        this.wasMuddy = muddy;

        this.idleMs += delta;
        if (this.idleMs >= WINDOW.stirIdleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, WINDOW.hintY);
          this.pointAtNext();
        } else if (this.hand === null && elapsed - this.lastTapAt >= WINDOW.handDelayMs) {
          // 停手够久了：把小手放回此刻该动的地方
          this.pointAtNext();
        }
      }
      this.redraw(elapsed);
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.window });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title);
      this.worldGfx = this.add.graphics().setDepth(2);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => this.hideHand());

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else {
        this.showHint(cfg.level.hint, 3000, WINDOW.hintY);
        this.time.delayedCall(WINDOW.handDelayMs, () => this.pointAtNext());
      }
    }
  };
}

/**
 * 时机窗口：两种玩法共用一个场景键（SCENE_KEYS.window），按 level.mode 分派。
 * - fire（趁火打劫）/ glimpse（顺手牵羊）：窗口按时间开合 —— 既有路径，一行未改；
 * - stir（混水摸鱼）：窗口是**自己搅出来的** —— 点水面搅浑，浑水里才摸得到鱼。
 */
// 两个重载 + 一个并集的实现：老模式的调用处（传的是内联箭头函数）由第一个重载
// 做上下文类型推导，不用担心并集让回调参数变成 any —— 既有游戏包一行都不用改。
export function createWindowScene(
  ctx: GameContext,
  cfg: WindowConfig,
): Phaser.Types.Scenes.SceneType;
export function createWindowScene(
  ctx: GameContext,
  cfg: WindowStirConfig,
): Phaser.Types.Scenes.SceneType;
export function createWindowScene(
  ctx: GameContext,
  cfg: WindowConfig | WindowStirConfig,
): Phaser.Types.Scenes.SceneType {
  if (cfg.level.mode === 'stir') return createStirWindowScene(ctx, cfg as WindowStirConfig);
  return createTimedWindowScene(ctx, cfg as WindowConfig);
}
