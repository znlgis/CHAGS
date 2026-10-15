<script setup lang="ts">
import type { GameEventMap, GameModule, Stars } from '@chags/game-kit';
import { gradeFromScore } from '@chags/progress';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { navigate } from '../router';
import { registry } from '../registry';
import { createGameContext } from '../shell/createGameContext';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const props = defineProps<{ entryId: string }>();
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

/**
 * 一局的表现同时喂两件事：
 * - **星星**（只增不减，给孩子看）：由这一局的失误次数决定；
 * - **复习评级**（决定下次什么时候再见面）：优先用答对率。
 *   关卡里有"选择题"的模板会记 correct/total（借力、试探、配对、造势…），
 *   纯动手不记对错的模板 total 为 0 —— 那就退回用星星当评级。
 *   两条路都不再是"拿星星顶替"的权宜之计（见 docs/技术方案.md §7.17）。
 */
function reviewGrade(result: GameEventMap['level:complete']): Stars {
  return result.total > 0 ? gradeFromScore(result.correct, result.total) : result.stars;
}

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    void progress.recordCompletion(props.entryId, result.stars, reviewGrade(result));
  }
}

onMounted(async () => {
  const load = registry[props.entryId];
  if (!load) {
    error.value = i18n.t('play.notFound') + props.entryId;
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
    console.error('[chags] 游戏载入失败：' + props.entryId, cause);
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
