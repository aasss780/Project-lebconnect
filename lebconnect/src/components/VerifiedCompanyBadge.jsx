import { BadgeCheck } from "lucide-react";

export default function VerifiedCompanyBadge({ className = "" }) {
  return (
    <span
      className={`lc-verified-pill ${className}`.trim()}
      title="Verified by LebConnect"
    >
      <BadgeCheck size={14} strokeWidth={2.5} aria-hidden />
      Verified
    </span>
  );
}
