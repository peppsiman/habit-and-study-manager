import React from 'react';
import { Cloud, CloudOff, KeyRound, Lock, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { CHILDREN_CONFIG } from '../constants';
import { ChildKey, CloudStorageType, SyncStatus } from '../types';

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
  onManualSync
}) => {
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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

            <div className="p-5 rounded-xl border border-slate-200/80 bg-white space-y-3 text-xs text-slate-600 leading-relaxed">
              <h4 className="text-sm font-bold text-slate-900">보안 및 운영 안내</h4>
              <ul className="space-y-2 list-disc list-inside">
                <li>변경한 비밀번호는 브라우저에 즉시 저장되어 다음 접속 시에도 유지됩니다.</li>
                <li>숫자뿐만 아니라 영문 대·소문자 및 특수문자를 조합하여 안전하게 설정할 수 있습니다.</li>
                <li>채점이나 시간 차감을 마친 뒤에는 상단의 로그아웃 버튼으로 자녀용 조회 모드로 전환하세요.</li>
              </ul>
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
            </p>
          </div>

          {isParentMode && (
            <button
              type="button"
              onClick={onResetAllDataExceptStickers}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>데이터 초기화 (칭찬스티커 제외)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
            const cfg = CHILDREN_CONFIG[ck];
            const studyDaily = cfg.studyItems.reduce((a, b) => a + b.score, 0);
            const habitDaily = cfg.habitItems.reduce((a, b) => a + b.score, 0);

            return (
              <div
                key={ck}
                className="rounded-xl border border-slate-200/90 overflow-hidden bg-white"
              >
                <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                        ck === 'suhyun' ? 'bg-blue-600' : 'bg-rose-600'
                      }`}
                    >
                      {cfg.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {cfg.name} · {cfg.info}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    일일 {cfg.dailyMaxScore}점 · 주간 {cfg.weeklyMaxScore}점
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="px-4 py-2 bg-slate-50/50 font-semibold text-slate-600 flex justify-between tabular-nums">
                    <span>개별 학습과목 ({cfg.studyItems.length}과목)</span>
                    <span>일일 {studyDaily}점</span>
                  </div>
                  {cfg.studyItems.map((it) => (
                    <div
                      key={it.id}
                      className="px-4 py-2.5 flex items-center justify-between text-slate-700"
                    >
                      <span className="font-medium">{it.name}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {it.score}점
                      </span>
                    </div>
                  ))}

                  <div className="px-4 py-2 bg-slate-50/50 font-semibold text-slate-600 flex justify-between tabular-nums">
                    <span>공통 생활습관 (3항목)</span>
                    <span>일일 {habitDaily}점</span>
                  </div>
                  {cfg.habitItems.map((it) => (
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
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {it.score}점
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
