import { GROUPS, isGroupId } from './groups';
import { z } from 'zod';

/** 记忆巩固题 / 迁移题 —— kind: 'transfer' 才是真正“记住了”的证据 */
export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['recall', 'transfer']).default('recall'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int().min(0),
  explanation: z.string().min(1),
});

/** 故事分幕：每幕屏幕文字不超过一句话，配音文本可以更长 */
export const StoryBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 屏幕上的一句话。中日文卡得紧，英文天然更长，所以上限按英文给 */
  text: z.string().max(90),
  narration: z.string().min(1),
  illustration: z.string().min(1).default('none'),
});

export const KeyMomentOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCanonical: z.boolean(),
  hint: z.string().default(''),
});

/** ★ 关键抉择点：玩法的种子。没有它，一条内容就只是看动画。 */
export const KeyMomentSchema = z.object({
  beatId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(KeyMomentOptionSchema).min(2).max(4),
  reveal: z.string().min(1),
});

export const SourceSchema = z.object({
  book: z.string().min(1),
  chapter: z.string().optional(),
  quote: z.string().min(1),
});

/** 一条内容可以由多段玩法拼成（例如盘古 = 撑天 + 化身、围魏救赵 = 双线 + 要害） */
export const GameStageSchema = z.object({
  template: z.string().min(1),
  levelScript: z.unknown(),
});

/** 三十六计一共六套（胜战 / 敌战 / 攻战 / 混战 / 并战 / 败战），套名是界面文案，见 i18n */
export const STRATAGEM_SETS = 6;

/**
 * 三十六计专属字段。
 * 序号既是"第几计"，也是它在大厅里的排列位置（stratagem 组按登记顺序排）。
 *
 * **按语不在这里**：它写在 `source` 里（book = 《三十六计·X套》，quote = 按语原文）。
 * 这里只留结构性的两个字段，免得同一句原文在一条内容里出现两遍。
 */
export const StratagemSchema = z.object({
  /** 计策序号 1–36 */
  number: z.number().int().min(1).max(36),
  /** 第几套：1 = 胜战计 … 6 = 败战计 */
  set: z.number().int().min(1).max(STRATAGEM_SETS),
});

/**
 * 一条内容的字段分成两半，**因为它们进的是不同的包**：
 *
 * - **摘要**（`<id>.json`）：大厅与图鉴要用的那一小部分 —— 首屏只加载这些；
 * - **详情**（`<id>.game.json`）：故事 / 关键抉择 / 复习题 / 关卡脚本 —— 只有进了游戏才需要，
 *   由 `loadEntry()` 动态加载（见 src/loadEntry.ts）。
 *
 * 拆开之前，首屏 125.5 KB gzip 里有 65.4 KB 是内容（52%）：大厅为了渲染卡片，
 * 把 35 条内容的故事与关卡脚本一起下了下来。schema 分三层，就是为了让这件事不可能再发生。
 */
const summaryFields = {
    id: z.string().regex(/^[a-z0-9-]+$/, 'id 只能是小写字母、数字与连字符'),
    /**
     * 属于哪个分组（典故 / 三十六计 / …）。**刻意不给默认值**：
     * 以后新增一组的游戏时忘了写，应该在这里当场报错，
     * 而不是被默认值悄悄归到"典故"里去。
     */
    group: z
      .string()
      .min(1)
      .refine(isGroupId, {
        message: '分组没有登记：' + GROUPS.map((g) => g.id).join(' / ') + '（见 groups.ts）',
      }),
    /**
     * 信史 / 神话 / 传说 / 寓言 / 兵法：游戏馆按它挂徽章。
     * 三十六计是 strategy（兵法）—— 它们不是"故事"，是"招数"。
     */
    kind: z.enum(['history', 'myth', 'legend', 'fable', 'strategy']).default('history'),
    /**
     * 三十六计专属。**只对 stratagem 组存在**：
     * 忘了写、或者给典故组写了，都在构建期当场报错（见下面的 refine）。
     */
    stratagem: StratagemSchema.optional(),
    title: z.string().min(1),
    pinyin: z.string().min(1),
    dynasty: z.string().min(1),
    era: z.string().min(1),
    /** 用于历史长卷排序，公元前为负数 */
    yearApprox: z.number().int(),
    source: SourceSchema,
    /** 一句话寓意，孩子能听懂 */
    moral: z.string().min(1).max(90),
    keywords: z.array(z.string().min(1)).min(2).max(6),
    ageRange: z.tuple([z.number().int(), z.number().int()]),
};

const detailFields = {
    figures: z.array(z.string().min(1)).min(1),
    story: z.array(StoryBeatSchema).min(2).max(6),
    keyMoment: KeyMomentSchema,
    misconceptions: z.array(z.string().min(1)).min(1),
    quiz: z.array(QuizQuestionSchema).min(2),
    game: z.object({
      /** 主玩法模板，用于缩略图与筛选 */
      template: z.string().min(1),
      /** 实际参与编排的各段脚本，按顺序执行 */
      stages: z.array(GameStageSchema).min(1).max(3),
    }),
};

