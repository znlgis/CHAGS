import { describe, expect, it } from 'vitest';
import { entries, getEntry } from './entries/detail';

/** 中日韩字符：英文版里出现它，就说明有字段漏翻了 */
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function findCjk(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return CJK.test(value) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, i) => findCjk(item, path + '[' + i + ']'));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      findCjk(item, path === '' ? key : path + '.' + key),
    );
  }
  return [];
}

/**
 * 走**运行时那条路**（getEntry → localizedEntry）检查译文，而不是自己把补丁拼起来。
 *
 * 这条用例补的是一个真实的坑：内容拆成"摘要 + 详情"两半之后，`localizedEntry` 只合了详情补丁，
 * 英文卡面与顶栏因此露出中文 —— 而 content:check（自己把两半拼起来再查）与
 * 双语巡检（只截图、不认字）都放过了它。所以这里必须从 getEntry 取。
 */
describe('完整条目的译文（运行时路径）', () => {
  it('英文版里一个中文字都不剩 —— 摘要与详情两份补丁都要合上', () => {
    const leaks: string[] = [];
    for (const entry of entries) {
      const localized = getEntry(entry.id, 'en');
      expect(localized, entry.id + ' 没有英文版').toBeDefined();
      const fields = findCjk(localized);
      if (fields.length > 0) leaks.push(entry.id + '：' + fields.join('、'));
    }
    expect(leaks, '英文版里还有中文，漏翻字段：\n' + leaks.join('\n')).toEqual([]);
  });

  it('中文版就是原文（不走补丁）', () => {
    for (const entry of entries) {
      expect(getEntry(entry.id)?.title).toBe(entry.title);
    }
  });
});
