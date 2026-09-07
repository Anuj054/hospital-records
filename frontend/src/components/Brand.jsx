export default function Brand({ size = 20 }) {
  return (
    <div className="sidebar-brand">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="3" y="11" width="13" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="3" y="17" width="9" height="2.5" rx="1.25" fill="currentColor" />
      </svg>
      Hospital Records
    </div>
  );
}
