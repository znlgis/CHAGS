import { z } from 'zod';

export const StoneSchema = z.object({
  id: z.string().min(1),
  /** 石头的真实重量：局中不显示，只在最后称重时揭晓 */
  value: z.number().positive(),
  /** 画多大 —— 让小朋友用眼睛判断轻重，而不是看数字 */
  radius: z.number().positive(),
});

/**
 * substitution 模板：等量代换（曹冲称象这类"称不动就换个能称的"）
 */
export const SubstitutionLevelSchema = z
  .object({
    heavy: z.object({ weight: z.number().positive() }),
    capacity: z.number().positive(),
    tolerance: z.number().nonnegative(),
    stones: z.array(StoneSchema).min(1).max(4),
    hints: z.object({
      tooLight: z.string().min(1).max(24),
      tooHeavy: z.string().min(1).max(24),
      stuck: z.string().min(1).max(24),
    }),
  })
  .refine((l) => l.heavy.weight <= l.capacity, {
    message: '重物重量不能超过载重上限',
    path: ['heavy', 'weight'],
  })
  .refine((l) => l.capacity - l.heavy.weight >= l.tolerance, {
    message: '水痕之上要留出容差空间，否则一定判"太沉"',
    path: ['tolerance'],
  })
  .refine((l) => canReach(l.heavy.weight, l.capacity, l.tolerance, l.stones.map((s) => s.value)), {
    message: '用这些石头凑不出重物的重量（容差内无解），关卡不可通关',
    path: ['stones'],
  });

/**
 * 有界完全背包：判断用无限量的这些石头，能否凑出容差范围内的重量。
 * 内容写错不该等到孩子玩到一半才发现 —— 所以在构建期就算清楚。
 */
export function canReach(
  target: number,
  capacity: number,
  tolerance: number,
  values: number[],
): boolean {
  if (values.length === 0) return false;
  const limit = Math.ceil(capacity) + Math.max(...values);
  const reachable = new Array<boolean>(limit + 1).fill(false);
  reachable[0] = true;
  for (let i = 0; i <= limit; i += 1) {
    if (!reachable[i]) continue;
    for (const value of values) {
      const next = i + value;
      if (next <= limit) reachable[next] = true;
    }
  }
  for (let i = 0; i <= limit; i += 1) {
    if (reachable[i] && Math.abs(i - target) <= tolerance) return true;
  }
  return false;
}

/**
 * tap 模板：连点 / 长按推进一个进度。
 *
 * 关键设计：**画面完全交给游戏**（drawStage 回调）。
 * 盘古撑天、精卫填海、愚公移山、夸父追日共用这一套循环与手感曲线，
 * 但四段画面毫无关系 —— 这是"四个坚持类典故不像同一个游戏"的根本保证。
 */
export const TapMilestoneSchema = z.object({
  /** 触发进度 0..1 */
  at: z.number().min(0).max(1),
  id: z.string().min(1),
});

export const TapLevelSchema = z
  .object({
    /** tap = 连点；hold = 长按持续发力（松手就停） */
    mode: z.enum(['tap', 'hold']).default('tap'),
    targetValue: z.number().positive(),
    /** tap 模式 = 每次点击的增量；hold 模式 = 每秒的增量 */
    stepValue: z.number().positive(),
    // 计数气泡宽度自适应，英文单位（stones / baskets）会略长
    unit: z.string().min(1).max(8),
    /** 视觉阻力：越大，后半程越显得吃力 */
    resistance: z.number().min(0).max(1.5),
    hint: z.string().min(1).max(24),
    /** 可选里程碑：进度到达时触发一次（愚公的换代、智叟出现） */
    milestones: z.array(TapMilestoneSchema).max(6).default([]),
  })
  .refine((l) => l.mode === 'hold' || Number.isInteger(l.targetValue / l.stepValue), {
    message: 'tap 模式下 targetValue 必须是 stepValue 的整数倍，否则永远点不满',
    path: ['stepValue'],
  })
  .refine((l) => new Set(l.milestones.map((m) => m.id)).size === l.milestones.length, {
    message: '里程碑 id 不能重复',
    path: ['milestones'],
  });

/**
 * aim 模板：拉弓瞄准射击（后羿射日；可复用：纪昌学射、百步穿杨、惊弓之鸟）
 */
export const AimTargetSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  kind: z.string().min(1),
});

