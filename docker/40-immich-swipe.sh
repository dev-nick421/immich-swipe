#!/bin/sh
# Runs before nginx starts (official nginx image, /docker-entrypoint.d/) and writes the runtime
# part of the nginx config, included by default.conf:
#
#   IMMICH_URL set    -> /api/ is proxied to Immich and the app uses it. Browser and API share one
#                        origin, so Immich needs no CORS headers.
#   IMMICH_URL unset  -> the browser calls the Immich server URL from the login/.env directly
#                        (Immich, or the reverse proxy in front of it, must send CORS headers).
set -eu

ME=$(basename "$0")
OUT_DIR="${IMMICH_SWIPE_NGINX_DIR:-/etc/nginx/immich-swipe}"
OUT_FILE="$OUT_DIR/runtime.conf"

log() {
  echo "$ME: $*"
}

if ! mkdir -p "$OUT_DIR" 2>/dev/null || [ ! -w "$OUT_DIR" ]; then
  log "warning: $OUT_DIR is not writable, skipping the built-in Immich proxy"
  exit 0
fi

# Accept http(s)://host[:port], tolerate surrounding whitespace, a trailing slash or /api
url=$(printf '%s' "${IMMICH_URL:-}" | tr -d '[:space:]')
url=${url%/}
url=${url%/api}
url=${url%/}

if [ -z "$url" ]; then
  cat > "$OUT_FILE" <<'EOF'
location ^~ /api/ {
    default_type application/json;
    return 404 '{"message":"The built-in Immich proxy of immich-swipe is disabled. Set IMMICH_URL on the immich-swipe container, or use the URL of your Immich server as server URL."}';
}
EOF
  log "IMMICH_URL is not set: built-in Immich proxy disabled, the browser connects to Immich directly (requires CORS headers on Immich)"
  exit 0
fi

if ! printf '%s' "$url" | grep -Eq '^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?$'; then
  log "error: IMMICH_URL must be scheme, host and optional port, e.g. http://immich-server:2283 (got '${IMMICH_URL}')"
  exit 1
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
log "built-in Immich proxy enabled: /api/ -> $url/api/ (resolver: $resolvers)"
