import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, createHand, sparkleAt, textStyle } from '@chags/phaser-kit';
import { SCENE_KEYS } from '@chags/templates/core';
import { drawEggBase, drawEggCracks } from '../art';

export interface ChaosConfig {
  nextSceneKey: string;
  /** 点几下蛋才裂开 */
  tapsToBreak: number;
}

const EGG = { x: 375, y: 700, rx: 208, ry: 248 };

/**
 * 混沌：盘古睡在大鸡蛋里。
 * 孩子连点蛋壳，裂缝一道道出现，最后"轰"地炸开 ——
 * 轻的东西向上飞、重的东西向下沉，谁也没跟他解释什么叫"阳清为天，阴浊为地"。
 */
export function createChaosScene(
  ctx: GameContext,
  cfg: ChaosConfig,
): Phaser.Types.Scenes.SceneType {
  return class ChaosScene extends BaseScene {
    private taps = 0;
    private shell: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private broken = false;

    constructor() {
      super(SCENE_KEYS.chaos, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.chaos });

      const bg = this.add.graphics().setDepth(0);
      bg.fillStyle(0x140f24, 1);
      bg.fillRect(0, 0, this.W, this.H);
      bg.fillStyle(THEME.inkSoft, 1);
      bg.fillRect(0, 0, this.W, 150);
      this.add.text(this.W / 2, 75, this.tr('scene.chaos'), textStyle(52, CSS.paper, true)).setOrigin(0.5).setDepth(1);

      // 蛋里翻滚的混沌：亮粒子与暗块搅在一起
      for (let i = 0; i < 22; i += 1) {
        const a = i * 1.31;
        const r = 30 + (i % 6) * 26;
        const light = i % 2 === 0;
        const dot = this.add.graphics().setDepth(8);
        dot.fillStyle(light ? 0xffe9a8 : 0x120e1f, light ? 0.9 : 0.95);
        dot.fillCircle(0, 0, light ? 11 : 15);
        dot.setPosition(EGG.x + Math.cos(a) * r, EGG.y + Math.sin(a) * r * 0.9);
        this.tweens.add({
          targets: dot,
          x: EGG.x + Math.cos(a + 1.4) * r,
          y: EGG.y + Math.sin(a + 1.4) * r * 0.9,
          duration: 2600 + (i % 5) * 260,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      // 层次：壳底(2) → 混沌粒子(8) → 裂缝(12)
      const shellBase = this.add.graphics().setDepth(2);
      drawEggBase(shellBase, EGG.x, EGG.y, EGG.rx, EGG.ry);
      this.shell = this.add.graphics().setDepth(12);
      this.redrawShell();
      this.hand = createHand(this, EGG.x, EGG.y + 40, 1.4);

      this.input.on('pointerdown', () => this.tap());
      this.fadeIn();

      if (this.autoplay) {
        this.time.addEvent({ delay: 140, repeat: cfg.tapsToBreak - 1, callback: () => this.tap() });
      }
    }

    private redrawShell(): void {
      this.shell?.clear();
      if (this.shell) {
        drawEggCracks(this.shell, EGG.x, EGG.y, EGG.rx, EGG.ry, this.taps);
      }
    }

    private tap(): void {
      if (this.broken) return;
      this.taps += 1;
      this.ctx.services.audio.tone(180 + this.taps * 70, 110);
      this.cameras.main.shake(90, 0.004);
      this.redrawShell();
      if (this.taps === 1) {
        this.hand?.destroy();
        this.hand = null;
      }
      if (this.taps >= cfg.tapsToBreak) this.burst();
    }

    private burst(): void {
      this.broken = true;
      this.shell?.destroy();
      this.shell = null;
      this.sfx('complete');
      this.cameras.main.flash(420, 255, 244, 210);
      sparkleAt(this, EGG.x, EGG.y, THEME.gold, 12);

      // 清升为天、浊降为地 —— 用画面说，不用文字
      for (let i = 0; i < 30; i += 1) {
        const light = i % 2 === 0;
        const speck = this.add.graphics().setDepth(20);
        speck.fillStyle(light ? 0xffe9a8 : 0x2b2340, 1);
        speck.fillCircle(0, 0, light ? 10 : 14);
        const angle = (Math.PI * 2 * i) / 30;
        speck.setPosition(EGG.x + Math.cos(angle) * 40, EGG.y + Math.sin(angle) * 40);
        this.tweens.add({
          targets: speck,
          x: EGG.x + Math.cos(angle) * (140 + (i % 5) * 60),
          y: light
            ? EGG.y - 260 - (i % 7) * 42
            : EGG.y + 320 + (i % 7) * 34,
          alpha: 0,
          scale: light ? 1.5 : 0.6,
          duration: 900,
          ease: light ? 'Quad.easeOut' : 'Quad.easeIn',
          onComplete: () => speck.destroy(),
        });
      }

      this.ctx.emit('beat:enter', { beatId: 'burst' });
      this.time.delayedCall(1100, () => this.scene.start(cfg.nextSceneKey));
    }
  };
}
