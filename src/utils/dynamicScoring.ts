import { CHILDREN_CONFIG, DAYS, STUDY_TARGET_TOTALS } from '../constants';
import {
  ChildData,
  ChildKey,
  ChildrenDataMap,
  DynamicScoreProposal,
  DynamicScoreProposalChild,
  DynamicScoreProposalItem
} from '../types';
import { getEffectiveChildConfig } from './scoreUtils';

const MIN_SUBJECT_SCORE = 5;
const MAX_SUBJECT_SCORE = 22;

interface ScoringGroup {
  key: string;
  itemIds: string[];
  weight: number;
  count: number;
  pairedLabel?: string;
}

export function computeCumulativeStudyCounts(
  childKey: ChildKey,
  childData: ChildData,
  beforeWeekId: string
): Record<string, number> {
  const config = CHILDREN_CONFIG[childKey];
  const counts: Record<string, number> = {};
  config.studyItems.forEach((item) => {
    counts[item.id] = 0;
  });

  const weeks = childData.weeks || {};
  Object.entries(weeks).forEach(([wId, weekRecord]) => {
    if (wId >= beforeWeekId) return;
    config.studyItems.forEach((item) => {
      const row = weekRecord?.checks?.[item.id];
      if (!row) return;
      DAYS.forEach(({ key }) => {
        const st = row[key] || 'NONE';
        if (st !== 'NONE') {
          counts[item.id] = (counts[item.id] || 0) + 1;
        }
      });
    });
  });

  return counts;
}

