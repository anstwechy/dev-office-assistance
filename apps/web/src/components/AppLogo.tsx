import { useId, type CSSProperties } from "react";
import { BRAND_NAME } from "../brand";

const MARK_SIZES = { sm: 28, md: 36, lg: 44 } as const;

type Props = {
  variant?: "mark" | "full";
  size?: keyof typeof MARK_SIZES;
  className?: string;
  style?: CSSProperties;
  color?: string;
};

function CairnMark({ px, gradId }: { px: number; gradId: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="32" x2="34" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <g>
        <rect x="4" y="27" width="32" height="7" rx="2.5" fill={`url(#${gradId})`} />
        <rect x="7" y="16" width="26" height="7" rx="2.5" fill="currentColor" opacity={0.88} />
        <rect x="10" y="6" width="20" height="7" rx="2.5" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * Stacked cairn mark: three stones, slightly offset (team trail / wayfinding).
 * Uses currentColor from the wrapper for theme-aware tinting.
 */
export function AppLogo({ variant = "mark", size = "md", className, style, color = "var(--accent)" }: Props) {
  const px = MARK_SIZES[size];
  const gradId = `cairn-g-${useId().replace(/:/g, "")}`;
  const mark = (
    <span style={{ color, display: "inline-flex", lineHeight: 0 }}>
      <CairnMark px={px} gradId={gradId} />
    </span>
  );

  if (variant === "mark") {
    return (
      <span className={className} style={{ display: "inline-flex", lineHeight: 0, ...style }}>
        {mark}
      </span>
    );
  }

  return (
    <span
      className={["app-logo app-logo--full", className].filter(Boolean).join(" ")}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", ...style }}
    >
      {mark}
      <span className="app-logo__word">{BRAND_NAME}</span>
    </span>
  );
}

export { MARK_SIZES };
