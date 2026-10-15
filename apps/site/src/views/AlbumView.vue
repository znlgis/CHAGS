<script setup lang="ts">
import { gameGroups } from '@chags/content';
import { groupMessageKey, stratagemLabel, stratagemSetKey } from '@chags/i18n';
import { computed } from 'vue';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const progress = useProgress();
const i18n = useLocale();

/**
 * 图鉴也按分组分卷 —— 和游戏馆同一份分组表。
 * 但这里**只显示收着卡片的分组**：图鉴里摆一个空卷没有意义，
 * 空状态交给下面那句总提示。
 */
const sections = computed(() =>
  gameGroups(i18n.locale)
    .map(({ group, games }) => ({
      group,
      cards: games.filter((a) => progress.hasCard(a.id)),
    }))
    .filter((section) => section.cards.length > 0),
);
const total = computed(() => sections.value.reduce((sum, s) => sum + s.cards.length, 0));
</script>

<template>
  <section data-testid="album" class="mx-auto max-w-3xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#b03a31]">{{ i18n.t('album.title') }}</h1>
    <p v-if="total === 0" class="mt-6 rounded-3xl bg-[#fffaf0] p-6 text-sm text-[#6b5a49]">
      {{ i18n.t('album.empty') }}
    </p>

    <section
      v-for="{ group, cards } in sections"
      :key="group.id"
      class="mt-8"
      :data-testid="'album-group-' + group.id"
    >
      <div class="flex items-end justify-between gap-3 border-b-2 border-dashed border-[#e8d3a4] pb-2">
        <h2 class="text-xl font-bold text-[#2c6b64]">
          {{ i18n.t(groupMessageKey(group.id, 'title')) }}
        </h2>
        <span class="shrink-0 text-sm text-[#8a5f10]">{{ cards.length }}</span>
      </div>

      <ul class="mt-4 grid gap-4 sm:grid-cols-2">
        <li
          v-for="entry in cards"
          :key="entry.id"
          :data-testid="'album-card-' + entry.id"
          class="rounded-3xl border-2 border-[#c98a1c] bg-[#fffaf0] p-5"
        >
          <div class="flex items-baseline justify-between">
            <h3 class="text-xl font-bold text-[#b03a31]">{{ entry.title }}</h3>
            <span class="text-[#8a5f10]">{{ '★'.repeat(progress.starsFor(entry.id)) }}</span>
          </div>
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6b5a49]">
            <span v-if="entry.stratagem" class="rounded-full bg-[#efe4ff] px-2 py-0.5 text-[#5b3f96]">
              {{ stratagemLabel(i18n.t('stratagem.card'), entry.stratagem.number) }}
              · {{ i18n.t(stratagemSetKey(entry.stratagem.set)) }}
            </span>
            <span>{{ entry.pinyin }} · {{ entry.era }}</span>
          </p>
          <p class="mt-3 text-sm leading-relaxed">{{ entry.moral }}</p>
          <p class="mt-3 border-t border-dashed border-[#f0e0bd] pt-3 text-sm text-[#6b5a49]">
            {{ i18n.t('album.source') }}：{{ entry.source.book }}
          </p>
          <p class="mt-1 text-sm leading-relaxed text-[#5c4b3d]">{{ entry.source.quote }}</p>
        </li>
      </ul>
    </section>
  </section>
</template>
