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

/** ★ 关键抉择点：玩法的种子。没有它，典故就只是看动画。 */
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

/** 一个典故可以由多段玩法拼成（例如盘古 = 撑天 + 化身） */
export const GameStageSchema = z.object({
  template: z.string().min(1),
  levelScript: z.unknown(),
});

export const AllusionSchema = z
  .object({
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
    /** 信史 / 神话 / 传说 / 寓言：历史长卷要分开呈现（神话落在最左端，寓言是"讲道理的故事"） */
    kind: z.enum(['history', 'myth', 'legend', 'fable']).default('history'),
    title: z.string().min(1),
    pinyin: z.string().min(1),
    dynasty: z.string().min(1),
    era: z.string().min(1),
    /** 用于历史长卷排序，公元前为负数 */
    yearApprox: z.number().int(),
    figures: z.array(z.string().min(1)).min(1),
    source: SourceSchema,
    /** 一句话寓意，孩子能听懂 */
    moral: z.string().min(1).max(90),
    keywords: z.array(z.string().min(1)).min(2).max(6),
    ageRange: z.tuple([z.number().int(), z.number().int()]),
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
  })
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

export type AllusionContent = z.infer<typeof AllusionSchema>;
export type GameStage = z.infer<typeof GameStageSchema>;
export type StoryBeat = z.infer<typeof StoryBeatSchema>;
export type KeyMoment = z.infer<typeof KeyMomentSchema>;
export type KeyMomentOption = z.infer<typeof KeyMomentOptionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
