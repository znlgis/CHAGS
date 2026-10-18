import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '@chags/content';
import {
  createReviewQuiz,
  gradeOf,
  isFinished,
  isRight,
  nextQuestion,
  pickOption,
  shuffledQuestions,
} from './quiz';

const questions: QuizQuestion[] = [
  { id: 'q1', kind: 'recall', question: '一', options: ['甲', '乙'], answer: 0, explanation: '甲' },
  { id: 'q2', kind: 'recall', question: '二', options: ['甲', '乙'], answer: 1, explanation: '乙' },
  { id: 'q3', kind: 'transfer', question: '三', options: ['甲', '乙'], answer: 0, explanation: '甲' },
];

describe('复习小测验的状态机', () => {
  it('答对才计数，答错不算 —— 同一题不会重复计分', () => {
    let state = createReviewQuiz();
    state = pickOption(state, questions[0]!, 0);
    expect(state.correct).toBe(1);
    // 锁定之后再点别的选项：什么都不变
    state = pickOption(state, questions[0]!, 1);
    expect(state).toEqual({ index: 0, picked: 0, correct: 1 });
  });

  it('没作答就点"继续"不动，作答后才翻页', () => {
    const state = createReviewQuiz();
    expect(nextQuestion(state, questions.length)).toEqual(state);
    const answered = pickOption(state, questions[0]!, 1);
    expect(nextQuestion(answered, questions.length)).toEqual({ index: 1, picked: null, correct: 0 });
  });

  it('答完最后一题才算结束，且不会翻过头', () => {
    let state = createReviewQuiz();
    for (const question of questions) {
      expect(isFinished(state, questions.length)).toBe(false);
      state = nextQuestion(pickOption(state, question, question.answer), questions.length);
    }
    expect(isFinished(state, questions.length)).toBe(true);
    expect(nextQuestion(state, questions.length)).toEqual(state);
  });

  it('评级按答对率：全对 3 级、两对 2 级、一对一 1 级、全错 0 级', () => {
    expect(gradeOf({ index: 3, picked: null, correct: 3 }, 3)).toBe(3);
    expect(gradeOf({ index: 3, picked: null, correct: 2 }, 3)).toBe(2);
    expect(gradeOf({ index: 3, picked: null, correct: 1 }, 3)).toBe(1);
    expect(gradeOf({ index: 3, picked: null, correct: 0 }, 3)).toBe(0);
  });

  it('isRight 认答案下标，不认选项文字', () => {
    expect(isRight(questions[1]!, 1)).toBe(true);
    expect(isRight(questions[1]!, 0)).toBe(false);
    expect(isRight(questions[1]!, 9)).toBe(false);
  });
});

describe('选项洗牌', () => {
  it('洗牌只改呈现顺序：答案内容不变、判定仍然正确', () => {
    const shuffled = shuffledQuestions(questions, 'caochong-elephant');
    expect(shuffled).toHaveLength(questions.length);
    shuffled.forEach((question, index) => {
      const original = questions[index]!;
      expect(question.options[question.answer]).toBe(original.options[original.answer]);
      expect([...question.options].sort()).toEqual([...original.options].sort());
    });
  });

  it('同一条内容每次进来顺序一致（确定性种子）', () => {
    expect(shuffledQuestions(questions, 'lianhuan-ji')).toEqual(
      shuffledQuestions(questions, 'lianhuan-ji'),
    );
  });

  it('答案位置被真正打散：内容里答案全在第一个，洗牌后也不该挤在一起', () => {
    // 模拟内容现状：60 道题的正确答案都写在第一个选项上
    const skewed: QuizQuestion[] = Array.from({ length: 60 }, (_, index) => ({
      id: 'q' + index,
      kind: index % 3 === 0 ? 'transfer' : 'recall',
      question: '题干' + index,
      options: ['对的', '错的一', '错的二'],
      answer: 0,
      explanation: '对的',
    }));
    const positions: Record<number, number> = {};
    for (const entryId of ['caochong-elephant', 'lianhuan-ji', 'pangu', 'meiren-ji']) {
      for (const question of shuffledQuestions(skewed, entryId)) {
        positions[question.answer] = (positions[question.answer] ?? 0) + 1;
      }
    }
    const total = Object.values(positions).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(240);
    // 以前孩子只点第一个就能过；洗牌后没有任何位置超过一半
    for (const [position, count] of Object.entries(positions)) {
      expect(count / total, '答案位置 ' + position).toBeLessThan(0.5);
    }
    expect(Object.keys(positions).length).toBeGreaterThanOrEqual(3);
  });
});
