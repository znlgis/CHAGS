import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  frontGain, frontTap, isRelieved, isSiegeDone, nextVital, relieve, resistanceOf,
  siegeProgress, siegeStart, tapsToFinish, vitalAt,
} from './siege.logic';
import {
  baseLog, closeExit, closeProgress, closeStart, closedCount, closedExits, closingExit,
  closingRatio, escapeExit, escapeLeftMs, exitAt, fireLevel, hasEscaped, isCloseDone, isPulled,
  isSupportDone, logAt, nextExitToClose, nextLogToPull, pullLog, standingCount, supportProgress,
  supportStart,
} from './siege.logic';
import type { CloseState, SiegeExit, SiegeState, SupportState } from './siege.logic';
// ladder（上屋抽梯）：第五辑给 siege 加的第三个模式 —— 判定同样在 siege.logic 里
import {
  allRungsBuilt, buildRung, builtCount, climbRatio, isLadderDone, ladderAt, ladderPhase,
  ladderProgress, ladderStart, nextRung, pullLadder, rungAt,
} from './siege.logic';
import type { LadderPhase, LadderState, SiegeRung } from './siege.logic';
import type {
  SiegeCloseLevel, SiegeLadderLevel, SiegeLevel, SiegeLog, SiegeSupportLevel, SiegeVital,
} from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

/** siege 模板自己的常量：不进 layout.ts，也不跟别的模板互相踩 */
export const SIEGE = {
  /** 点要害 / 推正面的命中宽容度：小朋友手指粗，判定要比图形大 */
  tapForgive: 56,
  /** 两次推正面之间的最小间隔：一下是一下，连点也别糊成一片 */
  tapCooldownMs: 70,
  /** 阻力还没降下来时，每推这么多下再提醒一次该去哪儿 */
  tapHintEvery: 10,
  /** 点中要害之后的停顿（让孩子看清"兵马回防"） */
  relieveHoldMs: 620,
  /** 多久没动静就把小手放到下一处要害上 */
  idleMs: 9000,
  /** 解围之后看多久再进下一幕 */
  finaleHoldMs: 2600,
  /** 无头验证：起手停顿、点要害的节拍、推正面的节拍 */
  autoplayLeadMs: 240,
  autoplayStepMs: 420,
  autoplayTapMs: 90,

  /* ---- 第 19 计釜底抽薪（support）：把火底下的柴一根根抽走 ---- */
  /** 抽掉一根柴的那一下（柴被拖出去、火也小一圈） */
  pullHoldMs: 900,
  /** 无头验证：抽柴的节拍（够画面把上一根演完） */
  autoplayPullMs: 620,

  /* ---- 第 22 计关门捉贼（close）：抢在贼跑掉之前把出口都关上 ---- */
  /** 贼跑掉的那一段演出（他从门口跑出去要走多久） */
  escapeRunMs: 1500,
  /** 演完之后停多久再重来（零惩罚，但要让孩子看清他从哪个口子跑的） */
  escapeHoldMs: 2600,
  /** 无头验证：排门的节拍（点得快也没关系，每一下都排进队里） */
  autoplayCloseMs: 380,

  /* ---- 两条新模式共用的开场节奏 ---- */
  /** 开局过一会儿就把这一关的提示放上去（不让孩子干等） */
  introHintMs: 700,
  /** 再等一会儿，把小手放到该动的那一处 */
  introHandMs: 1500,
} as const;

/** 每一帧交给游戏画的一切（画面完全由游戏决定，模板只管数值与手感） */
export interface SiegeStageMetrics {
  width: number;
  height: number;
  /** 正面推进到多少了 */
  progress: number;
  /** 推到这个数就解围 */
  goal: number;
  /** 0..1：进度条按它画 */
  ratio: number;
  /** 现在的阻力：初始阻力减掉已回防的要害 */
  resistance: number;
  /** 已回防的要害 id */
  relieved: string[];
  /** 下一次推正面的增量（阻力大 = 推不动） */
  gain: number;
  /** 还差几下正面 */
  tapsLeft: number;
  /** 一共推了几下 */
  taps: number;
  done: boolean;
}

/**
 * support（釜底抽薪）每一帧交给游戏画的一切：
 * 火势、抽掉了哪几根柴、刚抽走的是哪一根 —— 画面完全由游戏决定。
 */
export interface SiegeSupportMetrics {
  width: number;
  height: number;
  /** 这一局过了多久（墙钟，从开局算起）—— 火焰、烟与小手都按它摆 */
  elapsedMs: number;
  /** 火势还剩多少；0 = 火灭了 */
  fireLevel: number;
  /** 开局的火势（关卡脚本里写的那个数） */
  fireMax: number;
  /** 0..1：灭火的进度（火势到 0 就是 1）—— 进度条按它画 */
  ratio: number;
  /** 已经抽掉的柴，按抽走的先后 */
  pulled: string[];
  /** 一共几根柴 / 还架在火底下的有几根 */
  total: number;
  standing: number;
  /** 根上的那根柴抽了没有（它一抽，火势骤降） */
  basePulled: boolean;
  /** 刚抽掉的那一根 / 什么时候抽的（画面按它演"被拖出去"的那一下） */
  lastPull: SiegeLog | null;
  lastPullAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  done: boolean;
}

/**
 * close（关门捉贼）每一帧交给游戏画的一切：
 * 关好了几扇门、哪一扇正在转、贼还有多久跑。
 */
