import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { events, loadContent } from './helpers';

interface QuizQuestion { question: string; options: string[]; answer: number; explanation: string }
interface SavedReview { level: number; dueAt: number | null; lastGrade: number | null; reviews: number }
interface SavedEntry { stars: number; completions: number; review: SavedReview }

/** 复习题在"详情"那半：<id>.game.json —— 统一走 helpers.loadContent，不再手写跨包路径 */
function quizOf(id: string): QuizQuestion[] {
  return loadContent(id).quiz;
}

/** 直接读 IndexedDB 存档：复习到底有没有写进"复习计划"，只有存档说了算 */
function savedReview(page: Page, id: string): Promise<SavedEntry> {
  return page.evaluate(
    (entryId) =>
      new Promise<SavedEntry>((resolve, reject) => {
        const open = indexedDB.open('chags', 1);
        open.onerror = () => reject(new Error('打不开存档'));
        open.onsuccess = () => {
          const get = open.result.transaction('kv', 'readonly').objectStore('kv').get('save');
          get.onerror = () => reject(new Error('读不到存档'));
          get.onsuccess = () => {
            const save = get.result as { allusions?: Record<string, SavedEntry> } | undefined;
            const entry = save?.allusions?.[entryId];
            if (!entry) reject(new Error(entryId + ' 还没有存档'));
            else resolve(entry);
          };
        };
      }),
    id,
  );
}

/**
 * 按**选项文字**点击：复习页的选项顺序会被确定性洗牌（防止孩子只点第一个），
 * 所以内容里的 answer 下标不再是屏幕上的位置。找到文字匹配的那个按钮点下去。
 */
async function clickOptionWithText(page: Page, text: string): Promise<void> {
  const options = page.locator('[data-testid^="review-option-"]');
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if ((await option.innerText()).trim() === text.trim()) {
      await option.click();
      return;
    }
  }
  throw new Error('选项里找不到：' + text);
}

/** 玩一局（autoplay 直达），图鉴里才会有这张卡 */
async function finishOnce(page: Page, id: string): Promise<void> {
  await page.goto('/?autoplay=1#/play/' + id);
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('level:complete');
  await expect.poll(() => events(page), { timeout: 60_000 }).toContain('session:exit');
}

/** 从图鉴点进复习页 */
async function openReview(page: Page, id: string): Promise<void> {
  await page.getByTestId('nav-album').click();
  await expect(page.getByTestId('album-card-' + id)).toBeVisible();
  await page.getByTestId('review-start-' + id).click();
  await expect(page.getByTestId('review')).toBeVisible();
}

/**
 * 到期复习：玩一局 → 图鉴 → 做一遍小测验 → 答对率写进复习计划。
 *
 * 这条用例守的是"复习系统真的接上了"：在此之前 gradeFromScore / recordReview / due
 * 全都没有生产调用方，PlayView 只能拿星星当评级（见 docs/技术方案.md §7.4）。
 */
test('复习全对：3 级 → 间隔升到 7 天，存档里留下复习记录', async ({ page }) => {
  const id = 'caochong-elephant';
  const quiz = quizOf(id);

  await finishOnce(page, id);
  await openReview(page, id);

  // 题目与答案都从内容里读，不手抄
  for (const [index, question] of quiz.entries()) {
    await expect(page.getByTestId('review-progress')).toContainText(String(index + 1));
    await expect(page.getByTestId('review-question')).toHaveText(question.question);
    await clickOptionWithText(page, question.options[question.answer]!);
    await expect(page.getByTestId('review-feedback')).toBeVisible();
    await page.getByTestId('review-next').click();
  }

  await expect(page.getByTestId('review-result')).toBeVisible();
  await expect(page.getByTestId('review-score')).toContainText(String(quiz.length));
  await expect(page.getByTestId('review-due')).toBeVisible();

  // 存档：复习过两次（一次通关评级 + 一次复习），评级 3 → 等级 2、间隔 7 天
  const entry = await savedReview(page, id);
  expect(entry.review.reviews).toBe(2);
  expect(entry.review.lastGrade).toBe(3);
  expect(entry.review.level).toBe(2);
  expect(entry.review.dueAt).toBeGreaterThan(Date.now());

  // 回图鉴：卡片还在，星星没被复习改掉
  await page.getByTestId('review-back').click();
  await expect(page.getByTestId('album-card-' + id)).toBeVisible();
  expect(entry.stars).toBe(3);
});

test('复习全错：给出解释、评级 0、间隔回到 1 天，但星星不扣', async ({ page }) => {
  const id = 'nuwa';
  const quiz = quizOf(id);

  await finishOnce(page, id);
  await openReview(page, id);

  for (const question of quiz) {
    // 选项已洗牌：按文字找一个"不是正确答案"的选项点下去
    const wrongText = question.options.find((option) => option !== question.options[question.answer])!;
    await clickOptionWithText(page, wrongText);
    // 答错也要有"为什么"：反馈里必须带上这条内容的解释
    await expect(page.getByTestId('review-feedback')).toContainText(question.explanation);
    await page.getByTestId('review-next').click();
  }

  await expect(page.getByTestId('review-result')).toBeVisible();
  const entry = await savedReview(page, id);
  expect(entry.review.lastGrade).toBe(0);
  expect(entry.review.level).toBe(0);
  expect(entry.stars, '复习答错不该扣星星').toBe(3);
});
/** 把某条内容的复习时间改到"已经过期"：模拟"昨天玩过、今天该复习了" */
function makeDue(page: Page, id: string): Promise<void> {
  return page.evaluate(
    (entryId) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('chags', 1);
        open.onerror = () => reject(new Error('打不开存档'));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('kv', 'readwrite');
          const store = tx.objectStore('kv');
          const get = store.get('save');
          get.onerror = () => reject(new Error('读不到存档'));
          get.onsuccess = () => {
            const save = get.result as {
              allusions: Record<string, { review: { dueAt: number | null } }>;
            };
            const entry = save.allusions[entryId];
            if (!entry) {
              reject(new Error(entryId + ' 还没有存档'));
              return;
            }
            entry.review.dueAt = Date.now() - 1000;
            store.put(save, 'save');
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new Error('写不回存档'));
        };
      }),
    id,
  );
}

test('到期了才会出现徽章与游戏馆横幅（没过期就不打扰）', async ({ page }) => {
  const id = 'nuwa';
  await finishOnce(page, id);

  // 刚玩完：不到期，两个入口都不出现
  await page.getByTestId('nav-album').click();
  await expect(page.getByTestId('album-card-' + id)).toBeVisible();
  await expect(page.getByTestId('album-due-' + id)).toHaveCount(0);
  await expect(page.getByTestId('hall-review')).toHaveCount(0);

  // 把复习时间拨到过去，再进一次首页
  await makeDue(page, id);
  await page.goto('/');
  await expect(page.getByTestId('hall-review')).toBeVisible();
  await expect(page.getByTestId('hall-review')).toContainText('该复习了');

  // 游戏馆的"去复习"直达复习页；图鉴里那张卡也挂上徽章
  await page.getByTestId('hall-review-go').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await page.getByTestId('nav-album').click();
  await expect(page.getByTestId('album-due-' + id)).toBeVisible();
});
