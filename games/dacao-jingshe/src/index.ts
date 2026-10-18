import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createProbeScene } from '@chags/templates/probe';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { dacaoLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = dacaoLevel(ctx.content);
    return {
      entry: SCENE_KEYS.probe,
      scenes: [
        createProbeScene(ctx, {
          level,
          session,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：先拨一处看清楚，再决定动不动手
        }),
      ],
    };
  },
});
