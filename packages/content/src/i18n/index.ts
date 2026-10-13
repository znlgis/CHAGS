import type { Locale } from '../locale';
import enCaochong from './en/caochong-elephant.json';
import enPangu from './en/pangu.json';

/**
 * 典故内容的翻译补丁。结构镜像原文，只写需要翻译的字段。
 * 完整性（缺键、数组长度、译文超长）由 pnpm content:check 在构建期强制。
 */
export const patches: Partial<Record<Locale, Record<string, unknown>>> = {
  en: {
    'caochong-elephant': enCaochong,
    pangu: enPangu,
  },
};

export function patchFor(locale: Locale, id: string): unknown {
  return patches[locale]?.[id];
}
