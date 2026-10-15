import type Phaser from 'phaser';
import { SCENE_KEYS, createWaitScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import type { WorldState } from './art';
import { waitLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = waitLevel(ctx.content);
    // 世界只画一次；摇头与"对岸散尽了"的时候重画
    const world: WorldState = { phase: 'wait', shake: 0 };
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
          nextSceneKey: SCENE_KEYS.reward,
          // 三十六计：顶栏显示计名（与其它模板一致），不显示"等一等"这个场景动词
          title: ctx.content.title,
          // 一条河、两岸：对岸两拨火堆，自己这一岸一个人坐着
          drawWorld: (scene) => {
            worldGfx = scene.add.graphics().setDepth(1);
            repaint();
          },
          // 每帧重画：河水、对岸的火堆（越烧越小）与走散的人、河边两处渡口
          drawStage: (g, metrics) => drawStage(g, level, metrics),
          // 点了"过河劝架"：曹操摇头，河边起一圈水花 —— 然后就得多等一会儿
          // ★ 700 毫秒后必须调 api.done()，不调会一直卡在"忙"上。
          onTemptation: (temptation, api) => {
            const { scene } = api;
            const shake = { t: 0 };
            scene.tweens.add({
              targets: shake,
              t: 1,
              duration: 700,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                world.shake = Math.sin(shake.t * Math.PI * 3) * 9 * (1 - shake.t);
                repaint();
              },
              onComplete: () => {
                world.shake = 0;
                repaint();
              },
            });
            const splash = scene.add.graphics().setDepth(30);
            splash.lineStyle(7, 0xffffff, 0.85);
            splash.strokeCircle(0, 0, 30);
            splash.setPosition(temptation.x, temptation.y + 46).setScale(0.5);
            scene.tweens.add({
              targets: splash,
              scale: 2.2,
              alpha: 0,
              duration: 620,
              ease: 'Quad.easeOut',
              onComplete: () => splash.destroy(),
            });
            scene.time.delayedCall(700, api.done);
          },
          // 支线：点水面 → 一圈涟漪（不推进进度）
          onTap: (tapX, tapY, api) => {
            const ripple = api.scene.add.graphics().setDepth(20);
            ripple.lineStyle(6, 0xffffff, 0.8);
            ripple.strokeCircle(0, 0, 26);
            ripple.setPosition(tapX, tapY).setScale(0.5);
            api.scene.tweens.add({
              targets: ripple,
              scale: 2.1,
              alpha: 0,
              duration: 620,
              ease: 'Quad.easeOut',
              onComplete: () => ripple.destroy(),
            });
          },
          // 对岸散尽了：他站起来
          onArrive: () => {
            world.phase = 'arrived';
            repaint();
          },
          drawFinale: (g) => drawFinale(g),
          // 关键抉择点的揭晓语进典故卡之前再说一遍
          reveal: ctx.content.keyMoment.reveal,
          revealY: 300,
        }),
      ],
    };
  },
});
