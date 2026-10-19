#!/bin/sh
# Smoke test for the Docker image: runtime config, built-in Immich proxy and SPA serving.
# Usage: docker/smoke-test.sh <image>
set -eu

IMAGE=${1:?usage: $0 <image>}
NAME=immich-swipe-smoke-$$
STUB_DIR=$(mktemp -d)
CONTAINERS="immich"

cleanup() {
  for c in $CONTAINERS; do
    docker rm -f "$NAME-$c" >/dev/null 2>&1 || true
  done
  docker network rm "$NAME" >/dev/null 2>&1 || true
  rm -rf "$STUB_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

fail() {
  echo "FAIL: $*"
  for c in $CONTAINERS; do
    echo "--- logs of $NAME-$c"
    docker logs "$NAME-$c" 2>&1 | tail -10 || true
  done
  exit 1
}

# start <suffix> [docker run args...]: start the image on the test network
start() {
  suffix=$1
  shift
  CONTAINERS="$CONTAINERS $suffix"
  docker run -d --name "$NAME-$suffix" --network "$NAME" "$@" "$IMAGE" >/dev/null
}

# GET a path from inside a container (works without published ports / on Docker Desktop)
get() {
  docker exec "$NAME-$1" wget -qO- --header "x-api-key: smoke-key" "http://127.0.0.1$2"
}

wait_ready() {
  i=0
  until get "$1" /config.js >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -lt 30 ] || fail "$1 did not become ready"
    sleep 1
  done
}

expect_proxied() {
  get "$1" /config.js | grep -q 'proxy: true' || fail "$1: config.js does not enable the proxy"
  response=$(get "$1" '/api/server/ping?x=1') || fail "$1: proxy request failed"
  echo "$response" | grep -q '"uri":"/api/server/ping?x=1"' || fail "$1: unexpected upstream path: $response"
  echo "$response" | grep -q '"key":"smoke-key"' || fail "$1: x-api-key not forwarded: $response"
}

expect_direct() {
  get "$1" /config.js | grep -q 'proxy: false' || fail "$1: config.js should disable the proxy"
  if get "$1" /api/server/ping >/dev/null 2>&1; then
    fail "$1: /api/ must not be served without the proxy"
  fi
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

# VITE_SERVER_URL is set explicitly everywhere, so a value baked in at build time doesn't interfere
start from-immich-url -e VITE_SERVER_URL= -e IMMICH_URL=http://immich-server:2283/
start from-server-url -e VITE_SERVER_URL=http://immich-server:2283
start override -e VITE_SERVER_URL=http://does-not-exist.invalid:9 -e IMMICH_URL=http://immich-server:2283
start direct -e VITE_SERVER_URL=
start legacy-path -e VITE_SERVER_URL=http://localhost:2293/immich-api
start localhost -e VITE_SERVER_URL=http://localhost:2283
for c in from-immich-url from-server-url override direct legacy-path localhost; do
  wait_ready "$c"
done

echo "== proxy target from IMMICH_URL"
expect_proxied from-immich-url
get from-immich-url /select-user | grep -q '<div id="app">' || fail "SPA fallback broken"
echo "ok"

echo "== proxy target from VITE_SERVER_URL (no IMMICH_URL needed)"
expect_proxied from-server-url
echo "ok"

echo "== IMMICH_URL overrides VITE_SERVER_URL"
expect_proxied override
echo "ok"

echo "== neither set: direct mode"
expect_direct direct
get direct / | grep -q 'config.js' || fail "index.html does not load config.js"
echo "ok"

echo "== unusable VITE_SERVER_URL (path / localhost): container runs, proxy off"
expect_direct legacy-path
expect_direct localhost
echo "ok"

echo "== invalid IMMICH_URL stops the container"
if output=$(docker run --rm -e IMMICH_URL=immich-server:2283 "$IMAGE" 2>&1); then
  fail "container started with an invalid IMMICH_URL"
fi
echo "$output" | grep -q 'error: IMMICH_URL' || fail "missing error message: $output"
echo "ok"

echo "Smoke test passed"
