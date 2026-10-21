#!/usr/bin/env bash
# The OC Ultra live server at a glance: online and in line against the cap, the peak, sign-ups, the feeds.
#   bash server/live-status.sh
H="$(curl -fs http://127.0.0.1:8791/health)" || { echo "live server: not running (sudo systemctl status oc-live)"; exit 0; }
node -e '
const h = JSON.parse(process.argv[1]);
console.log(`live server: ${h.online}/${h.cap} driving, ${h.queued} in line, peak ${h.peak}, ${h.players} signed up, up ${(h.uptimeS / 3600).toFixed(1)} h`);
console.log(`  feeds: weather ${h.feeds.weather}, traffic ${h.feeds.traffic}, ${h.feeds.trends} trends · poses ${h.posesIn} in, ${h.posesDropped} dropped · ${(h.bytesOut / 1e9).toFixed(2)} GB sent`);
if (h.board) console.log(`  online board: ${h.board.players} driver(s) tracked, ${h.board.writes} rows written, ${h.board.posesIgnored} poses ignored (GET /api/board)`);
' "$H"
L="$(curl -fs http://127.0.0.1:8791/api/ladder)" && node -e '
const v = JSON.parse(process.argv[1]), s = v.summary;
console.log(`  this week at a cap of ${v.cap}: full on ${s.fullDays} day(s), ${s.waited} waited in line, CPU peak ${s.cpuPct}% of a core, memory ${s.rssMb} MB, ${s.dropPct}% poses dropped, ${s.gbPerMonth} GB/month pace`);
console.log(v.ready ? `  ready for the next rung: sudo bash server/live-cap.sh ${v.next}` : `  stay at ${v.cap} for now: ${v.reasons.join("; ")}`);
' "$L"
URL="$(tailscale funnel status 2>/dev/null | grep -o 'https://[^ ]*' | head -n 1)"
[ -n "$URL" ] && echo "  public: $URL"
exit 0
