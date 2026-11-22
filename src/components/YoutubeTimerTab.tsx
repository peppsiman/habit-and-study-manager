import React, { useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Clock,
  Lock,
  Minus,
  Pause,
  Play,
  RotateCcw,
  Square,
  Undo2,
  Volume2,
  VolumeX,
  Youtube
} from 'lucide-react';
import { CHILDREN_CONFIG } from '../constants';
import { ChildConfig, ChildData, ChildKey, ScoreSummary, TimersMap } from '../types';
import { formatMinutesReadable, formatTimer } from '../utils/scoreUtils';

const TIMER_PRESET_MINUTES = [10, 15, 20, 30, 40, 60];

interface YoutubeTimerTabProps {
  currentConfig: ChildConfig;
  currentData: ChildData;
  scoreSummary: ScoreSummary;
  summaries: Record<ChildKey, ScoreSummary>;
  timers: TimersMap;
  isParentMode: boolean;
  onSetChildTimerMinutes: (childKey: ChildKey, minutes: number) => void;
  onToggleChildTimer: (childKey: ChildKey) => void;
  onResetChildTimer: (childKey: ChildKey) => void;
  onDismissChildAlarm: (childKey: ChildKey) => void;
  onDeductChildTimer: (childKey: ChildKey, mode?: 'target' | 'elapsed') => void;
  onStartBothTimers: () => void;
  onPauseBothTimers: () => void;
  onTestAlarmSound: () => void;
  onDeductYoutube: (minutes: string | number, memo: string) => boolean;
  onUndoWatchLog: (logId: string) => void;
  onOpenLogin: () => void;
}

