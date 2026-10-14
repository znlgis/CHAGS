import type Phaser from 'phaser';
import { THEME, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS, createSortScene, defineGame } from '@chags/templates';
import { drawBeat, drawBoard, drawFinale, drawPlant, drawWorld } from './art';
import type { Mood } from './art';
import { sortLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    // 世界（山、田垄、神农）由这一局自己画：尝到东西时，他的表情会变
    let world: Phaser.GameObjects.Graphics | null = null;
    let mood: Mood = 'idle';
    const setMood = (next: Mood): void => {
      mood = next;
      if (!world) return;
      world.clear();
      drawWorld(world, mood);
    };

    return {
      entry: SCENE_KEYS.sort,
      scenes: [
        createSortScene(ctx, {
          level: sortLevel(ctx.content),
          session,
          nextSceneKey: SCENE_KEYS.reward,
          titleKey: 'scene.taste',
          drawWorld: (scene) => {
            world = scene.add.graphics().setDepth(1);
            drawWorld(world, mood);
          },
          drawBin: (g, bin, highlighted, filled) => drawBoard(g, bin, highlighted, filled),
          drawItem: (g, item, state) => drawPlant(g, item, state),
          onTaste: (item, api) => {
            const kind = item.tastedKind ?? 'food';
            setMood(kind === 'food' ? 'sweet' : kind === 'cure' ? 'cure' : 'poison');
            sparkleAt(api.scene, 375, 300, kind === 'poison' ? 0x8b5fbf : THEME.gold, 7);
            // 毒草只是难受一下：脸上冒会儿星星，就过去了
            api.scene.time.delayedCall(1100, () => {
              setMood('idle');
              api.done();
            });
          },
          drawFinale: (g) => drawFinale(g),
          reveal: ctx.content.keyMoment.reveal,
          revealY: 980,
        }),
      ],
    };
  },
});
