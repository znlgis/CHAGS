import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import {
  BaseScene, CSS, THEME, createHand, roundRect, shade, sparkleAt, tapRipple, textStyle,
} from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gatesLeft, hasPass, homeHit,
  isGateTaken, isPassDone, nextGate, returnHome, takeGate, takenCount,
} from './chain.logic';
import type { ChainState } from './chain.logic';
// 第 30 计反客为主（step）的判定：与 pass 的那几个并列，互不影响
import {
  CHAIN_STEP_TIMING, askGrant, grantHit, grantLeftMs, isGranted, isPostTaken, isStepDone, nextPost,
  nextStep, postAt, stepStart, takeOver, takenPosts,
} from './chain.logic';
import type { StepState } from './chain.logic';
import type { ChainGate, ChainLevel, ChainStepLevel } from './schemas';
import type { ChainStepPost } from './chain.logic';
import { recordAttempt } from './session';
import type { SessionState } from './session';
// 第 35 计连环计（domino）的判定与类型：与 pass / step 那两段并列，互不影响
import {
  DOMINO_TIMING, advanceDomino, applyDomino, dominoPhaseAt, dominoStart, igniteChain, igniteHit,
  isDominoDone, linkAt, litCount, nextDominoMove, nextLink, settleDomino,
} from './chain.logic';
import type { ChainDominoLink, DominoState } from './chain.logic';
import type { ChainDominoLevel } from './schemas';

/**
 * step（反客为主）的岗位类型从逻辑层原样再导出一份：游戏包要用它给 `chainStepLevel()` 收窄返回类型，
 * 画面上也要按它摆木牌（与 window.ts 导出 StirWindowLevel 是同一个做法）。
 */
export type { ChainStepPost };

/**
 * 连环模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（envoyMs / gateMs / autoplayStepMs…）来自 chain.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const CHAIN = {
  ...CHAIN_TIMING,
  /** 点的宽容度：关口木牌不小，手指粗也点得到 */
  tapForgive: 46,
  /** 小手放在目标下面多少 */
  handDrop: 34,
  /** 提示光圈比目标大多少 */
  ringPad: 20,
  /** 点空时那圈涟漪亮多久 */
  rippleMs: 700,
  /** 关口木牌离关口的距离（画在关口的下面一点） */
  labelDrop: 12,
  /** 进度槽（拿下几处关口）画在底部 */
  progress: { x: 150, y: 1256, w: 450, h: 38 },
} as const;

/**
 * step（反客为主）那一半的节拍与画法常量 —— 节拍沿用 chain.logic 的 CHAIN_STEP_TIMING
 * （单测、画面与无头验证共用同一份），这里只补这一屏的画法常量。
 */
