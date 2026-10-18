import {
  DEFAULT_LOCALE,
  LOCALES,
  findCjk,
  groupBy,
  isGroupId,
  mergeLocalized,
  splitEntry,
  validatePatch,
} from '@chags/content';
// 完整内容、详情译文与 zod schema：内容体检要的是全量，所以走 '@chags/content/full'
import {
  ContentEntrySchema,
  EntryDetailSchema,
  EntrySummarySchema,
  entries,
  gamePatches,
  patches,
} from '@chags/content/full';
import { templateSchemas } from '../schemas';

let errors = 0;

// 漏翻判据只有一份：packages/content/src/localize.ts 的 findCjk（单测与这里共用）
function fail(message: string): void {
  console.error('  ✗ ' + message);
  errors += 1;
}

console.log('校验 ' + entries.length + ' 个内容条目…\n');

for (const entry of entries) {
  console.log('· ' + entry.title + ' (' + entry.id + ')');

  // 1) 每一段关卡脚本都必须符合它声明的模板
  for (const stage of entry.game.stages) {
    const schema = templateSchemas[stage.template];
    if (!schema) {
      fail('未知玩法模板 "' + stage.template + '"，请在 packages/templates/src/schemas.ts 登记');
      continue;
    }
    const result = schema.safeParse(stage.levelScript);
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail(stage.template + ' 脚本 ' + issue.path.join('.') + ': ' + issue.message);
      }
    }
  }

  // 2) 关键抉择点：现在是“动手做出来”的关键动作，数据用于揭晓语与复习题
  if (!entry.story.some((b) => b.id === entry.keyMoment.beatId)) {
    fail('keyMoment.beatId 不在 story 中');
  }

  // 3) 迁移题是“真的记住”的证据，不能只有记忆题
  if (!entry.quiz.some((q) => q.kind === 'transfer')) {
    fail('缺少 transfer（迁移）题');
  }

  console.log(
    '  · ' +
      (entry.kind === 'myth'
        ? '神话'
        : entry.kind === 'legend'
          ? '传说'
          : entry.kind === 'fable'
            ? '寓言'
            : entry.kind === 'strategy'
              ? '兵法·第 ' + (entry.stratagem?.number ?? '?') + ' 计'
              : '信史') +
      ' / ' + entry.story.length + ' 幕故事' +
      ' / ' + entry.quiz.length + ' 道复习题' +
      ' / ' + entry.game.stages.length + ' 段玩法：' +
      entry.game.stages.map((s) => s.template).join(' → '),
  );
}

// ---------- 唯一性：id 与标题都不能撞车 ----------
// 复制一条内容来改是最常见的加法（"照着女娲再写一个"），
// 撞了 id 的话 getEntry() 只会返回先登记的那一条，而注册表是按集合比的、看不出来。
const seenIds = new Set<string>();
const seenTitles = new Map<string, string>();
for (const entry of entries) {
  if (seenIds.has(entry.id)) fail('内容 id 重复：' + entry.id);
  seenIds.add(entry.id);
  const prev = seenTitles.get(entry.title);
  if (prev !== undefined) fail('标题重复："' + entry.title + '" 同时属于 ' + prev + ' 与 ' + entry.id);
  seenTitles.set(entry.title, entry.id);
}

// ---------- 分组体检：每条内容都要落在一个登记过的分组里 ----------
// 空组不算错：三十六计现在就是空的，大厅会把它显示成"敬请期待"。
console.log('\n分组：');
for (const { group, items } of groupBy(entries)) {
  console.log(
    '  · ' +
      group.id +
      '（' +
      items.length +
      ' 个' +
      (items.length === 0 ? '，空组 → 大厅显示"敬请期待"' : '') +
      '）',
  );
}
for (const entry of entries) {
  if (!isGroupId(entry.group)) {
    fail(entry.id + ' 的分组没有登记："' + entry.group + '"，见 packages/content/src/groups.ts');
  }
}

