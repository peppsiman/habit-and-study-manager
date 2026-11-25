import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  CloudOff,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User
} from 'lucide-react';
import { CHILDREN_CONFIG } from '../constants';
import {
  ChildConfig,
  ChildKey,
  CloudStorageType,
  ParentSessionInfo,
  SyncStatus
} from '../types';

interface SettingsTabProps {
  isParentMode: boolean;
  currentPinForChange: string;
  setCurrentPinForChange: (val: string) => void;
  newPinInput: string;
  setNewPinInput: (val: string) => void;
  confirmNewPinInput: string;
  setConfirmNewPinInput: (val: string) => void;
  showPinText: boolean;
  setShowPinText: (val: boolean) => void;
  pinError: string;
  setPinError: (val: string) => void;
  onSaveNewPin: (e: React.FormEvent) => void;
  onOpenLogin: () => void;
  onResetAllDataExceptStickers: () => void;
  syncStatus: SyncStatus;
  storageType: CloudStorageType;
  lastSyncedAt: number | null;
  onManualSync: () => void;
  activeParentSession: ParentSessionInfo | null;
  isCurrentDeviceOwner: boolean;
  effectiveConfigs: Record<ChildKey, ChildConfig>;
  onSaveItemScores: (nextScores: Record<ChildKey, Record<string, number>>) => void;
  childPins: Record<ChildKey, string>;
  onSaveChildPin: (childKey: ChildKey, newPin: string) => boolean;
  onPreviewDynamicScoring: () => void;
}

