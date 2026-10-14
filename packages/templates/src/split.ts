import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, CSS, THEME, createDragController, createHand, popIn, roundRect, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import type { DragController } from '@chags/phaser-kit';
import { SCENE_KEYS, SPLIT } from './layout';
import {
  countsFor, dividerX, happyLeft, isGreedy, isSplitSolved, leftFromX, mood, moodLine,
  splitState, stepToward,
} from './split.logic';
import type { SplitState } from './split.logic';
import type { SplitLevel } from './schemas';
import type { SessionState } from './session';

/** 交给游戏画的一切：树、猴子、它们的脸色 */
export interface SplitStageState extends SplitState {
  counts: Record<string, number>;
  mood: 'happy' | 'angry';
  /** 有一头被分空了 */
  greedy: boolean;
  solved: boolean;
  dragging: boolean;
}

export interface SplitConfig {
  level: SplitLevel;
  session: SessionState;
  nextSceneKey: string;
  titleKey: MessageKey;
  /** 这个世界：树、猴子、草地 */
  drawWorld?: (g: Phaser.GameObjects.Graphics, state: SplitStageState) => void;
  /** 每一颗是什么样子（默认画一颗圆圆的果子） */
  drawThing?: (
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    filled: boolean,
  ) => void;
  /** 收尾：把"刚才那种分法"的虚影摆出来（由游戏画） */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: SplitStageState) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 总量不变，换个分法。
 *
 * 两条刻意的设计：
 * - **守恒看得见**：东西一颗一颗串在绳上，动的只有中间那块木牌 ——
 *   没有人加、没有人减，绳上永远是那么多颗。
 * - **观众只看一头**：规则写在数据里（audience.happyAt），孩子自己发现"换个说法就换了脸色"。
 */
