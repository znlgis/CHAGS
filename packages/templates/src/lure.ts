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
import type { SessionState } from './session';

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
 * - **零惩罚**：选错诱饵点只是白等一场，挑错砖只是再挑一次 —— 不扣星、不结束、不锁操作。
 */
export function createLureScene(ctx: GameContext, cfg: LureConfig): Phaser.Types.Scenes.SceneType {
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
        // 挑错了只是再挑一次（零惩罚）—— correct 只用来复盘
        correct: (next.lastReturn?.value ?? 0) >= level.needed,
        latencyMs: t,
      });
      const back = next.lastReturn;
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
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      if (this.level.mode === 'decoy') {
        sparkleAt(this, this.level.prize.x, this.level.prize.y - 60, THEME.gold, 10);
      } else {
        sparkleAt(this, this.level.partner.x, this.level.partner.y, THEME.gold, 12);
      }
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'lure:done' });
      this.redraw(this.now());
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, LURE.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? LURE.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
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
