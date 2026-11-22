import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Clock,
  Cloud,
  CloudOff,
  KeyRound,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlock,
  Youtube
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CHILDREN_CONFIG,
  CLOTHES_SUB_ITEMS,
  COMMON_HABIT_ITEMS,
  DAYS,
  STORAGE_KEY_DATA,
  STORAGE_KEY_PIN,
  STORAGE_KEY_TIMERS
} from './constants';
import {
  CheckStatus,
  ChildData,
  ChildKey,
  ChildrenDataMap,
  CloudAppState,
  CloudStorageType,
  ConfirmDialogState,
  DayKey,
  EvaluationItem,
  ParentSessionInfo,
  StampMode,
  StickerGiver,
  SyncStatus,
  TabKey,
  TimersMap,
  ToastState,
  YoutubeLog
} from './types';
import {
  computeChildScoreSummary,
  createInitialChildData,
  formatMinutesReadable,
  formatTimer,
  normalizeChildData
} from './utils/scoreUtils';
import {
  computeTimerRemaining,
  createDefaultChildTimer,
  createParentSessionId,
  DEFAULT_TIMER_MINUTES,
  detectDeviceLabel,
  fetchCloudState,
  hydrateTimers,
  saveCloudState
} from './utils/cloudSync';
import {
  playAlarmTestSound,
  releaseScreenWakeLock,
  requestScreenWakeLock,
  startContinuousAlarmSound,
  unlockAlarmAudio
} from './utils/alarmAudio';
import { WeeklyBoardTab } from './components/WeeklyBoardTab';
import { YoutubeTimerTab } from './components/YoutubeTimerTab';
import { StickerBoardTab } from './components/StickerBoardTab';
import { SettingsTab } from './components/SettingsTab';
import { ClothesHelperModal, ConfirmModal, PinModal, TimerAlarmModal } from './components/Modals';

const TAB_ITEMS: { key: TabKey; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'board', label: '주간 채점 & 보충', shortLabel: '주간 채점', icon: Calendar },
  { key: 'youtube', label: '유튜브 & 타이머', shortLabel: '유튜브 타이머', icon: Youtube },
  { key: 'sticker', label: '칭찬스티커 100', shortLabel: '칭찬스티커', icon: Award },
  { key: 'settings', label: '배점표 & 설정', shortLabel: '배점·설정', icon: Settings }
];

