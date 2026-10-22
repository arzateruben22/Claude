// Line icons for the rail and the drive HUD, drawn here as inline SVG (no icon font, no image): 24 px, a 1.6 px
// stroke in the current colour. Every one is decoration beside a text label, so it is hidden from screen readers.
const P: Record<string, JSX.Element> = {
  drive: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" /><path d="M3.3 10.6c3 1.2 14.4 1.2 17.4 0M12 14.6V21M9.8 13.6 4.6 17.8M14.2 13.6l5.2 4.2" /></>,
  map: <><path d="m3 6 5.5-2.2L14.5 6 21 3.8V18l-6.5 2.2L8.5 18 3 20.2z" /><path d="M8.5 3.8V18M14.5 6v14.2" /></>,
  garage: <><path d="M3 10.2 12 4l9 6.2V20H3z" /><path d="M7 20v-7h10v7M7 16h10" /></>,
  driver: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
  career: <><path d="M4 20V11M10 20V5M16 20v-9M22 20H2" /></>,
  bests: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8.5 20h7M9.5 17h5" /></>,
  online: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  camera: <><path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z" /><circle cx="12" cy="13" r="3.2" /></>,
  radio: <><rect x="3" y="8" width="18" height="12" rx="2" /><circle cx="8.5" cy="14" r="2.5" /><path d="M14 12h4M14 16h4M7 8l10-4.5" /></>,
  nav: <><path d="m12 2.5 9.5 9.5-9.5 9.5L2.5 12z" /><path d="m9 13 3-3 3 3M12 10v6" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M10.5 18.5h3" /></>,
  go: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5.5 9.3V20h13V9.3M10 20v-5.2h4V20" /></>,
};
export function Ico({ name }: { name: keyof typeof P }) {
  return <svg className="ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;
}
