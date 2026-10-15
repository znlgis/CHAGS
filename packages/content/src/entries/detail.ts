// 子路径 '@chags/content/full'：完整内容 + 摘要侧的一切（游戏包与内容体检只需要这一个入口）
export * from '../locale';
export * from '../groups';
export * from '../localize';
export * from '../schema';
export * from '../i18n';
export * from './index';
export { gamePatches, gamePatchFor } from '../i18n/game';

import { EntryDetailSchema, ContentEntrySchema } from '../schema';
import type { ContentEntry, EntryDetail } from '../schema';
import { patchFor } from '../i18n';
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
export const entryDetails: Record<string, EntryDetail> = {
  'caochong-elephant': EntryDetailSchema.parse(raw),
  'pangu': EntryDetailSchema.parse(rawPangu),
  'houyi': EntryDetailSchema.parse(rawHouyi),
  'nuwa': EntryDetailSchema.parse(rawNuwa),
  'jingwei': EntryDetailSchema.parse(rawJingwei),
  'kuafu': EntryDetailSchema.parse(rawKuafu),
  'yugong': EntryDetailSchema.parse(rawYugong),
  'shennong': EntryDetailSchema.parse(rawShennong),
  'qiren': EntryDetailSchema.parse(rawQiren),
  'fenghuo': EntryDetailSchema.parse(rawFenghuo),
  'taigong': EntryDetailSchema.parse(rawTaigong),
  'dayu': EntryDetailSchema.parse(rawDayu),
  'kezhou': EntryDetailSchema.parse(rawKezhou),
  'zhaosanmusi': EntryDetailSchema.parse(rawZhaosanmusi),
  'jiaotu': EntryDetailSchema.parse(rawJiaotu),
  'yangyouji': EntryDetailSchema.parse(rawYangyouji),
  'paoding': EntryDetailSchema.parse(rawPaoding),
  'mantian-guohai': EntryDetailSchema.parse(rawMantian),
  'weiwei-jiuzhao': EntryDetailSchema.parse(rawWeiwei),
  'jiedao-sharen': EntryDetailSchema.parse(rawJiedao),
  'yiyi-dailao': EntryDetailSchema.parse(rawYiyi),
  'chenhuo-dajie': EntryDetailSchema.parse(rawChenhuo),
  'shengdong-jixi': EntryDetailSchema.parse(rawShengdong),
  'wuzhong-shengyou': EntryDetailSchema.parse(rawWuzhong),
  'andu-chencang': EntryDetailSchema.parse(rawAndu),
  'gean-guanhuo': EntryDetailSchema.parse(rawGean),
  'xiaoli-cangdao': EntryDetailSchema.parse(rawXiaoli),
  'lidai-taojiang': EntryDetailSchema.parse(rawLidai),
  'shunshou-qianyang': EntryDetailSchema.parse(rawShunshou),
  'dacao-jingshe': EntryDetailSchema.parse(rawDacao),
  'jieshi-huanhun': EntryDetailSchema.parse(rawJieshi),
  'diaohu-lishan': EntryDetailSchema.parse(rawDiaohu),
  'yuqin-guzong': EntryDetailSchema.parse(rawYuqin),
  'paozhuan-yinyu': EntryDetailSchema.parse(rawPaozhuan),
  'qinzei-qinwang': EntryDetailSchema.parse(rawQinzei),
  'fudi-chouxin': EntryDetailSchema.parse(rawFudi),
  'hunshui-moyu': EntryDetailSchema.parse(rawHunshui),
  'jinchan-tuoqiao': EntryDetailSchema.parse(rawJinchan),
  'guanmen-zhuozei': EntryDetailSchema.parse(rawGuanmen),
  'yuanjiao-jingong': EntryDetailSchema.parse(rawYuanjiao),
  'jiadao-faguo': EntryDetailSchema.parse(rawJiadao),
  'touliang-huanzhu': EntryDetailSchema.parse(rawTouliang),
  'zhisang-mahuai': EntryDetailSchema.parse(rawZhisang),
  'jiachi-budian': EntryDetailSchema.parse(rawJiachi),
  'shangwu-chouti': EntryDetailSchema.parse(rawShangwu),
  'shushang-kaihua': EntryDetailSchema.parse(rawShushang),
  'fanke-weizhu': EntryDetailSchema.parse(rawFanke),
  'meiren-ji': EntryDetailSchema.parse(rawMeirenGame),
  'kongcheng-ji': EntryDetailSchema.parse(rawKongchengGame),
  'fanjian-ji': EntryDetailSchema.parse(rawFanjianGame),
  'kurou-ji': EntryDetailSchema.parse(rawKurouGame),
  'lianhuan-ji': EntryDetailSchema.parse(rawLianhuanGame),
  'zou-weishang': EntryDetailSchema.parse(rawZouGame),
};

/** 完整条目：摘要 + 详情（两条记录合并之后再过一次完整 schema） */
export const entries: ContentEntry[] = entrySummaries.map((summary) =>
  ContentEntrySchema.parse({ ...summary, ...entryDetails[summary.id] }),
);

/** 取某个模板的阶段脚本；缺了就早失败，别等玩到一半才发现 */
export function stageScript(content: ContentEntry, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('内容 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}

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
