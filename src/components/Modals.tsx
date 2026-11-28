import React from 'react';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  KeyRound,
  Lock,
  Sparkles,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { CHILDREN_CONFIG, CLOTHES_SUB_ITEMS } from '../constants';
import {
  ChildConfig,
  ChildKey,
  ConfirmDialogState,
  DayKey,
  DynamicScoreProposal,
  WeeklyRecord
} from '../types';
import { buildTimerEndMessage } from '../utils/alarmAudio';
import { formatWeekRangeLabel } from '../utils/weekUtils';

interface ClothesModalProps {
  modalData: { dayKey: DayKey; dayLabel: string } | null;
  currentConfig: ChildConfig;
  weekRecord: WeeklyRecord;
  isParentMode: boolean;
  onClose: () => void;
  onToggleSubItem: (dayKey: DayKey, dayLabel: string, subName: string) => void;
}

export const ClothesHelperModal: React.FC<ClothesModalProps> = ({
  modalData,
  currentConfig,
  weekRecord,
  isParentMode,
  onClose,
  onToggleSubItem
}) => {
  if (!modalData) return null;

  const daySubs = weekRecord.clothesSubChecks?.[modalData.dayKey] || {};
  const completedCount = CLOTHES_SUB_ITEMS.filter((s) => Boolean(daySubs[s])).length;
  const allCompleted = completedCount === CLOTHES_SUB_ITEMS.length;
  const clothesScore =
    currentConfig.habitItems.find((i) => i.id === 'hb_clothes_all')?.score ?? 7;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D2A32]/35 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EAE6E0] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#2D2A32]">
              {currentConfig.name} · {modalData.dayLabel}요일 옷 정리 8종 점검
            </h3>
            <p className="text-xs text-stone-500">
              8가지 항목을 모두 완료해야 성공(+{clothesScore}점)으로 인정됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DD] text-stone-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <span className="font-semibold text-stone-700">
              완료 현황 {completedCount} / {CLOTHES_SUB_ITEMS.length}
            </span>
            <span
              className={`font-bold ${allCompleted ? 'text-[#176448]' : 'text-stone-400'}`}
            >
              {allCompleted ? `올클리어 (+${clothesScore}점 인정)` : '미완료'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#F2EFEA] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                allCompleted ? 'bg-[#56B892]' : 'bg-[#73C2AF]'
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
                    ? 'bg-[#DCF5EA] text-[#176448] border-[#B2E6D0] hover:bg-[#CBEBD9]'
                    : 'bg-[#FAF8F5] text-stone-700 border-[#EAE6E0] hover:bg-[#F2EFEA]'
                }`}
              >
                <span>{sub}</span>
                {isChecked ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <span className="text-[11px] text-stone-400">미완료</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#F2EFE9]">
          {!isParentMode ? (
            <span className="text-[11px] text-stone-500 inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#C28024]" />
              <span>체크 수정은 부모님 로그인 후 가능</span>
            </span>
          ) : (
            <span className="text-[11px] text-stone-400">항목을 클릭해 상태를 변경하세요</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#4B4670] hover:bg-[#3D385C] text-white text-xs font-semibold transition-colors"
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
  activeOtherDevice?: { deviceLabel?: string; loggedInAt: number } | null;
  isLoggingIn?: boolean;
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
  activeOtherDevice = null,
  isLoggingIn = false,
  onClose,
  onLoginSubmit,
  onSaveNewPinSubmit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D2A32]/35 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EAE6E0] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#2D2A32] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#4B4670]" />
            <span>{changePinMode ? '부모님 비밀번호 변경' : '부모님 모드 로그인'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DD] text-stone-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {changePinMode ? (
          <form onSubmit={onSaveNewPinSubmit} className="space-y-3">
            <p className="text-xs text-stone-500">
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
                className="w-full px-4 py-2.5 rounded-xl border border-[#DDD7CF] bg-[#FDFCFB] text-center text-sm font-bold text-[#2D2A32] tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8B82C4]"
              />
              <input
                type={showPinText ? 'text' : 'password'}
                value={newPinInput}
                onChange={(e) => {
                  setNewPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="새 비밀번호 입력 (4자 이상)"
                className="w-full px-4 py-2.5 rounded-xl border border-[#DDD7CF] bg-[#FDFCFB] text-center text-sm font-bold text-[#2D2A32] tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8B82C4]"
              />
              <input
                type={showPinText ? 'text' : 'password'}
                value={confirmNewPinInput}
                onChange={(e) => {
                  setConfirmNewPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="새 비밀번호 한 번 더 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-[#DDD7CF] bg-[#FDFCFB] text-center text-sm font-bold text-[#2D2A32] tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8B82C4]"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-stone-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPinText}
                onChange={(e) => setShowPinText(e.target.checked)}
                className="rounded border-stone-300"
              />
              <span>비밀번호 문자 보기</span>
            </label>
            {pinError && <p className="text-xs font-semibold text-[#B8413A]">{pinError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#4B4670] hover:bg-[#3D385C] text-white text-sm font-semibold transition-colors"
            >
              새 비밀번호 저장
            </button>
          </form>
        ) : (
          <form onSubmit={onLoginSubmit} className="space-y-3">
            <p className="text-xs text-stone-500">
              점수 채점, 유튜브 타이머 제어·차감, 칭찬스티커 발급을 위해 비밀번호를 입력하세요. (초기값:{' '}
              <span className="font-mono font-semibold text-[#2D2A32]">1234</span>)
            </p>
            {activeOtherDevice && (
              <div className="p-3 rounded-xl bg-[#FEF6E4] border border-[#F6DFAC] text-xs text-[#8A5615] leading-relaxed">
                현재 다른 기기(
                <span className="font-bold">{activeOtherDevice.deviceLabel || '다른 기기'}</span>
                )에서 부모님 로그인 중입니다. 이 기기에서 로그인하면 기존 기기는 자동 로그아웃됩니다.
              </div>
            )}
            <input
              type="password"
              value={pinInput}
              disabled={isLoggingIn}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-[#DDD7CF] bg-[#FDFCFB] text-center text-lg font-bold text-[#2D2A32] tracking-widest focus:outline-none focus:ring-2 focus:ring-[#8B82C4] disabled:bg-[#F5F2EE]"
            />
            {pinError && <p className="text-xs font-semibold text-[#B8413A]">{pinError}</p>}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 rounded-xl bg-[#4B4670] hover:bg-[#3D385C] disabled:bg-stone-300 text-white text-sm font-semibold transition-colors"
            >
              {isLoggingIn ? '로그인 및 동기화 중...' : '부모님 모드로 로그인'}
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
    <div className="fixed inset-0 z-50 bg-[#2D2A32]/35 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EAE6E0] space-y-4">
        <h3 className="text-base font-bold text-[#2D2A32]">{dialog.title}</h3>
        <p className="text-xs text-stone-600 leading-relaxed">{dialog.message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F5F2ED] hover:bg-[#EAE5DD] text-stone-700 text-xs font-semibold transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={dialog.onConfirm}
            className="px-4 py-2 rounded-xl bg-[#E26D65] hover:bg-[#D35B53] text-white text-xs font-semibold transition-colors"
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
      className="fixed inset-0 z-50 bg-[#2D2A32]/45 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-[#F2A7A1] space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#FFEAE8] text-[#C44B43] flex items-center justify-center shrink-0 animate-pulse">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#2D2A32]">유튜브 시청 시간 종료!</h3>
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-[#D35B53] shrink-0" />
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
                className="rounded-2xl border border-[#F8CBC7] bg-[#FFF5F4] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                        child.childKey === 'suhyun' ? 'bg-[#6B9CE8]' : 'bg-[#E2849B]'
                      }`}
                    >
                      {child.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-[#2D2A32]">
                      {child.name} ({child.info}) · 설정 {child.targetMinutes}분 완료
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#C94942] tabular-nums">
                    00:00
                  </span>
                </div>

                <div className="rounded-xl bg-white border border-[#F8CBC7] px-3.5 py-2.5 text-sm font-bold text-[#B8413A] text-center">
                  “{voiceMsg}”
                </div>

                <div className="space-y-2">
                  {deductAmt > 0 ? (
                    <button
                      type="button"
                      onClick={() => onDismissAndDeduct(child.childKey)}
                      className="w-full py-3 px-4 rounded-xl bg-[#E26D65] hover:bg-[#D35B53] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>알림 해제 + {deductAmt}분 차감</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDismissOnly(child.childKey)}
                      className="w-full py-3 px-4 rounded-xl bg-[#E26D65] hover:bg-[#D35B53] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <VolumeX className="w-4 h-4 shrink-0" />
                      <span>알림 해제 (잔여 시간 0분)</span>
                    </button>
                  )}

                  {deductAmt > 0 && !isParentMode && (
                    <div className="text-[11px] text-stone-500 flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3 text-[#C28024] shrink-0" />
                      <span>알림이 즉시 꺼진 뒤 부모님 인증으로 {deductAmt}분이 차감됩니다.</span>
                    </div>
                  )}

                  {deductAmt > 0 && (
                    <button
                      type="button"
                      onClick={() => onDismissOnly(child.childKey)}
                      className="w-full py-2 px-4 rounded-xl bg-white hover:bg-[#FAF8F5] text-stone-700 border border-[#E5E0D8] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
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

interface DynamicScoreProposalModalProps {
  proposal: DynamicScoreProposal | null;
  onApprove: () => void;
  onReject: () => void;
}

export const DynamicScoreProposalModal: React.FC<DynamicScoreProposalModalProps> = ({
  proposal,
  onApprove,
  onReject
}) => {
  if (!proposal || proposal.status !== 'pending') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="주간 개별 학습과목 자동 배점 변경 안내"
      className="fixed inset-0 z-50 bg-[#2D2A32]/35 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-[#EAE6E0] space-y-5 my-6">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F2EFE9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#4C6EC5] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#2D2A32]">
                새로운 주간 자동 배점 기준 안내
              </h3>
              <p className="text-xs text-stone-500">
                대상 주차: <span className="font-semibold text-[#2D2A32]">{formatWeekRangeLabel(proposal.weekId)}</span> · 지난 주차까지의 누적 수행 횟수를 바탕으로 계산되었습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReject}
            className="p-1.5 rounded-lg bg-[#F5F2ED] hover:bg-[#EAE5DD] text-stone-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F3F6FF] border border-[#D6E2FC] text-xs text-[#2F4A8A] leading-relaxed">
          수행 횟수가 적은 과목에는 높은 배점을, 많이 수행한 과목에는 낮은 배점을 부여해 균형 잡힌 학습을 돕습니다.
          <br />
          <strong>공통 생활습관(옷 정리·물통·세수·독서)</strong>과 <strong>과거 주차에 이미 획득한 점수</strong>는 그대로 유지되며, 부모님이 동의하실 경우에만 새 배점이 적용됩니다.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
            const cfg = CHILDREN_CONFIG[ck];
            const childProp = proposal.children[ck];
            const isSuhyun = ck === 'suhyun';

            return (
              <div
                key={ck}
                className="rounded-2xl border border-[#EAE6E0] overflow-hidden bg-white"
              >
                <div className="px-4 py-3 bg-[#FAF8F5] border-b border-[#EAE6E0] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
                        isSuhyun ? 'bg-[#6B9CE8]' : 'bg-[#E2849B]'
                      }`}
                    >
                      {cfg.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-[#2D2A32]">
                      {cfg.name} 개별 학습과목
                    </span>
                  </div>
                  <span className="text-xs font-bold text-stone-700 tabular-nums">
                    합계 {childProp.totalTarget}점 고정
                  </span>
                </div>

                <div className="divide-y divide-[#F3EFE9] text-xs">
                  {childProp.items.map((item) => {
                    const diff = item.proposedScore - item.previousScore;
                    return (
                      <div
                        key={item.itemId}
                        className="px-4 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#2D2A32]">{item.name}</div>
                          <div className="text-[11px] text-stone-400">
                            {item.pairedLabel
                              ? item.pairedLabel
                              : `누적 ${item.completedCount}회 수행`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono tabular-nums shrink-0">
                          <span className="text-stone-400">{item.previousScore}점</span>
                          <ArrowRight className="w-3 h-3 text-stone-400" />
                          <span
                            className={`font-bold px-2 py-0.5 rounded-md ${
                              diff > 0
                                ? 'bg-[#DCF5EA] text-[#176448]'
                                : diff < 0
                                ? 'bg-[#FEF2D6] text-[#9A5B13]'
                                : 'bg-[#F3F0EB] text-stone-700'
                            }`}
                          >
                            {item.proposedScore}점
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#F2EFE9]">
          <button
            type="button"
            onClick={onReject}
            className="px-4 py-2.5 rounded-xl bg-[#F5F2ED] hover:bg-[#EAE5DD] text-stone-700 text-xs font-semibold transition-colors"
          >
            거절 (기존 배점 유지)
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="px-5 py-2.5 rounded-xl bg-[#4B4670] hover:bg-[#3D385C] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>동의하고 새 배점 적용</span>
          </button>
        </div>
      </div>
    </div>
  );
};
