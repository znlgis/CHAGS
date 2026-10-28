import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  CHAIN_STEP_TIMING, askGrant, grantHit, grantLeftMs, isGranted, isPostTaken, isStepDone,
  nextPost, nextStep, postAt, postsLeft, stepStart, takeOver, takenPosts,
} from '@chags/templates/chain.logic';
import { DESIGN_H, DESIGN_W, GRANT, GRANT_MS, POSTS, POST_RADIUS, ROUTE, SKY_TOP } from './layout';
import { fankeLevel } from './logic';

const entry = getEntry('fanke-weizhu')!;
const level = fankeLevel(entry);

/**
 * 模板的点击宽容度（chain.ts 里 CHAIN.stepTapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 46;

/** 一个点在路点里的下标：岗位就落在路点上 */
function routeIndexOf(x: number, y: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  ROUTE.forEach((point, index) => {
    const dist = Math.hypot(point.x - x, point.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

/** 照模板 runAutoplay 的同一条路走一遍：求一次允许 → 接下一处 → 再求下一次 */
function runAutoplay(): { moves: string[]; state: ReturnType<typeof stepStart>; at: number } {
  let state = stepStart();
  let at = 0;
  const moves: string[] = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const move = nextStep(level, state, at);
    if (move === undefined) break;
    if (move.kind === 'grant') {
      moves.push('grant');
      state = askGrant(state, at);
    } else {
      moves.push(move.post.id);
      state = takeOver(level, state, move.post.id, at);
    }
    at += CHAIN_STEP_TIMING.autoplayStepMs;
  }
  return { moves, state, at };
}

describe('反客为主 · 美术与关卡数据互锁', () => {
  it('四处岗位就在这条路上，而且是按接手的先后排的 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('step');
    expect(level.posts.map((post) => post.id)).toEqual(POSTS.map((post) => post.id));
    for (const [index, post] of level.posts.entries()) {
      expect(post.x).toBe(POSTS[index]!.x);
      expect(post.y).toBe(POSTS[index]!.y);
      expect(post.radius).toBe(POST_RADIUS);
      // 岗位正落在路点上：路从这儿过，关卡数据就得在这儿
      const point = ROUTE[routeIndexOf(post.x, post.y)]!;
      expect(Math.hypot(post.x - point.x, post.y - point.y)).toBe(0);
    }
    // 涪城营帐 → 葭萌关 → 雒城 → 成都：路点的先后就是岗位的先后
    expect(level.posts.map((post) => routeIndexOf(post.x, post.y))).toEqual([1, 2, 3, 4]);
    expect(level.posts.map((post) => post.label)).toEqual(['涪城营帐', '葭萌关', '雒城', '成都']);
    expect(level.posts.every((post) => post.label.length <= 12)).toBe(true);
  });

  it('求允许在刘璋的营帐（路的南端），这一路一直往北 —— 顺序写在路上', () => {
    expect(level.grant).toEqual({ x: GRANT.x, y: GRANT.y, radius: GRANT.radius });
    expect(level.grantMs).toBe(GRANT_MS);
    // 允许要够点完一处岗位（schema 也卡了 600 毫秒的下限 —— 不然就成比手速了）
    expect(level.grantMs).toBeGreaterThanOrEqual(600);
    expect(routeIndexOf(GRANT.x, GRANT.y)).toBe(0);
    // 一处一处往北：每一段都比上一段靠北
    for (let i = 0; i + 1 < ROUTE.length; i += 1) {
      expect(ROUTE[i + 1]!.y, '第 ' + i + ' 段没往北走').toBeLessThan(ROUTE[i]!.y);
    }
    expect(level.posts[level.posts.length - 1]!.id).toBe('chengdu');
  });

  it('五个可以点的地方都在画面里，彼此点得开（手指粗也点不到隔壁）', () => {
    const spots = [
      { id: 'grant', x: level.grant.x, y: level.grant.y, radius: level.grant.radius },
      ...level.posts.map((post) => ({ id: post.id, x: post.x, y: post.y, radius: post.radius })),
    ];
    for (const spot of spots) {
      expect(spot.x - spot.radius).toBeGreaterThanOrEqual(0);
      expect(spot.x + spot.radius).toBeLessThanOrEqual(DESIGN_W);
      expect(spot.y - spot.radius).toBeGreaterThan(SKY_TOP);
      expect(spot.y + spot.radius).toBeLessThan(DESIGN_H);
    }
    for (const a of spots) {
      for (const b of spots) {
        if (a.id === b.id) continue;
        expect(
          Math.hypot(a.x - b.x, a.y - b.y),
          a.id + ' 与 ' + b.id + ' 挨在一起了',
        ).toBeGreaterThan(a.radius + b.radius + 2 * TAP_FORGIVE);
      }
    }
  });
});

describe('反客为主 · 判定：一步一步来', () => {
  it('一局真的走得完：求允许 → 接下一处 → 再求下一次（与场景同一条路）', () => {
    const { moves, state } = runAutoplay();
    expect(moves).toEqual([
      'grant', 'fu-camp', 'grant', 'jiameng-pass', 'grant', 'luo-city', 'grant', 'chengdu',
    ]);
    expect(takenPosts(state)).toBe(4);
    expect(postsLeft(level, state)).toBe(0);
    expect(isStepDone(level, state)).toBe(true);
    expect(state.taken).toEqual(['fu-camp', 'jiameng-pass', 'luo-city', 'chengdu']);
    expect(nextPost(level, state)).toBeUndefined();
    expect(nextStep(level, state, 99_999)).toBeUndefined();
  });

  it('没求到允许，一处岗位也接不下来（原样返回）', () => {
    const start = stepStart();
    expect(isGranted(level, start, 0)).toBe(false);
    for (const post of level.posts) expect(takeOver(level, start, post.id, 0)).toBe(start);
    expect(takenPosts(start)).toBe(0);
    // 求允许：第一处这才动得了
    const asked = askGrant(start, 1200);
    expect(isGranted(level, asked, 1300)).toBe(true);
    expect(takeOver(level, asked, 'fu-camp', 1300)).not.toBe(asked);
    // 求到之后再点求允许的地方：只是重新盖章，不重复接手
    const again = askGrant(asked, 1400);
    expect(again.asks).toBe(2);
    expect(takenPosts(again)).toBe(0);
  });

  it('允许过期就作废：到点那一刻就接管不了，重新求一次就好（零惩罚）', () => {
    const asked = askGrant(stepStart(), 0);
    expect(grantLeftMs(level, asked, level.grantMs - 1)).toBe(1);
    expect(isGranted(level, asked, level.grantMs - 1)).toBe(true);
    expect(grantLeftMs(level, asked, level.grantMs)).toBe(0);
    expect(isGranted(level, asked, level.grantMs)).toBe(false);
    expect(takeOver(level, asked, 'fu-camp', level.grantMs)).toBe(asked);
    // 重新求一次（零惩罚），照样接得下来
    const again = askGrant(asked, level.grantMs + 400);
    expect(takeOver(level, again, 'fu-camp', level.grantMs + 500)).not.toBe(again);
  });

  it('允许是一次性的，而且只能按顺序接管：跳着点、回头点都只是没进展', () => {
    const asked = askGrant(stepStart(), 0);
    // 跳着点：不是下一个
    expect(takeOver(level, asked, 'jiameng-pass', 100)).toBe(asked);
    expect(takeOver(level, asked, 'chengdu', 100)).toBe(asked);
    expect(takeOver(level, asked, 'no-such-post', 100)).toBe(asked);
    const first = takeOver(level, asked, 'fu-camp', 100);
    expect(isPostTaken(first, 'fu-camp')).toBe(true);
    // 允许用掉了：下一处要重新求
    expect(first.grantAtMs).toBe(-1);
    expect(takeOver(level, first, 'jiameng-pass', 200)).toBe(first);
    // 回头点已经接手的：哪怕重新求到允许也没用
    const askedAgain = askGrant(first, 300);
    expect(isPostTaken(askedAgain, 'fu-camp')).toBe(true);
    expect(takeOver(level, askedAgain, 'fu-camp', 400)).toBe(askedAgain);
    // 按顺序接着走，一处一处接完
    let state = takeOver(level, askedAgain, 'jiameng-pass', 400);
    state = takeOver(level, askGrant(state, 2000), 'luo-city', 2100);
    state = takeOver(level, askGrant(state, 3000), 'chengdu', 3100);
    expect(isStepDone(level, state)).toBe(true);
  });

  it('autoplay 的每一步都给画面留够时间，而且远在允许过期之前', () => {
    expect(CHAIN_STEP_TIMING.autoplayStepMs).toBeLessThan(level.grantMs);
    expect(CHAIN_STEP_TIMING.autoplayStepMs).toBeGreaterThanOrEqual(
      Math.min(CHAIN_STEP_TIMING.grantAskMs, CHAIN_STEP_TIMING.takeoverMs),
    );
    const { at } = runAutoplay();
    expect(at + CHAIN_STEP_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('手指粗也点得到，点空处什么也不算', () => {
    for (const post of level.posts) {
      expect(postAt(level, post.x, post.y, 0)?.id).toBe(post.id);
      expect(postAt(level, post.x, post.y + post.radius + TAP_FORGIVE, TAP_FORGIVE)?.id).toBe(post.id);
      expect(postAt(level, post.x, post.y + post.radius + TAP_FORGIVE + 1, 0)).toBeUndefined();
    }
    expect(grantHit(level, level.grant.x, level.grant.y, 0)).toBe(true);
    expect(grantHit(level, level.grant.x, level.grant.y - level.grant.radius - 1, 0)).toBe(false);
    expect(grantHit(level, level.grant.x, level.grant.y - level.grant.radius + TAP_FORGIVE, TAP_FORGIVE)).toBe(
      true,
    );
    // 站在刘璋的营帐里，不会顺手点到哪处岗位
    expect(postAt(level, level.grant.x, level.grant.y, TAP_FORGIVE)).toBeUndefined();
    expect(postAt(level, 375, 700, 0)).toBeUndefined();
  });
});

describe('反客为主 · 故事与复习', () => {
  it('两幕：刘璋请他来帮忙 → 一处一处接下来；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('请');
    expect(entry.story[1]!.text).toContain('一处一处');
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择站在刘备的角度问：先把哪一步做稳 —— 正解是一处站稳再往北', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text.startsWith('先在一处站稳')).toBe(true);
    expect(entry.keyMoment.question).toContain('刘备');
    expect(entry.keyMoment.reveal).toContain('一步一步');
    // 另外两个选项不是"点了就错"，都要说清楚后果
    for (const option of options) {
      if (option.isCanonical) continue;
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('三十六计的登记信息：第 30 计 · 并战计（第 5 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 30, set: 5 });
    expect(entry.dynasty).toBe('东汉');
    expect(entry.yearApprox).toBe(211);
    expect(entry.figures).toContain('刘备');
    expect(entry.figures).toContain('刘璋');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('反客为主');
    expect(entry.source.quote).toBe('乘隙插足，扼其主机，渐之进也。');
    expect(entry.moral).toContain('一步一步');
    expect(entry.game.template).toBe('chain');
    expect(entry.game.stages[0]!.template).toBe('chain');
  });

  it('复习题：记忆题问刘璋为什么请他来、为什么一处一处来，迁移题落在"接手事情"', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer')!;
    expect(transfer.question).toContain('新班级');
    expect(transfer.explanation).toContain('一步一步');
  });

  it('适龄化：没有交战、没有一处流血 —— 只有营帐、关隘、城池与接手', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战', '夺']) expect(prose).not.toContain(word);
    // 落点是"一步一步来"，不是"抢过来"
    expect(prose).toContain('一步一步');
    const scriptText = level.hint + level.posts.map((post) => post.label).join('');
    for (const word of ['血', '死', '杀', '伤']) expect(scriptText).not.toContain(word);
  });
});

describe('反客为主 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('fanke-weizhu', 'en')!;
    expect(merged.title).toBe('The Guest Becomes the Host');
    expect(merged.game.stages[0]!.levelScript).toMatchObject({
      hint: 'Ask, then take the post',
      posts: [{ label: 'Fu Camp' }, { label: 'Jiameng Pass' }, { label: 'Luo City' }, { label: 'Chengdu' }],
    });
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
    expect(merged.moral).toBe(
      'Take it one step at a time — first get a firm footing, then take the work in hand.',
    );
  });
});
