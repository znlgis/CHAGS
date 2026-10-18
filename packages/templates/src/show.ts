import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, roundRect, shade } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  SHOW_RATES, aliveShadowIds, aliveShadows, beliefAt, isShowDone, missingShadows, nextSlotToPaint,
  paint, shadowStrength, showStart, slotAt, tick as advanceShow,
} from './show.logic';
import type { ShowState } from './show.logic';
// 第 29 计树上开花（borrow）的判定：与 draw 的那几个并列，互不影响
import {
  assignFlag, borrowProgress, borrowStart, canHangAt, flagCountAt, flagsLeft, isBorrowDone,
  nextPropToHang, nextPropToTouch, propAt, scaleAt, unassignFlag,
} from './show.logic';
import type { BorrowState, ShowBorrowProp } from './show.logic';
import type { ShowBorrowLevel, ShowLevel, ShowSlot } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

/**
 * 造势模板自己的常量 —— 不挤进 layout.ts，免得新模板之间互相踩。
 * 涨落速度那几个（risePerSec / fallPerSec / autoplayFactor）来自 show.logic：
 * 单测、画面与无头验证用的是同一份。
 */
export const SHOW = {
  ...SHOW_RATES,
  /** 点空位的命中宽容度：手指粗也能点到船帮上的位子（相邻空位靠"最近的赢"分开） */
  tapForgive: 80,
  /** 开局过一会儿就把"该在空位上画一笔"说出来（不让孩子干等） */
  introHintMs: 1200,
  /** 多久没动静就把小手放到下一个该补的空位上 */
  idleMs: 8000,
  /** 无头验证：多久补一笔（影子的寿命不压缩，压缩的只是"疑心涨多快"） */
  autoplayPaintMs: 260,
  /** 打赢之后看一眼雾里的船再走 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,

  /* ---- 第 29 计树上开花（borrow）：把旗分配到支点上 ---- */
  /** 点支点的命中宽容度：手指粗也点得到（相邻支点靠"最近的赢"分开） */
  borrowForgive: 44,
  /** 无头验证：隔多久挂一面旗（走的是与真实操作同一条路） */
  autoplayAssignMs: 420,
  /** 规模条画在哪里（游戏包的 drawStage 用 showBorrowBar） */
  borrowBar: { x: 150, y: 1256, w: 450, h: 44 },
} as const;

/** 交给游戏画的一切：船、雾、六个空位上的草人、对面那杆疑心的秤 */
export interface ShowStageState {
  /** 每个空位上影子的强弱（1 = 刚画上，0 = 淡没了）—— 草人随它变淡变小 */
  strength: Record<string, number>;
  /** 还在立着的影子 id */
  alive: string[];
  /** 还差几个才够 needed（够 = 0）：画面上"还不够"的那一层心事 */
  missing: number;
  /** 对面的疑心（0..goal） */
  belief: number;
  goal: number;
  /** 疑心涨到几成（0..1）—— 疑心条按它画 */
  ratio: number;
  /** 此刻影子够不够（疑心在涨还是在落） */
  rising: boolean;
  /** 一笔能立多久（画面上的沙漏） */
  fadeMs: number;
  /** 一共画了多少笔 */
  strokes: number;
  elapsedMs: number;
  /** 这一局打赢了 */
  done: boolean;
}

export interface ShowApi {
  scene: Phaser.Scene;
  stage: ShowStageState;
}

