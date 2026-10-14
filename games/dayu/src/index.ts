import { SCENE_KEYS, createTapScene, createTraceScene, defineGame } from '@chags/templates';
import {
  CHANNEL_STROKE,
  drawBeat,
  drawBreach,
  drawDikeStage,
  drawFloodStage,
  drawTraceFinale,
  drawTraceWorld,
} from './art';
import { tapLevel, traceLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    const level = traceLevel(ctx.content);
    /** 已经划完几段：水位就降几格，退出来的地长绿苗 */
    let drained = 0;
    /** 正在演的"三过家门"（每划完一段演一次，1.5 秒） */
    let home: { nth: number; p: number } | null = null;

    return {
      entry: SCENE_KEYS.tap,
      scenes: [
        // 堵：一筐一筐把堤筑高 —— 水也一直在涨，只是涨得慢一点点
        createTapScene(ctx, {
          level: tapLevel(ctx.content),
          session,
          nextSceneKey: SCENE_KEYS.trace,
          titleKey: 'scene.dike',
          drawStage: drawDikeStage,
          // 第十下：水漫过堤顶，堤塌开一道口子
          drawFinale: drawBreach,
          finaleHoldMs: 2600,
        }),
        // 疏：手指划出一条河道，把水一路送到大海
        createTraceScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          titleKey: 'scene.guide',
          drawWorld: drawTraceWorld,
          drawStage: (g, stage) =>
            drawFloodStage(g, stage, { done: drained, now: ctx.services.now() }, home),
          // 每划完一段：路过一次家门口，窗里亮着灯，他都没有进去
          onSegmentDone: (_segment, api) => {
            drained += 1;
            ctx.emit('beat:enter', { beatId: 'walk:home' });
            const state = { p: 0 };
            home = { nth: drained, p: 0 };
            let closed = false;
            const finish = (): void => {
              if (closed) return;
              closed = true;
              home = null;
              api.done();
            };
            api.scene.tweens.add({
              targets: state,
              p: 1,
              duration: 1150,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                if (home) home.p = state.p;
              },
            });
            api.scene.time.delayedCall(1500, finish);
            // 兜底：补间被打断也绝不让这一局卡在门口
            api.scene.time.delayedCall(2400, finish);
          },
          drawFinale: (g) => drawTraceFinale(g, level),
          stroke: CHANNEL_STROKE,
          reveal: ctx.content.keyMoment.reveal,
          revealY: 620,
          finaleHoldMs: 5600,
        }),
      ],
    };
  },
});
