import { z } from 'zod';

/** balance 模板（等量代换 / 浮力）的关卡脚本契约 */
export const StoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number().positive(),
});

export const BalanceLevelSchema = z
  .object({
    prompt: z.string().min(1),
    targetWeight: z.number().positive(),
    capacity: z.number().positive(),
    tolerance: z.number().nonnegative(),
    stones: z.array(StoneSchema).min(1),
    hintText: z.string().min(1),
  })
  .refine((l) => l.targetWeight <= l.capacity, {
    message: 'targetWeight 不能大于 capacity',
    path: ['targetWeight'],
  })
  .refine((l) => l.capacity - l.targetWeight >= l.tolerance, {
    message: '水痕之上要留出容差空间，否则一定判“太沉”',
    path: ['tolerance'],
  });

export type StoneDef = z.infer<typeof StoneSchema>;
export type BalanceLevel = z.infer<typeof BalanceLevelSchema>;

/** 模板 id → 关卡脚本 schema。新增模板时在这里登记，content:check 自动生效。 */
export const templateSchemas: Record<string, z.ZodType> = {
  balance: BalanceLevelSchema,
};
