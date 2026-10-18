<script setup lang="ts">
import type { GameEventMap, GameModule, Stars } from '@chags/game-kit';
import { gradeFromScore } from '@chags/progress';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { navigate } from '../router';
import { registry } from '../registry';
import { createGameContext } from '../shell/createGameContext';
import { platform } from '../shell/platform';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const props = defineProps<{ entryId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
/**
 * 给玩家看的：一句人话 + 两个出口（重试 / 回游戏馆）。
 * 技术细节留给控制台与 window.__chags.lastError —— 之前直接把 zod 的报错
 * 原样贴在屏幕上，小朋友看到的是 [{ "origin": "string", "code": "too_big" ... }]。
 */
const error = ref<string | null>(null);
const loading = ref(false);
const progress = useProgress();
const i18n = useLocale();
let disposed = false;
let offPause: (() => void) | null = null;
let offResume: (() => void) | null = null;

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

/** 载入并挂载一局。失败时只把一句人话放到 error 上，技术细节留给控制台 */
async function start(): Promise<void> {
  if (disposed || loading.value) return;
  loading.value = true;
  error.value = null;
  try {
    // 先等读档完成：深链直接进游戏（或 autoplay 秒通关）时，
    // 一次写入早于读档完成就会被旧快照盖掉 —— 星星"白拿了"
    await progress.init();
    const load = registry[props.entryId];
    if (!load) {
      error.value = i18n.t('play.notFound') + props.entryId;
      return;
    }
    const loaded = (await load()).default;
    if (disposed || !host.value) return;
    mod.value = loaded;
    await loaded.mount(
      await createGameContext(loaded.manifest, host.value, i18n.locale, {
        onExit: () => navigate('/'),
        onEvent: handleEvent,
      }),
    );
    // 切后台要**真的**暂停：游戏循环睡着才不烧电，顺带把没念完的旁白停掉。
    // 这两个回调以前没有任何订阅方（契约是死的：pause/resume 全仓 0 调用）。
    offPause = platform.lifecycle.onPause(() => {
      mod.value?.pause();
      platform.audio.stopSpeech();
    });
    offResume = platform.lifecycle.onResume(() => {
      mod.value?.resume();
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    error.value = i18n.t('play.loadFailed');
    // 详情只留给开发与自动化：e2e 靠它定位问题，玩家不需要看到
    console.error('[chags] 游戏载入失败：' + props.entryId, cause);
    if (typeof window !== 'undefined') {
      window.__chags = window.__chags ?? { events: [], last: null };
      window.__chags.lastError = detail;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void start();
});

onBeforeUnmount(async () => {
  disposed = true;
  offPause?.();
  offResume?.();
  offPause = null;
  offResume = null;
  // 中途退出还在念旁白 = 回到大厅继续有人说话（故事场景自己会停，玩法场景不会）
  platform.audio.stopSpeech();
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
      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          class="rounded-full bg-[#2c6b64] px-8 py-3 text-lg text-[#fdf3dc] active:scale-95 disabled:opacity-60"
          :disabled="loading"
          data-testid="play-retry"
          @click="start"
        >
          {{ i18n.t('play.retry') }}
        </button>
        <button
          type="button"
          class="rounded-full bg-[#b03a31] px-8 py-3 text-lg text-[#fdf3dc] active:scale-95"
          data-testid="play-back"
          @click="navigate('/')"
        >
          {{ i18n.t('play.backToHall') }}
        </button>
      </div>
    </div>
  </div>
</template>