export interface SiegeCloseMetrics {
  width: number;
  height: number;
  elapsedMs: number;
  /** 已经关好的门（按关好的先后） */
  closed: string[];
  closedCount: number;
  total: number;
  /** 0..1：关上几成了 */
  ratio: number;
  /** 正在转的那一扇门 / 它关到几分了（门转过去的动画按它画） */
  closingId: string | null;
  closingRatio: number;
  /** 贼还有多久跑（画面上那条倒计时的钟按它画） */
  escapeLeftMs: number;
  escapeAfterMs: number;
  /** 贼跑掉了：正在演"他跑出门口"那一段（零惩罚，演完就重来） */
  escaped: boolean;
  escapedAtMs: number;
  /** 跑掉的那一次是从哪扇门跑的 */
  escapedExitId: string | null;
  /** 此刻他会往哪扇门跑（最近的、还没关上的那扇）—— 让他一点点朝那儿挪 */
  escapeExitId: string | null;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  done: boolean;
}

/**
 * ladder（上屋抽梯）每一帧交给游戏画的一切：
 * 搭到第几级、他爬到哪儿、抽早了掉回来过几回。
 */
export interface SiegeLadderMetrics {
  width: number;
  height: number;
  /** 这一局过了多久（墙钟，从开局算起）—— 他往上爬、尘土都按它摆 */
  elapsedMs: number;
  /** 搭好的阶梯 id（按搭好的先后） */
  built: string[];
  builtCount: number;
  total: number;
  /** 0..1：搭了几成 —— 画面上的进度条按它画 */
  ratio: number;
  /** building（还没搭完）/ climbing（他正往上走）/ ready（他到位了）/ done（梯子抽了） */
  phase: LadderPhase;
  /** 他爬到几分了（0..1）—— 画面按它把他往上挪 */
  climbRatio: number;
  /** 下一级该搭哪一级；全搭好了就是 null */
  nextRungId: string | null;
  /** 抽早了：他掉回来过几回（只用来复盘，记进 mistakes） */
  drops: number;
  /** 刚掉回来那一下是什么时候（画面按它演"从半截滑回地面"）；没掉过是 -1 */
  droppedAtMs: number;
  /** 掉回来那一下他爬到哪儿了（0..1）——下滑的起点 */
  droppedFromRatio: number;
  /** 刚到位的那一刻（画面按它演"站住了、回头一看"）；还没到位是 -1 */
  readyAtMs: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  done: boolean;
}

export interface SiegeApi {
  scene: Phaser.Scene;
}

