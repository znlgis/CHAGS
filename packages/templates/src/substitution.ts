import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import {
  BaseScene, CSS, THEME, createDragController, createHand, groundShadow, popIn, roundRect,
  shade, sparkleAt, springBack, squash, textStyle, wavyBand,
} from '@chags/phaser-kit';
import type { DragController } from '@chags/phaser-kit';
import { SCENE_KEYS, SUB, SUB_BOAT_DROP, SUB_PILES, SUB_SCALE_DROP } from './layout';
import { depthRatio, judge, markRatio } from './substitution.logic';
import type { SubstitutionLevel, StoneDef } from './schemas';
import type { SessionState } from './session';

type Stage = 'load' | 'mark' | 'substitute' | 'weigh' | 'done';

export interface SubstitutionConfig {
  level: SubstitutionLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 水痕对上时说的那一句 —— 就是典故的关键点 */
  reveal: string;
  /** 画“重物”（大象）。模板不认识大象，由游戏包提供画法。 */
  drawHeavy: (g: Phaser.GameObjects.Graphics, scale: number) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function inRect(x: number, y: number, r: Rect): boolean {
  return Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2;
}

/**
 * 等量代换：让小朋友自己走完曹冲的四步 ——
 *   ① 想直接称 → 秤被压垮（体验“称不动”）
 *   ② 大象上船 → 在水面处刻一道痕（把重量“记”下来）
 *   ③ 大象下船 → 一块块搬石头，直到水痕重新落到水面（核心代换）
 *   ④ 把石头搬上秤 → 数字累加出来，就是大象的重量
 * 全程几乎不写文字：用图形、动画、音效反馈。
 */
export function createSubstitutionScene(
  ctx: GameContext,
  cfg: SubstitutionConfig,
): Phaser.Types.Scenes.SceneType {
  return class SubstitutionScene extends BaseScene {
    private stage: Stage = 'load';
    private drag: DragController | null = null;
    private boat: Phaser.GameObjects.Graphics | null = null;
    private heavyNode: Phaser.GameObjects.Container | null = null;
    private heavyAboard = false;
    private cargo: { def: StoneDef; node: Phaser.GameObjects.Container }[] = [];
    private scaleBox: Phaser.GameObjects.Container | null = null;
    private markHand: Phaser.GameObjects.Graphics | null = null;
    private markZone: Phaser.GameObjects.Zone | null = null;
    private readout: Phaser.GameObjects.Text | null = null;
    private carved = false;
    private scaleTries = 0;
    private lastActionAt = 0;
    private stuckShown = false;
    private finished = false;

    constructor() {
      super(SCENE_KEYS.substitution, ctx);
    }

    create(): void {
      this.drawBackdrop('试一试');
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.substitution });
      this.drag = createDragController(this);
      this.events.once('shutdown', () => {
        this.drag?.destroy();
        this.drag = null;
      });

      this.drawWorld();
      this.drawScale();
      this.drawBoat();
      this.spawnHeavy();
      this.lastActionAt = this.ctx.services.now();
      this.time.addEvent({ delay: 1500, loop: true, callback: () => this.checkIdle() });
      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 场景 ----------------

    private drawWorld(): void {
      const g = this.add.graphics().setDepth(1);
      wavyBand(g, -20, SUB.waterTop, this.W + 40, SUB.waterBottom - SUB.waterTop, THEME.water, 1, 14, 3);
      g.fillStyle(THEME.waterDeep, 0.45);
      g.fillRect(0, SUB.waterBottom - 80, this.W, 80);

      const bank = this.add.graphics().setDepth(2);
      bank.fillStyle(THEME.sand, 1);
      bank.fillRoundedRect(-40, SUB.bankTop, this.W + 80, this.H - SUB.bankTop + 60, 64);
      bank.lineStyle(6, THEME.outline, 1);
      bank.strokeRoundedRect(-40, SUB.bankTop, this.W + 80, this.H - SUB.bankTop + 60, 64);
      bank.fillStyle(THEME.sandDeep, 0.5);
      bank.fillRoundedRect(-40, SUB.bankTop, this.W + 80, 26, 13);

      // 几朵云：圆润卡通的氛围，也填补空荡的天空
      const cloud = this.add.graphics().setDepth(1);
      for (const [cx, cy, cs] of [
        [150, 250, 1],
        [560, 200, 0.8],
        [620, 430, 0.62],
      ] as const) {
        cloud.fillStyle(0xffffff, 0.85);
        cloud.fillCircle(cx, cy, 34 * cs);
        cloud.fillCircle(cx + 42 * cs, cy - 14 * cs, 44 * cs);
        cloud.fillCircle(cx + 88 * cs, cy, 30 * cs);
        cloud.fillRoundedRect(cx - 34 * cs, cy, 156 * cs, 32 * cs, 16 * cs);
      }
    }

    /** 大秤：既能被压垮（第一步），也是最后称石头的地方（第四步） */
    private drawScale(): void {
      const { x, y } = SUB.scalePos;
      const box = this.add.container(x, y).setDepth(30);
      const g = this.add.graphics();

      groundShadow(g, 0, 104, 230, 30, 0.18);
      roundRect(g, -72, 78, 144, 26, 12, THEME.woodDeep, THEME.outline, 5);
      roundRect(g, -15, -46, 30, 130, 14, THEME.wood, THEME.outline, 5);
      roundRect(g, -124, -68, 248, 24, 12, THEME.wood, THEME.outline, 5);
      g.lineStyle(5, THEME.outline, 1);
      g.lineBetween(-96, -56, -96, -18);
      g.lineBetween(96, -56, 96, -18);
      roundRect(g, -142, -18, 92, 20, 10, THEME.gold, THEME.outline, 5);
      roundRect(g, 50, -18, 92, 20, 10, THEME.gold, THEME.outline, 5);

      box.add(g);
      this.scaleBox = box;
    }

    private drawBoat(): void {
      this.boat?.destroy();
      const g = this.add.graphics().setDepth(10);
      this.boat = g;

      const depth = this.depth();
      const hullH = SUB.hullHeight;
      const halfW = SUB.hullWidth / 2;
      const deckY = this.deckY();
      const markY = deckY + hullH * (1 - markRatio(cfg.level));

      groundShadow(g, SUB.boatX, deckY + hullH + 6, SUB.hullWidth * 1.05, 34, 0.12);

      roundRect(
        g,
        SUB.boatX - halfW,
        deckY,
        SUB.hullWidth,
        hullH,
        { tl: 30, tr: 30, bl: 80, br: 80 },
        THEME.wood,
        THEME.outline,
        6,
      );
      roundRect(
        g,
        SUB.boatX - halfW + 12,
        deckY - 16,
        SUB.hullWidth - 24,
        32,
        16,
        shade(THEME.wood, 1.22),
        THEME.outline,
        5,
      );

      if (this.carved) {
        g.lineStyle(12, THEME.red, 1);
        g.lineBetween(SUB.boatX - halfW - 18, markY, SUB.boatX + halfW + 18, markY);
      }

      // 半透明水面：盖住吃水线以下的船身，让“沉下去”看得见
      wavyBand(g, -20, SUB.waterTop, this.W + 40, SUB.waterBottom - SUB.waterTop, THEME.water, 0.5, 14, 3);
      g.lineStyle(7, 0xffffff, 0.95);
      g.lineBetween(0, SUB.waterTop, this.W, SUB.waterTop);

      if (this.carved && depth > 0.02) {
        const delta = markY - SUB.waterTop;
        if (Math.abs(delta) > 5) {
          g.fillStyle(THEME.gold, 1);
          g.fillTriangle(
            SUB.boatX + halfW + 34,
            SUB.waterTop + delta / 2,
            SUB.boatX + halfW + 62,
            SUB.waterTop + delta / 2 - 13,
            SUB.boatX + halfW + 62,
            SUB.waterTop + delta / 2 + 13,
          );
          g.lineStyle(4, THEME.outline, 1);
          g.lineBetween(SUB.boatX + halfW + 46, SUB.waterTop, SUB.boatX + halfW + 46, markY);
        }
      }
    }

    private drawStone(g: Phaser.GameObjects.Graphics, r: number, x: number, y: number): void {
      g.fillStyle(THEME.stone, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(shade(THEME.stone, 1.16), 1);
      g.fillCircle(x - r * 0.3, y - r * 0.32, r * 0.4);
      g.lineStyle(5, THEME.outline, 1);
      g.strokeCircle(x, y, r);
    }

    // ---------------- 载重与布局 ----------------

    private total(): number {
      const heavy = this.heavyAboard ? cfg.level.heavy.weight : 0;
      return heavy + this.cargo.reduce((acc, item) => acc + item.def.value, 0);
    }

    private depth(): number {
      return depthRatio(this.total(), cfg.level);
    }

    private deckY(): number {
      return SUB.waterTop - SUB.hullHeight * (1 - this.depth());
    }

    private relayout(animate = false): void {
      this.drawBoat();
      const deckY = this.deckY();
      if (this.heavyAboard && this.heavyNode) {
        this.heavyNode.setPosition(SUB.boatX, deckY - 74);
      }
      this.cargo.forEach((item, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const tx = SUB.boatX - 148 + col * 74;
        const ty = deckY - 30 - row * 46;
        if (animate) {
          this.tweens.killTweensOf(item.node);
          this.tweens.add({ targets: item.node, x: tx, y: ty, duration: 200, ease: 'Quad.easeOut' });
        } else {
          item.node.setPosition(tx, ty);
        }
      });
    }

    // ---------------- 第一步：想直接称 ----------------

    private spawnHeavy(): void {
      const node = this.add.container(SUB.heavyHome.x, SUB.heavyHome.y).setDepth(20).setScale(0.72);
      const shadow = this.add.graphics();
      groundShadow(shadow, 0, 66, 200, 36, 0.18);
      const art = this.add.graphics();
      cfg.drawHeavy(art, 1);
      node.add([shadow, art]);
      this.heavyNode = node;

      this.drag?.add({
        obj: node,
        radius: 160,
        enabled: () => this.stage === 'load',
        onGrab: () => {
          this.tweens.killTweensOf(node);
          node.setScale(0.8);
          node.setDepth(70);
        },
        onDrop: () => this.onHeavyDrop(),
      });
    }

    private onHeavyDrop(): void {
      const node = this.heavyNode;
      if (!node) return;
      if (this.stage === 'load' && inRect(node.x, node.y, SUB_BOAT_DROP)) {
        this.boardHeavy();
        return;
      }
      if (this.stage === 'load' && inRect(node.x, node.y, SUB_SCALE_DROP)) {
        this.failOnScale();
        return;
      }
      node.setScale(0.72);
      node.setDepth(20);
      springBack(this, node, SUB.heavyHome.x, SUB.heavyHome.y);
    }

    /** 直接上秤：秤被压垮 —— 这就是“称不动”的体验 */
    private failOnScale(): void {
      const node = this.heavyNode;
      if (!node) return;
      this.scaleTries += 1;
      cfg.session.mistakes += 1;
      this.sfx('wrong');
      this.ctx.emit('choice:made', {
        beatId: 'try-direct',
        choiceId: 'scale',
        correct: false,
        latencyMs: this.scaleTries,
      });
      node.setScale(0.72);
      node.setDepth(20);
      springBack(this, node, SUB.heavyHome.x, SUB.heavyHome.y);

      const box = this.scaleBox;
      if (box) {
        this.tweens.add({
          targets: box,
          angle: { from: -9, to: 9 },
          duration: 70,
          yoyo: true,
          repeat: 5,
          onComplete: () => box.setAngle(0),
        });
      }
      const cross = this.add.graphics().setDepth(900);
      cross.lineStyle(14, THEME.red, 1);
      cross.lineBetween(-26, -26, 26, 26);
      cross.lineBetween(26, -26, -26, 26);
      cross.setPosition(SUB.scalePos.x, SUB.scalePos.y - 150);
      popIn(this, cross);
      this.tweens.add({
        targets: cross,
        alpha: 0,
        y: cross.y - 40,
        delay: 520,
        duration: 380,
        onComplete: () => cross.destroy(),
      });
      sparkleAt(this, SUB.scalePos.x, SUB.scalePos.y - 60, THEME.red, 3);

      if (this.scaleTries >= 2) {
        createHand(this, SUB.boatX, SUB.waterTop - 250, 1.1);
        this.showHint('太重了，换个办法', 2400);
      }
    }

    private boardHeavy(): void {
      const node = this.heavyNode;
      if (!node || this.stage !== 'load') return;
      this.heavyAboard = true;
      this.stage = 'mark';
      this.sfx('splash');
      this.cameras.main.shake(200, 0.005);
      this.tweens.killTweensOf(node);
      this.tweens.add({ targets: node, scale: 0.72, duration: 240, ease: 'Back.easeOut' });
      this.relayout();
      this.ctx.emit('beat:enter', { beatId: 'aboard' });
      this.time.delayedCall(500, () => this.enterMarkStage());
    }

    // ---------------- 第二步：刻水痕 ----------------

    private enterMarkStage(): void {
      this.stage = 'mark';
      const y = SUB.waterTop;
      const pulse = this.add.graphics().setDepth(700);
      pulse.lineStyle(8, 0xffffff, 0.9);
      pulse.lineBetween(SUB.boatX - SUB.hullWidth / 2 - 24, y, SUB.boatX + SUB.hullWidth / 2 + 24, y);
      this.tweens.add({ targets: pulse, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });
      this.markHand = createHand(this, SUB.boatX + 176, y + 6, 0.95);

      this.markZone = this.add
        .zone(SUB.boatX, y - 40, SUB.hullWidth + 80, 300)
        .setDepth(720)
        .setInteractive();
      this.markZone.once('pointerdown', () => {
        pulse.destroy();
        this.carve();
      });

      this.ctx.emit('beat:enter', { beatId: 'mark' });
      if (this.autoplay) {
        this.time.delayedCall(160, () => {
          pulse.destroy();
          this.carve();
        });
      }
    }

    private carve(): void {
      if (this.carved) return;
      this.carved = true;
      this.sfx('correct');
      this.markHand?.destroy();
      this.markHand = null;
      this.markZone?.destroy();
      this.markZone = null;
      this.drawBoat();
      sparkleAt(this, SUB.boatX + SUB.hullWidth / 2 + 20, SUB.waterTop, THEME.red, 5);
      this.cameras.main.shake(140, 0.003);
      this.ctx.emit('choice:made', {
        beatId: 'mark',
        choiceId: 'carve',
        correct: true,
        latencyMs: 0,
      });
      this.time.delayedCall(620, () => this.heavyLeaves());
    }

    // ---------------- 第三步：换成石头 ----------------

    private heavyLeaves(): void {
      const node = this.heavyNode;
      if (!node) return;
      this.heavyAboard = false;
      this.stage = 'substitute';
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        x: SUB.heavyHome.x,
        y: SUB.heavyHome.y,
        duration: 640,
        ease: 'Back.easeOut',
      });
      this.relayout();
      this.lastActionAt = this.ctx.services.now();
      this.time.delayedCall(700, () => this.spawnPiles());
    }

