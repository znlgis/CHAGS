import { expect, test } from '@playwright/test';
import { clickDesign, events, holdDesign } from './helpers';

/**
 * 慢设备回归：把 CPU 降速 6 倍再玩一遍长按玩法。
 *
 * 起因是一次真实的 CI 失败 —— 夸父"按住 3.4 秒"在 CI 上到不了 45%。
 * 根因不是测试写得不对，而是**进度按帧间隔累加**：Phaser 在帧率低时会钳制 delta，
 * 于是慢机器上"按住 6 秒"累积不到 6 秒的进度。
 * 而目标用户里就有旧安卓手机 —— 他们按住 6 秒也追不上太阳。
 *
 * 修法：长按改成按墙钟时间算。这条用例守着它别再退回去。
 */
test.describe('慢设备', () => {
  test('CPU 降速 6 倍时，按住依然能按时到达河渭并通关', async ({ page, context }) => {
    test.setTimeout(180_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    await page.goto('/?story=instant#/play/kuafu');
    await expect(page.locator('canvas')).toBeVisible();
    await expect.poll(() => events(page)).toContain('session:start');

    // 故事页有 350ms 输入锁（防连点跳页）
    await page.waitForTimeout(450);
    await clickDesign(page, 375, 900);
    await page.waitForTimeout(700);
    await clickDesign(page, 375, 900);
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain('scene:enter:tap');

    // 按住约 2.7 秒就该到河渭；给到 4 秒的余量，但**不能靠加时间来掩盖**：慢设备上照样要成立
    await holdDesign(page, 375, 1000, 4000);
    await expect.poll(() => events(page), { timeout: 40_000 }).toContain(
      'beat:enter:milestone:river',
    );
    expect(await events(page)).not.toContain('level:complete');

    // 喝一口再接着追
    await page.waitForTimeout(400);
    await holdDesign(page, 375, 1000, 6000);
    await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  });
});
