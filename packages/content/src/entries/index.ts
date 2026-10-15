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
// 三十六计：登记顺序 = 计策序号（组内按登记顺序排，content:check 会守这一条）
import rawMantian from './mantian-guohai.json';
import rawWeiwei from './weiwei-jiuzhao.json';
import rawJiedao from './jiedao-sharen.json';
import rawYiyi from './yiyi-dailao.json';
import rawChenhuo from './chenhuo-dajie.json';
import rawShengdong from './shengdong-jixi.json';
import rawWuzhong from './wuzhong-shengyou.json';
import rawAndu from './andu-chencang.json';
import rawGean from './gean-guanhuo.json';
import rawXiaoli from './xiaoli-cangdao.json';
import rawLidai from './lidai-taojiang.json';
import rawShunshou from './shunshou-qianyang.json';
import rawDacao from './dacao-jingshe.json';
import rawJieshi from './jieshi-huanhun.json';
import rawDiaohu from './diaohu-lishan.json';
import rawYuqin from './yuqin-guzong.json';
import rawPaozhuan from './paozhuan-yinyu.json';
import rawQinzei from './qinzei-qinwang.json';
import { groupBy } from '../groups';
import type { GameGroup } from '../groups';
import { patchFor } from '../i18n';
import { DEFAULT_LOCALE } from '../locale';
import type { Locale } from '../locale';
import { mergeLocalized } from '../localize';
import { ContentEntrySchema } from '../schema';
import type { ContentEntry } from '../schema';

/**
 * 构建期就用 zod 校验：内容写错不该等到用户点开才发现。
 *
 * 两个分组的登记规则不一样：
 * - 典故：神话排在信史之前，历史长卷上从上古一路走到明清（组内按 yearApprox 再排一次）；
 * - 三十六计：**登记顺序就是计策序号**（组内 orderBy: 'index'），1–36 依次往下写。
 */
export const entries: ContentEntry[] = [
  ContentEntrySchema.parse(raw),
  ContentEntrySchema.parse(rawPangu),
  ContentEntrySchema.parse(rawHouyi),
  ContentEntrySchema.parse(rawNuwa),
  ContentEntrySchema.parse(rawJingwei),
  ContentEntrySchema.parse(rawKuafu),
  ContentEntrySchema.parse(rawYugong),
  ContentEntrySchema.parse(rawShennong),
  ContentEntrySchema.parse(rawQiren),
  ContentEntrySchema.parse(rawFenghuo),
  ContentEntrySchema.parse(rawTaigong),
  ContentEntrySchema.parse(rawDayu),
  ContentEntrySchema.parse(rawKezhou),
  ContentEntrySchema.parse(rawZhaosanmusi),
  ContentEntrySchema.parse(rawJiaotu),
  ContentEntrySchema.parse(rawYangyouji),
  ContentEntrySchema.parse(rawPaoding),
  ContentEntrySchema.parse(rawMantian),
  ContentEntrySchema.parse(rawWeiwei),
  ContentEntrySchema.parse(rawJiedao),
  ContentEntrySchema.parse(rawYiyi),
  ContentEntrySchema.parse(rawChenhuo),
  ContentEntrySchema.parse(rawShengdong),
  ContentEntrySchema.parse(rawWuzhong),
  ContentEntrySchema.parse(rawAndu),
  ContentEntrySchema.parse(rawGean),
  ContentEntrySchema.parse(rawXiaoli),
  ContentEntrySchema.parse(rawLidai),
  ContentEntrySchema.parse(rawShunshou),
  ContentEntrySchema.parse(rawDacao),
  ContentEntrySchema.parse(rawJieshi),
  ContentEntrySchema.parse(rawDiaohu),
  ContentEntrySchema.parse(rawYuqin),
  ContentEntrySchema.parse(rawPaozhuan),
  ContentEntrySchema.parse(rawQinzei),
];

/** 取某条内容里指定模板的阶段脚本；缺了就早失败，别等玩到一半才发现 */
export function stageScript(content: ContentEntry, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('内容 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}

/** 把某条内容翻译成目标语言（没有译文就原样返回） */
export function localizedEntry(content: ContentEntry, locale: Locale): ContentEntry {
  if (locale === DEFAULT_LOCALE) return content;
  const patch = patchFor(locale, content.id);
  return patch === undefined ? content : mergeLocalized(content, patch);
}

export function getEntry(id: string, locale: Locale = DEFAULT_LOCALE): ContentEntry | undefined {
  const base = entries.find((a) => a.id === id);
  return base === undefined ? undefined : localizedEntry(base, locale);
}

/** 给大厅/长卷用：按语言取全部内容 */
export function entriesFor(locale: Locale = DEFAULT_LOCALE): ContentEntry[] {
  return entries.map((a) => localizedEntry(a, locale));
}

/** 按年代排序，供历史长卷使用 */
export function entriesByYear(locale: Locale = DEFAULT_LOCALE): ContentEntry[] {
  return [...entriesFor(locale)].sort((a, b) => a.yearApprox - b.yearApprox);
}

/**
 * 大厅与图鉴用：把全部内容按分组归档。
 * **空组也会返回** —— 一个组暂时没有游戏时，它必须在大厅里占一个位置（显示"敬请期待"），
 * 否则"分组"就只是数据结构里的一行，用户看不到。
 * 组内顺序由分组自己的 orderBy 决定（典故按年代，三十六计按登记顺序 / 计策序号）。
 */
export function gameGroups(
  locale: Locale = DEFAULT_LOCALE,
): { group: GameGroup; games: ContentEntry[] }[] {
  return groupBy(entriesFor(locale)).map(({ group, items }) => ({
    group,
    games:
      group.orderBy === 'year'
        ? [...items].sort((a, b) => a.yearApprox - b.yearApprox)
        : items,
  }));
}
