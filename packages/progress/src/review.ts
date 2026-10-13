import type { ReviewState } from '@chags/game-kit';

export const DAY_MS = 86_400_000;
/** 简化版 SM-2：间隔递增，答错降级 */
export const REVIEW_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 21, 60];

export function createReviewState(): ReviewState {
  return { level: 0, dueAt: null, lastGrade: null, reviews: 0 };
}

export function nextReview(state: ReviewState, grade: 0 | 1 | 2 | 3, now: number): ReviewState {
  const maxLevel = REVIEW_INTERVALS_DAYS.length - 1;
  const level = grade >= 2 ? Math.min(state.level + 1, maxLevel) : Math.max(state.level - 1, 0);
  const days = REVIEW_INTERVALS_DAYS[level] ?? 1;
  return { level, dueAt: now + days * DAY_MS, lastGrade: grade, reviews: state.reviews + 1 };
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.dueAt !== null && state.dueAt <= now;
}

/**
 * 答对率 → 0..3 级，用于安排下次复习间隔。
 * 门槛刻意放宽（60% 即 2 级）：这是给小朋友的，宁可多复习一次，也不要打击信心。
 */
export function gradeFromScore(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const ratio = correct / total;
  if (ratio >= 1) return 3;
  if (ratio >= 0.6) return 2;
  if (ratio >= 0.3) return 1;
  return 0;
}
