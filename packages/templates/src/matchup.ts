import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, CSS, THEME, createHand, popIn, roundRect, shade, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  MATCHUP_TIMING, RIVAL_HIT, assign, bestRoster, horseAtSlot, horseNear, isMatchupDone,
  isRosterFull, matchupProgress, placements, resetRoster, resolve, rivalAt, scaledMs, slotOfHorse,
  takeBack, winsFor, winsNeeded,
} from './matchup.logic';
import type { RaceResult, Roster } from './matchup.logic';
import type { MatchupHorse, MatchupLevel, MatchupRival } from './schemas';
import type { SessionState } from './session';

/**
 * 配对编排模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（raceMs / raceGapMs / idleMs…）来自 matchup.logic，
 * 单测、无头验证与画面用的是同一份。
 */
export const MATCHUP = {
  /** 抓马的半径：小朋友手指粗，判定必须宽松 */
  grabRadius: 88,
  /** 对手那一场的判定半径（与 matchup.logic 的 RIVAL_HIT 是同一个数） */
  rivalRadius: RIVAL_HIT,
  /** 把马放进场次 / 从场次拿回来的动画时长 */
  placeMs: 340,
  /** 输赢的旗子升起之后，停一会儿再让孩子看结果 */
  flagMs: 700,
  /** 输了以后"这一局我们认了"在气泡里停多久 */
  lineMs: 2400,
  /** 赢了整场之后看一眼赛场，再进典故卡 */
  finaleHoldMs: MATCHUP_TIMING.finaleHoldMs,
  /** 多久没动静就把小手放到还没上场的马身上 */
  idleMs: MATCHUP_TIMING.idleMs,
  /** 计分板画在哪里（游戏包的 drawStage 用它） */
  score: { x: 150, y: 196, w: 450, h: 44 },
  /** 提示气泡的高度 */
  hintY: MATCHUP_TIMING.hintY,
  /** 底部按钮的大小（位置由场景按设计分辨率定：居中、离底 150） */
  button: { width: 430, height: 116, fromBottom: 150 },
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface MatchupStageState {
  /** 三场现在各是谁的马（-1 = 空着） */
  roster: Roster;
  /** 三场各自的输赢；没跑过 / 重排之后是 null */
  results: (RaceResult | null)[];
  /** 跑了几场、赢了几场、输了几场 */
  ranCount: number;
  wins: number;
  losses: number;
  needWins: number;
  /** 还差几场 */
  leftWins: number;
  /** 三场排满了没有 */
  full: boolean;
  /** 正在跑第几场（-1 = 没在跑） */
  runningSlot: number;
  /** 这一场跑到哪儿了（0..1）—— 自己的马从起跑线往终点线走 */
  raceT: number;
  /** 整个赛场跑完了、结果都出来了 */
  settled: boolean;
  /** 排满了、可以开赛 */
  canStart: boolean;
  /** 正被选中的那匹马（等着放进某一场） */
  selected: string | null;
  /** 演出状态：编排中 / 跑着呢 / 跑完了 */
  phase: 'arrange' | 'racing' | 'settled';
  /** 赢了整场 */
  won: boolean;
}

export interface MatchupConfig {
  level: MatchupLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 场景标题：不给就用内容标题 */
  titleKey?: MessageKey;
  /** 底部按钮上的字（界面文案表里没有这一条，所以由游戏包给，双语各自写） */
  startLabel: string;
  resetLabel: string;
  /** 这个世界：赛场、跑道、终点线（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: MatchupLevel) => void;
  /** 每帧重画：三场各自的木牌、输赢的旗子、正在跑的马 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: MatchupStageState, level: MatchupLevel) => void;
  /** 一匹马长什么样（画在容器原点）：selected = 正被选中，placed = 已经上场 */
  drawHorse: (
    g: Phaser.GameObjects.Graphics,
    horse: MatchupHorse,
    flags: { selected: boolean; placed: boolean },
  ) => void;
  /**
   * 场景建好之后挂一次装饰（Graphics 画不了字：木牌上的双语称呼、
   * 场次编号这类真的 Text 走这里）。只在 create 里调用一次。
   */
  decorate?: (scene: Phaser.Scene, level: MatchupLevel) => void;
  /** 赢了整场：把赛场收个尾 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: MatchupStageState, level: MatchupLevel) => void;
  /** 赢下整场时念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  /** 输一局时说的那句话（"这一局我们认了"）——舍一局是有意的，不是失败 */
  lostLine?: string;
  finaleHoldMs?: number;
}

/**
 * 配对编排：三匹马、三场对手 —— 怎么排，比马本身更重要。
 *
 * 四条刻意的设计：
 * - **排法是纯数据**（matchup.logic 的 Roster：roster[场次] = 马的下标）：
 *   谁赢谁输由 power 决定（相等算输），场景只把手指落在哪儿翻译成一次 assign。
 * - **随便改，零惩罚**：点马、点场次就能换位置；输了把马放回架子重排就是。
 *   李代桃僵的落点恰恰是"故意舍一局"：输掉第一场不等于输掉整场。
 * - **开赛才跑**：排满了才有"开赛"这一步 —— 孩子能先看清楚自己的排法再动手。
 * - **计分板只说赢了几场**：不泄露"该怎么排"，六种排法得他自己找。
 */
export function createMatchupScene(
  ctx: GameContext,
  cfg: MatchupConfig,
): Phaser.Types.Scenes.SceneType {
  return class MatchupScene extends BaseScene {
    private level: MatchupLevel = cfg.level;
    private roster: Roster = resetRoster(cfg.level);
    private results: (RaceResult | null)[] = cfg.level.rivals.map(() => null);
    private wins = 0;
    private selected: string | null = null;
    private phase: 'arrange' | 'racing' | 'settled' = 'arrange';
    private runningSlot = -1;
    private raceT = 0;
    private won = false;
    private finished = false;
    private idleMs = 0;
    private startedAt = 0;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private doneGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private nodes = new Map<string, Phaser.GameObjects.Container>();
    private horseArts = new Map<string, Phaser.GameObjects.Graphics>();
    private startButton: Phaser.GameObjects.Container | null = null;
    private resetButton: Phaser.GameObjects.Container | null = null;

    constructor() {
      super(SCENE_KEYS.matchup, ctx);
    }

    // ---------------- 开场 ----------------

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.matchup });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.titleKey ? this.tr(cfg.titleKey) : this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(20);
      this.doneGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(70);

      this.drawHorses();
      this.drawButtons();
      cfg.decorate?.(this, this.level);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.events.once('shutdown', () => this.hideHand());

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
      else this.showHint(cfg.level.hint, 3000, MATCHUP.hintY);
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 马 ----------------

    private drawHorses(): void {
      for (const horse of this.level.horses) {
        const node = this.add.container(horse.x, horse.y).setDepth(50);
        const art = this.add.graphics();
        node.add(art);
        this.nodes.set(horse.id, node);
        this.horseArts.set(horse.id, art);
        this.refreshHorse(horse);
        popIn(this, node);
      }
    }

    private refreshHorse(horse: MatchupHorse): void {
      const art = this.horseArts.get(horse.id);
      if (!art) return;
      art.clear();
      cfg.drawHorse(art, horse, {
        selected: this.selected === horse.id,
        placed: slotOfHorse(this.level, this.roster, horse.id) >= 0,
      });
    }

    private refreshHorses(): void {
      for (const horse of this.level.horses) this.refreshHorse(horse);
    }

    /** 第几场的起跑线在哪儿（画面与判定共用同一份换算） */
    private startPos(slot: number): { x: number; y: number } {
      const rival = this.level.rivals[slot];
      const home = this.level.horses[0];
      return { x: home?.x ?? 180, y: rival?.y ?? 620 };
    }

    /** 把一匹马挪到它在画面上该待的地方：上场就站到那一场的起跑线上 */
    private sendHome(horse: MatchupHorse, ms = MATCHUP.placeMs): void {
      const node = this.nodes.get(horse.id);
      if (!node) return;
      const slot = slotOfHorse(this.level, this.roster, horse.id);
      const to = slot >= 0 ? this.startPos(slot) : { x: horse.x, y: horse.y };
      node.setDepth(50);
      this.tweens.killTweensOf(node);
      if (ms <= 0) {
        node.setPosition(to.x, to.y);
        return;
      }
      this.tweens.add({ targets: node, x: to.x, y: to.y, duration: ms, ease: 'Back.easeOut' });
    }

    // ---------------- 每帧 ----------------

    private tick(delta: number): void {
      const t = this.now();
      if (this.phase === 'racing' && this.runningSlot >= 0) {
        this.raceT = Math.min(1, this.raceT + delta / this.raceMs());
        this.moveRunning(this.runningSlot, this.raceT);
      }
      this.redraw(t);

      if (this.finished || this.phase === 'racing') return;
      this.idleMs += delta;
      if (this.idleMs < MATCHUP.idleMs) return;
      this.idleMs = 0;
      this.nudge();
    }

    private redraw(t: number): void {
      const stage = this.stageState();
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      if (this.doneGfx) {
        this.doneGfx.clear();
        if (this.won) cfg.drawFinale?.(this.doneGfx, stage, this.level);
      }
      this.drawMarks(stage, t);
      this.syncButtons(stage);
    }

    /** 正在跑的那一匹：从起跑线往对手那边挪（"差一点"要看得见） */
    private moveRunning(slot: number, progress: number): void {
      const race = this.results[slot];
      const horse = horseAtSlot(this.level, this.roster, slot);
      const node = horse ? this.nodes.get(horse.id) : undefined;
      const rival = this.level.rivals[slot];
      if (!node || !rival || !horse) return;
      const from = this.startPos(slot);
      // 赢的那一场一直跑到对手身边；输的那一场只跑到半路就停下 —— "差一点"
      const reach = race?.win ? 1 : 0.55;
      const target = rival.x - 110;
      const x = from.x + (target - from.x) * progress * reach;
      const y = from.y + Math.sin(progress * Math.PI * 2) * 7;
      node.setPosition(x, y);
    }

    /** 手指是不是落在底部按钮上（按钮的命中区与 addButton 一致） */
    private onButton(pointer: Phaser.Input.Pointer): boolean {
      const halfW = MATCHUP.button.width / 2;
      const halfH = MATCHUP.button.height / 2;
      const y = this.H - MATCHUP.button.fromBottom;
      const dx = Math.abs(pointer.x - this.W / 2);
      const dy = Math.abs(pointer.y - y);
      return dx <= halfW + 12 && dy <= halfH + 12;
    }

    private stageState(): MatchupStageState {
      const full = isRosterFull(this.level, this.roster);
      return {
        roster: [...this.roster],
        results: this.results.map((race) => (race === null ? null : { ...race })),
        ranCount: this.results.filter((race) => race !== null).length,
        wins: this.wins,
        losses: this.results.filter((race) => race !== null && !race.win).length,
        needWins: this.level.needWins,
        leftWins: winsNeeded(this.level, this.wins),
        full,
        runningSlot: this.runningSlot,
        raceT: this.raceT,
        settled: this.phase === 'settled',
        canStart: full && this.phase === 'arrange',
        selected: this.selected,
        phase: this.phase,
        won: this.won,
      };
    }

    /** 输赢的圈、被选中那匹马脚下的光都在这一层（画在马上面） */
    private drawMarks(stage: MatchupStageState, t: number): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      for (const race of stage.results) {
        if (race === null) continue;
        const rival = this.level.rivals[race.index];
        if (!rival) continue;
        g.lineStyle(9, race.win ? THEME.teal : THEME.red, 0.85);
        g.strokeCircle(rival.x, rival.y, 62);
      }
      if (this.selected === null) return;
      const horse = this.level.horses.find((item) => item.id === this.selected);
      const node = this.nodes.get(this.selected);
      if (!horse || !node) return;
      const pulse = 1 + 0.08 * Math.sin(t / 160);
      g.lineStyle(7, THEME.gold, 0.85);
      g.strokeCircle(node.x, node.y + horse.radius * 0.6, (horse.radius + 34) * pulse);
    }

    // ---------------- 点 ----------------

    private onTap(pointer: Phaser.Input.Pointer): void {
      this.idleMs = 0;
      if (this.finished) return;
      // 跑着呢：先看完这几场（点什么都不算，但也不锁死 —— 一会儿就松）
      if (this.phase === 'racing') return;
      // 跑完了还没重排：点哪都当作"重新编排"
      if (this.phase === 'settled') {
        this.rearrange();
        return;
      }
      // 底部按钮自己有 pointerdown：别把按按钮那一下再当成"点了某匹马"
      if (this.onButton(pointer)) return;
      this.hideHand();

      const horse = horseNear(this.level, pointer.x, pointer.y, MATCHUP.grabRadius);
      if (horse) {
        this.touchHorse(horse);
        return;
      }
      const rival = rivalAt(this.level, pointer.x, pointer.y, MATCHUP.rivalRadius - RIVAL_HIT);
      if (!rival) return;
      const slot = this.level.rivals.findIndex((item) => item.id === rival.id);
      if (slot >= 0) this.putAt(slot);
    }

    /** 点一匹马：架上没上场的 = 选中/取消；已经上场的 = 从那一场拿回来 */
    private touchHorse(horse: MatchupHorse): void {
      const slot = slotOfHorse(this.level, this.roster, horse.id);
      if (slot >= 0) {
        this.roster = takeBack(this.level, this.roster, slot);
        this.selected = this.selected === horse.id ? null : horse.id;
        this.settleAfterChange();
        this.sendHome(horse);
        this.refreshHorses();
        this.sfx('tap');
        this.ctx.emit('beat:enter', { beatId: 'matchup:back:' + horse.id });
        return;
      }
      this.selected = this.selected === horse.id ? null : horse.id;
      this.hideHand();
      this.sfx('tap');
      this.refreshHorses();
      this.ctx.emit('beat:enter', {
        beatId: 'matchup:pick:' + (this.selected ?? 'none'),
      });
    }

    /** 把选中的马放进第几场；没选中就先把这一场空出来 */
    private putAt(slot: number): void {
      const pick = this.selected;
      if (pick === null) {
        const standing = horseAtSlot(this.level, this.roster, slot);
        if (!standing) return;
        this.roster = takeBack(this.level, this.roster, slot);
        this.settleAfterChange();
        this.sendHome(standing);
        this.refreshHorses();
        this.sfx('tap');
        return;
      }
      this.roster = assign(this.level, this.roster, slot, pick);
      this.settleAfterChange();
      this.selected = null;
      this.sfx('correct');
      for (const horse of this.level.horses) this.sendHome(horse);
      this.refreshHorses();
      this.ctx.emit('beat:enter', { beatId: 'matchup:place:' + slot + ':' + pick });
      if (isRosterFull(this.level, this.roster)) {
        this.ctx.emit('beat:enter', { beatId: 'matchup:ready' });
      }
    }

    /** 改了排法：上次的结果全部清掉（重新编排永远是免费的） */
    private settleAfterChange(): void {
      this.results = this.level.rivals.map(() => null);
      this.wins = 0;
      this.phase = 'arrange';
      this.runningSlot = -1;
      this.raceT = 0;
    }

    // ---------------- 开赛 ----------------

    private raceMs(): number {
      return scaledMs(MATCHUP_TIMING.raceMs, this.autoplay);
    }

    private gapMs(): number {
      return scaledMs(MATCHUP_TIMING.raceGapMs, this.autoplay);
    }

    /** 开赛：一场接一场地跑（真实操作与无头验证走的是同一条路） */
    private startRace(): void {
      if (this.finished || this.phase !== 'arrange') return;
      if (!isRosterFull(this.level, this.roster)) {
        this.showHint(cfg.level.hint, 2400, MATCHUP.hintY);
        this.nudge();
        return;
      }
      this.phase = 'racing';
      this.results = this.level.rivals.map(() => null);
      this.wins = 0;
      this.selected = null;
      this.hideHand();
      this.refreshHorses();
      this.ctx.emit('beat:enter', { beatId: 'matchup:start' });
      this.raceNext(0);
    }

    /** 跑第 slot 场：先把结果算出来（resolve），再演给他看 */
    private raceNext(slot: number): void {
      // 赢了之后（或场景已经在收尾时）不再往下跑 —— 定时器可能还在队列里
      if (this.finished || this.won) return;
      if (slot >= this.level.rivals.length) {
        this.settle();
        return;
      }
      this.runningSlot = slot;
      this.raceT = 0;
      const result = resolve(this.level, this.roster)[slot];
      if (result) {
        this.results[slot] = result;
        this.wins += result.win ? 1 : 0;
      }
      this.sfx('tap');
      this.ctx.emit('beat:enter', {
        beatId: 'matchup:race:' + slot + ':' + (result?.win ? 'win' : 'lose'),
      });
      const rival = this.level.rivals[slot];
      this.time.delayedCall(this.raceMs(), () => {
        if (this.finished) return;
        this.ctx.emit('beat:enter', {
          beatId: 'matchup:flag:' + slot + ':' + (result?.win ? 'win' : 'lose'),
        });
        if (result?.win && rival) sparkleAt(this, rival.x, rival.y, THEME.gold, 5);
        this.time.delayedCall(this.gapMs() + MATCHUP.flagMs, () => this.raceNext(slot + 1));
      });
    }

    /** 三场跑完：赢够了就收尾，没赢够就等他自己重排（零惩罚） */
    private settle(): void {
      if (this.finished) return;
      this.phase = 'settled';
      this.runningSlot = -1;
      this.raceT = 1;
      if (isMatchupDone(this.level, this.wins) || winsFor(this.level, this.roster) >= this.level.needWins) {
        this.finish();
        return;
      }
      // 没赢够：这一局认了 —— 只是"把马放回去重排"，不扣星、不结束
      this.ctx.emit('beat:enter', {
        beatId: 'matchup:lost:' + this.wins + ':' + this.level.needWins,
      });
      this.ctx.emit('choice:made', {
        beatId: 'matchup:round',
        choiceId: 'roster:' + this.roster.join('-'),
        correct: false,
        latencyMs: this.now(),
      });
      const line = cfg.lostLine ?? cfg.level.hint;
      this.showHint(line, MATCHUP.lineMs, MATCHUP.hintY);
    }

    /** 输了想重排：把马全部放回架子（这一步永远是免费的） */
    private rearrange(): void {
      if (this.finished || this.phase === 'racing') return;
      this.roster = resetRoster(this.level);
      this.selected = null;
      this.settleAfterChange();
      for (const horse of this.level.horses) this.sendHome(horse);
      this.refreshHorses();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'matchup:reset' });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.won = true;
      this.phase = 'settled';
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', {
        beatId: 'matchup:won:' + this.wins + ':' + this.level.rivals.length,
      });
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, MATCHUP.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? MATCHUP.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 底部两个按钮 ----------------

    private drawButtons(): void {
      const y = this.H - MATCHUP.button.fromBottom;
      this.startButton = this.addButton(this.W / 2, y, cfg.startLabel, () => this.startRace(), {
        width: MATCHUP.button.width,
        height: MATCHUP.button.height,
        color: THEME.teal,
        fontSize: 40,
      });
      this.resetButton = this.addButton(this.W / 2, y, cfg.resetLabel, () => this.rearrange(), {
        width: MATCHUP.button.width,
        height: MATCHUP.button.height,
        color: THEME.gold,
        fontSize: 40,
        textColor: CSS.ink,
      });
      this.resetButton.setVisible(false);
    }

    /** 按钮跟着演出走：编排时"开赛"（没排满就暗着）、跑完了"重新编排" */
    private syncButtons(stage: MatchupStageState): void {
      if (!this.startButton || !this.resetButton) return;
      const arranging = stage.phase === 'arrange';
      this.startButton.setVisible(arranging);
      this.resetButton.setVisible(!arranging && !this.won);
      if (arranging) this.startButton.setAlpha(stage.full ? 1 : 0.45);
    }

    // ---------------- 提示与小手 ----------------

    private nudge(): void {
      this.showHint(this.level.hint, 2600, MATCHUP.hintY);
      if (this.selected !== null) return;
      const next = this.level.horses.find(
        (horse) => slotOfHorse(this.level, this.roster, horse.id) < 0,
      );
      if (!next) return;
      const node = this.nodes.get(next.id);
      this.hideHand();
      this.hand = createHand(this, node?.x ?? next.x, (node?.y ?? next.y) - next.radius - 40, 1.05);
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：按六种配对里最好的那一种把马一匹一匹放上去，排满就开赛。
     * 用的是与真实操作完全相同的 putAt / startRace 路径。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: MATCHUP_TIMING.autoplayStepMs,
        loop: true,
        callback: () => {
          if (this.finished || this.phase !== 'arrange') return;
          if (isRosterFull(this.level, this.roster)) {
            this.startRace();
            return;
          }
          const plan = placements(this.level, bestRoster(this.level));
          const needed = plan.find(
            ({ slot, horse }) => slotOfHorse(this.level, this.roster, horse.id) !== slot,
          );
          if (!needed) return;
          this.selected = needed.horse.id;
          this.putAt(needed.slot);
        },
      });
    }
  };
}

/** 计分板：赢了几场 / 要赢几场（游戏包的 drawStage 用它，口径与判定一致） */
export function matchupScoreBar(
  g: Phaser.GameObjects.Graphics,
  level: MatchupLevel,
  wins: number,
): void {
  const { x, y, w, h } = MATCHUP.score;
  roundRect(g, x, y, w, h, h / 2, shade(THEME.card, 0.96), THEME.outline, 5);
  const inner = w - 12;
  const fill = inner * matchupProgress(level, wins);
  if (fill > 6) roundRect(g, x + 6, y + 6, fill, h - 12, (h - 12) / 2, THEME.teal, null, 0);
}

/** 这一场的木牌上写什么（双语由内容 JSON 的 label 给） */
export function rivalLabel(rival: MatchupRival): string {
  return rival.label;
}

/** 赛场上方的一句话（"这一局我们认了"用它；双语由内容 JSON 给） */
export function scoreboardText(
  scene: Phaser.Scene,
  text: string,
  y: number = MATCHUP.score.y - 56,
): Phaser.GameObjects.Text {
  return scene.add
    .text(375, y, text, textStyle(34, CSS.ink, true))
    .setOrigin(0.5)
    .setDepth(80);
}
