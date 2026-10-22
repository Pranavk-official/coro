#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.dev.yml"

usage() {
  cat <<'EOF'
Usage: dev-start.sh -S [-Sd|-Sb|-Sl] | -h
  -S   db + minio + redis + mailpit up, wait healthy, migrate dev, run dev server
  -Sd  services only, detached (no migrate, no dev server)
  -Sb  pull/build images first, then -S
  -Sl  follow service logs
  -h   this help
EOF
}

wait_healthy() {
  for _ in $(seq 1 30); do
    if $COMPOSE ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then return 0; fi
    sleep 2
  done
  echo "services not healthy" >&2
  return 1
}

case "${1:-}" in
  -h) usage ;;
  -Sd) $COMPOSE up -d db minio redis mailpit ;;
  -Sb) $COMPOSE pull; $COMPOSE build; exec "$0" -S ;;
  -Sl) exec $COMPOSE logs -f ;;
  -S)
    $COMPOSE up -d db minio redis mailpit
    wait_healthy
    (cd .. && bunx prisma migrate dev && bun run dev)
    ;;
  *) usage >&2; exit 1 ;;
esac
