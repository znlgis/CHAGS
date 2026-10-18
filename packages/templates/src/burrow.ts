import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { BURROW, SCENE_KEYS } from './layout';
import {
  blockedBy, digCount, escapeRoute, isBurrowOpen, nextSpotToDig, openBurrows, openCount,
  spotAt, waveResult,
} from './burrow.logic';
import type { DigCounts } from './burrow.logic';
import type { BurrowLevel, BurrowSpot } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

export type BurrowPhase = 'dig' | 'danger' | 'done';

/** 交给游戏画的一切：草地、剖面、兔子、狐狸 */
export interface BurrowStageState {
  digs: DigCounts;
  /** 挖通了的洞口 */
  open: string[];
  /** 此刻被危险守住的洞口 */
  blocked: string[];
  phase: BurrowPhase;
  /** 已经来过几次危险（0 = 还没来过） */
  waveIndex: number;
  result: 'safe' | 'trapped' | null;
  digsNeeded: number;
}

export interface BurrowConfig {
  level: BurrowLevel;
  session: SessionState;
  nextSceneKey: string;
  titleKey: MessageKey;
  /** 这个世界：草地、土层剖面、兔子、狐狸（按 state 摆） */
  drawWorld: (g: Phaser.GameObjects.Graphics, state: BurrowStageState) => void;
  /** 每挖一铲的额外表现（土飞起来），可选 */
  onDig?: (spot: BurrowSpot, api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: BurrowStageState) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 预留退路：多挖一个洞，就多一条路。
 *
 * 三条刻意的设计：
 * - **退路是被危险逼出来的**：一次危险同时守住 blocks 个洞口，洞口比它多一个才躲得过 ——
 *   孩子是"被狐狸逼着"去挖第三个洞的，不是被文案教会的。
 * - **零失败**：被堵住不算输，狐狸守一会儿就走了，接着挖就是（不放抓咬、不出现死亡）。
 * - **挖通才算数**：同一个洞反复挖不增加退路 —— 这本账是算得清的。
 */
export function createBurrowScene(ctx: GameContext, cfg: BurrowConfig): Phaser.Types.Scenes.SceneType {
  return class BurrowScene extends BaseScene {
    private digs: DigCounts = {};
    private phase: BurrowPhase = 'dig';
    private waveIndex = 0;
    private blocked: string[] = [];
    private result: 'safe' | 'trapped' | null = null;
    private busy = false;
    private finished = false;
    private wavePending = false;
    private waitingForDig = false;
    private currentWaveId = '';
    private idleMs = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private hintRing: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.burrow, ctx);
    }

