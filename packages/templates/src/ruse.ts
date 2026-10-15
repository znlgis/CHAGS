import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, THEME, createDragController, createHand, popIn, sparkleAt, springBack,
} from '@chags/phaser-kit';
import type { DragController } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  RUSE_TIMING, autoplayLevel, gazeSide, isCarriedPast, isDisguised, isExposed, isRuseComplete,
  lampIndex, lampPhase, litMsFor, msLitLeft, msToLight, nextItemToCarry, noiseAt, noiseForKnock,
  safeFor, shellAt, sideAt,
} from './ruse.logic';
import type { GazeSide, LampPhase } from './ruse.logic';
import type { RuseItem, RuseLevel, RuseNoise } from './schemas';
import type { SessionState } from './session';

/**
 * 示形模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（litRatio / noiseCooldownMs / autoplayFactor…）来自 ruse.logic，
 * 单测与判定用的是同一份。
 */
export const RUSE = {
  ...RUSE_TIMING,
  /** 拖到检查口的宽容度：要对准，但不必像素级对准 */
  dropForgive: 80,
  /** 抓货的半径：小朋友手指粗，判定必须宽松 */
  grabRadius: 96,
  /** 点外壳的半径 */
  shellRadius: 56,
  /** 敲锣鼓的半径 */
  noiseRadius: 88,
  /** 过检查口的这一段演出 */
  boardMs: 760,
  /** 被灯照到退回原位的时长 */
  backMs: 520,
  /** 离原位多近算"还在原位"（在原位被看见就别再演一遍退回） */
  homeSlack: 26,
  /** 没动静多久就给提示 */
  idleMs: 9000,
  /** 收尾停留多久再进典故卡 */
  finaleHoldMs: 4200,
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface RuseStageState {
  /** 灯此刻在哪个阶段 */
  phase: LampPhase;
  /** 第几轮灯（从 0 开始） */
  index: number;
  /** 灯此刻照哪一边（敲过锣就是左边） */
  gaze: GazeSide;
  /** 还有多久亮（亮着时是 0） */
  msToLight: number;
  /** 这一轮还亮多久 */
  litMsLeft: number;
  /** 一轮亮多久 */
  litMs: number;
  /** 一轮多长（画"还有多久亮"的进度用） */
  cycleMs: number;
  /** 锣声把灯留在左边还剩多久 */
  holdMsLeft: number;
  /** 最后敲响的是哪个锣鼓（声音从那儿传出来） */
  lastNoise: string | null;
  /** 锣鼓缓过来了没有 */
  noiseReady: boolean;
  /** 此刻被灯看见的东西（画一层红光就够了，退回由场景负责） */
  seen: string[];
  /** 已经过关的 */
  passed: string[];
  /** 正被拖着的那一件 */
  carrying: string | null;
  /** 每件东西此刻的外壳 */
  shells: Record<string, string | null>;
  done: boolean;
}

export interface RuseConfig {
  level: RuseLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 场景标题：不给就用内容标题（这样模板不用等新的文案键） */
  titleKey?: MessageKey;
  /** 这个世界：海、栈桥、大船（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: RuseLevel) => void;
  /** 每帧重画：灯光、检查口、锣鼓 —— 画在货物下面 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: RuseStageState, level: RuseLevel) => void;
  /** 一件东西本身（画在容器原点）：shellKind 是它此刻套着的外壳，right = 这个外壳正合适 */
  drawItem: (
    g: Phaser.GameObjects.Graphics,
    kind: string,
    shellKind: string | null,
    right: boolean,
  ) => void;
  /** 外壳的样式（画在原点）：chosen = 这件东西此刻套着它。divert 没有外壳，可以不传 */
  drawShell?: (g: Phaser.GameObjects.Graphics, kind: string, chosen: boolean) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: RuseStageState, level: RuseLevel) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 示形：我做我的，你看到的是我想让你看到的。
 *
 * 三条刻意的设计：
 * - **灯是墙上的钟**：什么时候亮、照哪一边都由纯函数算（ruse.logic），
 *   画面只负责把"还有多久"画得看得见 —— 孩子是靠看征兆做决定的，不是靠背时间。
 * - **被看见只是退回原位**：不扣星、不结束、不锁操作。灯亮着的时候被照到，东西回原位，
 *   再来一次就是（零惩罚是这一系列的地基）。
 * - **过关就永久安全**：拖过检查口的东西从此与灯无关 —— 这是"进度"唯一的来源，
 *   所以孩子看得见自己确实往前走了一步。
 */
export function createRuseScene(ctx: GameContext, cfg: RuseConfig): Phaser.Types.Scenes.SceneType {
  return class RuseScene extends BaseScene {
    private level: RuseLevel = cfg.level;
    private startedAt = 0;
    private passed = new Set<string>();
    private shells: Record<string, string | null> = {};
    private carried: string | null = null;
    /** 这一趟被灯看见过：松手就得回原位（东西还在手上时不能硬抢） */
    private caught: string | null = null;
    /** 正在飞向检查口的那一件 */
    private flying: string | null = null;
    private holdUntilMs = 0;
    private noiseReadyAt = 0;
    private knockIndex = 0;
    private lastNoise: string | null = null;
    private idleMs = 0;
    private done = false;
    private drag: DragController | null = null;
    private nodes = new Map<string, Phaser.GameObjects.Container>();
    private itemArts = new Map<string, Phaser.GameObjects.Graphics>();
    private shellArts = new Map<string, Phaser.GameObjects.Graphics>();
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.ruse, ctx);
    }

    // ---------------- 开场 ----------------

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.ruse });
      this.level = autoplayLevel(cfg.level, this.autoplay);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);
      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.markGfx = this.add.graphics().setDepth(70);

      this.drag = createDragController(this);
      this.drawShells();
      this.drawItems();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.events.once('shutdown', () => {
        this.drag?.destroy();
        this.drag = null;
      });

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    /** 无头验证时把每一段演出也压短（判定用的时长都从 level 里读，已经压过了） */
    private ms(value: number): number {
      return this.autoplay
        ? Math.max(160, Math.round(value / RUSE.autoplayFactor))
        : value;
    }

    // ---------------- 画 ----------------

    private drawShells(): void {
      if (!cfg.drawShell) return;
      for (const item of this.level.items) {
        for (const shell of item.shells) {
          const node = this.add.container(shell.x, shell.y).setDepth(20);
          const art = this.add.graphics();
          node.add(art);
          this.shellArts.set(shell.id, art);
          popIn(this, node);
        }
      }
      this.refreshShells();
    }

    /** 点过的外壳亮一圈 —— 一眼看得出这件货现在装成了什么 */
    private refreshShells(): void {
      if (!cfg.drawShell) return;
      for (const item of this.level.items) {
        for (const shell of item.shells) {
          const art = this.shellArts.get(shell.id);
          if (!art) continue;
          art.clear();
          cfg.drawShell(art, shell.kind, this.shellOf(item) === shell.kind);
        }
      }
    }

    private drawItems(): void {
      for (const item of this.level.items) {
        const node = this.add.container(item.x, item.y).setDepth(30);
        const art = this.add.graphics();
        node.add(art);
        this.nodes.set(item.id, node);
        this.itemArts.set(item.id, art);
        this.refreshItem(item);
        popIn(this, node);
        this.drag?.add({
          obj: node,
          radius: RUSE.grabRadius,
          enabled: () => !this.done && !this.passed.has(item.id) && this.flying === null,
          onGrab: () => this.onGrab(item),
          onDrop: () => this.onDrop(item),
        });
      }
    }

    private refreshItem(item: RuseItem): void {
      const art = this.itemArts.get(item.id);
      if (!art) return;
      art.clear();
      const shellKind = this.shellOf(item);
      cfg.drawItem(art, item.kind, shellKind, isDisguised(item, shellKind));
    }

    private shellOf(item: RuseItem): string | null {
      return this.shells[item.id] ?? null;
    }

    private state(t: number): RuseStageState {
      const seen: string[] = [];
      for (const item of this.level.items) {
        if (this.passed.has(item.id)) continue;
        if (this.exposedNow(item, this.nodeX(item), t)) seen.push(item.id);
      }
      return {
        phase: lampPhase(this.level, t),
        index: lampIndex(this.level, t),
        gaze: gazeSide(this.level, t, this.holdUntilMs),
        msToLight: msToLight(this.level, t),
        litMsLeft: msLitLeft(this.level, t),
        litMs: litMsFor(this.level),
        cycleMs: this.level.lamp.intervalMs,
        holdMsLeft: Math.max(0, this.holdUntilMs - t),
        lastNoise: this.lastNoise,
        noiseReady: t >= this.noiseReadyAt,
        seen,
        passed: [...this.passed],
        carrying: this.carried,
        shells: { ...this.shells },
        done: this.done,
      };
    }

    private nodeX(item: RuseItem): number {
      return this.nodes.get(item.id)?.x ?? item.x;
    }

    // ---------------- 每帧 ----------------

    private tick(delta: number): void {
      if (this.done) return;
      const t = this.now();
      const stage = this.state(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(stage, t);

      // 被灯照到的东西退回原位（零惩罚）。手上那件不硬抢：记下来，松手再回。
      for (const item of this.level.items) {
        if (this.passed.has(item.id)) continue;
        const node = this.nodes.get(item.id);
        if (!node) continue;
        if (!this.exposedNow(item, node.x, t)) continue;
        if (this.caught === item.id) continue;
        if (this.carried === item.id) {
          this.caught = item.id;
          this.ctx.emit('beat:enter', { beatId: 'ruse:caught:' + item.id });
          continue;
        }
        this.sendHome(item);
      }

      if (this.carried !== null || this.flying !== null) return;
      this.idleMs += delta;
      if (this.idleMs < RUSE.idleMs) return;
      this.idleMs = 0;
      this.nudge();
    }

    /** 被看见的那几件：红光跟着货走（拖着的时候也在） */
    private drawMarks(state: RuseStageState, t: number): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      for (const id of state.seen) {
        const node = this.nodes.get(id);
        if (!node) continue;
        const pulse = 1 + 0.12 * Math.sin(t / 90);
        g.lineStyle(8, THEME.red, 0.85);
        g.strokeCircle(node.x, node.y, 66 * pulse);
      }
    }

    // ---------------- 点 ----------------

    private onTap(pointer: Phaser.Input.Pointer): void {
      if (this.done) return;
      this.idleMs = 0;
      this.hideHand();
      const shell = shellAt(this.level, pointer.x, pointer.y, RUSE.shellRadius);
      if (shell) {
        // 再点一下同一个外壳＝脱下来：孩子可以反悔，不用怕点错
        this.setShell(shell.item, this.shellOf(shell.item) === shell.shell.kind ? null : shell.shell.kind);
        return;
      }
      const noise = noiseAt(this.level, pointer.x, pointer.y, RUSE.noiseRadius);
      if (noise) this.knock(noise);
    }

    private setShell(item: RuseItem, kind: string | null): void {
      if (this.passed.has(item.id)) return;
      this.shells[item.id] = kind;
      this.refreshItem(item);
      this.refreshShells();
      this.sfx('tap');
      this.ctx.emit('beat:enter', {
        beatId: 'ruse:shell:' + item.id + ':' + (kind ?? 'none'),
      });
    }

    /** 敲一下锣鼓：灯被声音留在左边 holdMs —— "声东"的那一声 */
    private knock(noise: RuseNoise): void {
      const t = this.now();
      if (this.done || t < this.noiseReadyAt) return;
      this.holdUntilMs = t + noise.holdMs;
      // 冷却跟着这一下的时长走：无头验证把锣声压短了，冷却也一起压短，
      // 不然一路只能敲一次，验证用例会白等
      this.noiseReadyAt = t + Math.max(noise.holdMs, this.ms(RUSE.noiseCooldownMs));
      this.lastNoise = noise.id;
      this.sfx('tap');
      sparkleAt(this, noise.x, noise.y - 44, THEME.gold, 4);
      this.ctx.emit('beat:enter', { beatId: 'ruse:knock:' + noise.id });
    }

    // ---------------- 拖 ----------------

    private onGrab(item: RuseItem): void {
      this.idleMs = 0;
      this.carried = item.id;
      this.caught = null;
      this.hideHand();
      this.clearRing();
      this.nodes.get(item.id)?.setDepth(60);
      // 拿起货就点亮检查口：拖到哪儿去，一眼就明白
      this.showRingAt(this.level.gate.x, this.level.gate.y, this.level.gate.radius + 22);
      this.sfx('tap');
    }

    private onDrop(item: RuseItem): void {
      const node = this.nodes.get(item.id);
      this.carried = null;
      if (!node || this.done) return;
      node.setDepth(30);
      // 这一趟被灯看见过：松手就回原位（零惩罚，东西不会丢）
      if (this.caught === item.id) {
        this.sendHome(item);
        return;
      }
      if (isCarriedPast(this.level, node.x, node.y, RUSE.dropForgive)) {
        this.pass(item);
        return;
      }
      if (this.exposedNow(item, node.x, this.now())) {
        this.sendHome(item);
        return;
      }
      this.sfx('tap');
    }

    private sightFor(item: RuseItem, x: number): {
      shellKind: string | null;
      side: GazeSide;
      holdUntilMs: number;
      passed: boolean;
    } {
      return {
        shellKind: this.shellOf(item),
        side: sideAt(this.level, x),
        holdUntilMs: this.holdUntilMs,
        passed: this.passed.has(item.id),
      };
    }

    private exposedNow(item: RuseItem, x: number, t = this.now()): boolean {
      return isExposed(this.level, item, t, this.sightFor(item, x));
    }

    /** 退回原位：零惩罚 —— 不扣星、不停局，sfx 只是"哎呀"一声 */
    private sendHome(item: RuseItem): void {
      const node = this.nodes.get(item.id);
      if (!node) return;
      // 只清这一件的"被抓"标记：别的货正好也被照到时，手上这一件不能被顺手放过
      if (this.caught === item.id) this.caught = null;
      const away = Math.hypot(node.x - item.x, node.y - item.y) > RUSE.homeSlack;
      if (!away) return;
      this.carried = null;
      node.setDepth(30);
      this.sfx('wrong');
      this.cameras.main.shake(140, 0.003);
      this.ctx.emit('beat:enter', { beatId: 'ruse:seen:' + item.id });
      springBack(this, node, item.x, item.y);
    }

    /** 拖过检查口：这一件永久安全 */
    private pass(item: RuseItem): void {
      const node = this.nodes.get(item.id);
      if (!node || this.passed.has(item.id)) return;
      this.passed.add(item.id);
      this.flying = item.id;
      this.carried = null;
      this.caught = null;
      this.drag?.remove(node);
      this.clearRing();
      this.hideHand();
      this.sfx('correct');
      sparkleAt(this, this.level.gate.x, this.level.gate.y, THEME.gold, 6);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'ruse:pass:' + item.id });

      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        x: this.level.gate.x,
        y: this.level.gate.y,
        duration: this.ms(RUSE.boardMs),
        ease: 'Quad.easeOut',
      });
      this.time.delayedCall(this.ms(RUSE.boardMs), () => {
        this.tweens.add({
          targets: node,
          alpha: 0,
          scale: 0.7,
          duration: 220,
          onComplete: () => {
            node.destroy();
            this.nodes.delete(item.id);
            this.itemArts.delete(item.id);
          },
        });
      });
      this.time.delayedCall(this.ms(RUSE.boardMs) + 260, () => {
        this.flying = null;
        if (isRuseComplete(this.level, [...this.passed])) this.finish();
      });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.done) return;
      this.done = true;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      const finale = this.add.graphics().setDepth(40);
      cfg.drawFinale?.(finale, this.state(this.now()), this.level);
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, 300));
      }
      this.time.delayedCall(this.ms(cfg.finaleHoldMs ?? RUSE.finaleHoldMs), () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 提示 ----------------

    /** 卡住了：说一句 + 指出下一个该动的东西（不指出"哪个外壳才对"，那是他自己要看的） */
    private nudge(): void {
      this.showHint(this.level.hint);
      const item = nextItemToCarry(this.level, [...this.passed]);
      if (!item) return;
      const noise = this.level.mode === 'divert' ? this.level.noises[0] : undefined;
      const at = noise ? { x: noise.x, y: noise.y } : { x: item.x, y: item.y };
      this.showRingAt(at.x, at.y, 84);
      if (!this.hand) this.hand = createHand(this, at.x, at.y - 110, 1.1);
    }

    private showRingAt(x: number, y: number, radius: number): void {
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(x, y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, radius);
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

    private runAutoplay(): void {
      this.time.addEvent({ delay: 220, loop: true, callback: () => this.autoplayStep() });
    }

    /** 全自动：hide 先套上正好的外壳，divert 先敲锣，再沿着真实操作的同一条路拖过去 */
    private autoplayStep(): void {
      if (this.done || this.flying !== null || this.carried !== null) return;
      const item = nextItemToCarry(this.level, [...this.passed]);
      if (!item) return;

      if (this.level.mode === 'hide' && item.disguiseAs !== undefined) {
        if (!isDisguised(item, this.shellOf(item))) this.setShell(item, item.disguiseAs);
      }
      if (this.level.mode === 'divert') {
        if (this.now() >= this.noiseReadyAt) {
          const noise = noiseForKnock(this.level, this.knockIndex);
          if (noise) {
            this.knockIndex += 1;
            this.knock(noise);
          }
        }
        const sight = this.sightFor(item, item.x);
        if (!safeFor(this.level, item, this.now(), this.ms(RUSE.boardMs) + 120, sight)) return;
      }
      this.autoCarry(item);
    }

    private autoCarry(item: RuseItem): void {
      const node = this.nodes.get(item.id);
      if (!node) return;
      this.carried = item.id;
      node.setDepth(60);
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        x: this.level.gate.x,
        y: this.level.gate.y,
        duration: this.ms(RUSE.boardMs),
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.carried = null;
          this.pass(item);
        },
      });
    }
  };
}
