import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, roundRect, shade, sparkleAt, tapRipple } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  LURE_TIMING, awayLeftMs, awayTotalMs, baitAt, bestBait, bestOffer, decoyStart, give, grabAt,
  grabProgress, guardBack, isAway, isDecoyDone, isTradeDone, lureAutoplayLevel, nextOfferToGive,
  offerAt, placeBait, prizeHit, releaseGrab, tradeProgress, tradeStart,
} from './lure.logic';
import type { LureDecoyState, LureTradeState } from './lure.logic';
import type { LureBait, LureLevel, LureOffer, LureReturn } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';
// 第六辑 · 第 31 计 美人计（favor）：新判定单独 import —— 上面那一行老模式的 import 一字没动
import {
  FAVOR_TIMING, favorProgress, favorStart, favorsGiven, gazeAt, giftAt, hintGift, isFavorDone,
  offerFavor, wantedGift,
} from './lure.logic';
import type { LureFavorState } from './lure.logic';
import type { LureFavorLevel, LureGift } from './schemas';

/**
 * 诱饵模板自己的布局与手感常量 —— 不挤进 layout.ts，免得新模板之间互相踩。
 * 时间的那几个（autoplayFactor / idleMs / 两种"亮一下"的时长）来自 lure.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const LURE = {
  /** 点诱饵点 / 箱子的宽容度：手指粗也能点到 */
  tapForgive: 56,
  /** 空档还剩多久：看守头顶那根条（比他站着的位置再高这么多） */
  timerBar: { w: 210, h: 26, aboveGuard: 194 },
  /** 拿到几成的金环离箱子多远 */
  grabRing: 30,
  /** 看守刚回岗时那一圈扩散 */
  resetRing: 96,
  /** 开局过一会儿就把小手放出来（不让孩子干等） */
  introHintMs: 1400,
  /** 多久没动静就把提示与小手放出来 */
  idleMs: LURE_TIMING.idleMs,
  /** 拿到之后看一眼再进典故卡 */
  finaleHoldMs: LURE_TIMING.finaleHoldMs,
  /** 提示气泡的高度 */
  hintY: LURE_TIMING.hintY,
} as const;

/**
 * 交给游戏画的 decoy 那一半：看守离岗了没有、空档还剩多久、拿到了几成。
 * （怎么画"山口""守将""山那边的炊烟"全在游戏包里。）
 */
export interface LureDecoyStage {
  mode: 'decoy';
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 看守此刻离岗了吗 */
  away: boolean;
  /** 空档还剩多久 */
  awayLeftMs: number;
  /** 这一次诱饵能让岗位空多久（在岗 = 0） */
  awayMs: number;
  /** 正在被引开的那个诱饵点；看守在岗 = null */
  baitId: string | null;
  /** 拿东西要连续多久 */
  needMs: number;
  /** 空档里已经连续拿了多久 */
  grabMs: number;
  /** 拿到几成（0..1）—— 箱子外那圈金环按它画 */
  grabRatio: number;
  /** 孩子的手指正按在箱子上 */
  holding: boolean;
  /** 看守回了几次岗（零惩罚：没拿完的散掉，接着来） */
  returns: number;
  /** 上一次回岗是什么时候 —— 画面演一次"散掉" */
  lastReturnAtMs: number;
  /** 放过的诱饵点 */
  usedBaits: string[];
  /** 箱子拿到手了 */
  done: boolean;
}

/** 交给游戏画的 trade 那一半：递出去的是哪块砖、换回来了什么 */
export interface LureTradeStage {
  mode: 'trade';
  elapsedMs: number;
  /** 已经递出去过的"砖" */
  given: string[];
  /** 递了几次 */
  gives: number;
  /** 刚刚递出去的是哪一块 */
  lastOffer: LureOffer | null;
  /** 刚刚换回来的是什么（对方的反应就演它） */
  lastReturn: LureReturn | null;
  /** 刚刚那一次过去多久了 */
  sinceTradeMs: number;
  /** 换到的最好的东西值多少 */
  best: number;
  /** 要多少才算"玉" */
  needed: number;
  /** 换到几成（0..1） */
  ratio: number;
  done: boolean;
}

export type LureStageState = LureDecoyStage | LureTradeStage;

export interface LureApi {
  scene: Phaser.Scene;
  stage: LureStageState;
}