/** 三个模式共用的那一份：一局状态、下一幕、关键抉择点的揭晓语 */
interface SiegeBaseConfig {
  session: SessionState;
  nextSceneKey?: string;
  /**
   * 顶栏标题。三十六计的 scene.* 文案还没登记，所以可以不传 ——
   * 不传就用内容自己的标题（ctx.content 已经按语言翻译好了）。
   */
  titleKey?: MessageKey;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * vital（第 2 计围魏救赵）：正面怎么推都推不动，去动他非救不可的地方。
 * **这一份接口与它那条路径都没动过** —— 已上线的围魏救赵照旧跑。
 */
export interface SiegeVitalConfig extends SiegeBaseConfig {
  level: SiegeLevel;
  /** 整屏画面：地图、城墙、要害、进度条都按 metrics 画 */
  drawStage: (g: Phaser.GameObjects.Graphics, stage: SiegeStageMetrics) => void;
  /** 点中一处要害（游戏可以让"回防"的兵马动起来） */
  onRelieve?: (vital: SiegeVital, api: SiegeApi) => void;
  /** 推了一下正面 */
  onFrontTap?: (stage: SiegeStageMetrics, api: SiegeApi) => void;
  /** 每帧回调（会动的东西用自己的节拍） */
  onFrame?: (stage: SiegeStageMetrics, delta: number) => void;
  /** 解围的收尾表现 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, stage: SiegeStageMetrics) => void;
}

/** support（第 19 计釜底抽薪）：不跟火硬碰，从底下把柴一根根抽走 */
export interface SiegeSupportConfig extends SiegeBaseConfig {
  level: SiegeSupportLevel;
  /** 整屏画面：粮囤、火堆、底下的柴、进度条都按 metrics 画 */
  drawSupport: (g: Phaser.GameObjects.Graphics, stage: SiegeSupportMetrics) => void;
  /** 抽走了一根柴（游戏可以让那根柴真的被拖出去） */
  onPull?: (log: SiegeLog, api: SiegeApi) => void;
  /** 火灭了的收尾表现 */
  drawSupportFinale?: (g: Phaser.GameObjects.Graphics, stage: SiegeSupportMetrics) => void;
}

/** close（第 22 计关门捉贼）：抢在贼跑掉之前，把每个出口都关上 */
export interface SiegeCloseConfig extends SiegeBaseConfig {
  level: SiegeCloseLevel;
  /** 整屏画面：夜里的营门、几个出口、贼、倒计时的钟都按 metrics 画 */
  drawClose: (g: Phaser.GameObjects.Graphics, stage: SiegeCloseMetrics) => void;
  /** 一扇门排上了队（游戏可以让门开始转） */
  onClose?: (exit: SiegeExit, api: SiegeApi) => void;
  /** 捉住了的收尾表现 */
  drawCloseFinale?: (g: Phaser.GameObjects.Graphics, stage: SiegeCloseMetrics) => void;
}

/** ladder（第 28 计上屋抽梯）：先给方便 —— 一级级把梯子搭好，等他上去再抽掉 */
export interface SiegeLadderConfig extends SiegeBaseConfig {
  level: SiegeLadderLevel;
  /** 整屏画面：营垒、梯子、往上爬的人、进度条都按 metrics 画 */
  drawLadder: (g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics) => void;
  /** 搭上了一级（游戏可以让这一级真的架上去） */
  onBuild?: (rung: SiegeRung, api: SiegeApi) => void;
  /** 抽早了：他掉回来了（记进 mistakes；画面按 droppedAtMs 演他滑下来） */
  onDrop?: (api: SiegeApi) => void;
  /** 他下不来了的收尾表现 */
  drawLadderFinale?: (g: Phaser.GameObjects.Graphics, stage: SiegeLadderMetrics) => void;
}

/** 四个模式的配置合起来 —— createSiegeScene 按 level.mode 分派 */
export type SiegeConfig =
  | SiegeVitalConfig | SiegeSupportConfig | SiegeCloseConfig | SiegeLadderConfig;

/**
 * 打要害 / 抽支撑 / 断退路 —— 三个模式说的是同一句话：
 * 不跟他正面硬碰，去动他撑不住的地方。
 *
 * 按 `level.mode` 分派到各自的场景。三个模式共用同一套手感常量（SIEGE）
 * 与同一条收尾流程（结算 → 揭晓语 → 下一幕）；**vital（第 2 计围魏救赵）
 * 那条路径一个字没动** —— 它只是被 mode 判断包起来了。
 */
export function createSiegeScene(
  ctx: GameContext,
  cfg: SiegeConfig,
): Phaser.Types.Scenes.SceneType {
  if (isSupportConfig(cfg)) return createSiegeSupportScene(ctx, cfg);
  if (isCloseConfig(cfg)) return createSiegeCloseScene(ctx, cfg);
  if (isLadderConfig(cfg)) return createSiegeLadderScene(ctx, cfg);
  return createSiegeVitalScene(ctx, cfg);
}

/**
 * 三个模式的配置是"按关卡模式分"的联合类型。
 * 判别式藏在 `cfg.level.mode` 里（两层），所以显式写成类型守卫 ——
 * 这样每条分支里 cfg 的类型都收窄成对应模式那一份，不用强转。
 */
function isSupportConfig(cfg: SiegeConfig): cfg is SiegeSupportConfig {
  return cfg.level.mode === 'support';
}

function isCloseConfig(cfg: SiegeConfig): cfg is SiegeCloseConfig {
  return cfg.level.mode === 'close';
}

function isLadderConfig(cfg: SiegeConfig): cfg is SiegeLadderConfig {
  return cfg.level.mode === 'ladder';
}

/**
 * 要害：正面怎么推都推不动，去动他非救不可的地方。
 *
 * 三条刻意的设计：
 * - **推不动是算出来的，不是说出来的**：不点要害，一下只加 0.2（要一百下）；
 *   两处要害点完，阻力归零，一下加 1（二十下）。孩子自己就能感到差别。
 * - **每个要害只能点一次**：点过变"已回防"，再点不重复减阻力 —— 这本账算得清。
 * - **零惩罚**：白推一百下也不扣星、不结束，要害点过再点也只是再提醒一句。
 */
function createSiegeVitalScene(
  ctx: GameContext,
  cfg: SiegeVitalConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SiegeScene extends BaseScene {
    private state: SiegeState = siegeStart();
    private finished = false;
    private busy = false;
    private lastTapAt = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private tapTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
      super(SCENE_KEYS.siege, ctx);
    }


    // ---------------- 输入 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      // 抽柴 / 回防的演出（900ms / 620ms）里点下一根是孩子最自然的动作：
      // 以前这里裸 return，一声都没有。给一声轻回应，孩子才知道"收到了，等这根抽完"。
      if (this.finished) return;
      if (this.busy) {
        this.tapAck(pointer.x, pointer.y);
        return;
      }
      // 要害优先：它压在城墙的命中范围上也照样算要害
      const vital = vitalAt(pointer.x, pointer.y, cfg.level, SIEGE.tapForgive);
      if (vital) {
        this.hitVital(vital);
        return;
      }
      const { front } = cfg.level;
      if (Math.hypot(pointer.x - front.x, pointer.y - front.y) <= front.radius + SIEGE.tapForgive) {
        this.pushFront();
      }
    }

    /** 点要害：只有第一次真的减阻力 */
    private hitVital(vital: SiegeVital): void {
      if (this.finished || this.busy) return;
      if (isRelieved(this.state, vital.id)) {
        // 已经回防过了：重复点不惩罚。还有没点的要害就说一句，两处都点完了把小手放回正面
        if (nextVital(cfg.level, this.state)) {
          this.showHint(cfg.level.hint);
        } else {
          const { front } = cfg.level;
          this.pointAt(front.x, front.y, front.radius);
        }
        return;
      }
      this.state = relieve(cfg.level, this.state, vital.id);
      this.idleMs = 0;
      this.busy = true;
      this.clearRing();
      this.hideHand();
      this.sfx('unlock');
      this.cameras.main.flash(180, 255, 240, 200);
      sparkleAt(this, vital.x, vital.y, THEME.gold, 7);
      this.ctx.emit('beat:enter', { beatId: 'siege:relieve:' + vital.id });
      cfg.onRelieve?.(vital, { scene: this });
      this.redraw();
      const hold = this.autoplay
        ? Math.max(120, Math.round(SIEGE.relieveHoldMs / 3))
        : SIEGE.relieveHoldMs;
      this.time.delayedCall(hold, () => {
        this.busy = false;
        this.idleMs = 0;
      });
    }

