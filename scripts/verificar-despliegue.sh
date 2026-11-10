#!/usr/bin/env bash
# Comprueba que el despliegue quedó bien. Uso:
#   ./scripts/verificar-despliegue.sh https://musica-api.onrender.com https://musica-web.onrender.com
set -u
API="${1:-}"; WEB="${2:-}"
if [ -z "$API" ] || [ -z "$WEB" ]; then
  echo "Uso: $0 <url-de-la-api> <url-del-frontend>"; exit 2
fi
API="${API%/}"; WEB="${WEB%/}"
fallos=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
fallo() { printf '  \033[31mFALLO\033[0m %s\n' "$1"; fallos=$((fallos+1)); }
codigo() { curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$@"; }

echo "1) La API responde y la base de datos está conectada (si estaba dormida puede tardar ~1 minuto)"
c=$(codigo "$API/health"); [ "$c" = "200" ] && ok "GET /health -> 200" || fallo "GET /health -> $c (revisa DATABASE_URL y los logs de Render)"

echo "2) Las rutas de audio exigen sesión"
c=$(codigo "$API/api/audio/tracks"); [ "$c" = "401" ] && ok "GET /api/audio/tracks sin sesión -> 401" || fallo "GET /api/audio/tracks -> $c (se esperaba 401)"
c=$(codigo "$API/admin/overview"); [ "$c" = "401" ] && ok "GET /admin/overview sin sesión -> 401" || fallo "GET /admin/overview -> $c (se esperaba 401)"

echo "3) CORS permite al frontend (si falla, FRONTEND_URL no coincide con la URL real del sitio)"
cab=$(curl -s -i -X OPTIONS --max-time 90 "$API/auth/login" -H "Origin: $WEB" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type")
echo "$cab" | tr -d '\r' | grep -Fixq "access-control-allow-origin: $WEB" && ok "Access-Control-Allow-Origin: $WEB" || fallo "el servidor no permite el origen $WEB"
echo "$cab" | tr -d '\r' | grep -Fixq "access-control-allow-credentials: true" && ok "Access-Control-Allow-Credentials: true" || fallo "faltan credenciales en CORS"

echo "4) El frontend carga y las rutas del navegador funcionan al recargar"
c=$(codigo "$WEB/"); [ "$c" = "200" ] && ok "GET / -> 200" || fallo "GET / -> $c"
c=$(codigo "$WEB/estadisticas"); [ "$c" = "200" ] && ok "GET /estadisticas -> 200 (reescritura a index.html)" || fallo "GET /estadisticas -> $c (falta la regla de reescritura)"

echo
if [ "$fallos" -eq 0 ]; then echo "Todo en orden."; else echo "$fallos comprobación(es) fallaron."; exit 1; fi
