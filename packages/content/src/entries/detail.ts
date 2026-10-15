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

/** 把某条完整内容翻译成目标语言（没有译文就原样返回） */
export function localizedEntry(content: ContentEntry, locale: Locale): ContentEntry {
  if (locale === DEFAULT_LOCALE) return content;
  const patch = gamePatchFor(locale, content.id);
  return patch === undefined ? content : mergeLocalized(content, patch);
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