export interface LureConfig {
  level: LureLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：山口、守将、山那边的炊烟（decoy）/ 书斋的墙（trade）—— 画一次 */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: LureLevel) => void;
  /** 每帧重画：看守站在哪儿、箱子、对方手里拿着什么 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: LureStageState, level: LureLevel) => void;
  /** 放下诱饵 / 递出去一样东西时的表现（由游戏包自己演） */
  onPlaceBait?: (bait: LureBait, api: LureApi) => void;
  onGive?: (offer: LureOffer, back: LureReturn, api: LureApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: LureStageState, level: LureLevel) => void;
  /** 拿到之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 诱饵：**把他引开，或者先给一点点**。
 *
 * 三条刻意的设计：
 * - **判定全在 lure.logic 里**：场景只把墙钟喂给 placeBait / grabAt / guardBack / give，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **按住才算"连续的空档"**（decoy）：松手就断，看守一回岗没拿完的清零。
 *   所以这一关考的不是手快，是"挑一个能空够久的诱饵点"。
 * - **零惩罚**：选错诱饵点只是白等一场（不算）；挑错砖只是再挑一次 —— 记进 mistakes、不结束、不锁操作。
 */
function createLureDecoyTradeScene(ctx: GameContext, cfg: LureConfig): Phaser.Types.Scenes.SceneType {
  return class LureScene extends BaseScene {
    private level: LureLevel = cfg.level;
    private decoyState: LureDecoyState = decoyStart();
    private tradeState: LureTradeState = tradeStart();
    private startedAt = 0;
    private finished = false;
    private holding = false;
    private holdPointerId: number | null = null;
    private lastOffer: LureOffer | null = null;
    private lastReturn: LureReturn | null = null;
    private lastTradeAt = Number.NEGATIVE_INFINITY;
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.lure, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.lure });
      this.level = lureAutoplayLevel(cfg.level, this.autoplay);
      this.decoyState = decoyStart();
      this.tradeState = tradeStart();
      this.startedAt = this.ctx.services.now();
      this.finished = false;
      this.holding = false;
      this.holdPointerId = null;
      this.lastOffer = null;
      this.lastReturn = null;
      this.lastTradeAt = Number.NEGATIVE_INFINITY;
      this.idleMs = 0;
      this.ring = null;
      this.hand = null;

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(30);
      this.markGfx = this.add.graphics().setDepth(60);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      // 手指还按着、但已经挪出箱子：这次"连续的空档"就断了（drag 出去不算按住）
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMove(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(this.level.hint, 2600, LURE.hintY);
        this.time.delayedCall(LURE.introHintMs, () => this.pointAtNext());
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const t = this.now();
      if (!this.finished) {
        if (this.level.mode === 'decoy') {
          // 无头验证先决定"这一帧按不按住"，再与真实操作走同一条 grabAt 的路
          if (this.autoplay) this.autoplayDecoy(t);
          // 看守到点就回岗：没拿完的清零（零惩罚）
          this.decoyState = guardBack(this.level, this.decoyState, t);
          this.decoyState = this.holding
            ? grabAt(this.level, this.decoyState, t)
            : releaseGrab(this.decoyState, t);
        }
        this.idleMs += delta;
        if (this.idleMs >= LURE.idleMs) {
          this.idleMs = 0;
          this.showHint(this.level.hint, 2600, LURE.hintY);
          this.pointAtNext();
        }
        if (this.isDone()) this.finish();
      }
      this.redraw(t);
    }

    private isDone(): boolean {
      if (this.level.mode === 'decoy') return isDecoyDone(this.level, this.decoyState);
      return isTradeDone(this.level, this.tradeState);
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(t, stage);
      if (this.finished && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): LureStageState {
      if (this.level.mode === 'decoy') {
        const level = this.level;
        const state = this.decoyState;
        return {
          mode: 'decoy',
          elapsedMs: t,
          away: isAway(level, state, t),
          awayLeftMs: awayLeftMs(level, state, t),
          awayMs: awayTotalMs(level, state),
          baitId: state.baitId,
          needMs: level.prize.needMs,
          grabMs: state.grabMs,
          grabRatio: grabProgress(level, state),
          holding: this.holding,
          returns: state.returns,
          lastReturnAtMs: state.lastReturnAtMs,
          usedBaits: [...state.usedBaits],
          done: isDecoyDone(level, state),
        };
      }
      const level = this.level;
      const state = this.tradeState;
      return {
        mode: 'trade',
        elapsedMs: t,
        given: [...state.given],
        gives: state.gives,
        lastOffer: this.lastOffer,
        lastReturn: this.lastReturn,
        sinceTradeMs:
          this.lastTradeAt === Number.NEGATIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : t - this.lastTradeAt,
        best: state.best,
        needed: level.needed,
        ratio: tradeProgress(level, state),
        done: isTradeDone(level, state),
      };
    }

    /**
     * 判定之外的两个"看得见"：空档还剩多久（看守头顶那根条）、拿到了几成（箱子外那圈金环）。
     * 条子从绿变红的那一刻，孩子就知道"这个诱饵点不够久"。
     */
    private drawMarks(t: number, stage: LureStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();

      if (stage.mode === 'decoy' && this.level.mode === 'decoy') {
        const level = this.level;
        if (stage.away && stage.awayMs > 0) {
          const ratio = Math.min(1, Math.max(0, stage.awayLeftMs / stage.awayMs));
          const { w, h, aboveGuard } = LURE.timerBar;
          const x = level.guard.x - w / 2;
          // 画在守将头顶之上 —— 那是"岗位空着多久"，不是他身上的一根血条
          const y = level.guard.y - level.guard.radius - aboveGuard;
          roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
          const fill = (w - 12) * ratio;
          if (fill > 6) {
            roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, ratio > 0.3 ? THEME.teal : THEME.red, null, 0);
          }
        }
        if (stage.grabMs > 0 && !stage.done) {
          g.lineStyle(13, THEME.gold, 0.95);
          g.beginPath();
          g.arc(
            level.prize.x,
            level.prize.y,
            level.prize.radius + LURE.grabRing,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * stage.grabRatio,
            false,
          );
          g.strokePath();
        }
        // 看守刚回岗：没拿完的散掉了 —— 箱子那一圈红环往外扩一下就没了
        const sinceBack = t - stage.lastReturnAtMs;
        if (sinceBack >= 0 && sinceBack <= LURE_TIMING.resetFlashMs) {
          const p = 1 - sinceBack / LURE_TIMING.resetFlashMs;
          g.lineStyle(10, THEME.red, 0.85 * p);
          g.strokeCircle(
            level.prize.x,
            level.prize.y,
            level.prize.radius + LURE.grabRing + LURE.resetRing * (1 - p),
          );
        }
        return;
      }

      if (stage.mode === 'trade' && this.level.mode === 'trade') {
        const level = this.level;
        // 刚递出去的那一块亮一下：东西从手里出去，玉才回来
        if (stage.lastOffer !== null && stage.sinceTradeMs <= LURE_TIMING.tradeFlashMs) {
          const p = 1 - stage.sinceTradeMs / LURE_TIMING.tradeFlashMs;
          g.lineStyle(10, THEME.gold, 0.9 * p);
          g.strokeCircle(stage.lastOffer.x, stage.lastOffer.y, stage.lastOffer.radius + 26 * (1 - p) + 14);
          const partner = level.partner;
          g.lineStyle(8, THEME.teal, 0.8 * p);
          g.strokeCircle(partner.x, partner.y, 150 + 60 * (1 - p));
        }
        // 递过的那几块：石头下面垫一小圈（"这块已经给过了"）
        for (const offer of level.offers) {
          if (!stage.given.includes(offer.id)) continue;
          g.lineStyle(6, THEME.inkSoft, 0.45);
          g.strokeCircle(offer.x, offer.y, offer.radius + 12);
        }
      }
    }

    // ---------------- 点 / 按 ----------------

    private onDown(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.finished) return;
      const t = this.now();

      if (this.level.mode === 'decoy') {
        const bait = baitAt(this.level, pointer.x, pointer.y, LURE.tapForgive);
        if (bait !== undefined) {
          this.placeBaitAt(bait, t);
          return;
        }
        if (prizeHit(this.level, pointer.x, pointer.y, LURE.tapForgive)) {
          this.holdPointerId = pointer.id;
          this.holding = true;
          this.idleMs = 0;
          this.hideHand();
          this.sfx('tap');
          // 看守在岗时按住它什么也不会发生（零惩罚）—— 只是白按
          this.ctx.emit('beat:enter', {
            beatId: isAway(this.level, this.decoyState, t) ? 'lure:grab:start' : 'lure:grab:wait',
          });
        }
        return;
      }

      const offer = offerAt(this.level, pointer.x, pointer.y, LURE.tapForgive);
      if (offer !== undefined) this.giveOffer(offer, t);
    }

    /** 按住箱子的时候手指挪开了：算松手（零惩罚，重新按就是） */
    private onMove(pointer: Phaser.Input.Pointer): void {
      if (this.holdPointerId === null || pointer.id !== this.holdPointerId) return;
      if (this.level.mode !== 'decoy') return;
      if (!prizeHit(this.level, pointer.x, pointer.y, LURE.tapForgive)) this.onUp(pointer);
    }

    private onUp(pointer: Phaser.Input.Pointer): void {
      if (this.holdPointerId !== null && pointer.id !== this.holdPointerId) return;
      this.holdPointerId = null;
      this.holding = false;
      if (this.level.mode === 'decoy') {
        this.decoyState = releaseGrab(this.decoyState, this.now());
      }
    }

    /** 放下一个诱饵（真实操作与无头验证走的是同一条路） */
    private placeBaitAt(bait: LureBait, t: number): void {
      if (this.level.mode !== 'decoy') return;
      const level = this.level;
      const before = this.decoyState;
      const next = placeBait(level, before, bait.id, t);
      if (next === before) {
        // 看守已经在路上了：再放一个不管用 —— 但也不惩罚，只给一个"没反应"的圈
        tapRipple(this, bait.x, bait.y, bait.radius, THEME.inkSoft);
        return;
      }
      this.decoyState = next;
      this.idleMs = 0;
      this.hideHand();
      this.clearRing();
      this.sfx('correct');
      tapRipple(this, bait.x, bait.y, bait.radius + 18, THEME.gold);
      this.ctx.services.audio.tone(320 + level.baits.indexOf(bait) * 70, 110);
      this.ctx.emit('beat:enter', { beatId: 'lure:bait:' + bait.id });
      this.ctx.emit('choice:made', {
        beatId: 'lure:bait',
        choiceId: bait.id,
        // "够不够久"就是这一关的唯一判断 —— 但选错了什么也不扣
        correct: bait.awayMs >= level.prize.needMs,
        latencyMs: t,
      });
      cfg.onPlaceBait?.(bait, this.api(t));
      this.redraw(t);
    }

    /** 递出去一块"砖"（真实操作与无头验证走的是同一条路） */
    private giveOffer(offer: LureOffer, t: number): void {
      if (this.level.mode !== 'trade') return;
      const level = this.level;
      const before = this.tradeState;
      const next = give(level, before, offer.id);
      if (next === before) return; // 不存在的"砖"：什么也不做
      this.tradeState = next;
      this.lastOffer = offer;
      this.lastReturn = next.lastReturn;
      this.lastTradeAt = t;
      this.idleMs = 0;
      this.hideHand();
      this.clearRing();
      this.sfx('correct');
      tapRipple(this, offer.x, offer.y, offer.radius + 16, THEME.gold);
      this.ctx.emit('beat:enter', { beatId: 'lure:give:' + offer.id });
      this.ctx.emit('choice:made', {
        beatId: 'lure:give',
        choiceId: offer.kind,
        // 挑错了只是再挑一次（不结束、不锁操作）—— correct 只用来复盘
        correct: (next.lastReturn?.value ?? 0) >= level.needed,
        latencyMs: t,
      });
      const back = next.lastReturn;
      // 换回来的东西不够值 / 没换到玉：这一块砖挑错了 —— 记一次 mistakes
      if (back !== null && back.value < level.needed) {
        recordAttempt(cfg.session, { ok: false });
      }
      if (back !== null) {
        sparkleAt(this, level.partner.x, level.partner.y - 120, THEME.gold, 6);
        cfg.onGive?.(offer, back, this.api(t));
      }
      this.redraw(t);
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.holding = false;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? LURE.finaleHoldMs,
        reveal: cfg.reveal,
        revealY: LURE.hintY,
        finalize: () => {
          if (this.level.mode === 'decoy') {
            sparkleAt(this, this.level.prize.x, this.level.prize.y - 60, THEME.gold, 10);
          } else {
            sparkleAt(this, this.level.partner.x, this.level.partner.y, THEME.gold, 12);
          }
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'lure:done' });
          this.redraw(this.now());
        }
      });
    }

    // ---------------- 小手与光圈 ----------------

    /**
     * 卡住时指哪儿：
     * - decoy：看守已经在路上 → 指箱子（"就是现在"）；一次都没试过 → 还是指箱子；
     *   试过了才指那个**够长**的诱饵点（前面的失败都值得）。
     * - trade：指还没递过的那一块，但**不说**哪块换回最多。
     */
    private pointAtNext(): void {
      if (this.finished) return;
      this.clearRing();

      if (this.level.mode === 'decoy') {
        const level = this.level;
        const prize = level.prize;
        if (isAway(level, this.decoyState, this.now())) {
          this.pointAt(prize.x, prize.y, prize.radius + LURE.grabRing - 4);
          return;
        }
        const bait = this.decoyState.usedBaits.length > 0 ? bestBait(level) : undefined;
        if (bait !== undefined) this.pointAt(bait.x, bait.y, bait.radius + 18);
        else this.pointAt(prize.x, prize.y, prize.radius + LURE.grabRing - 4);
        return;
      }

      const offer = nextOfferToGive(this.level, this.tradeState);
      if (offer !== undefined) this.pointAt(offer.x, offer.y, offer.radius + 16);
    }

    private pointAt(x: number, y: number, radius: number): void {
      const ring = this.add.graphics().setDepth(70);
      ring.setPosition(x, y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, radius);
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
      this.showHandAt(x, y + radius + 34);
    }

    private showHandAt(x: number, y: number): void {
      this.hideHand();
      this.hand = createHand(this, x, y, 1.05);
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

    private api(t: number): LureApi {
      return { scene: this, stage: this.stageState(t) };
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：
     * - decoy：先选**够长**的诱饵点，再一直按住箱子 —— 每一帧都由 tick 里的 grabAt 记账，
     *   与孩子真实操作走的是同一条路（只是"手指"一直在）。
     * - trade：直接递 value 最大的那一块砖（孩子得自己试出来，机器不用）。
     */
    private autoplayDecoy(t: number): void {
      if (this.level.mode !== 'decoy') return;
      const level = this.level;
      if (this.decoyState.baitId === null) {
        const bait = bestBait(level);
        if (bait !== undefined) this.placeBaitAt(bait, t);
      }
      this.holding = this.decoyState.baitId !== null && !isDecoyDone(level, this.decoyState);
    }

    private runAutoplay(): void {
      if (this.level.mode !== 'trade') return; // decoy 的按住由 tick 里的 autoplayDecoy 管
      this.time.addEvent({
        delay: LURE_TIMING.autoplayGiveMs,
        loop: true,
        callback: () => {
          if (this.finished || this.level.mode !== 'trade') return;
          if (isTradeDone(this.level, this.tradeState)) return;
          const offer = bestOffer(this.level);
          if (offer !== undefined) this.giveOffer(offer, this.now());
        },
      });
    }
  };
}

