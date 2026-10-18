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

type RawSave = Record<string, unknown>;

/**
 * 存档迁移链：{ 旧版本号: 升到下一版的函数 }。
 *
 * 现在只有 v1，所以这张表是空的 —— 但流程先立起来：
 * 以后给 SaveData 加字段时，把 SAVE_SCHEMA_VERSION 改成 2，并在这里补一条
 * `1: (data) => ({ ...data, 新字段: 默认值 })`。老玩家的星星与复习计划会被
 * **升级**而不是清空（旧实现是"版本不等就 emptySave"，升级一次等于清零一次）。
 *
 * 没有对应迁移函数的老版本一律降级为空档：宁可少数据，也不能拿读不懂的结构去炸界面。
 */
const MIGRATIONS: Record<number, (data: RawSave, now: number) => RawSave> = {};

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 0..3 的星星 / 评级；坏值按 0 处理，别让 NaN 流进界面 */
function asStars(value: unknown): 0 | 1 | 2 | 3 {
  const n = finiteNumber(value, 0);
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

/**
 * 单条进度的体检：**结构坏掉只丢这一条**，不连累整份存档。
 * 以前这里是直接 `value.entryId`：一条 null 就能让读档在 IndexedDB 回调里抛异常，
 * init 的 promise 永远不 resolve，大厅一直显示 0 星。
 */
function sanitizeEntry(entryId: string, value: unknown): EntryProgress | null {
  if (!isRecord(value)) return null;
  const review = isRecord(value.review)
    ? {
        level: finiteNumber(value.review.level, 0),
        dueAt: typeof value.review.dueAt === 'number' ? value.review.dueAt : null,
        lastGrade:
          typeof value.review.lastGrade === 'number' ? asStars(value.review.lastGrade) : null,
        reviews: finiteNumber(value.review.reviews, 0),
      }
    : createReviewState();
  return {
    entryId,
    stars: asStars(value.stars),
    completions: Math.max(0, finiteNumber(value.completions, 0)),
    lastPlayedAt: typeof value.lastPlayedAt === 'number' ? value.lastPlayedAt : null,
    review,
  };
}

/**
 * 存档迁移：现在写几乎零成本，等有用户数据了再补就是灾难。
 * 规则：从版本 0 开始逐级跑 MIGRATIONS，跑到当前版本；缺迁移函数或来自未来版本 → 空档。
 */
export function migrate(raw: unknown, now: number): SaveData {
  if (!isRecord(raw)) return emptySave(now);
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  // 用新版玩过、又装回旧版：结构解释不了，不猜
  if (version > SAVE_SCHEMA_VERSION) return emptySave(now);

  let data: RawSave = raw;
  for (let from = version; from < SAVE_SCHEMA_VERSION; from += 1) {
    const step = MIGRATIONS[from];
    if (!step) return emptySave(now);
    data = step(data, now);
  }

  if (!isRecord(data.allusions)) return emptySave(now);
  // 键才是内容 id 的权威；老存档里的 entryId 字段可能缺、也可能过期
  const allusions: SaveData['allusions'] = {};
  for (const [id, value] of Object.entries(data.allusions)) {
    const entry = sanitizeEntry(id, value);
    if (entry !== null) allusions[id] = entry;
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    allusions,
    updatedAt: finiteNumber(data.updatedAt, now),
  };
}

export class ProgressManager {
  private readonly store: ProgressStore;
  private readonly clock: () => number;
  private data: SaveData;
  private loading: Promise<SaveData> | null = null;

  constructor(store: ProgressStore, clock: () => number, now = clock()) {
    this.store = store;
    this.clock = clock;
    this.data = emptySave(now);
  }

  /**
   * 读档只做一次（single-flight）：界面可能从多个地方 await 它，
   * 重复读会把"刚写进去的进度"用旧快照盖掉。
   */
  init(): Promise<SaveData> {
    this.loading ??= (async () => {
      let raw: unknown;
      try {
        raw = await this.store.load();
      } catch {
        raw = null;
      }
      this.data = migrate(raw, this.clock());
      return this.data;
    })();
    return this.loading;
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
