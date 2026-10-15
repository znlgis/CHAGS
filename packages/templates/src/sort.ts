import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, CSS, THEME, createDragController, createHand, popIn, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import type { DragController } from '@chags/phaser-kit';
import { SCENE_KEYS, SORT } from './layout';
import {
  binAt, binFor, isSortComplete, isSortCorrect, needsTaste, placedIn, probeHit,
} from './sort.logic';
import type { SortBin, SortItem, SortLevel } from './schemas';
import type { SessionState } from './session';

export interface SortItemState {
  /** 尝过了吗：没尝过的草上是一个问号 */
  tasted: boolean;
  dragging: boolean;
}

export interface SortConfig {
  level: SortLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏标题 */
  titleKey: MessageKey;
  /** 木牍：highlighted = 拿起东西时它该去的那块在发光；filled = 已经放进去几件 */
  drawBin: (
    g: Phaser.GameObjects.Graphics,
    bin: SortBin,
    highlighted: boolean,
    filled: number,
  ) => void;
  /** 一件东西（画在容器原点） */
  drawItem: (g: Phaser.GameObjects.Graphics, item: SortItem, state: SortItemState) => void;
  /** 这个世界长什么样：天地、人物、草木 —— 完全交给游戏 */
  drawWorld?: (scene: Phaser.Scene) => void;
  /** 尝一口的表现：由游戏画（叶子入口、表情变化…），做完调 done() */
  onTaste?: (item: SortItem, api: { scene: Phaser.Scene; done: () => void }) => void;
  /** 全部归位后的收尾表现（例如药书上的字一片片亮起来） */
  drawFinale?: (g: Phaser.GameObjects.Graphics) => void;
  /** 收尾时说的那句话 */
  reveal?: string;
  /** 那句话出现的位置（默认在顶部；神农的结语放在田地那一带） */
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * 分类：把一堆东西分进对的那几堆。
 *
 * 两条刻意的设计：
 * - **零失败**：拿起东西时，它该去的地方会自己发光（没尝过就指向"嘴边"）。
 * - **先尝后分**：有 probe 的关卡里，没尝过的东西放到木牍上会被送回嘴边 ——
 *   想分类，先自己试一口。这条不是限制，是这个典故的教学核心。
 */
export function createSortScene(ctx: GameContext, cfg: SortConfig): Phaser.Types.Scenes.SceneType {
  return class SortScene extends BaseScene {
    private drag: DragController | null = null;
    private placed: string[] = [];
    private tasted: string[] = [];
    private binGfx = new Map<string, Phaser.GameObjects.Graphics>();
    private itemArt = new Map<string, Phaser.GameObjects.Graphics>();
    private nodes = new Map<string, Phaser.GameObjects.Container>();
    private hintRing: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private busy = false;
    private finished = false;
    private idleMs = 0;

    constructor() {
      super(SCENE_KEYS.sort, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.sort });
      this.drag = createDragController(this);
      this.events.once('shutdown', () => {
        this.drag?.destroy();
        this.drag = null;
      });

      this.drawBackdrop(this.tr(cfg.titleKey));
      cfg.drawWorld?.(this);
      this.drawBins();
      this.drawItems();
      this.fadeIn();

      // 长时间没有进展就给提示：**别用文字教玩法**，把小手放上去
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      if (this.autoplay) this.runAutoplay();
    }

    private tick(delta: number): void {
      if (this.finished || this.busy) return;
      this.idleMs += delta;
      if (this.idleMs < 8500) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
      const next = this.cfgNextItem();
      if (!next) return;
      this.pointHandAt(next);
    }

    // ---------------- 木牍 ----------------

    private drawBins(): void {
      for (const bin of cfg.level.bins) {
        const g = this.add.graphics().setDepth(3);
        this.binGfx.set(bin.id, g);
        this.redrawBin(bin, false);
        // 木牍上的短标签：字由模板画，图案由游戏画（拿起来时对的木牍会发光）
        this.add
          .text(bin.x, bin.y + bin.radius - 30, bin.label, textStyle(30, CSS.ink, true))
          .setOrigin(0.5)
          .setDepth(4);
      }
    }

    private redrawBin(bin: SortBin, highlighted: boolean): void {
      const g = this.binGfx.get(bin.id);
      if (!g) return;
      g.clear();
      cfg.drawBin(g, bin, highlighted, placedIn(bin, cfg.level, this.placed));
    }

    // ---------------- 东西 ----------------

    private drawItems(): void {
      for (const item of cfg.level.items) {
        const node = this.add.container(item.x, item.y).setDepth(30);
        const art = this.add.graphics();
        cfg.drawItem(art, item, { tasted: false, dragging: false });
        node.add(art);
        this.itemArt.set(item.id, art);
        this.nodes.set(item.id, node);
        popIn(this, node);

        this.drag?.add({
          obj: node,
          radius: 84,
          enabled: () =>
            !this.finished && !this.busy && !this.placed.includes(item.id),
          onGrab: () => {
            node.setDepth(80);
            this.clearHints();
            if (needsTaste(cfg.level, item, this.tasted)) this.showProbeHint();
            else this.showBinHint(item);
            this.hideHand();
          },
          onDrop: () => this.onDrop(item, node),
        });
      }
    }

    private redrawItem(item: SortItem, dragging: boolean): void {
      const art = this.itemArt.get(item.id);
      if (!art) return;
      art.clear();
      cfg.drawItem(art, item, {
        tasted: this.tasted.includes(item.id),
        dragging,
      });
    }

    // ---------------- 发光的地方 ----------------

    /** 拿起没尝过的东西 → 嘴边发光 */
    private showProbeHint(): void {
      const probe = cfg.level.probe;
      if (!probe) return;
      this.showRingAt(probe.x, probe.y, probe.radius, THEME.teal);
    }

    /** 拿起尝过的东西 → 它该去的那块木牍发光 */
    private showBinHint(item: SortItem): void {
      const bin = binFor(cfg.level, item);
      if (!bin) return;
      this.showRingAt(bin.x, bin.y, bin.radius, THEME.gold);
    }

    private showRingAt(x: number, y: number, radius: number, color: number): void {
      this.clearRings();
      const ring = this.add.graphics().setDepth(60);
      ring.setPosition(x, y);
      ring.lineStyle(9, color, 0.95);
      ring.strokeCircle(0, 0, radius + SORT.hintRing);
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

    private clearRings(): void {
      if (!this.hintRing) return;
      this.tweens.killTweensOf(this.hintRing);
      this.hintRing.destroy();
      this.hintRing = null;
    }

    private clearHints(): void {
      this.clearRings();
    }

    // ---------------- 输入 ----------------

    private onDrop(item: SortItem, node: Phaser.GameObjects.Container): void {
      // 先尝后分：没尝过的东西放到木牍上，会被送回嘴边 —— 不判错，也不扣分
      if (needsTaste(cfg.level, item, this.tasted)) {
        if (probeHit(node.x, node.y, cfg.level, SORT.dropForgive)) {
          this.startTaste(item);
          return;
        }
        if (binAt(node.x, node.y, cfg.level, SORT.dropForgive)) {
          this.showHint(this.tr('sort.tasteFirst'));
          this.startTaste(item);
          return;
        }
        this.springBack(item, node);
        return;
      }

      const bin = binAt(node.x, node.y, cfg.level, SORT.dropForgive);
      if (bin && isSortCorrect(item, bin)) {
        this.settle(item, node, bin);
        return;
      }
      // 放错了不惩罚，弹回原位继续试
      this.springBack(item, node);
    }

    private springBack(item: SortItem, node: Phaser.GameObjects.Container): void {
      this.clearHints();
      node.setDepth(30);
      this.sfx('tap');
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node, x: item.x, y: item.y, duration: 300, ease: 'Back.easeOut',
        onComplete: () => {
          this.busy = false;
          this.redrawItem(item, false);
        },
      });
    }

