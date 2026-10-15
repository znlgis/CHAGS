import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  availableFlags, bannerStart, borrowStart, canLift, connectProp, disconnectProp, flagAt,
  hasFulcrum, isBannerDone, isFlagRaised, isBorrowDone, nextFlagToRaise, nextPropToConnect,
  personAt, poleAt, propAt, pull, raiseFlag, ralliedCount, ralliedRatio, selfPower,
  suggestedConnections, totalPower,
} from './borrow.logic';
import type { BannerState, BorrowState } from './borrow.logic';
import type {
  BorrowBannerLevel, BorrowFlag, BorrowLevel, BorrowProp, BorrowScattered,
} from './schemas';
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

  /* ---------- banner（借尸还魂）：借名号，与上面的 force 各用各的 ---------- */
  /** 点旗 / 点散人的命中宽容度：手指粗也能点到 */
  bannerForgive: 46,
  /** 落点算"竖在旗杆上"的宽容度：拖过去不用对准 */
  poleForgive: 72,
  /** 按下到松开位移小于这么多，就算"点了一下"（点一下也会飞上旗杆） */
  tapSlop: 40,
  /** 旗飞上杆 / 人往杆下走的表演时长 */
  flyMs: 900,
  /** 无头验证：隔多久竖下一面旗 */
  bannerStepMs: 620,
  /** banner 提示气泡的高度：在标题条下面，让开旗杆与地上的旗 */
  bannerHintY: 300,
  /** 召够之后先看一眼空地再走 */
  bannerHoldMs: 2800,
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

/** 每一帧交给游戏画的 banner 画面 */
export interface BannerStageMetrics {
  width: number;
  height: number;
  /** 已经竖起来的旗 id（按竖起的先后） */
  raised: string[];
  /** 此刻还插在地上、可以竖的旗 id */
  available: string[];
  /** 已经被召回来的人 id */
  rallied: string[];
  /** 还没回来的人 id */
  away: string[];
  /** 召回了几个人 / 要几个 */
  ralliedCount: number;
  needed: number;
  /** 召回了几分（0..1）—— 进度条按它画 */
  ratio: number;
  /** 拖着的那面旗（没在拖就是 null）与它此刻在哪儿 */
  dragging: string | null;
  dragAt: { x: number; y: number } | null;
  /** 刚刚竖起来的那面旗与过去了多久 —— 旗飞上杆、人往回走的表演按它衰减 */
  lastRaised: string | null;
  sinceRaiseMs: number;
  /** 刚刚那面旗召回了几个（最新回来的这几个人按它算走到哪儿了） */
  lastRallied: number;
  elapsedMs: number;
  /** 这一局打赢了（人自己归队了） */
  done: boolean;
}

/**
 * banner（借尸还魂）这一路的配置。与 force 的 `BorrowConfig` 是两份 ——
 * force 的字段一个字没动，多出来的这些只有 banner 用得上。
 */
