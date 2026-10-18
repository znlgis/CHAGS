// 子路径 '@chags/content/full'：完整内容 + 摘要侧的一切（游戏包与内容体检只需要这一个入口）
export * from '../locale';
export * from '../groups';
export * from '../localize';
export * from '../schema';
export * from '../i18n';
export * from './index';
export { gamePatches, gamePatchFor } from '../i18n/game';
// 摘要侧的纯工具（node 侧 CLI 与测试也走 full 这一个入口）
export { stageScript } from '../stage';
export { DETAIL_KEYS, SUMMARY_KEYS, splitEntry } from '../split';

import type { ContentEntry, EntryDetail, GameStage, QuizQuestion } from '../schema';
import { patchFor, registerPatches } from '../i18n';
// Node 侧一次注册全量摘要译文（浏览器用不到这里，见 loadEntry.ts）
import { patches as summaryPatches } from '../i18n/en';
registerPatches({ en: summaryPatches });
/** 与旧接口一致：按语言分组的摘要译文补丁（内容体检用） */
export const patches: Partial<Record<Locale, Record<string, unknown>>> = { en: summaryPatches };
import { gamePatchFor } from '../i18n/game';
import { DEFAULT_LOCALE } from '../locale';
import type { Locale } from '../locale';
import { mergeLocalized } from '../localize';
import { entrySummaries } from './index';
import raw from './caochong-elephant.game.json';
import rawPangu from './pangu.game.json';
import rawHouyi from './houyi.game.json';
import rawNuwa from './nuwa.game.json';
import rawJingwei from './jingwei.game.json';
import rawKuafu from './kuafu.game.json';
import rawYugong from './yugong.game.json';
import rawShennong from './shennong.game.json';
import rawQiren from './qiren.game.json';
import rawFenghuo from './fenghuo.game.json';
import rawTaigong from './taigong.game.json';
import rawDayu from './dayu.game.json';
import rawKezhou from './kezhou.game.json';
import rawZhaosanmusi from './zhaosanmusi.game.json';
import rawJiaotu from './jiaotu.game.json';
import rawYangyouji from './yangyouji.game.json';
import rawPaoding from './paoding.game.json';
import rawMantian from './mantian-guohai.game.json';
import rawWeiwei from './weiwei-jiuzhao.game.json';
import rawJiedao from './jiedao-sharen.game.json';
import rawYiyi from './yiyi-dailao.game.json';
import rawChenhuo from './chenhuo-dajie.game.json';
import rawShengdong from './shengdong-jixi.game.json';
import rawWuzhong from './wuzhong-shengyou.game.json';
import rawAndu from './andu-chencang.game.json';
import rawGean from './gean-guanhuo.game.json';
import rawXiaoli from './xiaoli-cangdao.game.json';
import rawLidai from './lidai-taojiang.game.json';
import rawShunshou from './shunshou-qianyang.game.json';
import rawDacao from './dacao-jingshe.game.json';
import rawJieshi from './jieshi-huanhun.game.json';
import rawDiaohu from './diaohu-lishan.game.json';
import rawYuqin from './yuqin-guzong.game.json';
import rawPaozhuan from './paozhuan-yinyu.game.json';
import rawQinzei from './qinzei-qinwang.game.json';
import rawFudi from './fudi-chouxin.game.json';
import rawHunshui from './hunshui-moyu.game.json';
import rawJinchan from './jinchan-tuoqiao.game.json';
import rawGuanmen from './guanmen-zhuozei.game.json';
import rawYuanjiao from './yuanjiao-jingong.game.json';
import rawJiadao from './jiadao-faguo.game.json';
import rawTouliang from './touliang-huanzhu.game.json';
import rawZhisang from './zhisang-mahuai.game.json';
import rawJiachi from './jiachi-budian.game.json';
import rawShangwu from './shangwu-chouti.game.json';
import rawShushang from './shushang-kaihua.game.json';
import rawFanke from './fanke-weizhu.game.json';
import rawMeirenGame from './meiren-ji.game.json';
import rawKongchengGame from './kongcheng-ji.game.json';
import rawFanjianGame from './fanjian-ji.game.json';
import rawKurouGame from './kurou-ji.game.json';
import rawLianhuanGame from './lianhuan-ji.game.json';
import rawZouGame from './zou-weishang.game.json';

/**
 * **详情层**：故事 / 关键抉择 / 复习题 / 误解 / 关卡脚本。
 *
 * 这一层刻意与 `./index.ts`（摘要层）分开：外壳只通过 `loadEntry()` 动态 import 本模块，
 * Vite 因此会把它切成一个懒加载 chunk —— 首屏不会为了渲染卡片把 35 条关卡脚本一起下下来。
 * 游戏包与内容体检直接 import '@chags/content/full'（同步，好写测试）。
 */
/** 同 entries/index.ts：JSON 的字符串字面量会被拓宽，这里只校验结构完整性 */
type RawQuizQuestion = Omit<QuizQuestion, 'kind'> & { kind: string };
type RawStage = Omit<GameStage, 'template'> & { template: string };
type RawDetail = Omit<EntryDetail, 'quiz' | 'game'> & {
  quiz: RawQuizQuestion[];
  game: Omit<EntryDetail['game'], 'template' | 'stages'> & {
    template: string;
    stages: RawStage[];
  };
};

const detailOf = (raw: RawDetail): EntryDetail => raw as EntryDetail;

