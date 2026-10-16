/** A steaming thali bowl. Same drawing as public/icon.svg. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#17352a" />
      <path d="M14 34h36a18 18 0 0 1-36 0z" fill="#e6b45c" />
      <path d="M24 26c0-4 4-4 4-8M32 26c0-4 4-4 4-8M40 26c0-4 4-4 4-8" stroke="#f4f1e8" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
