<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { navigate, useRoute } from './router';
import { platform } from './shell/platform';
import { useProgress } from './stores/progress';
import AlbumView from './views/AlbumView.vue';
import HallView from './views/HallView.vue';
import PlayView from './views/PlayView.vue';

const route = useRoute();
const progress = useProgress();

/** iOS / 微信：音频必须由用户手势解锁 */
function unlockAudio(): void {
  void platform.audio.unlock();
}

onMounted(() => {
  void progress.init();
  window.addEventListener('pointerdown', unlockAudio, { once: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockAudio);
});
</script>

<template>
  <div class="flex h-full flex-col bg-[#3a2f26]">
    <header
      v-if="route.name !== 'play'"
      class="flex items-center justify-between bg-[#3a2f26] px-5 py-4 text-[#fdf3dc]"
    >
      <button class="text-left" @click="navigate('/')">
        <span class="block text-lg font-bold">中国历史典故</span>
        <span class="block text-xs text-[#cbb9a0]">给小朋友的典故游戏合集</span>
      </button>
      <nav class="flex gap-2 text-sm">
        <button
          class="rounded-full px-4 py-2"
          :class="route.name === 'hall' ? 'bg-[#e0554a]' : 'bg-[#4a3d31]'"
          @click="navigate('/')"
        >
          典故馆
        </button>
        <button
          class="rounded-full px-4 py-2"
          :class="route.name === 'album' ? 'bg-[#e0554a]' : 'bg-[#4a3d31]'"
          @click="navigate('/album')"
        >
          我的图鉴
        </button>
      </nav>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto bg-[#fdf3dc]">
      <PlayView v-if="route.name === 'play'" :key="route.gameId" :game-id="route.gameId ?? ''" />
      <AlbumView v-else-if="route.name === 'album'" />
      <HallView v-else />
    </main>
  </div>
</template>
