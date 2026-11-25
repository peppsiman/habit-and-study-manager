import React from 'react';
import {
  Check,
  CheckCircle2,
  Filter,
  Lock,
  Mic,
  Play,
  RotateCcw,
  Square,
  Star,
  BookOpen,
  Sparkles,
  ListChecks
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
import { getWeekDayShortDate } from '../utils/weekUtils';

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

  return (
    <section className="space-y-4">
      {/* Control Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isParentMode && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStampMode('CYCLE')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
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
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                  stampMode === 'WEEKDAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>평일 완료</span>
              </button>
              <button
                type="button"
                onClick={() => setStampMode('WEEKEND')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                  stampMode === 'WEEKEND'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>주말 보충</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              showIncompleteOnly
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              {showIncompleteOnly
                ? '전체 항목 보기'
                : `미완료 항목만 (${scoreSummary.incompleteCount})`}
            </span>
          </button>

          {isParentMode && (
            <button
              type="button"
              onClick={onResetWeeklyBoard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>이 주 기록 초기화</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty state if filtered to incomplete and none remain */}
      {noIncompleteResults ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3">
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
        /* Main Weekly Matrix Table */
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[740px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                  <th className="py-3.5 px-5 text-left w-72">평가 항목</th>
                  {DAYS.map((day) => (
                    <th key={day.key} className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-bold text-slate-900">
                          {day.label}요일{' '}
                          <span className="text-[11px] font-medium text-slate-400">
                            ({getWeekDayShortDate(selectedWeekId, day.key)})
                          </span>
                        </span>
                        {isParentMode && (
                          <button
                            type="button"
                            onClick={() => onBulkDayComplete(day.key, day.label, 'WEEKDAY')}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition-colors whitespace-nowrap"
                            title={`${day.label}요일 전체 평일 완료 체크 (독서 제외)`}
                          >
                            전체 완료
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-3.5 px-5 text-right w-28 bg-slate-50">주간 합계</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {/* Section 1: Study Items */}
                {filteredStudyItems.length > 0 && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={7} className="py-2.5 px-5 text-xs font-bold text-slate-700">
                      <div className="flex items-center justify-between">
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
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
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
                          <td key={day.key} className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => onCellToggle(item, day.key, day.label)}
                              title={
                                isHistoricalScore
                                  ? `배점 변경 전 기존 배점(${earnedPts}점) 유지됨`
                                  : undefined
                              }
                              className={`w-full h-12 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all duration-150 ${
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

                      <td className="py-3 px-5 text-right tabular-nums bg-slate-50/40">
                        <span className="font-bold text-slate-900">{rowSum}</span>
                        <span className="text-xs text-slate-400 font-normal"> / {rowMax}</span>
                      </td>
                    </tr>
                  );
                })}

                {/* Section 2: Common Habit Items */}
                {filteredHabitItems.length > 0 && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={7} className="py-2.5 px-5 text-xs font-bold text-slate-700">
                      <div className="flex items-center justify-between">
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
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 align-top">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {item.shortName || item.name}
                            </span>
                            <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums shrink-0">
                              {isReadingAudio ? '0/5/10점' : `${item.score}점`}
                            </span>
                          </div>
                          {item.subItems && (
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {item.subItems.join(' · ')}
                            </p>
                          )}
                          {item.ruleNote && (
                            <p className="text-[11px] font-semibold text-rose-600">
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
                            <td key={day.key} className="p-1.5 text-center align-top">
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
                          <td key={day.key} className="p-1.5 text-center align-top">
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => onCellToggle(item, day.key, day.label)}
                                title={
                                  isHistoricalScore
                                    ? `배점 변경 전 기존 배점(${earnedPts}점) 유지됨`
                                    : undefined
                                }
                                className={`w-full h-12 rounded-xl font-semibold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all duration-150 ${
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

                      <td className="py-3.5 px-5 text-right align-top tabular-nums bg-slate-50/40">
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
                  <td className="py-4 px-5 font-bold">요일별 획득 점수</td>
                  {DAYS.map((day) => (
                    <td key={day.key} className="py-3.5 px-2 text-center tabular-nums">
                      <div className="text-base font-bold text-emerald-400">
                        {scoreSummary.dailyScores[day.key]}점
                      </div>
                      <div className="text-[11px] text-slate-400">
                        / {scoreSummary.effectiveDailyMaxScores[day.key]}
                        {scoreSummary.dailyMakeups[day.key] > 0 && (
                          <span className="text-amber-400 ml-1">
                            (+{scoreSummary.dailyMakeups[day.key]})
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="py-4 px-5 text-right bg-slate-950 tabular-nums">
                    <div className="text-base font-bold text-white">
                      {scoreSummary.totalScore}점
                    </div>
                    <div className="text-[11px] text-slate-400">
                      유튜브 {scoreSummary.totalEarnedMinutes}분
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
