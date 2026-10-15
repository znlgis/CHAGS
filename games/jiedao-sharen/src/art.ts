import type Phaser from 'phaser';
import { THEME, circle, groundShadow, roundRect, shade, wavyBand } from '@chags/phaser-kit';
import type { BorrowLevel, BorrowProp } from '@chags/templates/schemas';

/** 画面要用的那部分 metrics（结构上与模板的 BorrowStageMetrics 对得上） */
export interface BorrowView {
  connected: string[];
  totalPower: number;
  needed: number;
  hasFulcrum: boolean;
  canLift: boolean;
  lifted: boolean;
  tries: number;
  selfPower: number;
}

/** 工地：一块平地、一条水渠、一堆石头 */
const SITE = { x: 20, y: 176, w: 710, h: 1130 } as const;
/** 力气表：连上来的力离 needed 还有多远 */
const GAUGE = { x: 46, y: 430, w: 46, h: 500 } as const;

function propById(level: BorrowLevel, id: string): BorrowProp | undefined {
  return level.props.find((prop) => prop.id === id);
}

/** 一件东西贡献多少力就画多少个点：力是数得出来的 */
function drawPips(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  count: number,
  active: boolean,
): void {
  const perRow = 6;
  const gap = 22;
  const rows = Math.max(1, Math.ceil(count / perRow));
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, count - row * perRow);
    const cx = x - ((inRow - 1) * gap) / 2 + col * gap;
    const cy = y - (rows - 1) * gap + row * gap;
    circle(
      g,
      cx,
      cy,
      8,
      active ? THEME.gold : shade(THEME.stone, 1.12),
      active ? THEME.outline : shade(THEME.stone, 0.72),
      4,
    );
  }
}

/** 绳子：从大石垂到连上的那一件东西（解开的那根就没有了） */
function drawRope(
  g: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  sag: number,
): void {
  g.lineStyle(9, 0x8a6a4d, 1);
  g.beginPath();
  g.moveTo(from.x, from.y);
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t + Math.sin(Math.PI * t) * sag;
    g.lineTo(x, y);
  }
  g.strokePath();
}

/** 石头边缘往目标方向的那个点：绳子从这里出发才像系在石头上 */
function rim(load: { x: number; y: number }, to: { x: number; y: number }, r: number) {
  const dx = to.x - load.x;
  const dy = to.y - load.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: load.x + (dx / len) * r, y: load.y + (dy / len) * r };
}

/** 大石：抬起来的时候整体上移，底下扬起一圈土 */
function drawLoad(
  g: Phaser.GameObjects.Graphics,
  level: BorrowLevel,
  stage: BorrowView,
): void {
  const { x, y, radius } = level.load;
  const lift = stage.lifted ? 46 : 0;
  groundShadow(g, x, y + radius, 320, 60, 0.2);
  if (stage.canLift && !stage.lifted) {
    // 力够了、还没拉：底下的支点顶住了，石头边上裂开细纹
    g.lineStyle(6, shade(THEME.stone, 0.66), 1);
    for (const dx of [-70, -20, 46] as const) {
      g.beginPath();
      g.moveTo(x + dx, y + radius - 30);
      g.lineTo(x + dx + 16, y + radius - 6);
      g.lineTo(x + dx + 30, y + radius - 26);
      g.strokePath();
    }
  }
  roundRect(g, x - 118, y - 96 - lift, 236, 196, 60, shade(THEME.stone, 1.02), THEME.outline, 7);
  g.fillStyle(shade(THEME.stone, 1.1), 1);
  g.fillTriangle(x - 92, y - 86 - lift, x - 18, y - 182 - lift, x + 58, y - 84 - lift);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeTriangle(x - 92, y - 86 - lift, x - 18, y - 182 - lift, x + 58, y - 84 - lift);
  g.lineStyle(5, shade(THEME.stone, 0.72), 1);
  g.lineBetween(x - 44, y - 20 - lift, x + 18, y + 34 - lift);
  g.lineBetween(x - 10, y - 52 - lift, x + 54, y - 6 - lift);
}

/** 自己：一个小人，只有一点力气（连上绳子也只是多一点点） */
function drawSelf(g: Phaser.GameObjects.Graphics, prop: BorrowProp, tied: boolean): void {
  const { x, y } = prop;
  const lean = tied ? -10 : 0;
  groundShadow(g, x, y + 78, 140, 30, 0.16);
  roundRect(g, x + lean - 42, y - 60, 84, 136, 32, THEME.teal, THEME.outline, 6);
  circle(g, x + lean, y - 90, 34, 0xf6d3ae, THEME.outline, 6);
  g.fillStyle(THEME.ink, 1);
  g.fillEllipse(x + lean, y - 102, 70, 28);
  g.lineStyle(16, THEME.teal, 1);
  g.lineBetween(x + lean + 26, y - 30, x + 92, y - 78);
  g.lineStyle(5, THEME.outline, 1);
  g.lineBetween(x + lean + 26, y - 30, x + 92, y - 78);
}

