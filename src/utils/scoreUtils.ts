import { CHILDREN_CONFIG, CLOTHES_SUB_ITEMS, DAYS } from '../constants';
import {
  CheckStatus,
  ChildConfig,
  ChildData,
  ChildKey,
  DayKey,
  EvaluationItem,
  PraiseSticker,
  ReadingRecordingMeta,
  ScoreSummary,
  WeeklyRecord
} from '../types';
import { getWeekIdForTimestamp } from './weekUtils';

export const getDefaultItemScores = (childKey: ChildKey): Record<string, number> => {
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  return allItems.reduce((acc, item) => {
    acc[item.id] = item.score;
    return acc;
  }, {} as Record<string, number>);
};

export const sanitizeItemScore = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(200, Math.max(0, Math.round(value)));
  }
  return fallback;
};

export const getEffectiveChildConfig = (
  childKey: ChildKey,
  childData?: ChildData
): ChildConfig => {
  const base = CHILDREN_CONFIG[childKey];
  const customScores = childData?.itemScores;

  const applyScore = (item: EvaluationItem): EvaluationItem => {
    const nextScore = sanitizeItemScore(customScores?.[item.id], item.score);
    if (item.id === 'hb_clothes_all') {
      return {
        ...item,
        score: nextScore,
        ruleNote: `8가지 세부 항목을 모두 완료해야 ${nextScore}점 인정`
      };
    }
    return {
      ...item,
      score: nextScore
    };
  };

  const studyItems = base.studyItems.map(applyScore);
  const habitItems = base.habitItems.map(applyScore);
  const dailyMaxScore =
    studyItems.reduce((sum, it) => sum + it.score, 0) +
    habitItems.reduce((sum, it) => sum + it.score, 0);

  return {
    ...base,
    studyItems,
    habitItems,
    dailyMaxScore,
    weeklyMaxScore: dailyMaxScore * 5
  };
};

export const getCellEarnedScore = (
  item: EvaluationItem,
  dayKey: DayKey,
  weekRecord?: WeeklyRecord
): number => {
  const snap = weekRecord?.earnedScores?.[item.id]?.[dayKey];
  if (typeof snap === 'number' && Number.isFinite(snap) && snap >= 0) {
    return snap;
  }
  return item.score;
};

export const createEmptyWeeklyRecord = (childKey: ChildKey, weekId: string): WeeklyRecord => {
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const checks: Record<string, Record<DayKey, CheckStatus>> = {};
  const clothesSubChecks = {} as Record<DayKey, Record<string, boolean>>;

  allItems.forEach((item) => {
    checks[item.id] = {
      MON: 'NONE',
      TUE: 'NONE',
      WED: 'NONE',
      THU: 'NONE',
      FRI: 'NONE'
    };
  });

  DAYS.forEach(({ key }) => {
    clothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = false;
      return acc;
    }, {} as Record<string, boolean>);
  });

  return {
    weekId,
    checks,
    earnedScores: {},
    readingRecordings: {},
    clothesSubChecks,
    usedYoutubeMinutes: 0,
    youtubeLogs: []
  };
};

export const getWeeklyRecord = (
  childKey: ChildKey,
  childData: ChildData | undefined,
  weekId: string
): WeeklyRecord => {
  const existing = childData?.weeks?.[weekId];
  if (existing) return existing;
  return createEmptyWeeklyRecord(childKey, weekId);
};