// ---------------- 第六辑 · 第 31 计 美人计（favor）：先看清他在意什么，再送对那一样 ----------------

/**
 * 美人计自己的布局与手感常量 —— 与 decoy / trade 的那一份（LURE）分开，
 * 免得新模式的几个数挤进老模式的常量里互相踩。
 * 那几个"看多久"（glanceMs / glanceOtherMs / glanceAwayMs）来自 lure.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const LURE_FAVOR = {
  /** 点礼物 / 点他的宽容度：手指粗也能点到 */
  tapForgive: 56,
  /**
   * 他头顶那根条：他的目光此刻停在哪一样上、还要停多久。
   * 高度是量过的：再高就压住提示气泡（气泡中心在 268），再低就碰到他的冕。
   */
  gazeBar: { w: 200, h: 24, aboveTarget: 110 },
  /** 被看着的那一样外面那圈金环离它多远 */
  gazeRing: 26,
  /** 刚递出去那一下：那一圈从多远处扩出去（收下 / 还回来都按它演） */
  offerRing: 70,
  /** 开局过一会儿就把小手放出来（不让孩子干等） */
  introHintMs: 1400,
  /** 多久没动静就把提示与小手放出来 */
  idleMs: FAVOR_TIMING.idleMs,
  /** 打动他之后看一眼再进典故卡 */
  finaleHoldMs: FAVOR_TIMING.finaleHoldMs,
  /** 提示气泡的高度 */
  hintY: FAVOR_TIMING.hintY,
} as const;

