import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, THEME, circle, createHand, roundRect, shade, sparkleAt, tapRipple,
} from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  READ_TIMING, applyMiss, applyRead, autoplayLevel, isReadDone, isTellRead, nextTellToRead,
  readMisses, readStart, tellAt, tellAtSlot, tellLeftMs, tellNear, tellsSoFar,
} from './read.logic';
import type { ReadState } from './read.logic';
import type { ReadLevel, ReadTell } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

/**
 * 识破模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（autoplayFactor / autoplayMinGapMs / idleMs…）来自 read.logic，
 * 单测与判定用的是同一份。
 */
export const READ = {
  /** 点的宽容度：破绽只有一个圆那么大，手指粗也要点得到 */
  tapForgive: 36,
  /** 破绽刚露出来时，光圈从多大长到破绽的半径 */
  ringGrow: 0.55,
  /** 看穿一处之后留多久让孩子看清"就是这个" */
  readHoldMs: 700,
  /** 揭晓之后停一会儿再进典故卡 */
  finaleHoldMs: READ_TIMING.finaleHoldMs,
  /** 进度槽（看穿了几处）画在哪里 */
  progress: { x: 150, y: 1180, w: 450, h: 46 },
  /** 说话的那一位站在哪儿（关卡数据里也有，但画面需要一块底的参照） */
  figureBottomY: 1100,
  /** 提示气泡的高度 */
  hintY: READ_TIMING.hintY,
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface ReadStageState {
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 此刻看得见的那一处破绽；没有就是 null */
  visible: ReadTell | null;
  /** 它是什么时候露出来的（画"还剩多久"用） */
  visibleStartMs: number;
  /** 窗口还剩多久 */
  msLeft: number;
  /** 到这一刻为止露过面几处 */
  seenCount: number;
  /** 看穿了几处 */
  readCount: number;
  /** 要看穿几处 */
  goal: number;
  /** 已经看穿的那几处 */
  readIds: string[];
  /** 刚刚看穿的那一处（画一次"看穿了"的强调） */
  lastRead: ReadTell | null;
  /** 刚刚那一下点空了：只是没收获，不扣星 —— 画面给一个"什么都没碰到"的小反馈 */
  lastMissAtMs: number;
  /** 空点了几次 */
  misses: number;
  /** 他还在笑，眼神却飘 —— 已经看懂的破绽越多，脸上的笑越假 */
  done: boolean;
}

export interface ReadConfig {
  level: ReadLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 场景标题：不给就用内容标题 */
  titleKey?: MessageKey;
  /** 这个世界：宴席、说话的那一位（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ReadLevel) => void;
  /** 每帧重画：此刻露出来的破绽（画在人上面） */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ReadStageState, level: ReadLevel) => void;
  /** 收尾：看懂了，他真正的打算摊开在桌面上 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ReadStageState, level: ReadLevel) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 识破：他满口好话，可是眼神、袖口、手指一次一次出卖他。
 *
 * 三条刻意的设计：
 * - **破绽只在窗口里看得见**：什么时候露、露多久都由 read.logic 的纯函数算
 *   （tellAt），画面只负责把"还剩多久"画得看得见 —— 孩子靠看，不靠背时间。
 * - **点空零惩罚**：没有破绽的时候点，只记一次 miss，不扣星、不结束、不锁操作。
 *   这一关教的是"看动作"，不是"别乱点"。
 * - **同一处只算一次**：看穿之后再点它没有第二次收获（applyRead 直接原样返回，
 *   场景据此跳过重复的表演）。
 */
export function createReadScene(ctx: GameContext, cfg: ReadConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class ReadScene extends BaseScene {
    private level: ReadLevel = cfg.level;
    private state: ReadState = readStart();
    private startedAt = 0;
    private done = false;
    private lastRead: ReadTell | null = null;
    private lastReadAt = Number.NEGATIVE_INFINITY;
    private lastMissAt = Number.NEGATIVE_INFINITY;
    private lastVisibleId: string | null = null;
    private openAtMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private doneGfx: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.read, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /** 破绽刚露出来 / 刚收回去的那一瞬：出声、发事件、把小手放到它上面 */
    private watchVisible(t: number): void {
      const tell = tellAt(this.level, t);
      const id = tell?.id ?? null;
      if (id !== this.lastVisibleId) {
        this.lastVisibleId = id;
        if (tell) {
          this.openAtMs = t;
          this.hideHand();
          this.sfx('tap');
          this.ctx.emit('beat:enter', { beatId: 'read:tell:' + tell.id });
          if (!this.autoplay) this.showHandAt(tell);
        } else {
          this.hideHand();
        }
      }
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(t, stage);
      if (this.done && this.doneGfx) {
        this.doneGfx.clear();
        cfg.drawFinale?.(this.doneGfx, stage, this.level);
      }
    }

    private stageState(t: number): ReadStageState {
      const slot = tellAtSlot(this.level, t);
      const visible = slot?.tell ?? null;
      return {
        elapsedMs: t,
        visible,
        visibleStartMs: slot?.startMs ?? 0,
        msLeft: tellLeftMs(this.level, t),
        seenCount: tellsSoFar(this.level, t),
        readCount: this.state.read.length,
        goal: this.level.goal,
        readIds: [...this.state.read],
        lastRead: this.lastRead,
        lastMissAtMs: this.lastMissAt,
        misses: readMisses(this.state),
        done: isReadDone(this.level, this.state),
      };
    }

    /** 看穿的那一处亮一下、点空的地方散一圈水波 —— 反馈都在画面上，不用文字 */
    private drawMarks(t: number, stage: ReadStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();

      const tell = stage.visible;
      if (tell && !isReadDone(this.level, this.state)) {
        const justOpened = Math.min(1, Math.max(0, (t - this.openAtMs) / READ_TIMING.appearMs));
        const grow = 1 - justOpened * (1 - READ.ringGrow);
        // 破绽本身由 cfg.drawStage 画；这里只加一圈"此刻看得见"的光
        g.lineStyle(9, THEME.gold, 0.9);
        g.strokeCircle(tell.x, tell.y, (tell.radius + 20) * grow);
        g.lineStyle(5, THEME.gold, 0.35);
        g.strokeCircle(tell.x, tell.y, (tell.radius + 38) * grow);
      }

      if (this.lastRead !== null && t - this.lastReadAt <= READ.readHoldMs) {
        const p = 1 - (t - this.lastReadAt) / READ.readHoldMs;
        g.lineStyle(10, THEME.teal, 0.9 * p);
        g.strokeCircle(this.lastRead.x, this.lastRead.y, this.lastRead.radius + 40 * (1 - p) + 20);
      }

      if (t - this.lastMissAt <= 420) {
        const p = 1 - (t - this.lastMissAt) / 420;
        g.lineStyle(7, THEME.inkSoft, 0.5 * p);
        g.strokeCircle(this.level.speaker.x, this.level.speaker.y + 40, 120 + 90 * (1 - p));
      }
    }

    // ---------------- 点 ----------------

    private onTap(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.done) return;
      const t = this.now();
      // 只认此刻看得见的那一处：窗口外面点在那里不算看穿
      const tell = tellNear(this.level, pointer.x, pointer.y, READ.tapForgive, t);
      if (tell === undefined) {
        this.miss(pointer.x, pointer.y, t);
        return;
      }
      this.read(tell, t);
    }

    /** 看穿一处（真实操作与无头验证走的是同一条路） */
    private read(tell: ReadTell, t: number): void {
      if (this.done || isTellRead(this.state, tell.id)) return;
      this.state = applyRead(this.level, this.state, tell.id);
      this.lastRead = tell;
      this.lastReadAt = t;
      this.idleMs = 0;
      this.hideHand();
      this.sfx('correct');
      sparkleAt(this, tell.x, tell.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'read:seen:' + tell.id });
      this.ctx.emit('choice:made', {
        beatId: 'read:' + tell.id,
        choiceId: tell.kind,
        correct: true,
        latencyMs: t,
      });
      recordAttempt(cfg.session, { ok: true });
      // 看穿一个就报一句进度（写进事件流，e2e 与复盘都看得见）
      this.ctx.emit('beat:enter', {
        beatId: 'read:progress:' + this.state.read.length + ':' + this.level.goal,
      });
      if (isReadDone(this.level, this.state)) this.finish();
    }

    /** 点了个空：只是没收获 —— 不扣星、不结束、不锁操作 */
    private miss(x: number, y: number, t: number): void {
      if (this.done) return;
      this.state = applyMiss(this.state);
      this.lastMissAt = t;
      this.idleMs = 0;
      this.sfx('tap');
      tapRipple(this, x, y, 40, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'read:miss:' + this.state.misses });
      // 点空**不**发 choice:made 的 correct:false —— 它不是"答错"，只是还没等到
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done) return;
      this.done = true;
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? READ.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: READ.hintY
      });
    }

    // ---------------- 小手 ----------------

    private showHandAt(tell: ReadTell): void {
      this.hideHand();
      this.hand = createHand(this, tell.x, tell.y - tell.radius - 40, 1.05);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：隔一会儿看一眼"此刻有没有破绽"，有就按（用的是与真实操作
     * 完全相同的 tellNear + read() 同一条路）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: READ_TIMING.autoplayLookMs,
        loop: true,
        callback: () => {
          if (this.done) return;
          const t = this.now();
          const tell = tellAt(this.level, t);
          if (tell === undefined || isTellRead(this.state, tell.id)) return;
          if (tellNear(this.level, tell.x, tell.y, READ.tapForgive, t) === undefined) return;
          this.read(tell, t);
        },
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (this.done) {
        this.redraw(this.now());
        return;
      }
      const t = this.now();
      this.watchVisible(t);
      this.redraw(t);

      // 卡住了：点一下提示（不指"下一处破绽在哪儿"，那是他自己要看的）
      this.idleMs += delta;
      if (this.idleMs >= READ_TIMING.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, READ.hintY);
      }
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.read });
      this.level = autoplayLevel(cfg.level, this.autoplay);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(30);
      this.markGfx = this.add.graphics().setDepth(70);
      this.doneGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 3000, READ.hintY);
    }
  };
}

