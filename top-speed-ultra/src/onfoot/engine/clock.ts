// The engine facade: the generic part of Lot 57's clock. The hours and the crowd curve are each venue's own
// (engine/schedule.ts); the bar never calls Lot 57's isOpen or crowdShare.
export { DAYS, anaheimDate, pacificOffset, liveClock, fmtClock, parseDay } from '../lot57/clock';
export type { ClockState, CrowdLevel } from '../lot57/clock';