    private spawnPiles(): void {
      cfg.level.stones.slice(0, SUB_PILES.length).forEach((def, i) => {
        const home = SUB_PILES[i];
        if (!home) return;
        const pile = this.add.container(home.x, home.y).setDepth(20);
        const art = this.add.graphics();
        groundShadow(art, 0, def.radius + 12, def.radius * 3.6, def.radius * 1.1, 0.16);
        this.drawStone(art, def.radius, 0, 0);
        this.drawStone(art, def.radius * 0.68, def.radius * 1.0, def.radius * 0.55);
        pile.add(art);
        popIn(this, pile, i * 90);

        this.drag?.add({
          obj: pile,
          radius: def.radius * 3,
          enabled: () => this.stage === 'substitute',
          onGrab: () => {
            this.tweens.killTweensOf(pile);
            pile.setDepth(70);
          },
          onDrop: () => {
            if (inRect(pile.x, pile.y, SUB_BOAT_DROP)) {
              // 石堆是无限取用点：被拖走的那块“变成”船上的石头，这里立刻复位
              pile.setPosition(home.x, home.y);
              pile.setDepth(20);
              this.addStoneToBoat(def);
              return;
            }
            pile.setDepth(20);
            springBack(this, pile, home.x, home.y);
          },
        });
      });
      this.ctx.emit('beat:enter', { beatId: 'substitute' });
    }

