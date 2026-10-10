#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.dev.yml"

usage() {
  cat <<'EOF'
Usage: dev-stop.sh -R | -Rs | -Rn | -h
  -R   compose down
  -Rs  compose stop
  -Rn  compose down -v (prompt; deletes volumes)
  -h   this help
EOF
}

case "${1:-}" in
  -h) usage ;;
  -R) $COMPOSE down ;;
  -Rs) $COMPOSE stop ;;
  -Rn)
    read -r -p "Delete dev volumes (db + minio data)? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted"; exit 0; }
    $COMPOSE down -v
    ;;
  *) usage >&2; exit 1 ;;
esac
