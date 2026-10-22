#!/usr/bin/env bash
# What the live server is doing right now: online, in line, the cap, the peak so far, poses relayed and dropped.
set -a; . /etc/oc-live.env 2>/dev/null; set +a
curl -s "http://127.0.0.1:${PORT:-8791}/health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const h=JSON.parse(s);console.log(`online ${h.online}/${h.cap}, in line ${h.queued}, peak ${h.peak}, players signed up ${h.players}, up ${Math.round(h.uptimeS/3600)} h\nposes in ${h.posesIn}, dropped ${h.posesDropped} (${(100*h.posesDropped/Math.max(1,h.posesIn)).toFixed(2)}%), kicked ${h.kicked}, sent ${(h.bytesOut/1e9).toFixed(2)} GB`)})'
echo "machine: $(uptime | sed 's/.*load/load/'), memory $(free -m | awk '/Mem:/ {print $3"/"$2" MB"}')"
