import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: Partial<SVGProps<SVGSVGElement>> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function BuyNowActionIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} {...props} className={className}>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M10 11h.01" />
      <path d="M14 11h.01" />
    </svg>
  );
}

export function RideActionIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} {...props} className={className}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}

export function CartActionIcon({ className, ...props }: IconProps) {
  return (
    <svg {...baseProps} {...props} className={className}>
      <path d="M3 4h2l1.5 8h10.5l2-5H7.2" />
      <path d="M8.5 16h9" />
      <circle cx="9" cy="19" r="1.25" />
      <circle cx="17" cy="19" r="1.25" />
    </svg>
  );
}
