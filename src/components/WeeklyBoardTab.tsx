import React, { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Filter,
  ListChecks,
  Lock,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Star,
  Table2
} from 'lucide-react';
import { DAYS } from '../constants';
import {
  AuthRole,
  ChildConfig,
  DayKey,
  EvaluationItem,
  ScoreSummary,
  StampMode,
  WeeklyRecord
} from '../types';
import { formatTimer, getCellEarnedScore } from '../utils/scoreUtils';
import { getKstParts, getWeekDayShortDate } from '../utils/weekUtils';

interface WeeklyBoardTabProps {
  currentConfig: ChildConfig;
  weekRecord: WeeklyRecord;
  selectedWeekId: string;
  scoreSummary: ScoreSummary;
  isParentMode: boolean;
  authRole: AuthRole;
  stampMode: StampMode;
  setStampMode: (mode: StampMode) => void;
  showIncompleteOnly: boolean;
  setShowIncompleteOnly: (val: boolean) => void;
  onCellToggle: (item: EvaluationItem, dayKey: DayKey, dayLabel: string) => void;
  onReadingScoreChange: (
    dayKey: DayKey,
    dayLabel: string,
    scoreValue: '' | '0' | '5' | '10'
  ) => void;
  onToggleReadingRecord: (dayKey: DayKey, dayLabel: string) => void;
  onToggleReadingPlay: (dayKey: DayKey) => void;
  recordingDayKey: DayKey | null;
  recordingElapsedSec: number;
  isUploadingAudio: boolean;
  playingAudioId: string | null;
  onBulkDayComplete: (dayKey: DayKey, dayLabel: string, targetStatus?: 'WEEKDAY' | 'WEEKEND') => void;
  onOpenClothesModal: (dayKey: DayKey, dayLabel: string) => void;
  onResetWeeklyBoard: () => void;
  onOpenLogin: () => void;
}

function getDefaultMobileDayKey(): DayKey {
  const { dayOfWeek } = getKstParts();
  switch (dayOfWeek) {
    case 1:
      return 'MON';
    case 2:
      return 'TUE';
    case 3:
      return 'WED';
    case 4:
      return 'THU';
    case 5:
      return 'FRI';
    default:
      return 'MON';
  }
}

