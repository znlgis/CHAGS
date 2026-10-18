<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue';
import { navigate, useRoute } from './router';
import { installBackButtonHandler } from './shell/backButton';
import { platform } from './shell/platform';
import { useLocale } from './stores/locale';
import { useProgress } from './stores/progress';
import { useSettings } from './stores/settings';
import HallView from './views/HallView.vue';

// 首屏只留大厅；游戏 / 图鉴 / 复习 / 家长页都按路由懒加载。
// 孩子第一次打开只需要"选一个游戏"，其余页面等真的点进去再下。
const PlayView = defineAsyncComponent(() => import('./views/PlayView.vue'));
const ReviewView = defineAsyncComponent(() => import('./views/ReviewView.vue'));
const AlbumView = defineAsyncComponent(() => import('./views/AlbumView.vue'));
const ParentView = defineAsyncComponent(() => import('./views/ParentView.vue'));

const route = useRoute();
const progress = useProgress();
const i18n = useLocale();
const settings = useSettings();

/** iOS / 微信：音频必须由用户手势解锁 */
function unlockAudio(): void {
  void platform.audio.unlock();
}

/**
 * 家长页入口：**长按标题 3 秒**（这里用 3 秒，与家长页里的"长按清档"一致）。
 * 孩子不会无意点进来，家长又能随时找到。
 */
let parentHold: ReturnType<typeof setTimeout> | null = null;
function startParentHold(): void {
  if (parentHold !== null) return;
  parentHold = setTimeout(() => {
    parentHold = null;
    navigate('/parent');
  }, 3000);
}
function cancelParentHold(): void {
  if (parentHold === null) return;
  clearTimeout(parentHold);
  parentHold = null;
}

onMounted(() => {
  settings.init();
  void progress.init();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  // 只在原生壳里生效；浏览器里是空操作
  installBackButtonHandler(route);
});

onBeforeUnmount(() => {
  cancelParentHold();
  window.removeEventListener('pointerdown', unlockAudio);
});

function navClass(active: boolean): string {
  // 亮红配纸色只有 3.42:1，深红是 5.44:1
  return active ? 'bg-[#b03a31] text-[#fdf3dc]' : 'bg-[#4a3d31] text-[#fdf3dc]';
}
</script>

<template>
  <div class="flex h-full flex-col bg-[#3a2f26]">
    <header
      v-if="route.name !== 'play' && route.name !== 'parent'"
      class="flex items-center justify-between gap-3 bg-[#3a2f26] px-5 py-4 text-[#fdf3dc]"
    >
      <!-- 长按 3 秒进家长页：孩子点不进，家长找得到 -->
      <button
        class="min-w-0 text-left"
        data-testid="app-title"
        @click="navigate('/')"
        @pointerdown="startParentHold"
        @pointerup="cancelParentHold"
        @pointerleave="cancelParentHold"
        @pointercancel="cancelParentHold"
      >
        <span class="block truncate text-lg font-bold">{{ i18n.t('app.title') }}</span>
        <span class="hidden truncate text-sm text-[#cbb9a0] sm:block">
          {{ i18n.t('app.subtitle') }}
        </span>
      </button>
      <nav class="flex shrink-0 items-center gap-2 text-sm">
        <button
          class="min-h-14 rounded-full px-4 py-3"
          :class="navClass(route.name === 'hall')"
          data-testid="nav-hall"
          @click="navigate('/')"
        >
          {{ i18n.t('nav.hall') }}
        </button>
        <button
          class="min-h-14 rounded-full px-4 py-3"
          :class="navClass(route.name === 'album')"
          data-testid="nav-album"
          @click="navigate('/album')"
        >
          {{ i18n.t('nav.album') }}
        </button>
        <button
          class="min-h-14 min-w-14 rounded-full px-4 py-3"
          :class="navClass(false)"
          :aria-label="settings.muted ? i18n.t('nav.soundOff') : i18n.t('nav.soundOn')"
          data-testid="nav-sound"
          @click="settings.toggle()"
        >
          {{ settings.muted ? '🔇' : '🔊' }}
        </button>
        <button
          class="min-h-14 rounded-full bg-[#2c6b64] px-4 py-3"
          data-testid="nav-lang"
          @click="i18n.toggle()"
        >
          {{ i18n.t('nav.switchTo') }}
        </button>
      </nav>
    </header>

    <main
      class="min-h-0 flex-1 bg-[#fdf3dc]"
      :class="route.name === 'play' ? 'overflow-hidden' : 'overflow-y-auto'"
    >
      <PlayView
        v-if="route.name === 'play'"
        :key="route.entryId + ':' + i18n.locale"
        :entry-id="route.entryId ?? ''"
      />
      <ReviewView
        v-else-if="route.name === 'review'"
        :key="route.entryId + ':' + i18n.locale"
        :entry-id="route.entryId ?? ''"
      />
      <AlbumView v-else-if="route.name === 'album'" />
      <ParentView v-else-if="route.name === 'parent'" />
      <HallView v-else />
    </main>
  </div>
</template>
