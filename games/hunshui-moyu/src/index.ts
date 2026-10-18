import type Phaser from 'phaser';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createWindowScene } from '@chags/templates/window';
import type { StirStageState } from '@chags/templates';
import { drawBeat, drawFinale, drawWorld } from './art';
import { windowLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = windowLevel(ctx.content);
    const en = ctx.locale === 'en';
    return {
      entry: SCENE_KEYS.window,
      scenes: [
        createWindowScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          drawWorld: (g: Phaser.GameObjects.Graphics, state: StirStageState) =>
            drawWorld(g, state, level),
          drawFinale: (g: Phaser.GameObjects.Graphics) => drawFinale(g),
          // 关键抉择点的揭晓语：先把水搅浑，趁浑水把事办了
          muddyLine: en ? 'Muddy now — grab them' : '浑了，快抓',
          slipLine: en ? 'Too clear — stir it again' : '水清了，再搅一搅',
        }),
      ],
    };
  },
});