export const CHAIN_STEP = {
  ...CHAIN_STEP_TIMING,
  /** 点的宽容度：岗位木牌不小，手指粗也点得到（与 pass 的关口同一个数） */
  tapForgive: CHAIN.tapForgive,
  /** 小手放在目标下面多少 / 提示光圈比目标大多少 / 涟漪亮多久 / 木牌离岗位多远 */
  handDrop: CHAIN.handDrop,
  ringPad: CHAIN.ringPad,
  rippleMs: CHAIN.rippleMs,
  labelDrop: CHAIN.labelDrop,
  /** 求允许的那一处外面那圈比它大多少 */
  grantRingPad: 26,
  /** 允许的沙漏画在哪里（游戏包的 drawStage 用 chainStepGrantBar） */
  grantBar: { x: 150, y: 1256, w: 450, h: 44 },
  /** 进度槽（接手了几处岗位）画在顶部（游戏包的 drawStage 用 chainStepBar） */
  progress: { x: 150, y: 196, w: 450, h: 38 },
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface ChainStageState {
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 借到路了没有 */
  pass: boolean;
  /** 借路谈成的时刻；还没谈成就是 -1 */
  passAtMs: number;
  /** 按顺序拿下的关口 */
  taken: string[];
  /** 下一个该拿的关口；全拿下了就是 null */
  nextGate: ChainGate | null;
  /** 还剩下几处关口 */
  gatesLeft: number;
  /** 拿下了几处 / 一共几处 */
  takenCount: number;
  total: number;
  /** 回到自己的营地了没有 */
  home: boolean;
  /** 刚拿下的关口 / 什么时候拿下的（画一次"这里拿下了"的强调） */
  lastGateId: string | null;
  lastGateAtMs: number;
  /** 上一次"还轮不到这里"发生在什么时候（记进 mistakes 的那一下） */
  lastWrongAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 这一局成了 */
  done: boolean;
}

export interface ChainConfig {
  level: ChainLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：山路、谈借路的营帐、沿途关口、自己的营地（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ChainLevel) => void;
  /** 每帧重画：借路的旗、关口的旗号、回师的队伍 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ChainStageState, level: ChainLevel) => void;
  /** 收尾：关口下完了、人回来了之后的样子 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ChainStageState, level: ChainLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 连环（pass，第 24 计假道伐虢）：先谈成"借路"，再**按顺序**取下沿途关口，最后回师。
 *
 * 三条刻意的设计：
 * - **顺序就是这一关**：没借到路，一个关口也拿不了；前一个关口没拿下，后一个动不了。
 *   判定全在 chain.logic 里（只认"下一个"），场景只负责"手指落在哪儿"与画面。
 * - **点错也记账**：跳着点、回头点、还没借路就点关口 —— 都只是没进展（原样返回），
 *   记进 mistakes、不结束、不锁操作；小手马上指出该动的下一处。
 * - **关口木牌上的字来自关卡脚本**（label 字段），双语由译文补丁给 ——
 *   模板不写死任何一句话。
 *
 * 这一段是 **pass 那条路（一行没改）**，只是从 createChainScene 里挪成了一个具名函数；
 * step 那一半在文件末尾另起一段，由 mode 分派。
 */
function createPassChainScene(ctx: GameContext, cfg: ChainConfig): Phaser.Types.Scenes.SceneType {
  return class ChainScene extends BaseScene {
    private level: ChainLevel = cfg.level;
    private state: ChainState = chainStart();
    private startedAt = 0;
    private done = false;
    private idleMs = 0;
    private misses = 0;
    private lastGateId: string | null = null;
    private lastGateAt = -1;
    private lastWrongAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private labels: Phaser.GameObjects.Text[] = [];
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.chain, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.chain });
      this.level = cfg.level;
      this.state = chainStart();
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      // 关口木牌上的字：来自关卡脚本的 label（双语各一份），模板只负责摆位置
      this.labels = this.level.gates.map((gate) =>
        this.add
          .text(
            gate.x,
            gate.y + gate.radius + CHAIN.labelDrop,
            gate.label,
            textStyle(30, CSS.ink, true),
          )
          .setOrigin(0.5, 0)
          .setDepth(45),
      );
      this.markGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 3000, CHAIN.hintY);
        this.time.delayedCall(CHAIN.introHandMs, () => this.pointAtNext());
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      this.redraw(this.now());
      if (this.done) return;
      // 卡住了：把关卡自己的那句话再亮一遍，并指一指该动的地方
      this.idleMs += delta;
      if (this.idleMs >= CHAIN.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, CHAIN.hintY);
        this.pointAtNext();
      }
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      // 木牌上的字：拿下了的那几处暗下去（一眼看出走到哪儿了）
      this.labels.forEach((text, index) => {
        const gate = this.level.gates[index];
        if (gate === undefined) return;
        const taken = isGateTaken(this.state, gate.id);
        text.setAlpha(taken ? 0.5 : 1);
        text.setColor(taken ? CSS.tealDeep : CSS.ink);
      });
      this.drawMarks(stage);
      if (this.done && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): ChainStageState {
      return {
        elapsedMs: t,
        pass: hasPass(this.state),
        passAtMs: this.state.passAtMs,
        taken: [...this.state.taken],
        nextGate: nextGate(this.level, this.state) ?? null,
        gatesLeft: gatesLeft(this.level, this.state),
        takenCount: takenCount(this.state),
        total: this.level.gates.length,
        home: this.state.home,
        lastGateId: this.lastGateId,
        lastGateAtMs: this.lastGateAt,
        lastWrongAtMs: this.lastWrongAt,
        misses: this.misses,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：
     * 刚拿下的关口上往外扩的一圈金光、"还轮不到这里"的灰圈 ——
     * 关口本身的旗号（还没轮到 / 就是它 / 已经拿下）由 drawStage 画。
     */
    private drawMarks(stage: ChainStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const t = stage.elapsedMs;

      const gate = this.level.gates.find((item) => item.id === stage.lastGateId);
      const since = t - stage.lastGateAtMs;
      if (gate !== undefined && since >= 0 && since <= CHAIN.gateMs) {
        const p = since / CHAIN.gateMs;
        g.lineStyle(10, THEME.gold, 0.9 * (1 - p));
        g.strokeCircle(gate.x, gate.y, gate.radius + 16 + 56 * p);
        g.lineStyle(6, THEME.teal, 0.5 * (1 - p));
        g.strokeCircle(gate.x, gate.y, gate.radius + 44 + 74 * p);
      }

      if (stage.lastWrongAtMs >= 0 && t - stage.lastWrongAtMs <= 460) {
        const p = (t - stage.lastWrongAtMs) / 460;
        const wrong = stage.nextGate ?? this.level.envoy;
        g.lineStyle(7, THEME.inkSoft, 0.5 * (1 - p));
        g.strokeCircle(wrong.x, wrong.y, 56 + 90 * (1 - p));
      }
    }

    // ---------------- 点 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.done) return;
      const x = pointer.x;
      const y = pointer.y;
      const gate = gateAt(this.level, x, y, CHAIN.tapForgive);
      if (gate !== undefined) {
        this.pressGate(gate);
        return;
      }
      if (envoyHit(this.level, x, y, CHAIN.tapForgive)) {
        this.pressEnvoy();
        return;
      }
      if (homeHit(this.level, x, y, CHAIN.tapForgive)) {
        this.pressHome();
        return;
      }
      this.nothing(x, y);
    }

    /** 谈借路（真实操作与无头验证同一条路） */
    private pressEnvoy(): void {
      if (this.done) return;
      if (hasPass(this.state)) {
        this.nothing(this.level.envoy.x, this.level.envoy.y);
        return;
      }
      this.state = askPass(this.state, this.now());
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, this.level.envoy.x, this.level.envoy.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'chain:envoy' });
      this.ctx.emit('choice:made', {
        beatId: 'chain:envoy',
        choiceId: 'pass',
        correct: true,
        latencyMs: this.now(),
      });
      recordAttempt(cfg.session, { ok: true });
      this.time.delayedCall(CHAIN.envoyMs, () => this.pointAtNext());
    }

    /**
     * 取下一处关口：**只认"下一个"**。
     * 还没借路 / 跳着点 / 回头点已经拿下的 —— 都是原样返回：
     * 不结束、不锁操作，但这一下记进 mistakes（见 rejected）。
     */
    private pressGate(gate: ChainGate): void {
      if (this.done) return;
      const before = this.state;
      this.state = takeGate(this.level, this.state, gate.id);
      if (this.state === before) {
        this.rejected(gate.x, gate.y, gate.id);
        return;
      }
      this.lastGateId = gate.id;
      this.lastGateAt = this.now();
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, gate.x, gate.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'chain:gate:' + gate.id });
      this.ctx.emit('choice:made', {
        beatId: 'chain:gate',
        choiceId: gate.id,
        correct: true,
        latencyMs: this.now(),
      });
      recordAttempt(cfg.session, { ok: true });
      this.hideHand();
      this.time.delayedCall(CHAIN.gateMs, () => this.pointAtNext());
    }

    /** 回师：全部关口拿下之后才回得去 */
    private pressHome(): void {
      if (this.done) return;
      const before = this.state;
      this.state = returnHome(this.level, this.state, this.now());
      if (this.state === before) {
        this.rejected(this.level.home.x, this.level.home.y, 'home');
        return;
      }
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, this.level.home.x, this.level.home.y, THEME.gold, 8);
      this.ctx.emit('beat:enter', { beatId: 'chain:home' });
      recordAttempt(cfg.session, { ok: true });
      this.finish();
    }

    /** 还轮不到这里：不结束、不锁操作；这一下记进 mistakes（点了不该点的关口 / 还没借到路） */
    private rejected(x: number, y: number, id: string): void {
      recordAttempt(cfg.session, { ok: false });
      this.lastWrongAt = this.now();
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 48, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:reject:' + id });
      this.showHint(this.level.hint, 2200, CHAIN.hintY);
      this.pointAtNext();
    }

    /** 点了空处：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done || !isPassDone(this.level, this.state)) return;
      this.done = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? CHAIN.finaleHoldMs,
        sparkle: { x: this.level.home.x, y: this.level.home.y, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: CHAIN.hintY,
        finalize: () => {
          this.ctx.emit('beat:enter', { beatId: 'chain:done' });
          this.ctx.emit('choice:made', {
            beatId: 'chain:home',
            choiceId: 'home',
            correct: true,
            latencyMs: this.now(),
          });
        }
      });
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手放到"该动的那一处"：借路 → 下一个关口 → 回师 */
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
      ring.strokeCircle(0, 0, target.radius + CHAIN.ringPad);
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
      this.hand = createHand(this, target.x, target.y + target.radius + CHAIN.handDrop, 1.1);
    }

    private nextTarget(): { x: number; y: number; radius: number } | null {
      const step = chainStep(this.level, this.state);
      if (step === undefined) return null;
      if (step.kind === 'envoy') {
        return {
          x: this.level.envoy.x,
          y: this.level.envoy.y,
          radius: this.level.envoy.radius,
        };
      }
      if (step.kind === 'gate') {
        return { x: step.gate.x, y: step.gate.y, radius: step.gate.radius };
      }
      return { x: this.level.home.x, y: this.level.home.y, radius: this.level.home.radius };
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
      this.time.delayedCall(CHAIN.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：按这一关的顺序一步一步走 ——
     * 谈借路 → 一个一个关口 → 回师。走的是与孩子完全同一条路
     * （连"点在哪一处"都走一遍命中判定）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: CHAIN.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      const step = chainStep(this.level, this.state);
      if (step === undefined) return;
      if (step.kind === 'envoy') {
        this.pressEnvoy();
        return;
      }
      if (step.kind === 'gate') {
        this.pressGate(step.gate);
        return;
      }
      this.pressHome();
    }
  };
}

