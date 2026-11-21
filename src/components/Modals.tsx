import React from 'react';
import { BellRing, CheckCircle2, KeyRound, Lock, Volume2, VolumeX, X } from 'lucide-react';
import { CLOTHES_SUB_ITEMS } from '../constants';
import { ChildConfig, ChildData, ChildKey, ConfirmDialogState, DayKey } from '../types';
import { buildTimerEndMessage } from '../utils/alarmAudio';

interface ClothesModalProps {
  modalData: { dayKey: DayKey; dayLabel: string } | null;
  currentConfig: ChildConfig;
  currentData: ChildData;
  isParentMode: boolean;
  onClose: () => void;
  onToggleSubItem: (dayKey: DayKey, dayLabel: string, subName: string) => void;
}

export const ClothesHelperModal: React.FC<ClothesModalProps> = ({
  modalData,
  currentConfig,
  currentData,
  isParentMode,
  onClose,
  onToggleSubItem
}) => {
  if (!modalData) return null;

  const daySubs = currentData.clothesSubChecks?.[modalData.dayKey] || {};
  const completedCount = CLOTHES_SUB_ITEMS.filter((s) => Boolean(daySubs[s])).length;
  const allCompleted = completedCount === CLOTHES_SUB_ITEMS.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {currentConfig.name} · {modalData.dayLabel}요일 옷 정리 8종 점검
            </h3>
            <p className="text-xs text-slate-500">
              8가지 항목을 모두 완료해야 성공(+7점)으로 인정됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <span className="font-semibold text-slate-700">
              완료 현황 {completedCount} / {CLOTHES_SUB_ITEMS.length}
            </span>
            <span
              className={`font-bold ${allCompleted ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              {allCompleted ? '올클리어 (+7점 인정)' : '미완료'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                allCompleted ? 'bg-emerald-600' : 'bg-teal-600'
              }`}
              style={{ width: `${(completedCount / CLOTHES_SUB_ITEMS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CLOTHES_SUB_ITEMS.map((sub) => {
            const isChecked = Boolean(daySubs[sub]);
            return (
              <button
                type="button"
                key={sub}
                onClick={() => onToggleSubItem(modalData.dayKey, modalData.dayLabel, sub)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                  isChecked
                    ? 'bg-teal-600 text-white border-teal-700 hover:bg-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{sub}</span>
                {isChecked ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <span className="text-[11px] text-slate-400">미완료</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {!isParentMode ? (
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>체크 수정은 부모님 로그인 후 가능</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">항목을 클릭해 상태를 변경하세요</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

interface PinModalProps {
  isOpen: boolean;
  changePinMode: boolean;
  pinInput: string;
  setPinInput: (val: string) => void;
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
  onClose: () => void;
  onLoginSubmit: (e: React.FormEvent) => void;
  onSaveNewPinSubmit: (e: React.FormEvent) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  changePinMode,
  pinInput,
  setPinInput,
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
  onClose,
  onLoginSubmit,
  onSaveNewPinSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-700" />
            <span>{changePinMode ? '부모님 비밀번호 변경' : '부모님 모드 로그인'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {changePinMode ? (
          <form onSubmit={onSaveNewPinSubmit} className="space-y-3">
            <p className="text-xs text-slate-500">
              현재 비밀번호 확인 후 새 비밀번호(4자리 이상 · 숫자/영문/특수문자 가능)를 입력하세요.
            </p>
            <div className="space-y-2">
              <input
                type={showPinText ? 'text' : 'password'}
                value={currentPinForChange}
                onChange={(e) => {
                  setCurrentPinForChange(e.target.value);
                  setPinError('');
                }}
                placeholder="현재 비밀번호 입력"
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type={showPinText ? 'text' : 'password'}
                value={newPinInput}
                onChange={(e) => {
                  setNewPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="새 비밀번호 입력 (4자 이상)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type={showPinText ? 'text' : 'password'}
                value={confirmNewPinInput}
                onChange={(e) => {
                  setConfirmNewPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="새 비밀번호 한 번 더 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPinText}
                onChange={(e) => setShowPinText(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>비밀번호 문자 보기</span>
            </label>
            {pinError && <p className="text-xs font-semibold text-red-600">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              새 비밀번호 저장
            </button>
          </form>
        ) : (
          <form onSubmit={onLoginSubmit} className="space-y-3">
            <p className="text-xs text-slate-500">
              점수 채점, 유튜브 시간 차감, 칭찬스티커 발급을 위해 비밀번호를 입력하세요. (초기값:{' '}
              <span className="font-mono font-semibold text-slate-700">1234</span>)
            </p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {pinError && <p className="text-xs font-semibold text-red-600">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              부모님 모드로 로그인
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ dialog, onClose }) => {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <h3 className="text-base font-bold text-slate-900">{dialog.title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed">{dialog.message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={dialog.onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
          >
            {dialog.confirmText || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RingingChildItem {
  childKey: ChildKey;
  name: string;
  info: string;
  targetMinutes: number;
  remainingMinutes: number;
}

interface TimerAlarmModalProps {
  ringingChildren: RingingChildItem[];
  isParentMode: boolean;
  onDismissOnly: (childKey: ChildKey) => void;
  onDismissAndDeduct: (childKey: ChildKey) => void;
}

export const TimerAlarmModal: React.FC<TimerAlarmModalProps> = ({
  ringingChildren,
  isParentMode,
  onDismissOnly,
  onDismissAndDeduct
}) => {
  if (ringingChildren.length === 0) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="유튜브 시청 시간 종료 알림"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-red-500 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 animate-pulse">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">유튜브 시청 시간 종료!</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>알림 해제를 누를 때까지 알림음이 반복 재생됩니다.</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {ringingChildren.map((child) => {
            const voiceMsg = buildTimerEndMessage(child.name, child.targetMinutes);
            const deductAmt =
              child.remainingMinutes > 0
                ? Math.min(child.targetMinutes, child.remainingMinutes)
                : 0;

            return (
              <div
                key={child.childKey}
                className="rounded-xl border border-red-200 bg-red-50/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                        child.childKey === 'suhyun' ? 'bg-blue-600' : 'bg-rose-600'
                      }`}
                    >
                      {child.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {child.name} ({child.info}) · 설정 {child.targetMinutes}분 완료
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-600 tabular-nums">
                    00:00
                  </span>
                </div>

                <div className="rounded-xl bg-white border border-red-200/80 px-3.5 py-2.5 text-sm font-bold text-red-700 text-center">
                  “{voiceMsg}”
                </div>

                <div className="space-y-2">
                  {deductAmt > 0 ? (
                    <button
                      type="button"
                      onClick={() => onDismissAndDeduct(child.childKey)}
                      className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>알림 해제 + {deductAmt}분 차감</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDismissOnly(child.childKey)}
                      className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <VolumeX className="w-4 h-4 shrink-0" />
                      <span>알림 해제 (잔여 시간 0분)</span>
                    </button>
                  )}

                  {deductAmt > 0 && !isParentMode && (
                    <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>알림이 즉시 꺼진 뒤 부모님 인증으로 {deductAmt}분이 차감됩니다.</span>
                    </div>
                  )}

                  {deductAmt > 0 && (
                    <button
                      type="button"
                      onClick={() => onDismissOnly(child.childKey)}
                      className="w-full py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <VolumeX className="w-3.5 h-3.5 shrink-0" />
                      <span>알림만 해제 (차감 보류)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