// ---------------- 画面用的两个小工具（口径与判定同一份，游戏包直接用） ----------------

/** 进度槽：看穿了几处（0..goal） */
export function readProgressBar(
  g: Phaser.GameObjects.Graphics,
  level: ReadLevel,
  readCount: number,
): void {
  const { x, y, w, h } = READ.progress;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const inner = w - 12;
  const fill = (inner * Math.min(readCount, level.goal)) / Math.max(1, level.goal);
  if (fill > 6) {
    roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.gold, null, 0);
  }
}

/** 进度槽上的刻度：一处破绽一格，看穿了的亮起来 */
export function readTicks(
  g: Phaser.GameObjects.Graphics,
  level: ReadLevel,
  readIds: readonly string[],
): void {
  const { x, y, w, h } = READ.progress;
  const total = Math.max(1, level.tells.length);
  for (let i = 0; i < level.tells.length; i += 1) {
    const cx = x + ((i + 1) * w) / (total + 1);
    const seen = readIds.includes(level.tells[i]?.id ?? '');
    circle(g, cx, y + h / 2, 7, seen ? THEME.goldDeep : THEME.paperDeep, THEME.outline, 4);
  }
}

/** 提示：下一处该留意的方向（不指出具体是什么动作 —— 那是孩子自己看的） */
export function nextTellHint(
  level: ReadLevel,
  state: ReadState,
  index = 0,
): ReadTell | undefined {
  return nextTellToRead(level, state, index);
}
