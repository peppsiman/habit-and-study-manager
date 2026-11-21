export type ChildKey = 'suhyun' | 'dahyun';
export type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
export type CheckStatus = 'NONE' | 'WEEKDAY' | 'WEEKEND';
export type StampMode = 'CYCLE' | 'WEEKDAY' | 'WEEKEND';
export type TabKey = 'board' | 'youtube' | 'sticker' | 'settings';
export type StickerGiver = 'MOM' | 'DAD';
export type YoutubeLogType = 'WATCH' | 'MAKEUP_ADD' | 'MAKEUP_CANCEL';

export interface EvaluationItem {
  id: string;
  name: string;
  shortName?: string;
  subItems?: string[];
  ruleNote?: string;
  score: number;
  category: 'STUDY' | 'HABIT';
}

export interface ChildConfig {
  id: ChildKey;
  name: string;
  info: string;
  themeColor: 'blue' | 'rose';
  dailyMaxScore: number;
  weeklyMaxScore: number;
  studyItems: EvaluationItem[];
  habitItems: EvaluationItem[];
}

export interface YoutubeLog {
  id: string;
  type: YoutubeLogType;
  minutes: number;
  memo: string;
  timestamp: string;
  relatedItem?: {
    itemId: string;
    dayKey: DayKey;
  };
}

export interface PraiseSticker {
  id: number;
  giver: StickerGiver;
  reason: string;
  date: string;
}

export interface ChildData {
  weekTitle: string;
  checks: Record<string, Record<DayKey, CheckStatus>>;
  clothesSubChecks: Record<DayKey, Record<string, boolean>>;
  usedYoutubeMinutes: number;
  youtubeLogs: YoutubeLog[];
  stickers: PraiseSticker[];
  stickerRound: number;
  rewardGoal: string;
}

export type ChildrenDataMap = Record<ChildKey, ChildData>;

export interface ChildTimerState {
  targetMinutes: number;
  remainingSeconds: number;
  isRunning: boolean;
  baseRemainingSeconds?: number;
  startedAt?: number | null;
  isAlarmRinging?: boolean;
  // Legacy fields kept optional for smooth migration from old KV/localStorage payloads
  elapsedSeconds?: number;
  baseElapsedSeconds?: number;
}

export type TimersMap = Record<ChildKey, ChildTimerState>;

export type SyncStatus = 'loading' | 'synced' | 'syncing' | 'local_only' | 'error';
export type CloudStorageType = 'kv' | 'd1' | 'local-file' | 'none';

export interface CloudAppState {
  version: number;
  updatedAt: number;
  childrenData: ChildrenDataMap;
  parentPin: string;
  timers: TimersMap;
}

export interface CloudStateApiResponse {
  ok: boolean;
  configured: boolean;
  storageType: CloudStorageType;
  state: CloudAppState | null;
  error?: string;
}

export interface ScoreSummary {
  weekdayScore: number;
  weekendMakeupScore: number;
  totalScore: number;
  incompletePotentialScore: number;
  incompleteCount: number;
  dailyScores: Record<DayKey, number>;
  dailyMakeups: Record<DayKey, number>;
  totalEarnedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export interface ToastState {
  msg: string;
  type: 'info' | 'success' | 'warning';
}