// ---------------- 画面用的两个小工具（口径与判定同一份，游戏包直接用） ----------------

/** 进度槽：拿下几处关口（0..total） */
export function chainProgressBar(
  g: Phaser.GameObjects.Graphics,
  level: ChainLevel,
  taken: number,
): void {
  const { x, y, w, h } = CHAIN.progress;
  g.fillStyle(THEME.card, 0.94);
  g.fillRoundedRect(x, y, w, h, h / 2);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeRoundedRect(x, y, w, h, h / 2);
  const inner = w - 12;
  const fill = (inner * Math.min(taken, level.gates.length)) / Math.max(1, level.gates.length);
  if (fill > 6) {
    g.fillStyle(THEME.teal, 1);
    g.fillRoundedRect(x + 6, y + 6, fill, h - 12, (h - 12) / 2);
  }
}

/** 这一处关口此刻是什么状态：还没轮到 / 就是它 / 已经拿下 */
export function chainGateMark(
  level: ChainLevel,
  state: ChainState,
  gateId: string,
): 'next' | 'taken' | 'later' {
  if (isGateTaken(state, gateId)) return 'taken';
  return nextGate(level, state)?.id === gateId ? 'next' : 'later';
}
/* ---------------- step：反客为主（第 30 计） ---------------- */

/**
 * step（反客为主）每一帧交给游戏画的一切：接手到哪儿了、手里那张允许还剩多久。
 * 画面完全由游戏决定（蜀道怎么画、队伍走到哪儿都是它的事），模板只管这一份数。
 */
export interface ChainStepMetrics {
  width: number;
  height: number;
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 按顺序接手的岗位（id，按下手的先后） */
  taken: string[];
  takenCount: number;
  total: number;
  /** 下一个该接手的岗位；全接手了就是 null */
  nextPost: ChainStepPost | null;
  /** 此刻这张允许还剩多久（没求过 / 过期了 / 用掉了 = 0） */
  grantLeftMs: number;
  /** 允许一次持续多久（关卡脚本里的 grantMs）—— 沙漏按它画 */
  grantMs: number;
  /** 此刻允许还有效吗 */
  granted: boolean;
  /** 一共求了几次允许（复盘用，不惩罚） */
  asks: number;
  /** 允许过期作废过几次（记进 mistakes 的那几笔） */
  lapses: number;
  /** 刚接手的那个岗位 / 什么时候接手的（画一次"这里接手了"的强调） */
  lastPostId: string | null;
  lastPostAtMs: number;
  /** 上一次"还轮不到这里 / 还没被允许"发生在什么时候（记进 mistakes 的那一下） */
  lastWrongAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 这一局成了 */
  done: boolean;
}

export interface ChainStepApi {
  scene: Phaser.Scene;
  stage: ChainStepMetrics;
}

