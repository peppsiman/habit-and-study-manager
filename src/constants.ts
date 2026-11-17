import { ChildConfig, ChildKey, DayKey, EvaluationItem } from './types';

export const STORAGE_KEY_DATA = 'suhyun_dahyun_app_v3';
export const STORAGE_KEY_TIMERS = 'suhyun_dahyun_timers_v3';
export const STORAGE_KEY_PIN = 'suhyun_dahyun_pin_v3';

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
    category: 'HABIT'
  },
  { id: 'hb_bottle', name: '물통', score: 2, category: 'HABIT' },
  { id: 'hb_wash', name: '세수', score: 4, category: 'HABIT' }
];

export const CHILDREN_CONFIG: Record<ChildKey, ChildConfig> = {
  suhyun: {
    id: 'suhyun',
    name: '수현',
    info: '초3 남',
    themeColor: 'blue',
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