export function createSplitScene(ctx: GameContext, cfg: SplitConfig): Phaser.Types.Scenes.SceneType {
  return class SplitScene extends BaseScene {
    private state: SplitState = splitState(cfg.level.initialLeft, cfg.level);
    private drag: DragController | null = null;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private ropeGfx: Phaser.GameObjects.Graphics | null = null;
    private divider: Phaser.GameObjects.Container | null = null;
    private countText: Phaser.GameObjects.Text | null = null;
    private equation: Phaser.GameObjects.Text | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private busy = false;
    private finished = false;
    private dragging = false;
    private idleMs = 0;
    private greedySeen = false;

    constructor() {
      super(SCENE_KEYS.split, ctx);
    }

    private get startX(): number {
      return cfg.level.bins[0]!.x;
    }

    private get endX(): number {
      return cfg.level.bins[1]!.x;
    }

    private get ropeY(): number {
      return cfg.level.bins[0]!.y;
    }

    private get gap(): number {
      return (this.endX - this.startX) / cfg.level.total;
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.split });
      this.drawBackdrop(this.tr(cfg.titleKey));

      this.worldGfx = this.add.graphics().setDepth(1);
      this.ropeGfx = this.add.graphics().setDepth(3);
      this.drawLabels();
      this.drawDivider();
      this.drawEquation();

      this.drag = createDragController(this);
      this.events.once('shutdown', () => {
        this.drag?.destroy();
        this.drag = null;
      });

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.redraw();
      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 画面 ----------------

    private stageState(): SplitStageState {
      return {
        ...this.state,
        counts: countsFor(this.state, cfg.level),
        mood: mood(this.state, cfg.level),
        greedy: isGreedy(this.state, cfg.level),
        solved: isSplitSolved(this.state, cfg.level),
        dragging: this.dragging,
      };
    }

    private redraw(): void {
      const state = this.stageState();
      const world = this.worldGfx;
      if (world) {
        world.clear();
        cfg.drawWorld?.(world, state);
      }
      this.drawRope();
      this.divider?.setPosition(dividerX(this.state.left, cfg.level, this.startX, this.gap), this.ropeY);
      if (this.countText) {
        const left = state.counts[cfg.level.bins[0]!.id] ?? 0;
        const right = state.counts[cfg.level.bins[1]!.id] ?? 0;
        this.countText.setText(left + '   ' + right);
        this.countText.setPosition((this.startX + this.endX) / 2, this.ropeY + 74);
      }
      this.equation?.setText(
        (state.counts[cfg.level.bins[0]!.id] ?? 0) +
          ' + ' +
          (state.counts[cfg.level.bins[1]!.id] ?? 0) +
          ' = ' +
          cfg.level.total,
      );
    }

    /** 绳上串着的东西：一颗一颗都在，只是分界在动 */
    private drawRope(): void {
      const g = this.ropeGfx;
      if (!g) return;
      g.clear();
      g.lineStyle(6, THEME.woodDeep, 1);
      g.lineBetween(this.startX, this.ropeY, this.endX, this.ropeY);
      for (let i = 0; i < cfg.level.total; i += 1) {
        const x = this.startX + this.gap * (i + 0.5);
        const y = this.ropeY - 34;
        // 绳子从每一颗的"顶上"穿过：看起来就是串着的
        g.lineStyle(6, THEME.woodDeep, 1);
        g.lineBetween(x, this.ropeY, x, y - 24);
        if (cfg.drawThing) cfg.drawThing(g, cfg.level.bins[0]!.kind, x, y, true);
        else {
          g.fillStyle(THEME.gold, 1);
          g.fillCircle(x, y, 26);
          g.lineStyle(5, THEME.goldDeep, 1);
          g.strokeCircle(x, y, 26);
        }
      }
    }

    private drawLabels(): void {
      for (const bin of cfg.level.bins) {
        this.add
          .text(bin.x, bin.y + 124, bin.label, textStyle(32, CSS.ink, true))
          .setOrigin(0.5)
          .setDepth(6);
      }
      this.countText = this.add
        .text((this.startX + this.endX) / 2, this.ropeY + 74, '', textStyle(46, CSS.redDeep, true))
        .setOrigin(0.5)
        .setDepth(6);
    }

    /** 总数写在绳子上：不管怎么分，等号右边永远是它 */
    private drawEquation(): void {
      this.equation = this.add
        .text(this.startX, this.ropeY - 190, '', textStyle(38, CSS.tealDeep, true))
        .setOrigin(0, 0.5)
        .setDepth(6);
    }

    private drawDivider(): void {
      const node = this.add.container(0, this.ropeY).setDepth(30);
      const g = this.add.graphics();
      roundRect(g, -14, -104, 28, 150, 12, THEME.wood, THEME.outline, 5);
      roundRect(g, -46, -168, 92, 74, 24, THEME.red, THEME.outline, 5);
      roundRect(g, -30, -150, 60, 12, 6, THEME.paper, null, 0);
      node.add(g);
      popIn(this, node);
      this.divider = node;

      this.drag?.add({
        obj: node,
        radius: SPLIT.dividerRadius,
        enabled: () => !this.finished && !this.busy,
        onGrab: () => {
          this.dragging = true;
          this.hideHand();
          this.idleMs = 0;
        },
        onDrop: () => {
          this.dragging = false;
          this.applyLeft(leftFromX(node.x, cfg.level, this.startX, this.gap), true);
        },
      });
    }

    // ---------------- 输入 ----------------

    /** 木牌可以拖，也可以直接点绳子上想分的地方（手指粗也不怕） */
    private onTap(pointer: Phaser.Input.Pointer): void {
      if (this.finished || this.busy) return;
      if (Math.abs(pointer.y - this.ropeY) > 190) return;
      const divider = dividerX(this.state.left, cfg.level, this.startX, this.gap);
      if (Math.abs(pointer.x - divider) <= SPLIT.dividerRadius) return;
      const wanted = leftFromX(pointer.x, cfg.level, this.startX, this.gap);
      this.applyLeft(wanted, false);
    }

    private applyLeft(next: number, spoken: boolean): void {
      const before = mood(this.state, cfg.level);
      this.state = splitState(next, cfg.level);
      const after = mood(this.state, cfg.level);
      this.idleMs = 0;
      this.hideHand();
      this.redraw();

      const state = this.stageState();
      if (state.greedy && !this.greedySeen) {
        this.greedySeen = true;
        this.ctx.emit('beat:enter', { beatId: 'split:greedy' });
        // 只说事实，不说"聪明"也不说"骗" —— 评价留给孩子自己下
        const line = cfg.level.audience.greedyLine;
        if (line !== undefined) {
          this.speak(line);
          this.showHint(line, 2600, 268);
        }
      }
      if (after !== before) {
        this.sfx(after === 'happy' ? 'correct' : 'wrong');
        sparkleAt(this, (this.startX + this.endX) / 2, this.ropeY - 60, THEME.gold, 6);
        this.speak(moodLine(this.state, cfg.level));
        this.ctx.emit('beat:enter', { beatId: 'split:mood:' + after });
      } else if (spoken) {
        this.sfx('tap');
      }

      if (state.solved) {
        this.busy = true;
        const wait = this.autoplay ? 320 : SPLIT.reactMs;
        this.time.delayedCall(wait, () => this.finish());
      }
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.busy = true;
      this.hideHand();
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, (this.startX + this.endX) / 2, this.ropeY, THEME.gold, 12);
      const finale = this.add.graphics().setDepth(40);
      cfg.drawFinale?.(finale, this.stageState());
      if (cfg.reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(cfg.reveal as string, 3200, 268));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? 4200, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 提示 ----------------

    private tick(delta: number): void {
      if (this.finished || this.busy || this.dragging) return;
      this.idleMs += delta;
      if (this.idleMs < SPLIT.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
      const divider = dividerX(this.state.left, cfg.level, this.startX, this.gap);
      if (!this.hand) this.hand = createHand(this, divider, this.ropeY - 210, 1.15);
      // 小手顺便把木牌往前推一格 —— 提示不靠文字
      this.applyLeft(stepToward(this.state, happyLeft(cfg.level), cfg.level).left, false);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    private runAutoplay(): void {
      this.time.addEvent({
        delay: 420,
        loop: true,
        callback: () => {
          if (this.finished || this.busy) return;
          const next = stepToward(this.state, happyLeft(cfg.level), cfg.level);
          if (next.left === this.state.left) return;
          this.applyLeft(next.left, false);
        },
      });
    }
  };
}