/**
 * step（反客为主）这一路的配置。与 pass 的 `ChainConfig` 是两份 ——
 * pass 的字段一个字没动，多出来的这些只有 step 用得上。
 */
export interface ChainStepConfig {
  level: ChainStepLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：蜀道、关隘、城池与求允许的营帐（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ChainStepLevel) => void;
  /** 每帧重画：队伍走到哪儿、岗位上的旗、允许的沙漏 */
  drawStage: (
    g: Phaser.GameObjects.Graphics,
    stage: ChainStepMetrics,
    level: ChainStepLevel,
  ) => void;
  /** 求到允许的那一下（画面让对面点个头、递上名帖） */
  onGrant?: (api: ChainStepApi) => void;
  /** 收尾：四个岗位都接手之后的样子 */
  drawFinale?: (
    g: Phaser.GameObjects.Graphics,
    stage: ChainStepMetrics,
    level: ChainStepLevel,
  ) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/** 进度槽：接手了几处岗位（0..total）—— 游戏包的 drawStage 用它（口径与判定同一份） */
export function chainStepBar(
  g: Phaser.GameObjects.Graphics,
  level: ChainStepLevel,
  taken: number,
): void {
  const { x, y, w, h } = CHAIN_STEP.progress;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const total = Math.max(1, level.posts.length);
  const fill = ((w - 12) * Math.min(Math.max(0, taken), total)) / total;
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.teal, null, 0);
}

/** 允许的沙漏：这一次允许还剩多久 —— 游戏包的 drawStage 用它 */
export function chainStepGrantBar(
  g: Phaser.GameObjects.Graphics,
  level: ChainStepLevel,
  leftMs: number,
): void {
  const { x, y, w, h } = CHAIN_STEP.grantBar;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const ratio = Math.min(1, Math.max(0, leftMs / level.grantMs));
  const fill = (w - 12) * ratio;
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.gold, null, 0);
}

/**
 * 反客为主：每一步都要**先被允许**。
 *
 * 三条刻意的设计：
 * - **一步一问**：允许是一次性的 —— 求一次允许，在有效期内接下一处岗位，
 *   这次允许就用掉了，下一步要重新求。所以这一关的节奏是"求 → 接 → 再求"，
 *   急不得（第 30 计的落点恰恰是"一步一步来"）。
 * - **判定全在 chain.logic 里**：场景只把墙钟喂给 isGranted / takeOver，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **过期也记账**：允许过期只是没进展 —— 记进 mistakes、不结束、不锁操作；
 *   小手马上放回求允许的地方，重新求一次就好（lapses 只记一笔，用来复盘）。
 */
