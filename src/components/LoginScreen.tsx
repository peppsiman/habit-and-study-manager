import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { CHILDREN_CONFIG } from '../constants';
import { AuthRole, CloudStorageType, ParentSessionInfo, SyncStatus } from '../types';

interface LoginScreenProps {
  onLogin: (role: AuthRole, pin: string) => Promise<string | null>;
  isLoggingIn: boolean;
  isBootstrapping: boolean;
  syncStatus: SyncStatus;
  storageType: CloudStorageType;
  activeParentSession: ParentSessionInfo | null;
  noticeMessage?: string | null;
}

const ROLE_OPTIONS: {
  role: AuthRole;
  title: string;
  subtitle: string;
  accent: 'plum' | 'sky' | 'rose';
}[] = [
  { role: 'parent', title: '부모님', subtitle: '관리·채점·배점 설정', accent: 'plum' },
  { role: 'suhyun', title: CHILDREN_CONFIG.suhyun.name, subtitle: '초3 남 · 학습 & 독서 녹음', accent: 'sky' },
  { role: 'dahyun', title: CHILDREN_CONFIG.dahyun.name, subtitle: '초3 여 · 학습 & 독서 녹음', accent: 'rose' }
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isLoggingIn,
  isBootstrapping,
  syncStatus,
  storageType,
  activeParentSession,
  noticeMessage
}) => {
  const [selectedRole, setSelectedRole] = useState<AuthRole>('parent');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn || isBootstrapping) return;
    if (!pin.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    setError('');
    const errMsg = await onLogin(selectedRole, pin);
    if (errMsg) {
      setError(errMsg);
    } else {
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-[#EAE6E0] shadow-[0_16px_40px_-16px_rgba(75,70,112,0.14)] p-5 sm:p-8 space-y-5 sm:space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#EFEBFD] text-[#5B4EA3] border border-[#E0D9FA] flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#2D2A32]">
            수현 · 다현 주간 학습 &amp; 습관 매니저
          </h1>
          <p className="text-xs text-stone-500">
            가족 전용 공간입니다. 사용자 유형을 선택하고 비밀번호를 입력하세요.
          </p>
        </div>

        {noticeMessage && (
          <div className="p-3 rounded-xl bg-[#FEF6E4] border border-[#F6DFAC] text-xs font-medium text-[#8A5615] leading-relaxed">
            {noticeMessage}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const active = selectedRole === opt.role;
            const activeClasses =
              opt.accent === 'sky'
                ? 'bg-[#6B9CE8] text-white border-[#6B9CE8] shadow-xs'
                : opt.accent === 'rose'
                ? 'bg-[#E2849B] text-white border-[#E2849B] shadow-xs'
                : 'bg-[#4B4670] text-white border-[#4B4670] shadow-xs';
            return (
              <button
                key={opt.role}
                type="button"
                onClick={() => {
                  setSelectedRole(opt.role);
                  setError('');
                }}
                className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all space-y-1 ${
                  active
                    ? activeClasses
                    : 'bg-[#FAF8F5] hover:bg-[#F3EFE9] border-[#EAE6E0] text-stone-600'
                }`}
              >
                <div className="flex justify-center">
                  {opt.role === 'parent' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="text-sm font-bold">{opt.title}</div>
                <div
                  className={`text-[10px] leading-tight ${
                    active ? 'text-white/85' : 'text-stone-400'
                  }`}
                >
                  {opt.role === 'parent' ? '관리자' : '자녀용'}
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-600 flex items-center justify-between">
              <span>
                {selectedRole === 'parent'
                  ? '부모님 비밀번호'
                  : `${CHILDREN_CONFIG[selectedRole].name} 비밀번호`}
              </span>
              <span className="text-[11px] font-normal text-stone-400">
                {ROLE_OPTIONS.find((r) => r.role === selectedRole)?.subtitle}
              </span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={pin}
                disabled={isLoggingIn || isBootstrapping}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="비밀번호 입력"
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#DDD7CF] bg-[#FDFCFB] text-center text-lg font-bold tracking-widest text-[#2D2A32] focus:outline-none focus:ring-2 focus:ring-[#8B82C4] disabled:bg-[#F5F2EE]"
              />
            </div>
          </div>

          {selectedRole === 'parent' && activeParentSession && (
            <div className="p-3 rounded-xl bg-[#FEF6E4] border border-[#F6DFAC] text-xs text-[#8A5615] leading-relaxed">
              현재 다른 기기(
              <span className="font-bold">{activeParentSession.deviceLabel || '다른 기기'}</span>
              )에서 부모님 로그인 중입니다. 로그인하면 기존 기기는 자동 로그아웃됩니다.
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-[#FFF0EF] border border-[#F9C8C4] text-xs font-semibold text-[#B8413A] text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || isBootstrapping}
            className="w-full py-3 rounded-xl bg-[#4B4670] hover:bg-[#3D385C] disabled:bg-stone-300 text-white text-sm font-bold transition-colors shadow-xs"
          >
            {isBootstrapping
              ? '데이터 연결 중...'
              : isLoggingIn
              ? '로그인 확인 중...'
              : `${ROLE_OPTIONS.find((r) => r.role === selectedRole)?.title} 로그인`}
          </button>
        </form>

        <div className="pt-3 border-t border-[#F0ECE6] flex items-center justify-between text-[11px] text-stone-400">
          <span>
            {storageType === 'none'
              ? '로컬 브라우저 저장소 모드'
              : syncStatus === 'error'
              ? '클라우드 연결 확인 필요'
              : '클라우드 동기화 준비 완료'}
          </span>
          <span>비밀번호 분실 시 부모님 설정에서 변경</span>
        </div>
      </div>
    </div>
  );
};
