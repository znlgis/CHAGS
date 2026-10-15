import { SCENE_KEYS, createTraceScene, defineGame } from '@chags/templates';
import { ROAD_STROKE, drawBeat, drawFinale, drawRetreatStage, drawWorld } from './art';
import { traceLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = traceLevel(ctx.content);
    /** 已经退了几舍：每退一舍，路标上多刻一道痕 */
    let marched = 0;

    return {
      entry: SCENE_KEYS.trace,
      scenes: [
        createTraceScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 顶栏显示计名（计策游戏的口径与第五辑一致）；titleKey 仍是模板要求的兜底
          titleKey: 'scene.retreat',
          title: ctx.content.title,
          // 这个世界：大平原、北边的山影、南边的城濮城墙
          drawWorld,
          // 每帧重画：晋军连辎重车走到哪儿、尘土追到哪儿、路标刻了几道
          drawStage: (g, stage) =>
            drawRetreatStage(g, stage, level, { marched, now: ctx.services.now() }),
          // 退完一舍：刻痕刻上去，停一下让孩子数清走了多远
          onSegmentDone: (_segment, api) => {
            marched += 1;
            ctx.emit('beat:enter', { beatId: 'retreat:she' + marched });
            let closed = false;
            const finish = (): void => {
              if (closed) return;
              closed = true;
              api.done();
            };
            api.scene.time.delayedCall(900, finish);
            // 兜底：补间被打断也绝不让这一局卡在半路上
            api.scene.time.delayedCall(1600, finish);
          },
          drawFinale: (g) => drawFinale(g, level),
          // 手指划出来的是一条踩出来的土路，不是河道
          stroke: ROAD_STROKE,
          // 关键抉择点的揭晓语：退到人和东西都保得住的地方
          reveal: ctx.content.keyMoment.reveal,
          revealY: 560,
          finaleHoldMs: 5200,
        }),
      ],
    };
  },
});
