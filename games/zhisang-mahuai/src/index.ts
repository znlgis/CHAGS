import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createProbeScene } from '@chags/templates/probe';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { zhisangLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = zhisangLevel(ctx.content);
    return {
      entry: SCENE_KEYS.probe,
      scenes: [
        createProbeScene(ctx, {
          level,
          session,
          // 他往前走的那几格、敲过的那几样，都是画面按 state 演的
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：不点名、不硬顶 —— 换个说法，他自己就听进去了
        }),
      ],
    };
  },
});