export function calculateDynamicStudyScores(
  childKey: ChildKey,
  childData: ChildData,
  beforeWeekId: string
): DynamicScoreProposalChild {
  const effectiveCfg = getEffectiveChildConfig(childKey, childData);
  const targetTotal = STUDY_TARGET_TOTALS[childKey];
  const counts = computeCumulativeStudyCounts(childKey, childData, beforeWeekId);
  const totalHistoricalChecks = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const previousTotal = effectiveCfg.studyItems.reduce((sum, it) => sum + it.score, 0);

  const groups: ScoringGroup[] = [];
  if (childKey === 'suhyun') {
    const plusCount = counts.sh_plus || 0;
    const topCount = counts.sh_top || 0;
    groups.push({
      key: 'sh_plus_top',
      itemIds: ['sh_plus', 'sh_top'],
      weight: 2,
      count: plusCount + topCount,
      pairedLabel: `플러스·최상위 합산 ${plusCount + topCount}회 (동일 배점)`
    });
    effectiveCfg.studyItems
      .filter((it) => it.id !== 'sh_plus' && it.id !== 'sh_top')
      .forEach((it) => {
        groups.push({
          key: it.id,
          itemIds: [it.id],
          weight: 1,
          count: counts[it.id] || 0
        });
      });
  } else {
    effectiveCfg.studyItems.forEach((it) => {
      groups.push({
        key: it.id,
        itemIds: [it.id],
        weight: 1,
        count: counts[it.id] || 0
      });
    });
  }

  // Sort groups by cumulative count ascending (lowest count first -> highest priority for higher score)
  groups.sort((a, b) => a.count - b.count);

  const avgCount = groups.reduce((s, g) => s + g.count, 0) / Math.max(1, groups.length);
  const alpha = Math.max(3, avgCount * 0.6);

  const rawWeights = groups.map((g) => 1 / (g.count + alpha));
  const weightedSum = groups.reduce((s, g, idx) => s + g.weight * rawWeights[idx], 0);

  const continuousScores = groups.map((_, idx) => {
    const raw = (rawWeights[idx] / weightedSum) * targetTotal;
    return Math.min(MAX_SUBJECT_SCORE, Math.max(MIN_SUBJECT_SCORE, raw));
  });

  const scores = continuousScores.map((val) => Math.floor(val));

  const getSum = () => groups.reduce((s, g, idx) => s + g.weight * scores[idx], 0);
  const respectsMonotonicity = (idx: number, nextVal: number): boolean => {
    for (let j = 0; j < groups.length; j += 1) {
      if (j === idx) continue;
      if (groups[j].count < groups[idx].count && scores[j] < nextVal) return false;
      if (groups[j].count > groups[idx].count && scores[j] > nextVal) return false;
    }
    return true;
  };

  let guard = 0;
  while (getSum() < targetTotal && guard < 200) {
    guard += 1;
    const diff = targetTotal - getSum();
    const candidates = groups
      .map((g, idx) => ({
        idx,
        weight: g.weight,
        count: g.count,
        frac: continuousScores[idx] - scores[idx]
      }))
      .filter(
        (c) =>
          c.weight <= diff &&
          scores[c.idx] + 1 <= MAX_SUBJECT_SCORE &&
          respectsMonotonicity(c.idx, scores[c.idx] + 1)
      )
      .sort((a, b) => a.count - b.count || b.frac - a.frac);

    if (candidates.length > 0) {
      scores[candidates[0].idx] += 1;
    } else if (diff === 1) {
      // Handle +1 parity when a paired weight-2 group is the lowest-count group:
      // increment a weight-2 group (+2) and decrement a weight-1 group (-1) => net +1
      const pairIdx = groups.findIndex(
        (g, idx) => g.weight === 2 && scores[idx] + 1 <= MAX_SUBJECT_SCORE
      );
      const singleIdx = groups
        .map((g, idx) => ({ g, idx }))
        .filter(({ g, idx }) => g.weight === 1 && scores[idx] - 1 >= MIN_SUBJECT_SCORE)
        .sort((a, b) => b.g.count - a.g.count)[0]?.idx;
      if (pairIdx !== -1 && singleIdx !== undefined) {
        scores[pairIdx] += 1;
        scores[singleIdx] -= 1;
      } else {
        const fallbackIdx = groups.findIndex(
          (g, idx) => g.weight === 1 && scores[idx] + 1 <= MAX_SUBJECT_SCORE
        );
        if (fallbackIdx === -1) break;
        scores[fallbackIdx] += 1;
      }
    } else {
      const anyUp = groups.findIndex(
        (g, idx) => g.weight <= diff && scores[idx] + 1 <= MAX_SUBJECT_SCORE
      );
      if (anyUp === -1) break;
      scores[anyUp] += 1;
    }
  }

  while (getSum() > targetTotal && guard < 400) {
    guard += 1;
    const diff = getSum() - targetTotal;
    const candidates = groups
      .map((g, idx) => ({
        idx,
        weight: g.weight,
        count: g.count,
        frac: continuousScores[idx] - scores[idx]
      }))
      .filter(
        (c) =>
          c.weight <= diff &&
          scores[c.idx] - 1 >= MIN_SUBJECT_SCORE &&
          respectsMonotonicity(c.idx, scores[c.idx] - 1)
      )
      .sort((a, b) => b.count - a.count || a.frac - b.frac);

    if (candidates.length > 0) {
      scores[candidates[0].idx] -= 1;
    } else if (diff === 1) {
      const pairIdx = groups.findIndex(
        (g, idx) => g.weight === 2 && scores[idx] - 1 >= MIN_SUBJECT_SCORE
      );
      const singleIdx = groups
        .map((g, idx) => ({ g, idx }))
        .filter(({ g, idx }) => g.weight === 1 && scores[idx] + 1 <= MAX_SUBJECT_SCORE)
        .sort((a, b) => a.g.count - b.g.count)[0]?.idx;
      if (pairIdx !== -1 && singleIdx !== undefined) {
        scores[pairIdx] -= 1;
        scores[singleIdx] += 1;
      } else {
        const fallbackIdx = groups.findIndex(
          (g, idx) => g.weight === 1 && scores[idx] - 1 >= MIN_SUBJECT_SCORE
        );
        if (fallbackIdx === -1) break;
        scores[fallbackIdx] -= 1;
      }
    } else {
      const anyDown = groups.findIndex(
        (g, idx) => g.weight <= diff && scores[idx] - 1 >= MIN_SUBJECT_SCORE
      );
      if (anyDown === -1) break;
      scores[anyDown] -= 1;
    }
  }

  const proposedScores: Record<string, number> = {};
  const groupByItemId: Record<string, ScoringGroup> = {};
  groups.forEach((g, idx) => {
    g.itemIds.forEach((id) => {
      proposedScores[id] = scores[idx];
      groupByItemId[id] = g;
    });
  });

  const items: DynamicScoreProposalItem[] = effectiveCfg.studyItems.map((it) => {
    const grp = groupByItemId[it.id];
    return {
      itemId: it.id,
      name: it.name,
      previousScore: it.score,
      proposedScore: proposedScores[it.id] ?? it.score,
      completedCount: counts[it.id] || 0,
      pairedLabel: grp?.pairedLabel
    };
  });

  return {
    totalTarget: targetTotal,
    previousTotal,
    totalHistoricalChecks,
    items,
    proposedScores
  };
}

export function generateWeeklyDynamicScoreProposal(
  childrenData: ChildrenDataMap,
  targetWeekId: string,
  options?: { requirePastData?: boolean }
): DynamicScoreProposal | null {
  const suhyunProposal = calculateDynamicStudyScores('suhyun', childrenData.suhyun, targetWeekId);
  const dahyunProposal = calculateDynamicStudyScores('dahyun', childrenData.dahyun, targetWeekId);

  const requirePast = options?.requirePastData !== false;
  if (
    requirePast &&
    suhyunProposal.totalHistoricalChecks === 0 &&
    dahyunProposal.totalHistoricalChecks === 0
  ) {
    return null;
  }

  return {
    id: `dyn_${targetWeekId}_${Date.now()}`,
    weekId: targetWeekId,
    generatedAt: Date.now(),
    status: 'pending',
    children: {
      suhyun: suhyunProposal,
      dahyun: dahyunProposal
    }
  };
}
