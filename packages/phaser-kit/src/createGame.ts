import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { THEME } from './theme';

export interface CreateGameOptions {
  scenes: Phaser.Types.Scenes.SceneType[];
}

/**
 * 每个游戏包自己创建 Phaser 实例，unmount 时必须 destroy，
 * 避免路由切换或 HMR 之后残留 canvas 与 requestAnimationFrame 循环。
 */
export function createPhaserGame(ctx: GameContext, opts: CreateGameOptions): Phaser.Game {
  const { width, height } = ctx.manifest.designSize;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: ctx.container,
    width,
    height,
    backgroundColor: THEME.ink,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: { noAudio: true },
    scene: opts.scenes,
  });
}
