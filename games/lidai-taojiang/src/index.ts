import { SCENE_KEYS, createMatchupScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawHorse, drawStage, drawWorld, rivalSigns } from './art';
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
          startLabel: en ? 'Start the races' : '开赛',
          resetLabel: en ? 'Line them up again' : '重新编排',
          drawWorld,
          drawStage,
          drawHorse,
          drawFinale,
          // 木牌上的称呼是 Text（Graphics 画不了字）：场景建好之后挂一次
          decorate: (scene, lvl) => void rivalSigns(scene, lvl),
          // 关键抉择点的揭晓语：舍一局，赢整场
          reveal: ctx.content.keyMoment.reveal,
          // 输一局时说的话 —— 孩子要看出"这是故意的"，不是被罚了
          lostLine: en ? 'We give this race away.' : '这一局我们认了',
        }),
      ],
    };
  },
});
