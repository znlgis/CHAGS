import { getEntry } from '@chags/content/full';
import { ButcherLevelSchema } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import { KNIFE, PIECES, PUSH } from './layout';
import {
  angleGapDeg, isButcherComplete, isHintless, nickCount, pieceAt, pushOutcome,
} from './logic';

function levelOf(): ReturnType<typeof ButcherLevelSchema.parse> {
  const raw = getEntry('paoding');
  return ButcherLevelSchema.parse(raw!.game.stages[0]!.levelScript);
}

describe('庖丁解牛 · 关卡数据', () => {
  const level = levelOf();

  it('八块骨头，每一块都有自己的缝', () => {
    expect(level.pieces.map((p) => p.id)).toEqual(PIECES.map((p) => p.id));
    const angles = new Set(level.pieces.map((p) => p.grooveDeg));
    expect(angles.size).toBeGreaterThanOrEqual(6);
  });

  it('关卡数据与美术坐标一致 —— 画的那块和推的那块必须是同一块', () => {
    level.pieces.forEach((piece, index) => {
      expect({ x: piece.x, y: piece.y, w: piece.w, h: piece.h, grooveDeg: piece.grooveDeg })
        .toEqual({
          x: PIECES[index]!.x,
          y: PIECES[index]!.y,
          w: PIECES[index]!.w,
          h: PIECES[index]!.h,
          grooveDeg: PIECES[index]!.grooveDeg,
        });
    });
  });

  it('刀口一开始是新的：盲砍一下才多一个缺口', () => {
    expect(level.blindCuts).toBeGreaterThanOrEqual(1);
    expect(nickCount(0, 'blind-cut')).toBe(1);
    expect(nickCount(1, 'along')).toBe(1);
    expect(nickCount(1, 'wrong-way')).toBe(2);
  });

  it('最后三块不给提示，但还是推得开', () => {
    expect(level.blindTail).toBe(3);
    const opened = level.pieces.slice(0, level.pieces.length - level.blindTail).map((p) => p.id);
    expect(isHintless(level, opened)).toBe(true);
    // 再推掉一块，剩下的仍然不给提示
    expect(isHintless(level, [...opened, level.pieces[opened.length]!.id])).toBe(true);
    expect(isButcherComplete(level, level.pieces.map((p) => p.id))).toBe(true);
  });
});

describe('顺着缝推', () => {
  const level = levelOf();
  const head = level.pieces.find((p) => p.id === 'head')!;
  const ribs = level.pieces.find((p) => p.id === 'ribs')!;

  it('方向对得上就滑开', () => {
    expect(pushOutcome(head, { dx: 120, dy: 10 }, PUSH.toleranceDeg, PUSH.minDistance)).toBe('along');
    expect(pushOutcome(ribs, { dx: 0, dy: -120 }, PUSH.toleranceDeg, PUSH.minDistance)).toBe('along');
  });

  it('推反了、推横了都开不了（但也不算错）', () => {
    expect(pushOutcome(head, { dx: -120, dy: 0 }, PUSH.toleranceDeg, PUSH.minDistance)).toBe('wrong-way');
    expect(pushOutcome(ribs, { dx: 120, dy: 0 }, PUSH.toleranceDeg, PUSH.minDistance)).toBe('wrong-way');
  });

  it('只是点了一下、没拖动，什么都不发生', () => {
    expect(pushOutcome(head, { dx: 12, dy: 4 }, PUSH.toleranceDeg, PUSH.minDistance)).toBe('too-short');
  });

  it('角度差取的是最小夹角', () => {
    expect(angleGapDeg(350, 10)).toBe(20);
    expect(angleGapDeg(10, 350)).toBe(20);
    expect(angleGapDeg(0, 180)).toBe(180);
  });

  it('手指落在哪一块：按最近的算，宽容度让小朋友不用对准', () => {
    const haunch = PIECES.find((p) => p.id === 'haunch')!;
    expect(pieceAt(head.x, head.y, level)?.id).toBe('head');
    // 偏出去一点点，还是算这一块（小朋友对不准）
    expect(pieceAt(haunch.x + 34, haunch.y + 20, level)?.id).toBe('haunch');
    expect(pieceAt(375, 1240, level, 60)).toBeNull();
  });
});

describe('刀口的账', () => {
  it('顺着缝走十九年也不缺一个口子', () => {
    let nicks = 0;
    for (let i = 0; i < 50; i += 1) nicks = nickCount(nicks, 'along');
    expect(nicks).toBe(0);
  });
});

describe('刀口小图的位置', () => {
  it('画在牛身之外的高处，不挡着骨块，也不和解开的块挤在一起', () => {
    expect(KNIFE.y).toBeLessThan(400);
    expect(KNIFE.x).toBeLessThan(640);
  });
});