export interface ShowConfig {
  level: ShowLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：江、雾、船、船帮上的六个空位（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ShowLevel) => void;
  /** 每帧重画：影子、箭、疑心条 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ShowStageState, level: ShowLevel) => void;
  /** 画上一笔时的表现（雾散开一点、影子晃一下） */
  onPaint?: (slot: ShowSlot, api: ShowApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ShowStageState, level: ShowLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 造势（draw，第 7 计无中生有）：从什么都没有开始，把一个不存在的东西**维持住**。
 *
 * 三条刻意的设计：
 * - **判定全在 show.logic 里**：场景只把墙钟喂给 `advanceShow` / `isShowDone`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **一笔只管 fadeMs**：画下去的影子到点就淡掉，得回头补 —— 手一停，疑心就回落。
 *   所以这一关考的不是"点一下"，是"撑着"。
 * - **零惩罚**：影子全淡光也不结束、不扣星；疑心落到底就落到底，补上又能涨回来。
 *
 * 这一段是 **draw 那条路（一行没改）**，只是从 createShowScene 里挪成了一个具名函数；
 * borrow 那一半在文件末尾另起一段，由 mode 分派。
 */
function createDrawShowScene(ctx: GameContext, cfg: ShowConfig): Phaser.Types.Scenes.SceneType {
  return class ShowScene extends BaseScene {
    private level: ShowLevel = cfg.level;
    private state: ShowState = showStart();
    private startedAt = 0;
    private finished = false;
    private idleMs = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.show, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.show });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 2600, SHOW.hintY);
        this.time.delayedCall(SHOW.introHintMs, () => this.pointAtNext());
      }
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        // 无头验证把每一帧的记账时间放大几倍：影子的寿命照旧，只是疑心涨得快得多
        const step = this.autoplay ? delta * SHOW.autoplayFactor : delta;
        this.state = advanceShow(this.level, this.state, elapsed, step);

        this.idleMs += delta;
        if (this.idleMs >= SHOW.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, SHOW.hintY);
          this.pointAtNext();
        }
        if (isShowDone(this.level, this.state)) this.finish();
      }
      this.redraw(elapsed);
    }

    private redraw(elapsed: number): void {
      const g = this.stageGfx;
      if (!g) return;
      g.clear();
      cfg.drawStage(g, this.stageState(elapsed), this.level);
    }

    private stageState(elapsed: number): ShowStageState {
      const strength: Record<string, number> = {};
      for (const slot of this.level.slots) {
        strength[slot.id] = shadowStrength(this.level, this.state, slot.id, elapsed);
      }
      const alive = aliveShadowIds(this.level, this.state, elapsed);
      const belief = beliefAt(this.level, this.state, elapsed);
      return {
        strength,
        alive,
        missing: missingShadows(this.level, this.state, elapsed),
        belief,
        goal: this.level.goal,
        ratio: Math.min(1, Math.max(0, belief / this.level.goal)),
        rising: alive.length >= this.level.needed,
        fadeMs: this.level.fadeMs,
        strokes: this.state.strokes,
        elapsedMs: elapsed,
        done: this.finished && isShowDone(this.level, this.state),
      };
    }

    // ---------------- 画一笔 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      const slot = slotAt(this.level, pointer.x, pointer.y, SHOW.tapForgive);
      if (!slot) return;
      this.paintSlot(slot);
    }

    /** 画上一笔（真实操作与无头验证走的是同一条路） */
    private paintSlot(slot: ShowSlot): void {
      if (this.finished) return;
      const elapsed = this.elapsed();
      const before = aliveShadows(this.level, this.state, elapsed);
      this.state = paint(this.state, slot.id, elapsed);
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      // 立着的影子越多，音调越高 —— "势"是听得见的
      this.ctx.services.audio.tone(300 + Math.min(6, before) * 46, 70);
      this.ctx.emit('beat:enter', { beatId: 'show:paint:' + slot.id });
      cfg.onPaint?.(slot, { scene: this, stage: this.stageState(elapsed) });
      this.redraw(elapsed);
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SHOW.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: SHOW.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'show:done' });
          this.redraw(this.elapsed());
          if (this.finaleGfx) {
            cfg.drawFinale?.(this.finaleGfx, this.stageState(this.elapsed()), this.level);
          }
        }
      });
    }

    // ---------------- 小手 ----------------

    /** 把小手与光圈放到下一个该补的空位上 —— 提示给在点上，但"该立几个"要他自己看 */
    private pointAtNext(): void {
      if (this.finished) return;
      const slot = nextSlotToPaint(this.level, this.state, this.elapsed());
      if (!slot) return;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(slot.x, slot.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, slot.radius + 22);
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
      this.hand = createHand(this, slot.x, slot.y + slot.radius + 36, 1.1);
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
     * 轮转补画：影子不够就填一个空位，够了就续最快要淡掉的那一笔 ——
     * 与孩子该做的事一模一样，用的也是同一条 paintSlot() 路径。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: SHOW.autoplayPaintMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          const slot = nextSlotToPaint(this.level, this.state, this.elapsed());
          if (slot) this.paintSlot(slot);
        },
      });
    }
  };
}
/* ---------------- borrow：树上开花（第 29 计） ---------------- */

/**
 * 每一帧交给游戏画的一切：哪个支点上挂了几面旗、手里还剩几面、规模到了几成。
 * 画面完全由游戏决定（树怎么画、旗怎么飘都是它的事），模板只管这一份数。
 */
export interface ShowBorrowMetrics {
  width: number;
  height: number;
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 每个支点上挂着几面旗（没挂过就是 0） */
  hanging: Record<string, number>;
  /** 手里还剩几面旗 */
  flagsLeft: number;
  /** 手里一共几面旗 */
  flags: number;
  /** 挂出来的规模 */
  scale: number;
  /** 规模到多少算成 */
  needed: number;
  /** 规模到了 needed 的几成（0..1）—— 规模条按它画 */
  ratio: number;
  /** 刚挂上 / 刚撤下的那个支点；还没动过就是 null */
  lastPropId: string | null;
  /** 那一下是什么时候（画面按它晃一下） */
  lastAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  done: boolean;
}

