// A small, consistent line-icon set (24px grid, 1.8 stroke), drawn here so the app has no icon dependency.
export type IconName = "home" | "upload" | "review" | "calendar" | "trophy" | "chart" | "link" | "queue" | "settings" | "copy" | "share" | "download" | "external" | "check" | "spark" | "lock";
const P: Record<IconName, string> = {
  home: "M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z",
  upload: "M12 16V5m0 0-4.5 4.5M12 5l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15",
  review: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  calendar: "M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1ZM4 10.5h16M8.5 4v4M15.5 4v4",
  trophy: "M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H5v1a3 3 0 0 0 3 3M16 6.5h3v1a3 3 0 0 1-3 3M12 13.5V17m-3.5 3h7l-.75-3h-5.5z",
  chart: "M4 20h16M7 16.5v-5M12 16.5V7M17 16.5v-8",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1",
  queue: "M5 7h14M5 12h14M5 17h9",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z",
  copy: "M9 9h10v11H9zM15 9V5H5v11h4",
  share: "M12 15V4m0 0L8 8m4-4 4 4M6 11H5v9h14v-9h-1",
  download: "M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  spark: "M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={P[name]} />
    </svg>
  );
}