    /** 推一下正面 */
    private pushFront(): void {
      if (this.finished || this.busy) return;
      const now = this.ctx.services.now();
      // 70ms 的连点冷却里也只吞"多余的重复"，但要让手指知道程序在听
      if (now - this.lastTapAt < SIEGE.tapCooldownMs) {
        this.tapAck();
        return;
      }
      this.lastTapAt = now;

      const before = this.state;
      this.state = frontTap(cfg.level, this.state);
      this.idleMs = 0;
      this.sfx('tap');
      this.cameras.main.shake(60, 0.0015);

      const stage = this.metrics(false);
      cfg.onFrontTap?.(stage, { scene: this });

      // 阻力还在（一下推不满 1）时，别让孩子闷头推满一百下：把该去的地方指出来
      if (frontGain(cfg.level, before) < 1 && this.state.taps % SIEGE.tapHintEvery === 1) {
        this.showHint(cfg.level.hint);
        this.pointAtNextVital();
      }
      this.redraw();
      if (isSiegeDone(cfg.level, this.state.progress)) this.finish();
    }

    // ---------------- 画面 ----------------

    private metrics(done: boolean): SiegeStageMetrics {
      return {
        width: this.W,
        height: this.H,
        progress: this.state.progress,
        goal: cfg.level.goal,
        ratio: siegeProgress(cfg.level, this.state),
        resistance: resistanceOf(cfg.level, this.state),
        relieved: [...this.state.relieved],
        gain: frontGain(cfg.level, this.state),
        tapsLeft: tapsToFinish(cfg.level, this.state),
        taps: this.state.taps,
        done,
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawStage(this.stageGfx, this.metrics(this.finished));
    }


    /** 把小手与光圈放到下一处要害上；要害都点完了就指向正面 */
    private pointAtNextVital(): void {
      const vital = nextVital(cfg.level, this.state);
      if (!vital) {
        const { front } = cfg.level;
        this.pointAt(front.x, front.y, front.radius);
        return;
      }
      this.pointAt(vital.x, vital.y, vital.radius);
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

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.tapTimer?.destroy();
      this.tapTimer = null;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SIEGE.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: cfg.revealY ?? 300,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'siege:done' });
          this.redraw();
          if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx, this.metrics(true));
        }
      });
    }

    // ---------------- 无头验证 ----------------

    /** 先把两处要害点掉，再连点正面 —— 与真实操作走的是同一条路 */
    private runAutoplay(): void {
      cfg.level.vital.forEach((vital, index) => {
        this.time.delayedCall(
          SIEGE.autoplayLeadMs + index * SIEGE.autoplayStepMs,
          () => this.hitVital(vital),
        );
      });
      const startAt =
        SIEGE.autoplayLeadMs + cfg.level.vital.length * SIEGE.autoplayStepMs + 260;
      this.time.delayedCall(startAt, () => {
        this.tapTimer = this.time.addEvent({
          delay: SIEGE.autoplayTapMs,
          loop: true,
          callback: () => this.pushFront(),
        });
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (!this.finished) {
        cfg.onFrame?.(this.metrics(false), delta);
        this.idleMs += delta;
        if (this.idleMs >= SIEGE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint);
          this.pointAtNextVital();
        }
      }
      this.redraw();
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.siege });
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => {
        this.tapTimer?.destroy();
        this.tapTimer = null;
      });

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }
  };
}

/* ---------------- support：釜底抽薪（第 19 计） ---------------- */

/**
 * 釜底抽薪：不给火添水，也不跟火硬碰 —— 从底下把柴一根根抽走。
 *
 * 三条刻意的设计：
 * - **火势是算出来的**：抽一根，火就小一圈；`base` 那根一抽，火势骤降 ——
 *   孩子自己就看得见"根上的那根"与别的柴不一样。
 * - **每根只能抽一次**：抽过的柴再点只是提醒一句，不会重复降火势。
 * - **零惩罚**：点空、点抽过的柴，都不扣星、不结束、不锁操作，火也不会旺回去。
 */