/**
 * 交给游戏画的 favor 那一半：他此刻在看哪一样、送出去的是哪一样、他收下了没有。
 * （怎么画"他""那几样东西""他看过去的那道目光"全在游戏包里。）
 */
export interface LureFavorStage {
  mode: 'favor';
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 他此刻在看哪一样东西（看着别处 = null）—— **这一关唯一的线索** */
  gaze: LureGift | null;
  /** 目光在这一样上还要停多久（画面上那根条按它走：停得越久，越说明他在意） */
  gazeLeftMs: number;
  /** 目光在这一样上原本要停多久 */
  gazeTotalMs: number;
  /** 递出去过的东西（按先后；送错的也在里面） */
  offered: string[];
  /** 刚刚递出去的是哪一样；还没递过 = null */
  lastGift: LureGift | null;
  /** 刚刚那一下他收下了没有；还没递过 = null */
  lastLoved: boolean | null;
  /** 刚刚那一下过去多久了 —— 表演按它衰减 */
  sinceOfferMs: number;
  /** 他收下过几次 */
  loved: number;
  /** 要送对几次才算打动他 */
  needed: number;
  /** 打动了几成（0..1） */
  ratio: number;
  /** 打动他了 */
  done: boolean;
}

export interface LureFavorApi {
  scene: Phaser.Scene;
  stage: LureFavorStage;
}