/** 摘要：大厅 / 图鉴要用的字段（首屏只加载它） */
export const EntrySummarySchema = z
  .object(summaryFields)
  .refine((v) => (v.group === 'stratagem') === (v.stratagem !== undefined), {
    message: '三十六计必须写 stratagem（序号 / 套），典故组不许写',
    path: ['stratagem'],
  })
  .refine((v) => v.stratagem === undefined || v.stratagem.set === Math.ceil(v.stratagem.number / 6), {
    message: 'stratagem.set 与序号对不上：第 n 套 = 序号 6(n−1)+1 … 6n',
    path: ['stratagem', 'set'],
  });

/** 详情：只有进了游戏才需要的那一半（故事 / 抉择 / 复习题 / 关卡脚本） */
export const EntryDetailSchema = z
  .object(detailFields)
  .refine((v) => v.quiz.every((q) => q.answer < q.options.length), {
    message: 'quiz 的 answer 下标越界',
    path: ['quiz'],
  })
  .refine((v) => v.keyMoment.options.filter((o) => o.isCanonical).length === 1, {
    message: 'keyMoment 必须恰好有一个 isCanonical 选项',
    path: ['keyMoment'],
  })
  .refine((v) => v.story.some((b) => b.id === v.keyMoment.beatId), {
    message: 'keyMoment.beatId 必须存在于 story 中',
    path: ['keyMoment', 'beatId'],
  })
  .refine((v) => new Set(v.story.map((b) => b.id)).size === v.story.length, {
    message: 'story 的 beat id 不能重复',
    path: ['story'],
  })
  .refine((v) => v.quiz.some((q) => q.kind === 'transfer'), {
    message: '至少需要一道 transfer（迁移）题，否则无法验证“真的记住了”',
    path: ['quiz'],
  });

/** 完整条目 = 摘要 + 详情（内容体检与游戏逻辑用；游戏侧从 '@chags/content/full' 取） */
export const ContentEntrySchema = z
  .object({ ...summaryFields, ...detailFields })
  .refine((v) => v.quiz.every((q) => q.answer < q.options.length), {
    message: 'quiz 的 answer 下标越界',
    path: ['quiz'],
  })
  .refine((v) => v.keyMoment.options.filter((o) => o.isCanonical).length === 1, {
    message: 'keyMoment 必须恰好有一个 isCanonical 选项',
    path: ['keyMoment'],
  })
  .refine((v) => v.story.some((b) => b.id === v.keyMoment.beatId), {
    message: 'keyMoment.beatId 必须存在于 story 中',
    path: ['keyMoment', 'beatId'],
  })
  .refine((v) => new Set(v.story.map((b) => b.id)).size === v.story.length, {
    message: 'story 的 beat id 不能重复',
    path: ['story'],
  })
  .refine((v) => v.quiz.some((q) => q.kind === 'transfer'), {
    message: '至少需要一道 transfer（迁移）题，否则无法验证“真的记住了”',
    path: ['quiz'],
  })
  .refine((v) => (v.group === 'stratagem') === (v.stratagem !== undefined), {
    message: '三十六计必须写 stratagem（序号 / 套 / 按语），典故组不许写',
    path: ['stratagem'],
  })
  .refine((v) => v.stratagem === undefined || v.stratagem.set === Math.ceil(v.stratagem.number / 6), {
    message: 'stratagem.set 与序号对不上：第 n 套 = 序号 6(n−1)+1 … 6n',
    path: ['stratagem', 'set'],
  });

/**
 * 把一条完整内容拆成摘要与详情 —— **字段划分只写在这一处**：
 * 拆文件的脚本、内容体检、译文补丁校验都从这里拿规则，免得三处各写一份然后走样。
 */
export function splitEntry(entry: ContentEntry): { summary: EntrySummary; detail: EntryDetail } {
  const source = entry as unknown as Record<string, unknown>;
  const pick = <T,>(keys: readonly string[]): T => {
    const out: Record<string, unknown> = {};
    for (const key of keys) if (key in source) out[key] = source[key];
    return out as T;
  };
  return {
    summary: pick<EntrySummary>(SUMMARY_KEYS),
    detail: pick<EntryDetail>(DETAIL_KEYS),
  };
}

/** 摘要字段 / 详情字段的键（顺序与 schema 里一致） */
export const SUMMARY_KEYS = [
  'id', 'group', 'kind', 'title', 'pinyin', 'dynasty', 'era', 'yearApprox', 'source', 'moral',
  'keywords', 'ageRange', 'stratagem',
] as const;

export const DETAIL_KEYS = [
  'figures', 'story', 'keyMoment', 'misconceptions', 'quiz', 'game',
] as const;

export type EntrySummary = z.infer<typeof EntrySummarySchema>;
export type EntryDetail = z.infer<typeof EntryDetailSchema>;
export type ContentEntry = z.infer<typeof ContentEntrySchema>;
export type Stratagem = z.infer<typeof StratagemSchema>;
export type GameStage = z.infer<typeof GameStageSchema>;
export type StoryBeat = z.infer<typeof StoryBeatSchema>;
export type KeyMoment = z.infer<typeof KeyMomentSchema>;
export type KeyMomentOption = z.infer<typeof KeyMomentOptionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
