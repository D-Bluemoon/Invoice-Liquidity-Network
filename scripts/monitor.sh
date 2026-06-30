#!/usr/bin/env bash
# scripts/monitor.sh
# Checks health and performance of ILN services: indexer and notifications.
# Exits 0 if all services are healthy, 1 if any check fails.

set -eo pipefail

INDEXER_PORT="${INDEXER_PORT:-3001}"
NOTIFICATIONS_PORT="${NOTIFICATIONS_PORT:-4001}"
INDEXER_URL="http://localhost:${INDEXER_PORT}/health"
NOTIFICATIONS_URL="http://localhost:${NOTIFICATIONS_PORT}/health"

FAILURES=0

check_dependencies() {
    for cmd in curl jq; do
        if ! command -v "$cmd" &> /dev/null; then
            echo "Error: $cmd is required but not installed."
            exit 1
        fi
    done
}

alert() {
    local message="$1"
    echo "🚨 ALERT: $message"
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
        curl -sf -X POST "${ALERT_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"${message}\"}" > /dev/null || true
    fi
}

check_service() {
    local name="$1"
    local url="$2"
    local response
    local status_field

    echo ""
    echo "Checking $name at $url..."

    if response=$(curl -sf --max-time 5 "$url" 2>/dev/null); then
        status_field=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        local db_field
        db_field=$(echo "$response" | jq -r '.db // "unknown"' 2>/dev/null || echo "unknown")
        if [ "$status_field" = "ok" ]; then
            echo "  ✅ $name: healthy (status=$status_field, db=$db_field)"
        else
            echo "  ⚠️  $name: degraded (status=$status_field, db=$db_field)"
            alert "$name health check returned status=$status_field"
            FAILURES=$((FAILURES + 1))
        fi
    else
        echo "  ❌ $name: unreachable"
        alert "$name is unreachable at $url"
        FAILURES=$((FAILURES + 1))
    fi
}

check_performance() {
    local name="$1"
    local url="$2"
    local response_time

    if response_time=$(curl -o /dev/null -s -w "%{time_total}" --max-time 10 "$url" 2>/dev/null); then
        echo "  ⏱  $name response time: ${response_time}s"
    else
        echo "  ⚠️  $name: could not measure response time"
    fi
}

# Main
check_dependencies

echo "================================"
echo "   ILN Service Monitor"
echo "================================"

check_service "Indexer" "$INDEXER_URL"
check_performance "Indexer" "$INDEXER_URL"

check_service "Notifications" "$NOTIFICATIONS_URL"
check_performance "Notifications" "$NOTIFICATIONS_URL"

echo ""
echo "================================"
if [ "$FAILURES" -eq 0 ]; then
    echo "✅ All services healthy."
    exit 0
else
    echo "❌ $FAILURES service(s) failed health checks."
    exit 1
fi
