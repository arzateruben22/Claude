// Stripe's API takes form encoding, with brackets for nesting and indexes for arrays:
//   { line_items: [{ price_data: { unit_amount: 300 } }] }  ->  line_items[0][price_data][unit_amount]=300
// undefined and null values are left out. Pure, no imports: the regression suite tests it from Node.
export function formEncode(o: Record<string, unknown>, prefix = '', out: string[] = []): string {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' && x !== null ? formEncode(x as Record<string, unknown>, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`)));
    else if (typeof v === 'object') formEncode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}