    private addStoneToBoat(def: StoneDef): void {
      const node = this.add.container(SUB.boatX, this.deckY() - 70).setDepth(20);
      const art = this.add.graphics();
      this.drawStone(art, def.radius, 0, 0);
      node.add(art);
      this.cargo.push({ def, node });
      this.sfx('splash');
      squash(this, node, 1, 0.2);
      this.relayout(true);

      this.drag?.add({
        obj: node,
        radius: def.radius * 2.8,
        onGrab: () => {
          this.tweens.killTweensOf(node);
          node.setDepth(70);
        },
        onDrop: () => this.onBoatStoneDrop(node),
      });

      this.lastActionAt = this.ctx.services.now();
      this.stuckShown = false;
      this.judgeNow();
    }

    private onBoatStoneDrop(node: Phaser.GameObjects.Container): void {
      if (inRect(node.x, node.y, SUB_BOAT_DROP)) {
        node.setDepth(20);
        this.relayout(true);
        return;
      }
      const idx = this.cargo.findIndex((item) => item.node === node);
      if (idx >= 0) this.cargo.splice(idx, 1);
      this.drag?.remove(node);
      node.destroy();
      this.relayout(true);
      this.sfx('tap');
      this.lastActionAt = this.ctx.services.now();
      this.stuckShown = false;
      this.judgeNow();
    }

