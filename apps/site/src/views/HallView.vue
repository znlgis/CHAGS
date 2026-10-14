<script setup lang="ts">
import { allusionsFor } from '@chags/content';
import { computed } from 'vue';
import { navigate } from '../router';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const progress = useProgress();
const i18n = useLocale();

/** 四种定性各有各的徽章：神话 / 传说 / 信史 / 寓言 */
const kindLabel = (kind: string): string =>
  i18n.t(
    kind === 'myth'
      ? 'hall.myth'
      : kind === 'legend'
        ? 'hall.legend'
        : kind === 'fable'
          ? 'hall.fable'
          : 'hall.history',
  );
const kindClass = (kind: string): string =>
  kind === 'myth'
    ? 'bg-[#efe4ff] text-[#5b3f96]'
    : kind === 'legend'
      ? 'bg-[#fdeccd] text-[#8a5f10]'
      : kind === 'fable'
        ? 'bg-[#fdeaea] text-[#b03a31]'
        : 'bg-[#e6f1ef] text-[#2c6b64]';
const list = computed(() =>
  [...allusionsFor(i18n.locale)].sort((a, b) => a.yearApprox - b.yearApprox),
);
</script>

<template>
  <section data-testid="hall" class="mx-auto max-w-3xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#b03a31]">{{ i18n.t('hall.title') }}</h1>
    <p class="mt-1 text-sm text-[#6b5a49]">
      {{ i18n.t('hall.collected') }}
      <span data-testid="collected-count" class="font-bold text-[#2c6b64]">{{ progress.collected }}</span>
      / {{ list.length }} {{ i18n.t('hall.unit') }}
    </p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2">
      <li
        v-for="allusion in list"
        :key="allusion.id"
        class="rounded-3xl border-2 border-[#f0e0bd] bg-[#fffaf0] p-5 shadow-sm"
      >
        <div class="flex items-baseline justify-between gap-2">
          <h2 class="text-xl font-bold">{{ allusion.title }}</h2>
          <span class="text-lg text-[#8a5f10]">
            {{ '★'.repeat(progress.starsFor(allusion.id)) || '☆' }}
          </span>
        </div>
        <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6b5a49]">
          <span
            class="rounded-full px-2 py-0.5"
            :class="kindClass(allusion.kind)"
          >
            {{ kindLabel(allusion.kind) }}
          </span>
          <span>{{ allusion.pinyin }} · {{ allusion.era }}</span>
          <span>{{ allusion.ageRange[0] }}–{{ allusion.ageRange[1] }} {{ i18n.t('hall.ages') }}</span>
        </p>
        <p class="mt-3 text-sm leading-relaxed text-[#5c4b3d]">{{ allusion.moral }}</p>
        <div class="mt-3 flex flex-wrap gap-1">
          <span
            v-for="keyword in allusion.keywords"
            :key="keyword"
            class="rounded-full bg-[#e6f1ef] px-3 py-1 text-sm text-[#2c6b64]"
          >
            {{ keyword }}
          </span>
        </div>
        <button
          class="mt-4 w-full rounded-full bg-[#b03a31] px-4 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
          :data-testid="'start-' + allusion.id"
          @click="navigate('/play/' + allusion.id)"
        >
          {{ i18n.t('hall.start') }}
        </button>
      </li>
    </ul>
  </section>
</template>
