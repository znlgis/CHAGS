import { stageScript } from '@chags/content';
import type { ContentEntry } from '@chags/content';
import { WindowLevelSchema } from '@chags/templates/schemas';
import type { StirWindowLevel } from '@chags/templates';
import type { WindowLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function windowLevel(content: ContentEntry): StirWindowLevel {
  const level: WindowLevel = WindowLevelSchema.parse(stageScript(content, 'window'));
  const stir = level.stir;
  if (level.mode !== 'stir' || stir === undefined) {
    throw new Error('hunshui-moyu 这一关必须是 window · stir：水要自己搅，窗口才开');
  }
  return { ...level, mode: 'stir', stir };
}
