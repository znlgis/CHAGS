import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const KEY = 'chags.playtime';
/** 连续玩到 20 分钟提醒休息一次（docs/技术方案.md §3.7 的承诺） */
export const REST_AFTER_SECONDS = 20 * 60;

interface DayRecord {
  /** 本地日期 YYYY-MM-DD */
  date: string;
  seconds: number;
  rounds: number;
  /** 今天的提醒已经显示过了（点过"知道啦"） */
  reminded: boolean;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

function empty(date = today()): DayRecord {
  return { date, seconds: 0, rounds: 0, reminded: false };
}

function read(): DayRecord {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return empty();
    const parsed = JSON.parse(raw) as Partial<DayRecord>;
    // 跨天了就重新算；字段缺了也不炸，按空档处理
    if (parsed.date !== today()) return empty();
    return {
      date: parsed.date ?? today(),
      seconds: typeof parsed.seconds === 'number' ? parsed.seconds : 0,
      rounds: typeof parsed.rounds === 'number' ? parsed.rounds : 0,
      reminded: parsed.reminded === true,
    };
  } catch {
    return empty();
  }
}

function write(record: DayRecord): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // 无痕模式写不了：提醒只在本次会话里生效
  }
}

/**
 * 今天的玩耍时长。只记"玩游戏的秒数"，不记任何可识别信息；
 * 大厅据此显示一次 20 分钟休息提醒（一天只提醒一次，点过就收起来）。
 */
export const usePlaytime = defineStore('playtime', () => {
  const record = ref<DayRecord>(read());

  const seconds = computed(() => record.value.seconds);
  const rounds = computed(() => record.value.rounds);
  /** 该提醒休息了吗 */
  const restDue = computed(
    () => !record.value.reminded && record.value.seconds >= REST_AFTER_SECONDS,
  );

  /** 每 30 秒由 PlayView 上报一次 */
  function addSeconds(amount: number): void {
    if (record.value.date !== today()) record.value = empty();
    record.value = { ...record.value, seconds: record.value.seconds + amount };
    write(record.value);
  }

  /** 每通关一局 +1（家长页"本周玩了几个典故"用） */
  function addRound(): void {
    if (record.value.date !== today()) record.value = empty();
    record.value = { ...record.value, rounds: record.value.rounds + 1 };
    write(record.value);
  }

  /** 点过"知道啦"：今天不再提醒 */
  function dismissRest(): void {
    record.value = { ...record.value, reminded: true };
    write(record.value);
  }

  return { seconds, rounds, restDue, addSeconds, addRound, dismissRest, REST_AFTER_SECONDS };
});
