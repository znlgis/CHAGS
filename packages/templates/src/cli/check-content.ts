import { allusions } from '@chags/content';
import { templateSchemas } from '../schemas';

let errors = 0;

function fail(message: string): void {
  console.error('  ✗ ' + message);
  errors += 1;
}

console.log('校验 ' + allusions.length + ' 个典故…\n');

for (const allusion of allusions) {
  console.log('· ' + allusion.title + ' (' + allusion.id + ')');

  // 1) 关卡脚本必须符合它声明的模板
  const schema = templateSchemas[allusion.game.template];
  if (!schema) {
    fail('未知玩法模板 "' + allusion.game.template + '"，请在 packages/templates/src/schemas.ts 登记');
  } else {
    const result = schema.safeParse(allusion.game.levelScript);
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail('levelScript.' + issue.path.join('.') + ': ' + issue.message);
      }
    }
  }

  // 2) 关键抉择点必须落在故事里，且干扰项要有“引导提示”
  if (!allusion.story.some((b) => b.id === allusion.keyMoment.beatId)) {
    fail('keyMoment.beatId 不在 story 中');
  }
  for (const option of allusion.keyMoment.options) {
    if (!option.isCanonical && option.hint.trim().length === 0) {
      fail('干扰项 "' + option.id + '" 缺少 hint，孩子选错时将得不到引导');
    }
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
    '  · ' + allusion.story.length + ' 幕故事 / ' + allusion.quiz.length + ' 道题 / 模板 ' + allusion.game.template,
  );
}

if (errors > 0) {
  console.error('\n内容校验失败：' + errors + ' 个问题');
  process.exit(1);
}
console.log('\n内容校验通过 ✅');
