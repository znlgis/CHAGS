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