    private judgeNow(): void {
      const verdict = judge(this.total(), cfg.level);
      if (verdict === 'match') {
        this.succeed();
        return;
      }
      this.flashCue(verdict === 'light');
    }

    /** 用箭头代替文字：还轻 → 往下（再加）；太沉 → 往上（拿掉） */
    private flashCue(needMore: boolean): void {
      const g = this.add.graphics().setDepth(750);
      g.fillStyle(THEME.red, 1);
      g.lineStyle(5, THEME.outline, 1);
      if (needMore) {
        g.fillTriangle(-24, -24, 24, -24, 0, 22);
        g.strokeTriangle(-24, -24, 24, -24, 0, 22);
      } else {
        g.fillTriangle(-24, 24, 24, 24, 0, -22);
        g.strokeTriangle(-24, 24, 24, 24, 0, -22);
      }
      g.setPosition(SUB.boatX + SUB.hullWidth / 2 + 88, SUB.waterTop);
      this.tweens.add({
        targets: g,
        y: SUB.waterTop + (needMore ? 60 : -60),
        alpha: 0,
        duration: 760,
        ease: 'Quad.easeOut',
        onComplete: () => g.destroy(),
      });
    }

    private succeed(): void {
      if (this.finished) return;
      this.finished = true;
      this.stage = 'weigh';
      this.sfx('correct');
      this.cameras.main.flash(240, 255, 246, 214);
      sparkleAt(this, SUB.boatX, SUB.waterTop - 30, THEME.gold, 8);
      this.showHint(cfg.reveal, 3000);
      this.time.delayedCall(1700, () => this.enterWeighStage());
    }

