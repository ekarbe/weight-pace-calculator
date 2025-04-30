import React from 'react';

export function WeightScaleIcon(props: React.SVGProps<SVGSVGElement>) {
  // Destructure className and other props to avoid applying them twice if passed
  const {
    strokeWidth = "2", // Default to a thinner stroke width (e.g., 2)
    stroke = "currentColor",
    fill = "none",
    strokeLinecap = "round",
    strokeLinejoin = "round",
    ...restProps // Capture other props like className, style, aria-hidden etc.
  } = props;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      stroke={stroke}
      strokeWidth={strokeWidth} // Use the potentially overridden or default strokeWidth
      fill={fill}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      {...restProps} // Spread the rest of the props here (includes className etc.)
    >
      {/* Frame */}
      <rect x="10" y="10" width="80" height="80" rx="12" ry="12" />

      {/* Arc */}
      <path d="M 30 48 L 35 25 A 25 25 0 0 1 65 25 L 70 48" />

      {/* Tick marks */}
      <path d="M 50 22 V 28" />
      <path d="M 41 23 L 43 28" />
      <path d="M 59 23 L 57 28" />
      <path d="M 35 25 L 38 30" />
      <path d="M 65 25 L 62 30" />

      {/* Pointer - Keep its specific fill and no stroke */}
      <path d="M 46 48 A 4 4 0 0 1 54 48 L 58 30 Z" fill="currentColor" stroke="none" />

      {/* Added Text Element */}
      <text
        x="50" // Center horizontally in the 100-unit viewBox
        y="70" // Position vertically within the arc (adjust as needed)
        dominantBaseline="middle" // Better vertical centering
        textAnchor="middle" // Center text horizontally at x="50"
        fill="currentColor" // Use theme color
        stroke="none" // No stroke for text
        fontSize="10" // Adjust font size as needed relative to viewBox
        fontWeight="600" // Make it slightly bold
        fontFamily="sans-serif" // Choose a common font
      >
        3:40/km
      </text>
    </svg>
  );
}