function createSiegeSupportScene(
  ctx: GameContext,
  cfg: SiegeSupportConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SiegeSupportScene extends BaseScene {
    private state: SupportState = supportStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    private busy = false;
    private misses = 0;
    private lastPull: SiegeLog | null = null;
    private lastPullAt = -1;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private stepTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
      super(SCENE_KEYS.siege, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 点 ----------------

    /** 手指落在哪一根柴上：落在柴上就抽它，落在别处什么也不发生（零惩罚） */
    private pressAt(x: number, y: number): void {
      if (this.finished || this.busy) return;
      this.idleMs = 0;
      const log = logAt(cfg.level, x, y, SIEGE.tapForgive);
      if (log === undefined) {
        this.nothing();
        return;
      }
      if (isPulled(this.state, log.id)) {
        // 已经抽走的柴：不会再降一次火势。提醒一句，接着抽别的就是
        this.showHint(cfg.level.hint, 2200);
        return;
      }
      this.pullOne(log);
    }

    /** 抽走一根柴 */
    private pullOne(log: SiegeLog): void {
      if (this.finished || this.busy) return;
      const before = this.state;
      this.state = pullLog(cfg.level, this.state, log.id);
      if (this.state === before) return; // 抽过的：不重复表演
      this.lastPull = log;
      this.lastPullAt = this.now();
      this.idleMs = 0;
      this.busy = true;
      this.clearRing();
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'siege:pull:' + log.id });
      cfg.onPull?.(log, { scene: this });

      if (log.base) {
        // 根上的那根柴：整堆火都压在它身上 —— 这一下火势骤降，动静也该最大
        this.sfx('unlock');
        this.cameras.main.flash(180, 255, 240, 200);
        this.cameras.main.shake(220, 0.005);
        sparkleAt(this, log.x, log.y, THEME.gold, 8);
        this.ctx.emit('beat:enter', { beatId: 'siege:base:' + log.id });
      } else {
        this.sfx('tap');
        sparkleAt(this, log.x, log.y, THEME.gold, 5);
      }
      // 火势听得见：抽一根，音调就低一截
      this.ctx.services.audio.tone(300 + fireLevel(cfg.level, this.state) * 2, 200);

      this.redraw();
      const hold = this.autoplay
        ? Math.max(120, Math.round(SIEGE.pullHoldMs / 3))
        : SIEGE.pullHoldMs;
      this.time.delayedCall(hold, () => {
        this.busy = false;
        this.idleMs = 0;
        if (isSupportDone(cfg.level, this.state)) {
          this.finish();
          return;
        }
        this.pointAtNext();
      });
    }

    /** 点空了：只是没收获 —— 不扣星、不结束、不锁操作 */
    private nothing(): void {
      if (this.finished) return;
      this.misses += 1;
      this.idleMs = 0;
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'siege:miss:' + this.misses });
      this.showHint(cfg.level.hint, 2400);
      this.pointAtNext();
    }

    // ---------------- 画面 ----------------

    private metrics(done: boolean): SiegeSupportMetrics {
      const level = cfg.level;
      const base = baseLog(level);
      return {
        width: this.W,
        height: this.H,
        elapsedMs: this.now(),
        fireLevel: fireLevel(level, this.state),
        fireMax: level.fire.level,
        ratio: supportProgress(level, this.state),
        pulled: [...this.state.order],
        total: level.logs.length,
        standing: standingCount(level, this.state),
        basePulled: base !== undefined && isPulled(this.state, base.id),
        lastPull: this.lastPull,
        lastPullAtMs: this.lastPullAt,
        misses: this.misses,
        done,
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawSupport(this.stageGfx, this.metrics(this.finished));
    }


    /** 把小手与光圈放到还没抽的下一根柴上 */
    private pointAtNext(): void {
      if (this.finished || this.busy) return;
      const log = nextLogToPull(cfg.level, this.state);
      if (log === undefined) return;
      this.pointAt(log.x, log.y, log.radius);
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

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.stepTimer?.destroy();
      this.stepTimer = null;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SIEGE.finaleHoldMs,
        sparkle: { x: cfg.level.fire.x, y: cfg.level.fire.y, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: cfg.revealY ?? 300,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'siege:done' });
          this.redraw();
          if (this.finaleGfx) cfg.drawSupportFinale?.(this.finaleGfx, this.metrics(true));
        }
      });
    }

    // ---------------- 无头验证 ----------------

    /** 与孩子走的是同一条路：把手指按在"还没抽的下一根柴"上（连命中判定都走一遍） */
    private runAutoplay(): void {
      this.stepTimer = this.time.addEvent({
        delay: SIEGE.autoplayPullMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.finished || this.busy) return;
      const log = nextLogToPull(cfg.level, this.state);
      if (log === undefined) return;
      this.pressAt(log.x, log.y);
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (!this.finished) {
        // 火还在烧：一会儿没动静就把该抽的那根指出来
        this.idleMs += delta;
        if (this.idleMs >= SIEGE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600);
          this.pointAtNext();
        }
      }
      this.redraw();
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.siege });
      this.startedAt = this.ctx.services.now();
      this.state = supportStart(cfg.level);
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => {
        this.stepTimer?.destroy();
        this.stepTimer = null;
      });

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.time.delayedCall(SIEGE.introHintMs, () => this.showHint(cfg.level.hint, 3000));
        this.time.delayedCall(SIEGE.introHandMs, () => this.pointAtNext());
      }
    }
  };
}

/* ---------------- close：关门捉贼（第 22 计） ---------------- */

/**
 * 关门捉贼：贼会从某个出口跑掉（`escapeAfterMs` 之后），
 * 在那之前把每个出口都关上。
 *
 * 三条刻意的设计：
 * - **一扇一扇地关**：门排上队，关好一扇下一扇才开始转 —— 所以"全关一遍要多久"
 *   就是 ΣcloseMs（关卡 schema 也照它验算）。孩子点得快没关系，每一下都排进队里。
 * - **贼跑掉只是重来**：到点还没关完，他就从最近的、还没关上的那扇门溜出去；
 *   演完这一段，门又都开着、钟重新走 —— **零惩罚**，不扣星、不结束。
 * - **看得见的倒计时**：贼的钟一直画在画面上（他还会一点点朝要跑的那扇门挪）。
 */