export const AimLevelSchema = z
  .object({
    targets: z.array(AimTargetSchema).min(2).max(12),
    hitRadius: z.number().positive(),
    arrowSpeed: z.number().positive(),
    /** 射下几个算完成（后羿：10 个里射 9 个） */
    goalCount: z.number().int().positive(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => l.goalCount < l.targets.length, {
    message: 'goalCount 必须小于目标总数 —— 否则就没有"留一个"的余地了',
    path: ['goalCount'],
  })
  .refine((l) => new Set(l.targets.map((t) => t.id)).size === l.targets.length, {
    message: '目标 id 不能重复',
    path: ['targets'],
  });

export const PlaceSlotSchema = z.object({
  id: z.string().min(1),
  /** 空槽在画面上的位置 */
  x: z.number(),
  y: z.number(),
  /** 交给游戏包决定怎么画（太阳 / 月亮 / 河 / 树…） */
  kind: z.string().min(1),
  radius: z.number().positive(),
});

export const PlaceOrbSchema = z.object({
  id: z.string().min(1),
  /** 这个光球应该归到哪个槽 */
  slotId: z.string().min(1),
  /** 光球在底部托盘里的位置 */
  x: z.number(),
  y: z.number(),
  kind: z.string().min(1),
  /** 归位时用语音说出的原文，用听不用看 */
  speak: z.string().min(1),
});

/**
 * place 模板：把东西放到它该去的地方（盘古化身、孔融让梨、完璧归赵）
 */
export const PlaceLevelSchema = z
  .object({
    slots: z.array(PlaceSlotSchema).min(2).max(8),
    orbs: z.array(PlaceOrbSchema).min(2).max(8),
  })
  .refine((l) => l.orbs.length === l.slots.length, {
    message: '光球数量必须与槽位数量一致',
    path: ['orbs'],
  })
  .refine((l) => new Set(l.slots.map((s) => s.id)).size === l.slots.length, {
    message: '槽位 id 不能重复',
    path: ['slots'],
  })
  .refine((l) => l.orbs.every((o) => l.slots.some((s) => s.id === o.slotId)), {
    message: '有光球指向了不存在的槽位',
    path: ['orbs'],
  })
  .refine((l) => new Set(l.orbs.map((o) => o.slotId)).size === l.orbs.length, {
    message: '一个槽位只能有一个光球',
    path: ['orbs'],
  });

/**
 * sort 模板：把东西分进对的那一堆（神农尝百草；可复用：田忌赛马、对症下药）
 *
 * 关键设计：**先尝后分**。有 probe 的关卡里，没尝过的东西放不进木牍 ——
 * 孩子必须自己动手试过，才有分类的资格。这就是"亲身试过才知道"的玩法化。
 */
export const SortBinSchema = z.object({
  id: z.string().min(1),
  /** 怎么画由游戏包决定（麦穗 / 药碗 / 叶子加叉） */
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  /** 木牍上的短标签（双语可译） */
  label: z.string().min(1).max(12),
});

export const SortItemSchema = z.object({
  id: z.string().min(1),
  /** 这东西该去哪个木牍 */
  binId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 还没尝过时的样子（一株不认识的草） */
  kind: z.string().min(1),
  /** 尝过之后显示的结果（甜 / 苦 / 麻 / 有毒），靠图标不靠文字 */
  tastedKind: z.string().min(1).optional(),
  /** 归位时用语音说出的一句话 */
  speak: z.string().min(1).optional(),
});

export const SortLevelSchema = z
  .object({
    bins: z.array(SortBinSchema).min(2).max(4),
    items: z.array(SortItemSchema).min(3).max(10),
    /** 可选：先尝后分的"嘴边" */
    probe: z
      .object({ x: z.number(), y: z.number(), radius: z.number().positive() })
      .optional(),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.bins.map((b) => b.id)).size === l.bins.length, {
    message: '木牍 id 不能重复',
    path: ['bins'],
  })
  .refine((l) => new Set(l.items.map((i) => i.id)).size === l.items.length, {
    message: '东西的 id 不能重复',
    path: ['items'],
  })
  .refine((l) => l.items.every((i) => l.bins.some((b) => b.id === i.binId)), {
    message: '有东西指向了不存在的木牍',
    path: ['items'],
  })
  .refine((l) => l.bins.every((b) => l.items.some((i) => i.binId === b.id)), {
    message: '有一块木牍永远没有东西可放 —— 内容写错了',
    path: ['items'],
  })
  .refine((l) => l.probe === undefined || l.items.every((i) => i.tastedKind !== undefined), {
    message: '有"先尝后分"却没有给每件东西写 tastedKind —— 尝完什么都看不出来',
    path: ['items'],
  });

/**
 * trace 模板：用手指划出一条路（大禹治水的"疏"；可复用：都江堰、郑国渠、张骞通西域、郑和下西洋）
 *
 * 关键设计：**只看有没有按顺序经过锚点**，不做像素比对，也不要求线画得多直 ——
 * 孩子划歪了、划断了都能接着划，已经过的锚点不会退回去。
 */
export const TraceAnchorSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 判定半径：给得宽松一点，手指粗也能过 */
  radius: z.number().positive(),
});

export const TraceSegmentSchema = z.object({
  id: z.string().min(1),
  start: z.object({ x: z.number(), y: z.number() }),
  anchors: z.array(TraceAnchorSchema).max(6),
  end: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
});

