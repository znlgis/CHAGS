import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, createHand, sparkleAt, tapRipple, textStyle } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gatesLeft, hasPass, homeHit,
  isGateTaken, isPassDone, nextGate, returnHome, takeGate, takenCount,
} from './chain.logic';
import type { ChainState } from './chain.logic';
import type { ChainGate, ChainLevel } from './schemas';
import type { SessionState } from './session';

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
  /** 上一次"还轮不到这里"发生在什么时候（晃一下，不扣星） */
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
 * 连环：先谈成"借路"，再**按顺序**取下沿途关口，最后回师。
 *
 * 三条刻意的设计：
 * - **顺序就是这一关**：没借到路，一个关口也拿不了；前一个关口没拿下，后一个动不了。
 *   判定全在 chain.logic 里（只认"下一个"），场景只负责"手指落在哪儿"与画面。
 * - **点错零惩罚**：跳着点、回头点、还没借路就点关口 —— 都只是没进展（原样返回），
 *   不扣星、不结束、不锁操作；小手马上指出该动的下一处。
 * - **关口木牌上的字来自关卡脚本**（label 字段），双语由译文补丁给 ——
 *   模板不写死任何一句话。
 */
export function createChainScene(ctx: GameContext, cfg: ChainConfig): Phaser.Types.Scenes.SceneType {
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
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.time.delayedCall(CHAIN.envoyMs, () => this.pointAtNext());
    }

    /**
     * 取下一处关口：**只认"下一个"**。
     * 还没借路 / 跳着点 / 回头点已经拿下的 —— 都是原样返回，零惩罚。
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
      cfg.session.total += 1;
      cfg.session.correct += 1;
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
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.finish();
    }

    /** 还轮不到这里（零惩罚）：只是没进展，指一指该动的地方 */
    private rejected(x: number, y: number, id: string): void {
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
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.home.x, this.level.home.y, THEME.gold, 12);
      this.ctx.emit('beat:enter', { beatId: 'chain:done' });
      this.ctx.emit('choice:made', {
        beatId: 'chain:home',
        choiceId: 'home',
        correct: true,
        latencyMs: this.now(),
      });
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, CHAIN.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? CHAIN.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
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