    private state(): BurrowStageState {
      return {
        digs: { ...this.digs },
        open: openBurrows(this.digs, cfg.level),
        blocked: [...this.blocked],
        phase: this.phase,
        waveIndex: this.waveIndex,
        result: this.result,
        digsNeeded: cfg.level.digsNeeded,
      };
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.burrow });
      this.drawBackdrop(this.tr(cfg.titleKey));
      this.worldGfx = this.add.graphics().setDepth(2);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }

    private redraw(): void {
      const g = this.worldGfx;
      if (!g) return;
      g.clear();
      cfg.drawWorld(g, this.state());
    }

    // ---------------- 挖 ----------------

    private onTap(pointer: Phaser.Input.Pointer): void {
      // 危险还在演的时候也让他挖：狐狸守在洞口，他正好去挖下一个 —— 点了没反应最糟糕
      if (this.finished || (this.phase !== 'dig' && this.phase !== 'danger')) return;
      const spot = spotAt(pointer.x, pointer.y, cfg.level, BURROW.digForgive);
      if (spot) this.dig(spot);
    }

    /** 挖一铲（真实操作与无头验证走的是同一条路） */
    private dig(spot: BurrowSpot): void {
      if (this.finished || (this.phase !== 'dig' && this.phase !== 'danger')) return;
      const before = digCount(spot.id, this.digs, cfg.level);
      if (before >= cfg.level.digsNeeded) return;
      const after = before + 1;
      this.digs[spot.id] = after;
      this.idleMs = 0;
      this.hideHand();
      this.sfx('tap');
      this.redraw();
      cfg.onDig?.(spot, { scene: this });
      this.ctx.emit('beat:enter', { beatId: 'burrow:dig:' + spot.id + ':' + after });

      if (isBurrowOpen(spot.id, this.digs, cfg.level)) {
        this.sfx('correct');
        sparkleAt(this, spot.x, spot.y - 60, THEME.leaf, 5);
        // 挖通一个洞：这一次做对了（退路多了一条）
        recordAttempt(cfg.session, { ok: true });
        this.ctx.emit('beat:enter', { beatId: 'burrow:open:' + spot.id });
        if (this.waitingForDig) {
          this.waitingForDig = false;
          this.armNextWave(BURROW.gapMs);
        } else if (this.waveIndex === 0) {
          // 第一个洞挖通，第一趟危险就来了 —— 这正是"狡兔三窟"的起因
          this.armNextWave();
        }
      }
    }

    // ---------------- 危险 ----------------

    /**
     * 危险是**冲着你挖通的那条退路来的**：挖通一个洞，它就来了。
     * 一次危险守住 blocks 个洞口 —— 洞口不够，这一趟就出不去（但不算输，它守一会儿就走）。
     */
    private armNextWave(delay = BURROW.firstWaveDelayMs): void {
      if (this.finished || this.wavePending) return;
      if (this.waveIndex >= cfg.level.waves.length) return;
      this.wavePending = true;
      const wait = this.autoplay ? Math.max(160, Math.round(delay / BURROW.autoplayFactor)) : delay;
      this.time.delayedCall(wait, () => this.runWave());
    }

    private runWave(): void {
      if (this.finished) return;
      const wave = cfg.level.waves[this.waveIndex];
      if (!wave) {
        this.finish();
        return;
      }
      this.wavePending = false;
      this.currentWaveId = wave.id;
      this.busy = true;
      this.phase = 'danger';
      this.blocked = blockedBy(this.digs, wave, cfg.level);
      this.result = waveResult(this.digs, wave, cfg.level);
      this.hideHand();
      this.clearRing();
      this.speak(wave.speak);
      this.redraw();
      this.ctx.emit('beat:enter', {
        beatId: 'burrow:wave:' + wave.id + ':' + this.result,
      });
      if (this.result === 'trapped') {
        // 被守住：这一趟退路不够 —— 记一次做错（不结束、不锁操作，狐狸守一会儿就走）
        recordAttempt(cfg.session, { ok: false });
        this.showHint(wave.speak, 2400, 300);
      } else {
        sparkleAt(this, this.W / 2, 760, THEME.gold, 6);
      }

      const hold = this.autoplay
        ? Math.round(BURROW.dangerMs / BURROW.autoplayFactor)
        : BURROW.dangerMs;
      this.time.delayedCall(hold, () => this.endWave());
    }

    /**
     * 一趟危险过去了：
     * - 躲过了 → 下一次危险（更凶）自己会来；
     * - 没躲过 → 这一趟先记着，等孩子再挖通一个洞，它再来一次 —— 直到他躲过去为止。
     */
    private endWave(): void {
      if (this.finished) return;
      const survived = this.result === 'safe';
      this.blocked = [];
      this.result = null;
      this.phase = 'dig';
      this.busy = false;
      this.idleMs = 0;
      this.redraw();
      this.ctx.emit('beat:enter', {
        beatId: 'burrow:passed:' + this.currentWaveId + ':' + (survived ? 'safe' : 'trapped'),
      });

      if (survived) {
        this.waveIndex += 1;
        if (this.waveIndex >= cfg.level.waves.length) {
          this.finish();
          return;
        }
        this.armNextWave(BURROW.gapMs);
        return;
      }
      // 没躲过：等孩子再挖通一个洞，同一趟危险再来。
      // 但有一种情况要立刻处理：他就在这趟危险里又挖通了一个洞 —— 那就马上再来一次，
      // 否则"洞口够了却没人再来"会把这一局卡死。
      const wave = cfg.level.waves[this.waveIndex];
      if (wave && escapeRoute(openCount(this.digs, cfg.level), wave.blocks)) {
        this.armNextWave(BURROW.gapMs);
        return;
      }
      this.waitingForDig = true;
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.phase = 'done';
      this.hideHand();
      this.clearRing();
      this.completeLevel({
        nextSceneKey: cfg.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? 4200,
        reveal: cfg.reveal,
        revealY: 300,
        finalize: () => {
          this.redraw();
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.state());
        }
      });
    }

    // ---------------- 提示 ----------------

    private tick(delta: number): void {
      if (this.finished || this.busy || this.phase !== 'dig') return;
      this.idleMs += delta;
      if (this.idleMs < BURROW.idleMs) return;
      this.idleMs = 0;
      const spot = nextSpotToDig(this.digs, cfg.level);
      if (!spot) return;
      this.showHint(cfg.level.hint);
      this.showRingAt(spot);
      if (!this.hand) this.hand = createHand(this, spot.x, spot.y - 130, 1.15);
    }

    private showRingAt(spot: BurrowSpot): void {
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(spot.x, spot.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, spot.radius + 24);
      this.hintRing = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    private clearRing(): void {
      if (!this.hintRing) return;
      this.tweens.killTweensOf(this.hintRing);
      this.hintRing.destroy();
      this.hintRing = null;
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
        delay: 220,
        loop: true,
        callback: () => {
          if (this.finished || (this.phase !== 'dig' && this.phase !== 'danger')) return;
          const spot = nextSpotToDig(this.digs, cfg.level);
          if (spot) this.dig(spot);
        },
      });
    }
  };
}