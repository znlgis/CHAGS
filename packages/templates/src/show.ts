import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  SHOW_RATES, aliveShadowIds, aliveShadows, beliefAt, isShowDone, missingShadows, nextSlotToPaint,
  paint, shadowStrength, showStart, slotAt, tick as advanceShow,
} from './show.logic';
import type { ShowState } from './show.logic';
import type { ShowLevel, ShowSlot } from './schemas';
import type { SessionState } from './session';

/**
 * 造势模板自己的常量 —— 不挤进 layout.ts，免得新模板之间互相踩。
 * 涨落速度那几个（risePerSec / fallPerSec / autoplayFactor）来自 show.logic：
 * 单测、画面与无头验证用的是同一份。
 */
export const SHOW = {
  ...SHOW_RATES,
  /** 点空位的命中宽容度：手指粗也能点到船帮上的位子（相邻空位靠"最近的赢"分开） */
  tapForgive: 80,
  /** 开局过一会儿就把"该在空位上画一笔"说出来（不让孩子干等） */
  introHintMs: 1200,
  /** 多久没动静就把小手放到下一个该补的空位上 */
  idleMs: 8000,
  /** 无头验证：多久补一笔（影子的寿命不压缩，压缩的只是"疑心涨多快"） */
  autoplayPaintMs: 260,
  /** 打赢之后看一眼雾里的船再走 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 交给游戏画的一切：船、雾、六个空位上的草人、对面那杆疑心的秤 */
export interface ShowStageState {
  /** 每个空位上影子的强弱（1 = 刚画上，0 = 淡没了）—— 草人随它变淡变小 */
  strength: Record<string, number>;
  /** 还在立着的影子 id */
  alive: string[];
  /** 还差几个才够 needed（够 = 0）：画面上"还不够"的那一层心事 */
  missing: number;
  /** 对面的疑心（0..goal） */
  belief: number;
  goal: number;
  /** 疑心涨到几成（0..1）—— 疑心条按它画 */
  ratio: number;
  /** 此刻影子够不够（疑心在涨还是在落） */
  rising: boolean;
  /** 一笔能立多久（画面上的沙漏） */
  fadeMs: number;
  /** 一共画了多少笔 */
  strokes: number;
  elapsedMs: number;
  /** 这一局打赢了 */
  done: boolean;
}

export interface ShowApi {
  scene: Phaser.Scene;
  stage: ShowStageState;
}

export interface ShowConfig {
  level: ShowLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：江、雾、船、船帮上的六个空位（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ShowLevel) => void;
  /** 每帧重画：影子、箭、疑心条 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ShowStageState, level: ShowLevel) => void;
  /** 画上一笔时的表现（雾散开一点、影子晃一下） */
  onPaint?: (slot: ShowSlot, api: ShowApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ShowStageState, level: ShowLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 造势：从什么都没有开始，把一个不存在的东西**维持住**。
 *
 * 三条刻意的设计：
 * - **判定全在 show.logic 里**：场景只把墙钟喂给 `advanceShow` / `isShowDone`，
 *   单测与画面用的是同一份判定，不会跑偏。
 * - **一笔只管 fadeMs**：画下去的影子到点就淡掉，得回头补 —— 手一停，疑心就回落。
 *   所以这一关考的不是"点一下"，是"撑着"。
 * - **零惩罚**：影子全淡光也不结束、不扣星；疑心落到底就落到底，补上又能涨回来。
 */
export function createShowScene(ctx: GameContext, cfg: ShowConfig): Phaser.Types.Scenes.SceneType {
  return class ShowScene extends BaseScene {
    private level: ShowLevel = cfg.level;
    private state: ShowState = showStart();
    private startedAt = 0;
    private finished = false;
    private idleMs = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.show, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.show });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 2600, SHOW.hintY);
        this.time.delayedCall(SHOW.introHintMs, () => this.pointAtNext());
      }
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        // 无头验证把每一帧的记账时间放大几倍：影子的寿命照旧，只是疑心涨得快得多
        const step = this.autoplay ? delta * SHOW.autoplayFactor : delta;
        this.state = advanceShow(this.level, this.state, elapsed, step);

        this.idleMs += delta;
        if (this.idleMs >= SHOW.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, SHOW.hintY);
          this.pointAtNext();
        }
        if (isShowDone(this.level, this.state)) this.finish();
      }
      this.redraw(elapsed);
    }

    private redraw(elapsed: number): void {
      const g = this.stageGfx;
      if (!g) return;
      g.clear();
      cfg.drawStage(g, this.stageState(elapsed), this.level);
    }

    private stageState(elapsed: number): ShowStageState {
      const strength: Record<string, number> = {};
      for (const slot of this.level.slots) {
        strength[slot.id] = shadowStrength(this.level, this.state, slot.id, elapsed);
      }
      const alive = aliveShadowIds(this.level, this.state, elapsed);
      const belief = beliefAt(this.level, this.state, elapsed);
      return {
        strength,
        alive,
        missing: missingShadows(this.level, this.state, elapsed),
        belief,
        goal: this.level.goal,
        ratio: Math.min(1, Math.max(0, belief / this.level.goal)),
        rising: alive.length >= this.level.needed,
        fadeMs: this.level.fadeMs,
        strokes: this.state.strokes,
        elapsedMs: elapsed,
        done: this.finished && isShowDone(this.level, this.state),
      };
    }

    // ---------------- 画一笔 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      const slot = slotAt(this.level, pointer.x, pointer.y, SHOW.tapForgive);
      if (!slot) return;
      this.paintSlot(slot);
    }

    /** 画上一笔（真实操作与无头验证走的是同一条路） */
    private paintSlot(slot: ShowSlot): void {
      if (this.finished) return;
      const elapsed = this.elapsed();
      const before = aliveShadows(this.level, this.state, elapsed);
      this.state = paint(this.state, slot.id, elapsed);
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      // 立着的影子越多，音调越高 —— "势"是听得见的
      this.ctx.services.audio.tone(300 + Math.min(6, before) * 46, 70);
      this.ctx.emit('beat:enter', { beatId: 'show:paint:' + slot.id });
      cfg.onPaint?.(slot, { scene: this, stage: this.stageState(elapsed) });
      this.redraw(elapsed);
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'show:done' });
      this.redraw(this.elapsed());
      if (this.finaleGfx) {
        cfg.drawFinale?.(this.finaleGfx, this.stageState(this.elapsed()), this.level);
      }
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, SHOW.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? SHOW.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 小手 ----------------

    /** 把小手与光圈放到下一个该补的空位上 —— 提示给在点上，但"该立几个"要他自己看 */
    private pointAtNext(): void {
      if (this.finished) return;
      const slot = nextSlotToPaint(this.level, this.state, this.elapsed());
      if (!slot) return;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(slot.x, slot.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, slot.radius + 22);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.14,
        alpha: 0.4,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hideHand();
      this.hand = createHand(this, slot.x, slot.y + slot.radius + 36, 1.1);
    }

    private clearRing(): void {
      if (!this.ring) return;
      this.tweens.killTweensOf(this.ring);
      this.ring.destroy();
      this.ring = null;
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 轮转补画：影子不够就填一个空位，够了就续最快要淡掉的那一笔 ——
     * 与孩子该做的事一模一样，用的也是同一条 paintSlot() 路径。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: SHOW.autoplayPaintMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          const slot = nextSlotToPaint(this.level, this.state, this.elapsed());
          if (slot) this.paintSlot(slot);
        },
      });
    }
  };
}
