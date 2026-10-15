import type { BorrowLevel, BorrowProp } from './schemas';

/** 连了哪些东西、抬起来过没有、点了几次重物 */
export interface BorrowState {
  /** 已经连上绳子的东西 id */
  connected: string[];
  /** "借力成功"这件事发生过（抬起来过一次） */
  lifted: boolean;
  /** 点了几次重物 —— "纹丝不动"也是一次尝试，不惩罚 */
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

/** 点重物：力够了才抬得起来，不够就纹丝不动（不惩罚，接着试就是） */
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
