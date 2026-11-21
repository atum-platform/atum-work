import type { SVGProps } from "react";

// Atum Work replaces the upstream wordmark with Atum's brand badge: the eclipse
// (apps/desktop/public/atum-mark.svg in the Atum client) on its dark squircle, as the Atum
// client's BrandMark draws it. Fixed brand colours, a hairline rim for dark grounds.
// The export keeps the upstream name so every call site stays untouched.
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14.3" fill="#141311" />
      <g transform="translate(9.5 9.5) scale(0.703)">
        <circle cx="32" cy="32" r="28.5" fill="#EFEEEA" />
        <circle cx="29.5" cy="34.5" r="25.5" fill="#141311" />
        <circle cx="49.5" cy="14.5" r="4.8" fill="#EFEEEA" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.8"
        fill="none"
        stroke="rgba(255, 255, 255, 0.12)"
      />
    </svg>
  );
}
