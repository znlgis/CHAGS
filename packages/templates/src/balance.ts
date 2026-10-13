import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, textStyle } from '@chags/phaser-kit';
import { depthRatio, judge, markRatio } from './balance.logic';
import type { BalanceVerdict } from './balance.logic';
import { BALANCE, BALANCE_CONTROLS, BALANCE_STONE_BUTTONS, SCENE_KEYS } from './layout';
import type { BalanceLevel, StoneDef } from './schemas';
import type { SessionState } from './session';

export interface BalanceConfig {
  level: BalanceLevel;
  nextSceneKey: string;
  session: SessionState;
}

/**
 * 等量代换：把“称不动的大象”换成一堆能数清楚的石头。
 * 玩家要做的是让船身上的红水痕，正好落到水面上。
 */
export function createBalanceScene(
  ctx: GameContext,
  cfg: BalanceConfig,
): Phaser.Types.Scenes.SceneType {
  return class BalanceScene extends BaseScene {
    private stones: StoneDef[] = [];
    private total = 0;
    private finished = false;
    private countedHeavy = false;
    private boat: Phaser.GameObjects.Graphics | null = null;
    private hint: Phaser.GameObjects.Text | null = null;
    private totalText: Phaser.GameObjects.Text | null = null;

    constructor() {
      super(SCENE_KEYS.balance, ctx);
    }

    create(): void {
      this.drawBackdrop('动手试试');
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.balance });

      const water = this.add.graphics();
      water.fillStyle(THEME.water, 0.75);
      water.fillRect(0, BALANCE.waterY, this.W, BALANCE.waterBottom - BALANCE.waterY);
      water.fillStyle(THEME.waterDeep, 0.5);
      water.fillRect(0, BALANCE.waterBottom - 40, this.W, 40);

      this.addBody(60, BALANCE.promptY, cfg.level.prompt, 40, CSS.ink, this.W - 120);

      this.hint = this.add
        .text(375, BALANCE.hintY, '往船上搬石头吧', textStyle(36, CSS.teal, true))
        .setOrigin(0.5);
      this.totalText = this.add
        .text(375, BALANCE.totalY, '', textStyle(34, CSS.inkSoft))
        .setOrigin(0.5);

      cfg.level.stones.slice(0, BALANCE_STONE_BUTTONS.length).forEach((stone, i) => {
        const pos = BALANCE_STONE_BUTTONS[i];
        if (!pos) return;
        this.addButton(pos.x, pos.y, stone.label + '\n' + stone.value, () => this.addStone(stone), {
          width: 195,
          height: 140,
          color: THEME.wood,
          fontSize: 30,
        });
      });

      this.addButton(BALANCE_CONTROLS.undo.x, BALANCE_CONTROLS.undo.y, '拿走一块', () => this.undo(), {
        width: 250,
        height: 120,
        color: THEME.inkSoft,
        fontSize: 32,
      });
      this.addButton(BALANCE_CONTROLS.reset.x, BALANCE_CONTROLS.reset.y, '重新来', () => this.reset(), {
        width: 250,
        height: 120,
        color: THEME.inkSoft,
        fontSize: 32,
      });

      this.redraw();
      this.fadeIn();

      if (this.autoplay) this.autoSolve();
    }

    private addStone(stone: StoneDef): void {
      if (this.finished) return;
      this.stones.push(stone);
      this.total += stone.value;
      this.sfx('splash');
      this.applyVerdict(judge(this.total, cfg.level));
      this.redraw();
    }

    private undo(): void {
      if (this.finished) return;
      const removed = this.stones.pop();
      if (!removed) return;
      this.total -= removed.value;
      this.sfx('tap');
      this.applyVerdict(judge(this.total, cfg.level));
      this.redraw();
    }

    private reset(): void {
      if (this.finished) return;
      this.stones = [];
      this.total = 0;
      this.countedHeavy = false;
      this.sfx('tap');
      this.hint?.setText('水痕还对不上，继续搬石头');
      this.redraw();
    }

    private applyVerdict(verdict: BalanceVerdict): void {
      if (!this.hint) return;
      if (verdict === 'light') {
        this.hint.setText('船还浮得高高的，再加些石头');
        return;
      }
      if (verdict === 'heavy') {
        this.hint.setText('船沉得太深啦，拿掉一块试试');
        if (!this.countedHeavy) {
          this.countedHeavy = true;
          cfg.session.mistakes += 1;
          this.sfx('wrong');
        }
        return;
      }
      this.succeed();
    }

    private succeed(): void {
      if (this.finished) return;
      this.finished = true;
      this.sfx('correct');
      this.hint?.setText('水痕对上了！石头和大象一样重');
      this.time.delayedCall(900, () => this.scene.start(cfg.nextSceneKey));
    }

    private autoSolve(): void {
      const biggest = [...cfg.level.stones].sort((a, b) => b.value - a.value)[0];
      if (!biggest) return;
      this.time.addEvent({
        delay: 40,
        repeat: 40,
        callback: () => {
          if (this.finished) return;
          this.addStone(biggest);
        },
      });
    }

    private redraw(): void {
      this.boat?.destroy();
      const g = this.add.graphics();
      this.boat = g;

      const depth = depthRatio(this.total, cfg.level);
      const hullH = BALANCE.hullHeight;
      const hullW = BALANCE.hullWidth;
      const halfW = hullW / 2;
      const deckY = BALANCE.waterY - hullH * (1 - depth);
      const markY = deckY + hullH * (1 - markRatio(cfg.level));

      // 石头（先画，压在船身下）
      this.stones.slice(0, 14).forEach((stone, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const radius = stone.value >= 500 ? 26 : stone.value >= 300 ? 20 : 14;
        g.fillStyle(THEME.stone, 1);
        g.fillCircle(375 - halfW / 2 + 60 + col * 48, deckY - 24 - row * 44, radius);
        g.fillStyle(THEME.stoneDeep, 1);
        g.fillCircle(375 - halfW / 2 + 60 + col * 48 + radius * 0.4, deckY - 24 - row * 44, radius * 0.35);
      });

      // 船身
      g.fillStyle(THEME.wood, 1);
      g.fillRoundedRect(375 - halfW, deckY, hullW, hullH, { tl: 16, tr: 16, bl: 48, br: 48 });
      g.lineStyle(6, THEME.woodDeep, 1);
      g.strokeRoundedRect(375 - halfW, deckY, hullW, hullH, { tl: 16, tr: 16, bl: 48, br: 48 });

      // 大象留下的水痕
      g.lineStyle(10, THEME.red, 1);
      g.lineBetween(375 - halfW - 24, markY, 375 + halfW + 24, markY);

      // 水面（半透明）盖住吃水线以下的船身，让“沉下去”看得见
      g.fillStyle(THEME.water, 0.55);
      g.fillRect(0, BALANCE.waterY, this.W, BALANCE.waterBottom - BALANCE.waterY);

      // 水面线：水痕与它重合即为“一样重”
      g.lineStyle(6, 0xffffff, 0.95);
      g.lineBetween(0, BALANCE.waterY, this.W, BALANCE.waterY);

      // 尺寸参考（水痕与水面差多少）
      const delta = markY - BALANCE.waterY;
      g.lineStyle(4, THEME.gold, 0.9);
      g.lineBetween(375 + halfW + 40, BALANCE.waterY, 375 + halfW + 40, markY);
      if (Math.abs(delta) > 4) {
        g.fillStyle(THEME.gold, 1);
        g.fillTriangle(
          375 + halfW + 26,
          BALANCE.waterY + delta / 2,
          375 + halfW + 54,
          BALANCE.waterY + delta / 2 - 12,
          375 + halfW + 54,
          BALANCE.waterY + delta / 2 + 12,
        );
      }

      this.totalText?.setText('船上石头：' + this.total);
    }
  };
}