export default function App() {
  const [activeChild, setActiveChild] = useState<ChildKey>('suhyun');
  const [activeTab, setActiveTab] = useState<TabKey>('board');

  // Child mode (false, default) vs Parent mode (true, PIN protected)
  const [isParentMode, setIsParentMode] = useState(false);
  const [savedParentPin, setSavedParentPin] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PIN) || '1234';
    } catch {
      return '1234';
    }
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [changePinMode, setChangePinMode] = useState(false);
  const [currentPinForChange, setCurrentPinForChange] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [showPinText, setShowPinText] = useState(false);

  // Board filter & stamp controls
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [stampMode, setStampMode] = useState<StampMode>('CYCLE');
  const [clothesHelperModal, setClothesHelperModal] = useState<{
    dayKey: DayKey;
    dayLabel: string;
  } | null>(null);

  // Children data state
  const [childrenData, setChildrenData] = useState<ChildrenDataMap>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          suhyun: normalizeChildData('suhyun', parsed?.suhyun),
          dahyun: normalizeChildData('dahyun', parsed?.dahyun)
        };
      }
    } catch (e) {
      console.error('Failed to load from localStorage', e);
    }
    return {
      suhyun: createInitialChildData('suhyun'),
      dahyun: createInitialChildData('dahyun')
    };
  });

  // Dual real-time sibling timers
  const [timers, setTimers] = useState<TimersMap>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMERS);
      if (saved) {
        return hydrateTimers(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load timers', e);
    }
    return hydrateTimers(null);
  });

  // Cloud sync & single-device parent session state (Cloudflare KV / D1 / local-file fallback)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [storageType, setStorageType] = useState<CloudStorageType>('none');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [activeParentSession, setActiveParentSession] = useState<ParentSessionInfo | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const isInitialHydratedRef = useRef(false);
  const lastUpdatedAtRef = useRef(0);
  const lastCloudSignatureRef = useRef('');
  const pendingPushRef = useRef(false);
  const storageTypeRef = useRef<CloudStorageType>('none');
  const myParentSessionIdRef = useRef<string | null>(null);
  const mySessionLoggedInAtRef = useRef(0);
  const isParentModeRef = useRef(false);
  isParentModeRef.current = isParentMode;
  const activeParentSessionRef = useRef<ParentSessionInfo | null>(null);
  activeParentSessionRef.current = activeParentSession;
  const pendingTimerDeductRef = useRef<{ childKey: ChildKey; mode: 'target' | 'elapsed' } | null>(
    null
  );
  const performTimerDeductRef = useRef<
    ((childKey: ChildKey, mode: 'target' | 'elapsed', bypassParentCheck: boolean) => void) | null
  >(null);

  const showToast = useCallback((msg: string, type: ToastState['type'] = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.msg === msg ? null : prev));
    }, 3200);
  }, []);

  const buildSyncTimersPayload = useCallback((timersData: TimersMap): TimersMap => {
    const normalizeEntry = (t: TimersMap[ChildKey]) => {
      const targetMinutes = Math.min(180, Math.max(1, Math.round(t.targetMinutes || DEFAULT_TIMER_MINUTES)));
      const maxSeconds = targetMinutes * 60;
      const safeRemaining = Math.min(maxSeconds, Math.max(0, t.remainingSeconds ?? maxSeconds));
      const safeBase = Math.min(maxSeconds, Math.max(0, t.baseRemainingSeconds ?? safeRemaining));

      if (t.isRunning) {
        return {
          targetMinutes,
          remainingSeconds: safeBase,
          baseRemainingSeconds: safeBase,
          isRunning: true,
          startedAt: t.startedAt ?? null,
          isAlarmRinging: false
        };
      }
      return {
        targetMinutes,
        remainingSeconds: safeRemaining,
        baseRemainingSeconds: safeRemaining,
        isRunning: false,
        startedAt: null,
        isAlarmRinging: Boolean(t.isAlarmRinging)
      };
    };

    return {
      suhyun: normalizeEntry(timersData.suhyun),
      dahyun: normalizeEntry(timersData.dahyun)
    };
  }, []);

  const buildSyncSignature = useCallback(
    (data: ChildrenDataMap, pin: string, timersData: TimersMap): string => {
      return JSON.stringify({
        childrenData: data,
        parentPin: pin,
        timers: buildSyncTimersPayload(timersData)
      });
    },
    [buildSyncTimersPayload]
  );

  const latestSyncSnapshotRef = useRef({
    childrenData,
    savedParentPin,
    timers
  });
  latestSyncSnapshotRef.current = {
    childrenData,
    savedParentPin,
    timers
  };
  storageTypeRef.current = storageType;

  const applyRemoteState = useCallback(
    (remote: CloudAppState, options?: { suppressAutoLogoutToast?: boolean }) => {
      const remoteSession = remote.activeParentSession ?? null;

      if (isParentModeRef.current && myParentSessionIdRef.current) {
        const replacedByOtherDevice = Boolean(
          remoteSession &&
            remoteSession.sessionId !== myParentSessionIdRef.current &&
            (remoteSession.loggedInAt >= mySessionLoggedInAtRef.current ||
              (remote.updatedAt || 0) > lastUpdatedAtRef.current)
        );
        const sessionClearedRemotely = Boolean(
          !remoteSession && (remote.updatedAt || 0) > lastUpdatedAtRef.current
        );

        if (replacedByOtherDevice || sessionClearedRemotely) {
          myParentSessionIdRef.current = null;
          mySessionLoggedInAtRef.current = 0;
          isParentModeRef.current = false;
          pendingPushRef.current = false;
          pendingTimerDeductRef.current = null;
          setIsParentMode(false);
          if (!options?.suppressAutoLogoutToast) {
            showToast(
              '다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.',
              'warning'
            );
          }
        }
      }

      const normalizedChildren: ChildrenDataMap = {
        suhyun: normalizeChildData('suhyun', remote.childrenData?.suhyun),
        dahyun: normalizeChildData('dahyun', remote.childrenData?.dahyun)
      };
      const nextPin =
        typeof remote.parentPin === 'string' && remote.parentPin.trim().length >= 4
          ? remote.parentPin.trim()
          : latestSyncSnapshotRef.current.savedParentPin;
      const nextTimers = hydrateTimers(remote.timers);

      lastCloudSignatureRef.current = buildSyncSignature(normalizedChildren, nextPin, nextTimers);
      lastUpdatedAtRef.current = remote.updatedAt || Date.now();
      latestSyncSnapshotRef.current = {
        childrenData: normalizedChildren,
        savedParentPin: nextPin,
        timers: nextTimers
      };

      setActiveParentSession(remoteSession);
      setChildrenData(normalizedChildren);
      setSavedParentPin(nextPin);
      setTimers(nextTimers);

      try {
        localStorage.setItem(STORAGE_KEY_PIN, nextPin);
      } catch (err) {
        console.error('Failed to save synced PIN to localStorage', err);
      }
    },
    [buildSyncSignature, showToast]
  );

  const forceLogoutDueToOtherDevice = useCallback(
    (remoteState?: CloudAppState | null) => {
      myParentSessionIdRef.current = null;
      mySessionLoggedInAtRef.current = 0;
      isParentModeRef.current = false;
      pendingPushRef.current = false;
      pendingTimerDeductRef.current = null;
      setIsParentMode(false);

      if (remoteState && remoteState.childrenData) {
        applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
      }
      showToast(
        '다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.',
        'warning'
      );
    },
    [applyRemoteState, showToast]
  );

  const pushStateToCloud = useCallback(
    async (
      data: ChildrenDataMap,
      pin: string,
      timersData: TimersMap,
      options?: {
        claimSession?: boolean;
        releaseSession?: boolean;
        allowInitialSeed?: boolean;
        clientSessionIdOverride?: string | null;
        sessionOverride?: ParentSessionInfo | null;
      }
    ): Promise<boolean> => {
      const clientSessionId =
        options?.clientSessionIdOverride !== undefined
          ? options.clientSessionIdOverride
          : myParentSessionIdRef.current;

      if (!options?.claimSession && !options?.releaseSession && !options?.allowInitialSeed) {
        if (!isParentModeRef.current || !clientSessionId) {
          return false;
        }
      }

      const syncTimers = buildSyncTimersPayload(timersData);
      const signature = JSON.stringify({
        childrenData: data,
        parentPin: pin,
        timers: syncTimers
      });
      const updatedAt = Math.max(Date.now(), lastUpdatedAtRef.current + 1);
      const sessionPayload =
        options?.sessionOverride !== undefined
          ? options.sessionOverride
          : options?.releaseSession
          ? null
          : activeParentSessionRef.current;

      const payload: CloudAppState = {
        version: 3,
        updatedAt,
        childrenData: data,
        parentPin: pin,
        timers: syncTimers,
        activeParentSession: sessionPayload
      };

      setSyncStatus('syncing');
      try {
        const res = await saveCloudState(payload, {
          clientSessionId,
          claimSession: options?.claimSession,
          releaseSession: options?.releaseSession
        });
        if (!res.configured) {
          setStorageType('none');
          setSyncStatus('local_only');
          return false;
        }
        if (res.sessionReplaced) {
          forceLogoutDueToOtherDevice(res.state);
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
          return false;
        }
        if (!res.ok) {
          setSyncStatus('error');
          return false;
        }
        setStorageType(res.storageType);
        lastCloudSignatureRef.current = signature;
        lastUpdatedAtRef.current = res.state?.updatedAt || updatedAt;
        if (res.state?.activeParentSession !== undefined) {
          setActiveParentSession(res.state.activeParentSession ?? null);
        }
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
        return true;
      } catch (err) {
        console.error('Cloud save failed', err);
        setSyncStatus('error');
        return false;
      }
    },
    [buildSyncTimersPayload, forceLogoutDueToOtherDevice]
  );

  // Initial cloud hydration on mount
  useEffect(() => {
    let active = true;

    const initCloud = async () => {
      try {
        const res = await fetchCloudState();
        if (!active) return;

        if (!res.configured) {
          setStorageType('none');
          setSyncStatus('local_only');
          isInitialHydratedRef.current = true;
          return;
        }

        setStorageType(res.storageType);
        if (res.state && res.state.childrenData) {
          applyRemoteState(res.state);
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
          isInitialHydratedRef.current = true;
        } else {
          // Seed empty cloud storage with current initial/local data
          const snap = latestSyncSnapshotRef.current;
          isInitialHydratedRef.current = true;
          await pushStateToCloud(snap.childrenData, snap.savedParentPin, snap.timers, {
            allowInitialSeed: true,
            sessionOverride: null
          });
        }
      } catch (err) {
        console.error('Failed to fetch initial cloud state', err);
        if (!active) return;
        setSyncStatus('error');
        isInitialHydratedRef.current = true;
      }
    };

    initCloud();
    return () => {
      active = false;
    };
  }, [applyRemoteState, pushStateToCloud]);

  // Persist children data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(childrenData));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [childrenData]);

  // Persist timers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIMERS, JSON.stringify(timers));
    } catch (e) {
      console.error('Failed to save timers', e);
    }
  }, [timers]);

  const currentSyncSignature = useMemo(
    () => buildSyncSignature(childrenData, savedParentPin, timers),
    [buildSyncSignature, childrenData, savedParentPin, timers]
  );

  // Debounced cloud push ONLY from the active logged-in parent device (excludes 1-sec ticks)
  useEffect(() => {
    if (!isInitialHydratedRef.current) return;
    if (storageType === 'none') return;
    if (!isParentMode || !myParentSessionIdRef.current) return;
    if (currentSyncSignature === lastCloudSignatureRef.current) return;

    pendingPushRef.current = true;
    const timeoutId = setTimeout(async () => {
      try {
        await pushStateToCloud(childrenData, savedParentPin, timers);
      } finally {
        pendingPushRef.current = false;
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      pendingPushRef.current = false;
    };
  }, [currentSyncSignature, storageType, isParentMode, childrenData, savedParentPin, timers, pushStateToCloud]);

  const syncFromCloud = useCallback(
    async (isManual = false) => {
      if (!isManual && pendingPushRef.current) return;

      if (isManual) {
        setSyncStatus('syncing');
      }

      try {
        const res = await fetchCloudState();
        if (!res.configured) {
          setStorageType('none');
          setSyncStatus('local_only');
          if (isManual) {
            showToast('현재 브라우저 로컬 저장소 모드로 동작 중입니다 (Cloudflare KV 미연결).', 'info');
          }
          return;
        }

        if (!res.ok) {
          setSyncStatus('error');
          if (isManual) {
            showToast('클라우드 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.', 'warning');
          }
          return;
        }

        setStorageType(res.storageType);

        if (res.state && res.state.childrenData) {
          const remoteUpdated = res.state.updatedAt || 0;
          const remoteSession = res.state.activeParentSession ?? null;
          const sessionChangedRemotely = Boolean(
            isParentModeRef.current &&
              myParentSessionIdRef.current &&
              ((remoteSession &&
                remoteSession.sessionId !== myParentSessionIdRef.current &&
                (remoteSession.loggedInAt >= mySessionLoggedInAtRef.current ||
                  remoteUpdated > lastUpdatedAtRef.current)) ||
                (!remoteSession && remoteUpdated > lastUpdatedAtRef.current))
          );

          if (remoteUpdated > lastUpdatedAtRef.current || sessionChangedRemotely) {
            applyRemoteState(res.state);
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
            if (isManual && !sessionChangedRemotely) {
              showToast('클라우드에서 최신 데이터를 불러왔습니다.', 'success');
            }
            return;
          }

          if (remoteSession?.sessionId !== activeParentSessionRef.current?.sessionId) {
            setActiveParentSession(remoteSession);
          }
        }

        if (isParentModeRef.current && myParentSessionIdRef.current) {
          const snap = latestSyncSnapshotRef.current;
          const localSig = buildSyncSignature(snap.childrenData, snap.savedParentPin, snap.timers);
          if (localSig !== lastCloudSignatureRef.current) {
            const ok = await pushStateToCloud(snap.childrenData, snap.savedParentPin, snap.timers);
            if (isManual && ok) {
              showToast('변경된 내역을 클라우드에 저장했습니다.', 'success');
            }
            return;
          }
        }

        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
        if (isManual) {
          showToast('이미 최신 상태와 동기화되어 있습니다.', 'success');
        }
      } catch (err) {
        console.error('Sync check failed', err);
        setSyncStatus('error');
        if (isManual) {
          showToast('클라우드 서버와 통신할 수 없습니다.', 'warning');
        }
      }
    },
    [applyRemoteState, buildSyncSignature, pushStateToCloud, showToast]
  );

  // Auto-pull when tab gains focus / visibility or every 5 seconds while visible
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && storageTypeRef.current !== 'none') {
        void syncFromCloud(false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && storageTypeRef.current !== 'none') {
        void syncFromCloud(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(pollInterval);
    };
  }, [syncFromCloud]);

  // Simultaneous timestamp-based countdown interval
  useEffect(() => {
    const anyRunning = timers.suhyun.isRunning || timers.dahyun.isRunning;
    if (!anyRunning) return;

    const tick = () => {
      const now = Date.now();
      setTimers((prev) => {
        const updateChild = (cur: TimersMap[ChildKey]): TimersMap[ChildKey] => {
          if (!cur.isRunning) return cur;
          const nextRem = computeTimerRemaining(cur, now);
          if (nextRem <= 0) {
            return {
              ...cur,
              isRunning: false,
              remainingSeconds: 0,
              baseRemainingSeconds: 0,
              startedAt: null,
              isAlarmRinging: isParentModeRef.current
            };
          }
          if (nextRem === cur.remainingSeconds) {
            return cur;
          }
          return {
            ...cur,
            remainingSeconds: nextRem
          };
        };

        const nextSuhyun = updateChild(prev.suhyun);
        const nextDahyun = updateChild(prev.dahyun);
        if (nextSuhyun === prev.suhyun && nextDahyun === prev.dahyun) {
          return prev;
        }
        return {
          suhyun: nextSuhyun,
          dahyun: nextDahyun
        };
      });
    };

    tick();
    const interval = setInterval(tick, 500);

    return () => clearInterval(interval);
  }, [timers.suhyun.isRunning, timers.dahyun.isRunning]);

  // Continuous melodic bell alarm loop ONLY on the active logged-in parent device
  useEffect(() => {
    const anyRinging =
      isParentMode &&
      Boolean(timers.suhyun.isAlarmRinging || timers.dahyun.isAlarmRinging);
    if (!anyRinging) return;

    const stopAlarm = startContinuousAlarmSound(() => {
      const snap = latestSyncSnapshotRef.current.timers;
      return (
        isParentModeRef.current &&
        Boolean(snap.suhyun.isAlarmRinging || snap.dahyun.isAlarmRinging)
      );
    });

    return stopAlarm;
  }, [isParentMode, timers.suhyun.isAlarmRinging, timers.dahyun.isAlarmRinging]);

  // Keep screen awake during countdown or ringing alarm on supported devices
  useEffect(() => {
    const needsWakeLock =
      timers.suhyun.isRunning ||
      timers.dahyun.isRunning ||
      Boolean(timers.suhyun.isAlarmRinging) ||
      Boolean(timers.dahyun.isAlarmRinging);

    if (needsWakeLock) {
      void requestScreenWakeLock();
    } else {
      void releaseScreenWakeLock();
    }

    return () => {
      void releaseScreenWakeLock();
    };
  }, [
    timers.suhyun.isRunning,
    timers.dahyun.isRunning,
    timers.suhyun.isAlarmRinging,
    timers.dahyun.isAlarmRinging
  ]);

  const summaries = useMemo(() => {
    return {
      suhyun: computeChildScoreSummary('suhyun', childrenData.suhyun),
      dahyun: computeChildScoreSummary('dahyun', childrenData.dahyun)
    };
  }, [childrenData]);

  const currentConfig = CHILDREN_CONFIG[activeChild];
  const currentData = childrenData[activeChild];
  const scoreSummary = summaries[activeChild];
  const allItems = useMemo(
    () => [...currentConfig.studyItems, ...currentConfig.habitItems],
    [currentConfig]
  );

  // Parent permission check
  const requireParentMode = (actionName = '이 기능'): boolean => {
    if (!isParentMode) {
      showToast(`부모님 로그인 후 [${actionName}]을(를) 사용할 수 있습니다.`, 'warning');
      setChangePinMode(false);
      setPinError('');
      setPinModalOpen(true);
      return false;
    }
    return true;
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const enteredPin = pinInput;
    if (!enteredPin) {
      setPinError('비밀번호를 입력해주세요.');
      return;
    }

    // Unlock Web Audio synchronously inside user gesture so handed-over running timers ring reliably
    unlockAlarmAudio();

    if (storageTypeRef.current === 'none') {
      if (enteredPin !== savedParentPin) {
        setPinError('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
        return;
      }
      const localSession: ParentSessionInfo = {
        sessionId: createParentSessionId(),
        loggedInAt: Date.now(),
        deviceLabel: detectDeviceLabel()
      };
      myParentSessionIdRef.current = localSession.sessionId;
      mySessionLoggedInAtRef.current = localSession.loggedInAt;
      isParentModeRef.current = true;
      setActiveParentSession(localSession);
      setIsParentMode(true);
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
      showToast('부모님 관리 모드로 로그인되었습니다.', 'success');

      if (pendingTimerDeductRef.current) {
        const pending = pendingTimerDeductRef.current;
        pendingTimerDeductRef.current = null;
        performTimerDeductRef.current?.(pending.childKey, pending.mode, true);
      }
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetchCloudState();
      if (!res.ok) {
        setPinError('클라우드 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (!res.configured) {
        setStorageType('none');
        setSyncStatus('local_only');
        if (enteredPin !== savedParentPin) {
          setPinError('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
          return;
        }
        const localSession: ParentSessionInfo = {
          sessionId: createParentSessionId(),
          loggedInAt: Date.now(),
          deviceLabel: detectDeviceLabel()
        };
        myParentSessionIdRef.current = localSession.sessionId;
        mySessionLoggedInAtRef.current = localSession.loggedInAt;
        isParentModeRef.current = true;
        setActiveParentSession(localSession);
        setIsParentMode(true);
        setPinModalOpen(false);
        setPinInput('');
        setPinError('');
        showToast('부모님 관리 모드로 로그인되었습니다.', 'success');
        if (pendingTimerDeductRef.current) {
          const pending = pendingTimerDeductRef.current;
          pendingTimerDeductRef.current = null;
          performTimerDeductRef.current?.(pending.childKey, pending.mode, true);
        }
        return;
      }

      const remoteState = res.state && res.state.childrenData ? res.state : null;
      const effectivePin =
        remoteState?.parentPin && typeof remoteState.parentPin === 'string' && remoteState.parentPin.trim().length >= 4
          ? remoteState.parentPin.trim()
          : savedParentPin;

      if (remoteState && (remoteState.updatedAt || 0) > lastUpdatedAtRef.current) {
        applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
      }

      if (enteredPin !== effectivePin) {
        setPinError('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
        return;
      }

      const freshChildren: ChildrenDataMap = remoteState
        ? {
            suhyun: normalizeChildData('suhyun', remoteState.childrenData?.suhyun),
            dahyun: normalizeChildData('dahyun', remoteState.childrenData?.dahyun)
          }
        : latestSyncSnapshotRef.current.childrenData;
      const freshTimers: TimersMap = remoteState
        ? hydrateTimers(remoteState.timers)
        : latestSyncSnapshotRef.current.timers;

      const hadOtherSession = Boolean(remoteState?.activeParentSession?.sessionId);
      const newSession: ParentSessionInfo = {
        sessionId: createParentSessionId(),
        loggedInAt: Date.now(),
        deviceLabel: detectDeviceLabel()
      };
      const syncTimers = buildSyncTimersPayload(freshTimers);
      const updatedAt = Math.max(Date.now(), (remoteState?.updatedAt || 0) + 1, lastUpdatedAtRef.current + 1);

      const claimRes = await saveCloudState(
        {
          version: 3,
          updatedAt,
          childrenData: freshChildren,
          parentPin: effectivePin,
          timers: syncTimers,
          activeParentSession: newSession
        },
        {
          claimSession: true,
          clientSessionId: newSession.sessionId
        }
      );

      if (!claimRes.ok) {
        setPinError('로그인 세션 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      myParentSessionIdRef.current = newSession.sessionId;
      mySessionLoggedInAtRef.current = newSession.loggedInAt;
      isParentModeRef.current = true;
      lastCloudSignatureRef.current = buildSyncSignature(freshChildren, effectivePin, freshTimers);
      lastUpdatedAtRef.current = claimRes.state?.updatedAt || updatedAt;
      latestSyncSnapshotRef.current = {
        childrenData: freshChildren,
        savedParentPin: effectivePin,
        timers: freshTimers
      };

      setStorageType(claimRes.storageType);
      setSyncStatus('synced');
      setLastSyncedAt(Date.now());
      setActiveParentSession(newSession);
      setChildrenData(freshChildren);
      setSavedParentPin(effectivePin);
      setTimers(freshTimers);
      try {
        localStorage.setItem(STORAGE_KEY_PIN, effectivePin);
      } catch (err) {
        console.error(err);
      }

      setIsParentMode(true);
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
      showToast(
        hadOtherSession
          ? '부모님 모드로 로그인되었습니다. (기존 로그인 기기는 자동 로그아웃)'
          : '부모님 관리 모드로 로그인되었습니다.',
        'success'
      );

      if (pendingTimerDeductRef.current) {
        const pending = pendingTimerDeductRef.current;
        pendingTimerDeductRef.current = null;
        performTimerDeductRef.current?.(pending.childKey, pending.mode, true);
      }
    } catch (err) {
      console.error('Parent login failed', err);
      setPinError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleParentLogout = () => {
    const prevSessionId = myParentSessionIdRef.current;
    myParentSessionIdRef.current = null;
    mySessionLoggedInAtRef.current = 0;
    isParentModeRef.current = false;
    pendingPushRef.current = false;
    pendingTimerDeductRef.current = null;
    setIsParentMode(false);
    setActiveParentSession(null);
    showToast('자녀용 조회 모드로 잠금되었습니다.', 'info');

    if (storageTypeRef.current !== 'none' && prevSessionId) {
      const snap = latestSyncSnapshotRef.current;
      void pushStateToCloud(snap.childrenData, snap.savedParentPin, snap.timers, {
        releaseSession: true,
        clientSessionIdOverride: prevSessionId,
        sessionOverride: null
      });
    }
  };

  const openLoginModal = () => {
    setChangePinMode(false);
    setPinError('');
    setPinModalOpen(true);
  };

  const openPasswordChangeModal = () => {
    if (!requireParentMode('비밀번호 변경')) return;
    setChangePinMode(true);
    setCurrentPinForChange('');
    setNewPinInput('');
    setConfirmNewPinInput('');
    setPinError('');
    setPinModalOpen(true);
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPinForChange !== savedParentPin) {
      setPinError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!newPinInput || newPinInput.trim().length < 4) {
      setPinError('새 비밀번호는 4자리 이상 입력해주세요.');
      return;
    }
    if (newPinInput.trim() !== confirmNewPinInput.trim()) {
      setPinError('새 비밀번호와 확인 입력값이 일치하지 않습니다.');
      return;
    }
    const cleanPin = newPinInput.trim();
    setSavedParentPin(cleanPin);
    try {
      localStorage.setItem(STORAGE_KEY_PIN, cleanPin);
    } catch (err) {
      console.error(err);
    }
    setChangePinMode(false);
    setPinModalOpen(false);
    setCurrentPinForChange('');
    setNewPinInput('');
    setConfirmNewPinInput('');
    setPinError('');
    showToast('부모님 비밀번호가 변경되었습니다.', 'success');
  };

  // Board Cell Toggle
  const handleCellToggle = (item: EvaluationItem, dayKey: DayKey, dayLabel: string) => {
    if (!requireParentMode('점수 채점 및 변경')) return;

    const currentStatus: CheckStatus = currentData.checks?.[item.id]?.[dayKey] || 'NONE';
    let nextStatus: CheckStatus = 'NONE';

    if (stampMode === 'WEEKDAY') {
      nextStatus = currentStatus === 'WEEKDAY' ? 'NONE' : 'WEEKDAY';
    } else if (stampMode === 'WEEKEND') {
      nextStatus = currentStatus === 'WEEKEND' ? 'NONE' : 'WEEKEND';
    } else {
      if (currentStatus === 'NONE') nextStatus = 'WEEKDAY';
      else if (currentStatus === 'WEEKDAY') nextStatus = 'WEEKEND';
      else nextStatus = 'NONE';
    }

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const updatedChecks = {
        ...(childObj.checks || {}),
        [item.id]: {
          ...(childObj.checks?.[item.id] || {
            MON: 'NONE',
            TUE: 'NONE',
            WED: 'NONE',
            THU: 'NONE',
            FRI: 'NONE'
          }),
          [dayKey]: nextStatus
        }
      };

      const updatedClothesSub = { ...(childObj.clothesSubChecks || {}) };
      if (item.id === 'hb_clothes_all') {
        const allDone = nextStatus !== 'NONE';
        updatedClothesSub[dayKey] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = allDone;
          return acc;
        }, {} as Record<string, boolean>);
      }

      let updatedLogs: YoutubeLog[] = [...(childObj.youtubeLogs || [])];
      const nowStr = new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const displayItemName = item.shortName || item.name;

      if (nextStatus === 'WEEKEND' && currentStatus !== 'WEEKEND') {
        updatedLogs = [
          {
            id: `makeup-${Date.now()}`,
            type: 'MAKEUP_ADD',
            minutes: item.score,
            memo: `[주말 보충] ${dayLabel}요일 '${displayItemName}' 완료 (+${item.score}분)`,
            timestamp: `주말 보충 ${nowStr}`,
            relatedItem: { itemId: item.id, dayKey }
          },
          ...updatedLogs
        ];
        showToast(
          `주말 보충 완료: '${displayItemName}' +${item.score}점 (유튜브 +${item.score}분)`,
          'success'
        );
      } else if (currentStatus === 'WEEKEND' && nextStatus !== 'WEEKEND') {
        updatedLogs = [
          {
            id: `makeup-cancel-${Date.now()}`,
            type: 'MAKEUP_CANCEL',
            minutes: -item.score,
            memo: `[보충 해제] ${dayLabel}요일 '${displayItemName}' 변경 (-${item.score}분)`,
            timestamp: `변경 ${nowStr}`
          },
          ...updatedLogs
        ];
      }

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          checks: updatedChecks,
          clothesSubChecks: updatedClothesSub,
          youtubeLogs: updatedLogs
        }
      };
    });
  };

  const handleToggleClothesSubItem = (dayKey: DayKey, dayLabel: string, subName: string) => {
    if (!requireParentMode('옷 정리 세부 항목 체크')) return;

    const currentDaySubs = currentData.clothesSubChecks?.[dayKey] || {};
    const nextVal = !currentDaySubs[subName];
    const updatedDaySubs = {
      ...CLOTHES_SUB_ITEMS.reduce((acc, s) => {
        acc[s] = Boolean(currentDaySubs[s]);
        return acc;
      }, {} as Record<string, boolean>),
      [subName]: nextVal
    };

    const isAll8Completed = CLOTHES_SUB_ITEMS.every((s) => Boolean(updatedDaySubs[s]));
    const clothesItem = COMMON_HABIT_ITEMS[0];
    const prevMainStatus = currentData.checks?.hb_clothes_all?.[dayKey] || 'NONE';

    let nextMainStatus: CheckStatus = 'NONE';
    if (isAll8Completed) {
      nextMainStatus = prevMainStatus === 'WEEKEND' ? 'WEEKEND' : 'WEEKDAY';
    }

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          clothesSubChecks: {
            ...(childObj.clothesSubChecks || {}),
            [dayKey]: updatedDaySubs
          },
          checks: {
            ...(childObj.checks || {}),
            hb_clothes_all: {
              ...(childObj.checks?.hb_clothes_all || {
                MON: 'NONE',
                TUE: 'NONE',
                WED: 'NONE',
                THU: 'NONE',
                FRI: 'NONE'
              }),
              [dayKey]: nextMainStatus
            }
          }
        }
      };
    });

    if (isAll8Completed && prevMainStatus === 'NONE') {
      showToast(
        `${dayLabel}요일 옷 정리 8종 올클리어 달성 (+${clothesItem.score}점 인정)`,
        'success'
      );
    }
  };

  const handleBulkDayComplete = (
    dayKey: DayKey,
    dayLabel: string,
    targetStatus: 'WEEKDAY' | 'WEEKEND' = 'WEEKDAY'
  ) => {
    if (!requireParentMode('요일 전체 완료 체크')) return;

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const updatedChecks = { ...(childObj.checks || {}) };

      allItems.forEach((item) => {
        updatedChecks[item.id] = {
          ...(updatedChecks[item.id] || {
            MON: 'NONE',
            TUE: 'NONE',
            WED: 'NONE',
            THU: 'NONE',
            FRI: 'NONE'
          }),
          [dayKey]: targetStatus
        };
      });

      const updatedClothesSub = {
        ...(childObj.clothesSubChecks || {}),
        [dayKey]: CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = true;
          return acc;
        }, {} as Record<string, boolean>)
      };

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          checks: updatedChecks,
          clothesSubChecks: updatedClothesSub
        }
      };
    });

    showToast(
      `${dayLabel}요일 전체 항목이 '${targetStatus === 'WEEKDAY' ? '평일 완료' : '주말 보충'}' 처리되었습니다.`,
      'success'
    );
  };

  // YouTube Deduction (Parent Only)
  const deductYoutubeForChild = (
    targetChildKey: ChildKey,
    minutesToDeduct: string | number,
    customMemo = '',
    bypassParentCheck = false
  ): boolean => {
    if (!bypassParentCheck && !requireParentMode('유튜브 시청 시간 차감')) return false;

    const mins = parseInt(String(minutesToDeduct), 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('올바른 차감 시간(분)을 입력해주세요.', 'warning');
      return false;
    }

    const latestChildData = latestSyncSnapshotRef.current.childrenData[targetChildKey];
    const targetSummary = computeChildScoreSummary(targetChildKey, latestChildData);
    const targetName = CHILDREN_CONFIG[targetChildKey].name;

    if (targetSummary.remainingMinutes <= 0) {
      showToast(`${targetName}이의 남아있는 유튜브 시청 시간이 없습니다.`, 'warning');
      return false;
    }

    const actualDeduct = Math.min(mins, targetSummary.remainingMinutes);
    const nowStr = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const memoText = customMemo.trim() || `유튜브 ${actualDeduct}분 시청 차감`;

    setChildrenData((prev) => {
      const childObj = prev[targetChildKey];
      const nextUsed = (childObj.usedYoutubeMinutes || 0) + actualDeduct;
      const newLog: YoutubeLog = {
        id: `watch-${targetChildKey}-${Date.now()}`,
        type: 'WATCH',
        minutes: -actualDeduct,
        memo: memoText,
        timestamp: `주말 ${nowStr}`
      };

      return {
        ...prev,
        [targetChildKey]: {
          ...childObj,
          usedYoutubeMinutes: nextUsed,
          youtubeLogs: [newLog, ...(childObj.youtubeLogs || [])]
        }
      };
    });

    showToast(`${targetName} 유튜브 ${actualDeduct}분 차감 완료`, 'info');
    return true;
  };

  // Countdown Timer Controls (Exclusive to Active Logged-in Parent Device)
  const handleSetChildTimerMinutes = (childKey: ChildKey, minutes: number) => {
    if (!requireParentMode('유튜브 타이머 시간 설정')) return;
    if (timers[childKey].isRunning || timers[childKey].isAlarmRinging) return;
    const clamped = Math.min(180, Math.max(1, Math.round(minutes)));
    setTimers((prev) => ({
      ...prev,
      [childKey]: createDefaultChildTimer(clamped)
    }));
  };

  const handleToggleChildTimer = (childKey: ChildKey) => {
    if (!requireParentMode('유튜브 타이머 제어')) return;

    const childSummary = summaries[childKey];
    const currentTimer = timers[childKey];
    const isCurrentlyRunning = currentTimer.isRunning;

    if (!isCurrentlyRunning) {
      if (childSummary.remainingMinutes <= 0) {
        showToast(
          `${CHILDREN_CONFIG[childKey].name}이는 잔여 시간이 0분이어서 타이머를 시작할 수 없습니다.`,
          'warning'
        );
        return;
      }
      if (currentTimer.targetMinutes > childSummary.remainingMinutes) {
        showToast(
          `설정 시간(${currentTimer.targetMinutes}분)이 잔여 시간(${childSummary.remainingMinutes}분)보다 큽니다.`,
          'warning'
        );
        return;
      }
      unlockAlarmAudio();
    }

    const now = Date.now();
    setTimers((prev) => {
      const target = prev[childKey];
      const currentRem = computeTimerRemaining(target, now);
      if (target.isRunning) {
        return {
          ...prev,
          [childKey]: {
            ...target,
            isRunning: false,
            remainingSeconds: currentRem,
            baseRemainingSeconds: currentRem,
            startedAt: null,
            isAlarmRinging: false
          }
        };
      }
      const nextBase = currentRem > 0 ? currentRem : target.targetMinutes * 60;
      return {
        ...prev,
        [childKey]: {
          ...target,
          isRunning: true,
          remainingSeconds: nextBase,
          baseRemainingSeconds: nextBase,
          startedAt: now,
          isAlarmRinging: false
        }
      };
    });

    showToast(
      !isCurrentlyRunning
        ? `${CHILDREN_CONFIG[childKey].name} 유튜브 ${currentTimer.targetMinutes}분 타이머 시작`
        : `${CHILDREN_CONFIG[childKey].name} 유튜브 타이머 일시정지`,
      'info'
    );
  };

  const handleResetChildTimer = (childKey: ChildKey) => {
    if (!requireParentMode('타이머 초기화')) return;
    const targetMins = timers[childKey].targetMinutes || DEFAULT_TIMER_MINUTES;
    setTimers((prev) => ({
      ...prev,
      [childKey]: createDefaultChildTimer(targetMins)
    }));
    showToast(
      `${CHILDREN_CONFIG[childKey].name} 타이머가 ${targetMins}분으로 초기화되었습니다.`,
      'info'
    );
  };

  const handleDismissChildAlarm = (childKey: ChildKey) => {
    if (!requireParentMode('타이머 알림 해제')) return;
    const targetMins = timers[childKey].targetMinutes || DEFAULT_TIMER_MINUTES;
    setTimers((prev) => ({
      ...prev,
      [childKey]: {
        ...prev[childKey],
        isRunning: false,
        remainingSeconds: 0,
        baseRemainingSeconds: 0,
        startedAt: null,
        isAlarmRinging: false
      }
    }));
    showToast(
      `${CHILDREN_CONFIG[childKey].name} 종료 알림이 해제되었습니다. '설정 ${targetMins}분 차감 확정'을 눌러 차감하세요.`,
      'info'
    );
  };

  const performTimerDeduction = (
    childKey: ChildKey,
    mode: 'target' | 'elapsed',
    bypassParentCheck = false
  ) => {
    const t = latestSyncSnapshotRef.current.timers[childKey];
    const targetMins = t.targetMinutes || DEFAULT_TIMER_MINUTES;
    const currentRem = computeTimerRemaining(t);
    const totalSec = targetMins * 60;
    const isElapsedMode = mode === 'elapsed' && currentRem > 0;
    const minutesToDeduct = isElapsedMode
      ? Math.max(1, Math.round((totalSec - currentRem) / 60))
      : targetMins;

    const resetTimer = createDefaultChildTimer(targetMins);
    latestSyncSnapshotRef.current = {
      ...latestSyncSnapshotRef.current,
      timers: {
        ...latestSyncSnapshotRef.current.timers,
        [childKey]: resetTimer
      }
    };
    setTimers((prev) => ({
      ...prev,
      [childKey]: resetTimer
    }));

    const memo = isElapsedMode
      ? `유튜브 타이머 중간 차감 (${minutesToDeduct}분 시청)`
      : `유튜브 타이머 ${targetMins}분 완료 차감`;

    deductYoutubeForChild(childKey, minutesToDeduct, memo, bypassParentCheck);
  };
  performTimerDeductRef.current = performTimerDeduction;

  const handleDeductChildTimer = (childKey: ChildKey, mode: 'target' | 'elapsed' = 'target') => {
    if (timers[childKey].isAlarmRinging) {
      setTimers((prev) => ({
        ...prev,
        [childKey]: {
          ...prev[childKey],
          isRunning: false,
          remainingSeconds: 0,
          baseRemainingSeconds: 0,
          startedAt: null,
          isAlarmRinging: false
        }
      }));
    }

    if (!isParentMode) {
      pendingTimerDeductRef.current = { childKey, mode };
      requireParentMode('타이머 시청 시간 차감 확정');
      return;
    }

    performTimerDeduction(childKey, mode, false);
  };

  const handleStartBothTimers = () => {
    if (!requireParentMode('남매 타이머 동시 시작')) return;

    const canStartSuhyun =
      !timers.suhyun.isRunning &&
      summaries.suhyun.remainingMinutes > 0 &&
      timers.suhyun.targetMinutes <= summaries.suhyun.remainingMinutes;
    const canStartDahyun =
      !timers.dahyun.isRunning &&
      summaries.dahyun.remainingMinutes > 0 &&
      timers.dahyun.targetMinutes <= summaries.dahyun.remainingMinutes;

    if (!canStartSuhyun && !canStartDahyun) {
      if (timers.suhyun.isRunning || timers.dahyun.isRunning) {
        showToast('이미 시작 가능한 타이머가 작동 중입니다.', 'info');
      } else {
        showToast('잔여 시간을 확인하고 설정 시간을 잔여 시간 이하로 맞춰주세요.', 'warning');
      }
      return;
    }

    unlockAlarmAudio();
    const now = Date.now();
    setTimers((prev) => {
      const nextFor = (ck: ChildKey, shouldStart: boolean) => {
        const cur = prev[ck];
        if (!shouldStart) return cur;
        const currentRem = computeTimerRemaining(cur, now);
        const nextBase = currentRem > 0 ? currentRem : cur.targetMinutes * 60;
        return {
          ...cur,
          isRunning: true,
          remainingSeconds: nextBase,
          baseRemainingSeconds: nextBase,
          startedAt: now,
          isAlarmRinging: false
        };
      };
      return {
        suhyun: nextFor('suhyun', canStartSuhyun),
        dahyun: nextFor('dahyun', canStartDahyun)
      };
    });
    showToast('유튜브 카운트다운 타이머가 시작되었습니다.', 'success');
  };

  const handlePauseBothTimers = () => {
    if (!requireParentMode('타이머 일시정지')) return;

    const now = Date.now();
    setTimers((prev) => {
      const pauseFor = (cur: TimersMap[ChildKey]) => {
        if (!cur.isRunning) return cur;
        const currentRem = computeTimerRemaining(cur, now);
        return {
          ...cur,
          isRunning: false,
          remainingSeconds: currentRem,
          baseRemainingSeconds: currentRem,
          startedAt: null,
          isAlarmRinging: false
        };
      };
      return {
        suhyun: pauseFor(prev.suhyun),
        dahyun: pauseFor(prev.dahyun)
      };
    });
    showToast('작동 중인 모든 타이머를 일시정지했습니다.', 'info');
  };

  const handleTestAlarmSound = () => {
    playAlarmTestSound();
    showToast('종료 알림음 테스트를 재생했습니다.', 'info');
  };

  const handleUndoWatchLog = (logId: string) => {
    if (!requireParentMode('기록 취소(복구)')) return;

    const targetLog = (currentData.youtubeLogs || []).find((l) => l.id === logId);
    if (!targetLog) return;

    if (targetLog.type === 'WATCH') {
      const restoreMinutes = Math.abs(targetLog.minutes);
      setChildrenData((prev) => {
        const childObj = prev[activeChild];
        return {
          ...prev,
          [activeChild]: {
            ...childObj,
            usedYoutubeMinutes: Math.max(0, (childObj.usedYoutubeMinutes || 0) - restoreMinutes),
            youtubeLogs: (childObj.youtubeLogs || []).filter((l) => l.id !== logId)
          }
        };
      });
      showToast(`${restoreMinutes}분 차감 내역이 취소되어 복구되었습니다.`, 'info');
    } else if (targetLog.type === 'MAKEUP_ADD' && targetLog.relatedItem) {
      const { itemId, dayKey } = targetLog.relatedItem;
      setChildrenData((prev) => {
        const childObj = prev[activeChild];
        return {
          ...prev,
          [activeChild]: {
            ...childObj,
            checks: {
              ...(childObj.checks || {}),
              [itemId]: {
                ...(childObj.checks?.[itemId] || {
                  MON: 'NONE',
                  TUE: 'NONE',
                  WED: 'NONE',
                  THU: 'NONE',
                  FRI: 'NONE'
                }),
                [dayKey]: 'NONE'
              }
            },
            youtubeLogs: (childObj.youtubeLogs || []).filter((l) => l.id !== logId)
          }
        };
      });
      showToast('주말 보충 가점 내역이 취소되었습니다.', 'info');
    }
  };

  // Sticker Handlers
  const handleAddSticker = (giver: StickerGiver, reason: string) => {
    if (!requireParentMode('칭찬스티커 발급')) return;

    const currentStickers = currentData.stickers || [];
    if (currentStickers.length >= 100) {
      showToast('이미 칭찬스티커 100개를 모두 모았습니다.', 'warning');
      return;
    }

    const reasonText =
      reason.trim() ||
      (giver === 'MOM' ? '엄마가 칭찬하는 멋진 행동!' : '아빠가 칭찬하는 최고 행동!');
    const todayStr = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          stickers: [
            ...(childObj.stickers || []),
            { id: Date.now(), giver, reason: reasonText, date: todayStr }
          ]
        }
      };
    });

    showToast(
      `${giver === 'MOM' ? '엄마' : '아빠'} 칭찬스티커 발급 완료 (${currentStickers.length + 1}/100)`,
      'success'
    );
  };

  const handleRemoveLastSticker = () => {
    if (!requireParentMode('칭찬스티커 취소')) return;
    if ((currentData.stickers || []).length === 0) return;

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          stickers: (childObj.stickers || []).slice(0, -1)
        }
      };
    });
    showToast('최근 칭찬스티커 1개가 취소되었습니다.', 'info');
  };

  const handleSaveGoal = (newGoal: string) => {
    if (!requireParentMode('목표 상품 변경')) return;
    setChildrenData((prev) => ({
      ...prev,
      [activeChild]: {
        ...prev[activeChild],
        rewardGoal: newGoal
      }
    }));
    showToast('100개 달성 목표 상품이 변경되었습니다.', 'success');
  };

  const handleResetWeeklyBoard = () => {
    if (!requireParentMode('새 주차 초기화')) return;

    setConfirmDialog({
      title: '새 한 주 시작 (주간 보드 초기화)',
      message: `${currentConfig.name}이의 이번 주 채점 기록과 주말 유튜브 시청 기록을 0으로 초기화하시겠습니까? (엄마·아빠 칭찬스티커 누적 개수는 그대로 유지됩니다.)`,
      confirmText: '새 주차 시작',
      onConfirm: () => {
        const emptyChecks: Record<string, Record<DayKey, CheckStatus>> = {};
        allItems.forEach((item) => {
          emptyChecks[item.id] = {
            MON: 'NONE',
            TUE: 'NONE',
            WED: 'NONE',
            THU: 'NONE',
            FRI: 'NONE'
          };
        });

        const emptySubChecks = {} as Record<DayKey, Record<string, boolean>>;
        DAYS.forEach(({ key }) => {
          emptySubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
            acc[sub] = false;
            return acc;
          }, {} as Record<string, boolean>);
        });

        setChildrenData((prev) => ({
          ...prev,
          [activeChild]: {
            ...prev[activeChild],
            checks: emptyChecks,
            clothesSubChecks: emptySubChecks,
            usedYoutubeMinutes: 0,
            youtubeLogs: []
          }
        }));
        setConfirmDialog(null);
        showToast(`${currentConfig.name}이의 새로운 주간 채점표가 초기화되었습니다.`, 'success');
      }
    });
  };

  const handleResetStickerBoard = () => {
    if (!requireParentMode('100개 보드 리셋')) return;

    setConfirmDialog({
      title: '100개 달성 보상 완료 & 새 보드 시작',
      message: `${currentConfig.name}이에게 약속한 상품을 수여하고, 다음 회차(${currentData.stickerRound + 1}회차) 100칸 보드를 새로 시작하시겠습니까?`,
      confirmText: '새 보드 시작',
      onConfirm: () => {
        setChildrenData((prev) => ({
          ...prev,
          [activeChild]: {
            ...prev[activeChild],
            stickers: [],
            stickerRound: (prev[activeChild].stickerRound || 1) + 1
          }
        }));
        setConfirmDialog(null);
        showToast('새로운 100칸 칭찬스티커 보드가 시작되었습니다.', 'success');
      }
    });
  };

  const handleResetAllDataExceptStickers = () => {
    if (!requireParentMode('데이터 초기화')) return;

    setConfirmDialog({
      title: '데이터 초기화 (칭찬스티커 제외)',
      message:
        '수현이와 다현이의 주간 채점 기록, 옷 정리 점검, 주말 유튜브 시청 시간 및 타이머를 모두 0으로 초기화하시겠습니까? (엄마·아빠 칭찬스티커 누적 개수와 발급 내역은 유지됩니다.)',
      confirmText: '데이터 초기화 실행',
      onConfirm: () => {
        const buildEmptyChildWeek = (childKey: ChildKey, prevChildObj: ChildData): ChildData => {
          const cfg = CHILDREN_CONFIG[childKey];
          const items = [...cfg.studyItems, ...cfg.habitItems];
          const emptyChecks: Record<string, Record<DayKey, CheckStatus>> = {};
          items.forEach((item) => {
            emptyChecks[item.id] = {
              MON: 'NONE',
              TUE: 'NONE',
              WED: 'NONE',
              THU: 'NONE',
              FRI: 'NONE'
            };
          });

          const emptySubChecks = {} as Record<DayKey, Record<string, boolean>>;
          DAYS.forEach(({ key }) => {
            emptySubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
              acc[sub] = false;
              return acc;
            }, {} as Record<string, boolean>);
          });

          return {
            ...prevChildObj,
            checks: emptyChecks,
            clothesSubChecks: emptySubChecks,
            usedYoutubeMinutes: 0,
            youtubeLogs: []
          };
        };

        setChildrenData((prev) => ({
          suhyun: buildEmptyChildWeek('suhyun', prev.suhyun),
          dahyun: buildEmptyChildWeek('dahyun', prev.dahyun)
        }));

        setTimers({
          suhyun: createDefaultChildTimer(DEFAULT_TIMER_MINUTES),
          dahyun: createDefaultChildTimer(DEFAULT_TIMER_MINUTES)
        });

        setConfirmDialog(null);
        showToast('칭찬스티커를 제외한 주간 학습·습관 및 유튜브 데이터가 초기화되었습니다.', 'success');
      }
    });
  };

  const isSuhyun = activeChild === 'suhyun';
  const currentTabMeta = TAB_ITEMS.find((t) => t.key === activeTab) || TAB_ITEMS[0];
  const youtubeRemainingRatio =
    scoreSummary.totalEarnedMinutes > 0
      ? Math.min(100, (scoreSummary.remainingMinutes / scoreSummary.totalEarnedMinutes) * 100)
      : 0;

  const syncBadgeMeta = (() => {
    switch (syncStatus) {
      case 'synced':
        return {
          label: storageType === 'local-file' ? '로컬 서버 동기화' : '클라우드 동기화',
          shortLabel: '동기화됨',
          tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
          spin: false,
          Icon: Cloud
        };
      case 'syncing':
      case 'loading':
        return {
          label: syncStatus === 'loading' ? '불러오는 중...' : '동기화 중...',
          shortLabel: '동기화 중',
          tone: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
          spin: true,
          Icon: RefreshCw
        };
      case 'error':
        return {
          label: '동기화 오류 · 재시도',
          shortLabel: '재시도',
          tone: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
          spin: false,
          Icon: CloudOff
        };
      default:
        return {
          label: '브라우저 로컬 전용',
          shortLabel: '로컬 전용',
          tone: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70',
          spin: false,
          Icon: CloudOff
        };
    }
  })();
  const SyncBadgeIcon = syncBadgeMeta.Icon;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center gap-3"
        >
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium leading-snug">{toastMessage.msg}</span>
        </div>
      )}

      {/* ==========================================
          Desktop Sidebar Navigation (272px)
      ========================================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[272px] shrink-0 bg-white border-r border-slate-200/90 sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="h-14 px-5 flex items-center border-b border-slate-200/80">
          <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
            수현·다현 학습 매니저
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Child Switcher */}
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-semibold text-slate-400">자녀 프로필</div>
            <div className="space-y-1.5">
              {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
                const cfg = CHILDREN_CONFIG[ck];
                const sum = summaries[ck];
                const isActive = activeChild === ck;
                const isBlue = ck === 'suhyun';
                const running = timers[ck].isRunning;

                return (
                  <button
                    key={ck}
                    type="button"
                    onClick={() => setActiveChild(ck)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                      isActive
                        ? isBlue
                          ? 'bg-blue-50/70 border-blue-200 text-slate-900'
                          : 'bg-rose-50/70 border-rose-200 text-slate-900'
                        : 'bg-white border-transparent hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          isActive
                            ? isBlue
                              ? 'bg-blue-600 text-white'
                              : 'bg-rose-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cfg.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold leading-tight truncate">
                          {cfg.name}{' '}
                          <span className="text-[11px] font-medium text-slate-400">{cfg.info}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {sum.totalScore} / {cfg.weeklyMaxScore}점
                        </div>
                      </div>
                    </div>
                    {running && (
                      <span className="text-[10px] font-semibold text-amber-600 shrink-0">
                        타이머
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Workspace Nav */}
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold text-slate-400">메뉴</div>
            <nav className="space-y-1">
              {TAB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.key === 'youtube' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {scoreSummary.remainingMinutes}m
                      </span>
                    )}
                    {item.key === 'sticker' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {(currentData.stickers || []).length}/100
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Compact Live Timer Dock (shown in sidebar when not on YouTube tab) */}
          {activeTab !== 'youtube' && (
            <div className="rounded-xl bg-slate-950 text-white p-3.5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>유튜브 알림 타이머</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('youtube')}
                  className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
                >
                  상세
                </button>
              </div>

              <div className="space-y-2">
                {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
                  const cfg = CHILDREN_CONFIG[ck];
                  const sum = summaries[ck];
                  const t = timers[ck];
                  const isRinging = Boolean(t.isAlarmRinging);
                  const isFinished = t.remainingSeconds === 0;
                  const exceedsRemaining =
                    sum.remainingMinutes > 0 && t.targetMinutes > sum.remainingMinutes;
                  const isDisabled =
                    !t.isRunning && (sum.remainingMinutes <= 0 || exceedsRemaining);
                  return (
                    <div
                      key={ck}
                      className={`p-2.5 rounded-lg border space-y-2 ${
                        isRinging
                          ? 'bg-red-950/60 border-red-500 animate-pulse'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{cfg.name}</span>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            isRinging || isFinished ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          {formatTimer(t.remainingSeconds)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          설정 {t.targetMinutes}분 · 잔여 {sum.remainingMinutes}분
                        </span>
                        <div className="flex items-center gap-1">
                          {isRinging ? (
                            <button
                              type="button"
                              onClick={() => handleDismissChildAlarm(ck)}
                              className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-colors"
                            >
                              알림 해제
                            </button>
                          ) : isFinished ? (
                            sum.remainingMinutes > 0 && (
                              <button
                                type="button"
                                onClick={() => handleDeductChildTimer(ck, 'target')}
                                className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold tabular-nums transition-colors"
                              >
                                -{Math.min(t.targetMinutes, sum.remainingMinutes)}분 차감
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleToggleChildTimer(ck)}
                              className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                isDisabled
                                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                  : t.isRunning
                                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
                              }`}
                            >
                              {t.isRunning ? (
                                <>
                                  <Pause className="w-3 h-3 fill-current" />
                                  <span>정지</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>시작</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Bottom Access Mode Panel */}
        <div className="p-4 border-t border-slate-200/80 space-y-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={() => void syncFromCloud(true)}
            title="클라우드 동기화 새로고침"
            className={`w-full px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-between gap-2 transition-colors ${syncBadgeMeta.tone}`}
          >
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              <SyncBadgeIcon
                className={`w-3.5 h-3.5 shrink-0 ${syncBadgeMeta.spin ? 'animate-spin' : ''}`}
              />
              <span className="truncate">{syncBadgeMeta.label}</span>
            </span>
            <RefreshCw className="w-3 h-3 shrink-0 opacity-70" />
          </button>

          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              {isParentMode ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>부모님 관리 모드</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>자녀용 조회 모드</span>
                </>
              )}
            </span>
          </div>

          {isParentMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openPasswordChangeModal}
                className="flex-1 px-2.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <KeyRound className="w-3 h-3" />
                <span>비번 변경</span>
              </button>
              <button
                type="button"
                onClick={handleParentLogout}
                className="flex-1 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openLoginModal}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>부모님 암호 로그인</span>
            </button>
          )}
        </div>
      </aside>

      {/* ==========================================
          Main Viewport Column
      ========================================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (Strict 1-row, 3-zone contract, <= 15% mobile height) */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Single-line Title / Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="lg:hidden text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              수현·다현 매니저
            </span>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
              <span className="font-semibold text-slate-900">
                {currentConfig.name} ({currentConfig.info})
              </span>
              <span aria-hidden="true">/</span>
              <span>{currentTabMeta.label}</span>
            </div>
          </div>

          {/* Zone 2: Clean unboxed mode descriptor */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            {isParentMode ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <Unlock className="w-3.5 h-3.5" />
                <span>부모님 관리 모드 · 단독 제어 활성화</span>
              </span>
            ) : (
              <span>자녀용 조회 모드 · 읽기 전용 (부모 로그인 시 제어 가능)</span>
            )}
          </div>

          {/* Zone 3: Sync Status + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void syncFromCloud(true)}
              title="클라우드 동기화 새로고침"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${syncBadgeMeta.tone}`}
            >
              <SyncBadgeIcon
                className={`w-3.5 h-3.5 shrink-0 ${syncBadgeMeta.spin ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">{syncBadgeMeta.label}</span>
              <span className="sm:hidden">{syncBadgeMeta.shortLabel}</span>
            </button>

            {isParentMode ? (
              <button
                type="button"
                onClick={handleParentLogout}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>자녀 화면으로 잠금</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openLoginModal}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>부모님 로그인</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
          {/* Mobile & Tablet Child Switcher + Nav Tabs (non-sticky so mobile sticky cap < 15%) */}
          <div className="lg:hidden space-y-3">
            <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl">
              {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
                const cfg = CHILDREN_CONFIG[ck];
                const sum = summaries[ck];
                const isActive = activeChild === ck;
                const isBlue = ck === 'suhyun';

                return (
                  <button
                    key={ck}
                    type="button"
                    onClick={() => setActiveChild(ck)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors tabular-nums whitespace-nowrap ${
                      isActive
                        ? isBlue
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{cfg.name}</span>
                    <span className={isActive ? 'text-white/80' : 'text-slate-400'}>
                      {sum.totalScore}/{cfg.weeklyMaxScore}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
              {TAB_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Compact Timer Strip */}
            {activeTab !== 'youtube' && (
              <div className="bg-slate-950 text-white rounded-xl p-3 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>유튜브 알림 타이머</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('youtube')}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    시간 설정·제어
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['suhyun', 'dahyun'] as ChildKey[]).map((ck) => {
                    const cfg = CHILDREN_CONFIG[ck];
                    const sum = summaries[ck];
                    const t = timers[ck];
                    const isRinging = Boolean(t.isAlarmRinging);
                    const isFinished = t.remainingSeconds === 0;
                    const exceedsRemaining =
                      sum.remainingMinutes > 0 && t.targetMinutes > sum.remainingMinutes;
                    const isDisabled =
                      !t.isRunning && (sum.remainingMinutes <= 0 || exceedsRemaining);
                    return (
                      <div
                        key={ck}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                          isRinging
                            ? 'bg-red-950/60 border-red-500 animate-pulse'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">
                            {cfg.name}{' '}
                            <span className="text-[10px] font-normal text-slate-400">
                              ({t.targetMinutes}분)
                            </span>
                          </div>
                          <div
                            className={`font-mono font-bold tabular-nums ${
                              isRinging || isFinished ? 'text-red-400' : 'text-amber-400'
                            }`}
                          >
                            {formatTimer(t.remainingSeconds)}
                          </div>
                        </div>
                        {isRinging ? (
                          <button
                            type="button"
                            onClick={() => handleDismissChildAlarm(ck)}
                            className="px-2 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold shrink-0"
                          >
                            해제
                          </button>
                        ) : isFinished ? (
                          sum.remainingMinutes > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeductChildTimer(ck, 'target')}
                              className="px-2 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold shrink-0"
                            >
                              차감
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleToggleChildTimer(ck)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold shrink-0 ${
                              isDisabled
                                ? 'bg-slate-800 text-slate-600'
                                : t.isRunning
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {t.isRunning ? '정지' : '시작'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4-Column KPI Metric Strip (Single-Elevation, Zero-Pill, Tabular) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* KPI 1: Weekly Total Score */}
            <button
              type="button"
              onClick={() => {
                setShowIncompleteOnly(false);
                setActiveTab('board');
              }}
              className={`text-left bg-white hover:bg-slate-50/70 transition-colors rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-3 ${
                activeTab === 'board' && !showIncompleteOnly
                  ? isSuhyun
                    ? 'border-blue-500 ring-1 ring-blue-500/20'
                    : 'border-rose-500 ring-1 ring-rose-500/20'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500">이번 주 획득 점수</span>
                <TrendingUp
                  className={`w-4 h-4 ${isSuhyun ? 'text-blue-600' : 'text-rose-600'}`}
                />
              </div>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {scoreSummary.totalScore}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  / {currentConfig.weeklyMaxScore}점
                </span>
              </div>
              <div className="text-xs text-slate-500 pt-2.5 border-t border-slate-100 w-full tabular-nums">
                평일 {scoreSummary.weekdayScore}점 · 보충 +{scoreSummary.weekendMakeupScore}점
              </div>
            </button>

            {/* KPI 2: Weekend Makeup Potential */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('board');
                setShowIncompleteOnly(true);
              }}
              className={`text-left bg-white hover:bg-slate-50/70 transition-colors rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-3 ${
                activeTab === 'board' && showIncompleteOnly
                  ? 'border-amber-500 ring-1 ring-amber-500/20'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500">주말 보충 가능</span>
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-3xl font-bold tracking-tight text-amber-600">
                  +{scoreSummary.incompletePotentialScore}
                </span>
                <span className="text-sm font-medium text-slate-400">점 추가 가능</span>
              </div>
              <div className="text-xs text-slate-500 pt-2.5 border-t border-slate-100 w-full tabular-nums">
                미완료 {scoreSummary.incompleteCount}건 · 클릭하여 모아보기
              </div>
            </button>

            {/* KPI 3: Remaining YouTube Minutes */}
            <button
              type="button"
              onClick={() => setActiveTab('youtube')}
              className={`text-left bg-white hover:bg-slate-50/70 transition-colors rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-3 ${
                activeTab === 'youtube'
                  ? 'border-red-500 ring-1 ring-red-500/20'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500">주말 유튜브 잔여</span>
                <Youtube className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {scoreSummary.remainingMinutes}분
                </span>
                <span className="text-xs font-medium text-slate-400">
                  ({formatMinutesReadable(scoreSummary.remainingMinutes)})
                </span>
              </div>
              <div className="w-full space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${youtubeRemainingRatio}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  총 {scoreSummary.totalEarnedMinutes}분 중 {scoreSummary.usedMinutes}분 시청
                </div>
              </div>
            </button>

            {/* KPI 4: Praise Stickers 100 */}
            <button
              type="button"
              onClick={() => setActiveTab('sticker')}
              className={`text-left bg-white hover:bg-slate-50/70 transition-colors rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-3 ${
                activeTab === 'sticker'
                  ? 'border-violet-500 ring-1 ring-violet-500/20'
                  : 'border-slate-200/90'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-slate-500">
                  칭찬스티커 ({currentData.stickerRound}회차)
                </span>
                <Award className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {(currentData.stickers || []).length}
                </span>
                <span className="text-sm font-medium text-slate-400">/ 100개</span>
              </div>
              <div className="w-full space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-violet-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (currentData.stickers || []).length)}%`
                    }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  목표: {currentData.rewardGoal}
                </div>
              </div>
            </button>
          </section>

          {/* Active Workspace Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeChild}-${activeTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'board' && (
                <WeeklyBoardTab
                  currentConfig={currentConfig}
                  currentData={currentData}
                  scoreSummary={scoreSummary}
                  isParentMode={isParentMode}
                  stampMode={stampMode}
                  setStampMode={setStampMode}
                  showIncompleteOnly={showIncompleteOnly}
                  setShowIncompleteOnly={setShowIncompleteOnly}
                  onCellToggle={handleCellToggle}
                  onBulkDayComplete={handleBulkDayComplete}
                  onOpenClothesModal={(dayKey, dayLabel) =>
                    setClothesHelperModal({ dayKey, dayLabel })
                  }
                  onResetWeeklyBoard={handleResetWeeklyBoard}
                  onOpenLogin={openLoginModal}
                />
              )}

              {activeTab === 'youtube' && (
                <YoutubeTimerTab
                  currentConfig={currentConfig}
                  currentData={currentData}
                  scoreSummary={scoreSummary}
                  summaries={summaries}
                  timers={timers}
                  isParentMode={isParentMode}
                  onSetChildTimerMinutes={handleSetChildTimerMinutes}
                  onToggleChildTimer={handleToggleChildTimer}
                  onResetChildTimer={handleResetChildTimer}
                  onDismissChildAlarm={handleDismissChildAlarm}
                  onDeductChildTimer={handleDeductChildTimer}
                  onStartBothTimers={handleStartBothTimers}
                  onPauseBothTimers={handlePauseBothTimers}
                  onTestAlarmSound={handleTestAlarmSound}
                  onDeductYoutube={(mins, memo) =>
                    deductYoutubeForChild(activeChild, mins, memo)
                  }
                  onUndoWatchLog={handleUndoWatchLog}
                  onOpenLogin={openLoginModal}
                />
              )}

              {activeTab === 'sticker' && (
                <StickerBoardTab
                  currentConfig={currentConfig}
                  currentData={currentData}
                  isParentMode={isParentMode}
                  onAddSticker={handleAddSticker}
                  onRemoveLastSticker={handleRemoveLastSticker}
                  onResetStickerBoard={handleResetStickerBoard}
                  onSaveGoal={handleSaveGoal}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  isParentMode={isParentMode}
                  currentPinForChange={currentPinForChange}
                  setCurrentPinForChange={setCurrentPinForChange}
                  newPinInput={newPinInput}
                  setNewPinInput={setNewPinInput}
                  confirmNewPinInput={confirmNewPinInput}
                  setConfirmNewPinInput={setConfirmNewPinInput}
                  showPinText={showPinText}
                  setShowPinText={setShowPinText}
                  pinError={pinError}
                  setPinError={setPinError}
                  onSaveNewPin={handleSaveNewPin}
                  onOpenLogin={openLoginModal}
                  onResetAllDataExceptStickers={handleResetAllDataExceptStickers}
                  syncStatus={syncStatus}
                  storageType={storageType}
                  lastSyncedAt={lastSyncedAt}
                  onManualSync={() => void syncFromCloud(true)}
                  activeParentSession={activeParentSession}
                  isCurrentDeviceOwner={
                    isParentMode &&
                    Boolean(
                      myParentSessionIdRef.current &&
                        activeParentSession?.sessionId === myParentSessionIdRef.current
                    )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <ClothesHelperModal
        modalData={clothesHelperModal}
        currentConfig={currentConfig}
        currentData={currentData}
        isParentMode={isParentMode}
        onClose={() => setClothesHelperModal(null)}
        onToggleSubItem={handleToggleClothesSubItem}
      />

      <PinModal
        isOpen={pinModalOpen}
        changePinMode={changePinMode}
        pinInput={pinInput}
        setPinInput={setPinInput}
        currentPinForChange={currentPinForChange}
        setCurrentPinForChange={setCurrentPinForChange}
        newPinInput={newPinInput}
        setNewPinInput={setNewPinInput}
        confirmNewPinInput={confirmNewPinInput}
        setConfirmNewPinInput={setConfirmNewPinInput}
        showPinText={showPinText}
        setShowPinText={setShowPinText}
        pinError={pinError}
        setPinError={setPinError}
        activeOtherDevice={
          activeParentSession &&
          activeParentSession.sessionId !== myParentSessionIdRef.current
            ? activeParentSession
            : null
        }
        isLoggingIn={isLoggingIn}
        onClose={() => {
          setPinModalOpen(false);
          setPinError('');
          pendingTimerDeductRef.current = null;
        }}
        onLoginSubmit={handleParentLogin}
        onSaveNewPinSubmit={handleSaveNewPin}
      />

      <TimerAlarmModal
        ringingChildren={
          isParentMode
            ? (['suhyun', 'dahyun'] as ChildKey[])
                .filter((ck) => timers[ck].isAlarmRinging)
                .map((ck) => ({
                  childKey: ck,
                  name: CHILDREN_CONFIG[ck].name,
                  info: CHILDREN_CONFIG[ck].info,
                  targetMinutes: timers[ck].targetMinutes,
                  remainingMinutes: summaries[ck].remainingMinutes
                }))
            : []
        }
        isParentMode={isParentMode}
        onDismissOnly={handleDismissChildAlarm}
        onDismissAndDeduct={(ck) => handleDeductChildTimer(ck, 'target')}
      />

      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