function createSiegeCloseScene(
  ctx: GameContext,
  cfg: SiegeCloseConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SiegeCloseScene extends BaseScene {
    private state: CloseState = closeStart(cfg.level, 0);
    private startedAt = 0;
    private finished = false;
    private misses = 0;
    private closedSeen = 0;
    private escapedAt = -1;
    private escapedExitId: string | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private stepTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
      super(SCENE_KEYS.siege, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 点 ----------------

    /** 手指落在哪一扇门上：落在门上就把它排进队里，落在别处什么也不发生（零惩罚） */
    private pressAt(x: number, y: number): void {
      if (this.finished) return;
      this.idleMs = 0;
      if (this.escapedAt >= 0) return; // 正在演"贼跑了"：等重来
      const exit = exitAt(cfg.level, x, y, SIEGE.tapForgive);
      if (exit === undefined) {
        this.nothing();
        return;
      }
      const t = this.now();
      const before = this.state;
      this.state = closeExit(cfg.level, this.state, exit.id, t);
      if (this.state === before) {
        // 已经关上的、已经排上队的门：点了不会更糟，只是提醒一句
        this.showHint(cfg.level.hint, 2200);
        return;
      }
      this.sfx('tap');
      this.clearRing();
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'siege:close:' + exit.id });
      cfg.onClose?.(exit, { scene: this });
      this.redraw();
    }

    /** 点空了：只是没收获 —— 不扣星、不结束、不锁操作 */
    private nothing(): void {
      if (this.finished) return;
      this.misses += 1;
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'siege:miss:' + this.misses });
      this.showHint(cfg.level.hint, 2400);
      this.pointAtNext();
    }

    // ---------------- 每一帧 ----------------


    /** 又关严了一扇：亮一下、叮一声 —— 一扇一扇地关，每一下都看得见 */
    private celebrateClosed(t: number): void {
      const closed = closedExits(cfg.level, this.state, t);
      if (closed.length <= this.closedSeen) return;
      for (const exit of closed.slice(this.closedSeen)) {
        sparkleAt(this, exit.x, exit.y, THEME.gold, 5);
      }
      this.closedSeen = closed.length;
      this.sfx('correct');
    }

    /**
     * 贼跑了：他从最近的、还没关上的那扇门溜出去。
     * 这不是"答错了"，只是这一轮没来得及 —— 演完就重来，不扣星、不结束。
     */
    private escape(t: number): void {
      const exit = escapeExit(cfg.level, this.state, t);
      this.escapedAt = t;
      this.escapedExitId = exit?.id ?? null;
      this.clearRing();
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'siege:escape:' + (exit?.id ?? 'none') });
      this.ctx.services.audio.tone(196, 320);
      this.cameras.main.shake(200, 0.004);
      this.showHint(cfg.level.hint, 2600);
    }

    /** 重来：门又都开着，贼的钟重新走 —— 只记一笔"跑掉过一回" */
    private restartRound(t: number): void {
      this.state = closeStart(cfg.level, t, this.state.escapes + 1);
      this.escapedAt = -1;
      this.escapedExitId = null;
      this.closedSeen = 0;
      this.idleMs = 0;
      this.ctx.emit('beat:enter', { beatId: 'siege:again:' + this.state.escapes });
      this.pointAtNext();
    }

    // ---------------- 画面 ----------------

    private metrics(done: boolean): SiegeCloseMetrics {
      const level = cfg.level;
      const t = this.now();
      const running = closingExit(level, this.state, t);
      const next = escapeExit(level, this.state, t);
      return {
        width: this.W,
        height: this.H,
        elapsedMs: t,
        closed: closedExits(level, this.state, t).map((exit) => exit.id),
        closedCount: closedCount(level, this.state, t),
        total: level.exits.length,
        ratio: closeProgress(level, this.state, t),
        closingId: running?.id ?? null,
        closingRatio: closingRatio(level, this.state, t),
        escapeLeftMs: escapeLeftMs(this.state, t),
        escapeAfterMs: level.escapeAfterMs,
        escaped: this.escapedAt >= 0,
        escapedAtMs: this.escapedAt,
        escapedExitId: this.escapedExitId,
        escapeExitId: next?.id ?? null,
        misses: this.misses,
        done,
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawClose(this.stageGfx, this.metrics(this.finished));
    }

    /** 把小手与光圈放到"还没关的里面离贼最近的那一扇"上 */
    private pointAtNext(): void {
      if (this.finished || this.escapedAt >= 0) return;
      const exit = nextExitToClose(cfg.level, this.state);
      if (exit === undefined) return;
      this.pointAt(exit.x, exit.y, exit.radius);
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

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.stepTimer?.destroy();
      this.stepTimer = null;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SIEGE.finaleHoldMs,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: cfg.revealY ?? 300,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'siege:done' });
          this.redraw();
          if (this.finaleGfx) cfg.drawCloseFinale?.(this.finaleGfx, this.metrics(true));
        }
      });
    }

    // ---------------- 无头验证 ----------------

    /** 与孩子走的是同一条路：把手指按在"下一扇该关的门"上（连命中判定都走一遍） */
    private runAutoplay(): void {
      this.stepTimer = this.time.addEvent({
        delay: SIEGE.autoplayCloseMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.finished || this.escapedAt >= 0) return;
      const exit = nextExitToClose(cfg.level, this.state);
      if (exit === undefined) return;
      this.pressAt(exit.x, exit.y);
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (!this.finished) {
        const t = this.now();
        if (this.escapedAt >= 0) {
          // 贼跑了：演完这一段就重来（零惩罚）
          if (t - this.escapedAt >= SIEGE.escapeHoldMs) this.restartRound(t);
        } else {
          this.celebrateClosed(t);
          if (isCloseDone(cfg.level, this.state, t)) {
            this.finish();
          } else if (hasEscaped(cfg.level, this.state, t)) {
            this.escape(t);
          } else {
            this.idleMs += delta;
            if (this.idleMs >= SIEGE.idleMs) {
              this.idleMs = 0;
              this.showHint(cfg.level.hint, 2600);
              this.pointAtNext();
            }
          }
        }
      }
      this.redraw();
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.siege });
      this.startedAt = this.ctx.services.now();
      this.state = closeStart(cfg.level, 0);
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => {
        this.stepTimer?.destroy();
        this.stepTimer = null;
      });

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.time.delayedCall(SIEGE.introHintMs, () => this.showHint(cfg.level.hint, 3000));
        this.time.delayedCall(SIEGE.introHandMs, () => this.pointAtNext());
      }
    }
  };
}

