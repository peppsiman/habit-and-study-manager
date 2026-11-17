import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Star,
  Youtube,
  Award,
  Lock,
  Unlock,
  RotateCcw,
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  Heart,
  ThumbsUp,
  Sparkles,
  Filter,
  Calendar,
  Clock,
  Gift,
  Undo2,
  Check,
  AlertCircle,
  BookOpen,
  Smile,
  TrendingUp,
  Edit3,
  KeyRound,
  Eye,
  ShieldCheck,
  Settings,
  X
} from 'lucide-react';

// ==========================================
// 1. 초기 상수 및 배점 데이터 정의 (최신 요구사항 완벽 반영)
// ==========================================
const STORAGE_KEY_DATA = 'suhyun_dahyun_app_v3';
const STORAGE_KEY_TIMERS = 'suhyun_dahyun_timers_v3';
const STORAGE_KEY_PIN = 'suhyun_dahyun_pin_v3';

const DAYS = [
  { key: 'MON', label: '월' },
  { key: 'TUE', label: '화' },
  { key: 'WED', label: '수' },
  { key: 'THU', label: '목' },
  { key: 'FRI', label: '금' }
];

const CLOTHES_SUB_ITEMS = [
  '잠바',
  '상의',
  '하의',
  '양말',
  '학원가방',
  '책가방',
  '태권도복',
  '태권도 띠'
];

const COMMON_HABIT_ITEMS = [
  {
    id: 'hb_clothes_all',
    name: '옷 정리(잠바, 상의, 하의, 양말, 학원가방, 책가방, 태권도복, 태권도 띠)',
    shortName: '옷 정리 (8종 올클리어)',
    subItems: CLOTHES_SUB_ITEMS,
    ruleNote: '모든 세부 항목을 다 완료해야만 성공(7점)으로 인정!',
    score: 7,
    category: 'HABIT'
  },
  { id: 'hb_bottle', name: '물통', score: 2, category: 'HABIT' },
  { id: 'hb_wash', name: '세수', score: 4, category: 'HABIT' }
];

const CHILDREN_CONFIG = {
  suhyun: {
    id: 'suhyun',
    name: '수현',
    info: '초3 남',
    themeColor: 'blue',
    avatarEmoji: '👦🏻',
    dailyMaxScore: 93, // 학습 80점 + 습관 13점
    weeklyMaxScore: 465, // 93점 * 5일
    studyItems: [
      { id: 'sh_plus', name: '플러스', score: 10, category: 'STUDY' },
      { id: 'sh_top', name: '최상위', score: 10, category: 'STUDY' },
      { id: 'sh_ggaebong', name: '깨봉', score: 10, category: 'STUDY' },
      { id: 'sh_korean', name: '국어', score: 10, category: 'STUDY' },
      { id: 'sh_eng_book', name: '영어(책)', score: 10, category: 'STUDY' },
      { id: 'sh_eng_sent', name: '영어(문장)', score: 10, category: 'STUDY' },
      { id: 'sh_reading', name: '독서', score: 20, category: 'STUDY' }
    ],
    habitItems: COMMON_HABIT_ITEMS
  },
  dahyun: {
    id: 'dahyun',
    name: '다현',
    info: '초3 여',
    themeColor: 'rose',
    avatarEmoji: '👧🏻',
    dailyMaxScore: 83, // 학습 70점 + 습관 13점
    weeklyMaxScore: 415, // 83점 * 5일
    studyItems: [
      { id: 'dh_vitamin', name: '비타민', score: 10, category: 'STUDY' },
      { id: 'dh_math', name: '수학 3-2', score: 12, category: 'STUDY' },
      { id: 'dh_ggaebong', name: '깨봉', score: 10, category: 'STUDY' },
      { id: 'dh_eng_book', name: '영어(책)', score: 10, category: 'STUDY' },
      { id: 'dh_eng_word', name: '영어(단어)', score: 8, category: 'STUDY' },
      { id: 'dh_reading', name: '독서', score: 20, category: 'STUDY' }
    ],
    habitItems: COMMON_HABIT_ITEMS
  }
};

// 초기 데모 데이터 생성 함수
const createInitialChildData = (childKey) => {
  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const checks = {};
  const clothesSubChecks = {};

  allItems.forEach((item, idx) => {
    checks[item.id] = {
      MON: 'WEEKDAY',
      TUE: idx % 4 === 0 ? 'WEEKEND' : 'WEEKDAY',
      WED: idx % 3 === 0 ? 'NONE' : 'WEEKDAY',
      THU: idx % 2 === 0 ? 'WEEKDAY' : 'NONE',
      FRI: 'NONE'
    };
  });

  DAYS.forEach(({ key }) => {
    const isCompleted = checks.hb_clothes_all?.[key] !== 'NONE';
    clothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = isCompleted;
      return acc;
    }, {});
  });

  const sampleStickers = [
    { id: 1, giver: 'MOM', reason: '잠바·가방·태권도복까지 옷 정리 스스로 완벽히 완료!', date: '11/02' },
    { id: 2, giver: 'DAD', reason: '주말에 밀린 수학 문제집 끝까지 다 풀기', date: '11/05' },
    { id: 3, giver: 'MOM', reason: '식사 후 식탁 정리 도와주기', date: '11/08' },
    { id: 4, giver: 'DAD', reason: '남매끼리 사이좋게 배려하고 양보하기', date: '11/11' },
    { id: 5, giver: 'MOM', reason: '학교 준비물 미리미리 완벽히 챙기기', date: '11/14' }
  ];

  return {
    weekTitle: '이번 주 (월~금 정규 & 주말 보충)',
    checks,
    clothesSubChecks,
    usedYoutubeMinutes: 30,
    youtubeLogs: [
      {
        id: 'init-log-1',
        type: 'WATCH',
        minutes: -30,
        memo: '토요일 오전 유튜브 시청',
        timestamp: '토요일 10:30'
      }
    ],
    stickers: sampleStickers,
    stickerRound: 1,
    rewardGoal: '상품은 검토 중...'
  };
};

// 안전한 데이터 정규화 및 병합 함수 (이전 버전 LocalStorage 충돌 완벽 방지)
const normalizeChildData = (childKey, rawData) => {
  const fallback = createInitialChildData(childKey);
  if (!rawData || typeof rawData !== 'object') return fallback;

  const config = CHILDREN_CONFIG[childKey];
  const allItems = [...config.studyItems, ...config.habitItems];
  const safeChecks = {};

  allItems.forEach((item) => {
    const savedRow = rawData.checks?.[item.id] || {};
    safeChecks[item.id] = {
      MON: ['NONE', 'WEEKDAY', 'WEEKEND'].includes(savedRow.MON) ? savedRow.MON : fallback.checks[item.id].MON,
      TUE: ['NONE', 'WEEKDAY', 'WEEKEND'].includes(savedRow.TUE) ? savedRow.TUE : fallback.checks[item.id].TUE,
      WED: ['NONE', 'WEEKDAY', 'WEEKEND'].includes(savedRow.WED) ? savedRow.WED : fallback.checks[item.id].WED,
      THU: ['NONE', 'WEEKDAY', 'WEEKEND'].includes(savedRow.THU) ? savedRow.THU : fallback.checks[item.id].THU,
      FRI: ['NONE', 'WEEKDAY', 'WEEKEND'].includes(savedRow.FRI) ? savedRow.FRI : fallback.checks[item.id].FRI
    };
  });

  const safeClothesSubChecks = {};
  DAYS.forEach(({ key }) => {
    const savedDaySub = rawData.clothesSubChecks?.[key] || {};
    const isCompleted = safeChecks.hb_clothes_all?.[key] !== 'NONE';
    safeClothesSubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
      acc[sub] = typeof savedDaySub[sub] === 'boolean' ? savedDaySub[sub] : isCompleted;
      return acc;
    }, {});
  });

  return {
    weekTitle: typeof rawData.weekTitle === 'string' ? rawData.weekTitle : fallback.weekTitle,
    checks: safeChecks,
    clothesSubChecks: safeClothesSubChecks,
    usedYoutubeMinutes:
      typeof rawData.usedYoutubeMinutes === 'number' && !isNaN(rawData.usedYoutubeMinutes)
        ? Math.max(0, rawData.usedYoutubeMinutes)
        : fallback.usedYoutubeMinutes,
    youtubeLogs: Array.isArray(rawData.youtubeLogs) ? rawData.youtubeLogs : fallback.youtubeLogs,
    stickers: Array.isArray(rawData.stickers) ? rawData.stickers : fallback.stickers,
    stickerRound:
      typeof rawData.stickerRound === 'number' && rawData.stickerRound >= 1
        ? rawData.stickerRound
        : 1,
    rewardGoal:
      typeof rawData.rewardGoal === 'string' &&
      rawData.rewardGoal.trim() &&
      !rawData.rewardGoal.includes('닌텐도') &&
      !rawData.rewardGoal.includes('산리오')
        ? rawData.rewardGoal
        : fallback.rewardGoal
  };
};

