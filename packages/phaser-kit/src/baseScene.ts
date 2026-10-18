import Phaser from 'phaser';
import type { GameContext, SfxKey } from '@chags/game-kit';
import { createTranslator } from '@chags/i18n';
import type { MessageKey, MessageParams, Translator } from '@chags/i18n';
import { createHand, groundShadow, popIn, roundRect, shade, sparkleAt } from './cartoon';
import { isTapArmed } from './tapGuard';
import { CSS, THEME, textStyle } from './theme';

/**
 * 收尾序列的公共参数。
 *
 * 20 个模板本来各自抄一遍 finish()：sfx('complete') → 闪屏 → 金光 → 揭晓语 → 转场。
 * 现在只把这一段收到 completeLevel() 里；各模板的 guard / 清小手 / 清圈 / 记账 /
 * finale 画面仍留在自己的 finish() 里（通过 finalize 回调按原顺序执行）。
 */
export interface CompleteLevelOptions {
  /** 收尾之后转去哪个场景（各模板传 cfg.nextSceneKey） */
  nextSceneKey: string;
  /** 收尾停留多久再转场（默认 4200ms） */
  holdMs?: number;
  /** 转场前闪一下白屏（默认 true） */
  flash?: boolean;
  /** 播 complete 音效（默认 true；个别模板已在别处播过就传 false） */
  sfx?: boolean;
  /** 收尾的一圈金光：位置 / 颜色 / 数量各模板不同，由调用方给 */
  sparkle?: { x: number; y: number; color?: number; count?: number };
  /** 揭晓语：传了才显示（各模板的延迟与高度不同） */
  reveal?: string | undefined;
  revealDelayMs?: number;
  revealY?: number;
  /** 这一模板特有的收尾画面：记账 / 事件 / finale 都放这里（在闪屏之后、揭晓语之前执行） */
  finalize?: () => void;
  /** 转场前的最后一步（可选） */
  onDone?: () => void;
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  textColor?: string;
  fontSize?: number;
  disabled?: boolean;
  wrap?: boolean;
}

/**
 * 儿童向交互基线：
 * - 点击区域不小于 88×88 逻辑像素
 * - 卡通按钮有厚底与描边，按下有位移反馈
 * - 提示只在卡住时出现，且尽量用图形而不是文字
 */
export abstract class BaseScene extends Phaser.Scene {
  protected readonly ctx: GameContext;
  private hintPill: Phaser.GameObjects.Container | null = null;
  private translator: Translator | null = null;
  /** 上一次真的翻页的墙钟：连点保护从它起算（见 tapGuard） */
  private lastAdvanceAt = Number.NEGATIVE_INFINITY;
  /** 这一关收过尾没有 —— 防止同一局重复转场（模板自己的 finished/done 仍然各管各的） */
  private levelCompleted = false;

  protected constructor(key: string, ctx: GameContext) {
    super(key);
    this.ctx = ctx;
  }

  protected get W(): number {
    return this.ctx.manifest.designSize.width;
  }

  protected get H(): number {
    return this.ctx.manifest.designSize.height;
  }

  protected get autoplay(): boolean {
    return this.ctx.debug?.autoplay === true;
  }

  /** ?story=instant（截图巡检用）：跳过故事页"听完才能继续"的等待 */
  protected get storyInstant(): boolean {
    return this.ctx.debug?.storyInstant === true;
  }

  protected drawBackdrop(label?: string): void {
    const g = this.add.graphics();
    g.fillStyle(THEME.sky, 1);
    g.fillRect(0, 0, this.W, this.H);
    // 深色标题条：浅底浅字在换配色后看不清了
    g.fillStyle(THEME.inkSoft, 1);
    g.fillRect(0, 0, this.W, 150);
    if (label) {
      this.add.text(this.W / 2, 75, label, textStyle(52, CSS.paper, true)).setOrigin(0.5);
    }
  }

