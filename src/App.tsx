import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  KeyRound,
  Lock,
  LogOut,
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
  DAYS,
  DEFAULT_CHILD_PINS,
  INACTIVITY_TIMEOUT_MS,
  INACTIVITY_WARNING_MS,
  SESSION_HEARTBEAT_INTERVAL_MS,
  STORAGE_KEY_CHILD_PINS,
  STORAGE_KEY_DATA,
  STORAGE_KEY_PIN,
  STORAGE_KEY_TIMERS
} from './constants';
import {
  AuthRole,
  CheckStatus,
  ChildData,
  ChildKey,
  ChildrenDataMap,
  CloudAppState,
  CloudStorageType,
  ConfirmDialogState,
  DayKey,
  DynamicScoreProposal,
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
  createEmptyWeeklyRecord,
  createInitialChildData,
  formatMinutesReadable,
  formatTimer,
  freezeEarnedScoresForChild,
  getEffectiveChildConfig,
  getWeeklyRecord,
  normalizeChildData,
  sanitizeItemScore
} from './utils/scoreUtils';
import {
  formatWeekRangeLabel,
  getWeekIdForTimestamp,
  isPastMonday1AmKstForWeek,
  shiftWeekId
} from './utils/weekUtils';
import { generateWeeklyDynamicScoreProposal } from './utils/dynamicScoring';
import {
  base64ToBlobUrl,
  blobToBase64,
  fetchReadingAudio,
  pickSupportedAudioMimeType,
  uploadReadingAudio
} from './utils/audioRecorder';
import {
  computeTimerRemaining,
  createDefaultChildTimer,
  createParentSessionId,
  DEFAULT_TIMER_MINUTES,
  detectDeviceLabel,
  fetchCloudState,
  hydrateTimers,
  saveCloudState,
  sendParentSessionHeartbeat
} from './utils/cloudSync';
import {
  playAlarmTestSound,
  releaseScreenWakeLock,
  requestScreenWakeLock,
  startContinuousAlarmSound,
  unlockAlarmAudio
} from './utils/alarmAudio';
import { LoginScreen } from './components/LoginScreen';
import { WeeklyBoardTab } from './components/WeeklyBoardTab';
import { YoutubeTimerTab } from './components/YoutubeTimerTab';
import { StickerBoardTab } from './components/StickerBoardTab';
import { SettingsTab } from './components/SettingsTab';
import {
  ClothesHelperModal,
  ConfirmModal,
  DynamicScoreProposalModal,
  PinModal,
  TimerAlarmModal
} from './components/Modals';

const TAB_ITEMS: { key: TabKey; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'board', label: '주간 채점 & 보충', shortLabel: '주간 채점', icon: Calendar },
  { key: 'youtube', label: '유튜브 & 타이머', shortLabel: '유튜브 타이머', icon: Youtube },
  { key: 'sticker', label: '칭찬스티커 100', shortLabel: '칭찬스티커', icon: Award },
  { key: 'settings', label: '배점표 & 설정', shortLabel: '배점·설정', icon: Settings }
];

