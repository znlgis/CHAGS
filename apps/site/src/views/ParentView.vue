<script setup lang="ts">
import { getEntrySummary } from '@chags/content';
import { computed, onBeforeUnmount, ref } from 'vue';
import sitePkg from '../../package.json';
import { navigate } from '../router';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';
import { useSettings } from '../stores/settings';

/**
 * 家长页（#/parent）：入口是游戏馆标题**长按 3 秒**，孩子不会误入。
 *
 * 这一页只回答家长最关心的四件事：
 * 1. 安全边界（不联网 / 无广告内购 / 无账号，存档只在本机）；
 * 2. 孩子这周玩了什么、复习了什么（数据全部来自本机存档）；
 * 3. 声音开关、清除本机存档；
 * 4. 版本号与卸载说明。
 */
const i18n = useLocale();
const progress = useProgress();
const settings = useSettings();

const version = (sitePkg as { version?: string }).version ?? '0.0.0';
const cleared = ref(false);
const holding = ref(false);
let holdTimer: ReturnType<typeof setTimeout> | null = null;

/** 本周玩过的典故（按最后游玩时间倒序，最多 6 个；给家长看标题，不显示内部 id） */
const weekPlayed = computed(() => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return Object.values(progress.save.allusions)
    .filter((item) => (item.lastPlayedAt ?? 0) >= weekAgo)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 6)
    .map((item) => ({
      id: item.entryId,
      title: getEntrySummary(item.entryId, i18n.locale)?.title ?? item.entryId,
    }));
});

const weekCount = computed(() => weekPlayed.value.length);

/** 长按 3 秒才真的清档：孩子誤触不会把星星清空 */
function startHold(): void {
  if (holdTimer !== null || cleared.value) return;
  holding.value = true;
  holdTimer = setTimeout(() => {
    holdTimer = null;
    holding.value = false;
    void progress.clear();
    cleared.value = true;
  }, 3000);
}

function cancelHold(): void {
  if (holdTimer === null) return;
  clearTimeout(holdTimer);
  holdTimer = null;
  holding.value = false;
}

onBeforeUnmount(cancelHold);
</script>

<template>
  <section data-testid="parent" class="mx-auto max-w-2xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#b03a31]">{{ i18n.t('parent.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-[#5c4b3d]">{{ i18n.t('parent.intro') }}</p>

    <ul class="mt-5 grid gap-2 text-sm text-[#5c4b3d]">
      <li class="rounded-2xl bg-[#fffaf0] px-4 py-3">✅ {{ i18n.t('parent.noNetwork') }}</li>
      <li class="rounded-2xl bg-[#fffaf0] px-4 py-3">✅ {{ i18n.t('parent.noAds') }}</li>
      <li class="rounded-2xl bg-[#fffaf0] px-4 py-3">✅ {{ i18n.t('parent.archive') }}</li>
    </ul>

    <div class="mt-6 rounded-3xl border-2 border-[#f0e0bd] bg-[#fffaf0] p-5">
      <p class="text-base font-bold text-[#2c6b64]" data-testid="parent-week">
        {{ i18n.t('parent.week', { n: weekCount }) }}
      </p>
      <p class="mt-2 text-sm text-[#6b5a49]">{{ i18n.t('parent.learned') }}</p>
      <p v-if="weekPlayed.length === 0" class="mt-1 text-sm text-[#8a5f10]">
        {{ i18n.t('parent.none') }}
      </p>
      <ul v-else class="mt-2 flex flex-wrap gap-2">
        <li
          v-for="item in weekPlayed"
          :key="item.id"
          class="rounded-full bg-[#e6f1ef] px-3 py-1 text-sm text-[#2c6b64]"
          :data-testid="'parent-played-' + item.id"
        >
          {{ item.title }}
        </li>
      </ul>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-testid="parent-sound"
        class="min-h-14 rounded-full bg-[#2c6b64] px-6 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
        @click="settings.toggle()"
      >
        {{ settings.muted ? i18n.t('nav.soundOff') : i18n.t('nav.soundOn') }}
      </button>
      <button
        type="button"
        data-testid="parent-clear"
        class="min-h-14 rounded-full border-2 border-[#b03a31] px-6 py-3 text-base font-bold text-[#b03a31] active:scale-95"
        :class="holding ? 'bg-[#fdeaea]' : 'bg-transparent'"
        @pointerdown="startHold"
        @pointerup="cancelHold"
        @pointerleave="cancelHold"
        @pointercancel="cancelHold"
      >
        {{ cleared ? i18n.t('parent.cleared') : holding ? i18n.t('parent.clearHold') : i18n.t('parent.clear') }}
      </button>
    </div>

    <p class="mt-6 text-sm text-[#6b5a49]">{{ i18n.t('parent.version', { v: version }) }}</p>

    <button
      type="button"
      data-testid="parent-back"
      class="mt-6 min-h-14 w-full rounded-full bg-[#b03a31] px-6 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
      @click="navigate('/')"
    >
      {{ i18n.t('parent.back') }}
    </button>
  </section>
</template>
