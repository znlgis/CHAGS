<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { navigate, useRoute } from './router';
import { installBackButtonHandler } from './shell/backButton';
import { platform } from './shell/platform';
import { useLocale } from './stores/locale';
import { useProgress } from './stores/progress';
import AlbumView from './views/AlbumView.vue';
import HallView from './views/HallView.vue';
import PlayView from './views/PlayView.vue';
import ReviewView from './views/ReviewView.vue';

const route = useRoute();
const progress = useProgress();
const i18n = useLocale();

/** iOS / 微信：音频必须由用户手势解锁 */
function unlockAudio(): void {
  void platform.audio.unlock();
}

onMounted(() => {
  void progress.init();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  // 只在原生壳里生效；浏览器里是空操作
  installBackButtonHandler(route);
});

onBeforeUnmount(() => {
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
      v-if="route.name !== 'play'"
      class="flex items-center justify-between gap-3 bg-[#3a2f26] px-5 py-4 text-[#fdf3dc]"
    >
      <button class="min-w-0 text-left" @click="navigate('/')">
        <span class="block truncate text-lg font-bold">{{ i18n.t('app.title') }}</span>
        <span class="hidden truncate text-sm text-[#cbb9a0] sm:block">
          {{ i18n.t('app.subtitle') }}
        </span>
      </button>
      <nav class="flex shrink-0 items-center gap-2 text-sm">
        <button
          class="min-h-12 rounded-full px-4 py-3"
          :class="navClass(route.name === 'hall')"
          data-testid="nav-hall"
          @click="navigate('/')"
        >
          {{ i18n.t('nav.hall') }}
        </button>
        <button
          class="min-h-12 rounded-full px-4 py-3"
          :class="navClass(route.name === 'album')"
          data-testid="nav-album"
          @click="navigate('/album')"
        >
          {{ i18n.t('nav.album') }}
        </button>
        <button
          class="min-h-12 rounded-full bg-[#2c6b64] px-4 py-3"
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
      <HallView v-else />
    </main>
  </div>
</template>
