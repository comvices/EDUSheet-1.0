import React from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import { PastelThemeId } from '../types';
import { PASTEL_THEMES } from '../utils/themes';

/**
 * Ambient theme-reactive decorative SVG backdrop rendered behind main app views.
 * Purely decorative, pointer-events-none, low opacity so content contrast stays crisp.
 */
export const AmbientThemeBackdrop: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* Top-Right Orbital Botanical & Geometric Constellation */}
      <svg
        viewBox="0 0 460 460"
        fill="none"
        className="absolute -top-24 -right-24 w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] opacity-[0.26] dark:opacity-[0.16] animate-float-slow transition-colors duration-500"
      >
        <defs>
          <radialGradient id="ambientOrb1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--theme-svg-primary)" stopOpacity="0.34" />
            <stop offset="65%" stopColor="var(--theme-svg-secondary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--theme-svg-secondary)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="230" cy="230" r="205" fill="url(#ambientOrb1)" />
        <g className="origin-center animate-orbit-slow" style={{ transformOrigin: '230px 230px' }}>
          <circle
            cx="230"
            cy="230"
            r="168"
            stroke="var(--theme-svg-primary)"
            strokeWidth="1.2"
            strokeDasharray="6 10"
            strokeOpacity="0.55"
          />
          <circle
            cx="230"
            cy="230"
            r="124"
            stroke="var(--theme-svg-secondary)"
            strokeWidth="1"
            strokeDasharray="3 7"
            strokeOpacity="0.6"
          />
          <circle cx="398" cy="230" r="5" fill="var(--theme-svg-primary)" fillOpacity="0.65" />
          <circle cx="106" cy="230" r="4" fill="var(--theme-svg-secondary)" fillOpacity="0.7" />
        </g>
        {/* Delicate Botanical Leaves & Academic Sparkle */}
        <path
          d="M230 120C258 152 266 196 230 230C194 196 202 152 230 120Z"
          stroke="var(--theme-svg-primary)"
          strokeWidth="1.2"
          fill="var(--theme-svg-primary)"
          fillOpacity="0.08"
        />
        <path
          d="M340 230C308 258 264 266 230 230C264 194 308 202 340 230Z"
          stroke="var(--theme-svg-secondary)"
          strokeWidth="1.2"
          fill="var(--theme-svg-secondary)"
          fillOpacity="0.08"
        />
        <path
          d="M168 152L173 163L184 168L173 173L168 184L163 173L152 168L163 163L168 152Z"
          fill="var(--theme-svg-primary)"
          fillOpacity="0.5"
        />
      </svg>

      {/* Bottom-Left Soft Wave Ribbon & Dot Matrix */}
      <svg
        viewBox="0 0 520 320"
        fill="none"
        className="absolute -bottom-16 -left-20 w-[340px] h-[220px] sm:w-[500px] sm:h-[300px] opacity-[0.24] dark:opacity-[0.14] animate-float-reverse transition-colors duration-500"
      >
        <defs>
          <linearGradient id="ambientRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--theme-svg-primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--theme-svg-secondary)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path
          d="M-20 260C65 180 150 285 255 210C340 150 405 185 495 105"
          stroke="url(#ambientRibbonGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M-10 290C80 215 170 305 275 235C360 178 430 215 510 140"
          stroke="var(--theme-svg-secondary)"
          strokeWidth="1.4"
          strokeDasharray="5 8"
          strokeOpacity="0.55"
        />
        {/* Soft Geometric Hexagon & Circles */}
        <polygon
          points="110,145 136,160 136,190 110,205 84,190 84,160"
          stroke="var(--theme-svg-primary)"
          strokeWidth="1.3"
          fill="var(--theme-svg-primary)"
          fillOpacity="0.06"
        />
        <circle cx="215" cy="148" r="14" stroke="var(--theme-svg-secondary)" strokeWidth="1.2" strokeOpacity="0.6" />
        <circle cx="176" cy="208" r="3" fill="var(--theme-svg-primary)" fillOpacity="0.5" />
        <circle cx="196" cy="208" r="3" fill="var(--theme-svg-primary)" fillOpacity="0.35" />
        <circle cx="216" cy="208" r="3" fill="var(--theme-svg-primary)" fillOpacity="0.2" />
      </svg>
    </div>
  );
};

/**
 * Refined SVG overlay ornaments for Hero Banners (Home Hero, Subject Hub, Attendance, Login Cover).
 */
