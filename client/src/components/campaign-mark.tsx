export function CampaignMark() {
  return (
    <span className="campaign-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <circle cx="24" cy="24" r="18" className="campaign-mark-ring" />
        <path d="M8 32 18.8 20l5.4 6.2L31 16l9 16" className="campaign-mark-mountain" />
        <path d="M12 34c6-2.6 18-2.6 24 0" className="campaign-mark-ground" />
      </svg>
    </span>
  );
}
