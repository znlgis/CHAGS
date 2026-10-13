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
    unit: z.string().min(1).max(3),
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

export type StoneDef = z.infer<typeof StoneSchema>;
export type SubstitutionLevel = z.infer<typeof SubstitutionLevelSchema>;
export type TapMilestone = z.infer<typeof TapMilestoneSchema>;
export type TapLevel = z.infer<typeof TapLevelSchema>;
export type AimTarget = z.infer<typeof AimTargetSchema>;
export type AimLevel = z.infer<typeof AimLevelSchema>;
export type PlaceSlot = z.infer<typeof PlaceSlotSchema>;
export type PlaceOrb = z.infer<typeof PlaceOrbSchema>;
export type PlaceLevel = z.infer<typeof PlaceLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  substitution: SubstitutionLevelSchema,
  tap: TapLevelSchema,
  place: PlaceLevelSchema,
  aim: AimLevelSchema,
};
