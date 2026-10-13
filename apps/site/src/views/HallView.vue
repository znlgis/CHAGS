<script setup lang="ts">
import { allusions } from '@chags/content';
import { computed } from 'vue';
import { navigate } from '../router';
import { useProgress } from '../stores/progress';

const progress = useProgress();
const list = computed(() => [...allusions].sort((a, b) => a.yearApprox - b.yearApprox));
</script>

<template>
  <section data-testid="hall" class="mx-auto max-w-3xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#e0554a]">典故馆</h1>
    <p class="mt-1 text-sm text-[#6b5a49]">
      已收集
      <span data-testid="collected-count" class="font-bold text-[#3d8f86]">{{ progress.collected }}</span>
      / {{ list.length }} 个典故
    </p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2">
      <li
        v-for="allusion in list"
        :key="allusion.id"
        class="rounded-3xl border-2 border-[#f0e0bd] bg-[#fffaf0] p-5 shadow-sm"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-xl font-bold">{{ allusion.title }}</h2>
          <span class="text-lg text-[#c98a1c]">
            {{ '★'.repeat(progress.starsFor(allusion.id)) || '☆' }}
          </span>
        </div>
        <p class="mt-1 text-xs text-[#8a7a66]">
          {{ allusion.pinyin }} · {{ allusion.era }} · {{ allusion.ageRange[0] }}–{{ allusion.ageRange[1] }} 岁
        </p>
        <p class="mt-3 text-sm leading-relaxed text-[#5c4b3d]">{{ allusion.moral }}</p>
        <div class="mt-3 flex flex-wrap gap-1">
          <span
            v-for="keyword in allusion.keywords"
            :key="keyword"
            class="rounded-full bg-[#e6f1ef] px-3 py-1 text-xs text-[#3d8f86]"
          >
            {{ keyword }}
          </span>
        </div>
        <button
          class="mt-4 w-full rounded-full bg-[#e0554a] px-4 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
          :data-testid="'start-' + allusion.id"
          @click="navigate('/play/' + allusion.id)"
        >
          开始玩
        </button>
      </li>
    </ul>
  </section>
</template>
