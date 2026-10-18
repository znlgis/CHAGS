import type Phaser from 'phaser';
import type { GameContext, SpeechOutcome } from '@chags/game-kit';
import type { StoryBeat } from '@chags/content';
import { BaseScene, CSS, THEME, roundRect, textStyle } from '@chags/phaser-kit';
import { SCENE_KEYS, STORY_ART, STORY_TEXT_WRAP, STORY_TEXT_Y, STORY_TITLE_Y } from './layout';
import { gateWatchdogMs, narrationMs, remainingGateMs } from './story.logic';

export interface StoryConfig {
  beats: StoryBeat[];
  nextSceneKey: string;
  /**
   * 分幕插图：**契约只画两幕**，index 只有 0 / 1。
   *
   * 内容 schema 已把 story 锁成 length(2)（packages/content/src/schema.ts），
   * 第 3 幕会先在 pnpm content:check 构建期报错；真要三幕，先扩这份契约
   * （以及 game-kit 的 Art 渲染约定），而不是让第 3 幕静默复用第 2 幅图。
   */
  drawBeat?: (
    g: Phaser.GameObjects.Graphics,
    index: 0 | 1,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
}

/** 小手 / 小喇叭落在哪儿：正常在正文下面，正文太长（英文）就挪到右下角 */
interface HandAt {
  x?: number;
  y?: number;
}

/**
 * 开场：一屏一个画面、一句话。
 *
 * 两条规矩：
 * - 故事只用来看懂"问题是什么"，真正的"怎么解决"留给后面的动手环节；
 * - **每一幕的旁白都要听完**，小手才会出现。点早了不翻页，只回一句"先听完这个故事"。
 *
 * 第二条是刻意的：故事是这个产品的正片。跳过它，后面的动手环节就成了没有来由的小游戏，
 * 孩子记住了操作，却没记住典故 —— 那正是这一系列最不想看到的结果。
 * 无头验证（?autoplay=1 全自动）与截图巡检（?story=instant）不受这条限制。
 */
export function createStoryScene(
  ctx: GameContext,
  cfg: StoryConfig,
): Phaser.Types.Scenes.SceneType {
  return class StoryScene extends BaseScene {
    private disposed = false;
    private nagAt = 0;

    constructor() {
      super(SCENE_KEYS.story, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.story });
      this.ctx.emit('session:start', { at: this.ctx.services.now() });
      this.events.once('shutdown', () => {
        this.disposed = true;
        // 离开故事页就别再念了 —— 后一屏有自己的旁白
        this.ctx.services.audio.stopSpeech();
      });
      this.showBeat(0);
    }

    private showBeat(index: number): void {
      const beat = cfg.beats[index];
      if (!beat) {
        this.scene.start(cfg.nextSceneKey);
        return;
      }
      this.children.removeAll(true);
      this.drawBackdrop(this.tr('scene.story'));
      this.ctx.emit('beat:enter', { beatId: beat.id });

      // 插画面板
      const panel = this.add.graphics();
      roundRect(
        panel,
        STORY_ART.x - 8,
        STORY_ART.y - 8,
        STORY_ART.w + 16,
        STORY_ART.h + 16,
        44,
        THEME.card,
        THEME.outline,
        6,
      );
      const art = this.add.graphics();
      // drawBeat 契约只画两幕（内容 schema 已锁 length(2)）：显示层的 index
      // 只可能走到 0 / 1（beat 不存在时 showBeat 直接转场），这里收敛成契约类型。
      const beatIndex: 0 | 1 = index === 0 ? 0 : 1;
      cfg.drawBeat?.(art, beatIndex, STORY_ART);

      let textBottom = STORY_TEXT_Y;
      if (beat.text.length > 0) {
        this.add
          .text(this.W / 2, STORY_TITLE_Y, beat.title, textStyle(58, CSS.red, true))
          .setOrigin(0.5);
        const body = this.add
          .text(this.W / 2, STORY_TEXT_Y, beat.text, {
            ...textStyle(44, CSS.ink, true),
            align: 'center',
            wordWrap: { width: STORY_TEXT_WRAP, useAdvancedWrap: true },
            lineSpacing: 14,
          })
          .setOrigin(0.5, 0);
        textBottom = body.y + body.height;
      }

      // 小手跟在正文下面；实在放不下（很长的英文句子）就挪到右下角
      const below = Math.max(this.H - 150, textBottom + 64);
      const handAt: HandAt =
        below <= this.H - 72 ? { y: below } : { x: this.W - 104, y: this.H - 104 };
      const next = (): void => this.showBeat(index + 1);

      if (this.autoplay || this.storyInstant) {
        this.tapToContinue(next, handAt);
        return;
      }
      this.listenFirst(beat, handAt, next);

      // 二周目：已经通关过的孩子可以直接跳过故事（首次仍然必须听完）。
      // ★ 必须在 listenFirst 之后创建：它会给整屏加一层点击区（点早了只回一句"先听完"），
      // 先建的按钮会被那层盖住、点不到。位置在标题条下面，离小手很远。
      if (this.ctx.completedBefore) {
        this.showSkip();
      }
    }

    /**
     * 听不完就不许翻页。
     * 念完 → 发 story:ready → 小手出现；念不出来（静音 / 没装语音包 / 无头浏览器）
     * → 补足"读一遍"的时间再放行 —— 在哪种设备上都不能把这一页白白跳过去。
     */
    private listenFirst(beat: StoryBeat, handAt: HandAt, next: () => void): void {
      const narration = beat.narration.trim();
      if (narration.length === 0) {
        this.tapToContinue(next, handAt);
        return;
      }

      const startedAt = this.ctx.services.now();
      const full = narrationMs(narration, this.ctx.locale);
      const handle = this.ctx.services.audio.speak(narration, this.ctx.locale);
      // 正文很长时（英文天然更长）底部一条空位都没有：小喇叭改放在插画面板的下缘，
      // 宁可压一点画面，也不能压住那句正在念的话。
      const ears = this.spawnEars(
        handAt.x === undefined ? (handAt.y ?? this.H - 150) : STORY_ART.y + STORY_ART.h - 60,
        startedAt,
        full,
      );

      // 还在念的时候，点哪都只回应一句"先听完"，不翻页
      const shield = this.add.zone(this.W / 2, this.H / 2, this.W, this.H).setInteractive();
      shield.on('pointerdown', () => this.nag());

      let ready = false;
      const unlock = (): void => {
        if (ready || this.disposed) return;
        ready = true;
        ears.destroy(true);
        shield.destroy();
        this.ctx.emit('story:ready', { beatId: beat.id });
        this.tapToContinue(next, handAt);
      };
      const settle = (outcome: SpeechOutcome): void => {
        if (ready || this.disposed) return;
        const waited = this.ctx.services.now() - startedAt;
        const rest = remainingGateMs(narration, this.ctx.locale, outcome, waited);
        if (rest <= 0) unlock();
        else this.time.delayedCall(rest, unlock);
      };
      // 两种结局都要 settle：真的念完 → 立刻放行；念不出来 → 补足读一遍的时间
      void handle.done.then(settle, () => settle('unavailable'));
      // 兜底：语音引擎一直不回报（部分 WebView 就是这样）也不能把孩子钉在这一幕
      this.time.delayedCall(gateWatchdogMs(narration, this.ctx.locale), () => settle('unavailable'));
    }

    /**
     * 二周目的「跳过故事」：直接进玩法。
     * 只在 ctx.completedBefore 为真时出现 —— 首次听故事这条硬规矩没有松动。
     */
    private showSkip(): void {
      this.addButton(
        this.W - 138,
        228,
        this.tr('story.skip'),
        () => {
          this.ctx.emit('choice:made', {
            beatId: 'story:skip',
            choiceId: 'skip',
            correct: true,
            latencyMs: this.ctx.services.now(),
          });
          this.ctx.services.audio.stopSpeech();
          this.scene.start(cfg.nextSceneKey);
        },
        { width: 236, height: 92, fontSize: 34, color: THEME.inkSoft },
      ).setDepth(950);
    }

    /** 点早了：不翻页，只告诉他故事还没听完 */
    private nag(): void {
      const now = this.ctx.services.now();
      if (now - this.nagAt < 1600) return;
      this.nagAt = now;
      this.sfx('tap');
      // 提示放在插画上方：标题、正文、小喇叭各自的位置都不能被它压住
      this.showHint(this.tr('story.listenFirst'), 2000, STORY_ART.y + 50);
    }

    /**
     * "正在念"的指示：小喇叭 + 三个跳动的小点 + 一条进度条。
     * 不写文字 —— 孩子看到进度在走，就知道这一页还要等一会儿。
     */
    private spawnEars(y: number, startedAt: number, full: number): Phaser.GameObjects.Container {
      const box = this.add.container(this.W / 2, y).setDepth(900);

      const card = this.add.graphics();
      roundRect(card, -160, -58, 320, 116, 58, THEME.card, THEME.outline, 5);

      // 喇叭：方块 + 张开的锥面 + 两道声波
      const horn = this.add.graphics();
      horn.fillStyle(THEME.inkSoft, 1);
      horn.fillRect(-132, -14, 16, 28);
      horn.fillTriangle(-116, -14, -84, -42, -84, 42);
      const wave = (radius: number): void => {
        horn.lineStyle(8, THEME.inkSoft, 1);
        horn.beginPath();
        for (let i = 0; i <= 10; i += 1) {
          const angle = -0.85 + (1.7 * i) / 10;
          const px = -80 + Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (i === 0) horn.moveTo(px, py);
          else horn.lineTo(px, py);
        }
        horn.strokePath();
      };
      wave(26);
      wave(48);

      const dots: Phaser.GameObjects.Graphics[] = [];
      for (let i = 0; i < 3; i += 1) {
        const dot = this.add.graphics();
        dot.fillStyle(THEME.gold, 1);
        dot.fillCircle(0, 0, 9);
        dot.setPosition(14 + i * 30, -16);
        dots.push(dot);
        if (!this.ctx.reducedMotion) {
          this.tweens.add({
            targets: dot,
            alpha: 0.22,
            duration: 520,
            delay: i * 170,
            yoyo: true,
            repeat: -1,
          });
        }
      }

      const bar = this.add.graphics();
      const drawBar = (progress: number): void => {
        bar.clear();
        roundRect(bar, -126, 20, 252, 16, 8, THEME.stone, null, 0);
        roundRect(bar, -126, 20, Math.max(16, 252 * progress), 16, 8, THEME.gold, null, 0);
      };
      drawBar(0);

      box.add([card, horn, bar, ...dots]);
      // 进度条按墙钟走：长按/连点那套"按帧累加"的老毛病不能在故事页重演
      const tick = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const progress = (this.ctx.services.now() - startedAt) / Math.max(1, full);
          drawBar(Math.min(0.96, progress));
        },
      });
      // repeat: -1 的补间不会自己结束，销毁时必须一起收掉，否则会一直空转
      box.once('destroy', () => {
        tick.remove();
        for (const dot of dots) this.tweens.killTweensOf(dot);
      });
      return box;
    }
  };
}
