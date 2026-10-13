import raw from './caochong-elephant.json';
import rawPangu from './pangu.json';
import { patchFor } from '../i18n';
import { DEFAULT_LOCALE } from '../locale';
import type { Locale } from '../locale';
import { mergeLocalized } from '../localize';
import { AllusionSchema } from '../schema';
import type { AllusionContent } from '../schema';

/** 构建期就用 zod 校验：内容写错不该等到用户点开才发现 */
/** 神话排在信史之前：历史长卷上从上古一路走到明清 */
export const allusions: AllusionContent[] = [
  AllusionSchema.parse(raw),
  AllusionSchema.parse(rawPangu),
];

/** 取某个典故里指定模板的阶段脚本；缺了就早失败，别等玩到一半才发现 */
export function stageScript(content: AllusionContent, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('典故 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}

/** 把某个典故翻译成目标语言（没有译文就原样返回） */
export function localizedAllusion(content: AllusionContent, locale: Locale): AllusionContent {
  if (locale === DEFAULT_LOCALE) return content;
  const patch = patchFor(locale, content.id);
  return patch === undefined ? content : mergeLocalized(content, patch);
}

export function getAllusion(id: string, locale: Locale = DEFAULT_LOCALE): AllusionContent | undefined {
  const base = allusions.find((a) => a.id === id);
  return base === undefined ? undefined : localizedAllusion(base, locale);
}

/** 给大厅/长卷用：按语言取全部典故 */
export function allusionsFor(locale: Locale = DEFAULT_LOCALE): AllusionContent[] {
  return allusions.map((a) => localizedAllusion(a, locale));
}

/** 按年代排序，供历史长卷使用 */
export function allusionsByYear(locale: Locale = DEFAULT_LOCALE): AllusionContent[] {
  return [...allusionsFor(locale)].sort((a, b) => a.yearApprox - b.yearApprox);
}
