// Calendar invites without OAuth: an .ics file (Google, Outlook, Apple all import it) plus
// one-click "add to Google / Outlook" links. Appointment times are stored as center-local time;
// centers are in Peru (UTC-5, no DST), so they are converted to UTC by adding 5 hours.

const CENTER_UTC_OFFSET_HOURS = 5

export type CalendarEvent = {
  uid: string
  date: string // YYYY-MM-DD, center-local
  time: string // HH:MM, center-local
  durationMin: number
  title: string
  description: string
  location?: string
}

function toUtc(date: string, time: string, plusMin = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh + CENTER_UTC_OFFSET_HOURS, mm + plusMin))
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// RFC 5545 text escaping and 75-octet line folding.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ')

export function buildIcs(events: CalendarEvent[], calendarName: string): string {
  const now = stamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vanty ABA//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@vanty-aba`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(toUtc(e.date, e.time))}`,
      `DTEND:${stamp(toUtc(e.date, e.time, e.durationMin))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.description)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT1H', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(toUtc(e.date, e.time))}/${stamp(toUtc(e.date, e.time, e.durationMin))}`,
    details: e.description,
    ...(e.location ? { location: e.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: toUtc(e.date, e.time).toISOString(),
    enddt: toUtc(e.date, e.time, e.durationMin).toISOString(),
    body: e.description,
    ...(e.location ? { location: e.location } : {}),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`
}