export default function App() {
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [activeChild, setActiveChild] = useState<ChildKey>('suhyun');
  const [activeTab, setActiveTab] = useState<TabKey>('board');
  const [selectedWeekId, setSelectedWeekId] = useState<string>(() => getWeekIdForTimestamp());

  // Child mode (false, default) vs Parent mode (true, PIN protected)
  const [isParentMode, setIsParentMode] = useState(false);
  const [savedParentPin, setSavedParentPin] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PIN) || '1234';
    } catch {
      return '1234';
    }
  });
  const [childPins, setChildPins] = useState<Record<ChildKey, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHILD_PINS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          suhyun:
            typeof parsed?.suhyun === 'string' && parsed.suhyun.trim().length >= 4
              ? parsed.suhyun.trim()
              : DEFAULT_CHILD_PINS.suhyun,
          dahyun:
            typeof parsed?.dahyun === 'string' && parsed.dahyun.trim().length >= 4
              ? parsed.dahyun.trim()
              : DEFAULT_CHILD_PINS.dahyun
        };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CHILD_PINS };
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [changePinMode, setChangePinMode] = useState(false);
  const [currentPinForChange, setCurrentPinForChange] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [showPinText, setShowPinText] = useState(false);

  // Weekly automatic dynamic score proposal state
  const [pendingScoreProposal, setPendingScoreProposal] = useState<DynamicScoreProposal | null>(null);
  const [lastDynamicScoreWeekId, setLastDynamicScoreWeekId] = useState<string | null>(null);

  // Board filter & stamp controls
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [stampMode, setStampMode] = useState<StampMode>('CYCLE');
  const [clothesHelperModal, setClothesHelperModal] = useState<{
    dayKey: DayKey;
    dayLabel: string;
  } | null>(null);

  // Audio recording & playback controls for reading journal
  const [recordingTarget, setRecordingTarget] = useState<{
    childKey: ChildKey;
    weekId: string;
    dayKey: DayKey;
  } | null>(null);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Children data state
  const [childrenData, setChildrenData] = useState<ChildrenDataMap>(() => {
    const initialWeekId = getWeekIdForTimestamp();
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          suhyun: normalizeChildData('suhyun', parsed?.suhyun, initialWeekId),
          dahyun: normalizeChildData('dahyun', parsed?.dahyun, initialWeekId)
        };
      }
    } catch (e) {
      console.error('Failed to load from localStorage', e);
    }
    return {
      suhyun: createInitialChildData('suhyun', initialWeekId),
      dahyun: createInitialChildData('dahyun', initialWeekId)
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
  const activeAuthPinRef = useRef('');
  const isParentModeRef = useRef(false);
  isParentModeRef.current = isParentMode;
  const activeParentSessionRef = useRef<ParentSessionInfo | null>(null);
  activeParentSessionRef.current = activeParentSession;

  const lastActivityAtRef = useRef(Date.now());
  const lastServerHeartbeatAtRef = useRef(0);
  const inactivityWarningShownRef = useRef(false);
  const isAutoLoggingOutRef = useRef(false);
  const isBusyOperationActive =
    recordingTarget !== null ||
    isUploadingAudio ||
    (isParentMode &&
      (timers.suhyun.isRunning ||
        timers.dahyun.isRunning ||
        Boolean(timers.suhyun.isAlarmRinging) ||
        Boolean(timers.dahyun.isAlarmRinging)));
  const isBusyOperationActiveRef = useRef(false);
  isBusyOperationActiveRef.current = isBusyOperationActive;
  const wasBusyOperationActiveRef = useRef(false);
  const performInactivityLogoutRef = useRef<
    ((remoteState?: CloudAppState | null, options?: { skipServerRelease?: boolean }) => void) | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartMsRef = useRef(0);
  const recordingTargetRef = useRef<{
    childKey: ChildKey;
    weekId: string;
    dayKey: DayKey;
  } | null>(null);
  recordingTargetRef.current = recordingTarget;
  const cancelRecordingOnStopRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);

  const cleanupMediaAndAudio = useCallback((cancelRecorder = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      cancelRecordingOnStopRef.current = cancelRecorder;
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setRecordingTarget(null);
    setRecordingElapsedSec(0);

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
      } catch {
        // ignore
      }
      audioPlayerRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    setPlayingAudioId(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupMediaAndAudio(true);
    };
  }, [cleanupMediaAndAudio]);
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
    (
      data: ChildrenDataMap,
      pin: string,
      cPins: Record<ChildKey, string>,
      timersData: TimersMap,
      proposal: DynamicScoreProposal | null,
      lastDynamicWeek: string | null
    ): string => {
      return JSON.stringify({
        childrenData: data,
        parentPin: pin,
        childPins: cPins,
        timers: buildSyncTimersPayload(timersData),
        pendingScoreProposal: proposal,
        lastDynamicScoreWeekId: lastDynamicWeek
      });
    },
    [buildSyncTimersPayload]
  );

  const latestSyncSnapshotRef = useRef({
    childrenData,
    savedParentPin,
    childPins,
    timers,
    pendingScoreProposal,
    lastDynamicScoreWeekId
  });
  latestSyncSnapshotRef.current = {
    childrenData,
    savedParentPin,
    childPins,
    timers,
    pendingScoreProposal,
    lastDynamicScoreWeekId
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
          activeAuthPinRef.current = '';
          isParentModeRef.current = false;
          pendingPushRef.current = false;
          pendingTimerDeductRef.current = null;
          cleanupMediaAndAudio(true);
          setIsParentMode(false);
          setAuthRole(null);
          if (!options?.suppressAutoLogoutToast) {
            setLoginNotice('다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.');
            showToast(
              '다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.',
              'warning'
            );
          }
        }
      }

      const currentWeekId = getWeekIdForTimestamp();
      const normalizedChildren: ChildrenDataMap = {
        suhyun: normalizeChildData('suhyun', remote.childrenData?.suhyun, currentWeekId),
        dahyun: normalizeChildData('dahyun', remote.childrenData?.dahyun, currentWeekId)
      };
      const nextPin =
        typeof remote.parentPin === 'string' && remote.parentPin.trim().length >= 4
          ? remote.parentPin.trim()
          : latestSyncSnapshotRef.current.savedParentPin;
      const nextChildPins: Record<ChildKey, string> = {
        suhyun:
          typeof remote.childPins?.suhyun === 'string' && remote.childPins.suhyun.trim().length >= 4
            ? remote.childPins.suhyun.trim()
            : latestSyncSnapshotRef.current.childPins.suhyun,
        dahyun:
          typeof remote.childPins?.dahyun === 'string' && remote.childPins.dahyun.trim().length >= 4
            ? remote.childPins.dahyun.trim()
            : latestSyncSnapshotRef.current.childPins.dahyun
      };
      const nextTimers = hydrateTimers(remote.timers);
      const nextProposal =
        remote.pendingScoreProposal !== undefined
          ? remote.pendingScoreProposal ?? null
          : latestSyncSnapshotRef.current.pendingScoreProposal;
      const nextLastDynamicWeek =
        remote.lastDynamicScoreWeekId !== undefined
          ? remote.lastDynamicScoreWeekId ?? null
          : latestSyncSnapshotRef.current.lastDynamicScoreWeekId;

      lastCloudSignatureRef.current = buildSyncSignature(
        normalizedChildren,
        nextPin,
        nextChildPins,
        nextTimers,
        nextProposal,
        nextLastDynamicWeek
      );
      lastUpdatedAtRef.current = remote.updatedAt || Date.now();
      latestSyncSnapshotRef.current = {
        childrenData: normalizedChildren,
        savedParentPin: nextPin,
        childPins: nextChildPins,
        timers: nextTimers,
        pendingScoreProposal: nextProposal,
        lastDynamicScoreWeekId: nextLastDynamicWeek
      };

      setActiveParentSession(remoteSession);
      setChildrenData(normalizedChildren);
      setSavedParentPin(nextPin);
      setChildPins(nextChildPins);
      setTimers(nextTimers);
      setPendingScoreProposal(nextProposal);
      setLastDynamicScoreWeekId(nextLastDynamicWeek);

      try {
        localStorage.setItem(STORAGE_KEY_PIN, nextPin);
        localStorage.setItem(STORAGE_KEY_CHILD_PINS, JSON.stringify(nextChildPins));
      } catch (err) {
        console.error('Failed to save synced PINs to localStorage', err);
      }
    },
    [buildSyncSignature, cleanupMediaAndAudio, showToast]
  );

  const forceLogoutDueToOtherDevice = useCallback(
    (remoteState?: CloudAppState | null) => {
      myParentSessionIdRef.current = null;
      mySessionLoggedInAtRef.current = 0;
      activeAuthPinRef.current = '';
      isParentModeRef.current = false;
      pendingPushRef.current = false;
      pendingTimerDeductRef.current = null;
      cleanupMediaAndAudio(true);
      setIsParentMode(false);
      setAuthRole(null);

      if (remoteState && remoteState.childrenData) {
        applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
      }
      setLoginNotice('다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.');
      showToast(
        '다른 기기에서 부모님 로그인이 감지되어 이 기기는 자동 로그아웃되었습니다.',
        'warning'
      );
    },
    [applyRemoteState, cleanupMediaAndAudio, showToast]
  );

  const pushStateToCloud = useCallback(
    async (
      data: ChildrenDataMap,
      pin: string,
      cPins: Record<ChildKey, string>,
      timersData: TimersMap,
      proposal: DynamicScoreProposal | null,
      lastDynamicWeek: string | null,
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
      const signature = buildSyncSignature(
        data,
        pin,
        cPins,
        syncTimers,
        proposal,
        lastDynamicWeek
      );
      const updatedAt = Math.max(Date.now(), lastUpdatedAtRef.current + 1);
      const sessionPayload =
        options?.sessionOverride !== undefined
          ? options.sessionOverride
          : options?.releaseSession
          ? null
          : activeParentSessionRef.current;

      const payload: CloudAppState = {
        version: 4,
        updatedAt,
        childrenData: data,
        parentPin: pin,
        childPins: cPins,
        timers: syncTimers,
        activeParentSession: sessionPayload,
        pendingScoreProposal: proposal,
        lastDynamicScoreWeekId: lastDynamicWeek
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
        if (res.sessionExpired) {
          performInactivityLogoutRef.current?.(res.state, { skipServerRelease: true });
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
        const nowTs = Date.now();
        lastServerHeartbeatAtRef.current = nowTs;
        setLastSyncedAt(nowTs);
        return true;
      } catch (err) {
        console.error('Cloud save failed', err);
        setSyncStatus('error');
        return false;
      }
    },
    [buildSyncSignature, buildSyncTimersPayload, forceLogoutDueToOtherDevice]
  );

  const performInactivityLogout = useCallback(
    (remoteState?: CloudAppState | null, options?: { skipServerRelease?: boolean }) => {
      if (isAutoLoggingOutRef.current) return;
      isAutoLoggingOutRef.current = true;

      cleanupMediaAndAudio(true);
      setPinModalOpen(false);
      setClothesHelperModal(null);
      setConfirmDialog(null);

      const prevSessionId = myParentSessionIdRef.current;
      const wasParent = isParentModeRef.current;

      myParentSessionIdRef.current = null;
      mySessionLoggedInAtRef.current = 0;
      activeAuthPinRef.current = '';
      isParentModeRef.current = false;
      pendingPushRef.current = false;
      pendingTimerDeductRef.current = null;
      inactivityWarningShownRef.current = false;

      setIsParentMode(false);
      setAuthRole(null);
      setActiveParentSession(null);

      if (remoteState && remoteState.childrenData) {
        applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
      }

      setLoginNotice('30분 동안 동작이 없어 보안을 위해 자동 로그아웃되었습니다.');
      showToast('30분 동안 동작이 없어 자동 로그아웃되었습니다.', 'warning');

      if (!options?.skipServerRelease && wasParent && storageTypeRef.current !== 'none' && prevSessionId) {
        const snap = latestSyncSnapshotRef.current;
        void pushStateToCloud(
          snap.childrenData,
          snap.savedParentPin,
          snap.childPins,
          snap.timers,
          snap.pendingScoreProposal,
          snap.lastDynamicScoreWeekId,
          {
            releaseSession: true,
            clientSessionIdOverride: prevSessionId,
            sessionOverride: null
          }
        );
      }
    },
    [applyRemoteState, cleanupMediaAndAudio, pushStateToCloud, showToast]
  );
  performInactivityLogoutRef.current = performInactivityLogout;

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
          setIsBootstrapping(false);
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
          await pushStateToCloud(
            snap.childrenData,
            snap.savedParentPin,
            snap.childPins,
            snap.timers,
            snap.pendingScoreProposal,
            snap.lastDynamicScoreWeekId,
            {
              allowInitialSeed: true,
              sessionOverride: null
            }
          );
        }
      } catch (err) {
        console.error('Failed to fetch initial cloud state', err);
        if (!active) return;
        setSyncStatus('error');
        isInitialHydratedRef.current = true;
      } finally {
        if (active) setIsBootstrapping(false);
      }
    };

    initCloud();
    return () => {
      active = false;
    };
  }, [applyRemoteState, pushStateToCloud]);

  // Persist children data & child PINs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(childrenData));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [childrenData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHILD_PINS, JSON.stringify(childPins));
    } catch (e) {
      console.error('Failed to save child PINs to localStorage', e);
    }
  }, [childPins]);

  // Persist timers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIMERS, JSON.stringify(timers));
    } catch (e) {
      console.error('Failed to save timers', e);
    }
  }, [timers]);

  const currentSyncSignature = useMemo(
    () =>
      buildSyncSignature(
        childrenData,
        savedParentPin,
        childPins,
        timers,
        pendingScoreProposal,
        lastDynamicScoreWeekId
      ),
    [
      buildSyncSignature,
      childrenData,
      savedParentPin,
      childPins,
      timers,
      pendingScoreProposal,
      lastDynamicScoreWeekId
    ]
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
        await pushStateToCloud(
          childrenData,
          savedParentPin,
          childPins,
          timers,
          pendingScoreProposal,
          lastDynamicScoreWeekId
        );
      } finally {
        pendingPushRef.current = false;
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      pendingPushRef.current = false;
    };
  }, [
    currentSyncSignature,
    storageType,
    isParentMode,
    childrenData,
    savedParentPin,
    childPins,
    timers,
    pendingScoreProposal,
    lastDynamicScoreWeekId,
    pushStateToCloud
  ]);

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
          if (
            isParentModeRef.current &&
            myParentSessionIdRef.current &&
            res.expiredSessionId &&
            res.expiredSessionId === myParentSessionIdRef.current
          ) {
            performInactivityLogoutRef.current?.(res.state, { skipServerRelease: true });
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
            return;
          }

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
          const localSig = buildSyncSignature(
            snap.childrenData,
            snap.savedParentPin,
            snap.childPins,
            snap.timers,
            snap.pendingScoreProposal,
            snap.lastDynamicScoreWeekId
          );
          if (localSig !== lastCloudSignatureRef.current) {
            const ok = await pushStateToCloud(
              snap.childrenData,
              snap.savedParentPin,
              snap.childPins,
              snap.timers,
              snap.pendingScoreProposal,
              snap.lastDynamicScoreWeekId
            );
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

  // Reset idle clock when an active timer/alarm/recording finishes so user gets a fresh 30-min window
  useEffect(() => {
    if (authRole !== null && wasBusyOperationActiveRef.current && !isBusyOperationActive) {
      lastActivityAtRef.current = Date.now();
      inactivityWarningShownRef.current = false;
    }
    wasBusyOperationActiveRef.current = isBusyOperationActive;
  }, [authRole, isBusyOperationActive]);

  // 30-minute inactivity auto-logout & parent session heartbeat
  useEffect(() => {
    if (authRole === null) return;

    lastActivityAtRef.current = Date.now();
    inactivityWarningShownRef.current = false;
    isAutoLoggingOutRef.current = false;

    let lastRecordedActivity = Date.now();
    let heartbeatInFlight = false;

    const sendHeartbeatIfNeeded = (now: number) => {
      if (
        !isParentModeRef.current ||
        !myParentSessionIdRef.current ||
        storageTypeRef.current === 'none' ||
        heartbeatInFlight ||
        now - lastServerHeartbeatAtRef.current < SESSION_HEARTBEAT_INTERVAL_MS
      ) {
        return;
      }

      heartbeatInFlight = true;
      const sessionId = myParentSessionIdRef.current;
      void sendParentSessionHeartbeat(sessionId)
        .then((res) => {
          if (myParentSessionIdRef.current !== sessionId) return;
          if (res.sessionExpired) {
            performInactivityLogoutRef.current?.(res.state, { skipServerRelease: true });
          } else if (res.sessionReplaced) {
            forceLogoutDueToOtherDevice(res.state);
          } else if (res.ok) {
            lastServerHeartbeatAtRef.current = Date.now();
            if (res.state?.activeParentSession) {
              setActiveParentSession(res.state.activeParentSession);
            }
          }
        })
        .catch((err) => {
          console.error('Parent session heartbeat failed', err);
        })
        .finally(() => {
          heartbeatInFlight = false;
        });
    };

    const checkInactivityAndHeartbeat = () => {
      if (isAutoLoggingOutRef.current) return;
      const now = Date.now();

      if (isBusyOperationActiveRef.current) {
        lastActivityAtRef.current = now;
        inactivityWarningShownRef.current = false;
        sendHeartbeatIfNeeded(now);
        return;
      }

      const idleMs = now - lastActivityAtRef.current;
      if (idleMs >= INACTIVITY_TIMEOUT_MS) {
        performInactivityLogoutRef.current?.();
        return;
      }

      if (idleMs >= INACTIVITY_WARNING_MS && !inactivityWarningShownRef.current) {
        inactivityWarningShownRef.current = true;
        showToast('1분 동안 동작이 없으면 보안을 위해 자동 로그아웃됩니다.', 'warning');
      }

      if (lastActivityAtRef.current > lastServerHeartbeatAtRef.current) {
        sendHeartbeatIfNeeded(now);
      }
    };

    const handleUserActivity = () => {
      if (isAutoLoggingOutRef.current) return;
      const now = Date.now();

      // Check expiration before refreshing timestamp (handles wake-from-sleep)
      if (!isBusyOperationActiveRef.current && now - lastActivityAtRef.current >= INACTIVITY_TIMEOUT_MS) {
        performInactivityLogoutRef.current?.();
        return;
      }

      if (now - lastRecordedActivity < 1000) return;
      lastRecordedActivity = now;
      lastActivityAtRef.current = now;
      inactivityWarningShownRef.current = false;
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityAndHeartbeat();
      }
    };

    window.addEventListener('pointerdown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('wheel', handleUserActivity, { passive: true });
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const intervalId = setInterval(checkInactivityAndHeartbeat, 10000);

    return () => {
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('wheel', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity, { capture: true });
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(intervalId);
    };
  }, [authRole, forceLogoutDueToOtherDevice, showToast]);

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

  const effectiveConfigs = useMemo(
    () => ({
      suhyun: getEffectiveChildConfig('suhyun', childrenData.suhyun),
      dahyun: getEffectiveChildConfig('dahyun', childrenData.dahyun)
    }),
    [childrenData]
  );

  const summaries = useMemo(() => {
    return {
      suhyun: computeChildScoreSummary('suhyun', childrenData.suhyun, selectedWeekId),
      dahyun: computeChildScoreSummary('dahyun', childrenData.dahyun, selectedWeekId)
    };
  }, [childrenData, selectedWeekId]);

  const currentConfig = effectiveConfigs[activeChild];
  const currentData = childrenData[activeChild];
  const currentWeekRecord = useMemo(
    () => getWeeklyRecord(activeChild, currentData, selectedWeekId),
    [activeChild, currentData, selectedWeekId]
  );
  const scoreSummary = summaries[activeChild];
  const allItems = useMemo(
    () => [...currentConfig.studyItems, ...currentConfig.habitItems],
    [currentConfig]
  );

  const realCurrentWeekId = getWeekIdForTimestamp();
  const isViewingCurrentWeek = selectedWeekId === realCurrentWeekId;

  // Enforce locked child profile when logged in as child
  useEffect(() => {
    if (authRole === 'suhyun' || authRole === 'dahyun') {
      if (activeChild !== authRole) setActiveChild(authRole);
      if (activeTab === 'settings') setActiveTab('board');
    }
  }, [authRole, activeChild, activeTab]);

  // Helper to evaluate weekly automatic dynamic scoring at/after Monday 01:00 KST
  const evaluateDynamicScoreProposal = useCallback(
    (
      dataSnapshot: ChildrenDataMap,
      existingProposal: DynamicScoreProposal | null,
      lastProcessedWeekId: string | null
    ): DynamicScoreProposal | null => {
      const targetWeekId = getWeekIdForTimestamp();
      if (existingProposal) return existingProposal;
      if (lastProcessedWeekId === targetWeekId) return null;
      if (!isPastMonday1AmKstForWeek(targetWeekId)) return null;
      return generateWeeklyDynamicScoreProposal(dataSnapshot, targetWeekId, {
        requirePastData: true
      });
    },
    []
  );

  // Check every 60 seconds while parent is logged in (handles passing Monday 01:00 KST live)
  useEffect(() => {
    if (!isParentMode || authRole !== 'parent') return;
    const checkWeeklyRollover = () => {
      const proposal = evaluateDynamicScoreProposal(
        latestSyncSnapshotRef.current.childrenData,
        latestSyncSnapshotRef.current.pendingScoreProposal,
        latestSyncSnapshotRef.current.lastDynamicScoreWeekId
      );
      if (proposal && !latestSyncSnapshotRef.current.pendingScoreProposal) {
        setPendingScoreProposal(proposal);
      }
    };
    const timerId = setInterval(checkWeeklyRollover, 60000);
    return () => clearInterval(timerId);
  }, [isParentMode, authRole, evaluateDynamicScoreProposal]);

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

  // Initial / Screen Login (Parent OR Child)
  const handleAuthLogin = async (
    role: AuthRole,
    enteredPin: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isLoggingIn) return { ok: false, error: '로그인 처리 중입니다.' };
    if (!enteredPin) {
      return { ok: false, error: '비밀번호를 입력해주세요.' };
    }

    unlockAlarmAudio();
    setLoginNotice(null);

    if (role === 'suhyun' || role === 'dahyun') {
      const childName = CHILDREN_CONFIG[role].name;

      if (storageTypeRef.current === 'none') {
        if (enteredPin !== childPins[role]) {
          return { ok: false, error: `${childName} 비밀번호가 일치하지 않습니다.` };
        }
        activeAuthPinRef.current = enteredPin;
        lastActivityAtRef.current = Date.now();
        lastServerHeartbeatAtRef.current = Date.now();
        inactivityWarningShownRef.current = false;
        isAutoLoggingOutRef.current = false;
        setAuthRole(role);
        setIsParentMode(false);
        setActiveChild(role);
        setActiveTab('board');
        setSelectedWeekId(getWeekIdForTimestamp());
        showToast(`${childName} 계정에 로그인되었습니다.`, 'success');
        return { ok: true };
      }

      setIsLoggingIn(true);
      try {
        const res = await fetchCloudState();
        if (!res.ok) {
          return { ok: false, error: '클라우드 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.' };
        }
        if (!res.configured) {
          setStorageType('none');
          setSyncStatus('local_only');
          if (enteredPin !== childPins[role]) {
            return { ok: false, error: `${childName} 비밀번호가 일치하지 않습니다.` };
          }
        } else {
          const remoteState = res.state && res.state.childrenData ? res.state : null;
          if (remoteState && (remoteState.updatedAt || 0) > lastUpdatedAtRef.current) {
            applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
          }
          const effectiveChildPin =
            remoteState?.childPins?.[role] && remoteState.childPins[role].trim().length >= 4
              ? remoteState.childPins[role].trim()
              : childPins[role];

          if (enteredPin !== effectiveChildPin) {
            return { ok: false, error: `${childName} 비밀번호가 일치하지 않습니다.` };
          }
        }

        activeAuthPinRef.current = enteredPin;
        lastActivityAtRef.current = Date.now();
        lastServerHeartbeatAtRef.current = Date.now();
        inactivityWarningShownRef.current = false;
        isAutoLoggingOutRef.current = false;
        setAuthRole(role);
        setIsParentMode(false);
        setActiveChild(role);
        setActiveTab('board');
        setSelectedWeekId(getWeekIdForTimestamp());
        showToast(`${childName} 계정에 로그인되었습니다.`, 'success');
        return { ok: true };
      } catch (err) {
        console.error('Child login failed', err);
        return { ok: false, error: '로그인 처리 중 오류가 발생했습니다.' };
      } finally {
        setIsLoggingIn(false);
      }
    }

    // Parent login from LoginScreen (exclusive single-device session)
    if (storageTypeRef.current === 'none') {
      if (enteredPin !== savedParentPin) {
        return { ok: false, error: '부모님 비밀번호가 일치하지 않습니다.' };
      }
      const loginNow = Date.now();
      const localSession: ParentSessionInfo = {
        sessionId: createParentSessionId(),
        loggedInAt: loginNow,
        lastActiveAt: loginNow,
        deviceLabel: detectDeviceLabel()
      };
      myParentSessionIdRef.current = localSession.sessionId;
      mySessionLoggedInAtRef.current = localSession.loggedInAt;
      activeAuthPinRef.current = enteredPin;
      isParentModeRef.current = true;
      lastActivityAtRef.current = loginNow;
      lastServerHeartbeatAtRef.current = loginNow;
      inactivityWarningShownRef.current = false;
      isAutoLoggingOutRef.current = false;
      setActiveParentSession(localSession);
      setIsParentMode(true);
      setAuthRole('parent');
      setSelectedWeekId(getWeekIdForTimestamp());
      const proposal = evaluateDynamicScoreProposal(
        latestSyncSnapshotRef.current.childrenData,
        latestSyncSnapshotRef.current.pendingScoreProposal,
        latestSyncSnapshotRef.current.lastDynamicScoreWeekId
      );
      if (proposal && !latestSyncSnapshotRef.current.pendingScoreProposal) {
        setPendingScoreProposal(proposal);
      }
      showToast('부모님 관리 모드로 로그인되었습니다.', 'success');
      return { ok: true };
    }

    setIsLoggingIn(true);
    try {
      const res = await fetchCloudState();
      if (!res.ok) {
        return { ok: false, error: '클라우드 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.' };
      }
      if (!res.configured) {
        setStorageType('none');
        setSyncStatus('local_only');
        if (enteredPin !== savedParentPin) {
          return { ok: false, error: '부모님 비밀번호가 일치하지 않습니다.' };
        }
        const loginNow = Date.now();
        const localSession: ParentSessionInfo = {
          sessionId: createParentSessionId(),
          loggedInAt: loginNow,
          lastActiveAt: loginNow,
          deviceLabel: detectDeviceLabel()
        };
        myParentSessionIdRef.current = localSession.sessionId;
        mySessionLoggedInAtRef.current = localSession.loggedInAt;
        activeAuthPinRef.current = enteredPin;
        isParentModeRef.current = true;
        lastActivityAtRef.current = loginNow;
        lastServerHeartbeatAtRef.current = loginNow;
        inactivityWarningShownRef.current = false;
        isAutoLoggingOutRef.current = false;
        setActiveParentSession(localSession);
        setIsParentMode(true);
        setAuthRole('parent');
        setSelectedWeekId(getWeekIdForTimestamp());
        const proposal = evaluateDynamicScoreProposal(
          latestSyncSnapshotRef.current.childrenData,
          latestSyncSnapshotRef.current.pendingScoreProposal,
          latestSyncSnapshotRef.current.lastDynamicScoreWeekId
        );
        if (proposal && !latestSyncSnapshotRef.current.pendingScoreProposal) {
          setPendingScoreProposal(proposal);
        }
        showToast('부모님 관리 모드로 로그인되었습니다.', 'success');
        return { ok: true };
      }

      const currentWeekId = getWeekIdForTimestamp();
      const remoteState = res.state && res.state.childrenData ? res.state : null;
      const effectivePin =
        remoteState?.parentPin && typeof remoteState.parentPin === 'string' && remoteState.parentPin.trim().length >= 4
          ? remoteState.parentPin.trim()
          : savedParentPin;

      if (remoteState && (remoteState.updatedAt || 0) > lastUpdatedAtRef.current) {
        applyRemoteState(remoteState, { suppressAutoLogoutToast: true });
      }

      if (enteredPin !== effectivePin) {
        return { ok: false, error: '부모님 비밀번호가 일치하지 않습니다.' };
      }

      const freshChildren: ChildrenDataMap = remoteState
        ? {
            suhyun: normalizeChildData('suhyun', remoteState.childrenData?.suhyun, currentWeekId),
            dahyun: normalizeChildData('dahyun', remoteState.childrenData?.dahyun, currentWeekId)
          }
        : latestSyncSnapshotRef.current.childrenData;
      const freshTimers: TimersMap = remoteState
        ? hydrateTimers(remoteState.timers)
        : latestSyncSnapshotRef.current.timers;
      const freshChildPins: Record<ChildKey, string> = {
        suhyun:
          remoteState?.childPins?.suhyun && remoteState.childPins.suhyun.trim().length >= 4
            ? remoteState.childPins.suhyun.trim()
            : latestSyncSnapshotRef.current.childPins.suhyun,
        dahyun:
          remoteState?.childPins?.dahyun && remoteState.childPins.dahyun.trim().length >= 4
            ? remoteState.childPins.dahyun.trim()
            : latestSyncSnapshotRef.current.childPins.dahyun
      };
      const existingProposal =
        remoteState?.pendingScoreProposal !== undefined
          ? remoteState.pendingScoreProposal ?? null
          : latestSyncSnapshotRef.current.pendingScoreProposal;
      const freshLastDynamicWeek =
        remoteState?.lastDynamicScoreWeekId !== undefined
          ? remoteState.lastDynamicScoreWeekId ?? null
          : latestSyncSnapshotRef.current.lastDynamicScoreWeekId;
      const proposalToShow = evaluateDynamicScoreProposal(
        freshChildren,
        existingProposal,
        freshLastDynamicWeek
      );

      const hadOtherSession = Boolean(remoteState?.activeParentSession?.sessionId);
      const loginNow = Date.now();
      const newSession: ParentSessionInfo = {
        sessionId: createParentSessionId(),
        loggedInAt: loginNow,
        lastActiveAt: loginNow,
        deviceLabel: detectDeviceLabel()
      };
      const syncTimers = buildSyncTimersPayload(freshTimers);
      const updatedAt = Math.max(Date.now(), (remoteState?.updatedAt || 0) + 1, lastUpdatedAtRef.current + 1);

      const claimRes = await saveCloudState(
        {
          version: 4,
          updatedAt,
          childrenData: freshChildren,
          parentPin: effectivePin,
          childPins: freshChildPins,
          timers: syncTimers,
          activeParentSession: newSession,
          pendingScoreProposal: proposalToShow,
          lastDynamicScoreWeekId: freshLastDynamicWeek
        },
        {
          claimSession: true,
          clientSessionId: newSession.sessionId
        }
      );

      if (!claimRes.ok) {
        return { ok: false, error: '로그인 세션 등록에 실패했습니다. 잠시 후 다시 시도해주세요.' };
      }

      myParentSessionIdRef.current = newSession.sessionId;
      mySessionLoggedInAtRef.current = newSession.loggedInAt;
      activeAuthPinRef.current = effectivePin;
      isParentModeRef.current = true;
      lastActivityAtRef.current = loginNow;
      lastServerHeartbeatAtRef.current = loginNow;
      inactivityWarningShownRef.current = false;
      isAutoLoggingOutRef.current = false;
      lastCloudSignatureRef.current = buildSyncSignature(
        freshChildren,
        effectivePin,
        freshChildPins,
        freshTimers,
        proposalToShow,
        freshLastDynamicWeek
      );
      lastUpdatedAtRef.current = claimRes.state?.updatedAt || updatedAt;
      latestSyncSnapshotRef.current = {
        childrenData: freshChildren,
        savedParentPin: effectivePin,
        childPins: freshChildPins,
        timers: freshTimers,
        pendingScoreProposal: proposalToShow,
        lastDynamicScoreWeekId: freshLastDynamicWeek
      };

      setStorageType(claimRes.storageType);
      setSyncStatus('synced');
      setLastSyncedAt(Date.now());
      setActiveParentSession(newSession);
      setChildrenData(freshChildren);
      setSavedParentPin(effectivePin);
      setChildPins(freshChildPins);
      setTimers(freshTimers);
      setPendingScoreProposal(proposalToShow);
      setLastDynamicScoreWeekId(freshLastDynamicWeek);
      try {
        localStorage.setItem(STORAGE_KEY_PIN, effectivePin);
        localStorage.setItem(STORAGE_KEY_CHILD_PINS, JSON.stringify(freshChildPins));
      } catch (err) {
        console.error(err);
      }

      setIsParentMode(true);
      setAuthRole('parent');
      setSelectedWeekId(currentWeekId);
      showToast(
        hadOtherSession
          ? '부모님 모드로 로그인되었습니다. (기존 로그인 기기는 자동 로그아웃)'
          : '부모님 관리 모드로 로그인되었습니다.',
        'success'
      );
      return { ok: true };
    } catch (err) {
      console.error('Parent login failed', err);
      return { ok: false, error: '로그인 처리 중 오류가 발생했습니다.' };
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const result = await handleAuthLogin('parent', pinInput);
    if (!result.ok) {
      setPinError(result.error || '비밀번호가 일치하지 않습니다.');
      return;
    }

    setPinModalOpen(false);
    setPinInput('');
    setPinError('');

    if (pendingTimerDeductRef.current) {
      const pending = pendingTimerDeductRef.current;
      pendingTimerDeductRef.current = null;
      performTimerDeductRef.current?.(pending.childKey, pending.mode, true);
    }
  };

  const handleLogout = () => {
    cleanupMediaAndAudio(true);
    const prevSessionId = myParentSessionIdRef.current;
    const wasParent = isParentModeRef.current;
    myParentSessionIdRef.current = null;
    mySessionLoggedInAtRef.current = 0;
    activeAuthPinRef.current = '';
    isParentModeRef.current = false;
    pendingPushRef.current = false;
    pendingTimerDeductRef.current = null;
    setIsParentMode(false);
    setAuthRole(null);
    setActiveParentSession(null);
    setLoginNotice(null);
    showToast('로그아웃되었습니다.', 'info');

    if (wasParent && storageTypeRef.current !== 'none' && prevSessionId) {
      const snap = latestSyncSnapshotRef.current;
      void pushStateToCloud(
        snap.childrenData,
        snap.savedParentPin,
        snap.childPins,
        snap.timers,
        snap.pendingScoreProposal,
        snap.lastDynamicScoreWeekId,
        {
          releaseSession: true,
          clientSessionIdOverride: prevSessionId,
          sessionOverride: null
        }
      );
    }
  };

  const handleSaveChildPin = (childKey: ChildKey, newPin: string): boolean => {
    if (!requireParentMode('자녀 비밀번호 변경')) return false;
    const cleanPin = newPin.trim();
    if (cleanPin.length < 4) {
      showToast('자녀 비밀번호는 4자리 이상 입력해주세요.', 'warning');
      return false;
    }
    setChildPins((prev) => ({
      ...prev,
      [childKey]: cleanPin
    }));
    showToast(`${CHILDREN_CONFIG[childKey].name} 비밀번호가 변경되었습니다.`, 'success');
    return true;
  };

  const handleApproveScoreProposal = () => {
    if (!requireParentMode('자동 배점 적용')) return;
    if (!pendingScoreProposal) return;

    const proposal = pendingScoreProposal;
    setChildrenData((prev) => {
      const applyForChild = (childKey: ChildKey): ChildData => {
        const childObj = prev[childKey];
        const frozenWeeks = freezeEarnedScoresForChild(childKey, childObj);
        const cfg = CHILDREN_CONFIG[childKey];
        const nextItemScores: Record<string, number> = { ...(childObj.itemScores || {}) };
        const proposedStudy = proposal.children[childKey]?.proposedScores || {};

        cfg.studyItems.forEach((item) => {
          if (typeof proposedStudy[item.id] === 'number') {
            nextItemScores[item.id] = sanitizeItemScore(
              proposedStudy[item.id],
              childObj.itemScores?.[item.id] ?? item.score
            );
          }
        });
        cfg.habitItems.forEach((item) => {
          nextItemScores[item.id] = childObj.itemScores?.[item.id] ?? item.score;
        });

        return {
          ...childObj,
          weeks: frozenWeeks,
          itemScores: nextItemScores
        };
      };

      return {
        suhyun: applyForChild('suhyun'),
        dahyun: applyForChild('dahyun')
      };
    });

    setLastDynamicScoreWeekId(proposal.weekId);
    setPendingScoreProposal(null);
    showToast(
      '새 주간 개별 학습과목 배점이 반영되었습니다. (기존 획득 점수 및 생활습관 배점 유지)',
      'success'
    );
  };

  const handleRejectScoreProposal = () => {
    if (!requireParentMode('자동 배점 보류')) return;
    if (!pendingScoreProposal) return;

    setLastDynamicScoreWeekId(pendingScoreProposal.weekId);
    setPendingScoreProposal(null);
    showToast('배점 자동 변경을 적용하지 않고 기존 배점을 유지합니다.', 'info');
  };

  const handlePreviewDynamicScoring = () => {
    if (!requireParentMode('자동 배점 계산 미리보기')) return;
    const targetWeekId = getWeekIdForTimestamp();
    const proposal = generateWeeklyDynamicScoreProposal(childrenData, targetWeekId, {
      requirePastData: false
    });
    if (!proposal) {
      showToast('배점 제안을 생성할 수 없습니다.', 'warning');
      return;
    }
    setPendingScoreProposal(proposal);
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

  // Board Cell Toggle (writes into selectedWeekId)
  const handleCellToggle = (item: EvaluationItem, dayKey: DayKey, dayLabel: string) => {
    if (item.scoringType === 'READING_AUDIO') {
      showToast('독서 항목은 우측 점수 선택(0/5/10점) 메뉴에서 채점해주세요.', 'info');
      return;
    }
    if (!requireParentMode('점수 채점 및 변경')) return;

    const currentStatus: CheckStatus = currentWeekRecord.checks?.[item.id]?.[dayKey] || 'NONE';
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
      const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
      const updatedChecks = {
        ...(baseWeek.checks || {}),
        [item.id]: {
          ...(baseWeek.checks?.[item.id] || {
            MON: 'NONE',
            TUE: 'NONE',
            WED: 'NONE',
            THU: 'NONE',
            FRI: 'NONE'
          }),
          [dayKey]: nextStatus
        }
      };

      const existingEarned = baseWeek.earnedScores?.[item.id]?.[dayKey];
      const existingRow = { ...(baseWeek.earnedScores?.[item.id] || {}) };
      const updatedEarnedScores = { ...(baseWeek.earnedScores || {}) };
      let awardedScore = item.score;

      if (nextStatus === 'NONE') {
        awardedScore = existingEarned ?? item.score;
        delete existingRow[dayKey];
        if (Object.keys(existingRow).length > 0) {
          updatedEarnedScores[item.id] = existingRow;
        } else {
          delete updatedEarnedScores[item.id];
        }
      } else {
        awardedScore = currentStatus === 'NONE' ? item.score : (existingEarned ?? item.score);
        existingRow[dayKey] = awardedScore;
        updatedEarnedScores[item.id] = existingRow;
      }

      const updatedClothesSub = { ...(baseWeek.clothesSubChecks || {}) };
      if (item.id === 'hb_clothes_all') {
        const allDone = nextStatus !== 'NONE';
        updatedClothesSub[dayKey] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = allDone;
          return acc;
        }, {} as Record<string, boolean>);
      }

      let updatedLogs: YoutubeLog[] = [...(baseWeek.youtubeLogs || [])];
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
            minutes: awardedScore,
            memo: `[주말 보충] ${dayLabel}요일 '${displayItemName}' 완료 (+${awardedScore}분)`,
            timestamp: `주말 보충 ${nowStr}`,
            relatedItem: { itemId: item.id, dayKey }
          },
          ...updatedLogs
        ];
        showToast(
          `주말 보충 완료: '${displayItemName}' +${awardedScore}점 (유튜브 +${awardedScore}분)`,
          'success'
        );
      } else if (currentStatus === 'WEEKEND' && nextStatus !== 'WEEKEND') {
        const cancelledScore = existingEarned ?? item.score;
        updatedLogs = [
          {
            id: `makeup-cancel-${Date.now()}`,
            type: 'MAKEUP_CANCEL',
            minutes: -cancelledScore,
            memo: `[보충 해제] ${dayLabel}요일 '${displayItemName}' 변경 (-${cancelledScore}분)`,
            timestamp: `변경 ${nowStr}`
          },
          ...updatedLogs
        ];
      }

      const nextWeek = {
        ...baseWeek,
        checks: updatedChecks,
        earnedScores: updatedEarnedScores,
        clothesSubChecks: updatedClothesSub,
        youtubeLogs: updatedLogs
      };

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          weeks: {
            ...(childObj.weeks || {}),
            [selectedWeekId]: nextWeek
          }
        }
      };
    });
  };

  // Reading Score Dropdown (Parent only: '' | '0' | '5' | '10')
  const handleReadingScoreChange = (
    dayKey: DayKey,
    dayLabel: string,
    scoreValue: '' | '0' | '5' | '10'
  ) => {
    if (!requireParentMode('독서 점수 채점')) return;
    const score = scoreValue === '' ? null : Number(scoreValue);

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
      const nextReadingRow = { ...(baseWeek.earnedScores?.hb_reading || {}) };
      const updatedEarnedScores = { ...(baseWeek.earnedScores || {}) };

      if (score === null) {
        delete nextReadingRow[dayKey];
        if (Object.keys(nextReadingRow).length > 0) {
          updatedEarnedScores.hb_reading = nextReadingRow;
        } else {
          delete updatedEarnedScores.hb_reading;
        }
      } else {
        nextReadingRow[dayKey] = score;
        updatedEarnedScores.hb_reading = nextReadingRow;
      }

      const nextWeek = {
        ...baseWeek,
        checks: {
          ...(baseWeek.checks || {}),
          hb_reading: {
            ...(baseWeek.checks?.hb_reading || {
              MON: 'NONE',
              TUE: 'NONE',
              WED: 'NONE',
              THU: 'NONE',
              FRI: 'NONE'
            }),
            [dayKey]: score === null ? ('NONE' as CheckStatus) : ('WEEKDAY' as CheckStatus)
          }
        },
        earnedScores: updatedEarnedScores
      };

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          weeks: {
            ...(childObj.weeks || {}),
            [selectedWeekId]: nextWeek
          }
        }
      };
    });

    showToast(
      score === null
        ? `${dayLabel}요일 독서 채점이 초기화되었습니다.`
        : `${dayLabel}요일 독서 점수가 ${score}점으로 채점되었습니다.`,
      score === null ? 'info' : 'success'
    );
  };

  // Voice recording toggle for reading journal
  const handleToggleReadingRecord = async (dayKey: DayKey, dayLabel: string) => {
    if (isUploadingAudio) return;

    const currentTarget = recordingTargetRef.current;
    if (currentTarget) {
      if (
        currentTarget.childKey === activeChild &&
        currentTarget.weekId === selectedWeekId &&
        currentTarget.dayKey === dayKey
      ) {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        cancelRecordingOnStopRef.current = false;
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (err) {
          console.error('Failed to stop recorder', err);
          cleanupMediaAndAudio(true);
        }
        return;
      }
      showToast('진행 중인 다른 요일의 녹음을 먼저 종료해주세요.', 'warning');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast('현재 브라우저에서는 마이크 녹음 기능을 사용할 수 없습니다.', 'warning');
      return;
    }

    // Stop active playback before recording
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
      } catch {
        // ignore
      }
      audioPlayerRef.current = null;
      setPlayingAudioId(null);
    }

    const targetChild = activeChild;
    const targetWeekId = selectedWeekId;
    const targetDayKey = dayKey;
    const authRoleSnapshot = authRole || 'parent';
    const pinSnapshot = isParentModeRef.current
      ? savedParentPin
      : activeAuthPinRef.current || childPins[targetChild];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordingOnStopRef.current = false;
      recordingStartMsRef.current = Date.now();
      setRecordingTarget({ childKey: targetChild, weekId: targetWeekId, dayKey: targetDayKey });
      setRecordingElapsedSec(0);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        if (mediaRecorderRef.current === recorder) {
          mediaRecorderRef.current = null;
        }
        setRecordingTarget(null);
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordingStartMsRef.current) / 1000)
        );
        setRecordingElapsedSec(0);

        if (cancelRecordingOnStopRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (chunks.length === 0) {
          showToast('녹음된 음성이 없습니다. 다시 시도해주세요.', 'warning');
          return;
        }

        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: actualMime });

        setIsUploadingAudio(true);
        try {
          const dataBase64 = await blobToBase64(blob);
          const audioId = `rec_${targetChild}_${targetWeekId}_${targetDayKey}_${Date.now()}`;
          const res = await uploadReadingAudio({
            childKey: targetChild,
            weekId: targetWeekId,
            dayKey: targetDayKey,
            audioId,
            mimeType: actualMime,
            dataBase64,
            durationSec,
            authRole: authRoleSnapshot,
            pin: pinSnapshot,
            clientSessionId: myParentSessionIdRef.current
          });

          if (res.sessionReplaced) {
            forceLogoutDueToOtherDevice();
            return;
          }
          if (res.sessionExpired) {
            performInactivityLogoutRef.current?.(null, { skipServerRelease: true });
            return;
          }

          if (!res.ok || !res.recording) {
            showToast(res.error || '독후감 녹음 저장에 실패했습니다.', 'warning');
            return;
          }

          const savedMeta = res.recording;
          if (res.updatedAt) {
            lastUpdatedAtRef.current = Math.max(lastUpdatedAtRef.current, res.updatedAt);
          }

          setChildrenData((prev) => {
            const childObj = prev[targetChild];
            const baseWeek = getWeeklyRecord(targetChild, childObj, targetWeekId);
            const nextWeek = {
              ...baseWeek,
              readingRecordings: {
                ...(baseWeek.readingRecordings || {}),
                [targetDayKey]: savedMeta
              }
            };
            return {
              ...prev,
              [targetChild]: {
                ...childObj,
                weeks: {
                  ...(childObj.weeks || {}),
                  [targetWeekId]: nextWeek
                }
              }
            };
          });

          showToast(`${dayLabel}요일 독후감 녹음이 저장되었습니다. (${durationSec}초)`, 'success');
        } catch (err) {
          console.error('Failed to process recording upload', err);
          showToast('녹음 파일 처리 중 오류가 발생했습니다.', 'warning');
        } finally {
          setIsUploadingAudio(false);
        }
      };

      recorder.start(500);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartMsRef.current) / 1000);
        setRecordingElapsedSec(elapsed);
        if (elapsed >= 180 && mediaRecorderRef.current?.state === 'recording') {
          showToast('최대 녹음 시간(3분)에 도달해 자동으로 저장합니다.', 'info');
          mediaRecorderRef.current.stop();
        }
      }, 500);

      showToast(`${dayLabel}요일 독후감 녹음을 시작합니다. 완료되면 버튼을 한 번 더 누르세요.`, 'info');
    } catch (err) {
      console.error('Microphone access error', err);
      cleanupMediaAndAudio(true);
      showToast('마이크 접근 권한을 허용해주세요.', 'warning');
    }
  };

  const handleToggleReadingPlay = async (dayKey: DayKey) => {
    const audioId = currentWeekRecord.readingRecordings?.[dayKey]?.audioId;
    if (!audioId) {
      showToast('저장된 독후감 녹음 파일이 없습니다.', 'warning');
      return;
    }
    if (playingAudioId === audioId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }

    const stored = await fetchReadingAudio(audioId);
    if (!stored || !stored.dataBase64) {
      showToast('녹음 파일을 불러올 수 없습니다.', 'warning');
      return;
    }

    try {
      const url = base64ToBlobUrl(stored.dataBase64, stored.mimeType || 'audio/webm');
      audioObjectUrlRef.current = url;
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      setPlayingAudioId(audioId);

      audio.onended = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setPlayingAudioId(null);
        }
      };
      audio.onerror = () => {
        if (audioPlayerRef.current === audio) {
          audioPlayerRef.current = null;
          setPlayingAudioId(null);
        }
        showToast('녹음 음성을 재생할 수 없습니다.', 'warning');
      };

      await audio.play();
    } catch (err) {
      console.error('Audio play failed', err);
      setPlayingAudioId(null);
      showToast('음성 재생에 실패했습니다.', 'warning');
    }
  };

  const handleToggleClothesSubItem = (dayKey: DayKey, dayLabel: string, subName: string) => {
    if (!requireParentMode('옷 정리 세부 항목 체크')) return;

    const currentDaySubs = currentWeekRecord.clothesSubChecks?.[dayKey] || {};
    const nextVal = !currentDaySubs[subName];
    const updatedDaySubs = {
      ...CLOTHES_SUB_ITEMS.reduce((acc, s) => {
        acc[s] = Boolean(currentDaySubs[s]);
        return acc;
      }, {} as Record<string, boolean>),
      [subName]: nextVal
    };

    const isAll8Completed = CLOTHES_SUB_ITEMS.every((s) => Boolean(updatedDaySubs[s]));
    const clothesItem =
      currentConfig.habitItems.find((i) => i.id === 'hb_clothes_all') ||
      currentConfig.habitItems[0];
    const prevMainStatus = currentWeekRecord.checks?.hb_clothes_all?.[dayKey] || 'NONE';

    let nextMainStatus: CheckStatus = 'NONE';
    if (isAll8Completed) {
      nextMainStatus = prevMainStatus === 'WEEKEND' ? 'WEEKEND' : 'WEEKDAY';
    }

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
      const existingEarned = baseWeek.earnedScores?.hb_clothes_all?.[dayKey];
      const nextClothesEarnedRow = { ...(baseWeek.earnedScores?.hb_clothes_all || {}) };
      const updatedEarnedScores = { ...(baseWeek.earnedScores || {}) };

      if (isAll8Completed) {
        nextClothesEarnedRow[dayKey] =
          prevMainStatus === 'NONE' ? clothesItem.score : (existingEarned ?? clothesItem.score);
        updatedEarnedScores.hb_clothes_all = nextClothesEarnedRow;
      } else {
        delete nextClothesEarnedRow[dayKey];
        if (Object.keys(nextClothesEarnedRow).length > 0) {
          updatedEarnedScores.hb_clothes_all = nextClothesEarnedRow;
        } else {
          delete updatedEarnedScores.hb_clothes_all;
        }
      }

      const nextWeek = {
        ...baseWeek,
        clothesSubChecks: {
          ...(baseWeek.clothesSubChecks || {}),
          [dayKey]: updatedDaySubs
        },
        earnedScores: updatedEarnedScores,
        checks: {
          ...(baseWeek.checks || {}),
          hb_clothes_all: {
            ...(baseWeek.checks?.hb_clothes_all || {
              MON: 'NONE',
              TUE: 'NONE',
              WED: 'NONE',
              THU: 'NONE',
              FRI: 'NONE'
            }),
            [dayKey]: nextMainStatus
          }
        }
      };

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          weeks: {
            ...(childObj.weeks || {}),
            [selectedWeekId]: nextWeek
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
      const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
      const updatedChecks = { ...(baseWeek.checks || {}) };
      const updatedEarnedScores = { ...(baseWeek.earnedScores || {}) };

      allItems.forEach((item) => {
        if (item.scoringType === 'READING_AUDIO') return;
        const prevStatus: CheckStatus = baseWeek.checks?.[item.id]?.[dayKey] || 'NONE';
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

        const existingEarned = baseWeek.earnedScores?.[item.id]?.[dayKey];
        const nextRow = { ...(updatedEarnedScores[item.id] || {}) };
        nextRow[dayKey] = prevStatus === 'NONE' ? item.score : (existingEarned ?? item.score);
        updatedEarnedScores[item.id] = nextRow;
      });

      const updatedClothesSub = {
        ...(baseWeek.clothesSubChecks || {}),
        [dayKey]: CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = true;
          return acc;
        }, {} as Record<string, boolean>)
      };

      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          weeks: {
            ...(childObj.weeks || {}),
            [selectedWeekId]: {
              ...baseWeek,
              checks: updatedChecks,
              earnedScores: updatedEarnedScores,
              clothesSubChecks: updatedClothesSub
            }
          }
        }
      };
    });

    showToast(
      `${dayLabel}요일 항목(독서 제외)이 '${targetStatus === 'WEEKDAY' ? '평일 완료' : '주말 보충'}' 처리되었습니다.`,
      'success'
    );
  };

  // YouTube Deduction (Parent Only, writes to selectedWeekId)
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

    const targetWeek = selectedWeekId;
    const latestChildData = latestSyncSnapshotRef.current.childrenData[targetChildKey];
    const targetSummary = computeChildScoreSummary(targetChildKey, latestChildData, targetWeek);
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
      const baseWeek = getWeeklyRecord(targetChildKey, childObj, targetWeek);
      const nextUsed = (baseWeek.usedYoutubeMinutes || 0) + actualDeduct;
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
          weeks: {
            ...(childObj.weeks || {}),
            [targetWeek]: {
              ...baseWeek,
              usedYoutubeMinutes: nextUsed,
              youtubeLogs: [newLog, ...(baseWeek.youtubeLogs || [])]
            }
          }
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

    const targetLog = (currentWeekRecord.youtubeLogs || []).find((l) => l.id === logId);
    if (!targetLog) return;

    if (targetLog.type === 'WATCH') {
      const restoreMinutes = Math.abs(targetLog.minutes);
      setChildrenData((prev) => {
        const childObj = prev[activeChild];
        const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
        return {
          ...prev,
          [activeChild]: {
            ...childObj,
            weeks: {
              ...(childObj.weeks || {}),
              [selectedWeekId]: {
                ...baseWeek,
                usedYoutubeMinutes: Math.max(0, (baseWeek.usedYoutubeMinutes || 0) - restoreMinutes),
                youtubeLogs: (baseWeek.youtubeLogs || []).filter((l) => l.id !== logId)
              }
            }
          }
        };
      });
      showToast(`${restoreMinutes}분 차감 내역이 취소되어 복구되었습니다.`, 'info');
    } else if (targetLog.type === 'MAKEUP_ADD' && targetLog.relatedItem) {
      const { itemId, dayKey } = targetLog.relatedItem;
      setChildrenData((prev) => {
        const childObj = prev[activeChild];
        const baseWeek = getWeeklyRecord(activeChild, childObj, selectedWeekId);
        const updatedEarnedScores = { ...(baseWeek.earnedScores || {}) };
        if (updatedEarnedScores[itemId]) {
          const nextRow = { ...updatedEarnedScores[itemId] };
          delete nextRow[dayKey];
          if (Object.keys(nextRow).length > 0) {
            updatedEarnedScores[itemId] = nextRow;
          } else {
            delete updatedEarnedScores[itemId];
          }
        }

        return {
          ...prev,
          [activeChild]: {
            ...childObj,
            weeks: {
              ...(childObj.weeks || {}),
              [selectedWeekId]: {
                ...baseWeek,
                checks: {
                  ...(baseWeek.checks || {}),
                  [itemId]: {
                    ...(baseWeek.checks?.[itemId] || {
                      MON: 'NONE',
                      TUE: 'NONE',
                      WED: 'NONE',
                      THU: 'NONE',
                      FRI: 'NONE'
                    }),
                    [dayKey]: 'NONE'
                  }
                },
                earnedScores: updatedEarnedScores,
                youtubeLogs: (baseWeek.youtubeLogs || []).filter((l) => l.id !== logId)
              }
            }
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
    if (!requireParentMode('선택 주간 초기화')) return;

    setConfirmDialog({
      title: '선택한 주간 기록 초기화',
      message: `${currentConfig.name}이의 [${formatWeekRangeLabel(selectedWeekId)}] 주간 채점 기록과 유튜브 시청 기록을 0으로 초기화하시겠습니까? (다른 주차 누적 데이터와 칭찬스티커는 그대로 유지됩니다.)`,
      confirmText: '이 주 초기화',
      onConfirm: () => {
        setChildrenData((prev) => {
          const childObj = prev[activeChild];
          return {
            ...prev,
            [activeChild]: {
              ...childObj,
              weeks: {
                ...(childObj.weeks || {}),
                [selectedWeekId]: createEmptyWeeklyRecord(activeChild, selectedWeekId)
              }
            }
          };
        });
        setConfirmDialog(null);
        showToast(
          `${currentConfig.name}이의 [${formatWeekRangeLabel(selectedWeekId)}] 기록이 초기화되었습니다.`,
          'success'
        );
      }
    });
  };

  const handleSaveItemScores = (nextScoresByChild: Record<ChildKey, Record<string, number>>) => {
    if (!requireParentMode('배점표 수정')) return;

    setChildrenData((prev) => {
      const updateChild = (childKey: ChildKey): ChildData => {
        const childObj = prev[childKey];
        const frozenWeeks = freezeEarnedScoresForChild(childKey, childObj);
        const cfg = CHILDREN_CONFIG[childKey];
        const nextItemScores: Record<string, number> = {};

        [...cfg.studyItems, ...cfg.habitItems].forEach((item) => {
          nextItemScores[item.id] = sanitizeItemScore(
            nextScoresByChild[childKey]?.[item.id],
            childObj.itemScores?.[item.id] ?? item.score
          );
        });

        return {
          ...childObj,
          weeks: frozenWeeks,
          itemScores: nextItemScores
        };
      };

      return {
        suhyun: updateChild('suhyun'),
        dahyun: updateChild('dahyun')
      };
    });

    showToast('배점표가 저장되었습니다. 기존 모든 주차의 획득 점수는 이전 배점 그대로 유지됩니다.', 'success');
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
        '수현이와 다현이의 모든 주차 채점 기록, 독서 녹음 기록, 옷 정리 점검, 유튜브 시청 시간 및 타이머를 초기화하시겠습니까? (엄마·아빠 칭찬스티커 누적 개수와 발급 내역은 유지됩니다.)',
      confirmText: '데이터 초기화 실행',
      onConfirm: () => {
        const currentWeekId = getWeekIdForTimestamp();
        setChildrenData((prev) => ({
          suhyun: {
            ...prev.suhyun,
            weeks: {
              [currentWeekId]: createEmptyWeeklyRecord('suhyun', currentWeekId)
            }
          },
          dahyun: {
            ...prev.dahyun,
            weeks: {
              [currentWeekId]: createEmptyWeeklyRecord('dahyun', currentWeekId)
            }
          }
        }));

        setTimers({
          suhyun: createDefaultChildTimer(DEFAULT_TIMER_MINUTES),
          dahyun: createDefaultChildTimer(DEFAULT_TIMER_MINUTES)
        });
        setSelectedWeekId(currentWeekId);
        setPendingScoreProposal(null);
        setLastDynamicScoreWeekId(null);

        setConfirmDialog(null);
        showToast('칭찬스티커를 제외한 주간 누적 학습·습관 및 유튜브 데이터가 초기화되었습니다.', 'success');
      }
    });
  };

  const isSuhyun = activeChild === 'suhyun';
  const visibleTabs = useMemo(
    () => (authRole === 'parent' ? TAB_ITEMS : TAB_ITEMS.filter((t) => t.key !== 'settings')),
    [authRole]
  );
  const currentTabMeta = visibleTabs.find((t) => t.key === activeTab) || visibleTabs[0];
  const youtubeRemainingRatio =
    scoreSummary.totalEarnedMinutes > 0
      ? Math.min(100, (scoreSummary.remainingMinutes / scoreSummary.totalEarnedMinutes) * 100)
      : 0;

  const availableWeekIds = useMemo(() => {
    const keys = new Set<string>([
      realCurrentWeekId,
      selectedWeekId,
      ...Object.keys(childrenData.suhyun.weeks || {}),
      ...Object.keys(childrenData.dahyun.weeks || {})
    ]);
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [childrenData, realCurrentWeekId, selectedWeekId]);

  const handleSelectWeek = (nextWeekId: string) => {
    if (nextWeekId === selectedWeekId) return;
    if (recordingTargetRef.current) {
      showToast('진행 중인 녹음을 먼저 종료해주세요.', 'warning');
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingAudioId(null);
    }
    setSelectedWeekId(nextWeekId);
  };

  const handleSelectChild = (nextChild: ChildKey) => {
    if (authRole === 'suhyun' || authRole === 'dahyun') return;
    if (nextChild === activeChild) return;
    if (recordingTargetRef.current) {
      showToast('진행 중인 녹음을 먼저 종료해주세요.', 'warning');
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingAudioId(null);
    }
    setActiveChild(nextChild);
  };

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

  if (authRole === null) {
    return (
      <>
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
        <LoginScreen
          onLogin={async (role, pin) => {
            const res = await handleAuthLogin(role, pin);
            return res.ok ? null : (res.error || '비밀번호가 일치하지 않습니다.');
          }}
          isLoggingIn={isLoggingIn}
          isBootstrapping={isBootstrapping}
          syncStatus={syncStatus}
          storageType={storageType}
          activeParentSession={activeParentSession}
          noticeMessage={loginNotice}
        />
      </>
    );
  }

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
          {/* Child Switcher (Parent sees both; Child sees own profile only) */}
          <div className="space-y-2">
            <div className="px-1 text-[11px] font-semibold text-slate-400">
              {authRole === 'parent' ? '자녀 프로필' : '내 프로필'}
            </div>
            <div className="space-y-1.5">
              {(authRole === 'parent' ? (['suhyun', 'dahyun'] as ChildKey[]) : [authRole]).map(
                (ck) => {
                  const cfg = CHILDREN_CONFIG[ck];
                  const sum = summaries[ck];
                  const isActive = activeChild === ck;
                  const isBlue = ck === 'suhyun';
                  const running = timers[ck].isRunning;

                  return (
                    <button
                      key={ck}
                      type="button"
                      onClick={() => handleSelectChild(ck)}
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
                            <span className="text-[11px] font-medium text-slate-400">
                              {cfg.info}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                            {sum.totalScore} / {sum.effectiveWeeklyMaxScore}점
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
                }
              )}
            </div>
          </div>

          {/* Primary Workspace Nav */}
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold text-slate-400">메뉴</div>
            <nav className="space-y-1">
              {visibleTabs.map((item) => {
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
                {(authRole === 'parent' ? (['suhyun', 'dahyun'] as ChildKey[]) : [authRole]).map(
                  (ck) => {
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
                          {isParentMode && (
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
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
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
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>{currentConfig.name} 로그인</span>
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
                onClick={handleLogout}
                className="flex-1 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃 (계정 전환)</span>
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
              {authRole === 'parent' ? '수현·다현 매니저' : `${currentConfig.name} 매니저`}
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
              <span>
                {currentConfig.name} 계정 · 독후감 음성 녹음 및 기록 조회 가능
              </span>
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

            <button
              type="button"
              onClick={handleLogout}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isParentMode
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
          {/* Mobile & Tablet Child Switcher + Nav Tabs */}
          <div className="lg:hidden space-y-3">
            {authRole === 'parent' && (
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
                      onClick={() => handleSelectChild(ck)}
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
                        {sum.totalScore}/{sum.effectiveWeeklyMaxScore}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className={`grid gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 ${
                visibleTabs.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
              }`}
            >
              {visibleTabs.map((item) => {
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
                    상세 보기
                  </button>
                </div>
                <div
                  className={`grid gap-2 ${
                    authRole === 'parent' ? 'grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {(authRole === 'parent' ? (['suhyun', 'dahyun'] as ChildKey[]) : [authRole]).map(
                    (ck) => {
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
                          {isParentMode && (
                            <>
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
                            </>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Calendar Week Navigator Bar (Cumulative Weekly History) */}
          <section className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>주간 달력 기록</span>
              </div>
              {isViewingCurrentWeek ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  이번 주
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  과거/다른 주 조회 중
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectWeek(shiftWeekId(selectedWeekId, -1))}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>이전 주</span>
              </button>

              <select
                value={selectedWeekId}
                onChange={(e) => handleSelectWeek(e.target.value)}
                aria-label="조회할 주차 선택"
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableWeekIds.map((wid) => (
                  <option key={wid} value={wid}>
                    {formatWeekRangeLabel(wid)} {wid === realCurrentWeekId ? '(이번 주)' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleSelectWeek(shiftWeekId(selectedWeekId, 1))}
                disabled={selectedWeekId >= realCurrentWeekId}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                  selectedWeekId >= realCurrentWeekId
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>다음 주</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {!isViewingCurrentWeek && (
                <button
                  type="button"
                  onClick={() => handleSelectWeek(realCurrentWeekId)}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  이번 주로
                </button>
              )}
            </div>
          </section>

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
                <span className="text-xs font-semibold text-slate-500">
                  {isViewingCurrentWeek ? '이번 주 획득 점수' : '해당 주 획득 점수'}
                </span>
                <TrendingUp
                  className={`w-4 h-4 ${isSuhyun ? 'text-blue-600' : 'text-rose-600'}`}
                />
              </div>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {scoreSummary.totalScore}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  / {scoreSummary.effectiveWeeklyMaxScore}점
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
              key={`${activeChild}-${activeTab}-${selectedWeekId}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'board' && (
                <WeeklyBoardTab
                  currentConfig={currentConfig}
                  weekRecord={currentWeekRecord}
                  selectedWeekId={selectedWeekId}
                  scoreSummary={scoreSummary}
                  isParentMode={isParentMode}
                  authRole={authRole}
                  stampMode={stampMode}
                  setStampMode={setStampMode}
                  showIncompleteOnly={showIncompleteOnly}
                  setShowIncompleteOnly={setShowIncompleteOnly}
                  onCellToggle={handleCellToggle}
                  onReadingScoreChange={handleReadingScoreChange}
                  onToggleReadingRecord={handleToggleReadingRecord}
                  onToggleReadingPlay={handleToggleReadingPlay}
                  recordingDayKey={
                    recordingTarget &&
                    recordingTarget.childKey === activeChild &&
                    recordingTarget.weekId === selectedWeekId
                      ? recordingTarget.dayKey
                      : null
                  }
                  recordingElapsedSec={recordingElapsedSec}
                  isUploadingAudio={isUploadingAudio}
                  playingAudioId={playingAudioId}
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
                  currentData={{
                    ...currentData,
                    usedYoutubeMinutes: currentWeekRecord.usedYoutubeMinutes,
                    youtubeLogs: currentWeekRecord.youtubeLogs
                  }}
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

              {activeTab === 'settings' && authRole === 'parent' && (
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
                  childPins={childPins}
                  onSaveChildPin={handleSaveChildPin}
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
                  effectiveConfigs={effectiveConfigs}
                  onSaveItemScores={handleSaveItemScores}
                  onPreviewDynamicScoring={handlePreviewDynamicScoring}
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
        weekRecord={currentWeekRecord}
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

      {isParentMode && (
        <DynamicScoreProposalModal
          proposal={pendingScoreProposal}
          onApprove={handleApproveScoreProposal}
          onReject={handleRejectScoreProposal}
        />
      )}

      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