/* ---------------- ladder：上屋抽梯（第 28 计） ---------------- */

/**
 * 上屋抽梯自己的手感常量。**SIEGE 一个字没动** ——
 * 搭梯、等人、抽梯的节拍与"推正面 / 抽柴 / 关门"完全不是一回事。
 */
export const LADDER = {
  /** 点阶梯 / 点绳桩的命中宽容度：阶梯一级挨一级，比 siege 通用的那一份小一号 */
  tapForgive: 40,
  /** 他到位之后的那一下停顿（让孩子看清"他站上去了、回头看了一眼"） */
  readyHoldMs: 700,
  /** 无头验证：搭一级的节拍（够画面把上一级演完） */
  autoplayStepMs: 420,
} as const;

/**
 * 上屋抽梯：先给方便 —— 一级级把梯子搭好，他自己会顺着往上走；等他走到位，再把梯子抽掉。
 *
 * 四条刻意的设计：
 * - **搭梯是孩子自己搭的**：点一下搭一级、**只认下一级**（跳级搭不上，零惩罚）；
 *   搭完最后一级的那一刻，他才抬脚往上走 —— "先给方便"这一步看得见。
 * - **抽早了只是掉回来**：他还在爬的时候抽梯，他会掉回地面、**进度清零、要重新搭**
 *   ——记进 mistakes、不结束、不锁操作；孩子自己就明白"早了不算数"。
 * - **没搭完的时候点绳桩什么也不发生**：梯子还没架上，抽的是空气。
 * - **他往上走的那一段，小手是收着的**：不该动手的时候不给提示 ——
 *   提示给在**对的时候**（搭下一级 / 他到位了抽梯）。
 */
