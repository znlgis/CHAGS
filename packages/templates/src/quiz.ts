import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { QuizQuestion } from '@chags/content';
import { BaseScene, CSS, THEME, textStyle } from '@chags/phaser-kit';
import { QUIZ, SCENE_KEYS } from './layout';
import type { SessionState } from './session';

export interface QuizConfig {
  questions: QuizQuestion[];
  nextSceneKey: string;
  session: SessionState;
}

/** 记忆巩固 + 迁移测验：答对不算完，能说出为什么才算 */
export function createQuizScene(ctx: GameContext, cfg: QuizConfig): Phaser.Types.Scenes.SceneType {
  return class QuizScene extends BaseScene {
    private index = 0;
    private correct = 0;
    private locked = false;
    private root: Phaser.GameObjects.Container | null = null;

    constructor() {
      super(SCENE_KEYS.quiz, ctx);
    }

    create(): void {
      this.drawBackdrop('小考验');
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.quiz });
      this.showQuestion(0);
    }

    private showQuestion(index: number): void {
      const question = cfg.questions[index];
      if (!question) {
        this.finish();
        return;
      }
      this.locked = false;
      this.root?.destroy(true);
      const container = this.add.container(0, 0);
      this.root = container;

      container.add(
        this.add
          .text(
            375,
            196,
            '第 ' + (index + 1) + ' / ' + cfg.questions.length + ' 题',
            textStyle(32, CSS.inkSoft),
          )
          .setOrigin(0.5),
      );
      container.add(this.addBody(85, QUIZ.questionY, question.question, 42, CSS.ink, this.W - 170));

      question.options.slice(0, QUIZ.options.length).forEach((option, i) => {
        const pos = QUIZ.options[i];
        if (!pos) return;
        container.add(
          this.addButton(pos.x, pos.y, option, () => this.answer(i), {
            width: 640,
            height: 124,
            color: THEME.teal,
            fontSize: 34,
          }),
        );
      });

      if (!this.autoplay) this.speak(question.question);

      if (this.autoplay) {
        this.time.delayedCall(120, () => this.answer(question.answer));
      }
    }

    private answer(choice: number): void {
      if (this.locked) return;
      const question = cfg.questions[this.index];
      if (!question) return;
      this.locked = true;

      const isRight = choice === question.answer;
      if (isRight) {
        this.correct += 1;
        this.sfx('correct');
      } else {
        cfg.session.mistakes += 1;
        this.sfx('wrong');
      }

      const container = this.add.container(0, 0);
      this.root?.add(container);
      container.add(
        this.add
          .text(375, QUIZ.next.y - 210, isRight ? '答对啦！' : '再看看答案～', textStyle(40, isRight ? CSS.teal : CSS.red, true))
          .setOrigin(0.5),
      );
      container.add(
        this.addBody(95, QUIZ.next.y - 150, question.explanation, 32, CSS.ink, this.W - 190),
      );
      container.add(
        this.addButton(QUIZ.next.x, QUIZ.next.y, '继续', () => this.next(), { color: THEME.red }),
      );

      if (!this.autoplay) this.speak(question.explanation);
      if (this.autoplay) this.time.delayedCall(150, () => this.next());
    }

    private next(): void {
      this.index += 1;
      this.showQuestion(this.index);
    }

    private finish(): void {
      cfg.session.correct = this.correct;
      cfg.session.total = cfg.questions.length;
      this.scene.start(cfg.nextSceneKey);
    }
  };
}
