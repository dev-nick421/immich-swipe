#!/bin/sh
# Runs before nginx starts (official nginx image, /docker-entrypoint.d/) and writes the runtime
# part of the nginx config, included by default.conf.
#
# Built-in Immich proxy: /api/ on this container is forwarded to Immich, so browser and API share
# one origin and Immich needs no CORS headers. Its target is
#   1. IMMICH_URL (runtime env), if set. Only needed when this container must reach Immich under
#      another address than the browser (e.g. http://immich-server:2283 on Immich's Docker
#      network), or with the prebuilt image, which is built without VITE_SERVER_URL;
#   2. otherwise VITE_SERVER_URL from the build, i.e. the same Immich URL the app uses.
# Without either, the proxy is off and the browser calls Immich directly (Immich, or the reverse
# proxy in front of it, must then send CORS headers).
set -eu

ME=$(basename "$0")
OUT_DIR="${IMMICH_SWIPE_NGINX_DIR:-/etc/nginx/immich-swipe}"
OUT_FILE="$OUT_DIR/runtime.conf"

log() {
  echo "$ME: $*"
}

disable_proxy() {
  cat > "$OUT_FILE" <<'EOF'
location ^~ /api/ {
    default_type application/json;
    return 404 '{"message":"The built-in Immich proxy of immich-swipe is disabled. Build with VITE_SERVER_URL or set IMMICH_URL on the container, or use the URL of your Immich server as server URL."}';
}
EOF
  log "built-in Immich proxy disabled: $*"
  exit 0
}

# Accept http(s)://host[:port], tolerate surrounding whitespace, a trailing slash or /api
normalize() {
  value=$(printf '%s' "$1" | tr -d '[:space:]')
  value=${value%/}
  value=${value%/api}
  printf '%s' "${value%/}"
}

if ! mkdir -p "$OUT_DIR" 2>/dev/null || [ ! -w "$OUT_DIR" ]; then
  log "warning: $OUT_DIR is not writable, skipping the built-in Immich proxy"
  exit 0
fi

if [ -n "$(normalize "${IMMICH_URL:-}")" ]; then
  source=IMMICH_URL
  raw=$IMMICH_URL
else
  source=VITE_SERVER_URL
  raw=${VITE_SERVER_URL:-}
fi
url=$(normalize "$raw")

if [ -z "$url" ]; then
  disable_proxy "neither IMMICH_URL nor VITE_SERVER_URL is set, the browser connects to Immich directly (requires CORS headers on Immich)"
fi

if ! printf '%s' "$url" | grep -Eq '^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?$'; then
  if [ "$source" = IMMICH_URL ]; then
    log "error: IMMICH_URL must be scheme, host and optional port, e.g. http://immich-server:2283 (got '$raw')"
    exit 1
  fi
  # e.g. an older workaround that pointed VITE_SERVER_URL at a path of this app
  disable_proxy "VITE_SERVER_URL '$raw' is not a plain Immich URL (scheme, host, optional port); set IMMICH_URL to use the proxy"
fi

# localhost in VITE_SERVER_URL means the browser's machine; inside this container it is the
# container itself. An explicit IMMICH_URL may still use it (e.g. with network_mode: host).
if [ "$source" = VITE_SERVER_URL ] && printf '%s' "$url" | grep -Eq '^https?://(localhost|127\.[0-9.]+|\[::1\])(:[0-9]+)?$'; then
  disable_proxy "VITE_SERVER_URL '$raw' points to localhost, which this container cannot reach; set IMMICH_URL to use the proxy"
fi

# Resolve the Immich host per request instead of once at startup, so nginx starts even if
# Immich is not up yet (and picks up new container IPs).
resolvers=$(awk 'BEGIN { ORS = " " } $1 == "nameserver" { if ($2 ~ /%/) next; if ($2 ~ /:/) print "[" $2 "]"; else print $2 }' /etc/resolv.conf 2>/dev/null || true)
resolvers=${resolvers% }
if [ -z "$resolvers" ]; then
  resolvers=127.0.0.11
fi

cat > "$OUT_FILE" <<EOF
set \$immich_swipe_proxy true;

location ^~ /api/ {
    resolver $resolvers valid=30s ipv6=off;
    set \$immich_upstream $url;
    proxy_pass \$immich_upstream;
    proxy_http_version 1.1;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_ssl_server_name on;

    # Stream originals (videos) instead of buffering them in the container
    proxy_buffering off;
    proxy_request_buffering off;
    client_max_body_size 0;
}
EOF
log "built-in Immich proxy enabled: /api/ -> $url/api/ (from $source, resolver: $resolvers)"
