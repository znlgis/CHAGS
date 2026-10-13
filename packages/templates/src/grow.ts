import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import {
  BaseScene, CSS, THEME, createHand, roundRect, shade, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import { comboLevel, gapFor, isGrowComplete, progressFor, tapsNeeded } from './grow.logic';
import { GROW, SCENE_KEYS } from './layout';
import type { GrowLevel } from './schemas';
import type { SessionState } from './session';

export interface GrowConfig {
  level: GrowLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 画那个被"撑长"的人（盘古 / 愚公 / 精卫…），由游戏包决定，模板不认识他 */
  drawFigure: (
    g: Phaser.GameObjects.Graphics,
    cx: number,
    top: number,
    bottom: number,
  ) => void;
}

/**
 * 坚持：连点屏幕，把天一点点撑高。
 * 每点一次，天升一丈、地降一丈、中间那个人长高一丈 —— 原文
 * 「天日高一丈，地日厚一丈，盘古日长一丈，如此万八千岁」直接变成手指上的动作。
 */
export function createGrowScene(ctx: GameContext, cfg: GrowConfig): Phaser.Types.Scenes.SceneType {
  return class GrowScene extends BaseScene {
    private value = 0;
    private world: Phaser.GameObjects.Graphics | null = null;
    private decorations: Phaser.GameObjects.Graphics | null = null;
    private counterText: Phaser.GameObjects.Text | null = null;
    private counterPill: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private lastTapAt = 0;
    private tapped = false;
    private finished = false;

    constructor() {
      super(SCENE_KEYS.grow, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.grow });

      // 深色虚空：天地撑开之前，中间是空的
      const bg = this.add.graphics().setDepth(0);
      bg.fillStyle(THEME.ink, 1);
      bg.fillRect(0, 0, this.W, this.H);
      bg.fillStyle(THEME.inkSoft, 1);
      bg.fillRect(0, 0, this.W, 150);
      this.add.text(this.W / 2, 75, '撑一撑', textStyle(52, CSS.paper, true)).setOrigin(0.5).setDepth(1);

      this.world = this.add.graphics().setDepth(10);
      this.decorations = this.add.graphics().setDepth(12);

      this.counterPill = this.add.graphics().setDepth(50);
      this.counterText = this.add
        .text(this.W / 2, GROW.counterY, '', textStyle(66, CSS.ink, true))
        .setOrigin(0.5)
        .setDepth(51);

      this.hand = createHand(this, this.W / 2, 900, 1.3);
      this.input.on('pointerdown', () => this.push());

      this.redraw();
      this.fadeIn();

      if (this.autoplay) {
        this.time.addEvent({
          delay: 90,
          repeat: tapsNeeded(cfg.level) - 1,
          callback: () => this.push(),
        });
      }
    }

    private push(): void {
      if (this.finished) return;
      const now = this.ctx.services.now();
      const combo = this.lastTapAt === 0 ? 0 : comboLevel(now - this.lastTapAt);
      this.lastTapAt = now;

      this.value = Math.min(this.value + cfg.level.stepValue, cfg.level.targetValue);
      const progress = progressFor(this.value, cfg.level);

      // 天地撑开时，音调跟着往上走 —— 进度是听得见的
      this.ctx.services.audio.tone(300 + progress * 520, 90);

      if (!this.tapped) {
        this.tapped = true;
        this.hand?.destroy();
        this.hand = null;
      }
      this.ctx.emit('beat:enter', { beatId: 'push' });

      this.redraw();
      if (combo >= 2) {
        sparkleAt(this, this.W / 2, GROW.centerY, THEME.gold, combo);
      }
      this.cameras.main.shake(60, 0.0015);

      if (isGrowComplete(this.value, cfg.level)) this.complete();
    }

    private gap(): number {
      return gapFor(this.value, cfg.level);
    }

    private redraw(): void {
      const g = this.world;
      if (!g) return;
      g.clear();

      const gap = this.gap();
      const skyBottom = GROW.centerY - gap / 2;
      const earthTop = GROW.centerY + gap / 2;
      const progress = progressFor(this.value, cfg.level);

      // 天：随着撑高逐渐变亮、变蓝
      const skyH = Math.max(20, skyBottom - GROW.skyTop);
      roundRect(g, -40, GROW.skyTop - 40, this.W + 80, skyH + 40, 44, shade(THEME.sky, 1 - progress * 0.06), THEME.outline, 7);
      if (skyH > 130) {
        g.fillStyle(0xffffff, 0.85);
        for (const [cx, cy, cs] of [[150, 0.55, 1], [560, 0.35, 0.75], [330, 0.8, 0.6]] as const) {
          const y = GROW.skyTop + skyH * cy;
          g.fillCircle(cx, y, 30 * cs);
          g.fillCircle(cx + 38 * cs, y - 12 * cs, 38 * cs);
          g.fillCircle(cx + 78 * cs, y, 26 * cs);
        }
      }

      // 地：随着下沉堆积出山峦
      const earthH = Math.max(20, GROW.earthBottom - earthTop);
      roundRect(g, -40, earthTop, this.W + 80, earthH + 60, { tl: 60, tr: 60, bl: 0, br: 0 }, THEME.sand, THEME.outline, 7);
      if (earthH > 120) {
        g.fillStyle(THEME.sandDeep, 1);
        g.fillTriangle(120, earthTop + 90, 250, earthTop + 90, 185, earthTop + 10);
        g.fillTriangle(430, earthTop + 90, 600, earthTop + 90, 515, earthTop + 25);
        g.lineStyle(6, THEME.outline, 1);
        g.strokeTriangle(120, earthTop + 90, 250, earthTop + 90, 185, earthTop + 10);
        g.strokeTriangle(430, earthTop + 90, 600, earthTop + 90, 515, earthTop + 25);
      }

      cfg.drawFigure(g, this.W / 2, skyBottom, earthTop);
      this.redrawCounter();
    }

    private redrawCounter(): void {
      const text = this.counterText;
      const pill = this.counterPill;
      if (!text || !pill) return;
      text.setText(this.value + ' ' + cfg.level.unit);
      const w = text.width + 76;
      const h = text.height + 36;
      pill.clear();
      roundRect(pill, this.W / 2 - w / 2, GROW.counterY - h / 2, w, h, h / 2, THEME.card, THEME.outline, 6);
    }

    private complete(): void {
      if (this.finished) return;
      this.finished = true;
      // 通关只在典故卡那里上报一次，这里不重复发事件
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, GROW.centerY, THEME.gold, 10);

      // 天成了：日月星辰；地成了：山川成形
      const d = this.decorations;
      if (d) {
        d.clear();
        const skyBottom = GROW.centerY - this.gap() / 2;
        d.fillStyle(THEME.gold, 1);
        d.fillCircle(150, skyBottom - 90, 42);
        d.fillStyle(THEME.card, 1);
        d.fillCircle(600, skyBottom - 110, 34);
        d.fillStyle(THEME.card, 0.9);
        for (const [sx, sy] of [[300, 60], [420, 100], [240, 140], [520, 50], [660, 150]] as const) {
          d.fillCircle(sx, skyBottom - (skyBottom - GROW.skyTop) * 0.25 + sy * 0.3, 5);
        }
      }
      this.time.delayedCall(1900, () => this.scene.start(cfg.nextSceneKey));
    }
  };
}
