import type { BorrowBannerLevel, BorrowFlag, BorrowLevel, BorrowProp, BorrowScattered } from './schemas';

/** 连了哪些东西、抬起来过没有、点了几次重物 */
export interface BorrowState {
  /** 已经连上绳子的东西 id */
  connected: string[];
  /** "借力成功"这件事发生过（抬起来过一次） */
  lifted: boolean;
  /** 点了几次重物 —— "纹丝不动"也是一次尝试（场景记进 mistakes），不结束操作 */
  tries: number;
}

export interface BorrowPull {
  state: BorrowState;
  /** lifted = 抬起来了；stuck = 纹丝不动 */
  result: 'lifted' | 'stuck';
}

export function borrowStart(): BorrowState {
  return { connected: [], lifted: false, tries: 0 };
}

/** 只算"自己出力"的那一份力气 —— schema 已经保证它永远小于 needed */
export function selfPower(level: BorrowLevel): number {
  return level.props
    .filter((prop) => prop.kind === 'self')
    .reduce((sum, prop) => sum + prop.power, 0);
}

/** 连上来的力加起来有多少（没连的不算，重复的不算两份） */
export function totalPower(level: BorrowLevel, connected: string[]): number {
  const wanted = new Set(connected);
  return level.props
    .filter((prop) => wanted.has(prop.id))
    .reduce((sum, prop) => sum + prop.power, 0);
}

/** 有没有垫脚的地方：杠杆总得有个支点 */
export function hasFulcrum(level: BorrowLevel, connected: string[]): boolean {
  const wanted = new Set(connected);
  return level.props.some((prop) => prop.kind === 'fulcrum' && wanted.has(prop.id));
}

/** 这套连着的东西够不够把石头抬起来：支点 + 够大的力，两样都要 */
export function canLift(level: BorrowLevel, connected: string[]): boolean {
  return hasFulcrum(level, connected) && totalPower(level, connected) >= level.needed;
}

/**
 * 石头此刻是不是被托着的。
 * 与 canLift 是同一个判定：石头是被"连着的力"托住的 —— **解开一根绳子，它就落回地上**。
 * 两个名字问的是两件事：能不能抬（提示）、是不是已经抬着（画面）。
 */
export function isLifted(level: BorrowLevel, connected: string[]): boolean {
  return canLift(level, connected);
}

/** 借力成功、而且绳子还托着 —— 完成判定 */
export function isBorrowDone(level: BorrowLevel, state: BorrowState): boolean {
  return state.lifted && isLifted(level, state.connected);
}

/** 连上一件东西：重复连同一件不会算两份力 */
export function connectProp(level: BorrowLevel, state: BorrowState, propId: string): BorrowState {
  if (!level.props.some((prop) => prop.id === propId) || state.connected.includes(propId)) {
    return state;
  }
  return { connected: [...state.connected, propId], lifted: state.lifted, tries: state.tries };
}

/** 解开一根绳子：力不够了，石头就掉回去 */
export function disconnectProp(level: BorrowLevel, state: BorrowState, propId: string): BorrowState {
  if (!state.connected.includes(propId)) return state;
  const connected = state.connected.filter((id) => id !== propId);
  return { connected, lifted: state.lifted && canLift(level, connected), tries: state.tries };
}

/** 点重物：力够了才抬得起来，不够就纹丝不动（记进 mistakes，接着试就是） */
export function pull(level: BorrowLevel, state: BorrowState): BorrowPull {
  const tries = state.tries + 1;
  if (!canLift(level, state.connected)) {
    return { state: { connected: [...state.connected], lifted: false, tries }, result: 'stuck' };
  }
  return { state: { connected: [...state.connected], lifted: true, tries }, result: 'lifted' };
}

