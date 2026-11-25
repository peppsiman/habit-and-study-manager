import { ChildConfig, ChildKey, DayKey, EvaluationItem } from './types';

export const STORAGE_KEY_DATA = 'suhyun_dahyun_app_v3';
export const STORAGE_KEY_TIMERS = 'suhyun_dahyun_timers_v3';
export const STORAGE_KEY_PIN = 'suhyun_dahyun_pin_v3';
export const STORAGE_KEY_CHILD_PINS = 'suhyun_dahyun_child_pins_v4';

export const DEFAULT_CHILD_PINS: Record<ChildKey, string> = {
  suhyun: '8864',
  dahyun: '7749'
};

export const STUDY_TARGET_TOTALS: Record<ChildKey, number> = {
  suhyun: 72,
  dahyun: 52
};

export const DAYS: { key: DayKey; label: string; fullLabel: string }[] = [
  { key: 'MON', label: '월', fullLabel: '월요일' },
  { key: 'TUE', label: '화', fullLabel: '화요일' },
  { key: 'WED', label: '수', fullLabel: '수요일' },
  { key: 'THU', label: '목', fullLabel: '목요일' },
  { key: 'FRI', label: '금', fullLabel: '금요일' }
];

export const CLOTHES_SUB_ITEMS: string[] = [
  '잠바',
  '상의',
  '하의',
  '양말',
  '학원가방',
  '책가방',
  '태권도복',
  '태권도 띠'
];

export const COMMON_HABIT_ITEMS: EvaluationItem[] = [
  {
    id: 'hb_clothes_all',
    name: '옷 정리',
    shortName: '옷 정리 (8종 올클리어)',
    subItems: CLOTHES_SUB_ITEMS,
    ruleNote: '8가지 세부 항목을 모두 완료해야 7점 인정',
    score: 7,
    category: 'HABIT',
    scoringType: 'CHECK'
  },
  { id: 'hb_bottle', name: '물통', score: 2, category: 'HABIT', scoringType: 'CHECK' },
  { id: 'hb_wash', name: '세수', score: 4, category: 'HABIT', scoringType: 'CHECK' },
  {
    id: 'hb_reading',
    name: '독서',
    shortName: '독서 (음성 독후감)',
    ruleNote: '책을 읽고 음성 독후감 녹음 후 부모님 채점 (0 / 5 / 10점)',
    score: 10,
    category: 'HABIT',
    scoringType: 'READING_AUDIO'
  }
];

export const CHILDREN_CONFIG: Record<ChildKey, ChildConfig> = {
  suhyun: {
    id: 'suhyun',
    name: '수현',
    info: '초3 남',
    themeColor: 'blue',
    dailyMaxScore: 95, // 학습 72점 + 습관 23점
    weeklyMaxScore: 475, // 95점 * 5일
    studyItems: [
      { id: 'sh_plus', name: '플러스', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'sh_top', name: '최상위', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'sh_ggaebong', name: '깨봉', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'sh_korean', name: '국어', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'sh_eng_book', name: '영어(책)', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'sh_eng_sent', name: '영어(문장)', score: 12, category: 'STUDY', scoringType: 'CHECK' }
    ],
    habitItems: COMMON_HABIT_ITEMS
  },
  dahyun: {
    id: 'dahyun',
    name: '다현',
    info: '초3 여',
    themeColor: 'rose',
    dailyMaxScore: 75, // 학습 52점 + 습관 23점
    weeklyMaxScore: 375, // 75점 * 5일
    studyItems: [
      { id: 'dh_vitamin', name: '비타민', score: 10, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'dh_math', name: '수학 3-2', score: 12, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'dh_ggaebong', name: '깨봉', score: 10, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'dh_eng_book', name: '영어(책)', score: 10, category: 'STUDY', scoringType: 'CHECK' },
      { id: 'dh_eng_word', name: '영어(단어)', score: 10, category: 'STUDY', scoringType: 'CHECK' }
    ],
    habitItems: COMMON_HABIT_ITEMS
  }
};
