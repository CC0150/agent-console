/**
 * 产品 Logo 标记，支持多种尺寸。
 */
interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function Logo({ className = "", size = "md" }: LogoProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink-700/50 bg-ink-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_rgba(0,0,0,0.18)] ${SIZES[size]} ${className}`}
    >
      <svg viewBox="0 0 64 64" fill="none" className="h-[66%] w-[66%]" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill="#0d0f12"
          stroke="#262b31"
          strokeWidth="2"
        />
        <path
          d="M18 45 32 17 46 45"
          stroke="#ffbd55"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25 36h14"
          stroke="#ffbd55"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M48 25c4.5 0 7 3.6 6.2 8"
          stroke="#64c9e8"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M46 46l7 4-7 4"
          stroke="#62d7a4"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="18" r="3" fill="#62d7a4" />
      </svg>
    </span>
  );
}