export interface ShowBorrowApi {
  scene: Phaser.Scene;
  stage: ShowBorrowMetrics;
}

/**
 * borrow（树上开花）这一路的配置。与 draw 的 `ShowConfig` 是两份 ——
 * draw 的字段一个字没动，多出来的这些只有 borrow 用得上。
 */
export interface ShowBorrowConfig {
  level: ShowBorrowLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：河、桥、对岸的林子与土坡（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ShowBorrowLevel) => void;
  /** 每帧重画：支点上挂着的旗、手里的旗、规模条 */
  drawStage: (
    g: Phaser.GameObjects.Graphics,
    stage: ShowBorrowMetrics,
    level: ShowBorrowLevel,
  ) => void;
  /** 挂上一面 / 撤下一面时的表现（旗子飘一下、支点亮一下） */
  onPlace?: (prop: ShowBorrowProp, placed: boolean, api: ShowBorrowApi) => void;
  /** 收尾：规模到够了之后的样子 */
  drawFinale?: (
    g: Phaser.GameObjects.Graphics,
    stage: ShowBorrowMetrics,
    level: ShowBorrowLevel,
  ) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/** 规模条：挂出来的规模到了 needed 的几成 —— 游戏包的 drawStage 用它（口径与判定同一份） */
export function showBorrowBar(
  g: Phaser.GameObjects.Graphics,
  level: ShowBorrowLevel,
  scale: number,
): void {
  const { x, y, w, h } = SHOW.borrowBar;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const ratio = Math.min(1, Math.max(0, scale / level.needed));
  const fill = (w - 12) * ratio;
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.gold, null, 0);
}

/**
 * 树上开花：借现成的东西（树、城墙）把小队显得很大。
 *
 * 三条刻意的设计：
 * - **账本是"分配"，不是"手快"**：手里几面旗，挂到哪几个支点上；每个支点能挂几面
 *   （capacity）与每面旗在那里顶多少规模（weight）都是关卡数据写的 —— 桥头最显眼，
 *   但只挂得下两面。判定全在 show.logic 里，场景只把手指落在哪儿翻译成一次 assign。
 * - **撤下重挂零惩罚**：点支点是"有旗就挂、满了（或没旗了）就撤一面下来"，
 *   旗回到手里，随时可以换一处挂 —— 想通了随时能改，不扣星、不结束。
 * - **挂不下就是挂不下**：超出容量只是没进展；小手与无头验证都走 pressAt 这一条路。
 */
