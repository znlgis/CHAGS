import type Phaser from 'phaser';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createWaitScene } from '@chags/templates/wait';
import {
  WATER_TOP, drawBeat, drawFinale, drawStage, drawTemptationItem, drawWorld,
} from './art';
import type { WorldState } from './art';
import { waitLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    const level = waitLevel(ctx.content);
    // 世界只画一次；摇头与"他来了"的时候重画
    const world: WorldState = { phase: 'wait', shake: 0 };
    // 点到水面：鱼群散开一会儿（支线，不影响进度）
    const scatter = { until: 0 };
    let worldGfx: Phaser.GameObjects.Graphics | null = null;
    const repaint = (): void => {
      if (!worldGfx) return;
      worldGfx.clear();
      drawWorld(worldGfx, world);
    };

    return {
      entry: SCENE_KEYS.wait,
      scenes: [
        createWaitScene(ctx, {
          level,
          session,
          titleKey: 'scene.wait',
          // 渭水、石头、白发老人、悬在水面之上的直钩
          drawWorld: (scene) => {
            worldGfx = scene.add.graphics().setDepth(1);
            repaint();
          },
          // 每帧重画：太阳与日影、天边的车马、水波与鱼群、底部三个诱惑按钮
          drawStage: (g, metrics) =>
            drawStage(g, level, metrics, {
              scatterUntil: scatter.until,
              now: ctx.services.now(),
            }),
          // 点了诱惑：老人摇摇头，把弯钩 / 鱼饵 / 木牌收起来。
          // ★ 700 毫秒后必须调 api.done()，不调会一直卡在"忙"上。
          onTemptation: (temptation, api) => {
            const { scene } = api;
            const item = scene.add.graphics().setDepth(30);
            drawTemptationItem(item, temptation.kind);
            item.setPosition(252, 536).setScale(0.5).setAlpha(0);
            scene.tweens.add({
              targets: item, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut',
            });
            // 摇头：脑袋左右偏一点（世界重画时才看得到）
            const shake = { t: 0 };
            scene.tweens.add({
              targets: shake,
              t: 1,
              duration: 700,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                world.shake = Math.sin(shake.t * Math.PI * 3) * 10 * (1 - shake.t);
                repaint();
              },
              onComplete: () => {
                world.shake = 0;
                repaint();
              },
            });
            // 把东西收起来：扔回石头上，然后不见
            scene.tweens.add({
              targets: item,
              x: 330,
              y: 668,
              scale: 0.25,
              alpha: 0,
              duration: 260,
              delay: 420,
              onComplete: () => item.destroy(),
            });
            scene.time.delayedCall(700, api.done);
          },
          // 支线：点水面 → 鱼群散开又聚拢；点哪儿都有一个涟漪
          onTap: (x, y, api) => {
            if (y > WATER_TOP) scatter.until = ctx.services.now() + 1400;
            const ripple = api.scene.add.graphics().setDepth(20);
            ripple.lineStyle(6, 0xffffff, 0.85);
            ripple.strokeCircle(0, 0, 26);
            ripple.setPosition(x, y).setScale(0.5);
            api.scene.tweens.add({
              targets: ripple,
              scale: 2.1,
              alpha: 0,
              duration: 620,
              ease: 'Quad.easeOut',
              onComplete: () => ripple.destroy(),
            });
          },
          // 他来了：老人站起来，竿收在石头上，石头上留一圈等小朋友来收的直钩
          onArrive: () => {
            world.phase = 'arrived';
            repaint();
          },
          drawFinale: (g) => drawFinale(g),
          revealY: 300,
        }),
      ],
    };
  },
});
