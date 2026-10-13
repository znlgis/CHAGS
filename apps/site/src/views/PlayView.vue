<script setup lang="ts">
import type { GameEventMap, GameModule } from '@chags/game-kit';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { navigate } from '../router';
import { registry } from '../registry';
import { createGameContext } from '../shell/createGameContext';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const props = defineProps<{ gameId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
const error = ref<string | null>(null);
const progress = useProgress();
const i18n = useLocale();
let disposed = false;

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    // 一局的表现直接决定下次复习间隔：3 星 → 3 级
    void progress.recordCompletion(props.gameId, result.stars, result.stars);
  }
}

onMounted(async () => {
  const load = registry[props.gameId];
  if (!load) {
    error.value = i18n.t('play.notFound') + props.gameId;
    return;
  }
  try {
    const loaded = (await load()).default;
    if (disposed || !host.value) return;
    mod.value = loaded;
    await loaded.mount(
      createGameContext(loaded.manifest, host.value, i18n.locale, {
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
  <div class="relative h-full w-full bg-[#3a2f26]">
    <div ref="host" class="game-host h-full w-full" />
    <p
      v-if="error"
      class="absolute inset-x-4 top-4 rounded-2xl bg-[#e0554a] px-4 py-3 text-sm text-[#fdf3dc]"
    >
      {{ error }}
    </p>
  </div>
</template>
