import { SAVE_SCHEMA_VERSION } from '@chags/game-kit';
import type { EntryProgress, ProgressStore, SaveData } from '@chags/game-kit';
import { createReviewState, nextReview } from './review';

export function emptySave(now: number): SaveData {
  return { schemaVersion: SAVE_SCHEMA_VERSION, allusions: {}, updatedAt: now };
}

function emptyProgress(entryId: string): EntryProgress {
  return {
    entryId,
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
  // 老存档里每个进度对象带着旧字段名 allusionId：补上 entryId（键才是权威），
  // 否则界面会拿到一个"没有 id 的进度"。键是内容 id，读档照旧。
  const allusions: SaveData['allusions'] = {};
  for (const [id, value] of Object.entries(data.allusions)) {
    allusions[id] = value.entryId === id ? value : { ...value, entryId: id };
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    allusions,
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

  get(entryId: string): EntryProgress {
    return this.data.allusions[entryId] ?? emptyProgress(entryId);
  }

  /** 通关：记录星星（只增不减，对小朋友永远正向）与复习计划 */
  async recordCompletion(
    entryId: string,
    stars: 0 | 1 | 2 | 3,
    grade: 0 | 1 | 2 | 3,
  ): Promise<EntryProgress> {
    const now = this.clock();
    const prev = this.get(entryId);
    const next: EntryProgress = {
      ...prev,
      stars: Math.max(prev.stars, stars) as 0 | 1 | 2 | 3,
      completions: prev.completions + 1,
      lastPlayedAt: now,
      review: nextReview(prev.review, grade, now),
    };
    this.data = {
      ...this.data,
      allusions: { ...this.data.allusions, [entryId]: next },
      updatedAt: now,
    };
    await this.store.save(this.data);
    return next;
  }

  /** 复习关卡的评分（不影响星星） */
  async recordReview(entryId: string, grade: 0 | 1 | 2 | 3): Promise<EntryProgress> {
    const now = this.clock();
    const prev = this.get(entryId);
    const next: EntryProgress = {
      ...prev,
      lastPlayedAt: now,
      review: nextReview(prev.review, grade, now),
    };
    this.data = {
      ...this.data,
      allusions: { ...this.data.allusions, [entryId]: next },
      updatedAt: now,
    };
    await this.store.save(this.data);
    return next;
  }

  /** 到期待复习的内容条目（历史长卷 / 复习中心的输入） */
  due(entryIds: string[]): string[] {
    const now = this.clock();
    return entryIds.filter((id) => {
      const p = this.data.allusions[id];
      return p !== undefined && p.review.dueAt !== null && p.review.dueAt <= now;
    });
  }
}
