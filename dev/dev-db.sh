#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.dev.yml"

usage() {
  cat <<'EOF'
Usage: dev-db.sh -M [name] | -Mc <name> | -Md | -Mr | -Ms | -G | -B [file] | -U <file> | -Q | -Qs | -Qp | -Qo | -Qm | -Qr | -Qrf | -h
  -M [name]  migrate dev --name + generate
  -Mc <name> migrate dev --create-only
  -Md        migrate deploy
  -Mr        migrate reset (prompt)
  -Ms        prisma db seed
  -G         generate
  -B [file]  pg_dump -Fc to dev/backups/<ts>.dump
  -U <file>  pg_restore --clean --if-exists (prompt)
  -Q         migrate status
  -Qs        prisma studio
  -Qp        psql in container
  -Qo        print MinIO console URL + creds
  -Qm        print Mailpit UI URL (dev mail inbox)
  -Qr        Redis stats + rate-limit block counters (rl:blocked:*)
  -Qrf       delete rate-limit counters + strikes (rl:*, strike:*; prompt; cache:* kept)
  -h         this help
EOF
}

case "${1:-}" in
  -h) usage ;;
  -M) shift; (cd .. && bunx prisma migrate dev --name "${1:-dev}" && bunx prisma generate) ;;
  -Mc) (cd .. && bunx prisma migrate dev --create-only --name "${2:?name required}") ;;
  -Md) (cd .. && bunx prisma migrate deploy) ;;
  -Mr)
    read -r -p "Reset dev database? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted"; exit 0; }
    (cd .. && bunx prisma migrate reset --force)
    ;;
  -Ms) (cd .. && bunx prisma db seed) ;;
  -G) (cd .. && bunx prisma generate) ;;
  -B)
    mkdir -p backups
    out="${2:-backups/$(date +%Y%m%d-%H%M%S).dump}"
    $COMPOSE exec -T db pg_dump -Fc -U app app > "$out"
    echo "wrote $out"
    ;;
  -U)
    file="${2:?file required}"
    read -r -p "Restore $file (cleans existing data)? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted"; exit 0; }
    $COMPOSE exec -T db pg_restore --clean --if-exists -U app -d app < "$file"
    ;;
  -Q) (cd .. && bunx prisma migrate status) ;;
  -Qs) (cd .. && bunx prisma studio) ;;
  -Qp) $COMPOSE exec db psql -U app app ;;
  -Qo) echo "MinIO console: http://localhost:9001  user=minio  password=minio123" ;;
  -Qm) echo "Mailpit UI: http://localhost:8025  (SMTP localhost:1025)" ;;
  -Qr)
    $COMPOSE exec -T redis redis-cli INFO stats | grep -E '^(total_commands_processed|keyspace_hits|keyspace_misses|expired_keys|evicted_keys):'
    $COMPOSE exec -T redis redis-cli INFO memory | grep -E '^used_memory_human:'
    echo "keys: $($COMPOSE exec -T redis redis-cli DBSIZE)"
    echo "blocked (24 h):"
    for k in $($COMPOSE exec -T redis redis-cli --scan --pattern 'rl:blocked:*'); do
      echo "  ${k#rl:blocked:} $($COMPOSE exec -T redis redis-cli GET "$k")"
    done
    ;;
  -Qrf)
    read -r -p "Delete all rate-limit counters and strikes (rl:*, strike:*)? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "aborted"; exit 0; }
    for pattern in 'rl:*' 'strike:*'; do
      $COMPOSE exec -T redis sh -c "redis-cli --scan --pattern '$pattern' | xargs -r redis-cli DEL" >/dev/null
    done
    echo "deleted rl:* and strike:*"
    ;;
  *) usage >&2; exit 1 ;;
esac
