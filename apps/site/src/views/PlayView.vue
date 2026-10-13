<script setup lang="ts">
import type { GameEventMap, GameModule } from '@chags/game-kit';
import { gradeFromScore } from '@chags/progress';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { navigate } from '../router';
import { registry } from '../registry';
import { createGameContext } from '../shell/createGameContext';
import { useProgress } from '../stores/progress';

const props = defineProps<{ gameId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
const error = ref<string | null>(null);
const progress = useProgress();
let disposed = false;

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    void progress.recordCompletion(
      props.gameId,
      result.stars,
      gradeFromScore(result.correct, result.total),
    );
  }
}

onMounted(async () => {
  const load = registry[props.gameId];
  if (!load) {
    error.value = '找不到这个典故：' + props.gameId;
    return;
  }
  try {
    const loaded = (await load()).default;
    if (disposed || !host.value) return;
    mod.value = loaded;
    await loaded.mount(
      createGameContext(loaded.manifest, host.value, {
        onExit: () => navigate('/'),
        onEvent: handleEvent,
      }),
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
});

onBeforeUnmount(async () => {
  disposed = true;
  await mod.value?.unmount();
  mod.value = null;
});
</script>

<template>
  <div class="relative h-full w-full bg-[#17181d]">
    <div ref="host" class="game-host h-full w-full" />
    <p
      v-if="error"
      class="absolute inset-x-4 top-4 rounded-2xl bg-[#c23b2e] px-4 py-3 text-sm text-[#f3e8d2]"
    >
      {{ error }}
    </p>
  </div>
</template>
