import { z } from 'zod';

export const StoneSchema = z.object({
  id: z.string().min(1),
  /** 石头的真实重量：局中不显示，只在最后称重时揭晓 */
  value: z.number().positive(),
  /** 画多大 —— 让小朋友用眼睛判断轻重，而不是看数字 */
  radius: z.number().positive(),
});

/**
 * substitution 模板：等量代换（曹冲称象这类“称不动就换个能称的”）
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
    message: '水痕之上要留出容差空间，否则一定判“太沉”',
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

export type StoneDef = z.infer<typeof StoneSchema>;
export type SubstitutionLevel = z.infer<typeof SubstitutionLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  substitution: SubstitutionLevelSchema,
};
