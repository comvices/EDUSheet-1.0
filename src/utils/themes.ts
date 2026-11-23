import { PastelThemeId, TeacherProfile } from '../types';

export function isAdminTeacherAccount(
  teacher?: Pick<TeacherProfile, 'id' | 'code' | 'subject'> | null
): boolean {
  if (!teacher) return false;
  const codeUpper = (teacher.code || '').trim().toUpperCase();
  const subjectTrim = (teacher.subject || '').trim();
  return (
    teacher.id === 'tch_admin' ||
    codeUpper === 'ADMIN' ||
    subjectTrim === 'ผู้ดูแลระบบ'
  );
}

export interface PastelThemePreset {
  id: PastelThemeId;
  name: string;
  englishName: string;
  description: string;
  swatchLight: string;
  swatchMid: string;
  swatchPrimary: string;
  swatchGradient: string;
  borderHex: string;
  accentTextHex: string;
  canvasLightHex: string;
  canvasDarkHex: string;
  heroGradient: string;
}

export const DEFAULT_PASTEL_THEME: PastelThemeId = 'mint';

export const PASTEL_THEME_IDS: PastelThemeId[] = [
  'sky',
  'mint',
  'lavender',
  'rose',
  'peach',
  'turquoise',
];

export const PASTEL_THEMES: PastelThemePreset[] = [
  {
    id: 'sky',
    name: 'ฟ้าพาสเทล',
    englishName: 'Pastel Sky',
    description: 'สบายตา สดใส สุขุมแบบห้องเรียนสมัยใหม่',
    swatchLight: '#dbeafe',
    swatchMid: '#7dd3fc',
    swatchPrimary: '#0369a1',
    swatchGradient: 'linear-gradient(135deg, #bae6fd 0%, #38bdf8 48%, #0369a1 100%)',
    borderHex: '#7dd3fc',
    accentTextHex: '#0369a1',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #081a2e 0%, #0e2c4b 52%, #14406b 100%)',
  },
  {
    id: 'mint',
    name: 'เขียวมิ้นท์',
    englishName: 'Mint Green',
    description: 'ละมุน ผ่อนคลาย กลมกลืนกับอัตลักษณ์โรงเรียน',
    swatchLight: '#d1fae5',
    swatchMid: '#6ee7b7',
    swatchPrimary: '#047857',
    swatchGradient: 'linear-gradient(135deg, #a7f3d0 0%, #34d399 48%, #047857 100%)',
    borderHex: '#6ee7b7',
    accentTextHex: '#047857',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #071a13 0%, #0d2d22 52%, #114235 100%)',
  },
  {
    id: 'lavender',
    name: 'ม่วงลาเวนเดอร์',
    englishName: 'Lavender',
    description: 'นุ่มนวล สร้างสรรค์ มีสมาธิและสง่างาม',
    swatchLight: '#ede9fe',
    swatchMid: '#c4b5fd',
    swatchPrimary: '#6d28d9',
    swatchGradient: 'linear-gradient(135deg, #ddd6fe 0%, #a78bfa 48%, #6d28d9 100%)',
    borderHex: '#c4b5fd',
    accentTextHex: '#6d28d9',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #1b1035 0%, #2b1954 52%, #3b2472 100%)',
  },
  {
    id: 'rose',
    name: 'ชมพูโรส',
    englishName: 'Rose Pink',
    description: 'อบอุ่น อ่อนโยน มีชีวิตชีวาอย่างลงตัว',
    swatchLight: '#ffe4e6',
    swatchMid: '#fda4af',
    swatchPrimary: '#be123c',
    swatchGradient: 'linear-gradient(135deg, #fecdd3 0%, #fb7185 48%, #be123c 100%)',
    borderHex: '#fda4af',
    accentTextHex: '#be123c',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #2f0c1a 0%, #4a1329 52%, #641c38 100%)',
  },
  {
    id: 'peach',
    name: 'พีชครีมอุ่น',
    englishName: 'Warm Peach',
    description: 'โทนครีมพีชละมุนตา เป็นมิตรและอบอุ่นใจ',
    swatchLight: '#ffedd5',
    swatchMid: '#fdba74',
    swatchPrimary: '#c2410c',
    swatchGradient: 'linear-gradient(135deg, #fed7aa 0%, #fb923c 48%, #c2410c 100%)',
    borderHex: '#fdba74',
    accentTextHex: '#c2410c',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #2d1709 0%, #47240d 52%, #613314 100%)',
  },
  {
    id: 'turquoise',
    name: 'เทอร์ควอยซ์',
    englishName: 'Turquoise',
    description: 'สดชื่น โปร่งใส เฉียบคมสไตล์วิชาการ',
    swatchLight: '#ccfbf1',
    swatchMid: '#5eead4',
    swatchPrimary: '#0f766e',
    swatchGradient: 'linear-gradient(135deg, #99f6e4 0%, #2dd4bf 48%, #0f766e 100%)',
    borderHex: '#5eead4',
    accentTextHex: '#0f766e',
    canvasLightHex: '#f1f5f9',
    canvasDarkHex: '#0f172a',
    heroGradient: 'linear-gradient(135deg, #072024 0%, #0c3339 52%, #10484e 100%)',
  },
];

const ACTIVE_THEME_CACHE_KEY = 'edusheet_active_theme';
const TEACHER_THEME_CACHE_PREFIX = 'edusheet_teacher_theme_';

export function isValidPastelTheme(value: unknown): value is PastelThemeId {
  return (
    typeof value === 'string' &&
    (PASTEL_THEME_IDS as string[]).includes(value)
  );
}

export function getPastelThemeMeta(themeId: PastelThemeId): PastelThemePreset {
  return PASTEL_THEMES.find((t) => t.id === themeId) || PASTEL_THEMES[1];
}

export function getCachedActiveTheme(teacherKey?: string): PastelThemeId {
  try {
    if (teacherKey) {
      const perTeacher = localStorage.getItem(
        `${TEACHER_THEME_CACHE_PREFIX}${teacherKey.trim().toUpperCase()}`
      );
      if (isValidPastelTheme(perTeacher)) return perTeacher;
    }
    const globalSaved = localStorage.getItem(ACTIVE_THEME_CACHE_KEY);
    if (isValidPastelTheme(globalSaved)) return globalSaved;
  } catch {
    // Ignore storage restriction errors
  }
  return DEFAULT_PASTEL_THEME;
}

export function setCachedActiveTheme(
  themeId: PastelThemeId,
  teacherKey?: string
): void {
  try {
    localStorage.setItem(ACTIVE_THEME_CACHE_KEY, themeId);
    if (teacherKey && teacherKey.trim()) {
      localStorage.setItem(
        `${TEACHER_THEME_CACHE_PREFIX}${teacherKey.trim().toUpperCase()}`,
        themeId
      );
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export function applyPastelThemeToDom(themeId: PastelThemeId): void {
  if (typeof document === 'undefined') return;
  const resolved = isValidPastelTheme(themeId) ? themeId : DEFAULT_PASTEL_THEME;
  document.documentElement.setAttribute('data-pastel-theme', resolved);
}
