<script setup lang="ts">
import { allusions } from '@chags/content';
import { computed } from 'vue';
import { useProgress } from '../stores/progress';

const progress = useProgress();
const cards = computed(() => allusions.filter((a) => progress.hasCard(a.id)));
</script>

<template>
  <section data-testid="album" class="mx-auto max-w-3xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#e0554a]">我的典故图鉴</h1>
    <p v-if="cards.length === 0" class="mt-6 rounded-3xl bg-[#fffaf0] p-6 text-sm text-[#6b5a49]">
      还没有收集到典故卡，去典故馆玩一局吧！
    </p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2">
      <li
        v-for="allusion in cards"
        :key="allusion.id"
        :data-testid="'album-card-' + allusion.id"
        class="rounded-3xl border-2 border-[#c98a1c] bg-[#fffaf0] p-5"
      >
        <div class="flex items-baseline justify-between">
          <h2 class="text-xl font-bold text-[#e0554a]">{{ allusion.title }}</h2>
          <span class="text-[#c98a1c]">{{ '★'.repeat(progress.starsFor(allusion.id)) }}</span>
        </div>
        <p class="mt-1 text-xs text-[#8a7a66]">{{ allusion.pinyin }} · {{ allusion.era }}</p>
        <p class="mt-3 text-sm leading-relaxed">{{ allusion.moral }}</p>
        <p class="mt-3 border-t border-dashed border-[#f0e0bd] pt-3 text-xs text-[#6b5a49]">
          出处：{{ allusion.source.book }}
        </p>
        <p class="mt-1 text-xs leading-relaxed text-[#5c4b3d]">{{ allusion.source.quote }}</p>
      </li>
    </ul>
  </section>
</template>
