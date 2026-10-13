import Phaser from 'phaser';
import type { GameContext, SfxKey } from '@chags/game-kit';
import { createTranslator } from '@chags/i18n';
import type { MessageKey, Translator } from '@chags/i18n';
import { createHand, groundShadow, popIn, roundRect, shade } from './cartoon';
import { CSS, THEME, textStyle } from './theme';

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
        wordWrap: { width: this.W - 260, useAdvancedWrap: true },
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

  /** 点哪都行 —— 用小手代替“下一步”按钮 */
  protected tapToContinue(onDone: () => void): void {
    const hand = createHand(this, this.W / 2, this.H - 150, 1.15);
    const zone = this.add
      .zone(this.W / 2, this.H / 2, this.W, this.H)
      .setInteractive({ useHandCursor: true });
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      hand.destroy();
      zone.destroy();
      onDone();
    };
    zone.once('destroy', () => {
      done = true;
    });
    zone.once('pointerdown', () => {
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

  /** 界面文案：典故本身的文字走 ctx.content，通用标签走这里 */
  protected tr(key: MessageKey): string {
    this.translator ??= createTranslator(this.ctx.locale);
    return this.translator(key);
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