export interface LureFavorConfig {
  level: LureFavorLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：他坐在哪儿、屋里是什么样子 —— 画一次 */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: LureFavorLevel) => void;
  /** 每帧重画：他此刻在看哪一样、那几样东西、他手里收下了什么 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: LureFavorStage, level: LureFavorLevel) => void;
  /** 递出去那一下：他收下了（loved）还是把东西还了回来（refused）—— 由游戏包自己演 */
  onOffer?: (gift: LureGift, verdict: 'loved' | 'refused', api: LureFavorApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: LureFavorStage, level: LureFavorLevel) => void;
  /** 打动他之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/** 两个模式（老的两条路 + 新的一条）的配置合起来 —— createLureScene 按 level.mode 分派 */
export type LureAnyConfig = LureConfig | LureFavorConfig;

/**
 * 美人计：**先看清他最在意什么，再送对那一样**。
 *
 * 四条刻意的设计：
 * - **判定全在 lure.logic 里**：场景只把墙钟喂给 gazeAt / offerFavor，
 *   单测与画面用的是同一份"他的目光落在哪儿"—— 所以"看得出他在意什么"不靠美术、也不靠文案。
 * - **线索是看得见的**：他头顶那根条 + 被看着的那样东西外面那圈金环，都由同一个 gaze 画出来；
 *   停得最久的那一样就是他在意的（别的东西只被扫一眼就过去了）。
 * - **送错只是白送**：东西回到手里（refused），他说一句 refuseLine ——
 *   记进 mistakes、不结束、不锁操作，连"试过几样"都只是记账。
 * - **没有倒计时**：这一关考的是"看"，不是手快。孩子想看多久就看多久。
 */