function createStepChainScene(
  ctx: GameContext,
  cfg: ChainStepConfig,
): Phaser.Types.Scenes.SceneType {
  return class ChainStepScene extends BaseScene {
    private level: ChainStepLevel = cfg.level;
    private state: StepState = stepStart();
    private startedAt = 0;
    private done = false;
    private idleMs = 0;
    private misses = 0;
    private lapses = 0;
    /** 手里这张允许还"活着"：过期的那一刻只记一笔，不重复记 */
    private grantAlive = false;
    private lastPostId: string | null = null;
    private lastPostAt = -1;
    private lastWrongAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private labels: Phaser.GameObjects.Text[] = [];
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.chain, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.chain });
      this.level = cfg.level;
      this.state = stepStart();
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      // 岗位木牌上的字：来自关卡脚本的 label（双语各一份），模板只负责摆位置
      this.labels = this.level.posts.map((post) =>
        this.add
          .text(
            post.x,
            post.y + post.radius + CHAIN_STEP.labelDrop,
            post.label,
            textStyle(30, CSS.ink, true),
          )
          .setOrigin(0.5, 0)
          .setDepth(45),
      );
      this.markGfx = this.add.graphics().setDepth(60);

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
        this.time.delayedCall(CHAIN_STEP.introHandMs, () => {
          this.showHint(cfg.level.hint, 3000, CHAIN_STEP.hintY);
          this.pointAtNext();
        });
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const t = this.now();
      if (!this.done) {
        // 允许过期：作废就作废 —— 记进 mistakes，把小手放回求允许的地方
        if (this.grantAlive && !isGranted(this.level, this.state, t)) {
          this.grantAlive = false;
          this.lapses += 1;
          this.ctx.emit('beat:enter', { beatId: 'chain:lapse:' + this.lapses });
          this.ctx.services.audio.tone(220, 180);
          this.showHint(cfg.level.hint, 2200, CHAIN_STEP.hintY);
          this.pointAtNext();
        }
        // 卡住了：把关卡自己的那句话再亮一遍，并指一指该动的地方
        this.idleMs += delta;
        if (this.idleMs >= CHAIN_STEP.idleMs) {
          this.idleMs = 0;
          this.showHint(this.level.hint, 2600, CHAIN_STEP.hintY);
          this.pointAtNext();
        }
      }
      this.redraw(t);
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      // 木牌上的字：接手了的那几处暗下去（一眼看出走到哪儿了）
      this.labels.forEach((text, index) => {
        const post = this.level.posts[index];
        if (post === undefined) return;
        const taken = isPostTaken(this.state, post.id);
        text.setAlpha(taken ? 0.5 : 1);
        text.setColor(taken ? CSS.tealDeep : CSS.ink);
      });
      this.drawMarks(stage);
      if (this.done && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): ChainStepMetrics {
      return {
        width: this.W,
        height: this.H,
        elapsedMs: t,
        taken: [...this.state.taken],
        takenCount: takenPosts(this.state),
        total: this.level.posts.length,
        nextPost: nextPost(this.level, this.state) ?? null,
        grantLeftMs: grantLeftMs(this.level, this.state, t),
        grantMs: this.level.grantMs,
        granted: isGranted(this.level, this.state, t),
        asks: this.state.asks,
        lapses: this.lapses,
        lastPostId: this.lastPostId,
        lastPostAtMs: this.lastPostAt,
        lastWrongAtMs: this.lastWrongAt,
        misses: this.misses,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：
     * 刚接手的岗位往外扩的一圈金光、"还轮不到这里 / 还没被允许"的灰圈 ——
     * 岗位本身的旗号（还没轮到 / 就是它 / 已经接手）由 drawStage 画。
     */
    private drawMarks(stage: ChainStepMetrics): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const t = stage.elapsedMs;

      const post = this.level.posts.find((item) => item.id === stage.lastPostId);
      const since = t - stage.lastPostAtMs;
      if (post !== undefined && since >= 0 && since <= CHAIN_STEP.takeoverMs) {
        const p = since / CHAIN_STEP.takeoverMs;
        g.lineStyle(10, THEME.gold, 0.9 * (1 - p));
        g.strokeCircle(post.x, post.y, post.radius + 16 + 56 * p);
        g.lineStyle(6, THEME.teal, 0.5 * (1 - p));
        g.strokeCircle(post.x, post.y, post.radius + 44 + 74 * p);
      }

      if (stage.lastWrongAtMs >= 0 && t - stage.lastWrongAtMs <= 460) {
        const p = (t - stage.lastWrongAtMs) / 460;
        const wrong = stage.nextPost ?? this.level.grant;
        g.lineStyle(7, THEME.inkSoft, 0.5 * (1 - p));
        g.strokeCircle(wrong.x, wrong.y, 56 + 90 * (1 - p));
      }
    }

    // ---------------- 点 ----------------

    private pressAt(x: number, y: number): void {
      if (this.done) return;
      this.idleMs = 0;
      const post = postAt(this.level, x, y, CHAIN_STEP.tapForgive);
      if (post !== undefined) {
        this.pressPost(post);
        return;
      }
      if (grantHit(this.level, x, y, CHAIN_STEP.tapForgive)) {
        this.pressGrant();
        return;
      }
      this.nothing(x, y);
    }

    /** 求允许（真实操作与无头验证同一条路）：允许从此刻起算，只持续关卡的 grantMs */
    private pressGrant(): void {
      if (this.done) return;
      const t = this.now();
      this.state = askGrant(this.state, t);
      this.grantAlive = true;
      this.idleMs = 0;
      this.sfx('unlock');
      sparkleAt(this, this.level.grant.x, this.level.grant.y, THEME.gold, 5);
      this.ctx.emit('beat:enter', { beatId: 'chain:grant:' + this.state.asks });
      cfg.onGrant?.({ scene: this, stage: this.stageState(t) });
      this.pointAtNext();
    }

    /**
     * 接手一处岗位：**只认"下一个岗位 + 允许有效"**。
     * 没求允许 / 允许过期 / 跳着点 / 回头点已经接手的 —— 都是原样返回：
     * 不结束、不锁操作，但这一下记进 mistakes（见 rejected）。
     */
    private pressPost(post: ChainStepPost): void {
      if (this.done) return;
      const t = this.now();
      const before = this.state;
      this.state = takeOver(this.level, this.state, post.id, t);
      if (this.state === before) {
        this.rejected(post.x, post.y, post.id);
        return;
      }
      this.lastPostId = post.id;
      this.lastPostAt = t;
      this.grantAlive = false; // 这次允许用掉了：下一步要重新求
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, post.x, post.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'chain:takeover:' + post.id });
      this.ctx.emit('choice:made', {
        beatId: 'chain:takeover',
        choiceId: post.id,
        correct: true,
        latencyMs: t,
      });
      recordAttempt(cfg.session, { ok: true });
      this.hideHand();
      this.redraw(t);
      if (isStepDone(this.level, this.state)) {
        this.finish();
        return;
      }
      this.pointAtNext();
    }

    /** 还轮不到这里 / 还没被允许：不结束、不锁操作；这一下记进 mistakes（点错了岗位 / 允许过期） */
    private rejected(x: number, y: number, id: string): void {
      recordAttempt(cfg.session, { ok: false });
      this.lastWrongAt = this.now();
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 48, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:reject:' + id });
      this.showHint(this.level.hint, 2200, CHAIN_STEP.hintY);
      this.pointAtNext();
    }

    /** 点了空处：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done || !isStepDone(this.level, this.state)) return;
      this.done = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? CHAIN_STEP.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: CHAIN_STEP.hintY,
        finalize: () => {
          this.ctx.emit('beat:enter', { beatId: 'chain:done' });
          this.ctx.emit('choice:made', {
            beatId: 'chain:takeover',
            choiceId: 'done',
            correct: true,
            latencyMs: this.now(),
          });
          this.redraw(this.now());
        }
      });
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手放到"该动的那一处"：先求允许；有允许了就接下下一个岗位 */
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
      ring.strokeCircle(0, 0, target.radius + target.pad);
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
      this.hand = createHand(this, target.x, target.y + target.radius + CHAIN_STEP.handDrop, 1.1);
    }

    private nextTarget(): { x: number; y: number; radius: number; pad: number } | null {
      const move = nextStep(this.level, this.state, this.now());
      if (move === undefined) return null;
      if (move.kind === 'grant') {
        return {
          x: this.level.grant.x,
          y: this.level.grant.y,
          radius: this.level.grant.radius,
          pad: CHAIN_STEP.grantRingPad,
        };
      }
      return {
        x: move.post.x,
        y: move.post.y,
        radius: move.post.radius,
        pad: CHAIN_STEP.ringPad,
      };
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
      this.time.delayedCall(CHAIN_STEP.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：求一次允许 → 在有效期内接下一处岗位 → 再求下一次 ——
     * 与孩子走的是同一条路（连"点在哪一处"都走一遍命中判定）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: CHAIN_STEP.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      const move = nextStep(this.level, this.state, this.now());
      if (move === undefined) return;
      if (move.kind === 'grant') {
        this.pressAt(this.level.grant.x, this.level.grant.y);
        return;
      }
      this.pressAt(move.post.x, move.post.y);
    }
  };
}

