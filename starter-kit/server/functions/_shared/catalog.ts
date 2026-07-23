// Server-side service catalog — the source of truth for prices/durations.
//
// The server RE-COMPUTES every amount from this map so a client can never set
// its own price. Replace these examples with your real services (ideally
// generate this file from your database or your site's service list).

export const CATALOG: Record<string, { name: string; price_cents: number; dur_min: number }> = {
  "example-service-a": { name: "Example Service A", price_cents: 12000, dur_min: 60 },
  "example-service-b": { name: "Example Service B", price_cents: 8000, dur_min: 45 },
  "example-add-on":    { name: "Example Add-on",    price_cents: 2500, dur_min: 15 },
};

export function priceCents(serviceIds: string[]): number {
  return serviceIds.reduce((sum, id) => sum + (CATALOG[id]?.price_cents ?? 0), 0);
}

export function durationMin(serviceIds: string[]): number {
  return serviceIds.reduce((sum, id) => sum + (CATALOG[id]?.dur_min ?? 0), 0);
}
