#!/bin/bash
set -e

echo "Running all migrations..."

COMPOSE_FILE=${1:-docker-compose.yml}
DB_USER=${DB_USER:-dev}

for f in migrations/*.sql; do
  echo "  $f"
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d openserve < "$f" 2>/dev/null || true
done

echo "Done."
