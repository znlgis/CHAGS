import { groupBy } from '../groups';
import type { GameGroup } from '../groups';
import { patchFor } from '../i18n';
import { DEFAULT_LOCALE } from '../locale';
import type { Locale } from '../locale';
import { mergeLocalized } from '../localize';
import { EntrySummarySchema } from '../schema';
import type { EntrySummary } from '../schema';
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
import rawFudi from './fudi-chouxin.json';
import rawHunshui from './hunshui-moyu.json';
import rawJinchan from './jinchan-tuoqiao.json';
import rawGuanmen from './guanmen-zhuozei.json';
import rawYuanjiao from './yuanjiao-jingong.json';
import rawJiadao from './jiadao-faguo.json';
import rawTouliang from './touliang-huanzhu.json';
import rawZhisang from './zhisang-mahuai.json';
import rawJiachi from './jiachi-budian.json';
import rawShangwu from './shangwu-chouti.json';
import rawShushang from './shushang-kaihua.json';
import rawFanke from './fanke-weizhu.json';
import rawMeiren from './meiren-ji.json';
import rawKongcheng from './kongcheng-ji.json';
import rawFanjian from './fanjian-ji.json';
import rawKurou from './kurou-ji.json';
import rawLianhuan from './lianhuan-ji.json';
import rawZou from './zou-weishang.json';

/**
 * **摘要层**：大厅与图鉴要用的那一小部分（标题 / 拼音 / 年代 / 寓意 / 关键词 / 出处…）。
 *
 * 这一层是首屏唯一的"内容"依赖 —— 故事、复习题与关卡脚本在 `./detail.ts` 里，
 * 由 `loadEntry()` 在进入游戏时动态加载（见 src/loadEntry.ts）。
 * 拆开之前，首屏 125.5 KB gzip 里有 65.4 KB 是内容（52%）：大厅为了渲染卡片，
 * 把 35 条内容的故事与关卡脚本一起下了下来。schema 分三层就是为了让这件事不再发生。
 *
 * 两个分组的登记规则不一样：
 * - 典故：神话排在信史之前，历史长卷上从上古一路走到明清（组内按 yearApprox 再排一次）；
 * - 三十六计：**登记顺序就是计策序号**（组内 orderBy: 'index'），1–36 依次往下写。
 */
export const entrySummaries: EntrySummary[] = [
  EntrySummarySchema.parse(raw),
  EntrySummarySchema.parse(rawPangu),
  EntrySummarySchema.parse(rawHouyi),
  EntrySummarySchema.parse(rawNuwa),
  EntrySummarySchema.parse(rawJingwei),
  EntrySummarySchema.parse(rawKuafu),
  EntrySummarySchema.parse(rawYugong),
  EntrySummarySchema.parse(rawShennong),
  EntrySummarySchema.parse(rawQiren),
  EntrySummarySchema.parse(rawFenghuo),
  EntrySummarySchema.parse(rawTaigong),
  EntrySummarySchema.parse(rawDayu),
  EntrySummarySchema.parse(rawKezhou),
  EntrySummarySchema.parse(rawZhaosanmusi),
  EntrySummarySchema.parse(rawJiaotu),
  EntrySummarySchema.parse(rawYangyouji),
  EntrySummarySchema.parse(rawPaoding),
  EntrySummarySchema.parse(rawMantian),
  EntrySummarySchema.parse(rawWeiwei),
  EntrySummarySchema.parse(rawJiedao),
  EntrySummarySchema.parse(rawYiyi),
  EntrySummarySchema.parse(rawChenhuo),
  EntrySummarySchema.parse(rawShengdong),
  EntrySummarySchema.parse(rawWuzhong),
  EntrySummarySchema.parse(rawAndu),
  EntrySummarySchema.parse(rawGean),
  EntrySummarySchema.parse(rawXiaoli),
  EntrySummarySchema.parse(rawLidai),
  EntrySummarySchema.parse(rawShunshou),
  EntrySummarySchema.parse(rawDacao),
  EntrySummarySchema.parse(rawJieshi),
  EntrySummarySchema.parse(rawDiaohu),
  EntrySummarySchema.parse(rawYuqin),
  EntrySummarySchema.parse(rawPaozhuan),
  EntrySummarySchema.parse(rawQinzei),
  EntrySummarySchema.parse(rawFudi),
  EntrySummarySchema.parse(rawHunshui),
  EntrySummarySchema.parse(rawJinchan),
  EntrySummarySchema.parse(rawGuanmen),
  EntrySummarySchema.parse(rawYuanjiao),
  EntrySummarySchema.parse(rawJiadao),
  EntrySummarySchema.parse(rawTouliang),
  EntrySummarySchema.parse(rawZhisang),
  EntrySummarySchema.parse(rawJiachi),
  EntrySummarySchema.parse(rawShangwu),
  EntrySummarySchema.parse(rawShushang),
  EntrySummarySchema.parse(rawFanke),
  EntrySummarySchema.parse(rawMeiren),
  EntrySummarySchema.parse(rawKongcheng),
  EntrySummarySchema.parse(rawFanjian),
  EntrySummarySchema.parse(rawKurou),
  EntrySummarySchema.parse(rawLianhuan),
  EntrySummarySchema.parse(rawZou),
];

/** 把某条摘要翻译成目标语言（没有译文就原样返回） */
export function localizedSummary(summary: EntrySummary, locale: Locale): EntrySummary {
  if (locale === DEFAULT_LOCALE) return summary;
  const patch = patchFor(locale, summary.id);
  return patch === undefined ? summary : mergeLocalized(summary, patch);
}

export function getEntrySummary(id: string, locale: Locale = DEFAULT_LOCALE): EntrySummary | undefined {
  const base = entrySummaries.find((entry) => entry.id === id);
  return base === undefined ? undefined : localizedSummary(base, locale);
}

/** 给大厅/图鉴用：按语言取全部摘要 */
export function summariesFor(locale: Locale = DEFAULT_LOCALE): EntrySummary[] {
  return entrySummaries.map((entry) => localizedSummary(entry, locale));
}

/**
 * 大厅与图鉴用：把全部内容按分组归档。
 * **空组也会返回** —— 一个组暂时没有游戏时，它必须在大厅里占一个位置（显示"敬请期待"），
 * 否则"分组"就只是数据结构里的一行，用户看不到。
 * 组内顺序由分组自己的 orderBy 决定（典故按年代，三十六计按登记顺序 / 计策序号）。
 */
export function gameGroups(
  locale: Locale = DEFAULT_LOCALE,
): { group: GameGroup; games: EntrySummary[] }[] {
  return groupBy(summariesFor(locale)).map(({ group, items }) => ({
    group,
    games:
      group.orderBy === 'year'
        ? [...items].sort((a, b) => a.yearApprox - b.yearApprox)
        : items,
  }));
}
