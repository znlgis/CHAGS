import {
  AllusionSchema,
  DEFAULT_LOCALE,
  LOCALES,
  allusions,
  mergeLocalized,
  patches,
  validatePatch,
} from '@chags/content';
import { templateSchemas } from '../schemas';

let errors = 0;

/** 中日韩字符：英文版里出现它，就说明这个字段漏翻了 */
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function findCjk(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return CJK.test(value) ? [path] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findCjk(item, path + '[' + index + ']'));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      findCjk(item, path === '' ? key : path + '.' + key),
    );
  }
  return [];
}

function fail(message: string): void {
  console.error('  ✗ ' + message);
  errors += 1;
}

console.log('校验 ' + allusions.length + ' 个典故…\n');

for (const allusion of allusions) {
  console.log('· ' + allusion.title + ' (' + allusion.id + ')');

  // 1) 每一段关卡脚本都必须符合它声明的模板
  for (const stage of allusion.game.stages) {
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
  if (!allusion.story.some((b) => b.id === allusion.keyMoment.beatId)) {
    fail('keyMoment.beatId 不在 story 中');
  }

  // 3) 迁移题是“真的记住”的证据，不能只有记忆题
  if (!allusion.quiz.some((q) => q.kind === 'transfer')) {
    fail('缺少 transfer（迁移）题');
  }

  // 4) 声明了插图就必须存在对应文件（阶段 0 用 none 占位）
  const beats = allusion.story.filter((b) => b.illustration !== 'none');
  if (beats.length > 0) {
    console.log('  · 有 ' + beats.length + ' 幕使用图片资源，确认已放入 games/' + allusion.id + '/public');
  }

  console.log(
    '  · ' + (allusion.kind === 'myth' ? '神话' : '信史') +
      ' / ' + allusion.story.length + ' 幕故事' +
      ' / ' + allusion.quiz.length + ' 道复习题' +
      ' / ' + allusion.game.stages.length + ' 段玩法：' +
      allusion.game.stages.map((s) => s.template).join(' → '),
  );
}

// ---------- 翻译体检：缺译文 / 结构对不上 / 译文超长，都在构建期拦下 ----------
for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;
  const table = patches[locale];
  if (!table) {
    fail('语言 ' + locale + ' 没有任何典故译文');
    continue;
  }
  console.log('\n语言 ' + locale + '：');
  for (const allusion of allusions) {
    const patch = table[allusion.id];
    if (patch === undefined) {
      fail(allusion.id + ' 缺少 ' + locale + ' 译文');
      continue;
    }
    const issues = validatePatch(allusion, patch);
    for (const issue of issues) {
      fail(allusion.id + ' 译文 ' + (issue.path || '(根)') + '：' + issue.message);
    }
    // 合并之后仍须通过内容 schema —— 译文太长同样会挡住
    const merged = AllusionSchema.safeParse(mergeLocalized(allusion, patch));
    if (!merged.success) {
      for (const issue of merged.error.issues) {
        fail(allusion.id + ' 译文 ' + issue.path.join('.') + '：' + issue.message);
      }
    } else {
      // 合并后仍含中文 = 有字段漏翻（新增字段时最容易漏）
      const leaks = findCjk(merged.data);
      if (leaks.length > 0) {
        fail(
          allusion.id + ' 的 ' + locale + ' 版里还有中文，漏翻字段：' + leaks.join('、'),
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