// ---------- 三十六计体检：序号、套、登记顺序 ----------
// 组内按**登记顺序**排（groups.ts 的 orderBy: 'index'），
// 所以"第几计"必须等于它在数组里的位置，否则大厅里的顺序和计策序号会对不上。
const stratagems = entries.filter((entry) => entry.stratagem !== undefined);
if (stratagems.length > 0) {
  console.log('\n三十六计：' + stratagems.length + ' 计');
  const numbers = stratagems.map((entry) => entry.stratagem!.number);
  const expected = numbers.map((_, index) => index + 1);
  if (numbers.join(',') !== expected.join(',')) {
    fail(
      '三十六计的登记顺序必须与计策序号一致：期望 ' +
        expected.join(',') +
        '，实际 ' +
        numbers.join(','),
    );
  }
  for (const entry of stratagems) {
    const { number, set } = entry.stratagem!;
    // 三十六计的价值引导必须落地（docs/三十六计方案.md 的六条儿童化口径）：
    // 每计一句「今天可以怎么用」的正向迁移 + 一枚思维标签，卡片与图鉴会展示。
    // 英文译文缺失会由下面的"CJK 漏翻"检查兜住。
    if (entry.thinkingTag === undefined || entry.thinkingTag.length === 0) {
      fail('第 ' + number + ' 计（' + entry.title + '）缺少 thinkingTag：思维标签 2–6 字');
    }
    if (entry.transfer === undefined || entry.transfer.length < 12) {
      fail('第 ' + number + ' 计（' + entry.title + '）缺少 transfer：一句 12–30 字的正向迁移');
    }
    console.log('  · 第 ' + number + ' 计（第 ' + set + ' 套）' + entry.title + '｜' + (entry.thinkingTag ?? '?'));
  }
}

// ---------- 翻译体检：缺译文 / 结构对不上 / 译文超长，都在构建期拦下 ----------
for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const table = patches[locale];
  const detailTable = gamePatches[locale];
  if (!table) {
    fail('语言 ' + locale + ' 没有任何摘要译文');
    continue;
  }
  if (!detailTable) {
    fail('语言 ' + locale + ' 没有任何详情译文');
    continue;
  }
  console.log('\n语言 ' + locale + '：');
  for (const entry of entries) {
    // 摘要与详情两半各有各的译文 —— 拆开是为了首屏只加载摘要那一半
    const { summary, detail } = splitEntry(entry);
    const patch = table[entry.id];
    const detailPatch = detailTable[entry.id];
    if (patch === undefined) fail(entry.id + ' 缺少 ' + locale + ' 摘要译文');
    if (detailPatch === undefined) fail(entry.id + ' 缺少 ' + locale + ' 详情译文');
    if (patch === undefined || detailPatch === undefined) continue;
    for (const issue of validatePatch(summary, patch)) {
      fail(entry.id + ' 摘要译文 ' + (issue.path || '(根)') + '：' + issue.message);
    }
    for (const issue of validatePatch(detail, detailPatch)) {
      fail(entry.id + ' 详情译文 ' + (issue.path || '(根)') + '：' + issue.message);
    }
    // 合并之后仍须通过 schema —— 译文太长同样会挡住
    const mergedSummary = EntrySummarySchema.safeParse(mergeLocalized(summary, patch));
    const mergedDetail = EntryDetailSchema.safeParse(mergeLocalized(detail, detailPatch));
    if (!mergedSummary.success) {
      for (const issue of mergedSummary.error.issues) {
        fail(entry.id + ' 摘要译文 ' + issue.path.join('.') + '：' + issue.message);
      }
    }
    if (!mergedDetail.success) {
      for (const issue of mergedDetail.error.issues) {
        fail(entry.id + ' 详情译文 ' + issue.path.join('.') + '：' + issue.message);
      }
    }
    const merged = mergedSummary.success && mergedDetail.success
      ? ContentEntrySchema.safeParse({ ...mergedSummary.data, ...mergedDetail.data })
      : ContentEntrySchema.safeParse(entry);
    if (!mergedSummary.success || !mergedDetail.success || !merged.success) {
      if (!merged.success) {
        for (const issue of merged.error.issues) {
          fail(entry.id + ' 译文 ' + issue.path.join('.') + '：' + issue.message);
        }
      }
    } else {
      // 合并之后，每一段关卡脚本还要重新过一遍模板 schema。
      // 只查内容 schema 是不够的：game.stages[].levelScript 在内容 schema 里是 unknown，
      // 英文译文把 unit 写成 "baskets" 就绕过了所有检查，直到玩家打开游戏才报错。
      for (const [index, stage] of merged.data.game.stages.entries()) {
        const schema = templateSchemas[stage.template];
        if (!schema) continue;
        const result = schema.safeParse(stage.levelScript);
        if (!result.success) {
          for (const issue of result.error.issues) {
            fail(
              entry.id + ' ' + locale + ' 玩法脚本[' + index + '] ' +
                (issue.path.join('.') || '(根)') + '：' + issue.message,
            );
          }
        }
      }

      // 合并后仍含中文 = 有字段漏翻（新增字段时最容易漏）
      const leaks = findCjk(merged.data);
      if (leaks.length > 0) {
        fail(
          entry.id + ' 的 ' + locale + ' 版里还有中文，漏翻字段：' + leaks.join('、'),
        );
      } else {
        console.log('  · ' + merged.data.title);
      }
    }
  }
}

if (errors > 0) {
  console.error('\n内容校验失败：' + errors + ' 个问题');
  process.exit(1);
}
console.log('\n内容校验通过 ✅');