export const TraceLevelSchema = z
  .object({
    segments: z.array(TraceSegmentSchema).min(1).max(4),
    /** 采样点之间的最大间距：不是精度要求，只挡"手指抬起又落在别处"的瞬移 */
    maxGap: z.number().positive().default(200),
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.segments.map((s) => s.id)).size === l.segments.length, {
    message: '每一段的 id 不能重复',
    path: ['segments'],
  })
  .refine(
    (l) =>
      l.segments.every(
        (s) => new Set(s.anchors.map((a) => a.id)).size === s.anchors.length,
      ),
    { message: '同一段里锚点的 id 不能重复', path: ['segments'] },
  );

/**
 * wait 模板：等（太公钓鱼；可复用：苏武牧羊、卧薪尝胆、程门立雪）
 *
 * 关键设计：**以"不动作"为玩法**。主线只有一件事 —— 等。
 * 点了诱惑（换弯钩、加鱼饵）就得多等一会儿，但**有上限**：不会卡死，也不会惩罚到玩不下去。
 */
export const WaitTemptationSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
  /** 点它要多等多久 */
  penaltyMs: z.number().nonnegative().default(5000),
  /** 点它时老人说的那句话（双语可译） */
  line: z.string().min(1),
});

export const WaitLevelSchema = z.object({
  /** 要等多久（毫秒）。无头验证下会自动缩短 */
  durationMs: z.number().positive(),
  temptations: z.array(WaitTemptationSchema).max(4),
  /** 诱惑最多把时间往后推几次 —— 保证永远等得到 */
  penaltyCap: z.number().int().min(0).max(6).default(3),
  /** 点老人时轮着说的话（支线，不影响进度） */
  lines: z.array(z.string().min(1)).min(1).max(6),
  /** 老人坐在哪儿：点他会说一句（可选） */
  listener: z
    .object({ x: z.number(), y: z.number(), radius: z.number().positive() })
    .optional(),
  /** 收束动作：等到了，把直钩收起来 */
  finale: z.object({ x: z.number(), y: z.number(), radius: z.number().positive() }),
  hint: z.string().min(1).max(24),
});

/**
 * beacon 关卡（烽火戏诸侯专用）：
 * 场景本身留在这个游戏包里（像盘古的开蛋场景一样），但**数据在这里登记**，
 * 这样双语内容校验、翻译体检、schema 体检都会覆盖到它。
 */
export const BeaconTowerSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export const BeaconLinesSchema = z.object({
  /** 第一次：他们真的来了 */
  first: z.string().min(1).max(48),
  /** 第二次：又来了，走的时候有人在摇头 */
  again: z.string().min(1).max(48),
  /** 第三次：连城门都没到 */
  empty: z.string().min(1).max(48),
  /** 结语 */
  end: z.string().min(1).max(48),
});

export const BeaconLevelSchema = z
  .object({
    /** 山脊上的烽火台，从近到远 */
    towers: z.array(BeaconTowerSchema).min(3).max(8),
    /** 前面几次是戏弄：信任一格一格掉（信任格数 = 这个数） */
    decoyRounds: z.number().int().min(1).max(4).default(3),
    lines: BeaconLinesSchema,
    hint: z.string().min(1).max(24),
  })
  .refine((l) => new Set(l.towers.map((t) => t.id)).size === l.towers.length, {
    message: '烽火台的 id 不能重复',
    path: ['towers'],
  });

export type StoneDef = z.infer<typeof StoneSchema>;
export type SubstitutionLevel = z.infer<typeof SubstitutionLevelSchema>;
export type TapMilestone = z.infer<typeof TapMilestoneSchema>;
export type TapLevel = z.infer<typeof TapLevelSchema>;
export type AimTarget = z.infer<typeof AimTargetSchema>;
export type AimLevel = z.infer<typeof AimLevelSchema>;
export type PlaceSlot = z.infer<typeof PlaceSlotSchema>;
export type PlaceOrb = z.infer<typeof PlaceOrbSchema>;
export type PlaceLevel = z.infer<typeof PlaceLevelSchema>;
export type BeaconTower = z.infer<typeof BeaconTowerSchema>;
export type BeaconLines = z.infer<typeof BeaconLinesSchema>;
export type BeaconLevel = z.infer<typeof BeaconLevelSchema>;
export type WaitTemptation = z.infer<typeof WaitTemptationSchema>;
export type WaitLevel = z.infer<typeof WaitLevelSchema>;
export type TraceAnchor = z.infer<typeof TraceAnchorSchema>;
export type TraceSegment = z.infer<typeof TraceSegmentSchema>;
export type TraceLevel = z.infer<typeof TraceLevelSchema>;
export type SortBin = z.infer<typeof SortBinSchema>;
export type SortItem = z.infer<typeof SortItemSchema>;
export type SortLevel = z.infer<typeof SortLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  substitution: SubstitutionLevelSchema,
  tap: TapLevelSchema,
  place: PlaceLevelSchema,
  aim: AimLevelSchema,
  sort: SortLevelSchema,
  trace: TraceLevelSchema,
  wait: WaitLevelSchema,
  beacon: BeaconLevelSchema,
};
