import React from 'react';

interface LogoutIconProps {
  className?: string;
}

export const LogoutIcon: React.FC<LogoutIconProps> = ({ className = 'w-4.5 h-4.5' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Soft Duotone Doorway Backdrop */}
      <path
        d="M7.5 5.25H13.25V18.75H7.5C6.4 18.75 5.5 17.85 5.5 16.75V7.25C5.5 6.15 6.4 5.25 7.5 5.25Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      {/* Rounded Doorway Frame */}
      <path
        d="M14 4.5H7.5C5.84315 4.5 4.5 5.84315 4.5 7.5V16.5C4.5 18.1569 5.84315 19.5 7.5 19.5H14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Subtle Door Handle Accent */}
      <circle cx="8.25" cy="12" r="1" fill="currentColor" fillOpacity="0.6" />
      {/* Animated Exit Arrow */}
      <g className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
        <path
          d="M12.25 12H20.25"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M17.25 8.75L20.5 12L17.25 15.25"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
