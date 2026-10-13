import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import {
  BaseScene, THEME, createDragController, popIn, roundRect, shade, sparkleAt,
} from '@chags/phaser-kit';
import type { DragController } from '@chags/phaser-kit';
import { PLACE, SCENE_KEYS } from './layout';
import { findSlotAt, isCorrect, isPlaceComplete, slotFor } from './place.logic';
import type { PlaceLevel, PlaceOrb, PlaceSlot } from './schemas';
import type { SessionState } from './session';

export interface PlaceConfig {
  level: PlaceLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 空槽与归位后的样子（太阳 / 月亮 / 河流 / 草木…），由游戏包决定 */
  drawPiece: (
    g: Phaser.GameObjects.Graphics,
    kind: string,
    x: number,
    y: number,
    filled: boolean,
  ) => void;
  /** 光球的画法，画在容器原点 */
  drawOrb: (g: Phaser.GameObjects.Graphics, kind: string) => void;
  /** 全部归位时说的那句话 */
  reveal: string;
}

/**
 * 归位：把一团团光放回这个世界该有的地方。
 *
 * 两条刻意的设计：
 * - **零失败**：拿起光球时，它该去的槽位会自己发光。孩子靠"形状 + 提示"完成配对，全程无文字。
 * - **用听不用看**：每归位一件，用语音说出原文（"左眼变成了太阳"）。
 */
export function createPlaceScene(ctx: GameContext, cfg: PlaceConfig): Phaser.Types.Scenes.SceneType {
  return class PlaceScene extends BaseScene {
    private drag: DragController | null = null;
    private placed: string[] = [];
    private slotGfx = new Map<string, Phaser.GameObjects.Graphics>();
    private hintRing: Phaser.GameObjects.Graphics | null = null;
    private finished = false;

    constructor() {
      super(SCENE_KEYS.place, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.place });
      this.drag = createDragController(this);
      this.events.once('shutdown', () => {
        this.drag?.destroy();
        this.drag = null;
      });

      this.drawWorld();
      this.drawSlots();
      this.drawOrbs();
      this.fadeIn();

      if (this.autoplay) {
        cfg.level.orbs.forEach((orb, i) => {
          this.time.delayedCall(160 + i * 90, () => this.autoPlace(orb));
        });
      }
    }

    private drawWorld(): void {
      const world = this.add.graphics().setDepth(1);
      world.fillStyle(THEME.inkSoft, 1);
      world.fillRect(0, 0, this.W, this.H);
      roundRect(world, -40, PLACE.skyTop - 40, this.W + 80, PLACE.skyBottom - PLACE.skyTop + 40, 44, THEME.sky, THEME.outline, 7);
      roundRect(
        world,
        -40,
        PLACE.skyBottom,
        this.W + 80,
        PLACE.earthBottom - PLACE.skyBottom + 40,
        { tl: 0, tr: 0, bl: 60, br: 60 },
        THEME.sand,
        THEME.outline,
        7,
      );

      // 底部托盘：盘古化成的光球先落在这里
      roundRect(
        world,
        24,
        PLACE.earthBottom + 6,
        this.W - 48,
        this.H - PLACE.earthBottom - 30,
        44,
        shade(THEME.sand, 0.9),
        THEME.outline,
        6,
      );
    }

    private drawSlots(): void {
      for (const slot of cfg.level.slots) {
        const g = this.add.graphics().setDepth(3);
        this.slotGfx.set(slot.id, g);
        this.redrawSlot(slot, false);
      }
    }

    private redrawSlot(slot: PlaceSlot, filled: boolean): void {
      const g = this.slotGfx.get(slot.id);
      if (!g) return;
      g.clear();
      cfg.drawPiece(g, slot.kind, slot.x, slot.y, filled);
    }

    private drawOrbs(): void {
      for (const orb of cfg.level.orbs) {
        const node = this.add.container(orb.x, orb.y).setDepth(30);
        const art = this.add.graphics();
        cfg.drawOrb(art, orb.kind);
        node.add(art);
        popIn(this, node);

        // 让光球轻轻起伏（动的是里面的画，容器位置留给拖拽）
        this.tweens.add({
          targets: art,
          y: -10,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: Math.round(Math.random() * 0),
        });

        this.drag?.add({
          obj: node,
          radius: 92,
          onGrab: () => {
            node.setDepth(80);
            this.showHintAt(slotFor(cfg.level, orb));
          },
          onDrop: () => this.onDrop(orb, node),
        });
      }
    }

    /** 拿起光球时，它该去的位置轻轻发光 —— 这样永远不会放错 */
    private showHintAt(slot: PlaceSlot | undefined): void {
      this.clearHint();
      if (!slot) return;
      const ring = this.add.graphics().setDepth(60);
      ring.setPosition(slot.x, slot.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, slot.radius + 28);
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

    private clearHint(): void {
      if (!this.hintRing) return;
      this.tweens.killTweensOf(this.hintRing);
      this.hintRing.destroy();
      this.hintRing = null;
    }

    private onDrop(orb: PlaceOrb, node: Phaser.GameObjects.Container): void {
      const slot = findSlotAt(node.x, node.y, cfg.level, PLACE.dropForgive);
      if (slot && isCorrect(orb, slot)) {
        this.settle(orb, node, slot);
        return;
      }
      // 放错了不惩罚，弹回托盘继续试
      this.clearHint();
      node.setDepth(30);
      this.sfx('tap');
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        x: orb.x,
        y: orb.y,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }

    private settle(orb: PlaceOrb, node: Phaser.GameObjects.Container, slot: PlaceSlot): void {
      this.clearHint();
      this.placed.push(slot.id);
      this.sfx('correct');
      this.speak(orb.speak);
      sparkleAt(this, slot.x, slot.y, THEME.gold, 6);
      this.cameras.main.shake(120, 0.002);

      this.drag?.remove(node);
      node.destroy();
      this.redrawSlot(slot, true);
      this.ctx.emit('beat:enter', { beatId: slot.id });

      if (isPlaceComplete(cfg.level, this.placed)) this.finish();
    }

    private autoPlace(orb: PlaceOrb): void {
      if (this.finished) return;
      const slot = slotFor(cfg.level, orb);
      if (!slot) return;
      // 无头验证时直接归位：造一个临时节点走同一条代码路径
      const node = this.add.container(slot.x, slot.y).setDepth(30);
      this.settle(orb, node, slot);
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, (PLACE.skyTop + PLACE.earthBottom) / 2, THEME.gold, 12);
      // 先让孩子看一眼"完整的世界"，再出现那句话 —— 别让文字挡住日月的点亮时刻
      // 放在地面下缘：别挡住刚刚点亮的日月星辰（英文句子更长，气泡也更高）
      this.time.delayedCall(1400, () => this.showHint(cfg.reveal, 3200, 1030));
      this.time.delayedCall(4200, () => this.scene.start(cfg.nextSceneKey));
    }
  };
}