function createSiegeLadderScene(
  ctx: GameContext,
  cfg: SiegeLadderConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class SiegeLadderScene extends BaseScene {
    private state: LadderState = ladderStart(cfg.level, 0);
    private startedAt = 0;
    private finished = false;
    private misses = 0;
    private droppedAtMs = -1;
    private droppedFromRatio = 0;
    private readyAtMs = -1;
    private lastPhase: LadderPhase | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private stepTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
      super(SCENE_KEYS.siege, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 点 ----------------

    /** 手指落在阶梯上就搭它，落在绳桩上就抽梯，落在别处什么也不发生（零惩罚） */
    private pressAt(x: number, y: number): void {
      if (this.finished) return;
      this.idleMs = 0;
      const rung = rungAt(cfg.level, x, y, LADDER.tapForgive);
      if (rung !== undefined) {
        this.tapRung(rung);
        return;
      }
      if (ladderAt(cfg.level, x, y, LADDER.tapForgive)) {
        this.pullNow();
        return;
      }
      this.nothing();
    }

    /** 搭一级：只认下一级 —— 跳级、搭过的、不认识的都原样返回，只提醒一句 */
    private tapRung(rung: SiegeRung): void {
      if (this.finished) return;
      const before = this.state;
      this.state = buildRung(cfg.level, this.state, rung.id, this.now());
      if (this.state === before) {
        this.showHint(cfg.level.hint, 2200);
        return;
      }
      this.sfx('tap');
      sparkleAt(this, rung.x, rung.y, THEME.wood, 5);
      this.ctx.emit('beat:enter', { beatId: 'siege:ladder:rung:' + rung.id });
      cfg.onBuild?.(rung, { scene: this });
      this.clearRing();
      this.hideHand();
      this.redraw();
      if (allRungsBuilt(cfg.level, this.state)) {
        // 最后一级搭上了：他自己抬脚往上走 —— 这下要等
        this.ctx.emit('beat:enter', { beatId: 'siege:ladder:climb' });
        this.showHint(cfg.level.hint, 2200);
      } else {
        this.pointAtNext();
      }
    }

    /** 抽梯：只有他到位之后才算成；早了他掉回来（记进 mistakes）；没搭完什么也不发生 */
    private pullNow(): void {
      if (this.finished) return;
      const before = this.state;
      const t = this.now();
      const climbedTo = climbRatio(cfg.level, this.state, t);
      this.state = pullLadder(cfg.level, this.state, t);
      if (this.state === before) {
        // 还没搭完（梯子还没架上）：抽的是空气 —— 提醒一句就完了
        this.showHint(cfg.level.hint, 2200);
        return;
      }
      if (isLadderDone(this.state)) {
        this.ctx.emit('beat:enter', { beatId: 'siege:ladder:pull' });
        this.finish();
        return;
      }
      // 早了：他从半截上滑回地面 —— 进度清零、要重新搭（不结束、不锁操作）；
      // 这一下是孩子主动抽早的，记一次 mistakes
      recordAttempt(cfg.session, { ok: false });
      this.droppedAtMs = t;
      this.droppedFromRatio = climbedTo;
      this.ctx.emit('beat:enter', { beatId: 'siege:ladder:drop:' + this.state.drops });
      cfg.onDrop?.({ scene: this });
      this.sfx('wrong');
      this.cameras.main.shake(220, 0.004);
      this.showHint(cfg.level.hint, 2600);
      this.clearRing();
      this.hideHand();
      this.lastPhase = null;
      this.redraw();
    }

    /** 点空了：只是没收获 —— 不扣星、不结束、不锁操作 */
    private nothing(): void {
      if (this.finished) return;
      this.misses += 1;
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'siege:miss:' + this.misses });
      this.showHint(cfg.level.hint, 2400);
    }

    // ---------------- 每一帧 ----------------


    /** 他到位的那一刻：出声、亮一下、把小手放到绳桩上 */
    private syncPhase(): void {
      const t = this.now();
      const phase = ladderPhase(cfg.level, this.state, t);
      if (phase === this.lastPhase) return;
      this.lastPhase = phase;
      if (phase !== 'ready') return;
      this.readyAtMs = t;
      this.ctx.emit('beat:enter', { beatId: 'siege:ladder:ready' });
      this.sfx('unlock');
      this.cameras.main.flash(160, 255, 240, 200);
      this.time.delayedCall(this.autoplay ? 120 : LADDER.readyHoldMs, () => {
        if (this.finished) return;
        this.showHint(cfg.level.hint, 2400);
        this.pointAt(cfg.level.ladder.x, cfg.level.ladder.y, cfg.level.ladder.radius);
      });
    }

    // ---------------- 画面 ----------------

    private metrics(done: boolean): SiegeLadderMetrics {
      const level = cfg.level;
      const t = this.now();
      const next = nextRung(level, this.state);
      return {
        width: this.W,
        height: this.H,
        elapsedMs: t,
        built: [...this.state.built],
        builtCount: builtCount(this.state),
        total: level.rungs.length,
        ratio: ladderProgress(level, this.state),
        phase: ladderPhase(level, this.state, t),
        climbRatio: climbRatio(level, this.state, t),
        nextRungId: next?.id ?? null,
        drops: this.state.drops,
        droppedAtMs: this.droppedAtMs,
        droppedFromRatio: this.droppedFromRatio,
        readyAtMs: this.readyAtMs,
        misses: this.misses,
        done,
      };
    }

    private redraw(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawLadder(this.stageGfx, this.metrics(this.finished));
    }

    /**
     * 小手该指哪儿：
     * - 还没搭完 → 下一级阶梯；
     * - 他到位了 → 抽梯的绳桩；
     * - 他正往上走 → **哪儿也不指**（这时候不该动手）。
     */
    private pointAtNext(): void {
      if (this.finished) return;
      const phase = ladderPhase(cfg.level, this.state, this.now());
      if (phase === 'building') {
        const rung = nextRung(cfg.level, this.state);
        if (rung === undefined) return;
        this.pointAt(rung.x, rung.y, rung.radius);
        return;
      }
      if (phase === 'ready') {
        this.pointAt(cfg.level.ladder.x, cfg.level.ladder.y, cfg.level.ladder.radius);
      }
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

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.stepTimer?.destroy();
      this.stepTimer = null;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? SIEGE.finaleHoldMs,
        sparkle: { x: cfg.level.bait.x, y: cfg.level.bait.y, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: cfg.revealY ?? 300,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'siege:done' });
          this.redraw();
          if (this.finaleGfx) cfg.drawLadderFinale?.(this.finaleGfx, this.metrics(true));
        }
      });
    }

    // ---------------- 无头验证 ----------------

    /** 与孩子走的是同一条路：按顺序搭上去，等他到位，再点绳桩（连命中判定都走一遍） */
    private runAutoplay(): void {
      this.stepTimer = this.time.addEvent({
        delay: LADDER.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.finished) return;
      const phase = ladderPhase(cfg.level, this.state, this.now());
      if (phase === 'building') {
        const rung = nextRung(cfg.level, this.state);
        if (rung === undefined) return;
        this.pressAt(rung.x, rung.y);
        return;
      }
      if (phase === 'ready') this.pressAt(cfg.level.ladder.x, cfg.level.ladder.y);
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (!this.finished) {
        this.syncPhase();
        this.idleMs += delta;
        if (this.idleMs >= SIEGE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600);
          this.pointAtNext();
        }
      }
      this.redraw();
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.siege });
      this.startedAt = this.ctx.services.now();
      this.state = ladderStart(cfg.level, 0);
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.pressAt(pointer.x, pointer.y),
      );
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.onShutdownCleanup(() => {
        this.stepTimer?.destroy();
        this.stepTimer = null;
      });

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.time.delayedCall(SIEGE.introHintMs, () => this.showHint(cfg.level.hint, 3000));
        this.time.delayedCall(SIEGE.introHandMs, () => this.pointAtNext());
      }
    }
  };
}
