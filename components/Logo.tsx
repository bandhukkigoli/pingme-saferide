// The "Tag bus" logo: a rounded teal square, a light bag tag with a hole, and a bus front inside.
// Same drawing as public/icon.svg (favicon + PWA icon).
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-label="SafeRide logo" role="img">
      <rect width="96" height="96" rx="22" fill="#0F6E56" />
      <path d="M30 22h36a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" fill="#E1F5EE" />
      <circle cx="48" cy="30" r="4" fill="#0F6E56" />
      <rect x="33" y="42" width="30" height="24" rx="5" fill="#0F6E56" />
      <rect x="37" y="46" width="22" height="9" rx="2" fill="#9FE1CB" />
      <circle cx="39" cy="61" r="2.5" fill="#E1F5EE" />
      <circle cx="57" cy="61" r="2.5" fill="#E1F5EE" />
    </svg>
  );
}
