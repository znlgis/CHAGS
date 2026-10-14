import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, createHand, sparkleAt } from '@chags/phaser-kit';
import type { BeaconLevel } from '@chags/templates';
import type { SessionState } from '@chags/templates';
import {
  NIGHT, drawHills, drawRiders, drawSky, drawSmoke, drawTower, drawTrust, drawWall,
} from '../art';

export interface BeaconConfig {
  level: BeaconLevel;
  session: SessionState;
  nextSceneKey: string;
  reveal?: string;
}

type Phase = 'idle' | 'relay' | 'army' | 'laugh' | 'smoke' | 'empty' | 'done';

const RELAY_STEP = 150;
const ARRIVE_MS = 1500;
const HOLD_MS = 700;
const LEAVE_MS = 900;
const LAUGH_MS = 1600;
const EMPTY_MS = 3000;

interface Rider {
  x: number;
  y: number;
  dir: number;
  s: number;
}

/**
 * 烽火戏诸侯（专属场景，不进模板库）。
 *
 * 三条刻意的设计：
 * - **是孩子自己点的**：每一次点火都因为"她笑了"，没有人劝他 —— 信用是他亲手点完的。
 * - **一次比一次少**：第一次兵马到城下，第二次少了一半，第三次连城门都没到。
 * - **最后那次是真的**：天边起了烟，火光还是传了出去，什么也没有回来。
 */
