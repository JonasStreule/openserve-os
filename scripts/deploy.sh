#!/bin/bash
set -e

echo "=== OpenServe OS Deployment ==="
echo ""

# Load production env if exists
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '#' | xargs)
fi

# Step 1: Build and start
echo "[1/4] Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo "[2/4] Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "[3/4] Waiting for database..."
sleep 5

# Step 3: Run migrations
echo "[4/4] Running migrations..."
for f in migrations/*.sql; do
  echo "  Running $f..."
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U ${DB_USER:-dev} -d openserve < "$f" 2>/dev/null || true
done

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "  Frontend:  http://localhost"
echo "  Backend:   http://localhost:3000"
echo "  Health:    http://localhost:3000/health"
echo ""
echo "  Logs:      docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:      docker compose -f docker-compose.prod.yml down"
echo ""