function normalizeWeeklyRecord(
  childKey: ChildKey,
  weekId: string,
  rawWeek: Partial<WeeklyRecord> | undefined,
  itemScores: Record<string, number>
): WeeklyRecord {
  const empty = createEmptyWeeklyRecord(childKey, weekId);
  if (!rawWeek || typeof rawWeek !== 'object') return empty;

  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const validStatuses: CheckStatus[] = ['NONE', 'WEEKDAY', 'WEEKEND'];

  const legacyReadingKey = childKey === 'suhyun' ? 'sh_reading' : 'dh_reading';
  const rawChecks = rawWeek.checks || {};
  const rawEarned = rawWeek.earnedScores || {};

  const safeChecks: Record<string, Record<DayKey, CheckStatus>> = {};
  const safeEarnedScores: Record<string, Partial<Record<DayKey, number>>> = {};

  allItems.forEach((item) => {
    const isReadingMigrated = item.id === 'hb_reading' && !rawChecks.hb_reading && Boolean(rawChecks[legacyReadingKey]);
    const sourceRow = (
      isReadingMigrated ? rawChecks[legacyReadingKey] : rawChecks[item.id]
    ) as Partial<Record<DayKey, CheckStatus>> | undefined;

    const rowChecks: Record<DayKey, CheckStatus> = {
      MON: sourceRow?.MON && validStatuses.includes(sourceRow.MON) ? sourceRow.MON : 'NONE',
      TUE: sourceRow?.TUE && validStatuses.includes(sourceRow.TUE) ? sourceRow.TUE : 'NONE',
      WED: sourceRow?.WED && validStatuses.includes(sourceRow.WED) ? sourceRow.WED : 'NONE',
      THU: sourceRow?.THU && validStatuses.includes(sourceRow.THU) ? sourceRow.THU : 'NONE',
      FRI: sourceRow?.FRI && validStatuses.includes(sourceRow.FRI) ? sourceRow.FRI : 'NONE'
    };
    safeChecks[item.id] = rowChecks;

    const savedEarnedRow = isReadingMigrated ? rawEarned[legacyReadingKey] : rawEarned[item.id];
    const earnedRow: Partial<Record<DayKey, number>> = {};
    DAYS.forEach(({ key }) => {
      if (rowChecks[key] !== 'NONE') {
        const rawSnap = savedEarnedRow?.[key];
        if (typeof rawSnap === 'number' && Number.isFinite(rawSnap) && rawSnap >= 0) {
          earnedRow[key] = isReadingMigrated ? Math.min(10, rawSnap) : rawSnap;
        } else {
          earnedRow[key] = itemScores[item.id] ?? item.score;
        }
      }
    });

    if (Object.keys(earnedRow).length > 0) {
      safeEarnedScores[item.id] = earnedRow;
    }
  });

  const safeClothesSubChecks = {} as Record<DayKey, Record<string, boolean>>;
  DAYS.forEach(({ key }) => {
    const savedDaySub = (rawWeek.clothesSubChecks?.[key] || {}) as Record<string, unknown>;
    const isCompleted = safeChecks.hb_clothes_all?.[key] !== 'NONE';
    safeClothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = typeof savedDaySub[sub] === 'boolean' ? (savedDaySub[sub] as boolean) : isCompleted;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const safeRecordings: Partial<Record<DayKey, ReadingRecordingMeta>> = {};
  if (rawWeek.readingRecordings && typeof rawWeek.readingRecordings === 'object') {
    DAYS.forEach(({ key }) => {
      const rec = rawWeek.readingRecordings?.[key];
      if (rec && typeof rec === 'object' && typeof rec.audioId === 'string' && rec.audioId.trim()) {
        safeRecordings[key] = {
          audioId: rec.audioId,
          mimeType: typeof rec.mimeType === 'string' ? rec.mimeType : 'audio/webm',
          durationSec:
            typeof rec.durationSec === 'number' && Number.isFinite(rec.durationSec)
              ? Math.max(0, Math.round(rec.durationSec))
              : 0,
          recordedAt:
            typeof rec.recordedAt === 'number' && Number.isFinite(rec.recordedAt)
              ? rec.recordedAt
              : Date.now()
        };
      }
    });
  }

  return {
    weekId,
    checks: safeChecks,
    earnedScores: safeEarnedScores,
    readingRecordings: safeRecordings,
    clothesSubChecks: safeClothesSubChecks,
    usedYoutubeMinutes:
      typeof rawWeek.usedYoutubeMinutes === 'number' && !isNaN(rawWeek.usedYoutubeMinutes)
        ? Math.max(0, rawWeek.usedYoutubeMinutes)
        : 0,
    youtubeLogs: Array.isArray(rawWeek.youtubeLogs) ? rawWeek.youtubeLogs : []
  };
}

export const freezeEarnedScoresForChild = (
  childKey: ChildKey,
  childData: ChildData
): Record<string, WeeklyRecord> => {
  const preChangeConfig = getEffectiveChildConfig(childKey, childData);
  const allItems = [...preChangeConfig.studyItems, ...preChangeConfig.habitItems];
  const updatedWeeks: Record<string, WeeklyRecord> = {};

  Object.entries(childData.weeks || {}).forEach(([wId, weekRecord]) => {
    const frozenEarned: Record<string, Partial<Record<DayKey, number>>> = {};
    allItems.forEach((item) => {
      const itemChecks = weekRecord.checks?.[item.id];
      const dayMap: Partial<Record<DayKey, number>> = {};
      DAYS.forEach(({ key }) => {
        const status: CheckStatus = itemChecks?.[key] || 'NONE';
        if (status !== 'NONE') {
          dayMap[key] = getCellEarnedScore(item, key, weekRecord);
        }
      });
      if (Object.keys(dayMap).length > 0) {
        frozenEarned[item.id] = dayMap;
      }
    });
    updatedWeeks[wId] = {
      ...weekRecord,
      earnedScores: frozenEarned
    };
  });

  return updatedWeeks;
};

export const createInitialChildData = (
  childKey: ChildKey,
  currentWeekId = getWeekIdForTimestamp()
): ChildData => {
  const initialWeek = createEmptyWeeklyRecord(childKey, currentWeekId);

  const sampleStickers: PraiseSticker[] = [
    { id: 1, giver: 'MOM', reason: '잠바·가방·태권도복까지 옷 정리 스스로 완벽히 완료!', date: '11/02' },
    { id: 2, giver: 'DAD', reason: '주말에 밀린 수학 문제집 끝까지 다 풀기', date: '11/05' },
    { id: 3, giver: 'MOM', reason: '식사 후 식탁 정리 도와주기', date: '11/08' },
    { id: 4, giver: 'DAD', reason: '남매끼리 사이좋게 배려하고 양보하기', date: '11/11' },
    { id: 5, giver: 'MOM', reason: '학교 준비물 미리미리 완벽히 챙기기', date: '11/14' }
  ];

  return {
    weeks: {
      [currentWeekId]: initialWeek
    },
    itemScores: getDefaultItemScores(childKey),
    stickers: sampleStickers,
    stickerRound: 1,
    rewardGoal: '상품은 검토 중...'
  };
};

export const normalizeChildData = (
  childKey: ChildKey,
  rawData: unknown,
  currentWeekId = getWeekIdForTimestamp()
): ChildData => {
  const fallback = createInitialChildData(childKey, currentWeekId);
  if (!rawData || typeof rawData !== 'object') return fallback;

  const data = rawData as Partial<ChildData>;
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];

  const safeItemScores: Record<string, number> = {};
  allItems.forEach((item) => {
    safeItemScores[item.id] = sanitizeItemScore(data.itemScores?.[item.id], item.score);
  });

  const safeWeeks: Record<string, WeeklyRecord> = {};

  if (data.weeks && typeof data.weeks === 'object') {
    Object.entries(data.weeks).forEach(([wId, rawWeek]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(wId) && rawWeek && typeof rawWeek === 'object') {
        safeWeeks[wId] = normalizeWeeklyRecord(childKey, wId, rawWeek, safeItemScores);
      }
    });
  } else if (data.checks && typeof data.checks === 'object') {
    // Migrate legacy v3 flat ChildData into weeks[currentWeekId]
    safeWeeks[currentWeekId] = normalizeWeeklyRecord(
      childKey,
      currentWeekId,
      {
        weekId: currentWeekId,
        checks: data.checks,
        earnedScores: data.earnedScores,
        clothesSubChecks: data.clothesSubChecks,
        usedYoutubeMinutes: data.usedYoutubeMinutes,
        youtubeLogs: data.youtubeLogs
      },
      safeItemScores
    );
  }

  if (!safeWeeks[currentWeekId]) {
    safeWeeks[currentWeekId] = createEmptyWeeklyRecord(childKey, currentWeekId);
  }

  return {
    weeks: safeWeeks,
    itemScores: safeItemScores,
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
  childData: ChildData | undefined,
  weekId = getWeekIdForTimestamp()
): ScoreSummary => {
  const config = getEffectiveChildConfig(childKey, childData);
  const weekRecord = getWeeklyRecord(childKey, childData, weekId);
  const allItems = [...config.studyItems, ...config.habitItems];

  let weekdayScore = 0;
  let weekendMakeupScore = 0;
  let incompletePotentialScore = 0;
  let incompleteCount = 0;

  const dailyScores: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
  const dailyMakeups: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
  const effectiveDailyMaxScores: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };

  allItems.forEach((item) => {
    const itemChecks = weekRecord.checks?.[item.id];
    const isReadingAudio = item.scoringType === 'READING_AUDIO';

    DAYS.forEach(({ key }) => {
      const status: CheckStatus = itemChecks?.[key] || 'NONE';
      if (status === 'WEEKDAY') {
        const pts = getCellEarnedScore(item, key, weekRecord);
        weekdayScore += pts;
        dailyScores[key] += pts;
        effectiveDailyMaxScores[key] += isReadingAudio ? Math.max(item.score, pts) : pts;
      } else if (status === 'WEEKEND') {
        const pts = getCellEarnedScore(item, key, weekRecord);
        weekendMakeupScore += pts;
        dailyScores[key] += pts;
        dailyMakeups[key] += pts;
        effectiveDailyMaxScores[key] += isReadingAudio ? Math.max(item.score, pts) : pts;
      } else {
        incompletePotentialScore += item.score;
        incompleteCount += 1;
        effectiveDailyMaxScores[key] += item.score;
      }
    });
  });

  const totalScore = weekdayScore + weekendMakeupScore;
  const effectiveWeeklyMaxScore = DAYS.reduce(
    (sum, d) => sum + effectiveDailyMaxScores[d.key],
    0
  );
  const totalEarnedMinutes = totalScore;
  const usedMinutes = weekRecord.usedYoutubeMinutes || 0;
  const remainingMinutes = Math.max(0, totalEarnedMinutes - usedMinutes);

  return {
    weekdayScore,
    weekendMakeupScore,
    totalScore,
    incompletePotentialScore,
    incompleteCount,
    dailyScores,
    dailyMakeups,
    effectiveDailyMaxScores,
    effectiveWeeklyMaxScore,
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
