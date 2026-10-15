import { SCENE_KEYS, createMatchupScene, defineGame } from '@chags/templates';
import { citySigns, drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { matchupLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = matchupLevel(ctx.content);
    const en = ctx.locale === 'en';
    return {
      entry: SCENE_KEYS.matchup,
      scenes: [
        createMatchupScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawFinale,
          // 城头上的称呼是 Text（Graphics 画不了字）：场景建好之后挂一次
          decorate: (scene, lvl) => void citySigns(scene, lvl, en ? 'Qin' : '秦'),
          // 关键抉择点的揭晓语：先做什么、后做什么，有讲究
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
