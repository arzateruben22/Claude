// Lumevina — Evelyn's Google Calendar, the meeting point of her two calendars
//
// GlossGenius syncs with Google Calendar both ways: her GlossGenius
// appointments show up in Google, and events in Google block those times
// in GlossGenius. So the website only has to talk to Google:
//   • before showing a time, it reads her busy times (freeBusy), which
//     include every GlossGenius appointment and anything personal she adds;
//   • when a website booking is paid, it writes an event into her calendar,
//     which GlossGenius then sees as busy.
//
// Secrets (server/README.md → Running both calendars):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//     from server/scripts/google-auth.mjs, run once with her Google account
//   GOOGLE_CALENDAR_ID      where website bookings are written (default "primary")
//   GOOGLE_BUSY_CALENDARS   comma-separated calendars that block times
//                           (default: GOOGLE_CALENDAR_ID). Add the calendar
//                           GlossGenius writes to if it isn't her primary one.
// Without them, nothing here runs and the website goes by its own bookings.

export const TZ = "America/Los_Angeles";
const env = (k: string) => Deno.env.get(k) ?? "";
export const googleOn = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") && env("GOOGLE_REFRESH_TOKEN"));
const calendarId = () => env("GOOGLE_CALENDAR_ID") || "primary";
const busyCalendars = () => (env("GOOGLE_BUSY_CALENDARS") || calendarId()).split(",").map((s) => s.trim()).filter(Boolean);

let token: { value: string; until: number } | null = null;
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
    }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, until: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return token.value;
}

/* a moment, as the studio's local date and minutes after midnight */
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function local(d: Date): { date: string; min: number } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export type Busy = Record<string, [number, number][]>;   // "2026-10-21": [[720, 780], …] local minutes

/* her busy times between two local dates (inclusive), per day */
export async function busyBetween(from: string, to: string): Promise<Busy> {
  const out: Busy = {};
  if (!googleOn()) return out;
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // a day of padding each side; times are bucketed by the studio's own date below
      timeMin: new Date(Date.parse(`${from}T00:00:00Z`) - 864e5).toISOString(),
      timeMax: new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 864e5).toISOString(),
      timeZone: TZ,
      items: busyCalendars().map((id) => ({ id })),
    }),
  });
  if (!res.ok) throw new Error(`google freeBusy ${res.status}`);
  const j = await res.json();
  for (const cal of Object.values(j.calendars ?? {}) as { busy?: { start: string; end: string }[] }[]) {
    for (const b of cal.busy ?? []) {
      const s = local(new Date(b.start)), e = local(new Date(b.end));
      // split anything that runs past midnight into one piece per day
      for (let day = s.date, guard = 0; guard < 40; day = nextDay(day), guard++) {
        const a = day === s.date ? s.min : 0;
        const z = day === e.date ? e.min : 1440;
        if (z > a && day >= from && day <= to) (out[day] ??= []).push([a, z]);
        if (day >= e.date) break;
      }
    }
  }
  return out;
}

/* is this stretch of a day busy in her calendar? */
export async function isBusy(date: string, start: number, dur: number): Promise<boolean> {
  if (!googleOn()) return false;
  const busy = await busyBetween(date, date);
  return (busy[date] ?? []).some(([a, z]) => start < z && start + dur > a);
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;

/* a paid website booking, written into her calendar so GlossGenius sees the time as taken */
export async function addBooking(b: { id: string; date: string; start_min: number; dur_min: number; title: string; note?: string }): Promise<string | null> {
  if (!googleOn()) return null;
  const end = b.start_min + b.dur_min;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: b.title,
      description: (b.note ? b.note + "\n\n" : "") + "Booked on the Lumevina website.",
      start: { dateTime: `${b.date}T${hhmm(b.start_min)}`, timeZone: TZ },
      end: { dateTime: `${end >= 1440 ? nextDay(b.date) : b.date}T${hhmm(end % 1440)}`, timeZone: TZ },
      transparency: "opaque",
      extendedProperties: { private: { lumevina_booking: b.id } },
    }),
  });
  if (!res.ok) throw new Error(`google insert ${res.status}`);
  return (await res.json()).id ?? null;
}

/* a cancelled website booking frees the time in her calendar (and in GlossGenius) */
export async function removeBooking(eventId: string): Promise<void> {
  if (!googleOn() || !eventId) return;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`google delete ${res.status}`);
}