export function createLureFavorScene(
  ctx: GameContext,
  cfg: LureFavorConfig,
): Phaser.Types.Scenes.SceneType {
  return class LureFavorScene extends BaseScene {
    private level: LureFavorLevel = cfg.level;
    private state: LureFavorState = favorStart();
    private startedAt = 0;
    private finished = false;
    private lastGift: LureGift | null = null;
    private lastLoved: boolean | null = null;
    private lastOfferAt = Number.NEGATIVE_INFINITY;
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.lure, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.lure });
      this.level = cfg.level;
      this.state = favorStart();
      this.startedAt = this.ctx.services.now();
      this.finished = false;
      this.lastGift = null;
      this.lastLoved = null;
      this.lastOfferAt = Number.NEGATIVE_INFINITY;
      this.idleMs = 0;
      this.ring = null;
      this.hand = null;

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(30);
      this.markGfx = this.add.graphics().setDepth(60);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(this.level.hint, 2600, LURE_FAVOR.hintY);
        this.time.delayedCall(LURE_FAVOR.introHintMs, () => this.pointAtNext());
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    /** 这一关没有"该动的时候"：每一帧只是把目光画出来，等他被送对那一次打动 */
    private tick(delta: number): void {
      const t = this.now();
      if (!this.finished) {
        this.idleMs += delta;
        if (this.idleMs >= LURE_FAVOR.idleMs) {
          this.idleMs = 0;
          this.showHint(this.level.hint, 2600, LURE_FAVOR.hintY);
          this.pointAtNext();
        }
        if (isFavorDone(this.level, this.state)) this.finish();
      }
      this.redraw(t);
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(t, stage);
      if (this.finished && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): LureFavorStage {
      const level = this.level;
      const gaze = gazeAt(level, t);
      return {
        mode: 'favor',
        elapsedMs: t,
        gaze: gaze.gift,
        gazeLeftMs: gaze.leftMs,
        gazeTotalMs: gaze.totalMs,
        offered: [...this.state.offered],
        lastGift: this.lastGift,
        lastLoved: this.lastLoved,
        sinceOfferMs:
          this.lastOfferAt === Number.NEGATIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : t - this.lastOfferAt,
        loved: favorsGiven(this.state),
        needed: level.needOffers,
        ratio: favorProgress(level, this.state),
        done: isFavorDone(level, this.state),
      };
    }

    /**
     * 判定之外那些"看得见"的：
     * - 他被看着的那样东西外面一圈金环 + 他头顶一根条 —— **停得最久的那一样就是他在意的**；
     * - 刚递出去那一下：收下了 = 金圈扩出去，还回来了 = 墨色的圈缩回来。
     */
    private drawMarks(t: number, stage: LureFavorStage): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const level = this.level;

      if (stage.gaze !== null && !stage.done) {
        const gift = stage.gaze;
        const ratio =
          stage.gazeTotalMs > 0
            ? Math.min(1, Math.max(0, stage.gazeLeftMs / stage.gazeTotalMs))
            : 0;
        // 那圈金环很轻地呼吸一下：他的目光正停在这一样上（越接近这一段末尾越淡）
        const pulse = 1 + 0.05 * Math.sin(t / 240);
        g.lineStyle(9, THEME.gold, 0.35 + 0.5 * ratio);
        g.strokeCircle(gift.x, gift.y, (gift.radius + LURE_FAVOR.gazeRing) * pulse);
        const { w, h, aboveTarget } = LURE_FAVOR.gazeBar;
        const x = level.target.x - w / 2;
        // 画在他头顶之上 —— 那是"他的目光"，不是他身上的一根血条
        const y = level.target.y - level.target.radius - aboveTarget;
        roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
        const fill = (w - 12) * ratio;
        if (fill > 6) {
          roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.gold, null, 0);
        }
      }

      // 打动了几成：他身边那圈金环（needOffers 次里收下了几次）
      if (!stage.done && stage.ratio > 0) {
        g.lineStyle(13, THEME.gold, 0.95);
        g.beginPath();
        g.arc(
          level.target.x,
          level.target.y,
          level.target.radius + 34,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * stage.ratio,
          false,
        );
        g.strokePath();
      }

      // 刚递出去那一下：东西从他面前出去，或者回到手里
      if (stage.lastGift !== null && stage.sinceOfferMs <= FAVOR_TIMING.offerFlashMs) {
        const p = 1 - stage.sinceOfferMs / FAVOR_TIMING.offerFlashMs;
        const color = stage.lastLoved === true ? THEME.gold : THEME.inkSoft;
        g.lineStyle(10, color, 0.85 * p);
        g.strokeCircle(
          stage.lastGift.x,
          stage.lastGift.y,
          stage.lastGift.radius + LURE_FAVOR.offerRing * (1 - p) + 10,
        );
      }
    }

    // ---------------- 点 ----------------

    private onDown(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.finished) return;
      const t = this.now();
      const gift = giftAt(this.level, pointer.x, pointer.y, LURE_FAVOR.tapForgive);
      if (gift !== undefined) this.giveGift(gift, t);
    }

    /**
     * 递出一样东西（真实操作与无头验证走的是同一条路）。
     * 送对 / 送错的判定只在 offerFavor 里，场景拿到的只是"他这一下的反应"。
     */
    private giveGift(gift: LureGift, t: number): void {
      const level = this.level;
      const verdict = offerFavor(level, this.state, gift.id);
      this.lastGift = gift;
      this.lastLoved = verdict === 'loved';
      this.lastOfferAt = t;
      this.idleMs = 0;
      this.hideHand();
      this.clearRing();
      this.ctx.emit('beat:enter', { beatId: 'lure:favor:' + gift.id });
      this.ctx.emit('choice:made', {
        beatId: 'lure:favor',
        choiceId: gift.kind,
        // 送错了只是东西回到手里（记进 mistakes）—— correct 只用来复盘
        correct: verdict === 'loved',
        latencyMs: t,
      });
      if (verdict === 'loved') {
        this.sfx('correct');
        tapRipple(this, gift.x, gift.y, gift.radius + 18, THEME.gold);
        sparkleAt(this, level.target.x, level.target.y - 120, THEME.gold, 6);
        this.showHint(gift.speak, 2600, LURE_FAVOR.hintY);
      } else {
        // 他把东西还了回来：不结束、不锁操作 —— 白送一次，这一下记进 mistakes
        recordAttempt(cfg.session, { ok: false });
        this.sfx('tap');
        tapRipple(this, gift.x, gift.y, gift.radius + 10, THEME.inkSoft);
        this.showHint(level.refuseLine, 2200, LURE_FAVOR.hintY);
      }
      cfg.onOffer?.(gift, verdict, this.api(t));
      this.redraw(t);
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? LURE_FAVOR.finaleHoldMs,
        sparkle: { x: this.level.target.x, y: this.level.target.y, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: LURE_FAVOR.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'lure:done' });
          this.redraw(this.now());
        }
      });
    }

    // ---------------- 小手与光圈 ----------------

    /**
     * 卡住时指哪儿（判定在 lure.logic 的 hintGift 里）：
     * 一次都没递过 → 指他**此刻正在看**的那一样（"看他在看什么"就是这个游戏的线索）；
     * 他正看着别处 → 指还没递过的那样；试过之后 → 指他最在意的那一样。
     */
    private pointAtNext(): void {
      if (this.finished) return;
      this.clearRing();
      const gift = hintGift(this.level, this.state, this.now());
      if (gift !== undefined) this.pointAt(gift.x, gift.y, gift.radius + 16);
    }

    private pointAt(x: number, y: number, radius: number): void {
      const ring = this.add.graphics().setDepth(70);
      ring.setPosition(x, y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, radius);
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
      this.showHandAt(x, y + radius + 34);
    }

    private showHandAt(x: number, y: number): void {
      this.hideHand();
      this.hand = createHand(this, x, y, 1.05);
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

    private api(t: number): LureFavorApi {
      return { scene: this, stage: this.stageState(t) };
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：机器不用"看"—— 直接送他最在意的那一样（孩子得自己从他的目光里看出来），
     * 而且走的是与孩子同一条 giveGift 的路（判定、记账、事件一个都不少）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: FAVOR_TIMING.autoplayOfferMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          if (isFavorDone(this.level, this.state)) return;
          const gift = wantedGift(this.level);
          if (gift !== undefined) this.giveGift(gift, this.now());
        },
      });
    }
  };
}