export function createBeaconScene(
  ctx: GameContext,
  cfg: BeaconConfig,
): Phaser.Types.Scenes.SceneType {
  return class BeaconScene extends BaseScene {
    private phase: Phase = 'idle';
    private phaseT = 0;
    private t = 0;
    private round = 0;
    private lit = 0;
    private smile = 0;
    private trust = 0;
    private hintShown = false;
    private gfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super('beacon', ctx);
      this.trust = cfg.level.decoyRounds;
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: 'beacon' });
      // 顶栏：和别的玩法场景一样，给这一屏一个名字
      this.drawBackdrop(this.tr('scene.beacon'));
      this.gfx = this.add.graphics().setDepth(2);
      this.input.on('pointerdown', () => this.onTap());
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.fadeIn();
    }

    private onTap(): void {
      if (this.phase === 'idle' || this.phase === 'smoke') this.startRelay();
    }

    // ---------------- 阶段 ----------------

    private startRelay(): void {
      this.round += 1;
      this.lit = 0;
      this.phase = 'relay';
      this.phaseT = 0;
      this.hintShown = false;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'relay:' + this.round });
    }

    private startArmy(): void {
      if (this.round > cfg.level.decoyRounds) {
        // 最后一次是真的：火光传出去了，什么也没有回来
        this.phase = 'empty';
        this.phaseT = 0;
        this.ctx.emit('beat:enter', { beatId: 'empty' });
        return;
      }
      this.phase = 'army';
      this.phaseT = 0;
    }

    private startLaugh(): void {
      this.phase = 'laugh';
      this.phaseT = 0;
      this.ctx.emit('beat:enter', { beatId: 'laugh:' + this.round });
      this.sfx('unlock');
      sparkleAt(this, 142, 866, NIGHT.flameHot, 6);
    }

    private afterLaugh(): void {
      this.trust -= 1;
      this.sfx('splash');
      const lines = cfg.level.lines;
      const line =
        this.round === 1 ? lines.first : this.round === cfg.level.decoyRounds ? lines.empty : lines.again;
      this.showHint(line, 3000, 262);
      this.speak(line);
      if (this.round < cfg.level.decoyRounds) {
        this.phase = 'idle';
        this.phaseT = 0;
        this.ctx.emit('beat:enter', { beatId: 'ready:' + this.round });
        return;
      }
      // 信任用完了，真的狼也来了
      this.phase = 'smoke';
      this.phaseT = 0;
      this.ctx.emit('beat:enter', { beatId: 'smoke' });
    }

    private finishShow(): void {
      if (this.phase === 'done') return;
      this.phase = 'done';
      this.ctx.emit('beat:enter', { beatId: 'complete' });
      this.hideHand();
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      const end = cfg.level.lines.end;
      this.time.delayedCall(700, () => {
        this.showHint(end, 3200, 1080);
        this.speak(end);
      });
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(4200, () => this.showHint(reveal, 3200, 1080));
      }
      this.time.delayedCall(7600, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 每帧 ----------------

    private tick(delta: number): void {
      this.t += delta;
      this.phaseT += delta;

      switch (this.phase) {
        case 'relay': {
          const wanted = Math.min(
            cfg.level.towers.length,
            Math.floor(this.phaseT / RELAY_STEP) + 1,
          );
          if (wanted > this.lit) {
            this.lit = wanted;
            const tower = cfg.level.towers[this.lit - 1]!;
            this.sfx('tap');
            sparkleAt(this, tower.x, tower.y - 150, NIGHT.flame, 4);
            this.cameras.main.shake(60, 0.0012);
          }
          if (this.phaseT >= cfg.level.towers.length * RELAY_STEP + 240) this.startArmy();
          break;
        }
        case 'army': {
          if (this.phaseT >= ARRIVE_MS + HOLD_MS + LEAVE_MS) this.startLaugh();
          break;
        }
        case 'laugh': {
          const p = this.phaseT / LAUGH_MS;
          this.smile = p < 0.25 ? p / 0.25 : p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
          if (this.phaseT >= LAUGH_MS) {
            this.smile = 0;
            this.afterLaugh();
          }
          break;
        }
        case 'empty': {
          if (this.phaseT >= EMPTY_MS) this.finishShow();
          break;
        }
        case 'smoke':
        case 'idle': {
          if (!this.hintShown && this.phaseT > 5200) {
            this.hintShown = true;
            this.showHint(cfg.level.hint);
          }
          if (this.autoplay && this.phaseT > 500) this.startRelay();
          break;
        }
        default:
          break;
      }
      this.redraw();
    }

    /** 兵马位置：按阶段时间算，不存中间状态 */
    private riders(): Rider[] {
      if (this.phase !== 'army') return [];
      const last = this.round >= cfg.level.decoyRounds;
      const p = Math.min(1, this.phaseT / ARRIVE_MS);
      const leaving = Math.max(0, (this.phaseT - ARRIVE_MS - HOLD_MS) / LEAVE_MS);
      const move = leaving > 0 ? 1 - leaving : p;
      const ease = move < 1 ? 1 - (1 - move) * (1 - move) : 1;
      const nearL = last ? 240 : 452;
      const nearR = last ? 520 : 664;
      return [
        { x: -170 + (nearL + 170) * ease, y: 1182, dir: 1, s: 1.05 },
        { x: -330 + (nearL - 46 + 330) * ease, y: 1254, dir: 1, s: 0.94 },
        { x: 920 - (920 - nearR) * ease, y: 1182, dir: -1, s: 1.05 },
        { x: 1080 - (1080 - nearR - 46) * ease, y: 1254, dir: -1, s: 0.94 },
      ];
    }

    private redraw(): void {
      const g = this.gfx;
      if (!g) return;
      g.clear();
      drawSky(g, this.t);
      drawHills(g);
      for (let i = 0; i < cfg.level.towers.length; i += 1) {
        drawTower(g, cfg.level.towers[i]!, i < this.lit, this.t);
      }
      drawSmoke(g, this.t, this.phase === 'smoke' || this.phase === 'empty' ? 1 : 0);
      drawWall(g, this.smile, this.t);
      drawTrust(g, Math.max(0, this.trust), cfg.level.decoyRounds);
      drawRiders(g, this.riders());

      // 该点火了：把小手放在第一座烽火台上
      const waiting = this.phase === 'idle' || this.phase === 'smoke';
      if (waiting && !this.hand) {
        const first = cfg.level.towers[0]!;
        this.hand = createHand(this, first.x - 74, first.y - 26, 1.2);
      } else if (!waiting) {
        this.hideHand();
      }
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }
  };
}
