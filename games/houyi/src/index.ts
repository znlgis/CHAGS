import { createTranslator } from '@chags/i18n';
import { CSS, textStyle } from '@chags/phaser-kit';
import { createAimScene } from '@chags/templates/aim';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import type { AimApi } from '@chags/templates';
import type Phaser from 'phaser';
import { drawArcher, drawBeat, drawScenery, drawSun } from './art';
import { aimLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    const t = createTranslator(ctx.locale);

    // 大地一开始被烤得焦黄；只剩一个太阳时转绿
    let dry = true;
    let warm = false;
    /** "射九留一"之后的宽限期：不马上收工，给好奇的孩子一个射第 10 个的机会 */
    let graceTimer: Phaser.Time.TimerEvent | null = null;

    /**
     * 这个游戏的教学核心全在这里：
     * - 射到只剩 1 个 → 大地回春，收工
     * - 把最后一个也射了 → **天黑**，太阳自己回来，孩子自己撞一次就懂了
     */
    const handleHit = (id: string, api: AimApi): void => {
      const alive = api.aliveIds();

      if (alive.length === 0) {
        // 他真的把最后一个也射了 —— 取消刚才那次"准备收工"
        graceTimer?.remove(false);
        graceTimer = null;
        api.lock(3000);
        ctx.services.audio.play('wrong');

        const night = api.scene.add.rectangle(375, 667, 750, 1334, 0x0a0918, 0).setDepth(900);
        api.scene.tweens.add({ targets: night, alpha: 0.96, duration: 420 });
        const tip = api.scene.add
          .text(375, 655, t('houyi.keepOne'), { ...textStyle(46, CSS.paper, true) })
          .setOrigin(0.5)
          .setDepth(950)
          .setAlpha(0);
        api.scene.tweens.add({ targets: tip, alpha: 1, duration: 360, delay: 520 });

        api.scene.time.delayedCall(1800, () => {
          // 零惩罚：把刚射下的那个太阳放回来
          api.revive(id);
          warm = true;
          dry = false;
          api.redraw();
          api.scene.tweens.add({
            targets: [night, tip],
            alpha: 0,
            duration: 540,
            onComplete: () => {
              night.destroy();
              tip.destroy();
            },
          });
          api.scene.time.delayedCall(780, () => api.complete());
        });
        return;
      }

      if (alive.length === 1) {
        // 射九留一：大地回春。先亮一会儿再收工，留出"再射一箭"的余地
        warm = true;
        dry = false;
        api.redraw();
        ctx.services.audio.play('correct');
        graceTimer = api.scene.time.delayedCall(2400, () => api.complete());
      }
    };

    return {
      entry: SCENE_KEYS.aim,
      scenes: [
        createAimScene(ctx, {
          level: aimLevel(ctx.content),
          session,
          titleKey: 'scene.shoot',
          archer: { x: 340, y: 1030 },
          drawScenery: (g, stage) => drawScenery(g, stage, dry),
          drawArcher,
          drawTarget: (g, _kind, x, y, alive) => {
            if (alive) drawSun(g, x, y, warm);
          },
          onHit: handleHit,
          finaleHoldMs: 2300,
        }),
      ],
    };
  },
});
