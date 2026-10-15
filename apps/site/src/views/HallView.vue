<script setup lang="ts">
import { gameGroups } from '@chags/content';
import { groupMessageKey, stratagemLabel, stratagemSetKey } from '@chags/i18n';
import { computed } from 'vue';
import { navigate } from '../router';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

const progress = useProgress();
const i18n = useLocale();

/** 五种定性各有各的徽章：神话 / 传说 / 信史 / 寓言 / 兵法 */
const kindLabel = (kind: string): string =>
  i18n.t(
    kind === 'myth'
      ? 'hall.myth'
      : kind === 'legend'
        ? 'hall.legend'
        : kind === 'fable'
          ? 'hall.fable'
          : kind === 'strategy'
            ? 'hall.strategy'
            : 'hall.history',
  );
const kindClass = (kind: string): string =>
  kind === 'myth'
    ? 'bg-[#efe4ff] text-[#5b3f96]'
    : kind === 'legend'
      ? 'bg-[#fdeccd] text-[#8a5f10]'
      : kind === 'fable'
        ? 'bg-[#fdeaea] text-[#b03a31]'
        : kind === 'strategy'
          ? 'bg-[#e6eefc] text-[#2f4a91]'
          : 'bg-[#e6f1ef] text-[#2c6b64]';

/**
 * 分组完全来自内容层（packages/content/src/groups.ts）：
 * 这一屏不认识"典故"或"三十六计"，只知道分组表里有什么 ——
 * 以后加第三组、第四组，这里一行都不用改。
 * 空组也会出现（三十六计现在就是空的），显示成"敬请期待"。
 */
const groups = computed(() => gameGroups(i18n.locale));
const total = computed(() => groups.value.reduce((sum, g) => sum + g.games.length, 0));

const groupTitle = (id: string): string => i18n.t(groupMessageKey(id, 'title'));
const groupNote = (id: string): string => i18n.t(groupMessageKey(id, 'note'));
const groupEmpty = (id: string): string => i18n.t(groupMessageKey(id, 'empty'));
</script>

<template>
  <section data-testid="hall" class="mx-auto max-w-3xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#b03a31]">{{ i18n.t('hall.title') }}</h1>
    <p class="mt-1 text-sm text-[#6b5a49]">
      {{ i18n.t('hall.collected') }}
      <span data-testid="collected-count" class="font-bold text-[#2c6b64]">{{ progress.collected }}</span>
      / {{ total }} {{ i18n.t('hall.unit') }}
    </p>

    <section
      v-for="{ group, games: groupGames } in groups"
      :key="group.id"
      class="mt-8"
      :data-testid="'group-' + group.id"
    >
      <div class="flex items-end justify-between gap-3 border-b-2 border-dashed border-[#e8d3a4] pb-2">
        <div class="min-w-0">
          <h2 class="text-xl font-bold text-[#2c6b64]">{{ groupTitle(group.id) }}</h2>
          <p class="mt-0.5 text-sm text-[#6b5a49]">{{ groupNote(group.id) }}</p>
        </div>
        <span v-if="groupGames.length > 0" class="shrink-0 text-sm text-[#8a5f10]">
          {{ groupGames.length }} {{ i18n.t('hall.unit') }}
        </span>
        <span v-else class="shrink-0 rounded-full bg-[#e6f1ef] px-3 py-1 text-sm text-[#2c6b64]">
          {{ i18n.t('hall.soon') }}
        </span>
      </div>

      <ul v-if="groupGames.length > 0" class="mt-4 grid gap-4 sm:grid-cols-2">
        <li
          v-for="entry in groupGames"
          :key="entry.id"
          class="rounded-3xl border-2 border-[#f0e0bd] bg-[#fffaf0] p-5 shadow-sm"
        >
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-xl font-bold">{{ entry.title }}</h3>
            <span class="text-lg text-[#8a5f10]">
              {{ '★'.repeat(progress.starsFor(entry.id)) || '☆' }}
            </span>
          </div>
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#6b5a49]">
            <span
              class="rounded-full px-2 py-0.5"
              :class="kindClass(entry.kind)"
            >
              {{ kindLabel(entry.kind) }}
            </span>
            <template v-if="entry.stratagem">
              <span
                class="rounded-full bg-[#efe4ff] px-2 py-0.5 text-[#5b3f96]"
                :data-testid="'stratagem-' + entry.id"
              >
                {{ stratagemLabel(i18n.t('stratagem.card'), entry.stratagem.number) }}
              </span>
              <span class="text-[#8a5f10]">{{ i18n.t(stratagemSetKey(entry.stratagem.set)) }}</span>
            </template>
            <span>{{ entry.pinyin }} · {{ entry.era }}</span>
            <span>{{ entry.ageRange[0] }}–{{ entry.ageRange[1] }} {{ i18n.t('hall.ages') }}</span>
          </p>
          <p class="mt-3 text-sm leading-relaxed text-[#5c4b3d]">{{ entry.moral }}</p>
          <div class="mt-3 flex flex-wrap gap-1">
            <span
              v-for="keyword in entry.keywords"
              :key="keyword"
              class="rounded-full bg-[#e6f1ef] px-3 py-1 text-sm text-[#2c6b64]"
            >
              {{ keyword }}
            </span>
          </div>
          <button
            class="mt-4 w-full rounded-full bg-[#b03a31] px-4 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
            :data-testid="'start-' + entry.id"
            @click="navigate('/play/' + entry.id)"
          >
            {{ i18n.t('hall.start') }}
          </button>
        </li>
      </ul>

      <p
        v-else
        class="mt-4 rounded-3xl border-2 border-dashed border-[#f0e0bd] bg-[#fffaf0] p-6 text-sm leading-relaxed text-[#6b5a49]"
        :data-testid="'group-empty-' + group.id"
      >
        {{ groupEmpty(group.id) }}
      </p>
    </section>
  </section>
</template>