export interface BorrowBannerConfig {
  level: BorrowBannerLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏标题；不传就用内容自己的标题（ctx.content 已按语言翻译） */
  titleKey?: MessageKey;
  /** 整屏画面：黄昏的空地、倒下的旧旗、三面可用的旗、旗杆与散落的人 */
  drawBanner: (g: Phaser.GameObjects.Graphics, stage: BannerStageMetrics) => void;
  /** 每竖一面旗：旗飞上杆，rally 那么多人往回走 */
  onRaise?: (flag: BorrowFlag, rallied: number, api: BorrowApi) => void;
  /** 点到一个还没回来的散人（零惩罚：只是搭句话） */
  onCall?: (person: BorrowScattered, great: boolean, api: BorrowApi) => void;
  /** 召够了的收尾表现 */
  drawBannerFinale?: (g: Phaser.GameObjects.Graphics, stage: BannerStageMetrics) => void;
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * 借名号：把旗竖到旗杆上 —— 旗能召回多少人写在旗上（rally 个点）。
 *
 * 三条刻意的设计：
 * - **判定全在 borrow.logic 里**：场景只调 `raiseFlag` / `isBannerDone`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **一面旗只用一次，召不够就换一面**：没有失败这一说 —— 竖错了（拖到空地又放下）
 *   旗自己回到原位，接着竖就是。
 * - **人是自己回来的**：插旗之后 rally 那么多散人会一步步走回旗杆下 ——
 *   这一关的落点是"名号能把人聚起来"，不是把人一个个抓回来。
 */
function createBannerScene(
  ctx: GameContext,
  cfg: BorrowBannerConfig,
): Phaser.Types.Scenes.SceneType {
  return class BorrowBannerScene extends BaseScene {
    private level: BorrowBannerLevel = cfg.level;
    private state: BannerState = bannerStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    private dragging: BorrowFlag | null = null;
    private dragAt: { x: number; y: number } | null = null;
    private downAt = { x: 0, y: 0 };
    private lastRaised: string | null = null;
    private lastRallied = 0;
    private raisedAtMs = 0;
    private idleMs = 0;
    private bannerGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.borrow, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.borrow });
      this.startedAt = this.ctx.services.now();
      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);

      this.bannerGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onMove(pointer));
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 2600, BORROW.bannerHintY);
        this.time.delayedCall(1400, () => this.pointAtNextFlag());
      }
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 输入 ----------------

    private onDown(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.dragging) return;
      this.idleMs = 0;
      this.downAt = { x: pointer.x, y: pointer.y };
      const flag = flagAt(pointer.x, pointer.y, this.level, BORROW.bannerForgive);
      if (flag && !isFlagRaised(this.state, flag.id)) {
        // 抓住一面还插在地上的旗：拖着走
        this.dragging = flag;
        this.dragAt = { x: pointer.x, y: pointer.y };
        this.clearRing();
        this.hideHand();
        return;
      }
      const person = personAt(pointer.x, pointer.y, this.level, BORROW.bannerForgive);
      if (person) this.callPerson(person);
    }

    private onMove(pointer: Phaser.Input.Pointer): void {
      if (!this.dragging || this.finished) return;
      this.dragAt = { x: pointer.x, y: pointer.y };
    }

    private onUp(pointer: Phaser.Input.Pointer): void {
      const flag = this.dragging;
      if (!flag || this.finished) return;
      this.dragging = null;
      this.dragAt = null;
      const moved = Math.hypot(pointer.x - this.downAt.x, pointer.y - this.downAt.y);
      // 拖到旗杆上算竖起来；**点一下也算**（点一下旗就飞到杆上去）—— 孩子不必先学会拖
      if (poleAt(this.level, pointer.x, pointer.y, BORROW.poleForgive) || moved <= BORROW.tapSlop) {
        this.raise(flag);
        return;
      }
      // 拖到空地上：旗自己回到原位（**零惩罚**，接着试就是）
      this.sfx('tap');
      this.redraw();
    }

    /** 点到一个还没回来的散人：零惩罚，只是搭一句话 */
    private callPerson(person: BorrowScattered): void {
      const great = this.state.rallied.includes(person.id);
      this.sfx('tap');
      this.idleMs = 0;
      this.ctx.emit('beat:enter', { beatId: 'borrow:call:' + person.id });
      cfg.onCall?.(person, great, { scene: this });
      if (!great) this.showHint(cfg.level.hint, 2200, BORROW.bannerHintY);
      this.redraw();
    }

    // ---------------- 竖旗 ----------------

    /** 把旗竖到旗杆上（真实操作与无头验证走的是同一条路） */
    private raise(flag: BorrowFlag): void {
      if (this.finished) return;
      const result = raiseFlag(this.level, this.state, flag.id);
      if (result.flag === null) return;
      this.state = result.state;
      this.lastRaised = flag.id;
      this.lastRallied = result.rallied;
      this.raisedAtMs = this.elapsed();
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('unlock');
      sparkleAt(this, this.level.pole.x, this.level.pole.y, THEME.gold, 8);
      this.ctx.emit('beat:enter', { beatId: 'borrow:raise:' + flag.id });
      cfg.onRaise?.(flag, result.rallied, { scene: this });
      this.redraw();
      if (isBannerDone(this.level, this.state)) {
        this.finish();
        return;
      }
      this.time.delayedCall(BORROW.flyMs / 2, () => this.pointAtNextFlag());
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      if (!this.finished) {
        this.idleMs += delta;
        if (this.idleMs >= BORROW.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, BORROW.bannerHintY);
          this.pointAtNextFlag();
        }
      }
      this.redraw();
    }

    private metrics(): BannerStageMetrics {
      const { raised, rallied } = this.state;
      const available = availableFlags(this.level, this.state).map((flag) => flag.id);
      const away = this.level.scattered
        .filter((person) => !rallied.includes(person.id))
        .map((person) => person.id);
      return {
        width: this.W,
        height: this.H,
        raised: [...raised],
        available,
        rallied: [...rallied],
        away,
        ralliedCount: ralliedCount(this.state),
        needed: this.level.needed,
        ratio: ralliedRatio(this.level, this.state),
        dragging: this.dragging?.id ?? null,
        dragAt: this.dragAt === null ? null : { ...this.dragAt },
        lastRaised: this.lastRaised,
        sinceRaiseMs: this.lastRaised === null ? Number.POSITIVE_INFINITY : this.elapsed() - this.raisedAtMs,
        lastRallied: this.lastRallied,
        elapsedMs: this.elapsed(),
        done: this.finished && isBannerDone(this.level, this.state),
      };
    }

    private redraw(): void {
      if (!this.bannerGfx) return;
      this.bannerGfx.clear();
      cfg.drawBanner(this.bannerGfx, this.metrics());
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.dragging = null;
      this.dragAt = null;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.pole.x, this.level.pole.y, THEME.gold, 14);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'borrow:done' });
      this.redraw();
      if (this.finaleGfx) cfg.drawBannerFinale?.(this.finaleGfx, this.metrics());
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, cfg.revealY ?? BORROW.bannerHintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? BORROW.bannerHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 小手 ----------------

    private pointAtNextFlag(): void {
      if (this.finished) return;
      const flag = nextFlagToRaise(this.level, this.state);
      if (flag) {
        this.pointAt(flag.x, flag.y, flag.radius);
        return;
      }
      const { pole } = this.level;
      this.pointAt(pole.x, pole.y, pole.radius);
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

    /** 一面一面地竖（挑 rally 最大的），每一面走的是同一条 raise() 路径 */
    private runAutoplay(): void {
      const step = (): void => {
        if (this.finished) return;
        const flag = nextFlagToRaise(this.level, this.state);
        if (!flag) return;
        this.raise(flag);
        this.time.delayedCall(BORROW.bannerStepMs, step);
      };
      this.time.delayedCall(BORROW.autoplayLeadMs, step);
    }
  };
}

/**
 * 借力（force，第 3 计借刀杀人）那条路：**一行没改**，只是从 createBorrowScene 里
 * 挪成了一个具名函数，由 mode 判断把它包起来。
 */
function createForceBorrowScene(ctx: GameContext, cfg: BorrowConfig): Phaser.Types.Scenes.SceneType {
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

/**
 * 借力 / 借名号：两种玩法共用一个场景键（SCENE_KEYS.borrow），按 level.mode 分派。
 * - force（借刀杀人）：支点 + 力源凑够 needed，才抬得起来 —— 既有路径，一字未改；
 * - banner（借尸还魂）：把旧旗竖到旗杆上，旗能召回多少人，散掉的人就回来多少。
 */
export function createBorrowScene(
  ctx: GameContext,
  cfg: BorrowConfig | BorrowBannerConfig,
): Phaser.Types.Scenes.SceneType {
  if (cfg.level.mode === 'banner') return createBannerScene(ctx, cfg as BorrowBannerConfig);
  return createForceBorrowScene(ctx, cfg as BorrowConfig);
}