function buildDraftFromConfigs(
  configs: Record<ChildKey, ChildConfig>
): Record<ChildKey, Record<string, string>> {
  const buildChild = (ck: ChildKey) => {
    const cfg = configs[ck];
    return [...cfg.studyItems, ...cfg.habitItems].reduce((acc, it) => {
      acc[it.id] = String(it.score);
      return acc;
    }, {} as Record<string, string>);
  };
  return {
    suhyun: buildChild('suhyun'),
    dahyun: buildChild('dahyun')
  };
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  isParentMode,
  currentPinForChange,
  setCurrentPinForChange,
  newPinInput,
  setNewPinInput,
  confirmNewPinInput,
  setConfirmNewPinInput,
  showPinText,
  setShowPinText,
  pinError,
  setPinError,
  onSaveNewPin,
  onOpenLogin,
  onResetAllDataExceptStickers,
  syncStatus,
  storageType,
  lastSyncedAt,
  onManualSync,
  activeParentSession,
  isCurrentDeviceOwner,
  effectiveConfigs,
  onSaveItemScores,
  childPins,
  onSaveChildPin,
  onPreviewDynamicScoring
}) => {
  const [draftChildPins, setDraftChildPins] = useState<Record<ChildKey, string>>(() => ({
    suhyun: childPins.suhyun,
    dahyun: childPins.dahyun
  }));

  useEffect(() => {
    setDraftChildPins({
      suhyun: childPins.suhyun,
      dahyun: childPins.dahyun
    });
  }, [childPins]);

  const [draftScores, setDraftScores] = useState<Record<ChildKey, Record<string, string>>>(() =>
    buildDraftFromConfigs(effectiveConfigs)
  );

  useEffect(() => {
    setDraftScores(buildDraftFromConfigs(effectiveConfigs));
  }, [effectiveConfigs]);

  const getDraftNumber = useCallback(
    (ck: ChildKey, itemId: string, fallback: number): number => {
      const raw = draftScores[ck]?.[itemId];
      if (raw === undefined || raw.trim() === '') return fallback;
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) return fallback;
      return Math.min(200, Math.max(0, Math.round(parsed)));
    },
    [draftScores]
  );

  const hasUnsavedChanges = useMemo(() => {
    return (['suhyun', 'dahyun'] as ChildKey[]).some((ck) => {
      const cfg = effectiveConfigs[ck];
      return [...cfg.studyItems, ...cfg.habitItems].some((it) => {
        const draftRaw = draftScores[ck]?.[it.id] ?? String(it.score);
        if (draftRaw.trim() === '') return true;
        return getDraftNumber(ck, it.id, it.score) !== it.score;
      });
    });
  }, [draftScores, effectiveConfigs, getDraftNumber]);

  const isDefaultDraftScores = useMemo(() => {
    return (['suhyun', 'dahyun'] as ChildKey[]).every((ck) => {
      const defCfg = CHILDREN_CONFIG[ck];
      return [...defCfg.studyItems, ...defCfg.habitItems].every(
        (it) => getDraftNumber(ck, it.id, it.score) === it.score
      );
    });
  }, [getDraftNumber]);

  const handleScoreInputChange = (ck: ChildKey, itemId: string, val: string) => {
    if (val === '' || /^\d{0,3}$/.test(val)) {
      setDraftScores((prev) => ({
        ...prev,
        [ck]: {
          ...prev[ck],
          [itemId]: val
        }
      }));
    }
  };

  const handleScoreInputBlur = (ck: ChildKey, itemId: string, savedScore: number) => {
    const normalized = String(getDraftNumber(ck, itemId, savedScore));
    setDraftScores((prev) => ({
      ...prev,
      [ck]: {
        ...prev[ck],
        [itemId]: normalized
      }
    }));
  };

  const handleLoadDefaultScores = () => {
    setDraftScores(buildDraftFromConfigs(CHILDREN_CONFIG));
  };

  const handleCancelScoreEdits = () => {
    setDraftScores(buildDraftFromConfigs(effectiveConfigs));
  };

  const handleSaveScoresClick = () => {
    const nextScores: Record<ChildKey, Record<string, number>> = {
      suhyun: {},
      dahyun: {}
    };
    (['suhyun', 'dahyun'] as ChildKey[]).forEach((ck) => {
      const cfg = effectiveConfigs[ck];
      [...cfg.studyItems, ...cfg.habitItems].forEach((it) => {
        nextScores[ck][it.id] = getDraftNumber(ck, it.id, it.score);
      });
    });
    onSaveItemScores(nextScores);
  };
  const storageLabel =
    storageType === 'kv'
      ? 'Cloudflare KV 연결됨'
      : storageType === 'd1'
      ? 'Cloudflare D1 연결됨'
      : storageType === 'local-file'
      ? '로컬 개발 서버 저장소 (.wrangler)'
      : '브라우저 로컬 저장소 (KV 미연결)';

  const syncStatusLabel =
    syncStatus === 'synced'
      ? '동기화 완료'
      : syncStatus === 'syncing'
      ? '저장 및 동기화 중...'
      : syncStatus === 'loading'
      ? '초기 데이터 불러오는 중...'
      : syncStatus === 'error'
      ? '동기화 오류 발생'
      : '로컬 전용 모드';

  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '기록 없음';

  const parentSessionLabel = isCurrentDeviceOwner
    ? '현재 기기에서 부모님 로그인 중'
    : activeParentSession
    ? `다른 기기(${activeParentSession.deviceLabel || '웹 기기'})에서 로그인 중`
    : '로그인된 부모 기기 없음';

  return (
    <section className="space-y-6">
      {/* Cloud Sync Status (Cloudflare KV / D1) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                storageType !== 'none' && syncStatus !== 'error'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {storageType !== 'none' && syncStatus !== 'error' ? (
                <Cloud className="w-5 h-5" />
              ) : (
                <CloudOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                클라우드 동기화 상태 (Cloudflare KV / D1)
              </h2>
              <p className="text-xs text-slate-500">
                엄마·아빠 휴대폰, 태블릿, PC 어디서 접속해도 동일한 점수와 스티커가 유지됩니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onManualSync}
            disabled={syncStatus === 'syncing' || syncStatus === 'loading'}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                syncStatus === 'syncing' || syncStatus === 'loading' ? 'animate-spin' : ''
              }`}
            />
            <span>지금 동기화 새로고침</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-slate-400 font-semibold">연결 저장소</div>
            <div className="font-bold text-slate-900">{storageLabel}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-slate-400 font-semibold">동기화 상태</div>
            <div className="font-bold text-slate-900">{syncStatusLabel}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-slate-400 font-semibold">최근 동기화 시각</div>
            <div className="font-bold text-slate-900 tabular-nums">{lastSyncedLabel}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-slate-400 font-semibold">활성 부모님 기기</div>
            <div
              className={`font-bold ${
                isCurrentDeviceOwner
                  ? 'text-emerald-700'
                  : activeParentSession
                  ? 'text-amber-700'
                  : 'text-slate-700'
              }`}
            >
              {parentSessionLabel}
            </div>
          </div>
        </div>

        {storageType === 'none' && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
            현재 Cloudflare KV 또는 D1 바인딩이 연결되지 않아 이 기기의 브라우저(localStorage)에만 저장되고 있습니다. Cloudflare Pages 설정에서 <code className="font-mono font-semibold">KIDS_EDU_KV</code> 바인딩을 추가하면 모든 기기 간 자동 동기화가 활성화됩니다.
          </div>
        )}
      </div>

      {/* Parent PIN Security Management */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                부모님 모드 비밀번호 설정 관리
              </h2>
              <p className="text-xs text-slate-500">
                숫자, 영문(대·소문자), 특수문자를 조합해 4자리 이상으로 설정할 수 있습니다.
              </p>
            </div>
          </div>

          {isParentMode && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              <span>부모님 모드 인증됨</span>
            </span>
          )}
        </div>

        {isParentMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <form
              onSubmit={onSaveNewPin}
              className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 space-y-3.5"
            >
              <h3 className="text-sm font-bold text-slate-900">새 비밀번호로 변경</h3>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">
                  현재 비밀번호
                </label>
                <input
                  type={showPinText ? 'text' : 'password'}
                  value={currentPinForChange}
                  onChange={(e) => {
                    setCurrentPinForChange(e.target.value);
                    setPinError('');
                  }}
                  placeholder="현재 비밀번호 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">
                  새 비밀번호 (4자리 이상 · 숫자/영문/특수문자 가능)
                </label>
                <input
                  type={showPinText ? 'text' : 'password'}
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="새 비밀번호 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">
                  새 비밀번호 확인
                </label>
                <input
                  type={showPinText ? 'text' : 'password'}
                  value={confirmNewPinInput}
                  onChange={(e) => {
                    setConfirmNewPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={showPinText}
                  onChange={(e) => setShowPinText(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>입력한 비밀번호 표시</span>
              </label>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                비밀번호 변경 저장
              </button>
            </form>

            <div className="p-5 rounded-xl border border-slate-200/80 bg-white space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-700" />
                  <span>자녀 로그인 비밀번호 관리</span>
                </h4>
                <p className="text-xs text-slate-500">
                  자녀용 로그인 시 사용하는 비밀번호입니다. (초기값: 수현 8864 · 다현 7749)
                </p>

                {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
                  const cfg = CHILDREN_CONFIG[ck];
                  const val = draftChildPins[ck] ?? '';
                  const changed = val.trim() !== childPins[ck];
                  return (
                    <form
                      key={ck}
                      onSubmit={(e) => {
                        e.preventDefault();
                        onSaveChildPin(ck, val);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                    >
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white shrink-0 ${
                          ck === 'suhyun' ? 'bg-blue-600' : 'bg-rose-600'
                        }`}
                      >
                        {cfg.name.slice(0, 1)}
                      </span>
                      <span className="text-xs font-bold text-slate-900 w-10 shrink-0">
                        {cfg.name}
                      </span>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        value={val}
                        onChange={(e) =>
                          setDraftChildPins((prev) => ({
                            ...prev,
                            [ck]: e.target.value
                          }))
                        }
                        placeholder="4자리 이상"
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={!changed || val.trim().length < 4}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        저장
                      </button>
                    </form>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <h4 className="text-sm font-bold text-slate-900">보안 및 운영 안내</h4>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>변경한 비밀번호는 클라우드에 즉시 저장되어 모든 기기에서 적용됩니다.</li>
                  <li>채점이나 시간 차감을 마친 뒤에는 상단의 로그아웃 버튼으로 잠금하세요.</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>비밀번호 변경은 부모님 로그인 후 가능합니다</span>
              </div>
              <p className="text-xs text-slate-500">
                현재 부모님 비밀번호로 로그인하면 새 비밀번호로 변경할 수 있습니다. (초기값: 1234)
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 transition-colors self-start sm:self-auto"
            >
              부모님 암호 로그인
            </button>
          </div>
        )}
      </div>

      {/* Scoring Matrix & Data Reset */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              수현 · 다현 평가 항목 및 배점 기준표
            </h2>
            <p className="text-xs text-slate-500">
              평일 획득 점수 + 주말 보충 가점 = 주말 유튜브 시청 가능 시간 (1점 = 1분)
              {!isParentMode && ' · 배점 수정은 부모님 로그인 후 가능'}
            </p>
          </div>

          {isParentMode && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPreviewDynamicScoring}
                className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>자동 배점 계산 미리보기</span>
              </button>
              <button
                type="button"
                disabled={isDefaultDraftScores}
                onClick={handleLoadDefaultScores}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                기본 배점 불러오기
              </button>
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={handleCancelScoreEdits}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  취소
                </button>
              )}
              <button
                type="button"
                disabled={!hasUnsavedChanges}
                onClick={handleSaveScoresClick}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>배점 변경 저장</span>
              </button>
              <button
                type="button"
                onClick={onResetAllDataExceptStickers}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>데이터 초기화 (칭찬스티커 제외)</span>
              </button>
            </div>
          )}
        </div>

        {isParentMode && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              배점을 수정하고 <strong>배점 변경 저장</strong>을 누르면 앞으로 새로 체크하는 항목부터 새 배점이 적용됩니다. 이미 완료한 항목의 점수는 기존 배점 그대로 유지됩니다.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
            const cfg = effectiveConfigs[ck];
            const isSuhyun = ck === 'suhyun';
            const studyDaily = cfg.studyItems.reduce(
              (a, b) => a + (isParentMode ? getDraftNumber(ck, b.id, b.score) : b.score),
              0
            );
            const habitDaily = cfg.habitItems.reduce(
              (a, b) => a + (isParentMode ? getDraftNumber(ck, b.id, b.score) : b.score),
              0
            );
            const dailyTotal = studyDaily + habitDaily;
            const weeklyTotal = dailyTotal * 5;

            return (
              <div
                key={ck}
                className="rounded-xl border border-slate-200/90 overflow-hidden bg-white"
              >
                <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                        isSuhyun ? 'bg-blue-600' : 'bg-rose-600'
                      }`}
                    >
                      {cfg.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {cfg.name} · {cfg.info}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    일일 {dailyTotal}점 · 주간 {weeklyTotal}점
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="px-4 py-2 bg-slate-50/50 font-semibold text-slate-600 flex justify-between tabular-nums">
                    <span>개별 학습과목 ({cfg.studyItems.length}과목)</span>
                    <span>일일 {studyDaily}점</span>
                  </div>
                  {cfg.studyItems.map((it) => {
                    const draftVal = draftScores[ck]?.[it.id] ?? String(it.score);
                    const numericDraft = getDraftNumber(ck, it.id, it.score);
                    const isModified = isParentMode && numericDraft !== it.score;

                    return (
                      <div
                        key={it.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 text-slate-700"
                      >
                        <span className="font-medium">{it.name}</span>
                        {isParentMode ? (
                          <div className="flex items-center gap-2 shrink-0">
                            {isModified && (
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                기존 {it.score}점
                              </span>
                            )}
                            <div className="relative w-20">
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={draftVal}
                                onChange={(e) =>
                                  handleScoreInputChange(ck, it.id, e.target.value)
                                }
                                onBlur={() => handleScoreInputBlur(ck, it.id, it.score)}
                                aria-label={`${cfg.name} ${it.name} 배점`}
                                className={`w-full pl-2.5 pr-6 py-1 rounded-lg border text-right font-mono font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 ${
                                  isModified
                                    ? isSuhyun
                                      ? 'border-blue-500 bg-blue-50/40 focus:ring-blue-500'
                                      : 'border-rose-500 bg-rose-50/40 focus:ring-rose-500'
                                    : 'border-slate-300 bg-white focus:ring-slate-900'
                                }`}
                              />
                              <span className="absolute right-2 top-1 text-[11px] text-slate-400 pointer-events-none">
                                점
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {it.score}점
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <div className="px-4 py-2 bg-slate-50/50 font-semibold text-slate-600 flex justify-between tabular-nums">
                    <span>공통 생활습관 ({cfg.habitItems.length}항목)</span>
                    <span>일일 {habitDaily}점</span>
                  </div>
                  {cfg.habitItems.map((it) => {
                    const draftVal = draftScores[ck]?.[it.id] ?? String(it.score);
                    const numericDraft = getDraftNumber(ck, it.id, it.score);
                    const isModified = isParentMode && numericDraft !== it.score;

                    return (
                      <div
                        key={it.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 text-slate-700"
                      >
                        <span className="font-medium">
                          {it.shortName || it.name}
                          {it.subItems && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {it.subItems.join(', ')}
                            </span>
                          )}
                        </span>
                        {isParentMode ? (
                          <div className="flex items-center gap-2 shrink-0">
                            {isModified && (
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                기존 {it.score}점
                              </span>
                            )}
                            <div className="relative w-20">
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={draftVal}
                                onChange={(e) =>
                                  handleScoreInputChange(ck, it.id, e.target.value)
                                }
                                onBlur={() => handleScoreInputBlur(ck, it.id, it.score)}
                                aria-label={`${cfg.name} ${it.shortName || it.name} 배점`}
                                className={`w-full pl-2.5 pr-6 py-1 rounded-lg border text-right font-mono font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 ${
                                  isModified
                                    ? isSuhyun
                                      ? 'border-blue-500 bg-blue-50/40 focus:ring-blue-500'
                                      : 'border-rose-500 bg-rose-50/40 focus:ring-rose-500'
                                    : 'border-slate-300 bg-white focus:ring-slate-900'
                                }`}
                              />
                              <span className="absolute right-2 top-1 text-[11px] text-slate-400 pointer-events-none">
                                점
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                            {it.score}점
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
