import React, { useState } from 'react';
import { Edit3, Gift, Heart, Lock, Plus, ThumbsUp, Trash2 } from 'lucide-react';
import { ChildConfig, ChildData, PraiseSticker, StickerGiver } from '../types';

interface StickerBoardTabProps {
  currentConfig: ChildConfig;
  currentData: ChildData;
  isParentMode: boolean;
  onAddSticker: (giver: StickerGiver, reason: string) => void;
  onRemoveLastSticker: () => void;
  onResetStickerBoard: () => void;
  onSaveGoal: (newGoal: string) => void;
}

export const StickerBoardTab: React.FC<StickerBoardTabProps> = ({
  currentConfig,
  currentData,
  isParentMode,
  onAddSticker,
  onRemoveLastSticker,
  onResetStickerBoard,
  onSaveGoal
}) => {
  const [stickerGiver, setStickerGiver] = useState<StickerGiver>('MOM');
  const [stickerReason, setStickerReason] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [selectedSticker, setSelectedSticker] = useState<{
    num: number;
    sticker: PraiseSticker;
  } | null>(null);

  const stickers = currentData.stickers || [];

  const handleSubmitSticker = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSticker(stickerGiver, stickerReason);
    setStickerReason('');
  };

  const handleSaveGoalClick = () => {
    if (!goalInput.trim()) return;
    onSaveGoal(goalInput.trim());
    setEditingGoal(false);
  };

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 space-y-6">
        {/* Header & Reward Goal */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {currentConfig.name} 칭찬스티커 100칸 보드
              </h2>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {currentData.stickerRound}회차 도전 · {stickers.length} / 100개 누적
              </span>
            </div>
            <p className="text-xs text-slate-500">
              주간 채점표와 별도로 운영되는 장기 보상 트랙입니다. 100개가 모일 때까지 초기화되지 않습니다.
            </p>
          </div>

          {/* 100-Sticker Reward Goal */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-w-[260px]">
            <div className="space-y-0.5 flex-1">
              <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-violet-600" />
                <span>100개 달성 목표 상품</span>
              </div>
              {editingGoal ? (
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="목표 상품 입력"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGoalClick}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGoal(false)}
                    className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium whitespace-nowrap"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="text-sm font-bold text-slate-900">{currentData.rewardGoal}</div>
              )}
            </div>

            {isParentMode && !editingGoal && (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(currentData.rewardGoal);
                  setEditingGoal(true);
                }}
                className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors shrink-0"
                title="목표 상품 수정"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sticker Issuer Form (Parent) or Read-Only Notice (Child) */}
        {isParentMode ? (
          <form
            onSubmit={handleSubmitSticker}
            className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center gap-3"
          >
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setStickerGiver('MOM')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  stickerGiver === 'MOM'
                    ? 'bg-pink-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>엄마 스티커</span>
              </button>
              <button
                type="button"
                onClick={() => setStickerGiver('DAD')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  stickerGiver === 'DAD'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                <span>아빠 스티커</span>
              </button>
            </div>

            <input
              type="text"
              value={stickerReason}
              onChange={(e) => setStickerReason(e.target.value)}
              placeholder="칭찬 사유 입력 (예: 동생 양보하기, 스스로 책상 정리)"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>스티커 발급</span>
              </button>
              {stickers.length > 0 && (
                <button
                  type="button"
                  onClick={onRemoveLastSticker}
                  className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                  title="방금 발급한 스티커 1개 취소"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>마지막 취소</span>
                </button>
              )}
              {stickers.length >= 100 && (
                <button
                  type="button"
                  onClick={onResetStickerBoard}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  100개 보상 완료 & 새 보드
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>자녀용 조회 모드입니다. 스티커 칸을 클릭하면 칭찬 메모를 자세히 볼 수 있습니다.</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              남은 목표 {Math.max(0, 100 - stickers.length)}개
            </span>
          </div>
        )}

        {/* Selected Sticker Quick Inspector */}
        {selectedSticker && (
          <div className="px-4 py-3 rounded-xl bg-slate-900 text-white text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2 py-0.5 rounded-md font-bold tabular-nums ${
                  selectedSticker.sticker.giver === 'MOM' ? 'bg-pink-600' : 'bg-blue-600'
                }`}
              >
                #{selectedSticker.num} {selectedSticker.sticker.giver === 'MOM' ? '엄마' : '아빠'}
              </span>
              <span className="font-medium">{selectedSticker.sticker.reason}</span>
              <span className="text-slate-400 tabular-nums">({selectedSticker.sticker.date})</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSticker(null)}
              className="text-slate-400 hover:text-white text-xs font-medium shrink-0"
            >
              닫기
            </button>
          </div>
        )}

        {/* 100-Slot Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {Array.from({ length: 100 }, (_, i) => {
            const num = i + 1;
            const sticker = stickers[i];
            const isMilestone = num % 10 === 0;
            const isSelected = selectedSticker?.num === num;

            return (
              <button
                type="button"
                key={num}
                disabled={!sticker}
                onClick={() => sticker && setSelectedSticker({ num, sticker })}
                title={
                  sticker
                    ? `[#${num}] ${sticker.giver === 'MOM' ? '엄마' : '아빠'} (${sticker.date}): ${sticker.reason}`
                    : `${num}번 칸`
                }
                className={`h-14 rounded-xl border flex flex-col items-center justify-center p-1 transition-all duration-150 tabular-nums ${
                  sticker
                    ? sticker.giver === 'MOM'
                      ? `bg-pink-600 text-white border-pink-700 hover:bg-pink-700 cursor-pointer ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                        }`
                      : `bg-blue-600 text-white border-blue-700 hover:bg-blue-700 cursor-pointer ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                        }`
                    : isMilestone
                    ? 'bg-amber-50/70 border-amber-300/80 text-amber-800 font-bold cursor-default'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-400 cursor-default'
                }`}
              >
                {sticker ? (
                  <>
                    {sticker.giver === 'MOM' ? (
                      <Heart className="w-4 h-4 fill-current" />
                    ) : (
                      <ThumbsUp className="w-4 h-4 fill-current" />
                    )}
                    <span className="text-[10px] font-semibold mt-1">
                      #{num} {sticker.giver === 'MOM' ? '엄마' : '아빠'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono font-semibold">{num}</span>
                    {isMilestone && (
                      <span className="text-[9px] font-bold text-amber-700">
                        {num === 100 ? 'GOAL' : '★'}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Praise Sticker History List */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">엄마·아빠 칭찬스티커 발급 기록</h3>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            총 {stickers.length}개
          </span>
        </div>

        {stickers.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            아직 발급된 칭찬스티커가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stickers
              .slice()
              .reverse()
              .map((st, idx) => {
                const realNum = stickers.length - idx;
                return (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-3 text-xs"
                  >
                    <span
                      className={`px-2 py-1 rounded-lg font-bold text-white shrink-0 tabular-nums ${
                        st.giver === 'MOM' ? 'bg-pink-600' : 'bg-blue-600'
                      }`}
                    >
                      #{realNum} {st.giver === 'MOM' ? '엄마' : '아빠'}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="font-semibold text-slate-800 leading-snug">{st.reason}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">{st.date}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
};