  /** 卡通按钮：阴影厚底 + 亮面 + 描边，按下时下沉 */
  protected addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ): Phaser.GameObjects.Container {
    const w = opts.width ?? 520;
    const h = opts.height ?? 136;
    const color = opts.color ?? THEME.red;
    const container = this.add.container(x, y);

    const lip = this.add.graphics();
    roundRect(lip, -w / 2, -h / 2 + 9, w, h, h / 2, shade(color, 0.72), THEME.outline, 5);

    const face = this.add.graphics();
    roundRect(face, -w / 2, -h / 2, w, h, h / 2, color, THEME.outline, 5);

    const text = this.add
      .text(0, -2, label, {
        ...textStyle(opts.fontSize ?? 44, opts.textColor ?? CSS.card, true),
        align: 'center',
        wordWrap: opts.wrap === false ? undefined : { width: w - 64, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    container.add([lip, face, text]);
    container.setSize(w, h);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', () => {
      if (opts.disabled) return;
      this.sfx('tap');
      this.tweens.add({ targets: [face, text], y: 9, duration: 60, yoyo: true });
      onClick();
    });
    return container;
  }

  protected addBody(
    x: number,
    y: number,
    content: string,
    size = 40,
    color: string = CSS.ink,
    wrapWidth = this.W - 160,
    bold = false,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, content, {
      ...textStyle(size, color, bold),
      wordWrap: { width: wrapWidth, useAdvancedWrap: true },
      lineSpacing: 12,
    });
  }

  /** 卡住时才出现的提示气泡；文字尽量短 */
  protected showHint(message: string, durationMs = 2800, y = 268): void {
    this.hintPill?.destroy(true);
    const label = this.add
      .text(0, 0, message, {
        ...textStyle(32, CSS.ink, true),
        align: 'center',
        // 570 而不是 490：提示语里有长句（"想明白了就不怕 —— 天是积起来的气……"），
        // 窄了会把句号挤成孤零零的第三行
        wordWrap: { width: this.W - 180, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const w = label.width + 64;
    const h = label.height + 40;
    const bg = this.add.graphics();
    roundRect(bg, -w / 2, -h / 2, w, h, h / 2, THEME.card, THEME.outline, 5);

    const pill = this.add.container(this.W / 2, y, [bg, label]).setDepth(950);
    this.hintPill = pill;
    popIn(this, pill);
    this.time.delayedCall(durationMs, () => {
      if (this.hintPill !== pill) return;
      this.tweens.add({
        targets: pill,
        alpha: 0,
        duration: 320,
        onComplete: () => pill.destroy(true),
      });
    });
  }

  /**
   * 点哪都行 —— 用小手代替“下一步”按钮。
   * 小手默认在底部；正文很长时（英文天然更长）由调用方给一个更靠下的位置，
   * 否则它会压住最后一行字 —— 双语巡检里看得一清二楚。
   */
  protected tapToContinue(onDone: () => void, handAt?: { x?: number; y?: number }): void {
    const hand = createHand(
      this,
      handAt?.x ?? this.W / 2,
      handAt?.y ?? this.H - 150,
      1.15,
    );
    const zone = this.add
      .zone(this.W / 2, this.H / 2, this.W, this.H)
      .setInteractive({ useHandCursor: true });
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      // 先记时间再回调：下一幕的点击区可能就在 onDone() 里同步建好
      this.lastAdvanceAt = this.ctx.services.now();
      hand.destroy();
      zone.destroy();
      onDone();
    };
    zone.once('destroy', () => {
      done = true;
    });
    // 连点保护：孩子连点两下时，第二下会落在**下一幕刚建好的**点击区上，
    // 一屏故事就被整段跳过去了。锁从**上一次翻页**起算，不是从建区起算 ——
    // 从建区起算会把"刚听完就点"那一下正常点击一起吞掉（见 tapGuard）。
    zone.on('pointerdown', () => {
      if (!isTapArmed(this.ctx.services.now(), this.lastAdvanceAt)) return;
      this.sfx('tap');
      finish();
    });
    if (this.autoplay) this.time.delayedCall(120, finish);
  }

  protected groundShadowAt(cx: number, cy: number, w: number, h: number, alpha = 0.16): void {
    const g = this.add.graphics();
    groundShadow(g, cx, cy, w, h, alpha);
  }

  protected sfx(key: SfxKey): void {
    this.ctx.services.audio.play(key);
  }

  /**
   * 关卡收尾序列 —— 顺序与各模板原来的 finish() 逐字一致：
   *
   *   sfx('complete') → 闪屏 → 金光 → finalize() → 揭晓语（延迟）→ 停留 holdMs → 转场
   *
   * 各模板只保留自己的 guard、状态变更、清小手/清圈与 finalize 里的收尾画面；
   * 时长与顺序没有任何变化（闪屏参数、金光参数、揭晓语延迟都是原来那一份）。
   * 重复调用只会执行第一次 —— "同一局不可能收两次尾"由这里兜住。
   */
  protected completeLevel(opts: CompleteLevelOptions): void {
    if (this.levelCompleted) return;
    this.levelCompleted = true;
    if (opts.sfx !== false) this.sfx('complete');
    if (opts.flash !== false) this.cameras.main.flash(320, 255, 250, 220);
    const sparkle = opts.sparkle;
    if (sparkle !== undefined) {
      sparkleAt(this, sparkle.x, sparkle.y, sparkle.color ?? THEME.gold, sparkle.count ?? 12);
    }
    opts.finalize?.();
    const reveal = opts.reveal;
    if (reveal !== undefined) {
      this.time.delayedCall(opts.revealDelayMs ?? 1200, () =>
        this.showHint(reveal, 3200, opts.revealY ?? 268),
      );
    }
    this.time.delayedCall(opts.holdMs ?? 4200, () => {
      opts.onDone?.();
      this.scene.start(opts.nextSceneKey);
    });
  }

  /** 界面文案：典故本身的文字走 ctx.content，通用标签走这里（带 {参数} 的句子传第二个参数） */
  protected tr(key: MessageKey, params?: MessageParams): string {
    this.translator ??= createTranslator(this.ctx.locale);
    return this.translator(key, params);
  }

  protected speak(text: string): void {
    this.ctx.services.audio.speak(text, this.ctx.locale);
  }

  /** 场景开场淡入；尊重"减少动画"设置 */
  protected fadeIn(): void {
    if (this.ctx.reducedMotion) return;
    this.cameras.main.fadeIn(220, 20, 16, 32);
  }

  protected onShutdownCleanup(fn: () => void): void {
    this.events.once('shutdown', fn);
  }
}
