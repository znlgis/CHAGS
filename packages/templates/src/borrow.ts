import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  borrowStart, canLift, connectProp, disconnectProp, hasFulcrum, isBorrowDone,
  nextPropToConnect, propAt, pull, selfPower, suggestedConnections, totalPower,
} from './borrow.logic';
import type { BorrowState } from './borrow.logic';
import type { BorrowLevel, BorrowProp } from './schemas';
import type { SessionState } from './session';

/** borrow 模板自己的常量：不进 layout.ts，也不跟别的模板互相踩 */
export const BORROW = {
  /** 点绳子 / 点东西的命中宽容度 */
  tapForgive: 56,
  /** 点重物的命中宽容度：石头很大，不用再放宽多少 */
  loadForgive: 20,
  /** 绳子垂下去多少（画绳子用） */
  ropeSag: 96,
  /** 抬起来之后先看一眼，再去收尾 */
  liftHoldMs: 900,
  /** 多久没动静就把小手放到下一件该连的东西（或重物）上 */
  idleMs: 9000,
  finaleHoldMs: 2600,
  /** 无头验证：起手停顿、每连一件的节拍 */
  autoplayLeadMs: 200,
  autoplayStepMs: 460,
} as const;

/** 每一帧交给游戏画的一切 */
export interface BorrowStageMetrics {
  width: number;
  height: number;
  /** 已经连上绳子的东西 id */
  connected: string[];
  /** 连上来的力加起来 */
  totalPower: number;
  /** 需要多少力 */
  needed: number;
  /** 有没有垫脚的地方 */
  hasFulcrum: boolean;
  /** 力够不够（够就该去点重物了） */
  canLift: boolean;
  /** 石头此刻离地了吗 */
  lifted: boolean;
  /** 点了几次重物（"纹丝不动"也算） */
  tries: number;
  /** 光靠自己有多少力 */
  selfPower: number;
}

export interface BorrowApi {
  scene: Phaser.Scene;
}

