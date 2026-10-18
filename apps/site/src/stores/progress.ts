import type { ReviewState, SaveData, Stars } from '@chags/game-kit';
import { createReviewState, isDue } from '@chags/progress';
import { defineStore } from 'pinia';
import { platform } from '../shell/platform';
import { progressManager } from '../shell/progress';
import { computed, ref } from 'vue';

export const useProgress = defineStore('progress', () => {
  const save = ref<SaveData>(progressManager.snapshot());
  const ready = ref(false);
  /** 写盘失败（配额满 / 无痕模式 / 存储被清）：界面可以据此提示"这次可能存不上" */
  const unsaved = ref(false);
  const initError = ref<string | null>(null);
  let inflight: Promise<void> | null = null;

  /**
   * 读档：多次调用共享同一次（single-flight）。
   * 以前 App.vue 直接 `void progress.init()` —— 深链直接进游戏时，
   * 一次秒通关的写入可能早于读档完成，随后被旧快照盖掉（丢星）。
   */
  function init(): Promise<void> {
    inflight ??= (async () => {
      try {
        save.value = await progressManager.init();
      } catch (cause) {
        // 存档坏了不是致命错误：本次会话从空档开始，大厅照样能用
        initError.value = cause instanceof Error ? cause.message : String(cause);
        console.warn('[chags] 存档读取失败，本次会话从空档开始', cause);
      } finally {
        ready.value = true;
      }
    })();
    return inflight;
  }

  /** 所有写盘都走这里：失败要可见，不能让"进度没存上"静默消失 */
  async function persist(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      unsaved.value = false;
    } catch (cause) {
      unsaved.value = true;
      console.warn('[chags] 存档写入失败：本次进度可能不会保留', cause);
    } finally {
      save.value = progressManager.snapshot();
    }
  }

  const collected = computed(
    () => Object.values(save.value.allusions).filter((a) => a.completions > 0).length,
  );

  function starsFor(entryId: string): number {
    return save.value.allusions[entryId]?.stars ?? 0;
  }

  function hasCard(entryId: string): boolean {
    return (save.value.allusions[entryId]?.completions ?? 0) > 0;
  }

  /** 这条内容的复习计划。没学过的内容拿到的是新计划（dueAt 为 null，永远不到期） */
  function reviewOf(entryId: string): ReviewState {
    return save.value.allusions[entryId]?.review ?? createReviewState();
  }

  /** 该复习了吗？—— 没收集到卡片的内容不算到期（孩子还没学过，谈不上"复习"） */
  function reviewDue(entryId: string): boolean {
    return hasCard(entryId) && isDue(reviewOf(entryId), platform.now());
  }

  async function recordCompletion(entryId: string, stars: Stars, grade: Stars): Promise<void> {
    await persist(() => progressManager.recordCompletion(entryId, stars, grade));
  }

  /** 复习小测验的评级：不动星星，只重排下次复习的间隔 */
  async function recordReview(entryId: string, grade: Stars): Promise<void> {
    await persist(() => progressManager.recordReview(entryId, grade));
  }

  /** 家长页的「清除本机存档」（界面上有长按确认，防孩子误触） */
  async function clear(): Promise<void> {
    await persist(() => progressManager.clear());
  }

  return {
    save, ready, unsaved, initError, init, collected, starsFor, hasCard, reviewOf, reviewDue,
    recordCompletion, recordReview, clear,
  };
});
