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
/**
 * 给玩家看的：一句人话 + 一个出口。
 * 技术细节留给控制台与 window.__chags.lastError —— 之前直接把 zod 的报错
 * 原样贴在屏幕上，小朋友看到的是 [{ "origin": "string", "code": "too_big" ... }]。
 */
const error = ref<string | null>(null);
const progress = useProgress();
const i18n = useLocale();
let disposed = false;

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    // 一局的表现直接决定下次复习间隔：3 星 → 3 级。
    // 这里把 stars 同时当 grade 是**暂时的**：复习测验还没接上，
    // session.correct/total 恒为 0，没有答对率可用（见 docs/技术方案.md 7.4）。
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
      await createGameContext(loaded.manifest, host.value, i18n.locale, {
        onExit: () => navigate('/'),
        onEvent: handleEvent,
      }),
    );
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    error.value = i18n.t('play.loadFailed');
    // 详情只留给开发与自动化：e2e 靠它定位问题，玩家不需要看到
    console.error('[chags] 游戏载入失败：' + props.gameId, cause);
    if (typeof window !== 'undefined') {
      window.__chags = window.__chags ?? { events: [], last: null };
      window.__chags.lastError = detail;
    }
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
    <div
      v-if="error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#3a2f26]/95 px-8 text-center"
    >
      <p class="text-lg text-[#fdf3dc]">{{ error }}</p>
      <button
        type="button"
        class="rounded-full bg-[#b03a31] px-10 py-3 text-lg text-[#fdf3dc] active:scale-95"
        @click="navigate('/')"
      >
        {{ i18n.t('play.backToHall') }}
      </button>
    </div>
  </div>
</template>
