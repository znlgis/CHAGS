import type { SaveData } from '@chags/game-kit';
import { progressManager } from '../shell/progress';
import { defineStore } from 'pinia';
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

  async function recordCompletion(
    entryId: string,
    stars: 0 | 1 | 2 | 3,
    grade: 0 | 1 | 2 | 3,
  ): Promise<void> {
    await progressManager.recordCompletion(entryId, stars, grade);
    save.value = progressManager.snapshot();
  }

  return { save, ready, init, collected, starsFor, hasCard, recordCompletion };
});
