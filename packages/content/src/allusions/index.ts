import raw from './caochong-elephant.json';
import { AllusionSchema } from '../schema';
import type { AllusionContent } from '../schema';

/** 构建期就用 zod 校验：内容写错不该等到用户点开才发现 */
export const allusions: AllusionContent[] = [AllusionSchema.parse(raw)];

export function getAllusion(id: string): AllusionContent | undefined {
  return allusions.find((a) => a.id === id);
}

/** 按年代排序，供历史长卷使用 */
export function allusionsByYear(): AllusionContent[] {
  return [...allusions].sort((a, b) => a.yearApprox - b.yearApprox);
}
