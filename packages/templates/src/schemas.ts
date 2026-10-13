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
      tooLight: z.string().min(1).max(12),
      tooHeavy: z.string().min(1).max(12),
      stuck: z.string().min(1).max(12),
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
 * grow 模板：持续发力让一件事长大（盘古撑天、愚公移山、铁杵磨针这类"坚持"）
 */
export const GrowLevelSchema = z
  .object({
    /** 起手时上下两半的缝隙（设计像素） */
    startGap: z.number().nonnegative(),
    /** 撑开后的最大缝隙 */
    endGap: z.number().positive(),
    /** 计数目标与每次点击的增量 */
    targetValue: z.number().positive(),
    stepValue: z.number().positive(),
    unit: z.string().min(1).max(2),
    /** 视觉阻力：越大，后半程天空升得越慢（手感上"越来越吃力"） */
    resistance: z.number().min(0).max(1.5),
    /** 长时间没动作时的提示（尽量短） */
    hint: z.string().min(1).max(12),
  })
  .refine((l) => l.endGap > l.startGap, {
    message: 'endGap 必须大于 startGap',
    path: ['endGap'],
  })
  .refine((l) => Number.isInteger(l.targetValue / l.stepValue), {
    message: 'targetValue 必须是 stepValue 的整数倍，否则永远点不满',
    path: ['stepValue'],
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
export type GrowLevel = z.infer<typeof GrowLevelSchema>;
export type PlaceSlot = z.infer<typeof PlaceSlotSchema>;
export type PlaceOrb = z.infer<typeof PlaceOrbSchema>;
export type PlaceLevel = z.infer<typeof PlaceLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  substitution: SubstitutionLevelSchema,
  grow: GrowLevelSchema,
  place: PlaceLevelSchema,
};