export const YoutubeTimerTab: React.FC<YoutubeTimerTabProps> = ({
  currentConfig,
  currentData,
  scoreSummary,
  summaries,
  timers,
  isParentMode,
  onSetChildTimerMinutes,
  onToggleChildTimer,
  onResetChildTimer,
  onDismissChildAlarm,
  onDeductChildTimer,
  onStartBothTimers,
  onPauseBothTimers,
  onTestAlarmSound,
  onDeductYoutube,
  onUndoWatchLog,
  onOpenLogin
}) => {
  const [customDeductInput, setCustomDeductInput] = useState('');
  const [watchMemoInput, setWatchMemoInput] = useState('');
  const [draftMinutes, setDraftMinutes] = useState<Partial<Record<ChildKey, string>>>({});

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onDeductYoutube(customDeductInput, watchMemoInput);
    if (ok) {
      setCustomDeductInput('');
      setWatchMemoInput('');
    }
  };

  const handleMinuteInputChange = (childKey: ChildKey, rawVal: string) => {
    setDraftMinutes((prev) => ({ ...prev, [childKey]: rawVal }));
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 180) {
      onSetChildTimerMinutes(childKey, parsed);
    }
  };

  const handleMinuteInputBlur = (childKey: ChildKey) => {
    setDraftMinutes((prev) => {
      const next = { ...prev };
      delete next[childKey];
      return next;
    });
  };

  const remainingRatio =
    scoreSummary.totalEarnedMinutes > 0
      ? Math.min(100, (scoreSummary.remainingMinutes / scoreSummary.totalEarnedMinutes) * 100)
      : 0;

  return (
    <section className="space-y-6">
      {/* Countdown Voice-Alarm Dual Sibling Timer Console */}
      <div className="bg-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                수현 · 다현 유튜브 카운트다운 알림 타이머
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              최종 로그인된 부모님 기기에서만 타이머 시작·중지·시간 차감이 가능하며, 다른 기기에서 로그인하면 기존 기기는 자동 로그아웃됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onTestAlarmSound}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>알림음 테스트</span>
            </button>
            <button
              type="button"
              onClick={onStartBothTimers}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>남매 동시 시작</span>
            </button>
            <button
              type="button"
              onClick={onPauseBothTimers}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>동시 일시정지</span>
            </button>
          </div>
        </div>

        {/* Dual Timer Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['suhyun', 'dahyun'] as ChildKey[]).map((childKey) => {
            const cfg = CHILDREN_CONFIG[childKey];
            const sum = summaries[childKey];
            const tState = timers[childKey];
            const isBlue = childKey === 'suhyun';
            const totalTargetSec = Math.max(60, tState.targetMinutes * 60);
            const isRinging = Boolean(tState.isAlarmRinging);
            const isFinished = tState.remainingSeconds === 0;
            const isStarted = tState.remainingSeconds < totalTargetSec;
            const isPaused = !tState.isRunning && isStarted && !isFinished;
            const isNoTimeLeft = !tState.isRunning && !isRinging && sum.remainingMinutes <= 0;
            const exceedsRemaining =
              sum.remainingMinutes > 0 && tState.targetMinutes > sum.remainingMinutes;
            const canEditDuration = isParentMode && !tState.isRunning && !isRinging;
            const progressPct = Math.min(
              100,
              Math.max(0, (tState.remainingSeconds / totalTargetSec) * 100)
            );
            const elapsedSec = Math.max(0, totalTargetSec - tState.remainingSeconds);
            const elapsedMins = Math.max(1, Math.round(elapsedSec / 60));
            const targetDeductAmt =
              sum.remainingMinutes > 0
                ? Math.min(tState.targetMinutes, sum.remainingMinutes)
                : 0;

            return (
              <div
                key={childKey}
                className={`rounded-2xl p-4 sm:p-5 border transition-colors space-y-4 ${
                  isRinging
                    ? 'bg-red-950/40 border-red-500 ring-2 ring-red-500/40 animate-pulse'
                    : tState.isRunning
                    ? isBlue
                      ? 'bg-slate-900 border-blue-500/70'
                      : 'bg-slate-900 border-rose-500/70'
                    : isFinished
                    ? 'bg-slate-900 border-amber-500/60'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          isBlue ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {cfg.name.slice(0, 1)}
                      </span>
                      <h3 className="text-sm font-bold text-white">
                        {cfg.name} · {cfg.info}
                      </h3>
                      {isRinging ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400">
                          <BellRing className="w-3 h-3" />
                          <span>종료 알림 중</span>
                        </span>
                      ) : tState.isRunning ? (
                        <span className="text-[11px] font-semibold text-emerald-400">
                          카운트다운 중
                        </span>
                      ) : isFinished ? (
                        <span className="text-[11px] font-semibold text-amber-400">
                          시간 종료 · 차감 대기
                        </span>
                      ) : isPaused ? (
                        <span className="text-[11px] font-semibold text-amber-300">
                          일시정지
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400 tabular-nums">
                      잔여 시간{' '}
                      <span
                        className={`font-semibold ${
                          sum.remainingMinutes > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {sum.remainingMinutes}분
                      </span>{' '}
                      / 총 {sum.totalEarnedMinutes}분
                    </p>
                  </div>

                  {/* Countdown Readout */}
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono text-3xl font-bold tracking-wider bg-slate-950 px-3.5 py-2 rounded-xl border tabular-nums ${
                        isRinging || isFinished
                          ? 'text-red-400 border-red-800'
                          : 'text-amber-400 border-slate-800'
                      }`}
                    >
                      {formatTimer(tState.remainingSeconds)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                      설정 {tState.targetMinutes}분
                    </div>
                  </div>
                </div>

                {/* Countdown Progress Bar */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isRinging || isFinished
                        ? 'bg-red-500'
                        : isBlue
                        ? 'bg-blue-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Time Setting Controls */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {TIMER_PRESET_MINUTES.map((min) => {
                      const active = tState.targetMinutes === min;
                      const overRemaining = sum.remainingMinutes > 0 && min > sum.remainingMinutes;
                      return (
                        <button
                          key={min}
                          type="button"
                          disabled={!canEditDuration || overRemaining}
                          onClick={() => onSetChildTimerMinutes(childKey, min)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                            active
                              ? isBlue
                                ? 'bg-blue-600 text-white'
                                : 'bg-rose-600 text-white'
                              : !canEditDuration || overRemaining
                              ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {min}분
                        </button>
                      );
                    })}

                    {sum.remainingMinutes > 0 &&
                      sum.remainingMinutes <= 180 &&
                      !TIMER_PRESET_MINUTES.includes(sum.remainingMinutes) && (
                        <button
                          type="button"
                          disabled={!canEditDuration}
                          onClick={() => onSetChildTimerMinutes(childKey, sum.remainingMinutes)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                            tState.targetMinutes === sum.remainingMinutes
                              ? 'bg-emerald-600 text-white'
                              : !canEditDuration
                              ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700'
                          }`}
                        >
                          잔여 {sum.remainingMinutes}분
                        </button>
                      )}

                    <div className="relative ml-auto w-20">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        disabled={!canEditDuration}
                        value={draftMinutes[childKey] ?? String(tState.targetMinutes)}
                        onChange={(e) => handleMinuteInputChange(childKey, e.target.value)}
                        onBlur={() => handleMinuteInputBlur(childKey)}
                        aria-label={`${cfg.name} 시청 시간(분) 직접 입력`}
                        className="w-full pl-2.5 pr-6 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                      />
                      <span className="absolute right-2 top-1 text-[11px] text-slate-400 pointer-events-none">
                        분
                      </span>
                    </div>
                  </div>
                </div>

                {isNoTimeLeft && (
                  <div className="px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-800/70 text-xs text-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>잔여 시간이 0분입니다. 주말 보충 수행으로 시간을 충전할 수 있습니다.</span>
                  </div>
                )}

                {exceedsRemaining && !isRinging && !isFinished && (
                  <div className="px-3 py-2 rounded-xl bg-amber-950/50 border border-amber-800/70 text-xs text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      현재 잔여 시간({sum.remainingMinutes}분)을 초과합니다. 잔여 시간 이하로 설정해주세요.
                    </span>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  {isRinging ? (
                    <div className="w-full flex flex-wrap items-center gap-2">
                      {targetDeductAmt > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDeductChildTimer(childKey, 'target')}
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>알림 해제 + {targetDeductAmt}분 차감</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDismissChildAlarm(childKey)}
                            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>알림만 해제</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDismissChildAlarm(childKey)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <VolumeX className="w-4 h-4" />
                          <span>알림 해제</span>
                        </button>
                      )}
                    </div>
                  ) : isFinished ? (
                    <div className="w-full flex flex-wrap items-center justify-between gap-2">
                      {targetDeductAmt > 0 && (
                        <button
                          type="button"
                          onClick={() => onDeductChildTimer(childKey, 'target')}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap tabular-nums"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>설정 {targetDeductAmt}분 차감 확정</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onResetChildTimer(childKey)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>다시 {tState.targetMinutes}분 준비</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isNoTimeLeft || (!tState.isRunning && exceedsRemaining)}
                          onClick={() => onToggleChildTimer(childKey)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                            isNoTimeLeft || (!tState.isRunning && exceedsRemaining)
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : tState.isRunning
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {tState.isRunning ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>일시정지</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{isPaused ? '이어서 시작' : '타이머 시작'}</span>
                            </>
                          )}
                        </button>

                        {isStarted && (
                          <button
                            type="button"
                            onClick={() => onResetChildTimer(childKey)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>초기화</span>
                          </button>
                        )}
                      </div>

                      {isStarted ? (
                        isParentMode && sum.remainingMinutes > 0 ? (
                          <button
                            type="button"
                            onClick={() => onDeductChildTimer(childKey, 'elapsed')}
                            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>중간 차감 (-{Math.min(elapsedMins, sum.remainingMinutes)}분)</span>
                          </button>
                        ) : (
                          !isParentMode && (
                            <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 tabular-nums">
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>부모님 로그인 후 타이머 제어 가능</span>
                            </span>
                          )
                        )
                      ) : (
                        !isParentMode && (
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>부모님 로그인 후 시작 가능</span>
                          </span>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Bank & Activity History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Time Bank (Left 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {currentConfig.name} 주말 유튜브 시간 뱅크
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  평일 {scoreSummary.weekdayScore}분 + 주말 보충 {scoreSummary.weekendMakeupScore}분 = 총{' '}
                  {scoreSummary.totalEarnedMinutes}분 확보 · 1점 = 1분 환산
                </p>
              </div>
            </div>
          </div>

          {/* Main Time Display */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-500">현재 시청 가능 잔여 시간</span>
                <div className="flex items-baseline gap-2.5 mt-1 tabular-nums">
                  <span
                    className={`text-4xl sm:text-5xl font-bold tracking-tight ${
                      scoreSummary.remainingMinutes === 0 ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {scoreSummary.remainingMinutes}분
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    ({formatMinutesReadable(scoreSummary.remainingMinutes)})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs tabular-nums">
                <div>
                  <span className="text-slate-500 block">총 획득</span>
                  <span className="text-base font-bold text-slate-900">
                    {scoreSummary.totalEarnedMinutes}분
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-500 block">누적 차감</span>
                  <span className="text-base font-bold text-red-600">
                    -{scoreSummary.usedMinutes}분
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-red-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${remainingRatio}%` }}
              />
            </div>
          </div>

          {/* Parent Deduction Controls */}
          {isParentMode ? (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  빠른 시청 시간 차감 (부모님 전용)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[10, 20, 30, 60].map((min) => (
                    <button
                      type="button"
                      key={min}
                      onClick={() => onDeductYoutube(min, `유튜브 ${min}분 시청`)}
                      className="py-3 px-4 rounded-xl font-semibold text-sm bg-slate-50 hover:bg-red-600 hover:text-white text-slate-800 border border-slate-200 hover:border-red-600 transition-colors flex items-center justify-center gap-1.5 tabular-nums"
                    >
                      <Minus className="w-4 h-4" />
                      <span>{min}분 차감</span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={watchMemoInput}
                  onChange={(e) => setWatchMemoInput(e.target.value)}
                  placeholder="시청 메모 (예: 토요일 오후 영상 시청)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div className="flex gap-2">
                  <div className="relative w-28">
                    <input
                      type="number"
                      min="1"
                      max="465"
                      value={customDeductInput}
                      onChange={(e) => setCustomDeductInput(e.target.value)}
                      placeholder="분"
                      className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-slate-200 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">
                      분
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    직접 차감
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>시간 차감 기능은 부모님 로그인 후 사용할 수 있습니다</span>
                </div>
                <p className="text-xs text-slate-500">
                  중복 차감을 막기 위해 최종 로그인된 부모님 기기에서만 타이머 조작 및 시간 차감이 가능합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>부모님 로그인</span>
              </button>
            </div>
          )}
        </div>

        {/* Activity Timeline Log (Right 1 column) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">시간 차감 · 보충 내역</h3>
              <p className="text-xs text-slate-500">시청 차감과 주말 보충 가점 기록</p>
            </div>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {(currentData.youtubeLogs || []).length}건
            </span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {(currentData.youtubeLogs || []).length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                아직 기록된 차감 및 보충 내역이 없습니다.
              </div>
            ) : (
              (currentData.youtubeLogs || []).map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    log.minutes > 0
                      ? 'bg-amber-50/50 border-amber-200/80 text-amber-950'
                      : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-semibold text-slate-900 leading-snug break-words">
                      {log.memo}
                    </div>
                    <div className="text-[11px] text-slate-400">{log.timestamp}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${
                        log.minutes > 0 ? 'text-amber-700' : 'text-red-600'
                      }`}
                    >
                      {log.minutes > 0 ? `+${log.minutes}분` : `${log.minutes}분`}
                    </span>
                    {isParentMode && (log.type === 'WATCH' || log.type === 'MAKEUP_ADD') && (
                      <button
                        type="button"
                        onClick={() => onUndoWatchLog(log.id)}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors"
                        title="이 내역 취소(복구)"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
