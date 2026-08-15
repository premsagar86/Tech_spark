const KEYWORD_ICONS = [
  [["vision", "presentation", "ppt"], "presentation"],
  [["brain", "quiz"], "brain"],
  [["code quest", "story"], "book"],
  [["blind", "byte"], "code"],
  [["ideathon", "idea"], "bulb"],
  [["hackathon", "hack"], "laptop"],
];

export function getEventIcon(event) {
  const haystack = `${event.slug ?? ""} ${event.name ?? ""}`.toLowerCase();
  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some((k) => haystack.includes(k))) return icon;
  }
  return "spark";
}

const PATHS = {
  presentation: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  brain: (
    <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5c0 .3.03.58.1.85A2.5 2.5 0 0 0 5 10.25c0 .93.51 1.74 1.26 2.17a2.5 2.5 0 0 0 2.24 3.58H9V4.5ZM15 4.5a2.5 2.5 0 0 1 2.5 2.5c0 .3-.03.58-.1.85A2.5 2.5 0 0 1 19 10.25c0 .93-.51 1.74-1.26 2.17a2.5 2.5 0 0 1-2.24 3.58H15V4.5Z" />
  ),
  book: (
    <path d="M4 5.5c0-.83.67-1.5 1.5-1.5H11v14H5.5A1.5 1.5 0 0 0 4 19.5v-14ZM20 5.5c0-.83-.67-1.5-1.5-1.5H13v14h5.5a1.5 1.5 0 0 1 1.5 1.5v-14Z" />
  ),
  code: <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21h4M8 14a4 4 0 1 1 8 0c0 1.5-.8 2.3-1.5 3-.5.5-.5 1-.5 1H10s0-.5-.5-1c-.7-.7-1.5-1.5-1.5-3Z" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="4" width="16" height="10" rx="1.5" />
      <path d="M2 19h20" />
    </>
  ),
  spark: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M18 18l-3-3M6 18l3-3M18 6l-3 3" />,
};

export default function EventIcon({ event, className = "h-6 w-6" }) {
  const icon = getEventIcon(event);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[icon]}
    </svg>
  );
}
