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
    /**
     * ★ 必须开多点触控：Phaser 默认 input.activePointers = 1（鼠标 + 1 个触点），
     * 一根手指还按在屏幕上（扶屏、连点、长按、拖到一半）时，第二根手指的 touchstart
     * 会找不到空闲指针而被**整条丢弃**（InputManager.onTouchStart 里 break，
     * changed 数组为空，任何插件都收不到）—— 孩子看到的就是"点几次都没反应，
     * 有时候突然又有反应"，取决于此刻是不是还按着另一根手指。
     * 3 个触点 = 两只拇指 + 一只扶屏的手；再多没有收益（Phaser 上限 10）。
     */
    input: { activePointers: 3 },
    scene: opts.scenes,
  });
}