/* ---------------- domino：连环计（第 35 计） ---------------- */

/**
 * domino（连环计）每一帧交给游戏画的一切：点亮到第几环了、这一环还剩多久。
 * 画面完全由游戏决定（江面怎么画、船怎么连都是它的事），模板只管这一份数。
 */
export interface ChainDominoMetrics {
  width: number;
  height: number;
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 按顺序点亮的几环（id，按点亮的先后） */
  lit: string[];
  litCount: number;
  total: number;
  /** 下一环该点哪儿；全点亮了就是 null */
  nextLink: ChainDominoLink | null;
  /** 此刻这一环还剩多久（没起头 / 断了 / 全点亮了都是 0） */
  remainingMs: number;
  /** 一环点亮之后下一环的时限（关卡脚本里的 windowMs）—— 沙漏按它画 */
  windowMs: number;
  /** 此刻链子在走吗 */
  running: boolean;
  /** 起过头没有（断过也算 —— 复盘看的是这个过程） */
  ignited: boolean;
  /** 断了几次（记进 mistakes 的那几笔） */
  breaks: number;
  /** 起头了几次（重新起头也算） */
  ignites: number;
  /** 刚点亮的那一环 / 什么时候点亮的（画一次"这里接上了"的强调） */
  lastLinkId: string | null;
  lastLinkAtMs: number;
  /** 上一次"还轮不到这里"发生在什么时候（记进 mistakes 的那一下） */
  lastWrongAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 这一局成了 */
  done: boolean;
}

export interface ChainDominoApi {
  scene: Phaser.Scene;
  stage: ChainDominoMetrics;
}

/**
 * domino（连环计）这一路的配置 —— 与 pass 的 `ChainConfig`、step 的 `ChainStepConfig`
 * 是三份（各自的字段互不牵动），多出来的这些只有 domino 用得上。
 */
export interface ChainDominoConfig {
  level: ChainDominoLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：江面、铁索、连环的船团与岸边的火种（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ChainDominoLevel) => void;
  /** 每帧重画：哪几环亮着、铁索走到哪儿了、这一环还剩多久 */
  drawStage: (
    g: Phaser.GameObjects.Graphics,
    stage: ChainDominoMetrics,
    level: ChainDominoLevel,
  ) => void;
  /** 起头的那一下（画面让岸边的火种亮起来） */
  onIgnite?: (api: ChainDominoApi) => void;
  /** 收尾：四环全亮了之后的样子 */
  drawFinale?: (
    g: Phaser.GameObjects.Graphics,
    stage: ChainDominoMetrics,
    level: ChainDominoLevel,
  ) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/** 进度槽：点亮了几环（0..total）—— 游戏包的 drawStage 用它（口径与判定同一份） */
export function chainDominoBar(
  g: Phaser.GameObjects.Graphics,
  level: ChainDominoLevel,
  lit: number,
): void {
  const { x, y, w, h } = CHAIN_DOMINO.progress;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const total = Math.max(1, level.links.length);
  const fill = ((w - 12) * Math.min(Math.max(0, lit), total)) / total;
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.gold, null, 0);
}

/** 这一环的沙漏：还剩多久 —— 游戏包的 drawStage 用它 */
export function chainDominoWindowBar(
  g: Phaser.GameObjects.Graphics,
  level: ChainDominoLevel,
  leftMs: number,
): void {
  const { x, y, w, h } = CHAIN_DOMINO.windowBar;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const ratio = Math.min(1, Math.max(0, leftMs / level.windowMs));
  const fill = (w - 12) * ratio;
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.red, null, 0);
}

/** domino（连环计）那一半的画法与节拍常量（节拍沿用 chain.logic 的 DOMINO_TIMING） */
export const CHAIN_DOMINO = {
  ...DOMINO_TIMING,
  /** 点的宽容度：船团不小，手指粗也点得到（与 pass / step 同一个数） */
  tapForgive: CHAIN.tapForgive,
  /** 小手放在目标下面多少 / 提示光圈比目标大多少 / 涟漪亮多久 */
  handDrop: CHAIN.handDrop,
  ringPad: CHAIN.ringPad,
  rippleMs: CHAIN.rippleMs,
  /** 起头的那处（岸边的火种）外面那圈比它大多少 */
  igniteRingPad: 26,
  /** 这一环还剩多久 —— 沙漏画在底部（游戏包的 drawStage 用 chainDominoWindowBar） */
  windowBar: { x: 150, y: 1256, w: 450, h: 44 },
  /** 进度槽（点亮了几环）画在顶部（游戏包的 drawStage 用 chainDominoBar） */
  progress: { x: 150, y: 196, w: 450, h: 38 },
} as const;

/**
 * 连环计：环环相扣 —— 先点岸边的火种起头，再**按顺序**一环一环点亮。
 *
 * 三条刻意的设计：
 * - **顺序就是这一关**：没起头，点哪一环都没反应；起头之后只认"下一环"，
 *   顺序点错和不点一样，只是没反应。判定全在 chain.logic 里，场景只把墙钟喂给它。
 * - **一环接一环**：每一环点亮之后，下一环要在关卡的 windowMs 之内点上 ——
 *   超时链子就断了，**从起头重来**（记进 mistakes，只记一笔 break）。所以这一关的节奏是
 *   "快而不乱"：急，但每一步都得落在点上（第 35 计的落点）。
 * - **断了也记账**：记进 mistakes、不结束、不锁操作；断的那一刻只播一句关卡自己的 breakLine，
 *   小手马上放回起头的地方，重新点一次就好。breaks 只用来复盘。
 */
