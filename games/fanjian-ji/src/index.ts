import { SCENE_KEYS, createTwolinePlantScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { fanjianLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = fanjianLevel(ctx.content);
    return {
      entry: SCENE_KEYS.twoline,
      scenes: [
        // twoline 这一辑长出的新模式：plant（反间计）。stack（暗度陈仓）那条路一行没动。
        createTwolinePlantScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 他踱到哪儿、头转过去没有、案上摆到几成了，都是画面按 state 演的
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：他自己看到的，比说给他听的更算数
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