function createBorrowShowScene(
  ctx: GameContext,
  cfg: ShowBorrowConfig,
): Phaser.Types.Scenes.SceneType {
  return class ShowBorrowScene extends BaseScene {
    private level: ShowBorrowLevel = cfg.level;
    private state: BorrowState = borrowStart();
    private startedAt = 0;
    private finished = false;
    private idleMs = 0;
    private misses = 0;
    private lastPropId: string | null = null;
    private lastAt = -1;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.show, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.show });
      this.startedAt = this.ctx.services.now();
      this.level = cfg.level;
      this.state = borrowStart();
      this.drawBackdrop(cfg.title ?? this.ctx.content.title);

      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.time.delayedCall(SHOW.introHintMs, () => {
          this.showHint(cfg.level.hint, 3000, SHOW.hintY);
          this.pointAtNext();
        });
      }
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      if (!this.finished) {
        this.idleMs += delta;
        if (this.idleMs >= SHOW.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, SHOW.hintY);
          this.pointAtNext();
        }
        if (isBorrowDone(this.level, this.state)) this.finish();
      }
      this.redraw();
    }

    private redraw(): void {
      const g = this.stageGfx;
      if (!g) return;
      g.clear();
      cfg.drawStage(g, this.metrics(this.finished), this.level);
    }

    private metrics(done: boolean): ShowBorrowMetrics {
      const hanging: Record<string, number> = {};
      for (const prop of this.level.props) hanging[prop.id] = flagCountAt(this.state, prop.id);
      const scale = scaleAt(this.level, this.state);
      return {
        width: this.W,
        height: this.H,
        elapsedMs: this.elapsed(),
        hanging,
        flagsLeft: flagsLeft(this.level, this.state),
        flags: this.level.flags,
        scale,
        needed: this.level.needed,
        ratio: borrowProgress(this.level, this.state),
        lastPropId: this.lastPropId,
        lastAtMs: this.lastAt,
        misses: this.misses,
        done,
      };
    }

    // ---------------- 点支点 ----------------

    private pressAt(x: number, y: number): void {
      if (this.finished) return;
      this.idleMs = 0;
      const prop = propAt(this.level, x, y, SHOW.borrowForgive);
      if (prop === undefined) {
        this.nothing();
        return;
      }
      this.toggle(prop);
    }

    /**
     * 点一个支点：**有旗就挂、满了（或手里没旗了）就撤一面下来**。
     * 于是"撤下重挂"不用另找按钮 —— 撤下来的旗回到手里，随时能挂到别处去。
     */
    private toggle(prop: ShowBorrowProp): void {
      if (this.finished) return;
      if (canHangAt(this.level, this.state, prop.id)) {
        this.hang(prop);
        return;
      }
      if (flagCountAt(this.state, prop.id) > 0) {
        this.unhang(prop);
        return;
      }
      // 手里一面旗也没有了，这里又是空的：只是没进展（零惩罚）
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'show:nohang:' + prop.id });
      this.showHint(cfg.level.hint, 2200, SHOW.hintY);
      this.pointAtNext();
    }

    /** 挂上一面旗（真实操作与无头验证走的是同一条路） */
    private hang(prop: ShowBorrowProp): void {
      if (this.finished) return;
      const before = this.state;
      this.state = assignFlag(this.level, this.state, prop.id);
      if (this.state === before) return; // 挂不上：什么也不发生
      this.lastPropId = prop.id;
      this.lastAt = this.elapsed();
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('unlock');
      // 规模听得见：挂得越多，音调越高
      this.ctx.services.audio.tone(300 + Math.min(6, flagCountAt(this.state, prop.id)) * 46, 70);
      this.ctx.emit('beat:enter', { beatId: 'show:hang:' + prop.id });
      cfg.onPlace?.(prop, true, { scene: this, stage: this.metrics(this.finished) });
      this.redraw();
      if (isBorrowDone(this.level, this.state)) this.finish();
    }

    /** 撤下一面旗：旗回到手里，随时可以挂到别处去（零惩罚） */
    private unhang(prop: ShowBorrowProp): void {
      if (this.finished) return;
      const before = this.state;
      this.state = unassignFlag(this.level, this.state, prop.id);
      if (this.state === before) return;
      this.lastPropId = prop.id;
      this.lastAt = this.elapsed();
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'show:unhang:' + prop.id });
      cfg.onPlace?.(prop, false, { scene: this, stage: this.metrics(this.finished) });
      this.redraw();
      this.pointAtNext();
    }

    /** 点了空处：只是没收获 —— 不扣星、不结束 */
    private nothing(): void {
      if (this.finished) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'show:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished || !isBorrowDone(this.level, this.state)) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SHOW.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: SHOW.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'show:done' });
          this.redraw();
          if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx, this.metrics(true), this.level);
        }
      });
    }

    // ---------------- 小手 ----------------

    /** 把小手与光圈放到该动的那个支点上：先挂最好的，没旗可挂了就去撤一处 */
    private pointAtNext(): void {
      if (this.finished) return;
      const prop = nextPropToTouch(this.level, this.state);
      if (!prop) return;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(prop.x, prop.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, prop.radius + 22);
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
      this.hand = createHand(this, prop.x, prop.y + prop.radius + 36, 1.1);
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
     * 无头验证：按 weight 从高到低往支点上挂旗 ——
     * 与孩子走的是同一条路（连"点在哪一处"都走一遍命中判定）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: SHOW.autoplayAssignMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          const prop = nextPropToHang(this.level, this.state);
          if (prop === undefined) return;
          this.pressAt(prop.x, prop.y);
        },
      });
    }
  };
}

/**
 * 造势：两种玩法共用一个场景键（SCENE_KEYS.show），按 level.mode 分派。
 * - draw（无中生有）：一笔一笔把影子撑住 —— 既有路径，一行未改；
 * - borrow（树上开花）：把手里的旗分配到支点上，借现成的东西把场面撑大。
 */
// 两个重载 + 一个并集的实现：老模式的调用处（传的是内联箭头函数）由第一个重载
// 做上下文类型推导，不用担心并集让回调参数变成 any —— 既有游戏包一行都不用改。
export function createShowScene(
  ctx: GameContext,
  cfg: ShowConfig,
): Phaser.Types.Scenes.SceneType;
export function createShowScene(
  ctx: GameContext,
  cfg: ShowBorrowConfig,
): Phaser.Types.Scenes.SceneType;
export function createShowScene(
  ctx: GameContext,
  cfg: ShowConfig | ShowBorrowConfig,
): Phaser.Types.Scenes.SceneType {
  if (cfg.level.mode === 'borrow') return createBorrowShowScene(ctx, cfg as ShowBorrowConfig);
  return createDrawShowScene(ctx, cfg as ShowConfig);
}