export const entryDetails: Record<string, EntryDetail> = {
  'caochong-elephant': detailOf(raw),
  'pangu': detailOf(rawPangu),
  'houyi': detailOf(rawHouyi),
  'nuwa': detailOf(rawNuwa),
  'jingwei': detailOf(rawJingwei),
  'kuafu': detailOf(rawKuafu),
  'yugong': detailOf(rawYugong),
  'shennong': detailOf(rawShennong),
  'qiren': detailOf(rawQiren),
  'fenghuo': detailOf(rawFenghuo),
  'taigong': detailOf(rawTaigong),
  'dayu': detailOf(rawDayu),
  'kezhou': detailOf(rawKezhou),
  'zhaosanmusi': detailOf(rawZhaosanmusi),
  'jiaotu': detailOf(rawJiaotu),
  'yangyouji': detailOf(rawYangyouji),
  'paoding': detailOf(rawPaoding),
  'mantian-guohai': detailOf(rawMantian),
  'weiwei-jiuzhao': detailOf(rawWeiwei),
  'jiedao-sharen': detailOf(rawJiedao),
  'yiyi-dailao': detailOf(rawYiyi),
  'chenhuo-dajie': detailOf(rawChenhuo),
  'shengdong-jixi': detailOf(rawShengdong),
  'wuzhong-shengyou': detailOf(rawWuzhong),
  'andu-chencang': detailOf(rawAndu),
  'gean-guanhuo': detailOf(rawGean),
  'xiaoli-cangdao': detailOf(rawXiaoli),
  'lidai-taojiang': detailOf(rawLidai),
  'shunshou-qianyang': detailOf(rawShunshou),
  'dacao-jingshe': detailOf(rawDacao),
  'jieshi-huanhun': detailOf(rawJieshi),
  'diaohu-lishan': detailOf(rawDiaohu),
  'yuqin-guzong': detailOf(rawYuqin),
  'paozhuan-yinyu': detailOf(rawPaozhuan),
  'qinzei-qinwang': detailOf(rawQinzei),
  'fudi-chouxin': detailOf(rawFudi),
  'hunshui-moyu': detailOf(rawHunshui),
  'jinchan-tuoqiao': detailOf(rawJinchan),
  'guanmen-zhuozei': detailOf(rawGuanmen),
  'yuanjiao-jingong': detailOf(rawYuanjiao),
  'jiadao-faguo': detailOf(rawJiadao),
  'touliang-huanzhu': detailOf(rawTouliang),
  'zhisang-mahuai': detailOf(rawZhisang),
  'jiachi-budian': detailOf(rawJiachi),
  'shangwu-chouti': detailOf(rawShangwu),
  'shushang-kaihua': detailOf(rawShushang),
  'fanke-weizhu': detailOf(rawFanke),
  'meiren-ji': detailOf(rawMeirenGame),
  'kongcheng-ji': detailOf(rawKongchengGame),
  'fanjian-ji': detailOf(rawFanjianGame),
  'kurou-ji': detailOf(rawKurouGame),
  'lianhuan-ji': detailOf(rawLianhuanGame),
  'zou-weishang': detailOf(rawZouGame),
};

/**
 * 完整条目：摘要 + 详情。
 *
 * 这里**不再跑 ContentEntrySchema.parse**：结构由两件事保证 ——
 * ① 每个 JSON 的推断类型直接赋给 EntrySummary / EntryDetail（字段漏了/写错在 pnpm typecheck 就红）；
 * ② 构建期 pnpm content:check 用同一套 zod schema 对全量内容（含中英合并后）跑一遍。
 * 运行时再 parse 一次只会把 zod 拖进包里（曾经占首屏 24.7 KB gzip）。
 */
export const entries: ContentEntry[] = entrySummaries.map((summary) => ({
  ...summary,
  ...entryDetails[summary.id],
}));

/**
 * 把某条完整内容翻译成目标语言。
 *
 * ★ **两份补丁都要合上**：摘要字段（标题 / 寓意 / 关键词 / 出处）的译文在 `i18n/index.ts`，
 * 详情字段（故事 / 题 / 关卡）的译文在 `i18n/game.ts`。拆分时这里只合了详情那一份，
 * 结果英文卡面与顶栏露出中文 —— 那是 content:check（自己把两半拼起来查）与
 * 双语巡检（只截图、不认字）都拦不住的一类 bug。
 * 现在 `localize.test.ts` 直接对"运行时取到的英文完整条目"扫中文，堵住它。
 */
export function localizedEntry(content: ContentEntry, locale: Locale): ContentEntry {
  if (locale === DEFAULT_LOCALE) return content;
  const summaryPatch = patchFor(locale, content.id);
  const detailPatch = gamePatchFor(locale, content.id);
  let localized = content;
  if (summaryPatch !== undefined) localized = mergeLocalized(localized, summaryPatch);
  if (detailPatch !== undefined) localized = mergeLocalized(localized, detailPatch);
  return localized;
}

export function getEntry(id: string, locale: Locale = DEFAULT_LOCALE): ContentEntry | undefined {
  const base = entries.find((entry) => entry.id === id);
  return base === undefined ? undefined : localizedEntry(base, locale);
}

/** 完整条目（按语言），给内容体检用 */
export function entriesFor(locale: Locale = DEFAULT_LOCALE): ContentEntry[] {
  return entries.map((entry) => localizedEntry(entry, locale));
}

/** 按年代排序，供历史长卷使用 */
export function entriesByYear(locale: Locale = DEFAULT_LOCALE): ContentEntry[] {
  return [...entriesFor(locale)].sort((a, b) => a.yearApprox - b.yearApprox);
}