// 특정 자녀의 점수 및 유튜브 시간 계산 순수 함수
const computeChildScoreSummary = (childKey, childData) => {
  const config = CHILDREN_CONFIG[childKey];
  if (!config) {
    return {
      weekdayScore: 0,
      weekendMakeupScore: 0,
      totalScore: 0,
      incompletePotentialScore: 0,
      incompleteCount: 0,
      dailyScores: { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 },
      dailyMakeups: { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 },
      totalEarnedMinutes: 0,
      usedMinutes: 0,
      remainingMinutes: 0
    };
  }

  const allItems = [...config.studyItems, ...config.habitItems];

  let weekdayScore = 0;
  let weekendMakeupScore = 0;
  let incompletePotentialScore = 0;
  let incompleteCount = 0;

  const dailyScores = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
  const dailyMakeups = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };

  allItems.forEach((item) => {
    const itemChecks = childData?.checks?.[item.id] || {};
    DAYS.forEach(({ key }) => {
      const status = itemChecks[key] || 'NONE';
      if (status === 'WEEKDAY') {
        weekdayScore += item.score;
        dailyScores[key] += item.score;
      } else if (status === 'WEEKEND') {
        weekendMakeupScore += item.score;
        dailyScores[key] += item.score;
        dailyMakeups[key] += item.score;
      } else {
        incompletePotentialScore += item.score;
        incompleteCount += 1;
      }
    });
  });

  const totalScore = weekdayScore + weekendMakeupScore;
  const totalEarnedMinutes = totalScore; // 1점 = 1분
  const usedMinutes = childData?.usedYoutubeMinutes || 0;
  const remainingMinutes = Math.max(0, totalEarnedMinutes - usedMinutes);

  return {
    weekdayScore,
    weekendMakeupScore,
    totalScore,
    incompletePotentialScore,
    incompleteCount,
    dailyScores,
    dailyMakeups,
    totalEarnedMinutes,
    usedMinutes,
    remainingMinutes
  };
};

