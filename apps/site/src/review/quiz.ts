import type { QuizQuestion } from '@chags/content';
import { gradeFromScore } from '@chags/progress';

/**
 * 到期复习的小测验：**纯状态机**，不碰 DOM 也不读时钟 ——
 * 界面（apps/site/src/views/ReviewView.vue）只负责把它画出来。
 *
 * 题目来自内容里的 `quiz`（每条内容 3 道，含 1 道 transfer），
 * 评级复用进度包的 gradeFromScore：答对率决定下次复习间隔（见 docs/技术方案.md §7.4）。
 */
export interface ReviewQuizState {
  /** 当前第几题（0 起）。等于题数时表示答完了 */
  index: number;
  /** 当前这题选了几号，null = 还没作答 */
  picked: number | null;
  /** 一共答对几题 */
  correct: number;
}

export function createReviewQuiz(): ReviewQuizState {
  return { index: 0, picked: null, correct: 0 };
}

/** FNV-1a 32 位哈希：把内容 id + 题目 id 变成一个稳定种子 */
function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32：小而稳的确定性随机数 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 把选项打散：同一道题每次进来顺序一致（种子 = 内容 id + 题目 id），
 * 但**不是**内容里写的原顺序 —— 否则 86.7% 的题答案都在第一个，
 * 孩子只点第一个就能"通关"复习。
 *
 * 注意：改的是呈现顺序，answer 下标跟着一起换算；题干、解释、对错判定都不变。
 */
export function shuffledQuestions(quiz: QuizQuestion[], seedText: string): QuizQuestion[] {
  return quiz.map((question) => {
    const rand = mulberry32(hashSeed(seedText + ':' + question.id));
    const order = question.options.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const a = order[i]!;
      order[i] = order[j]!;
      order[j] = a;
    }
    return {
      ...question,
      options: order.map((index) => question.options[index]!),
      answer: order.indexOf(question.answer),
    };
  });
}

export function isRight(question: QuizQuestion, choice: number): boolean {
  return choice === question.answer;
}

/** 作答。同一题只认第一次 —— 界面同时会把选项按钮禁掉 */
export function pickOption(
  state: ReviewQuizState,
  question: QuizQuestion,
  choice: number,
): ReviewQuizState {
  if (state.picked !== null) return state;
  return { ...state, picked: choice, correct: state.correct + (isRight(question, choice) ? 1 : 0) };
}

/** 这一题看完了 → 下一题；没作答时不动 */
export function nextQuestion(state: ReviewQuizState, total: number): ReviewQuizState {
  if (state.picked === null) return state;
  return { ...state, index: Math.min(state.index + 1, total), picked: null };
}

export function isFinished(state: ReviewQuizState, total: number): boolean {
  return state.index >= total;
}

/** 这一局算几级（0..3）—— 决定下次复习间隔 */
export function gradeOf(state: ReviewQuizState, total: number): 0 | 1 | 2 | 3 {
  return gradeFromScore(state.correct, total);
}