    // ---------------- 第四步：称石头 ----------------

    private enterWeighStage(): void {
      const stones = [...this.cargo];
      this.cargo = [];
      this.relayout();

      this.readout = this.add
        .text(SUB.scalePos.x, SUB.scalePos.y - 150, '0', textStyle(68, CSS.red, true))
        .setOrigin(0.5)
        .setDepth(40);
      popIn(this, this.readout);

      let acc = 0;
      stones.forEach((item, i) => {
        this.time.delayedCall(260 + i * 230, () => {
          acc += item.def.value;
          this.readout?.setText(String(acc));
          this.sfx('tap');
          sparkleAt(this, SUB.scalePos.x, SUB.scalePos.y - 70, THEME.gold, 2);
          this.drag?.remove(item.node);
          item.node.destroy();
        });
      });
      this.time.delayedCall(260 + stones.length * 230 + 520, () => this.finishWeigh(acc));
    }

    private finishWeigh(total: number): void {
      this.stage = 'done';
      this.sfx('complete');
      sparkleAt(this, SUB.scalePos.x, SUB.scalePos.y - 150, THEME.gold, 10);

      // 读数收进等式里，避免两处重复出现同一个数字
      this.readout?.destroy();
      this.readout = null;

      const y = SUB.equationY;
      const ghost = this.add.container(230, y).setDepth(40);
      const art = this.add.graphics();
      cfg.drawHeavy(art, 0.66);
      ghost.add(art);
      popIn(this, ghost);

      const eq = this.add.text(400, y, '=', textStyle(84, CSS.ink, true)).setOrigin(0.5).setDepth(40);
      const value = this.add
        .text(560, y, String(total), textStyle(96, CSS.red, true))
        .setOrigin(0.5)
        .setDepth(40);
      popIn(this, eq, 160);
      popIn(this, value, 320);
      this.tweens.add({
        targets: value,
        scale: { from: 0.6, to: 1 },
        duration: 420,
        delay: 320,
        ease: 'Back.easeOut',
      });
      sparkleAt(this, 560, y, THEME.gold, 6);

      this.ctx.emit('beat:enter', { beatId: 'weighed' });
      this.time.delayedCall(2400, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 卡住时的兜底提示 ----------------

    private checkIdle(): void {
      if (this.stage !== 'substitute' || this.finished || this.stuckShown) return;
      const idle = this.ctx.services.now() - this.lastActionAt;
      if (idle < 9000) return;
      this.stuckShown = true;
      const verdict = judge(this.total(), cfg.level);
      this.showHint(verdict === 'heavy' ? cfg.level.hints.tooHeavy : cfg.level.hints.tooLight);
    }

    // ---------------- 自动通关（无头验证用） ----------------

    private runAutoplay(): void {
      this.time.delayedCall(150, () => {
        const node = this.heavyNode;
        if (!node) return;
        node.setPosition(SUB.boatX, SUB.waterTop - 120);
        this.boardHeavy();
      });
      this.time.delayedCall(4200, () => {
        const biggest = [...cfg.level.stones].sort((a, b) => b.value - a.value)[0];
        if (!biggest) return;
        for (let i = 0; i < 60; i += 1) {
          this.time.delayedCall(i * 30, () => {
            if (this.stage !== 'substitute' || this.finished) return;
            this.addStoneToBoat(biggest);
          });
        }
      });
    }
  };
}