    // ---------------- 尝一口 ----------------

    private startTaste(item: SortItem): void {
      const node = this.nodes.get(item.id);
      const probe = cfg.level.probe;
      if (!node || !probe || this.busy) return;
      this.clearHints();
      this.busy = true;
      this.hideHand();
      node.setDepth(90);
      this.tweens.killTweensOf(node);
      this.redrawItem(item, true);
      this.tweens.add({
        targets: node,
        x: probe.x,
        y: probe.y - 26,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.sfx('tap');
          const done = (): void => this.finishTaste(item, node);
          if (cfg.onTaste) cfg.onTaste(item, { scene: this, done });
          else this.time.delayedCall(SORT.tasteMs, done);
        },
      });
    }

    private finishTaste(item: SortItem, node: Phaser.GameObjects.Container): void {
      if (!this.tasted.includes(item.id)) this.tasted.push(item.id);
      this.sfx('correct');
      sparkleAt(this, node.x, node.y, THEME.leaf, 4);
      this.redrawItem(item, false);
      this.ctx.emit('beat:enter', { beatId: 'taste:' + item.id });
      this.tweens.add({
        targets: node,
        x: item.x,
        y: item.y,
        duration: 320,
        ease: 'Back.easeOut',
        onComplete: () => {
          node.setDepth(30);
          this.busy = false;
          this.idleMs = 0;
        },
      });
    }

    // ---------------- 归位 ----------------

    private settle(item: SortItem, node: Phaser.GameObjects.Container, bin: SortBin): void {
      this.clearHints();
      this.busy = true;
      this.placed.push(item.id);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.sfx('correct');
      if (item.speak) this.speak(item.speak);
      this.ctx.emit('beat:enter', { beatId: item.id });
      sparkleAt(this, bin.x, bin.y - 30, THEME.gold, 5);

      // 放进木牍的东西缩小了留在上面：孩子看得见自己收了几样
      const row = placedIn(bin, cfg.level, this.placed) - 1;
      this.drag?.remove(node);
      this.tweens.killTweensOf(node);
      this.tweens.add({
        targets: node,
        x: bin.x - 34 + Math.min(row, 2) * 34,
        y: bin.y + bin.radius * 0.3,
        scale: 0.42,
        duration: 280,
        ease: 'Quad.easeOut',
        onComplete: () => {
          node.setDepth(5);
          this.nodes.delete(item.id);
          this.redrawBin(bin, false);
          this.busy = false;
          this.idleMs = 0;
          if (isSortComplete(cfg.level, this.placed)) this.finish();
        },
      });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.hideHand();
      this.clearHints();
      for (const bin of cfg.level.bins) this.redrawBin(bin, true);
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);

      const finale = this.add.graphics().setDepth(40);
      cfg.drawFinale?.(finale);
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, cfg.revealY ?? 268));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? 4200, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 提示与无头验证 ----------------

    private cfgNextItem(): SortItem | undefined {
      const untouched = cfg.level.items.find(
        (item) => !this.placed.includes(item.id) && needsTaste(cfg.level, item, this.tasted),
      );
      return untouched ?? cfg.level.items.find((item) => !this.placed.includes(item.id));
    }

    private pointHandAt(item: SortItem): void {
      const probe = cfg.level.probe;
      if (needsTaste(cfg.level, item, this.tasted) && probe) {
        this.showProbeHint();
        if (!this.hand) this.hand = createHand(this, probe.x, probe.y + 90, 1.2);
        return;
      }
      const bin = binFor(cfg.level, item);
      if (!bin) return;
      this.showBinHint(item);
      if (!this.hand) this.hand = createHand(this, bin.x, bin.y - 110, 1.2);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    /** 无头验证：先尝后分 → 归位，全部走的是和真实操作同一条代码路径 */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: 240,
        loop: true,
        callback: () => {
          if (this.finished || this.busy) return;
          const item = cfg.level.items.find((i) => !this.placed.includes(i.id));
          if (!item) return;
          if (needsTaste(cfg.level, item, this.tasted)) {
            this.startTaste(item);
            return;
          }
          const node = this.nodes.get(item.id);
          const bin = binFor(cfg.level, item);
          if (!node || !bin) return;
          node.setDepth(80);
          this.settle(item, node, bin);
        },
      });
    }
  };
}
