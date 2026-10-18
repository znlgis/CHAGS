<script setup lang="ts">
import type { GameEventMap, GameModule, Stars } from '@chags/game-kit';
import { gradeFromScore } from '@chags/progress';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { navigate } from '../router';
import { registry } from '../registry';
import { createGameContext } from '../shell/createGameContext';
import { platform } from '../shell/platform';
import { useLocale } from '../stores/locale';
import { usePlaytime } from '../stores/playtime';
import { useProgress } from '../stores/progress';
import { useSettings } from '../stores/settings';

const props = defineProps<{ entryId: string }>();
const host = ref<HTMLDivElement | null>(null);
/** ★ 必须用 shallowRef：ref 会深度代理整个 Phaser 对象图 */
const mod = shallowRef<GameModule | null>(null);
/**
 * 给玩家看的：一句人话 + 两个出口（重试 / 回游戏馆）。
 * 技术细节留给控制台与 window.__chags.lastError。
 */
const error = ref<string | null>(null);
const loading = ref(false);
/** 退出确认：孩子在游戏里误触返回时不直接中断这一局 */
const leaving = ref(false);
const progress = useProgress();
const playtime = usePlaytime();
const settings = useSettings();
const i18n = useLocale();
let disposed = false;
let offPause: (() => void) | null = null;
let offResume: (() => void) | null = null;
let playTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 一局的表现同时喂两件事：
 * - **星星**（只增不减，给孩子看）：由这一局的失误次数决定；
 * - **复习评级**（决定下次什么时候再见面）：优先用答对率。
 */
function reviewGrade(result: GameEventMap['level:complete']): Stars {
  return result.total > 0 ? gradeFromScore(result.correct, result.total) : result.stars;
}

function handleEvent<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
  if (type === 'level:complete') {
    const result = payload as GameEventMap['level:complete'];
    void progress.recordCompletion(props.entryId, result.stars, reviewGrade(result));
    playtime.addRound();
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
      await createGameContext(
        loaded.manifest,
        host.value,
        i18n.locale,
        {
          onExit: (reason) => {
            // 「再来一次」：原地重开，不回大厅
            if (reason === 'replay') {
              void restart();
              return;
            }
            navigate('/');
          },
          onEvent: handleEvent,
        },
        // 二周目才允许"跳过故事"：首次必须听完（见 story.ts）
        progress.hasCard(props.entryId),
      ),
    );
    // 切后台要**真的**暂停：游戏循环睡着才不烧电，顺带把没念完的旁白停掉。
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
    console.error('[chags] 游戏载入失败：' + props.entryId, cause);
    if (typeof window !== 'undefined') {
      window.__chags = window.__chags ?? { events: [], last: null };
      window.__chags.lastError = detail;
    }
  } finally {
    loading.value = false;
  }
}

/** 原地再来一局：卸掉旧 Phaser 实例，再挂一次（不刷新页面、不回大厅） */
async function restart(): Promise<void> {
  if (disposed) return;
  offPause?.();
  offResume?.();
  offPause = null;
  offResume = null;
  await mod.value?.unmount();
  mod.value = null;
  if (host.value) host.value.innerHTML = '';
  await start();
}

onMounted(() => {
  void start();
  // 休息提醒的数据来源：每 30 秒记一次玩耍时长（只统计玩游戏的时间）
  playTimer = setInterval(() => playtime.addSeconds(30), 30_000);
});

onBeforeUnmount(async () => {
  disposed = true;
  if (playTimer !== null) clearInterval(playTimer);
  playTimer = null;
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

    <!-- 游戏内工具条：孩子随时能退出、家长随时能静音（不挡玩法区，只占两个角） -->
    <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
      <button
        type="button"
        class="pointer-events-auto z-10 flex min-h-14 min-w-14 items-center justify-center rounded-2xl bg-[#3a2f26]/70 text-2xl text-[#fdf3dc] active:scale-95"
        :aria-label="i18n.t('play.leave')"
        data-testid="play-leave"
        @click="leaving = true"
      >
        ←
      </button>
      <button
        type="button"
        class="pointer-events-auto z-10 flex min-h-14 min-w-14 items-center justify-center rounded-2xl bg-[#3a2f26]/70 text-2xl text-[#fdf3dc] active:scale-95"
        :aria-label="settings.muted ? i18n.t('nav.soundOff') : i18n.t('nav.soundOn')"
        data-testid="play-sound"
        @click="settings.toggle()"
      >
        {{ settings.muted ? '🔇' : '🔊' }}
      </button>
    </div>

    <!-- 退出确认：误触不会直接中断 -->
    <div
      v-if="leaving"
      data-testid="play-leave-confirm"
      class="absolute inset-0 z-20 flex items-center justify-center bg-[#3a2f26]/80 px-8"
    >
      <div class="w-full max-w-sm rounded-3xl bg-[#fffaf0] p-6 text-center">
        <p class="text-lg font-bold text-[#3a2f26]">{{ i18n.t('play.leaveConfirm') }}</p>
        <div class="mt-5 flex gap-3">
          <button
            type="button"
            data-testid="play-leave-stay"
            class="min-h-14 flex-1 rounded-full bg-[#2c6b64] px-4 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
            @click="leaving = false"
          >
            {{ i18n.t('play.leaveStay') }}
          </button>
          <button
            type="button"
            data-testid="play-leave-exit"
            class="min-h-14 flex-1 rounded-full bg-[#b03a31] px-4 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
            @click="navigate('/')"
          >
            {{ i18n.t('play.leave') }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-[#3a2f26]/95 px-8 text-center"
    >
      <p class="text-lg text-[#fdf3dc]">{{ error }}</p>
      <div class="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          class="min-h-14 rounded-full bg-[#2c6b64] px-8 py-3 text-lg text-[#fdf3dc] active:scale-95 disabled:opacity-60"
          :disabled="loading"
          data-testid="play-retry"
          @click="start"
        >
          {{ i18n.t('play.retry') }}
        </button>
        <button
          type="button"
          class="min-h-14 rounded-full bg-[#b03a31] px-8 py-3 text-lg text-[#fdf3dc] active:scale-95"
          data-testid="play-back"
          @click="navigate('/')"
        >
          {{ i18n.t('play.backToHall') }}
        </button>
      </div>
    </div>
  </div>
</template>