export const HeroSvgOrnaments: React.FC<{ variant?: 'home' | 'classroom' | 'login' }> = ({
  variant = 'home',
}) => {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 320"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className="absolute inset-0 w-full h-full pointer-events-none select-none opacity-80"
    >
      <defs>
        <linearGradient id={`heroWave-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--theme-svg-secondary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--theme-svg-primary)" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Flowing Top-Right Arc */}
      <circle
        cx="720"
        cy="60"
        r="130"
        stroke="var(--theme-svg-secondary)"
        strokeOpacity="0.24"
        strokeWidth="1.2"
        strokeDasharray="6 8"
      />
      <circle
        cx="720"
        cy="60"
        r="86"
        stroke="var(--theme-svg-primary)"
        strokeOpacity="0.28"
        strokeWidth="1"
      />

      {/* Soft Curved Bottom Silk Ribbon */}
      <path
        d="M0 285C165 235 300 315 470 258C605 212 705 250 810 198L810 325L0 325Z"
        fill={`url(#heroWave-${variant})`}
      />
      <path
        d="M0 268C175 218 310 298 485 242C618 200 715 235 810 182"
        stroke="var(--theme-svg-secondary)"
        strokeOpacity="0.32"
        strokeWidth="1.25"
      />

      {/* Subtle Four-Point Sparkle Motifs */}
      <path
        d="M625 82L629 92L639 96L629 100L625 110L621 100L611 96L621 92L625 82Z"
        fill="var(--theme-svg-secondary)"
        fillOpacity="0.45"
      />
      <path
        d="M748 164L751 171L758 174L751 177L748 184L745 177L738 174L745 171L748 164Z"
        fill="var(--theme-svg-primary)"
        fillOpacity="0.5"
      />
      <circle cx="568" cy="48" r="2.5" fill="var(--theme-svg-secondary)" fillOpacity="0.45" />
      <circle cx="678" cy="142" r="2" fill="#ffffff" fillOpacity="0.35" />
    </svg>
  );
};

/**
 * Corner decorative vector flourish for feature cards & modals.
 */
export const CardCornerOrnament: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 120 120"
    fill="none"
    className={`pointer-events-none select-none ${className}`}
  >
    <circle
      cx="100"
      cy="20"
      r="64"
      stroke="var(--theme-svg-primary)"
      strokeOpacity="0.16"
      strokeWidth="1.2"
      strokeDasharray="4 6"
    />
    <circle
      cx="100"
      cy="20"
      r="38"
      fill="var(--theme-svg-secondary)"
      fillOpacity="0.08"
    />
    <path
      d="M72 26L75 32L81 35L75 38L72 44L69 38L63 35L69 32L72 26Z"
      fill="var(--theme-svg-primary)"
      fillOpacity="0.28"
    />
  </svg>
);

interface ThemePalettePickerProps {
  activeTheme: PastelThemeId;
  onSelectTheme: (themeId: PastelThemeId) => void;
  variant?: 'popover' | 'grid' | 'bar';
  isTeacherAccount?: boolean;
  compactLabel?: string;
}

export const ThemePalettePicker: React.FC<ThemePalettePickerProps> = ({
  activeTheme,
  onSelectTheme,
  variant = 'popover',
  isTeacherAccount = false,
  compactLabel,
}) => {
  if (variant === 'bar') {
    return (
      <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/55 dark:bg-emerald-950/30 px-3.5 py-2.5 theme-transition">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-prompt text-slate-700 dark:text-slate-200">
            <Palette className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{compactLabel || 'เลือกโทนสีพาสเทลส่วนตัว'}</span>
          </span>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 font-prompt">
            {PASTEL_THEMES.find((t) => t.id === activeTheme)?.name}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {PASTEL_THEMES.map((preset) => {
            const isSelected = activeTheme === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectTheme(preset.id)}
                title={`${preset.name} (${preset.englishName})`}
                aria-label={`เลือกธีมสี ${preset.name}`}
                aria-pressed={isSelected}
                className={`group flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900/90 border-emerald-600 shadow-xs ring-2 ring-emerald-500/25'
                    : 'bg-white/60 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-800/70 hover:border-emerald-300'
                }`}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shadow-inner ring-1 ring-black/10 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: preset.swatchGradient }}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                </span>
                <span className="text-[9.5px] font-medium text-slate-600 dark:text-slate-300 truncate w-full text-center leading-tight">
                  {preset.name.replace('พาสเทล', '').replace('ครีมอุ่น', '')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {PASTEL_THEMES.map((preset) => {
          const isSelected = activeTheme === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectTheme(preset.id)}
              aria-pressed={isSelected}
              className={`group relative overflow-hidden text-left rounded-2xl p-4 border transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                isSelected
                  ? 'bg-emerald-50/75 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-400 shadow-md ring-2 ring-emerald-500/25'
                  : 'bg-white dark:bg-[var(--theme-surface-dark-elevated)]/80 border-slate-200 dark:border-emerald-950/70 hover:border-emerald-400 dark:hover:border-emerald-700 hover:-translate-y-0.5 shadow-2xs'
              }`}
            >
              {/* Mini UI Preview Strip */}
              <div
                className="h-14 rounded-xl mb-3 p-2.5 flex items-center justify-between relative overflow-hidden border border-black/5"
                style={{ backgroundColor: preset.canvasLightHex }}
              >
                <div
                  className="w-16 h-full rounded-lg flex flex-col justify-center gap-1 px-2 border"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: preset.borderHex,
                  }}
                >
                  <span
                    className="h-1.5 w-8 rounded-full block"
                    style={{ backgroundColor: preset.swatchPrimary }}
                  />
                  <span
                    className="h-1.5 w-11 rounded-full block opacity-55"
                    style={{ backgroundColor: preset.swatchMid }}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="w-7 h-5 rounded-md shadow-xs block"
                    style={{ background: preset.swatchGradient }}
                  />
                  <span
                    className="w-2 h-8 rounded-full block opacity-75"
                    style={{ backgroundColor: preset.swatchMid }}
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: preset.swatchGradient }}
                    />
                    <span className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                      {preset.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // 'popover' variant for top header palette button
  return (
    <div className="w-72 p-3 space-y-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-emerald-950/70">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <Palette className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
              ธีมสีพาสเทลของระบบ
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isTeacherAccount
                ? 'บันทึกลงฐานข้อมูลหลัก PostgreSQL อัตโนมัติ'
                : 'กำหนดโดยผู้ดูแลระบบ (Admin)'}
            </p>
          </div>
        </div>
        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PASTEL_THEMES.map((preset) => {
          const isSelected = activeTheme === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectTheme(preset.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                isSelected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-400 text-emerald-900 dark:text-emerald-100 font-bold shadow-2xs'
                  : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:border-emerald-300'
              }`}
            >
              <span
                className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center ring-1 ring-black/10 shadow-2xs"
                style={{ background: preset.swatchGradient }}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-prompt truncate leading-tight">
                  {preset.name}
                </span>
                <span className="block text-[9.5px] text-slate-400 dark:text-slate-400 truncate">
                  {preset.englishName}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