function createDominoChainScene(
  ctx: GameContext,
  cfg: ChainDominoConfig,
): Phaser.Types.Scenes.SceneType {
  return class ChainDominoScene extends BaseScene {
    private level: ChainDominoLevel = cfg.level;
    private state: DominoState = dominoStart();
    private startedAt = 0;
    private done = false;
    private idleMs = 0;
    private misses = 0;
    private lastLinkId: string | null = null;
    private lastLinkAt = -1;
    private lastWrongAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.chain, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.chain });
      this.level = cfg.level;
      this.state = dominoStart();
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(60);

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
        this.time.delayedCall(CHAIN_DOMINO.introHandMs, () => {
          this.showHint(cfg.level.hint, 3000, CHAIN_DOMINO.hintY);
          this.pointAtNext();
        });
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const t = this.now();
      if (!this.done) {
        // 链子断了：落账（回到"还没起头"，记一笔 break 与 mistakes）—— 每一帧都调，只记一次
        const settled = settleDomino(this.level, this.state, t);
        if (settled !== this.state) {
          this.state = settled;
          // 没在时限里接上这一环：记一次做错（不结束、不锁操作，重新起头就是）
          recordAttempt(cfg.session, { ok: false });
          this.ctx.emit('beat:enter', { beatId: 'chain:break:' + this.state.breaks });
          this.ctx.services.audio.tone(240, 200);
          this.showHint(cfg.level.breakLine, 2600, CHAIN_DOMINO.hintY);
          this.pointAtNext();
        }
        // 卡住了：把关卡自己的那句话再亮一遍，并指一指该动的地方
        this.idleMs += delta;
        if (this.idleMs >= CHAIN_DOMINO.idleMs) {
          this.idleMs = 0;
          this.showHint(this.level.hint, 2600, CHAIN_DOMINO.hintY);
          this.pointAtNext();
        }
      }
      this.redraw(t);
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

    private stageState(t: number): ChainDominoMetrics {
      const phase = dominoPhaseAt(this.level, this.state, t);
      return {
        width: this.W,
        height: this.H,
        elapsedMs: t,
        lit: [...this.state.lit],
        litCount: litCount(this.state),
        total: this.level.links.length,
        nextLink: nextLink(this.level, this.state) ?? null,
        remainingMs: phase.remainingMs,
        windowMs: this.level.windowMs,
        running: phase.running,
        ignited: this.state.ignited,
        breaks: this.state.breaks,
        ignites: this.state.ignites,
        lastLinkId: this.lastLinkId,
        lastLinkAtMs: this.lastLinkAt,
        lastWrongAtMs: this.lastWrongAt,
        misses: this.misses,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：
     * 刚点亮的那一环往外扩的一圈火光、"还轮不到这里"的灰圈 ——
     * 环本身的火（亮着 / 就是它 / 还没轮到）由 drawStage 画。
     */
    private drawMarks(stage: ChainDominoMetrics): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const t = stage.elapsedMs;

      const link = this.level.links.find((item) => item.id === stage.lastLinkId);
      const since = t - stage.lastLinkAtMs;
      if (link !== undefined && since >= 0 && since <= CHAIN_DOMINO.linkMs) {
        const p = since / CHAIN_DOMINO.linkMs;
        g.lineStyle(10, THEME.gold, 0.9 * (1 - p));
        g.strokeCircle(link.x, link.y, link.radius + 16 + 56 * p);
        g.lineStyle(6, THEME.red, 0.5 * (1 - p));
        g.strokeCircle(link.x, link.y, link.radius + 44 + 74 * p);
      }

      if (stage.lastWrongAtMs >= 0 && t - stage.lastWrongAtMs <= 460) {
        const p = (t - stage.lastWrongAtMs) / 460;
        const wrong = stage.nextLink ?? this.level.ignite;
        g.lineStyle(7, THEME.inkSoft, 0.5 * (1 - p));
        g.strokeCircle(wrong.x, wrong.y, 56 + 90 * (1 - p));
      }
    }

    // ---------------- 点 ----------------

    private pressAt(x: number, y: number): void {
      if (this.done) return;
      this.idleMs = 0;
      const link = linkAt(this.level, x, y, CHAIN_DOMINO.tapForgive);
      if (link !== undefined) {
        this.pressLink(link);
        return;
      }
      if (igniteHit(this.level, x, y, CHAIN_DOMINO.tapForgive)) {
        this.pressIgnite();
        return;
      }
      this.nothing(x, y);
    }

    /** 起头（真实操作与无头验证同一条路）：链子从第一环重新走，时限从此刻起算 */
    private pressIgnite(): void {
      if (this.done) return;
      const t = this.now();
      const before = this.state;
      this.state = igniteChain(this.level, this.state, t);
      if (this.state === before) return; // 已经全点亮了：这一局不再重来
      this.idleMs = 0;
      this.sfx('unlock');
      sparkleAt(this, this.level.ignite.x, this.level.ignite.y, THEME.gold, 5);
      this.ctx.emit('beat:enter', { beatId: 'chain:ignite:' + this.state.ignites });
      cfg.onIgnite?.({ scene: this, stage: this.stageState(t) });
      this.pointAtNext();
    }

    /**
     * 点亮一环：**只认"下一环 + 还在时限里"**。
     * 没起头 / 不是这一环 / 已经断了 —— 都不结束、不锁操作：前两种只是没进展
     * （点错顺序记进 mistakes），断了就回起头重来（场景提示 breakLine 的那一句）。
     */
    private pressLink(link: ChainDominoLink): void {
      if (this.done) return;
      const t = this.now();
      const verdict = advanceDomino(this.level, this.state, link.id, t);
      if (verdict !== 'ok') {
        this.state = applyDomino(this.level, this.state, link.id, t);
        if (verdict === 'expired') {
          this.broken(link);
        } else {
          // 'wrong'：点错了顺序（跳着点 / 回头点 / 不是这一环）—— 记一次做错；
          // 'notStarted'：还没起头，点哪一环都没反应，不算（探索性点击）
          if (verdict === 'wrong') recordAttempt(cfg.session, { ok: false });
          this.rejected(link);
        }
        return;
      }
      this.state = applyDomino(this.level, this.state, link.id, t);
      this.lastLinkId = link.id;
      this.lastLinkAt = t;
      this.idleMs = 0;
      this.sfx('correct');
      sparkleAt(this, link.x, link.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'chain:light:' + link.id });
      this.ctx.emit('choice:made', {
        beatId: 'chain:light',
        choiceId: link.id,
        correct: true,
        latencyMs: t,
      });
      recordAttempt(cfg.session, { ok: true });
      this.hideHand();
      this.redraw(t);
      if (isDominoDone(this.level, this.state)) {
        this.finish();
        return;
      }
      this.pointAtNext();
    }

    /** 链子断了：不结束、不锁操作；这一下记进 mistakes（点晚了，没在时限里接上） */
    private broken(link: ChainDominoLink): void {
      // 同一个 break 只会走到这里一次：计时断链由 tick 的 settleDomino 落账，这里只处理"点晚了"
      recordAttempt(cfg.session, { ok: false });
      this.idleMs = 0;
      this.ctx.services.audio.tone(240, 200);
      this.ripple(link.x, link.y, 52, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:break:' + this.state.breaks });
      this.showHint(this.level.breakLine, 2600, CHAIN_DOMINO.hintY);
      this.pointAtNext();
    }

    /** 还轮不到这一环：只是没进展（点错顺序在 pressLink 里记账），指一指该动的地方 */
    private rejected(link: ChainDominoLink): void {
      this.lastWrongAt = this.now();
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(link.x, link.y, 48, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:reject:' + link.id });
      this.showHint(this.level.hint, 2200, CHAIN_DOMINO.hintY);
      this.pointAtNext();
    }

    /** 点了空处：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.ctx.emit('beat:enter', { beatId: 'chain:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done || !isDominoDone(this.level, this.state)) return;
      this.done = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? CHAIN_DOMINO.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: cfg.reveal,
        revealY: CHAIN_DOMINO.hintY,
        finalize: () => {
          this.ctx.emit('beat:enter', { beatId: 'chain:domino:done' });
          this.ctx.emit('choice:made', {
            beatId: 'chain:light',
            choiceId: 'done',
            correct: true,
            latencyMs: this.now(),
          });
          this.redraw(this.now());
        }
      });
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手放到"该动的那一处"：链子没在走就去起头，走着就点亮下一环 */
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
      ring.strokeCircle(0, 0, target.radius + target.pad);
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
      this.hand = createHand(this, target.x, target.y + target.radius + CHAIN_DOMINO.handDrop, 1.1);
    }

    private nextTarget(): { x: number; y: number; radius: number; pad: number } | null {
      const move = nextDominoMove(this.level, this.state, this.now());
      if (move === undefined) return null;
      if (move.kind === 'ignite') {
        return {
          x: this.level.ignite.x,
          y: this.level.ignite.y,
          radius: this.level.ignite.radius,
          pad: CHAIN_DOMINO.igniteRingPad,
        };
      }
      return {
        x: move.link.x,
        y: move.link.y,
        radius: move.link.radius,
        pad: CHAIN_DOMINO.ringPad,
      };
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
      this.time.delayedCall(CHAIN_DOMINO.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：起头 → 一环一环点亮 —— 与孩子走的是同一条路
     * （连"点在哪一环上"都走一遍命中判定）。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: CHAIN_DOMINO.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      const move = nextDominoMove(this.level, this.state, this.now());
      if (move === undefined) return;
      if (move.kind === 'ignite') {
        this.pressAt(this.level.ignite.x, this.level.ignite.y);
        return;
      }
      this.pressAt(move.link.x, move.link.y);
    }
  };
}

