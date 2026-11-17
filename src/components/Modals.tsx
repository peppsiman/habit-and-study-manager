import React from 'react';
import { CheckCircle2, KeyRound, Lock, X } from 'lucide-react';
import { CLOTHES_SUB_ITEMS } from '../constants';
import { ChildConfig, ChildData, ConfirmDialogState, DayKey } from '../types';

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
