type Json = unknown;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 用翻译补丁覆盖基础内容（基础内容用中文写，翻译单独放，避免把 JSON 写成双语大杂烩）。
 * - 对象：递归合并
 * - 数组：按下标逐个合并（翻译文件必须与原文等长，由 content:check 保证）
 * - 其余：补丁优先
 */
export function mergeLocalized<T>(base: T, patch: Json): T {
  if (patch === undefined) return base;
  if (Array.isArray(base) && Array.isArray(patch)) {
    return base.map((item, index) =>
      index < patch.length ? mergeLocalized(item, patch[index]) : item,
    ) as unknown as T;
  }
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = key in out ? mergeLocalized(out[key], value) : value;
    }
    return out as unknown as T;
  }
  return patch as T;
}

export interface PatchIssue {
  path: string;
  message: string;
}

/** 中日韩字符：英文版里出现它，就说明这个字段漏翻了 */
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/**
 * 找出对象里所有含中日韩字符的字段路径（空数组 = 一个中文字都不剩）。
 *
 * **判据只有这一份**：pnpm content:check（全 53 条 × 全语言）与
 * packages/content/src/localize.test.ts 都调它 —— 以前游戏测试里还抄了 26 份，
 * 加上这两处一共 28 份；改规则要改 28 处，漏一处就有一半内容在裸奔。
 */
export function findCjk(value: unknown, path = ''): string[] {
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

/** 翻译补丁的体检：字段必须存在、数组必须等长 —— 漏翻译不该等到用户切语言才发现 */
export function validatePatch(base: Json, patch: Json, path = ''): PatchIssue[] {
  const issues: PatchIssue[] = [];
  if (patch === undefined) return issues;

  if (Array.isArray(patch)) {
    if (!Array.isArray(base)) {
      issues.push({ path, message: '原文不是数组，译文却是数组' });
      return issues;
    }
    if (patch.length !== base.length) {
      issues.push({
        path,
        message: '数组长度不一致：原文 ' + base.length + ' 项，译文 ' + patch.length + ' 项',
      });
    }
    patch.forEach((item, index) => {
      if (index < base.length) {
        issues.push(...validatePatch(base[index], item, path + '[' + index + ']'));
      }
    });
    return issues;
  }

  if (isPlainObject(patch)) {
    if (!isPlainObject(base)) {
      issues.push({ path, message: '原文不是对象，译文却是对象' });
      return issues;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in base)) {
        issues.push({ path: path + '.' + key, message: '原文里没有这个字段' });
        continue;
      }
      issues.push(...validatePatch(base[key], value, path + '.' + key));
    }
    return issues;
  }

  return issues;
}
