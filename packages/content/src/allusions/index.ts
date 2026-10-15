import raw from './caochong-elephant.json';
import rawPangu from './pangu.json';
import rawHouyi from './houyi.json';
import rawNuwa from './nuwa.json';
import rawJingwei from './jingwei.json';
import rawKuafu from './kuafu.json';
import rawYugong from './yugong.json';
import rawShennong from './shennong.json';
import rawQiren from './qiren.json';
import rawFenghuo from './fenghuo.json';
import rawTaigong from './taigong.json';
import rawDayu from './dayu.json';
import rawKezhou from './kezhou.json';
import rawZhaosanmusi from './zhaosanmusi.json';
import rawJiaotu from './jiaotu.json';
import rawYangyouji from './yangyouji.json';
import rawPaoding from './paoding.json';
import { groupBy } from '../groups';
import type { GameGroup } from '../groups';
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
  AllusionSchema.parse(rawHouyi),
  AllusionSchema.parse(rawNuwa),
  AllusionSchema.parse(rawJingwei),
  AllusionSchema.parse(rawKuafu),
  AllusionSchema.parse(rawYugong),
  AllusionSchema.parse(rawShennong),
  AllusionSchema.parse(rawQiren),
  AllusionSchema.parse(rawFenghuo),
  AllusionSchema.parse(rawTaigong),
  AllusionSchema.parse(rawDayu),
  AllusionSchema.parse(rawKezhou),
  AllusionSchema.parse(rawZhaosanmusi),
  AllusionSchema.parse(rawJiaotu),
  AllusionSchema.parse(rawYangyouji),
  AllusionSchema.parse(rawPaoding),
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

/**
 * 大厅与图鉴用：把全部内容按分组归档。
 * **空组也会返回** —— 三十六计现在还没有游戏，但它必须在大厅里占一个位置，
 * 否则"分组"就只是数据结构里的一行，用户看不到。
 * 组内顺序由分组自己的 orderBy 决定（典故按年代，三十六计按登记顺序 / 计策序号）。
 */
export function gameGroups(
  locale: Locale = DEFAULT_LOCALE,
): { group: GameGroup; games: AllusionContent[] }[] {
  return groupBy(allusionsFor(locale)).map(({ group, items }) => ({
    group,
    games:
      group.orderBy === 'year'
        ? [...items].sort((a, b) => a.yearApprox - b.yearApprox)
        : items,
  }));
}