/** 手指落在哪一件上；forgive 让小朋友不用对准 */
export function propAt(
  x: number,
  y: number,
  level: BorrowLevel,
  forgive = 0,
): BorrowProp | null {
  let best: BorrowProp | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const prop of level.props) {
    const dist = Math.hypot(x - prop.x, y - prop.y);
    if (dist <= prop.radius + forgive && dist < bestDist) {
      best = prop;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 这一关该怎么连：先垫支点，再一件件加力源，够了就停。
 * 无头验证照它连；提示也照它指下一步。
 */
export function suggestedConnections(level: BorrowLevel): string[] {
  const out: string[] = [];
  const fulcrum = level.props.find((prop) => prop.kind === 'fulcrum');
  if (fulcrum) out.push(fulcrum.id);
  let power = 0;
  for (const prop of level.props) {
    if (power >= level.needed) break;
    if (prop.kind !== 'source') continue;
    out.push(prop.id);
    power += prop.power;
  }
  return out;
}

/** 下一件该连什么；力已经够了就返回 undefined（该去点重物了） */
export function nextPropToConnect(
  level: BorrowLevel,
  connected: string[],
): BorrowProp | undefined {
  if (canLift(level, connected)) return undefined;
  const id = suggestedConnections(level).find((propId) => !connected.includes(propId));
  return id === undefined ? undefined : level.props.find((prop) => prop.id === id);
}

/* ---------------- banner：借名号（借尸还魂） ----------------
 *
 * 与 force（借力）是**两个模式**：force 的每一行判定一个字没动，这一节是另开的一份账本。
 *
 * - **一面旗只能用一次**：竖起来的旗就是"名号"，用过就不能再用；
 * - **召回的人一个一个数得清**：插一面 rally = 3 的旗，外面前三个还没回来的人自己归队；
 * - **零惩罚**：召不够就换一面旗接着竖 —— 没有失败、没有结束、没有扣星。
 *   schema 保证所有旗的 rally 加起来够 needed，所以这一关一定过得去。
 */

/** banner 一局里攒下来的东西 */
export interface BannerState {
  /** 已经竖起来过的旗 id（每面旗只能用一次） */
  raised: string[];
  /** 已经被召回来的人 id（按回来的先后） */
  rallied: string[];
}

/** 插一次旗的结果：新的账本 + 这一次召回了几个人 */
export interface BannerRaise {
  state: BannerState;
  /** 这一次召回的人数 —— 没插上（不认识 / 已经用过）就是 0 */
  rallied: number;
  /** 插的是哪面旗；没插上就是 null */
  flag: BorrowFlag | null;
}

/** 开一局：一面旗都还没竖，一个人都还没回来 */
export function bannerStart(level: BorrowBannerLevel): BannerState {
  void level; // 开局不需要关卡的任何数据；入口与别的模板一样拿得到关卡
  return { raised: [], rallied: [] };
}

/** 插旗：每面旗只能用一次；召回的是**还没回来的**那些散人 */
export function raiseFlag(
  level: BorrowBannerLevel,
  state: BannerState,
  flagId: string,
): BannerRaise {
  const flag = level.flags.find((item) => item.id === flagId);
  if (flag === undefined || state.raised.includes(flag.id)) {
    return { state, rallied: 0, flag: null };
  }
  const fresh = level.scattered
    .filter((person) => !state.rallied.includes(person.id))
    .slice(0, flag.rally);
  return {
    state: {
      raised: [...state.raised, flag.id],
      rallied: [...state.rallied, ...fresh.map((person) => person.id)],
    },
    rallied: fresh.length,
    flag,
  };
}

/** 已经召回了几个人 */
export function ralliedCount(state: BannerState): number {
  return state.rallied.length;
}

/** 这面旗竖起来过没有 */
export function isFlagRaised(state: BannerState, flagId: string): boolean {
  return state.raised.includes(flagId);
}

/** 这个人和队伍会合了没有 */
export function isPersonRallied(state: BannerState, personId: string): boolean {
  return state.rallied.includes(personId);
}

/** 还能用的旗（已经竖起来的不算）—— 画面里插在地上的就是这几面 */
export function availableFlags(level: BorrowBannerLevel, state: BannerState): BorrowFlag[] {
  return level.flags.filter((flag) => !state.raised.includes(flag.id));
}

/** 召回的人够了没有 */
export function isBannerDone(level: BorrowBannerLevel, state: BannerState): boolean {
  return ralliedCount(state) >= level.needed;
}

/** 召回了几分（0..1）—— 画面上的进度按它画 */
export function ralliedRatio(level: BorrowBannerLevel, state: BannerState): number {
  if (level.needed <= 0) return 1;
  return Math.max(0, Math.min(1, ralliedCount(state) / level.needed));
}

/**
 * 下一面该竖哪一面：挑还在的、rally 最大的那一面。
 * 无头验证照它一面一面竖；提示也照它指下一步。
 */
export function nextFlagToRaise(
  level: BorrowBannerLevel,
  state: BannerState,
): BorrowFlag | undefined {
  if (isBannerDone(level, state)) return undefined;
  return availableFlags(level, state).sort((a, b) => b.rally - a.rally)[0];
}

/** 手指落在哪一面旗上（宽容度让小朋友不用对准；已经竖起来的也会被点到 —— 由调用方判断） */
export function flagAt(
  x: number,
  y: number,
  level: BorrowBannerLevel,
  forgive = 0,
): BorrowFlag | null {
  let best: BorrowFlag | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const flag of level.flags) {
    const dist = Math.hypot(x - flag.x, y - flag.y);
    if (dist <= flag.radius + forgive && dist < bestDist) {
      best = flag;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指落在哪一个散人身上 */
export function personAt(
  x: number,
  y: number,
  level: BorrowBannerLevel,
  forgive = 0,
): BorrowScattered | null {
  let best: BorrowScattered | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const person of level.scattered) {
    const dist = Math.hypot(x - person.x, y - person.y);
    if (dist <= person.radius + forgive && dist < bestDist) {
      best = person;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指是不是落在旗杆上（把旗拖到这儿才竖得起来） */
export function poleAt(
  level: BorrowBannerLevel,
  x: number,
  y: number,
  forgive = 0,
): boolean {
  const { pole } = level;
  return Math.hypot(x - pole.x, y - pole.y) <= pole.radius + forgive;
}
