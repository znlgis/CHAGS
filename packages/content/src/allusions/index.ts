import raw from './caochong-elephant.json';
import rawPangu from './pangu.json';
import { AllusionSchema } from '../schema';
import type { AllusionContent } from '../schema';

/** 构建期就用 zod 校验：内容写错不该等到用户点开才发现 */
/** 神话排在信史之前：历史长卷上从上古一路走到明清 */
export const allusions: AllusionContent[] = [
  AllusionSchema.parse(raw),
  AllusionSchema.parse(rawPangu),
];

/** 取某个典故里指定模板的阶段脚本；缺了就早失败，别等玩到一半才发现 */
export function stageScript(content: AllusionContent, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('典故 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}

export function getAllusion(id: string): AllusionContent | undefined {
  return allusions.find((a) => a.id === id);
}

/** 按年代排序，供历史长卷使用 */
export function allusionsByYear(): AllusionContent[] {
  return [...allusions].sort((a, b) => a.yearApprox - b.yearApprox);
}
