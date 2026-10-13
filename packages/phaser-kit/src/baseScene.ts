import Phaser from 'phaser';
import type { GameContext, SfxKey } from '@chags/game-kit';
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

/** 儿童向交互基线：点击区域不小于 88×88 逻辑像素 */
export abstract class BaseScene extends Phaser.Scene {
  protected readonly ctx: GameContext;

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
    g.fillStyle(THEME.paper, 1);
    g.fillRect(0, 0, this.W, this.H);
    g.fillStyle(THEME.inkSoft, 1);
    g.fillRect(0, 0, this.W, 150);
    g.fillStyle(THEME.red, 1);
    g.fillRect(0, 144, this.W, 6);
    g.fillStyle(THEME.teal, 1);
    g.fillRect(0, this.H - 18, this.W, 18);
    if (label) {
      this.add.text(this.W / 2, 75, label, textStyle(52, CSS.paper, true)).setOrigin(0.5);
    }
  }

  protected addPanel(
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 32,
    color: number = THEME.card,
    alpha = 1,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x, y, w, h, radius);
    return g;
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

  protected addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ): Phaser.GameObjects.Container {
    const w = opts.width ?? 520;
    const h = opts.height ?? 132;
    const color = opts.color ?? THEME.red;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(4, THEME.ink, 0.14);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);

    const text = this.add
      .text(0, 0, label, {
        ...textStyle(opts.fontSize ?? 44, opts.textColor ?? CSS.paper, true),
        align: 'center',
        // 按钮文字必须能换行：长选项在手机上一定会超宽
        wordWrap: opts.wrap === false ? undefined : { width: w - 64, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(w, h);
    // 显式命中区域，避免 Container 默认命中盒带来的歧义
    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', () => {
      if (opts.disabled) return;
      this.sfx('tap');
      this.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 70,
        yoyo: true,
      });
      onClick();
    });
    return container;
  }

  protected sfx(key: SfxKey): void {
    this.ctx.services.audio.play(key);
  }

  protected speak(text: string): void {
    this.ctx.services.audio.speak(text);
  }

  protected fadeIn(): void {
    if (this.ctx.reducedMotion) return;
    this.cameras.main.fadeIn(220, 23, 24, 29);
  }
}