/** 支点：一块垫脚的石头（杠杆总得有个撑点） */
function drawFulcrum(g: Phaser.GameObjects.Graphics, prop: BorrowProp, tied: boolean): void {
  const { x, y } = prop;
  groundShadow(g, x, y + 44, 190, 30, 0.18);
  g.fillStyle(shade(THEME.stone, tied ? 1.08 : 0.98), 1);
  g.fillTriangle(x - 74, y + 40, x + 74, y + 40, x, y - 96);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(x - 74, y + 40, x + 74, y + 40, x, y - 96);
  g.lineStyle(5, shade(THEME.stone, 0.7), 1);
  g.lineBetween(x - 34, y + 10, x + 20, y - 40);
}

/** 长木棍：架在支点上，一头伸到大石底下（撬的是支点给的力） */
function drawStick(g: Phaser.GameObjects.Graphics, tied: boolean, lifted: boolean): void {
  const left = lifted ? { x: 258, y: 822 } : { x: 258, y: 796 };
  const right = lifted ? { x: 528, y: 1078 } : { x: 506, y: 1142 };
  g.lineStyle(30, shade(THEME.wood, 0.8), 1);
  g.lineBetween(left.x, left.y, right.x, right.y);
  g.lineStyle(20, tied ? THEME.wood : shade(THEME.wood, 0.92), 1);
  g.lineBetween(left.x, left.y, right.x, right.y);
}

/** 水车：连上之后转起来（借的是水流的力） */
function drawWheel(
  g: Phaser.GameObjects.Graphics,
  prop: BorrowProp,
  tied: boolean,
  elapsed: number,
): void {
  const { x, y } = prop;
  const spin = tied ? elapsed / 6 : 0;
  wavyBand(g, x - 150, y + 46, 260, 90, THEME.water, 0.85, 10, 1.8, 24);
  g.lineStyle(16, THEME.woodDeep, 1);
  g.lineBetween(x, y + 40, x, y + 150);
  for (let i = 0; i < 8; i += 1) {
    const angle = spin + (Math.PI * 2 * i) / 8;
    const ex = x + Math.cos(angle) * 78;
    const ey = y + Math.sin(angle) * 78;
    g.lineStyle(9, shade(THEME.wood, 0.9), 1);
    g.lineBetween(x, y, ex, ey);
    g.fillStyle(tied ? THEME.gold : THEME.wood, 1);
    g.fillRoundedRect(ex - 12, ey - 12, 30, 30, 8);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeRoundedRect(ex - 12, ey - 12, 30, 30, 8);
  }
  circle(g, x, y, 26, shade(THEME.wood, 1.05), THEME.outline, 6);
}

/** 老牛：连上之后把身子往前压（借的是牲口的力） */
function drawOx(g: Phaser.GameObjects.Graphics, prop: BorrowProp, tied: boolean): void {
  const { x, y } = prop;
  const lean = tied ? 12 : 0;
  const bodyX = x - 30 - lean * 0.5;
  groundShadow(g, bodyX, y + 78, 230, 30, 0.18);
  for (const dx of [-56, -14, 36] as const) {
    roundRect(g, bodyX + dx, y + 6, 20, 62, 10, shade(THEME.wood, 0.86), THEME.outline, 5);
  }
  g.fillStyle(shade(THEME.wood, 1.02), 1);
  g.fillEllipse(bodyX, y - 14, 178, 104);
  g.lineStyle(7, THEME.outline, 1);
  g.strokeEllipse(bodyX, y - 14, 178, 104);
  const headX = bodyX - 106;
  circle(g, headX, y - 44, 38, shade(THEME.wood, 1.02), THEME.outline, 6);
  g.fillStyle(THEME.card, 1);
  g.fillTriangle(headX - 26, y - 62, headX - 46, y - 100, headX - 6, y - 76);
  g.fillTriangle(headX + 18, y - 64, headX + 20, y - 104, headX + 42, y - 70);
  g.lineStyle(5, THEME.outline, 1);
  g.strokeTriangle(headX - 26, y - 62, headX - 46, y - 100, headX - 6, y - 76);
  g.strokeTriangle(headX + 18, y - 64, headX + 20, y - 104, headX + 42, y - 70);
  g.fillStyle(THEME.outline, 1);
  g.fillCircle(headX - 14, y - 46, 6);
  g.lineStyle(6, THEME.outline, 1);
  g.lineBetween(bodyX + 82, y - 30, bodyX + 96, y + 26);
}

