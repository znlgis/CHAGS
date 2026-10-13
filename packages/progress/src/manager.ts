import { SAVE_SCHEMA_VERSION } from '@chags/game-kit';
import type { AllusionProgress, ProgressStore, SaveData } from '@chags/game-kit';
import { createReviewState, nextReview } from './review';

export function emptySave(now: number): SaveData {
  return { schemaVersion: SAVE_SCHEMA_VERSION, allusions: {}, updatedAt: now };
}

function emptyProgress(allusionId: string): AllusionProgress {
  return {
    allusionId,
    stars: 0,
    completions: 0,
    lastPlayedAt: null,
    review: createReviewState(),
  };
}

/**
 * 存档迁移：现在写几乎零成本，等有用户数据了再补就是灾难。
 * 老存档（无 schemaVersion）一律降级为空档，避免脏数据炸掉游戏。
 */
export function migrate(raw: unknown, now: number): SaveData {
  if (!raw || typeof raw !== 'object') return emptySave(now);
  const data = raw as Partial<SaveData>;
  if (data.schemaVersion !== SAVE_SCHEMA_VERSION) return emptySave(now);
  if (!data.allusions || typeof data.allusions !== 'object') return emptySave(now);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    allusions: data.allusions,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now,
  };
}

export class ProgressManager {
  private readonly store: ProgressStore;
  private readonly clock: () => number;
  private data: SaveData;

  constructor(store: ProgressStore, clock: () => number, now = clock()) {
    this.store = store;
    this.clock = clock;
    this.data = emptySave(now);
  }

  async init(): Promise<SaveData> {
    this.data = migrate(await this.store.load(), this.clock());
    return this.data;
  }

  snapshot(): SaveData {
    return this.data;
  }

  get(allusionId: string): AllusionProgress {
    return this.data.allusions[allusionId] ?? emptyProgress(allusionId);
  }

  /** 通关：记录星星（只增不减，对小朋友永远正向）与复习计划 */
  async recordCompletion(
    allusionId: string,
    stars: 0 | 1 | 2 | 3,
    grade: 0 | 1 | 2 | 3,
  ): Promise<AllusionProgress> {
    const now = this.clock();
    const prev = this.get(allusionId);
    const next: AllusionProgress = {
      ...prev,
      stars: Math.max(prev.stars, stars) as 0 | 1 | 2 | 3,
      completions: prev.completions + 1,
      lastPlayedAt: now,
      review: nextReview(prev.review, grade, now),
    };
    this.data = {
      ...this.data,
      allusions: { ...this.data.allusions, [allusionId]: next },
      updatedAt: now,
    };
    await this.store.save(this.data);
    return next;
  }

  /** 复习关卡的评分（不影响星星） */
  async recordReview(allusionId: string, grade: 0 | 1 | 2 | 3): Promise<AllusionProgress> {
    const now = this.clock();
    const prev = this.get(allusionId);
    const next: AllusionProgress = {
      ...prev,
      lastPlayedAt: now,
      review: nextReview(prev.review, grade, now),
    };
    this.data = {
      ...this.data,
      allusions: { ...this.data.allusions, [allusionId]: next },
      updatedAt: now,
    };
    await this.store.save(this.data);
    return next;
  }

  /** 到期待复习的典故（历史长卷 / 复习中心的输入） */
  due(allusionIds: string[]): string[] {
    const now = this.clock();
    return allusionIds.filter((id) => {
      const p = this.data.allusions[id];
      return p !== undefined && p.review.dueAt !== null && p.review.dueAt <= now;
    });
  }
}
