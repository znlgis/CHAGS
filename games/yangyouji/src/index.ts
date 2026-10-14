import type Phaser from 'phaser';
import { createTranslator } from '@chags/i18n';
import { FONT_STACK } from '@chags/phaser-kit';
import { SCENE_KEYS, createAimScene, defineGame } from '@chags/templates';
import { ADVANCE, LEAF_RADII, archerAt } from './layout';
import { drawArcher, drawBeat, drawFinale, drawLeaf, drawScenery } from './art';
import { aimLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = aimLevel(ctx.content);
    const rungs = level.ladder?.rungs ?? [];
    const t = createTranslator(ctx.locale);
    // 已经射中的叶子：由 onHit 记下来，叶子才不会画成"还没射"
    const pierced: string[] = [];
    let distanceText: Phaser.GameObjects.Text | null = null;
    let stepText: Phaser.GameObjects.Text | null = null;
    const leafIndex = new Map(level.targets.map((target, i) => [target.id, i]));

    return {
      entry: SCENE_KEYS.aim,
      scenes: [
        createAimScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          titleKey: 'scene.practice',
          // 一档一档往后退 —— 退到哪儿，箭就从哪儿出去
          archer: (stage) => archerAt(stage.rungIndex),
          onReady: (api) => {
            // 字体必须给 FONT_STACK：写 'inherit' 在 canvas 里是无效字体，
            // 浏览器会退回 10px，中文小得看不见
            distanceText = api.scene.add
              .text(168, 940, '', { fontFamily: FONT_STACK, fontSize: '42px', color: '#b03a31' })
              .setOrigin(0.5)
              .setDepth(20);
            stepText = api.scene.add
              .text(ADVANCE.x, ADVANCE.y, t('aim.stepBack'), {
                fontFamily: FONT_STACK, fontSize: '34px', color: '#fffaf0',
              })
              .setOrigin(0.5)
              .setDepth(20)
              .setVisible(false);
          },
          drawScenery: (g, stage) => {
            drawScenery(g, stage);
            const rung = rungs[stage.rungIndex];
            if (distanceText && rung) distanceText.setText(rung.label);
            const needAdvance = stage.hitIds.length > stage.rungIndex && stage.rungIndex < rungs.length - 1;
            stepText?.setVisible(needAdvance);
          },
          drawArcher: (g, x, y, pull) => drawArcher(g, x, y, pull),
          drawTarget: (g, _kind, x, y, alive, id) => {
            const radius = LEAF_RADII[leafIndex.get(id) ?? 0] ?? 40;
            const state = pierced.includes(id) ? 'hit' : alive ? 'live' : 'wait';
            drawLeaf(g, x, y, radius, state);
          },
          onHit: (targetId, api) => {
            pierced.push(targetId);
            session.total += 1;
            session.correct += 1;
            // 射中最后一档（百步）就收工
            if (targetId === rungs[rungs.length - 1]?.targetId) api.complete();
          },
          drawFinale: (g) => drawFinale(g),
          finaleHoldMs: 2600,
        }),
      ],
    };
  },
});