/** 力气表：连上来的力 / 需要的力（到了红线就够了） */
function drawGauge(g: Phaser.GameObjects.Graphics, level: BorrowLevel, stage: BorrowView): void {
  const sources = level.props
    .filter((prop) => prop.kind === 'source')
    .reduce((sum, prop) => sum + prop.power, 0);
  const scaleMax = Math.max(stage.needed, sources, 1);
  const { x, y, w, h } = GAUGE;
  const inner = h - 12;
  roundRect(g, x, y, w, h, w / 2, shade(THEME.card, 0.96), THEME.outline, 6);
  const fill = Math.max(0, Math.min(inner, inner * (stage.totalPower / scaleMax)));
  if (fill > 8) {
    roundRect(
      g,
      x + 6,
      y + h - 6 - fill,
      w - 12,
      fill,
      (w - 12) / 2,
      stage.canLift ? THEME.gold : THEME.stoneDeep,
      null,
      0,
    );
  }
  const needY = y + h - 6 - inner * (stage.needed / scaleMax);
  g.lineStyle(7, THEME.red, 1);
  g.lineBetween(x - 14, needY, x + w + 14, needY);
  g.fillStyle(THEME.red, 1);
  g.fillTriangle(x + w + 14, needY - 10, x + w + 34, needY, x + w + 14, needY + 10);
}

/** 整屏画面：工地、大石、木棍、水车、老牛，绳子连上就抬 */
export function drawStage(
  g: Phaser.GameObjects.Graphics,
  stage: BorrowView,
  level: BorrowLevel,
  elapsed: number,
): void {
  roundRect(g, SITE.x, SITE.y, SITE.w, SITE.h, 44, shade(THEME.sand, 1.02), THEME.outline, 7);
  g.fillStyle(shade(THEME.sand, 0.82), 0.7);
  g.fillRoundedRect(SITE.x, 1010, SITE.w, SITE.h - 834, { tl: 0, tr: 0, bl: 44, br: 44 });
  for (const [px, py, pr] of [[120, 620, 12], [250, 1240, 10], [430, 640, 9], [700, 470, 11]] as const) {
    circle(g, px, py, pr, shade(THEME.stone, 1.1), null, 0);
  }

  const tied = (id: string): boolean => stage.connected.includes(id);
  const load = { x: level.load.x, y: level.load.y };
  const stick = propById(level, 'stick');
  const wheel = propById(level, 'wheel');
  const ox = propById(level, 'ox');
  const self = propById(level, 'self');
  const fulcrum = propById(level, 'fulcrum');

  // 先画会挡在大石后面的东西，再画石头，最后画支点与绳子
  if (stick) drawStick(g, tied(stick.id), stage.lifted);
  if (wheel) drawWheel(g, wheel, tied(wheel.id), elapsed);
  if (ox) drawOx(g, ox, tied(ox.id));
  drawLoad(g, level, stage);
  if (self) drawSelf(g, self, tied(self.id));
  if (fulcrum) drawFulcrum(g, fulcrum, tied(fulcrum.id));

  for (const prop of level.props) {
    if (prop.kind === 'fulcrum' || prop.power <= 0) continue;
    const top = prop.id === 'wheel' ? prop.y - 108 : prop.y - prop.radius - 30;
    drawPips(g, prop.x, top, prop.power, tied(prop.id));
  }

  // 连上的那些：绳子从石头边上垂到它身上（木棍是撬在石头底下的，不用绳）
  for (const id of stage.connected) {
    const prop = propById(level, id);
    if (!prop || prop.kind === 'fulcrum' || prop.id === 'stick') continue;
    const to =
      prop.id === 'self'
        ? { x: prop.x + 92, y: prop.y - 78 }
        : prop.id === 'ox'
          ? { x: prop.x - 136, y: prop.y - 44 }
          : { x: prop.x, y: prop.y - 40 };
    drawRope(g, rim(load, to, 124), to, prop.id === 'ox' ? 80 : 96);
  }

  drawGauge(g, level, stage);
}

/** 抬起来：金色的光、底座扬起一圈土 */
export function drawFinale(
  g: Phaser.GameObjects.Graphics,
  _stage: BorrowView,
  level: BorrowLevel,
): void {
  const { x, y } = level.load;
  g.fillStyle(THEME.gold, 0.16);
  g.fillCircle(x, y, 340);
  g.lineStyle(12, THEME.gold, 0.6);
  g.strokeCircle(x, y, 300);
  g.lineStyle(8, shade(THEME.sand, 0.8), 0.9);
  g.strokeEllipse(x, y + 120, 400, 120);
}

