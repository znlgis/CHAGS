import { defineStore } from 'pinia';
import { ref } from 'vue';
import { platform } from '../shell/platform';

const MUTED_KEY = 'chags.muted';

/**
 * 声音开关。给孩子的产品必须有这个：公交上、睡前、课堂上都需要"静音但还能玩"。
 * 音效与朗读都走 platform.audio，setMuted 会同时停掉正在念的旁白。
 */
export const useSettings = defineStore('settings', () => {
  const muted = ref(false);

  /** 启动时读回上次的选择（隐私模式读不到就按"有声音"处理） */
  function init(): void {
    let saved: boolean;
    try {
      saved = window.localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      // 隐私模式读不到：按"有声音"处理，本次会话仍可手动关
      saved = false;
    }
    muted.value = saved;
    platform.audio.setMuted(saved);
  }

  function setMuted(next: boolean): void {
    muted.value = next;
    platform.audio.setMuted(next);
    try {
      window.localStorage.setItem(MUTED_KEY, next ? '1' : '0');
    } catch {
      // 写不了也无所谓：本次会话仍然生效
    }
  }

  function toggle(): void {
    setMuted(!muted.value);
  }

  return { muted, init, setMuted, toggle };
});
