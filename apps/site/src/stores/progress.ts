import type { ReviewState, SaveData, Stars } from '@chags/game-kit';
import { createReviewState, isDue } from '@chags/progress';
import { defineStore } from 'pinia';
import { platform } from '../shell/platform';
import { progressManager } from '../shell/progress';
import { computed, ref } from 'vue';

export const useProgress = defineStore('progress', () => {
  const save = ref<SaveData>(progressManager.snapshot());
  const ready = ref(false);

  async function init(): Promise<void> {
    save.value = await progressManager.init();
    ready.value = true;
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
    await progressManager.recordCompletion(entryId, stars, grade);
    save.value = progressManager.snapshot();
  }

  /** 复习小测验的评级：不动星星，只重排下次复习的间隔 */
  async function recordReview(entryId: string, grade: Stars): Promise<void> {
    await progressManager.recordReview(entryId, grade);
    save.value = progressManager.snapshot();
  }

  return {
    save, ready, init, collected, starsFor, hasCard, reviewOf, reviewDue,
    recordCompletion, recordReview,
  };
});