export const WeeklyBoardTab: React.FC<WeeklyBoardTabProps> = ({
  currentConfig,
  weekRecord,
  selectedWeekId,
  scoreSummary,
  isParentMode,
  authRole,
  stampMode,
  setStampMode,
  showIncompleteOnly,
  setShowIncompleteOnly,
  onCellToggle,
  onReadingScoreChange,
  onToggleReadingRecord,
  onToggleReadingPlay,
  recordingDayKey,
  recordingElapsedSec,
  isUploadingAudio,
  playingAudioId,
  onBulkDayComplete,
  onOpenClothesModal,
  onResetWeeklyBoard,
  onOpenLogin
}) => {
  const [mobileViewMode, setMobileViewMode] = useState<'day' | 'table'>('day');
  const [selectedMobileDay, setSelectedMobileDay] = useState<DayKey>(() =>
    getDefaultMobileDayKey()
  );

  const isSuhyun = currentConfig.id === 'suhyun';
  const canRecordForChild = authRole === 'parent' || authRole === currentConfig.id;

  const filteredStudyItems = currentConfig.studyItems.filter((item) => {
    if (!showIncompleteOnly) return true;
    const rowChecks = weekRecord.checks?.[item.id] || {};
    return DAYS.some((d) => (rowChecks[d.key] || 'NONE') === 'NONE');
  });

  const filteredHabitItems = currentConfig.habitItems.filter((item) => {
    if (!showIncompleteOnly) return true;
    const rowChecks = weekRecord.checks?.[item.id] || {};
    return DAYS.some((d) => (rowChecks[d.key] || 'NONE') === 'NONE');
  });

  const studyDailyMax = currentConfig.studyItems.reduce((a, b) => a + b.score, 0);
  const habitDailyMax = currentConfig.habitItems.reduce((a, b) => a + b.score, 0);
  const noIncompleteResults =
    showIncompleteOnly && filteredStudyItems.length === 0 && filteredHabitItems.length === 0;

  const selectedDayObj = DAYS.find((d) => d.key === selectedMobileDay) || DAYS[0];
  const allEvalItems = [...currentConfig.studyItems, ...currentConfig.habitItems];

  const dayIncompleteCounts = DAYS.reduce((acc, d) => {
    acc[d.key] = allEvalItems.filter(
      (item) => (weekRecord.checks?.[item.id]?.[d.key] || 'NONE') === 'NONE'
    ).length;
    return acc;
  }, {} as Record<DayKey, number>);

  const mobileStudyItems = currentConfig.studyItems.filter((item) => {
    if (!showIncompleteOnly) return true;
    return (weekRecord.checks?.[item.id]?.[selectedMobileDay] || 'NONE') === 'NONE';
  });

  const mobileHabitItems = currentConfig.habitItems.filter((item) => {
    if (!showIncompleteOnly) return true;
    return (weekRecord.checks?.[item.id]?.[selectedMobileDay] || 'NONE') === 'NONE';
  });

  const mobileDayAllDone =
    showIncompleteOnly &&
    !noIncompleteResults &&
    mobileStudyItems.length === 0 &&
    mobileHabitItems.length === 0;

  const renderFiveDayMiniStrip = (item: EvaluationItem) => {
    const rowChecks = weekRecord.checks?.[item.id] || {};
    return (
      <div className="flex items-center gap-1 pt-0.5" aria-label="월~금 완료 현황">
        {DAYS.map((d) => {
          const st = rowChecks[d.key] || 'NONE';
          const isCurrent = d.key === selectedMobileDay;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedMobileDay(d.key)}
              className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${
                st === 'WEEKDAY'
                  ? 'bg-emerald-600 text-white'
                  : st === 'WEEKEND'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              } ${isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
              title={`${d.label}요일로 이동`}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderMobileStandardItem = (item: EvaluationItem) => {
    const status = weekRecord.checks?.[item.id]?.[selectedMobileDay] || 'NONE';
    const earnedPts =
      status !== 'NONE' ? getCellEarnedScore(item, selectedMobileDay, weekRecord) : item.score;
    const isHistoricalScore = status !== 'NONE' && earnedPts !== item.score;
    const daySubMap = weekRecord.clothesSubChecks?.[selectedMobileDay] || {};
    const checkedSubCount = item.subItems
      ? item.subItems.filter((s) => Boolean(daySubMap[s])).length
      : 0;

    return (
      <div key={item.id} className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-900">
                {item.shortName || item.name}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
                {item.score}점
              </span>
            </div>
            {renderFiveDayMiniStrip(item)}
            {item.ruleNote && (
              <p className="text-[11px] font-semibold text-rose-600 leading-snug">
                {item.ruleNote}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onCellToggle(item, selectedMobileDay, selectedDayObj.label)}
            title={
              isHistoricalScore
                ? `배점 변경 전 기존 배점(${earnedPts}점) 유지됨`
                : undefined
            }
            className={`min-w-[94px] h-11 px-3 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all duration-150 shrink-0 ${
              status === 'WEEKDAY'
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                : status === 'WEEKEND'
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-dashed border-slate-300'
            }`}
          >
            {status === 'WEEKDAY' && (
              <>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>평일</span>
                </div>
                <span className="tabular-nums font-mono text-[11px]">
                  +{earnedPts}
                  {isHistoricalScore && (
                    <span className="ml-0.5 text-[9px] font-sans opacity-85">기존</span>
                  )}
                </span>
              </>
            )}
            {status === 'WEEKEND' && (
              <>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>보충</span>
                </div>
                <span className="tabular-nums font-mono text-[11px]">
                  +{earnedPts}
                  {isHistoricalScore && (
                    <span className="ml-0.5 text-[9px] font-sans opacity-85">기존</span>
                  )}
                </span>
              </>
            )}
            {status === 'NONE' && <span className="text-xs font-medium">미수행</span>}
          </button>
        </div>

        {item.subItems && (
          <button
            type="button"
            onClick={() => onOpenClothesModal(selectedMobileDay, selectedDayObj.label)}
            className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors tabular-nums ${
              checkedSubCount === 8
                ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5 shrink-0" />
              <span>옷 정리 8종 세부 점검</span>
            </span>
            <span className="font-mono font-bold">{checkedSubCount} / 8</span>
          </button>
        )}
      </div>
    );
  };

  const renderMobileReadingItem = (item: EvaluationItem) => {
    const status = weekRecord.checks?.[item.id]?.[selectedMobileDay] || 'NONE';
    const recording = weekRecord.readingRecordings?.[selectedMobileDay];
    const isThisRecording = recordingDayKey === selectedMobileDay;
    const isOtherRecording =
      recordingDayKey !== null && recordingDayKey !== selectedMobileDay;
    const isThisPlaying = Boolean(recording && playingAudioId === recording.audioId);
    const selectValue =
      status === 'NONE'
        ? ''
        : String(getCellEarnedScore(item, selectedMobileDay, weekRecord));

    return (
      <div key={item.id} className="p-3.5 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-900">
              {item.shortName || item.name}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
              0/5/10점
            </span>
          </div>
          {renderFiveDayMiniStrip(item)}
          {item.ruleNote && (
            <p className="text-[11px] font-semibold text-rose-600 leading-snug">
              {item.ruleNote}
            </p>
          )}
        </div>

        <div className={canRecordForChild ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
          {canRecordForChild && (
            <button
              type="button"
              disabled={isOtherRecording || isUploadingAudio}
              onClick={() => onToggleReadingRecord(selectedMobileDay, selectedDayObj.label)}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                isThisRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : isOtherRecording || isUploadingAudio
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isThisRecording ? (
                <>
                  <Square className="w-3 h-3 fill-current shrink-0" />
                  <span className="tabular-nums">
                    녹음 중 {formatTimer(recordingElapsedSec)}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span>{recording ? '다시 녹음' : '독후감 녹음'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={!recording || isThisRecording}
            onClick={() => onToggleReadingPlay(selectedMobileDay)}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              !recording || isThisRecording
                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                : isThisPlaying
                ? 'bg-blue-600 text-white'
                : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {isThisPlaying ? (
              <>
                <Square className="w-3 h-3 fill-current shrink-0" />
                <span>재생 정지</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>{recording ? `녹음 듣기 (${recording.durationSec}초)` : '녹음 없음'}</span>
              </>
            )}
          </button>
        </div>

        {isParentMode ? (
          <select
            aria-label={`${selectedDayObj.label}요일 독서 점수 선택`}
            value={selectValue}
            onChange={(e) =>
              onReadingScoreChange(
                selectedMobileDay,
                selectedDayObj.label,
                e.target.value as '' | '0' | '5' | '10'
              )
            }
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 ${
              selectValue === '10'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : selectValue === '5'
                ? 'bg-amber-500 text-white border-amber-600'
                : selectValue === '0'
                ? 'bg-slate-700 text-white border-slate-800'
                : 'bg-slate-50 text-slate-600 border-dashed border-slate-300'
            }`}
          >
            <option value="" className="bg-white text-slate-700">
              독서 점수 선택 (미채점)
            </option>
            <option value="0" className="bg-white text-slate-900">
              0점
            </option>
            <option value="5" className="bg-white text-slate-900">
              5점
            </option>
            <option value="10" className="bg-white text-slate-900">
              10점
            </option>
          </select>
        ) : (
          <div
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border text-center tabular-nums ${
              selectValue === '10'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : selectValue === '5'
                ? 'bg-amber-500 text-white border-amber-600'
                : selectValue === '0'
                ? 'bg-slate-700 text-white border-slate-800'
                : 'bg-slate-50 text-slate-400 border-dashed border-slate-200'
            }`}
          >
            {selectValue !== '' ? `채점 완료: ${selectValue}점` : '부모님 채점 대기'}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-3.5 sm:space-y-4">
      {/* Control Toolbar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 sm:gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-2.5">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              {currentConfig.name} 주간 채점표
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {currentConfig.info} · 일일 {currentConfig.dailyMaxScore}점 · 이번 주{' '}
              {scoreSummary.effectiveWeeklyMaxScore}점 만점
            </span>
          </div>
          {isParentMode ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              칸을 클릭하면 <span className="font-semibold text-emerald-700">평일 완료</span> →{' '}
              <span className="font-semibold text-amber-700">주말 보충 완료</span> →{' '}
              <span className="font-semibold text-slate-600">미수행</span> 순으로 전환되며 주말 유튜브 시간에 즉시 반영됩니다.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                자녀용 화면에서는 독서 음성 독후감을 녹음하고 들을 수 있습니다. 점수 채점은 부모님 로그인 후 가능합니다.
              </span>
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0"
              >
                <Lock className="w-3 h-3" />
                <span>부모님 로그인</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
          {isParentMode && (
            <div className="grid grid-cols-3 sm:flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStampMode('CYCLE')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center ${
                  stampMode === 'CYCLE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                순환 클릭
              </button>
              <button
                type="button"
                onClick={() => setStampMode('WEEKDAY')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  stampMode === 'WEEKDAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>평일 완료</span>
              </button>
              <button
                type="button"
                onClick={() => setStampMode('WEEKEND')}
                className={`px-2 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  stampMode === 'WEEKEND'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>주말 보충</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                showIncompleteOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5 shrink-0" />
              <span>
                {showIncompleteOnly
                  ? '전체 항목 보기'
                  : `미완료만 (${scoreSummary.incompleteCount})`}
              </span>
            </button>

            {isParentMode && (
              <button
                type="button"
                onClick={onResetWeeklyBoard}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>이 주 초기화</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty state if filtered to incomplete and none remain */}
      {noIncompleteResults ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              이 주 모든 항목을 완료했습니다
            </h3>
            <p className="text-xs text-slate-500">
              미수행 항목이 0건입니다. 전체 채점표를 보려면 필터를 해제하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowIncompleteOnly(false)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
          >
            전체 항목 보기
          </button>
        </div>
      ) : (
        <>
          {/* Mobile View Switcher (< md) */}
          <div className="md:hidden grid grid-cols-2 gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMobileViewMode('day')}
              className={`py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                mobileViewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>요일별 채점</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode('table')}
              className={`py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                mobileViewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 shrink-0" />
              <span>주간 표 한눈에</span>
            </button>
          </div>

          {/* Mobile Day-by-Day Card View (< md when mobileViewMode === 'day') */}
          {mobileViewMode === 'day' && (
            <div className="md:hidden space-y-3">
              {/* 5-Day Selector Bar */}
              <div className="grid grid-cols-5 gap-1.5">
                {DAYS.map((day) => {
                  const isActive = selectedMobileDay === day.key;
                  const incompleteCount = dayIncompleteCounts[day.key];
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedMobileDay(day.key)}
                      className={`relative py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {incompleteCount > 0 && (
                        <span
                          className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-amber-400' : 'bg-amber-500'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-xs font-bold">{day.label}</span>
                      <span
                        className={`text-[10px] tabular-nums ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {getWeekDayShortDate(selectedWeekId, day.key)}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold tabular-nums ${
                          isActive ? 'text-emerald-400' : 'text-slate-900'
                        }`}
                      >
                        {scoreSummary.dailyScores[day.key]}점
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Header + Bulk Complete */}
              <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900">
                    {selectedDayObj.fullLabel}{' '}
                    <span className="text-xs font-medium text-slate-400 tabular-nums">
                      ({getWeekDayShortDate(selectedWeekId, selectedMobileDay)})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                    획득{' '}
                    <span className="font-bold text-slate-900">
                      {scoreSummary.dailyScores[selectedMobileDay]}
                    </span>{' '}
                    / {scoreSummary.effectiveDailyMaxScores[selectedMobileDay]}점
                    {scoreSummary.dailyMakeups[selectedMobileDay] > 0 && (
                      <span className="text-amber-600 font-semibold ml-1.5">
                        (보충 +{scoreSummary.dailyMakeups[selectedMobileDay]})
                      </span>
                    )}
                  </div>
                </div>

                {isParentMode && (
                  <button
                    type="button"
                    onClick={() =>
                      onBulkDayComplete(selectedMobileDay, selectedDayObj.label, 'WEEKDAY')
                    }
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    title={`${selectedDayObj.label}요일 전체 평일 완료 체크 (독서 제외)`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>전체 완료</span>
                  </button>
                )}
              </div>

              {mobileDayAllDone ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 text-center space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {selectedDayObj.fullLabel}은 모두 완료되었습니다
                    </div>
                    <p className="text-xs text-slate-500">
                      미완료 항목이 남아있는 다른 요일로 이동하거나 전체 보기로 전환하세요.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {DAYS.filter((d) => dayIncompleteCounts[d.key] > 0).map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setSelectedMobileDay(d.key)}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold tabular-nums"
                      >
                        {d.label}요일 ({dayIncompleteCounts[d.key]}건)
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Section 1: Study Items */}
                  {mobileStudyItems.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen
                            className={`w-3.5 h-3.5 ${
                              isSuhyun ? 'text-blue-600' : 'text-rose-600'
                            }`}
                          />
                          <span>01. {currentConfig.name} 개별 학습과목</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                          일일 {studyDailyMax}점
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {mobileStudyItems.map((item) => renderMobileStandardItem(item))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Common Habit Items */}
                  {mobileHabitItems.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          <span>02. 공통 생활습관</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                          일일 {habitDailyMax}점
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {mobileHabitItems.map((item) =>
                          item.scoringType === 'READING_AUDIO'
                            ? renderMobileReadingItem(item)
                            : renderMobileStandardItem(item)
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Mobile Day Summary Footer Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between gap-3 tabular-nums">
                <div>
                  <div className="text-[11px] text-slate-400">
                    {selectedDayObj.fullLabel} 획득
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {scoreSummary.dailyScores[selectedMobileDay]}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      / {scoreSummary.effectiveDailyMaxScores[selectedMobileDay]}점
                    </span>
                    {scoreSummary.dailyMakeups[selectedMobileDay] > 0 && (
                      <span className="text-xs text-amber-400 ml-1">
                        (+{scoreSummary.dailyMakeups[selectedMobileDay]})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">이번 주 합계</div>
                  <div className="text-base font-bold text-white">
                    {scoreSummary.totalScore}점 · 유튜브 {scoreSummary.totalEarnedMinutes}분
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Weekly Matrix Table (Desktop always visible; Mobile when 'table' selected) */}
          <div
            className={`${
              mobileViewMode === 'table' ? 'block' : 'hidden md:block'
            } bg-white rounded-2xl border border-slate-200/90 overflow-hidden`}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px] md:min-w-[740px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                    <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200/80 py-3 md:py-3.5 px-3 md:px-5 text-left w-36 sm:w-48 md:w-64 lg:w-72">
                      평가 항목
                    </th>
                    {DAYS.map((day) => (
                      <th key={day.key} className="py-3 px-1.5 md:px-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs md:text-sm font-bold text-slate-900 whitespace-nowrap">
                            {day.label}요일{' '}
                            <span className="text-[10px] md:text-[11px] font-medium text-slate-400">
                              ({getWeekDayShortDate(selectedWeekId, day.key)})
                            </span>
                          </span>
                          {isParentMode && (
                            <button
                              type="button"
                              onClick={() => onBulkDayComplete(day.key, day.label, 'WEEKDAY')}
                              className="text-[10px] md:text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition-colors whitespace-nowrap"
                              title={`${day.label}요일 전체 평일 완료 체크 (독서 제외)`}
                            >
                              전체 완료
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 md:py-3.5 px-3 md:px-5 text-right w-20 md:w-28 bg-slate-50 whitespace-nowrap">
                      주간 합계
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {/* Section 1: Study Items */}
                  {filteredStudyItems.length > 0 && (
                    <tr className="bg-slate-50/60">
                      <td
                        colSpan={7}
                        className="py-2.5 px-3 md:px-5 text-xs font-bold text-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            <BookOpen
                              className={`w-3.5 h-3.5 ${
                                isSuhyun ? 'text-blue-600' : 'text-rose-600'
                              }`}
                            />
                            <span>01. {currentConfig.name} 개별 학습과목</span>
                          </span>
                          <span className="text-slate-500 font-medium tabular-nums">
                            {currentConfig.studyItems.length}과목 · 일일 {studyDailyMax}점 · 주간{' '}
                            {studyDailyMax * 5}점
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredStudyItems.map((item) => {
                    const rowChecks = weekRecord.checks?.[item.id] || {};
                    const rowSum = DAYS.reduce((acc, d) => {
                      const st = rowChecks[d.key] || 'NONE';
                      return st !== 'NONE'
                        ? acc + getCellEarnedScore(item, d.key, weekRecord)
                        : acc;
                    }, 0);
                    const rowMax = DAYS.reduce((acc, d) => {
                      const st = rowChecks[d.key] || 'NONE';
                      return (
                        acc +
                        (st !== 'NONE' ? getCellEarnedScore(item, d.key, weekRecord) : item.score)
                      );
                    }, 0);

                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200/80 py-3 px-3 md:px-5">
                          <div className="flex items-center justify-between gap-1.5 md:gap-2">
                            <span className="font-semibold text-xs md:text-sm text-slate-900 leading-snug">
                              {item.name}
                            </span>
                            <span className="text-[11px] md:text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
                              {item.score}점
                            </span>
                          </div>
                        </td>

                        {DAYS.map((day) => {
                          const status = rowChecks[day.key] || 'NONE';
                          const earnedPts =
                            status !== 'NONE'
                              ? getCellEarnedScore(item, day.key, weekRecord)
                              : item.score;
                          const isHistoricalScore = status !== 'NONE' && earnedPts !== item.score;
                          return (
                            <td key={day.key} className="p-1 md:p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => onCellToggle(item, day.key, day.label)}
                                title={
                                  isHistoricalScore
                                    ? `배점 변경 전 기존 배점(${earnedPts}점) 유지됨`
                                    : undefined
                                }
                                className={`w-full h-11 md:h-12 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all duration-150 ${
                                  status === 'WEEKDAY'
                                    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                    : status === 'WEEKEND'
                                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-dashed border-slate-200'
                                }`}
                              >
                                {status === 'WEEKDAY' && (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="tabular-nums font-mono text-[11px]">
                                      +{earnedPts}
                                      {isHistoricalScore && (
                                        <span className="ml-0.5 text-[9px] font-sans opacity-85">
                                          기존
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                                {status === 'WEEKEND' && (
                                  <>
                                    <div className="flex items-center gap-0.5">
                                      <Star className="w-3.5 h-3.5 fill-current" />
                                      <span className="text-[10px] font-bold">보충</span>
                                    </div>
                                    <span className="tabular-nums font-mono text-[11px]">
                                      +{earnedPts}
                                      {isHistoricalScore && (
                                        <span className="ml-0.5 text-[9px] font-sans opacity-85">
                                          기존
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                                {status === 'NONE' && (
                                  <span className="text-[11px] font-medium">미수행</span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 md:px-5 text-right tabular-nums bg-slate-50/40 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{rowSum}</span>
                          <span className="text-xs text-slate-400 font-normal"> / {rowMax}</span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Section 2: Common Habit Items */}
                  {filteredHabitItems.length > 0 && (
                    <tr className="bg-slate-50/60">
                      <td
                        colSpan={7}
                        className="py-2.5 px-3 md:px-5 text-xs font-bold text-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                            <span>02. 공통 생활습관</span>
                          </span>
                          <span className="text-slate-500 font-medium tabular-nums">
                            {currentConfig.habitItems.length}항목 · 일일 {habitDailyMax}점 · 주간{' '}
                            {habitDailyMax * 5}점
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredHabitItems.map((item) => {
                    const rowChecks = weekRecord.checks?.[item.id] || {};
                    const isReadingAudio = item.scoringType === 'READING_AUDIO';
                    const rowSum = DAYS.reduce((acc, d) => {
                      const st = rowChecks[d.key] || 'NONE';
                      return st !== 'NONE'
                        ? acc + getCellEarnedScore(item, d.key, weekRecord)
                        : acc;
                    }, 0);
                    const rowMax = DAYS.reduce((acc, d) => {
                      const st = rowChecks[d.key] || 'NONE';
                      const pts =
                        st !== 'NONE' ? getCellEarnedScore(item, d.key, weekRecord) : item.score;
                      return acc + (isReadingAudio ? Math.max(item.score, pts) : pts);
                    }, 0);

                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200/80 py-3.5 px-3 md:px-5 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-1.5 md:gap-2">
                              <span className="font-semibold text-xs md:text-sm text-slate-900 leading-snug">
                                {item.shortName || item.name}
                              </span>
                              <span className="text-[11px] md:text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
                                {isReadingAudio ? '0/5/10점' : `${item.score}점`}
                              </span>
                            </div>
                            {item.subItems && (
                              <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed">
                                {item.subItems.join(' · ')}
                              </p>
                            )}
                            {item.ruleNote && (
                              <p className="hidden sm:block text-[11px] font-semibold text-rose-600">
                                {item.ruleNote}
                              </p>
                            )}
                          </div>
                        </td>

                        {DAYS.map((day) => {
                          const status = rowChecks[day.key] || 'NONE';
                          const earnedPts =
                            status !== 'NONE'
                              ? getCellEarnedScore(item, day.key, weekRecord)
                              : item.score;
                          const isHistoricalScore =
                            !isReadingAudio && status !== 'NONE' && earnedPts !== item.score;

                          if (isReadingAudio) {
                            const recording = weekRecord.readingRecordings?.[day.key];
                            const isThisRecording = recordingDayKey === day.key;
                            const isOtherRecording =
                              recordingDayKey !== null && recordingDayKey !== day.key;
                            const isThisPlaying = Boolean(
                              recording && playingAudioId === recording.audioId
                            );
                            const selectValue =
                              status === 'NONE'
                                ? ''
                                : String(getCellEarnedScore(item, day.key, weekRecord));

                            return (
                              <td key={day.key} className="p-1 md:p-1.5 text-center align-top">
                                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-1.5">
                                  <div className="flex items-center gap-1">
                                    {canRecordForChild && (
                                      <button
                                        type="button"
                                        disabled={isOtherRecording || isUploadingAudio}
                                        onClick={() => onToggleReadingRecord(day.key, day.label)}
                                        className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                                          isThisRecording
                                            ? 'bg-red-600 text-white animate-pulse'
                                            : isOtherRecording || isUploadingAudio
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}
                                        title={
                                          isThisRecording
                                            ? '클릭하여 녹음 종료 및 저장'
                                            : recording
                                            ? '다시 녹음하기'
                                            : '독후감 녹음 시작'
                                        }
                                      >
                                        {isThisRecording ? (
                                          <>
                                            <Square className="w-2.5 h-2.5 fill-current shrink-0" />
                                            <span className="tabular-nums">
                                              녹음 중 {formatTimer(recordingElapsedSec)}
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <Mic className="w-3 h-3 shrink-0" />
                                            <span>{recording ? '재녹음' : '녹음'}</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={!recording || isThisRecording}
                                      onClick={() => onToggleReadingPlay(day.key)}
                                      className={`${
                                        canRecordForChild ? '' : 'flex-1 '
                                      }py-1.5 px-2 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                                        !recording || isThisRecording
                                          ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                                          : isThisPlaying
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                      title={
                                        recording
                                          ? `녹음 듣기 (${recording.durationSec}초)`
                                          : '녹음된 독후감 없음'
                                      }
                                    >
                                      {isThisPlaying ? (
                                        <>
                                          <Square className="w-2.5 h-2.5 fill-current shrink-0" />
                                          <span>정지</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3 h-3 fill-current shrink-0" />
                                          <span>듣기</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {isParentMode ? (
                                    <select
                                      aria-label={`${day.label}요일 독서 점수 선택`}
                                      value={selectValue}
                                      onChange={(e) =>
                                        onReadingScoreChange(
                                          day.key,
                                          day.label,
                                          e.target.value as '' | '0' | '5' | '10'
                                        )
                                      }
                                      className={`w-full py-1.5 px-2 rounded-lg border text-xs font-bold text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                                        selectValue === '10'
                                          ? 'bg-emerald-600 text-white border-emerald-700'
                                          : selectValue === '5'
                                          ? 'bg-amber-500 text-white border-amber-600'
                                          : selectValue === '0'
                                          ? 'bg-slate-700 text-white border-slate-800'
                                          : 'bg-white text-slate-500 border-dashed border-slate-300'
                                      }`}
                                    >
                                      <option value="" className="bg-white text-slate-700">
                                        미채점
                                      </option>
                                      <option value="0" className="bg-white text-slate-900">
                                        0점
                                      </option>
                                      <option value="5" className="bg-white text-slate-900">
                                        5점
                                      </option>
                                      <option value="10" className="bg-white text-slate-900">
                                        10점
                                      </option>
                                    </select>
                                  ) : (
                                    <div
                                      className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-bold border text-center tabular-nums ${
                                        selectValue === '10'
                                          ? 'bg-emerald-600 text-white border-emerald-700'
                                          : selectValue === '5'
                                          ? 'bg-amber-500 text-white border-amber-600'
                                          : selectValue === '0'
                                          ? 'bg-slate-700 text-white border-slate-800'
                                          : 'bg-white text-slate-400 border-dashed border-slate-200'
                                      }`}
                                    >
                                      {selectValue !== '' ? `${selectValue}점` : '채점 대기'}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          const daySubMap = weekRecord.clothesSubChecks?.[day.key] || {};
                          const checkedSubCount = item.subItems
                            ? item.subItems.filter((s) => Boolean(daySubMap[s])).length
                            : 0;

                          return (
                            <td key={day.key} className="p-1 md:p-1.5 text-center align-top">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => onCellToggle(item, day.key, day.label)}
                                  title={
                                    isHistoricalScore
                                      ? `배점 변경 전 기존 배점(${earnedPts}점) 유지됨`
                                      : undefined
                                  }
                                  className={`w-full h-11 md:h-12 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all duration-150 ${
                                    status === 'WEEKDAY'
                                      ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                      : status === 'WEEKEND'
                                      ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                      : 'bg-slate-50/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-dashed border-slate-200'
                                  }`}
                                >
                                  {status === 'WEEKDAY' && (
                                    <>
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span className="tabular-nums font-mono text-[11px]">
                                        +{earnedPts}
                                        {isHistoricalScore && (
                                          <span className="ml-0.5 text-[9px] font-sans opacity-85">
                                            기존
                                          </span>
                                        )}
                                      </span>
                                    </>
                                  )}
                                  {status === 'WEEKEND' && (
                                    <>
                                      <div className="flex items-center gap-0.5">
                                        <Star className="w-3.5 h-3.5 fill-current" />
                                        <span className="text-[10px] font-bold">보충</span>
                                      </div>
                                      <span className="tabular-nums font-mono text-[11px]">
                                        +{earnedPts}
                                        {isHistoricalScore && (
                                          <span className="ml-0.5 text-[9px] font-sans opacity-85">
                                            기존
                                          </span>
                                        )}
                                      </span>
                                    </>
                                  )}
                                  {status === 'NONE' && (
                                    <span className="text-[11px] font-medium">미수행</span>
                                  )}
                                </button>

                                {item.subItems && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenClothesModal(day.key, day.label)}
                                    className={`inline-flex items-center justify-center gap-1 text-[11px] font-semibold py-1 px-1.5 rounded-lg border transition-colors tabular-nums ${
                                      checkedSubCount === 8
                                        ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    <ListChecks className="w-3 h-3 shrink-0" />
                                    <span>{checkedSubCount}/8</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-3.5 px-3 md:px-5 text-right align-top tabular-nums bg-slate-50/40 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{rowSum}</span>
                          <span className="text-xs text-slate-400 font-normal"> / {rowMax}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer */}
                <tfoot>
                  <tr className="bg-slate-900 text-white text-sm">
                    <td className="sticky left-0 z-10 bg-slate-900 border-r border-slate-800 py-3.5 md:py-4 px-3 md:px-5 font-bold text-xs md:text-sm">
                      요일별 획득 점수
                    </td>
                    {DAYS.map((day) => (
                      <td key={day.key} className="py-3 md:py-3.5 px-1.5 md:px-2 text-center tabular-nums">
                        <div className="text-sm md:text-base font-bold text-emerald-400">
                          {scoreSummary.dailyScores[day.key]}점
                        </div>
                        <div className="text-[10px] md:text-[11px] text-slate-400">
                          / {scoreSummary.effectiveDailyMaxScores[day.key]}
                          {scoreSummary.dailyMakeups[day.key] > 0 && (
                            <span className="text-amber-400 ml-1">
                              (+{scoreSummary.dailyMakeups[day.key]})
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="py-3.5 md:py-4 px-3 md:px-5 text-right bg-slate-950 tabular-nums whitespace-nowrap">
                      <div className="text-sm md:text-base font-bold text-white">
                        {scoreSummary.totalScore}점
                      </div>
                      <div className="text-[10px] md:text-[11px] text-slate-400">
                        유튜브 {scoreSummary.totalEarnedMinutes}분
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