/**
 * 连环：两种玩法共用一个场景键（SCENE_KEYS.chain），按 level.mode 分派。
 * - pass（假道伐虢）：借路 → 按顺序过关口 → 回师 —— 既有路径，一行未改；
 * - step（反客为主）：求一次允许，在有效期内接下一处岗位 —— 一步一步来，急不得。
 */
// 两个重载 + 一个并集的实现：老模式的调用处（传的是内联箭头函数）由第一个重载
// 做上下文类型推导，不用担心并集让回调参数变成 any —— 既有游戏包一行都不用改。
export function createChainScene(
  ctx: GameContext,
  cfg: ChainConfig,
): Phaser.Types.Scenes.SceneType;
export function createChainScene(
  ctx: GameContext,
  cfg: ChainStepConfig,
): Phaser.Types.Scenes.SceneType;
// domino（连环计）：第三种玩法也挂在这个场景键上，按 level.mode 分派（pass / step 两条路径一行未改）。
export function createChainScene(
  ctx: GameContext,
  cfg: ChainDominoConfig,
): Phaser.Types.Scenes.SceneType;
export function createChainScene(
  ctx: GameContext,
  cfg: ChainConfig | ChainStepConfig | ChainDominoConfig,
): Phaser.Types.Scenes.SceneType {
  // domino 先判：pass / step 的两行判定一个字没动（domino 的 level 有自己的 ignite / links 字段）
  if (cfg.level.mode === 'domino') return createDominoChainScene(ctx, cfg as ChainDominoConfig);
  if (cfg.level.mode === 'step') return createStepChainScene(ctx, cfg as ChainStepConfig);
  return createPassChainScene(ctx, cfg as ChainConfig);
}
