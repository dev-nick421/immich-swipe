#!/bin/sh
# Smoke test for the Docker image: runtime config, built-in Immich proxy and SPA serving.
# Usage: docker/smoke-test.sh <image>
set -eu

IMAGE=${1:?usage: $0 <image>}
NAME=immich-swipe-smoke-$$
STUB_DIR=$(mktemp -d)

cleanup() {
  docker rm -f "$NAME-immich" "$NAME-proxy" "$NAME-direct" >/dev/null 2>&1 || true
  docker network rm "$NAME" >/dev/null 2>&1 || true
  rm -rf "$STUB_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*"
  for c in "$NAME-proxy" "$NAME-direct"; do
    echo "--- logs of $c"
    docker logs "$c" 2>&1 | tail -20 || true
  done
  exit 1
}

# GET a path from inside a container (works without published ports / on Docker Desktop)
get() {
  docker exec "$1" wget -qO- --header "x-api-key: smoke-key" "http://127.0.0.1$2"
}

wait_ready() {
  i=0
  until get "$1" /config.js >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -lt 30 ] || fail "$1 did not become ready"
    sleep 1
  done
}

# Stub Immich: echoes path and API key as JSON
cat > "$STUB_DIR/default.conf" <<'EOF'
server {
  listen 2283;
  location /api/ {
    default_type application/json;
    return 200 '{"uri":"$request_uri","key":"$http_x_api_key"}';
  }
}
EOF
chmod 644 "$STUB_DIR/default.conf"

docker network create "$NAME" >/dev/null
docker run -d --name "$NAME-immich" --network "$NAME" --network-alias immich-server \
  -v "$STUB_DIR/default.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine >/dev/null
docker run -d --name "$NAME-proxy" --network "$NAME" -e IMMICH_URL=http://immich-server:2283/ "$IMAGE" >/dev/null
docker run -d --name "$NAME-direct" --network "$NAME" "$IMAGE" >/dev/null
wait_ready "$NAME-proxy"
wait_ready "$NAME-direct"

echo "== IMMICH_URL set"
get "$NAME-proxy" /config.js | grep -q 'proxy: true' || fail "config.js does not enable the proxy"
response=$(get "$NAME-proxy" '/api/server/ping?x=1') || fail "proxy request failed"
echo "$response" | grep -q '"uri":"/api/server/ping?x=1"' || fail "unexpected upstream path: $response"
echo "$response" | grep -q '"key":"smoke-key"' || fail "x-api-key not forwarded: $response"
get "$NAME-proxy" /select-user | grep -q '<div id="app">' || fail "SPA fallback broken"
echo "ok"

echo "== IMMICH_URL unset"
get "$NAME-direct" /config.js | grep -q 'proxy: false' || fail "config.js should disable the proxy"
get "$NAME-direct" / | grep -q 'config.js' || fail "index.html does not load config.js"
if get "$NAME-direct" /api/server/ping >/dev/null 2>&1; then
  fail "/api/ must not be served without IMMICH_URL"
fi
echo "ok"

echo "== invalid IMMICH_URL"
if output=$(docker run --rm -e IMMICH_URL=immich-server:2283 "$IMAGE" 2>&1); then
  fail "container started with an invalid IMMICH_URL"
fi
echo "$output" | grep -q 'error: IMMICH_URL' || fail "missing error message: $output"
echo "ok"

echo "Smoke test passed"