export interface BorrowConfig {
  level: BorrowLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏标题；不传就用内容自己的标题（ctx.content 已按语言翻译） */
  titleKey?: MessageKey;
  /** 整屏画面：工地、大石、木棍、水车、老牛、绳子都按 metrics 画 */
  drawStage: (g: Phaser.GameObjects.Graphics, stage: BorrowStageMetrics) => void;
  /** 点重物之后：'stuck' 是纹丝不动，'lifted' 是抬起来了 */
  onPull?: (stage: BorrowStageMetrics, result: 'lifted' | 'stuck', api: BorrowApi) => void;
  /** 连上 / 解开一件东西 */
  onTie?: (prop: BorrowProp, tied: boolean, api: BorrowApi) => void;
  /** 每帧回调 */
  onFrame?: (stage: BorrowStageMetrics, delta: number) => void;
  /** 抬起来的收尾表现 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, stage: BorrowStageMetrics) => void;
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * 借力：自己推不动的重物，把绳子连到别的东西上，借它们的力一起抬。
 *
 * 三条刻意的设计：
 * - **自己的力气写在关卡里**：self 只有 1 点力，needed 是 30 —— 光靠自己永远不够，
 *   这不是台词，是算得出来的。
 * - **支点也算一份**：没有垫脚的地方，力再大也抬不起来（杠杆得有个撑点）。
 * - **可以反悔**：连错了解开就是；借力成功之前点重物只会"纹丝不动"，不惩罚。
 */
export function createBorrowScene(ctx: GameContext, cfg: BorrowConfig): Phaser.Types.Scenes.SceneType {
  return class BorrowScene extends BaseScene {
    private state: BorrowState = borrowStart();
    private finished = false;
    private busy = false;
    private idleMs = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.borrow, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.borrow });
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 输入 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.busy) return;
      // 东西优先：石头很大，压在它旁边的东西也得点得到
      const prop = propAt(pointer.x, pointer.y, cfg.level, BORROW.tapForgive);
      if (prop) {
        this.toggle(prop);
        return;
      }
      const { load } = cfg.level;
      if (Math.hypot(pointer.x - load.x, pointer.y - load.y) <= load.radius + BORROW.loadForgive) {
        this.pullLoad();
      }
    }

    /** 连上绳子 / 解开绳子 */
    private toggle(prop: BorrowProp): void {
      if (this.finished || this.busy) return;
      const tied = this.state.connected.includes(prop.id);
      this.state = tied
        ? disconnectProp(cfg.level, this.state, prop.id)
        : connectProp(cfg.level, this.state, prop.id);
      this.idleMs = 0;
      this.sfx(tied ? 'tap' : 'unlock');
      this.ctx.emit('beat:enter', {
        beatId: (tied ? 'borrow:untie:' : 'borrow:connect:') + prop.id,
      });
      cfg.onTie?.(prop, !tied, { scene: this });

      // 力够了：把小手放到石头上 —— 该拉一把了（不写字，用图形说）
      if (canLift(cfg.level, this.state.connected)) {
        if (!tied) sparkleAt(this, prop.x, prop.y, THEME.gold, 5);
        this.pointAtLoad();
      } else {
        // 还没够：把上一次的提示收掉 —— 卡住了（idle）小手自然会再出现，别一直指着
        this.clearRing();
        this.hideHand();
      }
      this.redraw();
    }

    /** 点重物：力够了才抬得起来 */
    private pullLoad(): void {
      if (this.finished || this.busy) return;
      const { load } = cfg.level;
      const result = pull(cfg.level, this.state);
      this.state = result.state;
      this.idleMs = 0;
      const stage = this.metrics();

      if (result.result === 'stuck') {
        // 纹丝不动：不惩罚，把该找的东西指出来
        this.sfx('wrong');
        this.cameras.main.shake(80, 0.002);
        sparkleAt(this, load.x, load.y + load.radius, THEME.stone, 4);
        this.showHint(cfg.level.hint);
        this.ctx.emit('beat:enter', { beatId: 'borrow:stuck' });
        cfg.onPull?.(stage, 'stuck', { scene: this });
        if (canLift(cfg.level, this.state.connected)) this.pointAtLoad();
        else this.pointAtNextProp();
        this.redraw();
        return;
      }

      this.lift(stage);
    }

    // ---------------- 抬起来 ----------------

    private lift(stage: BorrowStageMetrics): void {
      // 抬起来之后绳子就不能再解了：这是收尾，不是还在试
      this.busy = true;
      this.clearRing();
      this.hideHand();
      this.sfx('unlock');
      this.cameras.main.flash(240, 255, 240, 200);
      sparkleAt(this, cfg.level.load.x, cfg.level.load.y - 60, THEME.gold, 10);
      this.ctx.emit('beat:enter', { beatId: 'borrow:lifted' });
      cfg.onPull?.(stage, 'lifted', { scene: this });
      this.redraw();
      this.time.delayedCall(BORROW.liftHoldMs, () => this.finish());
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, cfg.level.load.x, cfg.level.load.y, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'borrow:done' });
      this.redraw();
      if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx, this.metrics());
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, cfg.revealY ?? 300));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? BORROW.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 画面 ----------------

    private metrics(): BorrowStageMetrics {
      const { connected } = this.state;
      return {
        width: this.W,
        height: this.H,
        connected: [...connected],
        totalPower: totalPower(cfg.level, connected),
        needed: cfg.level.needed,
        hasFulcrum: hasFulcrum(cfg.level, connected),
        canLift: canLift(cfg.level, connected),
        // 石头是被连着的力托着的：解开一根就落回去（isLifted 就是这个判定）
        lifted: isBorrowDone(cfg.level, this.state),
        tries: this.state.tries,
        selfPower: selfPower(cfg.level),
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawStage(this.stageGfx, this.metrics());
    }

    private tick(delta: number): void {
      if (!this.finished) {
        cfg.onFrame?.(this.metrics(), delta);
        this.idleMs += delta;
        if (this.idleMs >= BORROW.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint);
          if (canLift(cfg.level, this.state.connected)) this.pointAtLoad();
          else this.pointAtNextProp();
        }
      }
      this.redraw();
    }

    private pointAtNextProp(): void {
      const prop = nextPropToConnect(cfg.level, this.state.connected);
      if (!prop) {
        this.pointAtLoad();
        return;
      }
      this.pointAt(prop.x, prop.y, prop.radius);
    }

    private pointAtLoad(): void {
      const { load } = cfg.level;
      this.pointAt(load.x, load.y, load.radius);
    }

    private pointAt(x: number, y: number, radius: number): void {
      this.clearRing();
      this.hideHand();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(x, y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, radius + 26);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hand = createHand(this, x, y + radius + 30, 1.15);
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

    /** 先垫支点、再一件件借力，最后点重物 —— 与真实操作走的是同一条路 */
    private runAutoplay(): void {
      const plan = suggestedConnections(cfg.level);
      plan.forEach((propId, index) => {
        this.time.delayedCall(BORROW.autoplayLeadMs + index * BORROW.autoplayStepMs, () => {
          const prop = cfg.level.props.find((item) => item.id === propId);
          if (prop) this.toggle(prop);
        });
      });
      this.time.delayedCall(
        BORROW.autoplayLeadMs + plan.length * BORROW.autoplayStepMs + 200,
        () => this.pullLoad(),
      );
    }
  };
}