// 타이머 포맷 헬퍼 (MM:SS)
function formatTimer(sec) {
  const safeSec = Math.max(0, Number(sec) || 0);
  const m = String(Math.floor(safeSec / 60)).padStart(2, '0');
  const s = String(safeSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function App() {
  // ==========================================
  // 2. 상태(State) 선언 및 LocalStorage 초기화
  // ==========================================
  const [activeChild, setActiveChild] = useState('suhyun'); // 'suhyun' | 'dahyun'
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'youtube' | 'sticker' | 'settings'

  // 자녀용 화면(false, 기본 진입) vs 부모용 화면(true, 암호 로그인 필요)
  const [isParentMode, setIsParentMode] = useState(false);
  const [savedParentPin, setSavedParentPin] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PIN) || '1234';
    } catch (e) {
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

  // 채점 보드 필터 및 스탬프 모드
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [stampMode, setStampMode] = useState('CYCLE'); // 'CYCLE' | 'WEEKDAY' | 'WEEKEND'
  const [clothesHelperModal, setClothesHelperModal] = useState(null); // { dayKey, dayLabel } | null

  // 자녀별 메인 데이터 상태
  const [childrenData, setChildrenData] = useState(() => {
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

  // 수현 & 다현 동시 작동 가능한 실시간 유튜브 타이머 상태
  const [timers, setTimers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          suhyun: {
            isRunning: false,
            elapsedSeconds: Number(parsed?.suhyun?.elapsedSeconds) || 0
          },
          dahyun: {
            isRunning: false,
            elapsedSeconds: Number(parsed?.dahyun?.elapsedSeconds) || 0
          }
        };
      }
    } catch (e) {
      console.error('Failed to load timers', e);
    }
    return {
      suhyun: { isRunning: false, elapsedSeconds: 0 },
      dahyun: { isRunning: false, elapsedSeconds: 0 }
    };
  });

  // 유튜브 직접 차감 및 칭찬스티커 입력 상태
  const [customDeductInput, setCustomDeductInput] = useState('');
  const [watchMemoInput, setWatchMemoInput] = useState('');
  const [stickerGiver, setStickerGiver] = useState('MOM'); // 'MOM' | 'DAD'
  const [stickerReason, setStickerReason] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // 토스트 및 확인 모달 상태
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // LocalStorage 자동 저장 (데이터)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(childrenData));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [childrenData]);

  // LocalStorage 자동 저장 (타이머)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TIMERS, JSON.stringify(timers));
    } catch (e) {
      console.error('Failed to save timers', e);
    }
  }, [timers]);

  // 수현이와 다현이 동시 실시간 타이머 작동 Effect
  useEffect(() => {
    const anyRunning = timers.suhyun.isRunning || timers.dahyun.isRunning;
    if (!anyRunning) return;

    const interval = setInterval(() => {
      setTimers((prev) => ({
        suhyun: {
          ...prev.suhyun,
          elapsedSeconds: prev.suhyun.isRunning
            ? prev.suhyun.elapsedSeconds + 1
            : prev.suhyun.elapsedSeconds
        },
        dahyun: {
          ...prev.dahyun,
          elapsedSeconds: prev.dahyun.isRunning
            ? prev.dahyun.elapsedSeconds + 1
            : prev.dahyun.elapsedSeconds
        }
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timers.suhyun.isRunning, timers.dahyun.isRunning]);

  // 토스트 메시지 표시 헬퍼
  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.msg === msg ? null : prev));
    }, 3200);
  };

  // 두 자녀 각각의 실시간 점수 및 유튜브 시간 계산
  const summaries = useMemo(() => {
    return {
      suhyun: computeChildScoreSummary('suhyun', childrenData?.suhyun),
      dahyun: computeChildScoreSummary('dahyun', childrenData?.dahyun)
    };
  }, [childrenData]);

  // 현재 선택된 자녀 설정 및 데이터
  const currentConfig = CHILDREN_CONFIG[activeChild] || CHILDREN_CONFIG.suhyun;
  const currentData = childrenData?.[activeChild] || createInitialChildData(activeChild);
  const scoreSummary = summaries[activeChild] || summaries.suhyun;
  const allItems = useMemo(
    () => [...(currentConfig.studyItems || []), ...(currentConfig.habitItems || [])],
    [currentConfig]
  );

  // ==========================================
  // 3. 권한 및 이벤트 핸들러
  // ==========================================

  // 부모 모드 권한 확인 헬퍼
  const requireParentMode = (actionName = '이 기능') => {
    if (!isParentMode) {
      showToast(`🔒 부모님 로그인 후 [${actionName}]을(를) 사용할 수 있어요!`, 'warning');
      setChangePinMode(false);
      setPinModalOpen(true);
      return false;
    }
    return true;
  };

  // 부모님 암호 로그인 처리
  const handleParentLogin = (e) => {
    if (e) e.preventDefault();
    if (pinInput === savedParentPin) {
      setIsParentMode(true);
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
      showToast('🔓 부모님(관리자) 모드로 로그인되었습니다. 모든 기능을 사용할 수 있습니다!', 'success');
    } else {
      setPinError('암호가 일치하지 않습니다. 다시 확인해주세요.');
    }
  };

  // 비밀번호 변경 모달 열기 헬퍼
  const openPasswordChangeModal = () => {
    if (!requireParentMode('비밀번호 변경')) return;
    setChangePinMode(true);
    setCurrentPinForChange('');
    setNewPinInput('');
    setConfirmNewPinInput('');
    setPinError('');
    setPinModalOpen(true);
  };

  // 관리자 암호 변경
  const handleSaveNewPin = (e) => {
    if (e) e.preventDefault();
    if (currentPinForChange !== savedParentPin) {
      setPinError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!newPinInput || newPinInput.trim().length < 4) {
      setPinError('새 비밀번호는 4자리 이상 입력해주세요.');
      return;
    }
    if (newPinInput.trim() !== confirmNewPinInput.trim()) {
      setPinError('새 비밀번호와 비밀번호 확인 입력값이 일치하지 않습니다.');
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
    showToast('🔐 부모님 관리자 비밀번호가 성공적으로 변경되었습니다!', 'success');
  };

  // 셀 클릭 시 상태 변경 ('NONE' -> 'WEEKDAY' -> 'WEEKEND' -> 'NONE')
  const handleCellToggle = (item, dayKey, dayLabel) => {
    if (!requireParentMode('점수 채점 및 변경')) return;

    const currentStatus = currentData.checks?.[item.id]?.[dayKey] || 'NONE';
    let nextStatus = 'NONE';

    if (stampMode === 'WEEKDAY') {
      nextStatus = currentStatus === 'WEEKDAY' ? 'NONE' : 'WEEKDAY';
    } else if (stampMode === 'WEEKEND') {
      nextStatus = currentStatus === 'WEEKEND' ? 'NONE' : 'WEEKEND';
    } else {
      if (currentStatus === 'NONE') nextStatus = 'WEEKDAY';
      else if (currentStatus === 'WEEKDAY') nextStatus = 'WEEKEND';
      else nextStatus = 'NONE';
    }

    applyCellStatusChange(item, dayKey, dayLabel, nextStatus);
  };

  // 특정 항목/요일 상태를 지정된 상태로 업데이트하는 공통 함수
  const applyCellStatusChange = (item, dayKey, dayLabel, nextStatus) => {
    const currentStatus = currentData.checks?.[item.id]?.[dayKey] || 'NONE';

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const updatedChecks = {
        ...(childObj.checks || {}),
        [item.id]: {
          ...(childObj.checks?.[item.id] || {}),
          [dayKey]: nextStatus
        }
      };

      // 옷 정리 항목인 경우 세부 8종 체크 상태도 동기화
      let updatedClothesSub = { ...(childObj.clothesSubChecks || {}) };
      if (item.id === 'hb_clothes_all') {
        const allDone = nextStatus !== 'NONE';
        updatedClothesSub[dayKey] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = allDone;
          return acc;
        }, {});
      }

      let updatedLogs = [...(childObj.youtubeLogs || [])];
      const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
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
          `🌟 주말 보충 완료! '${displayItemName}' +${item.score}점 (유튜브 +${item.score}분 추가)`,
          'success'
        );
      } else if (currentStatus === 'WEEKEND' && nextStatus !== 'WEEKEND') {
        updatedLogs = [
          {
            id: `makeup-cancel-${Date.now()}`,
            type: 'MAKEUP_CANCEL',
            minutes: -item.score,
            memo: `[보충 해제] ${dayLabel}요일 '${displayItemName}' 상태 변경 (-${item.score}분)`,
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

  // 옷 정리 세부 항목(8종) 개별 토글 핸들러 (8개 모두 완료 시에만 7점 부여!)
  const handleToggleClothesSubItem = (dayKey, dayLabel, subName) => {
    if (!requireParentMode('옷 정리 세부 항목 체크')) return;

    const currentDaySubs = currentData.clothesSubChecks?.[dayKey] || {};
    const nextVal = !currentDaySubs[subName];
    const updatedDaySubs = {
      ...CLOTHES_SUB_ITEMS.reduce((acc, s) => {
        acc[s] = Boolean(currentDaySubs[s]);
        return acc;
      }, {}),
      [subName]: nextVal
    };

    const isAll8Completed = CLOTHES_SUB_ITEMS.every((s) => Boolean(updatedDaySubs[s]));
    const clothesItem = COMMON_HABIT_ITEMS[0];
    const prevMainStatus = currentData.checks?.hb_clothes_all?.[dayKey] || 'NONE';

    let nextMainStatus = 'NONE';
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
              ...(childObj.checks?.hb_clothes_all || {}),
              [dayKey]: nextMainStatus
            }
          }
        }
      };
    });

    if (isAll8Completed && prevMainStatus === 'NONE') {
      showToast(`🎉 ${dayLabel}요일 옷 정리 8종 올클리어 달성! (+${clothesItem.score}점 인정)`, 'success');
    }
  };

  // 요일 전체 일괄 완료 처리
  const handleBulkDayComplete = (dayKey, dayLabel, targetStatus = 'WEEKDAY') => {
    if (!requireParentMode('요일 전체 완료 체크')) return;

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      const updatedChecks = { ...(childObj.checks || {}) };

      allItems.forEach((item) => {
        updatedChecks[item.id] = {
          ...(updatedChecks[item.id] || {}),
          [dayKey]: targetStatus
        };
      });

      const updatedClothesSub = {
        ...(childObj.clothesSubChecks || {}),
        [dayKey]: CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
          acc[sub] = targetStatus !== 'NONE';
          return acc;
        }, {})
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
      `${dayLabel}요일 전체 항목이 '${targetStatus === 'WEEKDAY' ? '평일 완료' : '주말 보충 완료'}'로 체크되었습니다.`,
      'success'
    );
  };

  // 특정 자녀의 주말 유튜브 시청 시간 차감 (오직 부모님 모드에서만 가능!)
  const deductYoutubeForChild = (targetChildKey, minutesToDeduct, customMemo = '') => {
    if (!requireParentMode('유튜브 시청 시간 차감')) return false;

    const mins = parseInt(minutesToDeduct, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast('올바른 차감 시간(분)을 입력해주세요.', 'warning');
      return false;
    }

    const targetSummary = summaries[targetChildKey];
    const targetName = CHILDREN_CONFIG[targetChildKey].name;

    if (targetSummary.remainingMinutes <= 0) {
      showToast(`${targetName}이의 남아있는 유튜브 시청 가능 시간이 없습니다! (0분)`, 'warning');
      return false;
    }

    const actualDeduct = Math.min(mins, targetSummary.remainingMinutes);
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const memoText = customMemo.trim() || `유튜브 ${actualDeduct}분 시청 차감`;

    setChildrenData((prev) => {
      const childObj = prev[targetChildKey];
      const nextUsed = (childObj.usedYoutubeMinutes || 0) + actualDeduct;
      const newLog = {
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

    showToast(`🎬 ${targetName} 유튜브 ${actualDeduct}분 차감 완료!`, 'info');
    return true;
  };

  // 현재 탭 자녀의 유튜브 차감 (부모님 모드 전용)
  const handleDeductYoutube = (minutesToDeduct, customMemo = '') => {
    const ok = deductYoutubeForChild(activeChild, minutesToDeduct, customMemo);
    if (ok) {
      setCustomDeductInput('');
      setWatchMemoInput('');
    }
  };

  // ==========================================
  // 수현 & 다현 동시 작동 실시간 타이머 제어 핸들러
  // - 타이머 시작/일시정지: 자녀용 & 부모용 모두 가능!
  // - 시간 차감 확정 및 0초 리셋: 부모용 모드에서만 가능!
  // ==========================================
  const handleToggleChildTimer = (childKey) => {
    const childSummary = summaries[childKey];
    const isCurrentlyRunning = timers[childKey].isRunning;

    if (!isCurrentlyRunning && childSummary.remainingMinutes <= 0) {
      showToast(
        `${CHILDREN_CONFIG[childKey].name}이는 잔여 유튜브 시간이 0분이어서 타이머를 시작할 수 없습니다.`,
        'warning'
      );
      return;
    }

    setTimers((prev) => ({
      ...prev,
      [childKey]: {
        ...prev[childKey],
        isRunning: !prev[childKey].isRunning
      }
    }));

    showToast(
      !isCurrentlyRunning
        ? `▶️ ${CHILDREN_CONFIG[childKey].name}이의 유튜브 시청 타이머를 시작했습니다!`
        : `⏸️ ${CHILDREN_CONFIG[childKey].name}이의 유튜브 시청 타이머를 일시정지했습니다.`,
      'info'
    );
  };

  // 타이머를 차감 없이 0초로 초기화 (부모님 모드 전용)
  const handleResetChildTimer = (childKey) => {
    if (!requireParentMode('타이머 0초 초기화')) return;
    setTimers((prev) => ({
      ...prev,
      [childKey]: { isRunning: false, elapsedSeconds: 0 }
    }));
    showToast(`${CHILDREN_CONFIG[childKey].name} 타이머가 00:00으로 초기화되었습니다.`, 'info');
  };

  // 타이머 경과 시간 차감 확정 (부모님 모드 전용)
  const handleFinishAndDeductChildTimer = (childKey) => {
    if (!requireParentMode('타이머 경과 시간 차감 확정')) return;

    const elapsedSec = timers[childKey].elapsedSeconds;
    if (elapsedSec <= 0) return;

    const elapsedMinutes = Math.max(1, Math.round(elapsedSec / 60));

    setTimers((prev) => ({
      ...prev,
      [childKey]: { isRunning: false, elapsedSeconds: 0 }
    }));

    deductYoutubeForChild(
      childKey,
      elapsedMinutes,
      `실시간 타이머 측정 시청 (${formatTimer(elapsedSec)} → ${elapsedMinutes}분 차감)`
    );
  };

  const handleStartBothTimers = () => {
    if (summaries.suhyun.remainingMinutes <= 0 && summaries.dahyun.remainingMinutes <= 0) {
      showToast('수현이와 다현이 모두 잔여 유튜브 시간이 0분입니다.', 'warning');
      return;
    }
    setTimers((prev) => ({
      suhyun: {
        ...prev.suhyun,
        isRunning: summaries.suhyun.remainingMinutes > 0 ? true : prev.suhyun.isRunning
      },
      dahyun: {
        ...prev.dahyun,
        isRunning: summaries.dahyun.remainingMinutes > 0 ? true : prev.dahyun.isRunning
      }
    }));
    showToast('▶️ 수현이와 다현이의 유튜브 타이머가 동시에 작동합니다!', 'success');
  };

  const handlePauseBothTimers = () => {
    setTimers((prev) => ({
      suhyun: { ...prev.suhyun, isRunning: false },
      dahyun: { ...prev.dahyun, isRunning: false }
    }));
    showToast('⏸️ 수현이와 다현이의 타이머를 모두 일시정지했습니다.', 'info');
  };

  // 최근 유튜브 차감 내역 취소 (Undo - 부모님 전용)
  const handleUndoWatchLog = (logId) => {
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
      showToast(`↩️ ${restoreMinutes}분 차감 내역이 취소되어 복구되었습니다.`, 'info');
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
                ...(childObj.checks?.[itemId] || {}),
                [dayKey]: 'NONE'
              }
            },
            youtubeLogs: (childObj.youtubeLogs || []).filter((l) => l.id !== logId)
          }
        };
      });
      showToast('↩️ 주말 보충 가점 내역이 취소되었습니다.', 'info');
    }
  };

  // 엄마/아빠 칭찬스티커 부여 (부모님 전용)
  const handleAddSticker = (e) => {
    e.preventDefault();
    if (!requireParentMode('칭찬스티커 발급')) return;

    const currentStickers = currentData.stickers || [];
    if (currentStickers.length >= 100) {
      showToast('이미 칭찬스티커 100개를 모두 모았습니다! 보상을 수여하고 새 보드를 시작해주세요.', 'warning');
      return;
    }

    const reasonText =
      stickerReason.trim() ||
      (stickerGiver === 'MOM' ? '엄마가 칭찬하는 멋진 행동!' : '아빠가 칭찬하는 최고 행동!');
    const todayStr = new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });

    const newSticker = {
      id: Date.now(),
      giver: stickerGiver,
      reason: reasonText,
      date: todayStr
    };

    setChildrenData((prev) => {
      const childObj = prev[activeChild];
      return {
        ...prev,
        [activeChild]: {
          ...childObj,
          stickers: [...(childObj.stickers || []), newSticker]
        }
      };
    });

    setStickerReason('');
    showToast(
      `${stickerGiver === 'MOM' ? '💖 엄마' : '💙 아빠'} 칭찬스티커가 발급되었습니다! (${currentStickers.length + 1}/100)`,
      'success'
    );
  };

  // 최근 칭찬스티커 1개 취소 (부모님 전용)
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

  // 새 주차 시작 (주간 채점표 및 유튜브 시간만 초기화, 칭찬스티커는 유지!)
  const handleResetWeeklyBoard = () => {
    if (!requireParentMode('새 주차 초기화')) return;

    setConfirmDialog({
      title: '새 한 주 시작 (주간 보드 초기화)',
      message: `${currentConfig.name}이의 이번 주 채점 기록과 주말 유튜브 시청 기록을 모두 0으로 초기화하시겠습니까? (※ 엄마/아빠 칭찬스티커 누적 개수는 초기화되지 않고 그대로 유지됩니다!)`,
      confirmText: '새 주차 시작하기',
      onConfirm: () => {
        const emptyChecks = {};
        allItems.forEach((item) => {
          emptyChecks[item.id] = { MON: 'NONE', TUE: 'NONE', WED: 'NONE', THU: 'NONE', FRI: 'NONE' };
        });

        const emptySubChecks = {};
        DAYS.forEach(({ key }) => {
          emptySubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
            acc[sub] = false;
            return acc;
          }, {});
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
        showToast(`${currentConfig.name}이의 새로운 한 주 채점표가 준비되었습니다!`, 'success');
      }
    });
  };

  // 칭찬스티커 100개 달성 후 다음 회차 리셋
  const handleResetStickerBoard = () => {
    if (!requireParentMode('100개 보드 리셋')) return;

    setConfirmDialog({
      title: '🎉 100개 달성 보상 완료 & 새 보드 시작',
      message: `${currentConfig.name}이에게 약속한 엄청난 상품을 수여하고, 다음 회차(${currentData.stickerRound + 1}회차) 100칸 칭찬스티커 보드를 새로 시작하시겠습니까?`,
      confirmText: '보상 완료 및 새 보드 시작',
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
        showToast('축하합니다! 새로운 100칸 칭찬스티커 보드가 시작되었습니다!', 'success');
      }
    });
  };

  // 전체 데이터 초기화 (수현·다현 주간 채점표 및 유튜브 시간 0으로 초기화, 칭찬스티커는 유지!)
  const handleResetAllDataExceptStickers = () => {
    if (!requireParentMode('데이터 초기화')) return;
    setConfirmDialog({
      title: '⚠️ 데이터 초기화 (칭찬스티커 제외)',
      message:
        '수현이와 다현이의 주간 채점 기록, 옷 정리 점검, 주말 유튜브 시청 시간 및 타이머를 모두 0으로 초기화하시겠습니까? (※ 엄마·아빠 칭찬스티커 누적 개수와 발급 내역은 초기화되지 않고 그대로 유지됩니다!)',
      confirmText: '데이터 초기화 실행',
      onConfirm: () => {
        const buildEmptyChildWeek = (childKey, prevChildObj) => {
          const cfg = CHILDREN_CONFIG[childKey];
          const items = [...cfg.studyItems, ...cfg.habitItems];
          const emptyChecks = {};
          items.forEach((item) => {
            emptyChecks[item.id] = {
              MON: 'NONE',
              TUE: 'NONE',
              WED: 'NONE',
              THU: 'NONE',
              FRI: 'NONE'
            };
          });

          const emptySubChecks = {};
          DAYS.forEach(({ key }) => {
            emptySubChecks[key] = CLOTHES_SUB_ITEMS.reduce((acc, sub) => {
              acc[sub] = false;
              return acc;
            }, {});
          });

          return {
            ...prevChildObj,
            checks: emptyChecks,
            clothesSubChecks: emptySubChecks,
            usedYoutubeMinutes: 0,
            youtubeLogs: []
            // stickers, stickerRound, rewardGoal은 그대로 보존
          };
        };

        setChildrenData((prev) => ({
          suhyun: buildEmptyChildWeek('suhyun', prev.suhyun),
          dahyun: buildEmptyChildWeek('dahyun', prev.dahyun)
        }));

        setTimers({
          suhyun: { isRunning: false, elapsedSeconds: 0 },
          dahyun: { isRunning: false, elapsedSeconds: 0 }
        });

        setConfirmDialog(null);
        showToast(
          '칭찬스티커를 제외한 모든 주간 학습·습관 및 유튜브 데이터가 0으로 초기화되었습니다.',
          'success'
        );
      }
    });
  };

  // 목표 보상 저장
  const handleSaveGoal = () => {
    if (!requireParentMode('목표 상품 변경')) return;
    if (!goalInput.trim()) return;
    setChildrenData((prev) => ({
      ...prev,
      [activeChild]: {
        ...prev[activeChild],
        rewardGoal: goalInput.trim()
      }
    }));
    setEditingGoal(false);
    showToast('100개 달성 목표 상품이 변경되었습니다!', 'success');
  };

  // 시간 포맷 헬퍼 (예: 135분 -> 2시간 15분)
  const formatMinutesReadable = (mins) => {
    const safeMins = Math.max(0, Number(mins) || 0);
    const h = Math.floor(safeMins / 60);
    const m = safeMins % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  };

  const isSuhyun = activeChild === 'suhyun';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      {/* 상단 알림 토스트 */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage.msg}</span>
        </div>
      )}

      {/* ==========================================
          모드 안내 상단 배너 (자녀용 vs 부모용 명확히 구분)
      ========================================== */}
      <div
        className={`w-full px-4 py-2 text-xs font-bold border-b transition-colors ${
          isParentMode
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-amber-50 text-amber-900 border-amber-200'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isParentMode ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>
                  <strong>[부모님 관리 모드]</strong> 관리자 암호로 로그인됨 — 모든 점수 채점, 유튜브 시간 차감 확정, 칭찬스티커 발급이 가능합니다.
                </span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>[자녀용 화면]</strong> 점수·스티커 조회 및 <strong>실시간 유튜브 타이머 작동(시작/일시정지)만 가능</strong>합니다. (시간 차감 및 채점은 부모용 모드 전용)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isParentMode ? (
              <>
                <button
                  type="button"
                  onClick={openPasswordChangeModal}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-emerald-100 transition flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>비밀번호 변경</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsParentMode(false);
                    showToast('자녀용 화면으로 전환되었습니다.', 'info');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 font-extrabold transition"
                >
                  자녀용 화면으로 전환(로그아웃)
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setChangePinMode(false);
                  setPinModalOpen(true);
                }}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                <span>부모님 암호 로그인</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          상단 헤더 & 자녀 전환 탭
      ========================================== */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md bg-white/95 border-b transition-colors ${
          isSuhyun ? 'border-blue-100' : 'border-rose-100'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* 앱 타이틀 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm ${
                  isSuhyun
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    : 'bg-gradient-to-br from-rose-500 to-pink-600'
                }`}
              >
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                  수현·다현 주간 학습 & 습관 매니저
                </h1>
                <p className="text-xs text-slate-500">
                  수현 주간 465점 만점 · 다현 주간 415점 만점 (1점 = 주말 유튜브 1분)
                </p>
              </div>
            </div>
          </div>

          {/* 자녀 프로필 선택 탭 & 모드 스위치 */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveChild('suhyun')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  isSuhyun
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👦🏻</span>
                <span>수현 (초3 남)</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md ${
                    isSuhyun ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {summaries.suhyun.totalScore} / 465점
                </span>
                {timers.suhyun.isRunning && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="타이머 작동 중" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveChild('dahyun')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  !isSuhyun
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👧🏻</span>
                <span>다현 (초3 여)</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md ${
                    !isSuhyun ? 'bg-rose-600 text-rose-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {summaries.dahyun.totalScore} / 415점
                </span>
                {timers.dahyun.isRunning && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="타이머 작동 중" />
                )}
              </button>
            </div>

            {isParentMode && (
              <button
                type="button"
                onClick={openPasswordChangeModal}
                className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
              >
                <KeyRound className="w-4 h-4" />
                <span>비밀번호 변경</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isParentMode) {
                  setIsParentMode(false);
                  showToast('자녀용 화면으로 전환되었습니다.', 'info');
                } else {
                  setChangePinMode(false);
                  setPinError('');
                  setPinModalOpen(true);
                }
              }}
              className={`hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition ${
                isParentMode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
            >
              {isParentMode ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{isParentMode ? '부모용 모드 ON' : '부모용 로그인'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==========================================
          메인 컨텐츠 컨테이너
      ========================================== */}
      <main className="max-w-6xl mx-auto px-4 pt-5 space-y-6">
        {/* 상단 글로벌 실시간 유튜브 동시 타이머 바 (자녀 화면에서는 시작/일시정지만 노출, 차감은 부모 모드에서만 노출) */}
        {activeTab !== 'youtube' && (
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 px-4 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Clock
                className={`w-4 h-4 text-amber-400 ${
                  timers.suhyun.isRunning || timers.dahyun.isRunning ? 'animate-spin' : ''
                }`}
              />
              <span>
                실시간 유튜브 동시 타이머{' '}
                <span className="text-slate-400 font-normal">
                  (자녀용: 타이머 시작·일시정지 가능 / 부모용: 시간 차감 확정 가능)
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {['suhyun', 'dahyun'].map((ck) => {
                const cfg = CHILDREN_CONFIG[ck];
                const sum = summaries[ck];
                const t = timers[ck];
                const isBlue = ck === 'suhyun';
                return (
                  <div
                    key={ck}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                      t.isRunning
                        ? isBlue
                          ? 'bg-blue-950 border-blue-400'
                          : 'bg-rose-950 border-rose-400'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span>
                      {cfg.avatarEmoji} {cfg.name}:
                    </span>
                    <span
                      className={`font-mono font-black text-sm ${
                        isBlue ? 'text-blue-400' : 'text-rose-400'
                      }`}
                    >
                      {formatTimer(t.elapsedSeconds)}
                    </span>
                    <span className="text-[11px] text-slate-400">(잔여 {sum.remainingMinutes}분)</span>
                    <button
                      type="button"
                      disabled={!t.isRunning && sum.remainingMinutes <= 0}
                      onClick={() => handleToggleChildTimer(ck)}
                      className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                        !t.isRunning && sum.remainingMinutes <= 0
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : t.isRunning
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {t.isRunning ? '일시정지' : '타이머 시작'}
                    </button>
                    {isParentMode && t.elapsedSeconds > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFinishAndDeductChildTimer(ck)}
                        className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-extrabold transition"
                      >
                        차감확정(-{Math.max(1, Math.round(t.elapsedSeconds / 60))}분)
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveTab('youtube')}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold transition"
              >
                타이머 탭 이동
              </button>
            </div>
          </div>
        )}

        {/* 1. 상단 핵심 요약 카드 4종 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 카드 1: 이번 주 누적 총점 */}
          <div
            onClick={() => {
              setShowIncompleteOnly(false);
              setActiveTab('board');
            }}
            className={`cursor-pointer bg-white hover:bg-slate-50/80 transition rounded-2xl p-4 border shadow-sm flex flex-col justify-between ${
              activeTab === 'board' && !showIncompleteOnly
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                이번 주 총 획득 점수
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isSuhyun ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                만점 {currentConfig.weeklyMaxScore}점
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{scoreSummary.totalScore}</span>
              <span className="text-sm font-semibold text-slate-500">
                / {currentConfig.weeklyMaxScore}점
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>평일 정규: {scoreSummary.weekdayScore}점</span>
              <span className="font-bold text-amber-600">
                + 주말 보충: {scoreSummary.weekendMakeupScore}점
              </span>
            </div>
          </div>

          {/* 카드 2: 주말 보충 가능(미완료) 점수 안내 */}
          <div
            onClick={() => {
              setActiveTab('board');
              setShowIncompleteOnly(true);
            }}
            className={`cursor-pointer bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100/70 hover:to-orange-100/70 transition rounded-2xl p-4 border shadow-sm flex flex-col justify-between ${
              activeTab === 'board' && showIncompleteOnly
                ? 'border-amber-500 ring-2 ring-amber-500/20'
                : 'border-amber-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                주말 보충(패자부활) 가능 점수
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                미완료 {scoreSummary.incompleteCount}건 보기
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-700">
                +{scoreSummary.incompletePotentialScore}
              </span>
              <span className="text-sm font-semibold text-amber-700">점(분) 추가 가능!</span>
            </div>
            <p className="text-xs text-amber-800/90 pt-2 border-t border-amber-200/60">
              클릭하면 주중 미완료 항목만 모아서 볼 수 있어요!
            </p>
          </div>

          {/* 카드 3: 주말 유튜브 잔여 시간 */}
          <div
            onClick={() => setActiveTab('youtube')}
            className={`cursor-pointer bg-gradient-to-br from-red-50 to-rose-50 hover:from-red-100/70 hover:to-rose-100/70 transition rounded-2xl p-4 border shadow-sm flex flex-col justify-between ${
              activeTab === 'youtube'
                ? 'border-red-500 ring-2 ring-red-500/20'
                : 'border-red-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                <Youtube className="w-4 h-4 text-red-600" />
                주말 유튜브 잔여 시간
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {formatMinutesReadable(scoreSummary.remainingMinutes)}
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-600">
                {scoreSummary.remainingMinutes}
              </span>
              <span className="text-sm font-semibold text-red-600/80">
                분 남음 (총 {scoreSummary.totalEarnedMinutes}분 중)
              </span>
            </div>
            <div className="w-full bg-red-200/70 h-2 rounded-full overflow-hidden">
              <div
                className="bg-red-600 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    scoreSummary.totalEarnedMinutes > 0
                      ? Math.min(
                          100,
                          (scoreSummary.remainingMinutes / scoreSummary.totalEarnedMinutes) * 100
                        )
                      : 0
                  }%`
                }}
              />
            </div>
          </div>

          {/* 카드 4: 엄마/아빠 칭찬스티커 100 */}
          <div
            onClick={() => setActiveTab('sticker')}
            className={`cursor-pointer bg-gradient-to-br from-violet-50 to-purple-50 hover:from-violet-100/70 hover:to-purple-100/70 transition rounded-2xl p-4 border shadow-sm flex flex-col justify-between ${
              activeTab === 'sticker'
                ? 'border-violet-500 ring-2 ring-violet-500/20'
                : 'border-violet-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-violet-600" />
                엄마·아빠 칭찬스티커 ({currentData.stickerRound}회차)
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-200/70 text-violet-900">
                목표 100개
              </span>
            </div>
            <div className="my-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-violet-700">
                {(currentData.stickers || []).length}
              </span>
              <span className="text-sm font-semibold text-violet-600">/ 100개 누적</span>
            </div>
            <div className="w-full bg-violet-200/70 h-2 rounded-full overflow-hidden">
              <div
                className="bg-violet-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (currentData.stickers || []).length)}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. 메인 기능 네비게이션 탭 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'board'
                  ? isSuhyun
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>1. 주간 채점표 & 주말 보충</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('youtube')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'youtube'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Youtube className="w-4 h-4" />
              <span>2. 주말 유튜브 & 동시 타이머</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'youtube' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'
                }`}
              >
                {scoreSummary.remainingMinutes}분
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sticker')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'sticker'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>3. 칭찬스티커 100칸 보드</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'sticker'
                    ? 'bg-violet-700 text-white'
                    : 'bg-violet-100 text-violet-700'
                }`}
              >
                {(currentData.stickers || []).length}/100
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>4. 배점표 & 설정 관리</span>
            </button>
          </div>

          {activeTab === 'board' && isParentMode && (
            <button
              type="button"
              onClick={handleResetWeeklyBoard}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>새 주차 시작 (주간 초기화)</span>
            </button>
          )}
        </div>

        {/* ==========================================
            탭 1: 주간 채점 보드 (월~금) & 주말 보충 가점
        ========================================== */}
        {activeTab === 'board' && (
          <section className="space-y-4">
            {/* 채점 컨트롤 바 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{currentConfig.avatarEmoji}</span>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {currentConfig.name}이의 주간 학습과목 & 생활습관 채점표
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    1일 만점 {currentConfig.dailyMaxScore}점 / 주간 {currentConfig.weeklyMaxScore}점
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isParentMode ? (
                    <>
                      칸을 클릭하면 <strong>평일 완료(초록 체크)</strong> →{' '}
                      <strong>주말 보충 완료(주황 별표)</strong> → <strong>미수행</strong> 순으로 변경되며 주말 유튜브 시간에 즉시 반영됩니다.
                    </>
                  ) : (
                    <span className="text-amber-700 font-semibold">
                      👀 현재 자녀용 조회 모드입니다. 점수를 체크하거나 변경하려면 우측 상단 '부모님 암호 로그인(기본: 1234)'을 눌러주세요.
                    </span>
                  )}
                </p>
              </div>

              {/* 스탬프 모드 스위치(부모 전용) & 미완료 모아보기 필터(공통) */}
              <div className="flex flex-wrap items-center gap-2">
                {isParentMode && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setStampMode('CYCLE')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        stampMode === 'CYCLE'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      클릭 순환(기본)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStampMode('WEEKDAY')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
                        stampMode === 'WEEKDAY'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      평일 완료 찍기
                    </button>
                    <button
                      type="button"
                      onClick={() => setStampMode('WEEKEND')}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
                        stampMode === 'WEEKEND'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      주말 보충 찍기
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    showIncompleteOnly
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showIncompleteOnly ? '전체 항목 보기' : '주중 미완료 있는 항목만'}</span>
                </button>
              </div>
            </div>

            {/* 주간 채점 그리드 테이블 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[680px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-extrabold">
                      <th className="py-3.5 px-4 text-left w-64">평가 항목 (배점)</th>
                      {DAYS.map((day) => (
                        <th key={day.key} className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-black text-slate-800">{day.label}요일</span>
                            {isParentMode && (
                              <button
                                type="button"
                                onClick={() => handleBulkDayComplete(day.key, day.label, 'WEEKDAY')}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200/80 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 transition"
                                title={`${day.label}요일 전체 평일 완료 체크`}
                              >
                                전체완료
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="py-3.5 px-4 text-center w-28 bg-slate-100/70">주간 합계</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {/* 섹션 1: 개별 학습과목 */}
                    <tr className="bg-indigo-50/60">
                      <td colSpan={7} className="py-2 px-4 text-xs font-extrabold text-indigo-900">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span>
                            1. {currentConfig.name} 개별 학습과목 ({currentConfig.studyItems.length}개 과목 /
                            일일 소계 {currentConfig.studyItems.reduce((a, b) => a + b.score, 0)}점, 주간{' '}
                            {currentConfig.studyItems.reduce((a, b) => a + b.score, 0) * 5}점)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {currentConfig.studyItems
                      .filter((item) => {
                        if (!showIncompleteOnly) return true;
                        const rowChecks = currentData.checks?.[item.id] || {};
                        return DAYS.some((d) => (rowChecks[d.key] || 'NONE') === 'NONE');
                      })
                      .map((item) => {
                        const rowChecks = currentData.checks?.[item.id] || {};
                        const rowSum = DAYS.reduce((acc, d) => {
                          const st = rowChecks[d.key] || 'NONE';
                          return st !== 'NONE' ? acc + item.score : acc;
                        }, 0);
                        const rowMax = item.score * 5;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <span>{item.name}</span>
                                <span className="shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {item.score}점
                                </span>
                              </div>
                            </td>

                            {DAYS.map((day) => {
                              const status = rowChecks[day.key] || 'NONE';
                              return (
                                <td key={day.key} className="p-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleCellToggle(item, day.key, day.label)}
                                    className={`w-full h-12 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all ${
                                      status === 'WEEKDAY'
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                        : status === 'WEEKEND'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-dashed border-slate-200'
                                    }`}
                                  >
                                    {status === 'WEEKDAY' && (
                                      <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>+{item.score}점</span>
                                      </>
                                    )}
                                    {status === 'WEEKEND' && (
                                      <>
                                        <div className="flex items-center gap-0.5">
                                          <Star className="w-3.5 h-3.5 fill-current" />
                                          <span className="text-[10px] font-extrabold">보충완료</span>
                                        </div>
                                        <span>+{item.score}점</span>
                                      </>
                                    )}
                                    {status === 'NONE' && (
                                      <span className="text-[11px] font-medium">미수행</span>
                                    )}
                                  </button>
                                </td>
                              );
                            })}

                            <td className="py-3 px-4 text-center font-extrabold bg-slate-50/60">
                              <span className="text-slate-900">{rowSum}</span>
                              <span className="text-xs text-slate-400 font-normal"> / {rowMax}점</span>
                            </td>
                          </tr>
                        );
                      })}

                    {/* 섹션 2: 공통 생활습관 (옷 정리 7점 통합 반영) */}
                    <tr className="bg-teal-50/60">
                      <td colSpan={7} className="py-2 px-4 text-xs font-extrabold text-teal-900">
                        <div className="flex items-center gap-1.5">
                          <Smile className="w-4 h-4 text-teal-600" />
                          <span>
                            2. 수현·다현 공통 생활습관 (3개 항목 / 일일 소계{' '}
                            {currentConfig.habitItems.reduce((a, b) => a + b.score, 0)}점, 주간{' '}
                            {currentConfig.habitItems.reduce((a, b) => a + b.score, 0) * 5}점)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {currentConfig.habitItems
                      .filter((item) => {
                        if (!showIncompleteOnly) return true;
                        const rowChecks = currentData.checks?.[item.id] || {};
                        return DAYS.some((d) => (rowChecks[d.key] || 'NONE') === 'NONE');
                      })
                      .map((item) => {
                        const rowChecks = currentData.checks?.[item.id] || {};
                        const rowSum = DAYS.reduce((acc, d) => {
                          const st = rowChecks[d.key] || 'NONE';
                          return st !== 'NONE' ? acc + item.score : acc;
                        }, 0);
                        const rowMax = item.score * 5;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-bold text-slate-800">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs sm:text-sm leading-snug">{item.name}</span>
                                  <span className="shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-100">
                                    {item.score}점
                                  </span>
                                </div>

                                {item.subItems && (
                                  <div className="space-y-1.5 pt-0.5">
                                    <div className="flex flex-wrap gap-1">
                                      {item.subItems.map((sub) => (
                                        <span
                                          key={sub}
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100/80 text-teal-800"
                                        >
                                          ✓ {sub}
                                        </span>
                                      ))}
                                    </div>
                                    <p className="text-[11px] font-extrabold text-rose-600">
                                      ※ {item.ruleNote}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>

                            {DAYS.map((day) => {
                              const status = rowChecks[day.key] || 'NONE';
                              const daySubMap = currentData.clothesSubChecks?.[day.key] || {};
                              const checkedSubCount = item.subItems
                                ? item.subItems.filter((s) => Boolean(daySubMap[s])).length
                                : 0;

                              return (
                                <td key={day.key} className="p-1.5 text-center align-middle">
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleCellToggle(item, day.key, day.label)}
                                      className={`w-full h-12 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all ${
                                        status === 'WEEKDAY'
                                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                                          : status === 'WEEKEND'
                                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-dashed border-slate-200'
                                      }`}
                                    >
                                      {status === 'WEEKDAY' && (
                                        <>
                                          <CheckCircle2 className="w-4 h-4" />
                                          <span>+{item.score}점</span>
                                        </>
                                      )}
                                      {status === 'WEEKEND' && (
                                        <>
                                          <div className="flex items-center gap-0.5">
                                            <Star className="w-3.5 h-3.5 fill-current" />
                                            <span className="text-[10px] font-extrabold">보충완료</span>
                                          </div>
                                          <span>+{item.score}점</span>
                                        </>
                                      )}
                                      {status === 'NONE' && (
                                        <span className="text-[11px] font-medium">미수행</span>
                                      )}
                                    </button>

                                    {item.subItems && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setClothesHelperModal({ dayKey: day.key, dayLabel: day.label })
                                        }
                                        className="text-[10px] font-bold py-0.5 px-1.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition"
                                      >
                                        8종 점검 ({checkedSubCount}/8)
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            <td className="py-3 px-4 text-center font-extrabold bg-slate-50/60">
                              <span className="text-slate-900">{rowSum}</span>
                              <span className="text-xs text-slate-400 font-normal"> / {rowMax}점</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>

                  {/* 하단 요일별 합계 및 주간 총점 요약 푸터 */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold text-sm">
                      <td className="py-3.5 px-4">요일별 획득 점수 합계</td>
                      {DAYS.map((day) => (
                        <td key={day.key} className="py-3 px-2 text-center">
                          <div className="text-base font-black text-emerald-400">
                            {scoreSummary.dailyScores[day.key]}점
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            / {currentConfig.dailyMaxScore}점
                            {scoreSummary.dailyMakeups[day.key] > 0 && (
                              <span className="text-amber-400 ml-1">
                                (보충 +{scoreSummary.dailyMakeups[day.key]})
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="py-3.5 px-4 text-center bg-indigo-600">
                        <div className="text-lg font-black text-white">
                          총 {scoreSummary.totalScore}점
                        </div>
                        <div className="text-[11px] text-indigo-200 font-medium">
                          = 유튜브 {scoreSummary.totalEarnedMinutes}분
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ==========================================
            탭 2: 주말 유튜브 시청 트래커 & 수현·다현 동시 타이머
            (자녀용에서는 타이머만 작동 가능! 시간 차감은 부모용 전용!)
        ========================================== */}
        {activeTab === 'youtube' && (
          <section className="space-y-6">
            {/* 수현 & 다현 동시 작동 실시간 유튜브 타이머 패널 */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-white">
                        수현 & 다현 실시간 유튜브 시청 타이머 (동시 작동 지원)
                      </h2>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        자녀용 화면에서도 타이머 작동 가능
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      자녀용 화면에서는 타이머 <strong>시작·일시정지만 작동</strong>할 수 있으며, 시간 차감은 부모님 모드에서만 가능합니다.
                    </p>
                  </div>
                </div>

                {/* 남매 동시 시작 / 동시 일시정지 버튼 */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartBothTimers}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>남매 동시 시작</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePauseBothTimers}
                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>동시 일시정지</span>
                  </button>
                </div>
              </div>

              {/* 수현 & 다현 듀얼 타이머 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['suhyun', 'dahyun'].map((childKey) => {
                  const cfg = CHILDREN_CONFIG[childKey];
                  const sum = summaries[childKey];
                  const tState = timers[childKey];
                  const isBlue = childKey === 'suhyun';
                  const isNoTimeLeft = !tState.isRunning && sum.remainingMinutes <= 0;

                  return (
                    <div
                      key={childKey}
                      className={`rounded-2xl p-4 border transition-all ${
                        tState.isRunning
                          ? isBlue
                            ? 'bg-blue-950/80 border-blue-400 shadow-md'
                            : 'bg-rose-950/80 border-rose-400 shadow-md'
                          : 'bg-slate-800/70 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cfg.avatarEmoji}</span>
                          <div>
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                              <span>
                                {cfg.name} ({cfg.info})
                              </span>
                              {tState.isRunning && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black animate-pulse">
                                  시청 중 LIVE
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-400">
                              현재 잔여 가능 시간:{' '}
                              <strong
                                className={
                                  sum.remainingMinutes > 0 ? 'text-emerald-400' : 'text-rose-400'
                                }
                              >
                                {sum.remainingMinutes}분
                              </strong>{' '}
                              (총 {sum.totalEarnedMinutes}분 중)
                            </p>
                          </div>
                        </div>

                        <div className="font-mono text-3xl font-black tracking-wider bg-slate-950 px-3.5 py-2 rounded-xl text-amber-400 border border-slate-800">
                          {formatTimer(tState.elapsedSeconds)}
                        </div>
                      </div>

                      {isNoTimeLeft && (
                        <div className="mb-3 px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-700/70 text-[11px] font-bold text-rose-200 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>
                            남은 시청 가능 시간이 0분입니다. 주중 미완료 숙제·습관을 주말 보충 수행하면 시간이 다시 충전돼요!
                          </span>
                        </div>
                      )}

                      {/* 타이머 조작 버튼: 자녀용에서는 시작/일시정지만 가능, 시간 차감 확정 및 리셋은 부모용 전용 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-700/80">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isNoTimeLeft}
                            onClick={() => handleToggleChildTimer(childKey)}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                              isNoTimeLeft
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : tState.isRunning
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
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
                                <span>{tState.elapsedSeconds > 0 ? '이어서 시작' : '타이머 시작'}</span>
                              </>
                            )}
                          </button>

                          {isParentMode && tState.elapsedSeconds > 0 && (
                            <button
                              type="button"
                              onClick={() => handleResetChildTimer(childKey)}
                              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition"
                            >
                              00:00 리셋
                            </button>
                          )}
                        </div>

                        {tState.elapsedSeconds > 0 ? (
                          isParentMode ? (
                            <button
                              type="button"
                              onClick={() => handleFinishAndDeductChildTimer(childKey)}
                              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>
                                경과 시간 차감 확정 (-{Math.max(1, Math.round(tState.elapsedSeconds / 60))}분)
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-300 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1">
                              <Lock className="w-3 h-3 shrink-0" />
                              <span>
                                시간 차감은 부모용 전용 (현재 {Math.max(1, Math.round(tState.elapsedSeconds / 60))}분 경과)
                              </span>
                            </span>
                          )
                        ) : (
                          !isParentMode && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              자녀용: 타이머 시작·일시정지 가능
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 하단: 선택된 자녀의 상세 시간 뱅크 & 차감 컨트롤러(부모 전용) + 활동 히스토리 로그 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 좌측 2컬럼: 유튜브 시간 지갑 & 차감 컨트롤러 */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                        <Youtube className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-900">
                          {currentConfig.avatarEmoji} {currentConfig.name}이의 주말 유튜브 시간 뱅크
                        </h2>
                        <p className="text-xs text-slate-500">
                          평일 총점({scoreSummary.weekdayScore}분) + 주말 보충 가점(
                          {scoreSummary.weekendMakeupScore}분) = 총 {scoreSummary.totalEarnedMinutes}분 확보
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      1점 = 1분 자동 환산
                    </span>
                  </div>

                  {/* 잔여 시간 대형 숫자 */}
                  <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {currentConfig.name} 현재 시청 가능 잔여 시간
                      </span>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span
                          className={`text-5xl font-black tracking-tight ${
                            scoreSummary.remainingMinutes === 0 ? 'text-slate-500' : 'text-emerald-400'
                          }`}
                        >
                          {scoreSummary.remainingMinutes}분
                        </span>
                        <span className="text-sm font-bold text-slate-300">
                          ({formatMinutesReadable(scoreSummary.remainingMinutes)})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-800/90 p-3.5 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block">총 획득 시간</span>
                        <span className="text-base font-extrabold text-white">
                          {scoreSummary.totalEarnedMinutes}분
                        </span>
                      </div>
                      <div className="border-l border-slate-700 pl-3">
                        <span className="text-slate-400 block">누적 시청(차감)</span>
                        <span className="text-base font-extrabold text-rose-400">
                          -{scoreSummary.usedMinutes}분
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 시간 차감 컨트롤러: 부모용 모드에서만 노출! 자녀용에서는 시간 차감 기능 숨김 */}
                  {isParentMode ? (
                    <>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-slate-700">
                            ⚡ [부모님 전용] {currentConfig.name} 빠른 시청 시간 차감
                          </label>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            부모님 모드 활성화됨
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[10, 20, 30, 60].map((min) => (
                            <button
                              type="button"
                              key={min}
                              onClick={() => handleDeductYoutube(min, `유튜브 ${min}분 시청`)}
                              className="py-3.5 px-4 rounded-2xl font-extrabold text-sm bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                              <span>-{min}분 차감</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={watchMemoInput}
                          onChange={(e) => setWatchMemoInput(e.target.value)}
                          placeholder="시청 메모 (예: 토요일 오후 마인크래프트 영상)"
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <div className="flex gap-2">
                          <div className="relative w-32">
                            <input
                              type="number"
                              min="1"
                              max="465"
                              value={customDeductInput}
                              onChange={(e) => setCustomDeductInput(e.target.value)}
                              placeholder="분 입력"
                              className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                              분
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeductYoutube(customDeductInput, watchMemoInput)}
                            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition"
                          >
                            직접 차감
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>시간 차감 기능은 부모님 전용입니다</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          자녀용 화면에서는 상단의 <strong>유튜브 시청 타이머(시작/일시정지)</strong>만 작동할 수 있으며, 시청 시간 차감은 부모님이 로그인 후 처리합니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setChangePinMode(false);
                          setPinModalOpen(true);
                        }}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>부모님 로그인</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 1컬럼: 유튜브 시간 차감 및 주말 보충 가점 히스토리 로그 */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        📋 주말 유튜브 차감 & 보충 내역
                      </h3>
                      <p className="text-xs text-slate-500">
                        시청 차감(-)과 주말 보충 가점(+) 기록
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      총 {(currentData.youtubeLogs || []).length}건
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {(currentData.youtubeLogs || []).length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-400">
                        아직 기록된 유튜브 차감 및 보충 내역이 없습니다.
                      </div>
                    ) : (
                      (currentData.youtubeLogs || []).map((log) => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                            log.minutes > 0
                              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold leading-snug">{log.memo}</div>
                            <div className="text-[11px] text-slate-400">{log.timestamp}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-sm font-black ${
                                log.minutes > 0 ? 'text-amber-600' : 'text-red-600'
                              }`}
                            >
                              {log.minutes > 0 ? `+${log.minutes}분` : `${log.minutes}분`}
                            </span>
                            {isParentMode &&
                              (log.type === 'WATCH' || log.type === 'MAKEUP_ADD') && (
                                <button
                                  type="button"
                                  onClick={() => handleUndoWatchLog(log.id)}
                                  className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
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
            </div>
          </section>
        )}

        {/* ==========================================
            탭 3: 엄마/아빠 칭찬스티커 100칸 보드
        ========================================== */}
        {activeTab === 'sticker' && (
          <section className="space-y-6">
            {/* 상단 목표 보상 배너 및 스티커 부여 폼 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800">
                      장기 누적 보상 ({currentData.stickerRound}회차 도전 중)
                    </span>
                    <h2 className="text-lg font-black text-slate-900">
                      {currentConfig.avatarEmoji} {currentConfig.name}이의 엄마·아빠 칭찬스티커 100칸 보드
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    주간 채점과 별도로 100개가 모일 때까지 초기화되지 않고 쭉 누적됩니다!
                  </p>
                </div>

                {/* 100개 달성 시 선물 목표 */}
                <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-violet-700 flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" />
                      <span>100개 달성 시 엄청난 상품 목표</span>
                    </div>
                    {editingGoal ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          value={goalInput}
                          onChange={(e) => setGoalInput(e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-violet-300 text-xs font-bold bg-white"
                          placeholder="목표 선물 입력"
                        />
                        <button
                          type="button"
                          onClick={handleSaveGoal}
                          className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-bold"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-black text-violet-950 mt-0.5">
                        🎁 {currentData.rewardGoal}
                      </div>
                    )}
                  </div>
                  {isParentMode && !editingGoal && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoalInput(currentData.rewardGoal);
                        setEditingGoal(true);
                      }}
                      className="p-2 rounded-xl bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 transition"
                      title="목표 상품 수정"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 부모용 모드: 스티커 부여 폼 / 자녀용 모드: 조회 전용 안내 */}
              {isParentMode ? (
                <form
                  onSubmit={handleAddSticker}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3"
                >
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStickerGiver('MOM')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
                        stickerGiver === 'MOM'
                          ? 'bg-pink-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>엄마 칭찬스티커</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStickerGiver('DAD')}
                      className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
                        stickerGiver === 'DAD'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                      <span>아빠 칭찬스티커</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={stickerReason}
                    onChange={(e) => setStickerReason(e.target.value)}
                    placeholder="어떤 칭찬할 일을 했나요? (예: 동생 배려하기, 스스로 책상 정리)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>스티커 1개 주기</span>
                    </button>
                    {(currentData.stickers || []).length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveLastSticker}
                        className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition"
                        title="방금 준 스티커 1개 취소"
                      >
                        1개 취소
                      </button>
                    )}
                    {(currentData.stickers || []).length >= 100 && (
                      <button
                        type="button"
                        onClick={handleResetStickerBoard}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition"
                      >
                        🎉 100개 보상 완료 & 새 보드
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="bg-violet-50/70 border border-violet-200 rounded-2xl p-3.5 text-xs text-violet-900 flex items-center justify-between">
                  <span>
                    👀 <strong>[자녀용 조회 모드]</strong> 지금까지 모은 칭찬스티커와 엄마·아빠의 칭찬 메모를 확인할 수 있어요!
                  </span>
                  <span className="font-extrabold">
                    남은 목표: {Math.max(0, 100 - (currentData.stickers || []).length)}개
                  </span>
                </div>
              )}

              {/* 100칸 그리드 보드 */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 pt-2">
                {Array.from({ length: 100 }, (_, i) => {
                  const num = i + 1;
                  const sticker = (currentData.stickers || [])[i];
                  const isMilestone = num % 10 === 0;

                  return (
                    <div
                      key={num}
                      title={
                        sticker
                          ? `[#${num}] ${sticker.giver === 'MOM' ? '엄마' : '아빠'} (${sticker.date}): ${sticker.reason}`
                          : `${num}번 칸`
                      }
                      className={`h-14 rounded-2xl border flex flex-col items-center justify-center p-1 transition-all ${
                        sticker
                          ? sticker.giver === 'MOM'
                            ? 'bg-pink-500 text-white border-pink-600 shadow-xs'
                            : 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : isMilestone
                          ? 'bg-amber-50/80 border-amber-300 text-amber-700 font-extrabold'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {sticker ? (
                        <>
                          <span className="text-base leading-none">
                            {sticker.giver === 'MOM' ? '💖' : '💙'}
                          </span>
                          <span className="text-[10px] font-black mt-1">
                            #{num} {sticker.giver === 'MOM' ? '엄마' : '아빠'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold">{num}</span>
                          {isMilestone && (
                            <span className="text-[9px] text-amber-600 font-extrabold">
                              {num === 100 ? '🎁GOAL' : '⭐'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 칭찬 사유 히스토리 목록 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-black text-slate-900">
                💌 엄마·아빠의 칭찬스티커 발급 기록 ({(currentData.stickers || []).length}개)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {(currentData.stickers || [])
                  .slice()
                  .reverse()
                  .map((st, idx) => {
                    const realNum = (currentData.stickers || []).length - idx;
                    return (
                      <div
                        key={st.id}
                        className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start gap-2.5 text-xs"
                      >
                        <div
                          className={`px-2 py-1 rounded-lg font-black text-white shrink-0 ${
                            st.giver === 'MOM' ? 'bg-pink-500' : 'bg-blue-600'
                          }`}
                        >
                          #{realNum} {st.giver === 'MOM' ? '엄마' : '아빠'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800">{st.reason}</div>
                          <div className="text-[11px] text-slate-400">{st.date}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* ==========================================
            탭 4: 배점표 요약 & 시스템 설정 관리
        ========================================== */}
        {activeTab === 'settings' && (
          <section className="space-y-6">
            {/* 부모님 모드 보안 및 비밀번호 변경 메뉴 카드 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      🔐 부모님 모드 비밀번호(PIN) 설정 관리
                    </h2>
                    <p className="text-xs text-slate-500">
                      자녀가 임의로 점수를 수정하거나 유튜브 시간을 차감하지 못하도록 관리자 비밀번호를 설정합니다.
                    </p>
                  </div>
                </div>
                {isParentMode && (
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    부모님 관리 모드 인증됨
                  </span>
                )}
              </div>

              {isParentMode ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <form
                    onSubmit={handleSaveNewPin}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5"
                  >
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-indigo-600" />
                      <span>새 비밀번호로 변경하기</span>
                    </h3>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        현재 비밀번호 입력
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        value={currentPinForChange}
                        onChange={(e) => {
                          setCurrentPinForChange(e.target.value);
                          setPinError('');
                        }}
                        placeholder="현재 사용 중인 비밀번호 입력"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        새 비밀번호 입력 (4자리 이상)
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        value={newPinInput}
                        onChange={(e) => {
                          setNewPinInput(e.target.value);
                          setPinError('');
                        }}
                        placeholder="새 비밀번호 (숫자 또는 영문 4자 이상)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        새 비밀번호 한 번 더 입력 (확인)
                      </label>
                      <input
                        type={showPinText ? 'text' : 'password'}
                        value={confirmNewPinInput}
                        onChange={(e) => {
                          setConfirmNewPinInput(e.target.value);
                          setPinError('');
                        }}
                        placeholder="새 비밀번호 다시 입력"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showPinText}
                          onChange={(e) => setShowPinText(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>입력한 비밀번호 문자 보기</span>
                      </label>
                    </div>

                    {pinError && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-600">
                        {pinError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition shadow-sm"
                    >
                      비밀번호 변경 저장하기
                    </button>
                  </form>

                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-3 text-xs text-slate-700">
                    <h4 className="text-sm font-black text-indigo-950">
                      💡 비밀번호 관리 안내
                    </h4>
                    <ul className="space-y-2 list-disc list-inside leading-relaxed">
                      <li>
                        변경하신 비밀번호는 브라우저에 즉시 저장되어 다음 접속 시에도 그대로 유지됩니다.
                      </li>
                      <li>
                        상단 초록색 부모님 모드 바 또는 헤더의 <strong>[비밀번호 변경]</strong> 버튼을 눌러 어느 화면에서나 즉시 비밀번호를 바꿀 수 있습니다.
                      </li>
                      <li>
                        점수 채점이나 시간 차감을 마친 뒤에는 상단 우측의 <strong>[자녀용 화면으로 전환(로그아웃)]</strong> 버튼을 눌러 자녀 모드로 두시는 것을 권장합니다.
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>비밀번호 변경은 부모님 로그인 후 가능합니다</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      우측 버튼을 눌러 현재 부모님 암호로 로그인하시면 새 비밀번호로 변경하실 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePinMode(false);
                      setPinError('');
                      setPinModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shrink-0 transition"
                  >
                    부모님 암호 로그인
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    📊 수현 · 다현 평가 항목 및 배점 기준표 (PRD 명세)
                  </h2>
                  <p className="text-xs text-slate-500">
                    평일(월~금) 획득 점수 + 주말 보충 수행 가점 = 주말 유튜브 시청 가능 시간(1점 = 1분)
                  </p>
                </div>
                {isParentMode && (
                  <button
                    type="button"
                    onClick={handleResetAllDataExceptStickers}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>데이터 초기화 (칭찬스티커 제외)</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {['suhyun', 'dahyun'].map((ck) => {
                  const cfg = CHILDREN_CONFIG[ck];
                  return (
                    <div
                      key={ck}
                      className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-900">
                          {cfg.avatarEmoji} {cfg.name} ({cfg.info})
                        </h3>
                        <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
                          일일 {cfg.dailyMaxScore}점 / 주간 {cfg.weeklyMaxScore}점 만점
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="font-extrabold text-slate-700">
                          1) 개별 학습과목 ({cfg.studyItems.length}과목)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cfg.studyItems.map((it) => (
                            <span
                              key={it.id}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700"
                            >
                              {it.name}: <strong>{it.score}점</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200">
                        <div className="font-extrabold text-teal-800">
                          2) 공통 생활습관 (3항목 / 일일 13점)
                        </div>
                        <div className="flex flex-col gap-1">
                          {cfg.habitItems.map((it) => (
                            <div
                              key={it.id}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700"
                            >
                              {it.name}: <strong className="text-teal-700">{it.score}점</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ==========================================
          모달 1: 옷 정리 8종 세부 점검 모달
      ========================================== */}
      {clothesHelperModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  👕 {currentConfig.name} - {clothesHelperModal.dayLabel}요일 옷 정리 8종 점검
                </h3>
                <p className="text-xs text-rose-600 font-bold mt-0.5">
                  8가지 항목을 모두 완료해야만 성공(+7점)으로 인정됩니다!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClothesHelperModal(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CLOTHES_SUB_ITEMS.map((sub) => {
                const isChecked = Boolean(
                  currentData.clothesSubChecks?.[clothesHelperModal.dayKey]?.[sub]
                );
                return (
                  <button
                    type="button"
                    key={sub}
                    onClick={() =>
                      handleToggleClothesSubItem(
                        clothesHelperModal.dayKey,
                        clothesHelperModal.dayLabel,
                        sub
                      )
                    }
                    className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-between transition ${
                      isChecked
                        ? 'bg-teal-600 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{sub}</span>
                    {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px]">미완료</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setClothesHelperModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          모달 2: 부모님 암호 로그인 / 암호 변경 모달
      ========================================== */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <span>{changePinMode ? '부모님 비밀번호 변경' : '부모님 모드 암호 로그인'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPinModalOpen(false);
                  setPinError('');
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {changePinMode ? (
              <form onSubmit={handleSaveNewPin} className="space-y-3">
                <p className="text-xs text-slate-500">
                  현재 비밀번호를 확인한 후 새로운 비밀번호(4자리 이상)를 입력해주세요.
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-black tracking-widest"
                  />
                  <input
                    type={showPinText ? 'text' : 'password'}
                    value={newPinInput}
                    onChange={(e) => {
                      setNewPinInput(e.target.value);
                      setPinError('');
                    }}
                    placeholder="새 비밀번호 입력 (4자 이상)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-black tracking-widest"
                  />
                  <input
                    type={showPinText ? 'text' : 'password'}
                    value={confirmNewPinInput}
                    onChange={(e) => {
                      setConfirmNewPinInput(e.target.value);
                      setPinError('');
                    }}
                    placeholder="새 비밀번호 한 번 더 입력"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-center text-sm font-black tracking-widest"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPinText}
                    onChange={(e) => setShowPinText(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>비밀번호 문자 보기</span>
                </label>
                {pinError && <p className="text-xs font-bold text-red-600">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold transition"
                >
                  새 비밀번호 저장하기
                </button>
              </form>
            ) : (
              <form onSubmit={handleParentLogin} className="space-y-3">
                <p className="text-xs text-slate-500">
                  점수 채점, 유튜브 시간 차감, 칭찬스티커 발급을 위해 부모님 비밀번호를 입력해주세요. (초기 설정값: <strong>1234</strong>)
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
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center text-lg font-black tracking-widest"
                />
                {pinError && <p className="text-xs font-bold text-red-600">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold transition"
                >
                  부모님 모드로 로그인
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          모달 3: 공통 확인(Confirm) 다이얼로그
      ========================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-900">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold"
              >
                {confirmDialog.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}