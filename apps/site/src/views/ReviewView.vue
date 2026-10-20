<script setup lang="ts">
import { loadEntry } from '@chags/content';
import type { ContentEntry, QuizQuestion } from '@chags/content';
import { daysUntil } from '@chags/progress';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { navigate } from '../router';
import {
  createReviewQuiz,
  gradeOf,
  isFinished,
  nextQuestion,
  pickOption,
  shuffledQuestions,
} from '../review/quiz';
import type { ReviewQuizState } from '../review/quiz';
import { platform } from '../shell/platform';
import { useLocale } from '../stores/locale';
import { useProgress } from '../stores/progress';

/**
 * 到期复习：从图鉴的典故卡点进来，做 3 道题（含 1 道迁移题）。
 *
 * 为什么用 DOM 而不是复用 Phaser 的 quiz 场景：这是**非核心玩法**，
 * 只为三道题再下一遍 Phaser（412 KB gzip）不划算；DOM 还能直接用原生按钮、
 * 键盘与读屏（见 docs/技术方案.md 的技术选型表与 §7.17）。
 *
 * 评级只影响"下次什么时候复习"，不动星星：星星只增不减，复习答错不该扣掉它。
 */
const props = defineProps<{ entryId: string }>();
const i18n = useLocale();
const progress = useProgress();

const entry = ref<ContentEntry | null>(null);
const missing = ref(false);
const state = ref<ReviewQuizState>(createReviewQuiz());
/** 结果页：下次复习隔几天（没算出来就不显示这一行） */
const dueInDays = ref<number | null>(null);

/** 选项顺序打散：内容里的原顺序 86.7% 的答案都在第一个，只点第一个就能过 */
const questions = computed<QuizQuestion[]>(() =>
  entry.value === null ? [] : shuffledQuestions(entry.value.quiz, entry.value.id),
);
const total = computed(() => questions.value.length);
const question = computed<QuizQuestion | undefined>(() => questions.value[state.value.index]);
const finished = computed(() => isFinished(state.value, total.value));
const answered = computed(() => state.value.picked !== null);
const pickedRight = computed(
  () => question.value !== undefined && state.value.picked === question.value.answer,
);

onMounted(async () => {
  const loaded = await loadEntry(props.entryId, i18n.locale);
  if (!loaded) {
    missing.value = true;
    return;
  }
  entry.value = loaded;
  state.value = createReviewQuiz();
});

/**
 * 答完之后把「下一题」滚进视野。
 *
 * 选完答案，其余选项会 disabled（看起来仍可点）—— 孩子会反复点选项，而真正的出口
 * 在选项列表下面、小屏上经常已经在屏幕外：又一次"点了没反应"。
 */
const nextButton = ref<HTMLButtonElement | null>(null);
watch(answered, async (done) => {
  if (!done) return;
  await nextTick();
  nextButton.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function choose(index: number): void {
  const current = question.value;
  if (!current || state.value.picked !== null) return;
  state.value = pickOption(state.value, current, index);
}

async function next(): Promise<void> {
  if (!answered.value) return;
  const isLast = state.value.index + 1 >= total.value;
  state.value = nextQuestion(state.value, total.value);
  if (!isLast) return;
  // 最后一题：把答对率换算成 0..3 级，重排下次复习的间隔
  await progress.recordReview(props.entryId, gradeOf(state.value, total.value));
  const dueAt = progress.reviewOf(props.entryId).dueAt;
  dueInDays.value = dueAt === null ? null : daysUntil(dueAt, platform.now());
}
</script>

<template>
  <section data-testid="review" class="mx-auto max-w-2xl px-5 py-6">
    <h1 class="text-2xl font-bold text-[#b03a31]">{{ i18n.t('review.title') }}</h1>

    <p v-if="missing" class="mt-6 rounded-3xl bg-[#fffaf0] p-6 text-sm text-[#6b5a49]">
      {{ i18n.t('review.notFound') }}
    </p>

    <p
      v-else-if="!entry"
      class="mt-6 rounded-3xl bg-[#fffaf0] p-6 text-sm text-[#6b5a49]"
    >
      {{ i18n.t('review.loading') }}
    </p>

    <!-- 结果页：答对几题 + 下次什么时候再来 -->
    <div
      v-else-if="finished"
      data-testid="review-result"
      class="mt-6 rounded-3xl border-2 border-[#f0e0bd] bg-[#fffaf0] p-6 text-center"
    >
      <p class="text-2xl font-bold text-[#b03a31]">{{ entry.title }}</p>
      <p data-testid="review-score" class="mt-4 text-lg text-[#3a2f26]">
        {{ i18n.t('review.score', { n: state.correct, m: total }) }}
      </p>
      <p v-if="dueInDays !== null" data-testid="review-due" class="mt-2 text-sm text-[#6b5a49]">
        {{ i18n.t('review.nextDueIn', { n: dueInDays }) }}
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          data-testid="review-again"
          class="min-h-14 rounded-full bg-[#b03a31] px-6 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
          @click="navigate('/play/' + entryId)"
        >
          {{ i18n.t('review.playAgain') }}
        </button>
        <button
          type="button"
          data-testid="review-back"
          class="min-h-14 rounded-full bg-[#2c6b64] px-6 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
          @click="navigate('/album')"
        >
          {{ i18n.t('review.backToAlbum') }}
        </button>
      </div>
    </div>

    <!-- 答题页 -->
    <div v-else-if="question" class="mt-6">
      <p data-testid="review-progress" class="text-sm text-[#6b5a49]">
        {{ i18n.t('review.progress', { n: state.index + 1, m: total }) }}
      </p>
      <h2 data-testid="review-question" class="mt-2 text-xl leading-relaxed font-bold">
        {{ question.question }}
      </h2>

      <ul class="mt-5 grid gap-3">
        <li v-for="(option, index) in question.options" :key="option">
          <button
            type="button"
            class="w-full rounded-2xl border-2 px-5 py-4 text-left text-base active:scale-[0.99] disabled:opacity-100"
            :class="[
              state.picked === null
                ? 'border-[#f0e0bd] bg-[#fffaf0]'
                : index === question.answer
                  ? 'border-[#2c6b64] bg-[#e6f1ef]'
                  : index === state.picked
                    ? 'border-[#b03a31] bg-[#fdeaea]'
                    : 'border-[#f0e0bd] bg-[#fffaf0] opacity-60',
            ]"
            :data-testid="'review-option-' + index"
            :disabled="state.picked !== null"
            @click="choose(index)"
          >
            {{ option }}
          </button>
        </li>
      </ul>

      <!-- 作答之后：对错 + 为什么（读屏也能听到） -->
      <div v-if="answered" data-testid="review-feedback" aria-live="polite" class="mt-5">
        <p class="text-lg font-bold" :class="pickedRight ? 'text-[#2c6b64]' : 'text-[#b03a31]'">
          {{ pickedRight ? i18n.t('review.correct') : i18n.t('review.wrong') }}
        </p>
        <p class="mt-1 text-sm leading-relaxed text-[#5c4b3d]">{{ question.explanation }}</p>
      </div>

      <button
        v-if="answered"
        ref="nextButton"
        type="button"
        data-testid="review-next"
        class="mt-6 min-h-14 w-full rounded-full bg-[#b03a31] px-6 py-3 text-base font-bold text-[#fdf3dc] active:scale-95"
        @click="next"
      >
        {{ state.index + 1 >= total ? i18n.t('review.seeResult') : i18n.t('review.next') }}
      </button>
    </div>
  </section>
</template>
