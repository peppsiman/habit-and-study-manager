import { CHILDREN_CONFIG, CLOTHES_SUB_ITEMS, DAYS } from '../constants';
import { CheckStatus, ChildData, ChildKey, DayKey, PraiseSticker, ScoreSummary } from '../types';

export const createInitialChildData = (childKey: ChildKey): ChildData => {
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const checks: Record<string, Record<DayKey, CheckStatus>> = {};
  const clothesSubChecks = {} as Record<DayKey, Record<string, boolean>>;

  allItems.forEach((item, idx) => {
    checks[item.id] = {
      MON: 'WEEKDAY',
      TUE: idx % 4 === 0 ? 'WEEKEND' : 'WEEKDAY',
      WED: idx % 3 === 0 ? 'NONE' : 'WEEKDAY',
      THU: idx % 2 === 0 ? 'WEEKDAY' : 'NONE',
      FRI: 'NONE'
    };
  });

  DAYS.forEach(({ key }) => {
    const isCompleted = checks.hb_clothes_all?.[key] !== 'NONE';
    clothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = isCompleted;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const sampleStickers: PraiseSticker[] = [
    { id: 1, giver: 'MOM', reason: '잠바·가방·태권도복까지 옷 정리 스스로 완벽히 완료!', date: '11/02' },
    { id: 2, giver: 'DAD', reason: '주말에 밀린 수학 문제집 끝까지 다 풀기', date: '11/05' },
    { id: 3, giver: 'MOM', reason: '식사 후 식탁 정리 도와주기', date: '11/08' },
    { id: 4, giver: 'DAD', reason: '남매끼리 사이좋게 배려하고 양보하기', date: '11/11' },
    { id: 5, giver: 'MOM', reason: '학교 준비물 미리미리 완벽히 챙기기', date: '11/14' }
  ];

  return {
    weekTitle: '이번 주 (월~금 정규 & 주말 보충)',
    checks,
    clothesSubChecks,
    usedYoutubeMinutes: 30,
    youtubeLogs: [
      {
        id: 'init-log-1',
        type: 'WATCH',
        minutes: -30,
        memo: '토요일 오전 유튜브 시청',
        timestamp: '토요일 10:30'
      }
    ],
    stickers: sampleStickers,
    stickerRound: 1,
    rewardGoal: '상품은 검토 중...'
  };
};

export const normalizeChildData = (childKey: ChildKey, rawData: unknown): ChildData => {
  const fallback = createInitialChildData(childKey);
  if (!rawData || typeof rawData !== 'object') return fallback;

  const data = rawData as Partial<ChildData>;
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const safeChecks: Record<string, Record<DayKey, CheckStatus>> = {};

  const validStatuses: CheckStatus[] = ['NONE', 'WEEKDAY', 'WEEKEND'];

  allItems.forEach((item) => {
    const savedRow = (data.checks?.[item.id] || {}) as Partial<Record<DayKey, CheckStatus>>;
    safeChecks[item.id] = {
      MON: savedRow.MON && validStatuses.includes(savedRow.MON) ? savedRow.MON : fallback.checks[item.id].MON,
      TUE: savedRow.TUE && validStatuses.includes(savedRow.TUE) ? savedRow.TUE : fallback.checks[item.id].TUE,
      WED: savedRow.WED && validStatuses.includes(savedRow.WED) ? savedRow.WED : fallback.checks[item.id].WED,
      THU: savedRow.THU && validStatuses.includes(savedRow.THU) ? savedRow.THU : fallback.checks[item.id].THU,
      FRI: savedRow.FRI && validStatuses.includes(savedRow.FRI) ? savedRow.FRI : fallback.checks[item.id].FRI
    };
  });

  const safeClothesSubChecks = {} as Record<DayKey, Record<string, boolean>>;
  DAYS.forEach(({ key }) => {
    const savedDaySub = (data.clothesSubChecks?.[key] || {}) as Record<string, unknown>;
    const isCompleted = safeChecks.hb_clothes_all?.[key] !== 'NONE';
    safeClothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = typeof savedDaySub[sub] === 'boolean' ? (savedDaySub[sub] as boolean) : isCompleted;
      return acc;
    }, {} as Record<string, boolean>);
  });

  return {
    weekTitle: typeof data.weekTitle === 'string' ? data.weekTitle : fallback.weekTitle,
    checks: safeChecks,
    clothesSubChecks: safeClothesSubChecks,
    usedYoutubeMinutes:
      typeof data.usedYoutubeMinutes === 'number' && !isNaN(data.usedYoutubeMinutes)
        ? Math.max(0, data.usedYoutubeMinutes)
        : fallback.usedYoutubeMinutes,
    youtubeLogs: Array.isArray(data.youtubeLogs) ? data.youtubeLogs : fallback.youtubeLogs,
    stickers: Array.isArray(data.stickers) ? data.stickers : fallback.stickers,
    stickerRound:
      typeof data.stickerRound === 'number' && data.stickerRound >= 1 ? data.stickerRound : 1,
    rewardGoal:
      typeof data.rewardGoal === 'string' &&
      data.rewardGoal.trim() &&
      !data.rewardGoal.includes('닌텐도') &&
      !data.rewardGoal.includes('산리오')
        ? data.rewardGoal
        : fallback.rewardGoal
  };
};

export const computeChildScoreSummary = (
  childKey: ChildKey,
  childData: ChildData | undefined
): ScoreSummary => {
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];

  let weekdayScore = 0;
  let weekendMakeupScore = 0;
  let incompletePotentialScore = 0;
  let incompleteCount = 0;

  const dailyScores: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
  const dailyMakeups: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };

  allItems.forEach((item) => {
    const itemChecks = childData?.checks?.[item.id];
    DAYS.forEach(({ key }) => {
      const status: CheckStatus = itemChecks?.[key] || 'NONE';
      if (status === 'WEEKDAY') {
        weekdayScore += item.score;
        dailyScores[key] += item.score;
      } else if (status === 'WEEKEND') {
        weekendMakeupScore += item.score;
        dailyScores[key] += item.score;
        dailyMakeups[key] += item.score;
      } else {
        incompletePotentialScore += item.score;
        incompleteCount += 1;
      }
    });
  });

  const totalScore = weekdayScore + weekendMakeupScore;
  const totalEarnedMinutes = totalScore;
  const usedMinutes = childData?.usedYoutubeMinutes || 0;
  const remainingMinutes = Math.max(0, totalEarnedMinutes - usedMinutes);

  return {
    weekdayScore,
    weekendMakeupScore,
    totalScore,
    incompletePotentialScore,
    incompleteCount,
    dailyScores,
    dailyMakeups,
    totalEarnedMinutes,
    usedMinutes,
    remainingMinutes
  };
};

export function formatTimer(sec: number): string {
  const safeSec = Math.max(0, Number(sec) || 0);
  const m = String(Math.floor(safeSec / 60)).padStart(2, '0');
  const s = String(safeSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatMinutesReadable(mins: number): string {
  const safeMins = Math.max(0, Number(mins) || 0);
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
