import React from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "small" | "medium" | "large";
  to?: string;
}

const SIZE_MAP = {
  small: {
    icon: "w-10 h-9",
    largeChar: "text-[46px]",
    smallChars: "text-[26px]",
    subText: "text-[8px]",
    lineWidth: "w-[85px]",
  },
  medium: {
    icon: "w-14 h-12",
    largeChar: "text-[64px]",
    smallChars: "text-[34px]",
    subText: "text-[8.5px]",
    lineWidth: "w-[98px]",
  },
  large: {
    icon: "w-16 h-14",
    largeChar: "text-[72px]",
    smallChars: "text-[38px]",
    subText: "text-[9px]",
    lineWidth: "w-[110px]",
  },
};

export default function Logo({ className = "", iconOnly = false, size = "medium", to }: LogoProps) {
  const styles = SIZE_MAP[size];
  const rootClass = `flex items-center gap-2 select-none ${className}`;

  const content = (
    <>
      <div className="shrink-0 flex items-center">
        <svg
          viewBox="0 0 46 40"
          className={`${styles.icon} text-[#111111]`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="left-circle-clip">
              <circle cx="17" cy="20" r="14" />
            </clipPath>
          </defs>
          <circle cx="29" cy="20" r="14" fill="currentColor" clipPath="url(#left-circle-clip)" />
          <circle cx="17" cy="20" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <circle cx="29" cy="20" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </svg>
      </div>

      {!iconOnly && (
        <div className="flex flex-col text-left ml-2 mt-[2px]">
          <div className="flex items-baseline leading-none font-serif tracking-[-0.07em]">
            <span className={`${styles.largeChar} font-normal text-[#111111] leading-[0.65] select-none`}>C</span>
            <span className={`${styles.smallChars} font-normal text-[#111111] select-none leading-none`}>looval</span>
          </div>
          <div className="flex flex-col mt-[4px] items-start ml-[11px]">
            <span className={`${styles.subText} font-bold text-[#333333] uppercase tracking-[0.24em] leading-none select-none`}>
              CAMPUS CONCIERGE
            </span>
            <div className={`${styles.lineWidth} h-[0.75px] bg-[#999999]/60 mt-1.5 self-start ml-[14px]`} />
          </div>
        </div>
      )}
    </>
  );

  return to ? (
    <Link to={to} className={rootClass}>
      {content}
    </Link>
  ) : (
    <div className={rootClass}>
      {content}
    </div>
  );
}