/**
 * 诱饵：**把他引开、先给一点点，或者先看清他在意什么**。
 *
 * 按 level.mode 分派到各自的场景。三条路共用同一条"零惩罚"的口径与同一套收尾流程
 * （结算 → 揭晓语 → 下一幕）；**decoy / trade（第 15 计调虎离山、第 17 计抛砖引玉）
 * 那条路径一个字没动** —— 它只是被 mode 判断包起来了（本文件里唯一被改到的一行，
 * 是那个函数的名字）。
 */
// 重载（而不是只写联合类型）：老模式那一份配置照旧**原样**收上下文类型 ——
// 游戏包里 drawWorld / drawStage 的参数不用手写类型，与扩展之前一字不差。
export function createLureScene(
  ctx: GameContext,
  cfg: LureConfig,
): Phaser.Types.Scenes.SceneType;
export function createLureScene(
  ctx: GameContext,
  cfg: LureFavorConfig,
): Phaser.Types.Scenes.SceneType;
export function createLureScene(
  ctx: GameContext,
  cfg: LureAnyConfig,
): Phaser.Types.Scenes.SceneType {
  if (isFavorConfig(cfg)) return createLureFavorScene(ctx, cfg);
  return createLureDecoyTradeScene(ctx, cfg);
}

/**
 * 两个模式的配置是"按关卡模式分"的联合类型。
 * 判别式藏在 cfg.level.mode 里（两层），所以显式写成类型守卫 ——
 * 这样每条分支里 cfg 的类型都收窄成对应模式那一份，不用强转。
 */
function isFavorConfig(cfg: LureAnyConfig): cfg is LureFavorConfig {
  return cfg.level.mode === 'favor';
}