/** 分幕插图：① 子贡说"我去走一趟" ② 四国的兵互相牵住，鲁国安稳 */
export function drawBeat(
  g: Phaser.GameObjects.Graphics,
  index: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const { x, y, w, h } = rect;
  g.fillStyle(THEME.sky, 1);
  g.fillRoundedRect(x, y, w, h, 34);
  g.fillStyle(shade(THEME.sand, 0.94), 1);
  g.fillRoundedRect(x - 20, y + h * 0.62, w + 40, h * 0.42, 30);

  if (index === 0) {
    // 鲁国的城门 + 出门走一趟的子贡
    const gateX = x + w * 0.68;
    roundRect(g, gateX - 110, y + h * 0.28, 220, h * 0.36, 18, shade(THEME.stone, 1.05), THEME.outline, 7);
    roundRect(g, gateX - 38, y + h * 0.44, 76, h * 0.2, { tl: 36, tr: 36, bl: 0, br: 0 }, shade(THEME.wood, 0.72), THEME.outline, 6);
    g.lineStyle(7, THEME.outline, 1);
    g.lineBetween(gateX + 96, y + h * 0.32, gateX + 96, y + h * 0.1);
    g.fillStyle(THEME.gold, 1);
    g.fillTriangle(gateX + 96, y + h * 0.1, gateX + 152, y + h * 0.16, gateX + 96, y + h * 0.22);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(gateX + 96, y + h * 0.1, gateX + 152, y + h * 0.16, gateX + 96, y + h * 0.22);
    roundRect(g, x + w * 0.14, y + h * 0.66, w * 0.6, h * 0.06, 16, shade(THEME.sand, 0.82), null, 0);
    groundShadow(g, x + w * 0.3, y + h * 0.88, 150, 30, 0.14);
    roundRect(g, x + w * 0.3 - 42, y + h * 0.6, 84, h * 0.26, 30, THEME.teal, THEME.outline, 6);
    circle(g, x + w * 0.3, y + h * 0.56, 34, 0xf6d3ae, THEME.outline, 6);
    g.fillStyle(THEME.ink, 1);
    g.fillEllipse(x + w * 0.3, y + h * 0.53, 70, 28);
    g.lineStyle(10, THEME.woodDeep, 1);
    g.lineBetween(x + w * 0.3 + 44, y + h * 0.62, x + w * 0.3 + 44, y + h * 0.9);
    return;
  }

  // 四国的兵互相牵住：四根旗杆互相拉着一根绳，中间的鲁国稳稳站着
  const cx = x + w / 2;
  const cy = y + h * 0.54;
  const corners = [
    { px: x + w * 0.16, py: y + h * 0.3, color: THEME.red },
    { px: x + w * 0.84, py: y + h * 0.3, color: THEME.teal },
    { px: x + w * 0.16, py: y + h * 0.86, color: THEME.goldDeep },
    { px: x + w * 0.84, py: y + h * 0.86, color: THEME.leaf },
  ] as const;
  g.lineStyle(8, 0x8a6a4d, 1);
  for (const corner of corners) {
    g.lineBetween(corner.px, corner.py, cx, cy);
  }
  circle(g, cx, cy, 30, THEME.card, THEME.outline, 6);
  for (const corner of corners) {
    g.lineStyle(7, THEME.outline, 1);
    g.lineBetween(corner.px, corner.py, corner.px, corner.py - 120);
    g.fillStyle(corner.color, 1);
    g.fillTriangle(corner.px, corner.py - 120, corner.px + 76, corner.py - 96, corner.px, corner.py - 72);
    g.lineStyle(5, THEME.outline, 1);
    g.strokeTriangle(corner.px, corner.py - 120, corner.px + 76, corner.py - 96, corner.px, corner.py - 72);
  }
  groundShadow(g, cx, cy + 122, 180, 32, 0.16);
  g.lineStyle(9, THEME.outline, 1);
  g.lineBetween(cx, cy + 130, cx, cy - 6);
  g.fillStyle(THEME.gold, 1);
  g.fillTriangle(cx, cy - 6, cx + 96, cy + 26, cx, cy + 58);
  g.lineStyle(6, THEME.outline, 1);
  g.strokeTriangle(cx, cy - 6, cx + 96, cy + 26, cx, cy + 58);
  roundRect(g, cx - 34, cy + 96, 68, 40, 12, shade(THEME.stone, 1.05), THEME.outline, 5);
}
