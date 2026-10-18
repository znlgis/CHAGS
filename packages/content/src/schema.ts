import { GROUPS, STRATAGEM_SETS, isGroupId } from './groups';
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

/**
 * 玩法模板 id 的**唯一事实来源**。
 *
 * 以前这份列表只写在 game-kit 的 TemplateId 联合类型里，而 templates 包的 schema 注册表是
 * `Record<string, ZodType>` —— 三者之间没有任何编译期约束：契约里多加一个 id 不报错，
 * 内容里写错模板要等运行 `content:check` 才拦得住（本地 `dist:win` / `dist:apk` 只跑 build）。
 *
 * 现在：内容 schema 用 z.enum 校验（写错模板构建期就报），
 * templates 的注册表用 `Record<TemplateId, ZodType>`（少登记一个在 typecheck 就报）。
 * 预留但没实现的 id（match / order / drag / board / timing / react / branch / build / grow）
 * 已从契约里删掉 —— 真要做时再加回来，并同时补 schema 与场景。
 */
export const TEMPLATE_IDS = [
  // 典故
  'substitution', 'tap', 'place', 'aim', 'sort', 'trace', 'wait', 'beacon',
  'mark', 'split', 'burrow', 'butcher',
  // 三十六计 第一~四辑
  'ruse', 'siege', 'borrow', 'stillness', 'window',
  'show', 'twoline', 'read', 'matchup',
  'probe', 'lure', 'chase',
  'swap', 'chain',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** 一条内容可以由多段玩法拼成（例如盘古 = 撑天 + 化身、围魏救赵 = 双线 + 要害） */
export const GameStageSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  levelScript: z.unknown(),
});

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
    /**
     * 三十六计才有的"正向迁移"：这一计的思维今天可以怎么用（孩子/家长在卡片上看得见）。
     * 三十六计讲的是"骗/忍/装"，方案文档要求把每一计翻成一句正向的生活智慧 —— 这一字段就是落点。
     */
    transfer: z.string().min(1).max(48).optional(),
    /** 思维标签：2–6 字，图鉴/卡片上的一枚小徽章（例如「留退路」） */
    thinkingTag: z.string().min(1).max(6).optional(),
};

const detailFields = {
    figures: z.array(z.string().min(1)).min(1),
    // ★ 恰好两幕：drawBeat 契约目前只会画两幅图（53 个 art.ts 全是"第 0 幕 / 其它幕"分叉）。
    // 以前这里允许 2–6 幕，第 3 幕起会静默复用第 2 幕的插图 —— 与其悄悄画错，不如构建期就报错。
    // 真要写三幕故事：先给 drawBeat 契约补"每一幕各自怎么画"，再把这里放开。
    story: z.array(StoryBeatSchema).length(2),
    keyMoment: KeyMomentSchema,
    misconceptions: z.array(z.string().min(1)).min(1),
    // 每条内容固定 3 道（含 1 道 transfer）：内容体检会强制"至少一道迁移题"，
    // 数量固定后再也不会出现"有的 2 题有的 3 题"导致复习体验不一致。
    quiz: z.array(QuizQuestionSchema).length(3),
    game: z.object({
      /** 主玩法模板，用于缩略图与筛选 */
      template: z.enum(TEMPLATE_IDS),
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

export type EntrySummary = z.infer<typeof EntrySummarySchema>;
export type EntryDetail = z.infer<typeof EntryDetailSchema>;
export type ContentEntry = z.infer<typeof ContentEntrySchema>;
export type Stratagem = z.infer<typeof StratagemSchema>;
export type GameStage = z.infer<typeof GameStageSchema>;
export type StoryBeat = z.infer<typeof StoryBeatSchema>;
export type KeyMoment = z.infer<typeof KeyMomentSchema>;
export type KeyMomentOption = z.infer<typeof KeyMomentOptionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
