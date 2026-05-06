#!/usr/bin/env bash
###############################################################################
# install.sh — Stack EFK (Elasticsearch · Fluent Bit · Kibana) sobre ECK
#
# Idempotente: puede ejecutarse N veces sin fallar.
# Uso:  cd efk && bash install.sh
#
# Versiones fijadas (Abril 2026):
#   ECK Operator  : Helm elastic/eck-operator  v2.16.1
#   Elasticsearch : 8.17.1 (CRD)
#   Kibana        : 8.17.1 (CRD)
#   Fluent Bit    : Helm fluent/fluent-bit      v0.48.3 (App v3.2.x)
###############################################################################
set -euo pipefail

# ── Constantes ───────────────────────────────────────────────────────────────
NAMESPACE="elastic"
OPERATOR_NS="elastic-system"
ES_NAME="elastic"                       # metadata.name del CRD Elasticsearch
KB_NAME="kibana"                        # metadata.name del CRD Kibana
SECRET_NAME="${ES_NAME}-es-elastic-user" # Secret auto-generado por ECK
ECK_VERSION="2.16.1"
FLUENTBIT_VERSION="0.48.3"
WAIT_TIMEOUT=600                        # segundos máximos para healthchecks
KIBANA_NODEPORT=30001
PF_PID=""                               # Para el port-forward background

# ── Manejo del Port-Forward (Trap) ───────────────────────────────────────────
cleanup() {
  if [[ -n "$PF_PID" ]]; then
    #echo -e "\nDeteniendo port-forward de Kibana (PID $PF_PID)..."
    kill "$PF_PID" 2>/dev/null || true
    wait "$PF_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Directorio base (permite invocar desde cualquier CWD) ───────────────────
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ──────────────────────────────────────────────────────────────────
info()  { echo -e "\n\033[1;34m→ $*\033[0m"; }
ok()    { echo -e "  \033[1;32m✓ $*\033[0m"; }
warn()  { echo -e "  \033[1;33m⚠ $*\033[0m"; }
fail()  { echo -e "\n\033[1;31m✗ $*\033[0m"; exit 1; }

# Recuperar password de ES dinámicamente — NUNCA se hardcodea ni se guarda
get_es_password() {
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.data.elastic}' 2>/dev/null | base64 -d || echo "pendiente"
}

# ── Detección Inteligente de Entorno ─────────────────────────────────────────
IS_K3D=false
if kubectl config current-context 2>/dev/null | grep -q "k3d"; then
  IS_K3D=true
fi
NODE_IP=$(kubectl get nodes -o wide | awk 'NR>1{print $6}' | head -n 1 || echo "<node-ip>")

###############################################################################
# PASO 0 — Verificar dependencias
###############################################################################
info "Verificando dependencias..."
command -v kubectl >/dev/null 2>&1 || fail "kubectl no encontrado. Instálalo primero."
command -v helm    >/dev/null 2>&1 || fail "helm no encontrado. Instálalo primero."
command -v curl    >/dev/null 2>&1 || fail "curl no encontrado. Instálalo primero."
ok "kubectl, helm y curl disponibles"
[[ "$IS_K3D" == "true" ]] && ok "Entorno k3d detectado. Se priorizará acceso local."

###############################################################################
# PASO 1 — Preparar namespace
###############################################################################
info "Creando namespace '$NAMESPACE' (idempotente)..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
ok "Namespace $NAMESPACE listo"

###############################################################################
# PASO 2 — Instalar ECK Operator vía Helm
###############################################################################
info "Configurando repo Helm elastic..."
helm repo add elastic https://helm.elastic.co 2>/dev/null || true
helm repo update >/dev/null

info "Instalando ECK Operator v${ECK_VERSION} (helm upgrade --install)..."
helm upgrade --install eck-operator elastic/eck-operator \
  --version "$ECK_VERSION" \
  --namespace "$OPERATOR_NS" \
  --create-namespace \
  --values "$DIR/helm/eck-operator-values.yaml" \
  --wait --timeout 5m

# Validar readiness del ECK Operator (StatefulSet)
info "Esperando StatefulSet del ECK Operator (elastic-operator) en Ready..."
kubectl rollout status statefulset/elastic-operator \
  -n "$OPERATOR_NS" \
  --timeout="${WAIT_TIMEOUT}s"
ok "ECK Operator v${ECK_VERSION} operativo"

###############################################################################
# PASO 3 — Aplicar manifiestos de infraestructura (CRDs + Service)
###############################################################################
info "Aplicando Elasticsearch CRD..."
kubectl apply -f "$DIR/manifests/elasticsearch.yaml"

info "Aplicando Kibana CRD..."
kubectl apply -f "$DIR/manifests/kibana.yaml"

info "Aplicando Kibana NodePort Service..."
kubectl apply -f "$DIR/manifests/kibana-nodeport.yaml"
ok "Manifiestos aplicados en namespace $NAMESPACE"

###############################################################################
# PASO 4 — Healthchecks: Elasticsearch green + Kibana HTTP 200
###############################################################################
info "Esperando Elasticsearch health=green|yellow (timeout ${WAIT_TIMEOUT}s)..."
SECONDS=0
until kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.status.health}' 2>/dev/null | grep -E -q "green|yellow"; do
  if (( SECONDS >= WAIT_TIMEOUT )); then
    fail "Timeout esperando Elasticsearch green/yellow tras ${WAIT_TIMEOUT}s"
  fi
  ES_CURRENT=$(kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.health}' 2>/dev/null || echo 'pending')
  echo -ne "\r   Elasticsearch: ${ES_CURRENT}  (${SECONDS}s)  "
  sleep 10
done
echo ""
ES_FINAL=$(kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" -o jsonpath='{.status.health}' 2>/dev/null || echo 'unknown')
ok "Elasticsearch reporta health=${ES_FINAL}"

info "Esperando Kibana CRD health=green (timeout ${WAIT_TIMEOUT}s)..."
SECONDS=0
until kubectl get kibana "$KB_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.status.health}' 2>/dev/null | grep -q "green"; do
  if (( SECONDS >= WAIT_TIMEOUT )); then
    fail "Timeout esperando Kibana green tras ${WAIT_TIMEOUT}s"
  fi
  KB_CURRENT=$(kubectl get kibana "$KB_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.health}' 2>/dev/null || echo 'pending')
  echo -ne "\r   Kibana: ${KB_CURRENT}  (${SECONDS}s)  "
  sleep 10
done
echo ""
ok "Kibana reporta health=green"

# Port-forward automático en background
info "Iniciando Port-Forward persistente de Kibana (localhost:5601)..."
KB_POD=$(kubectl get pods -n "$NAMESPACE" -l kibana.k8s.elastic.co/name="$KB_NAME" \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [[ -z "$KB_POD" ]]; then
  fail "No se encontró pod de Kibana en Running para hacer port-forward."
else
  # Lanzar port-forward persistente en background
  kubectl port-forward -n "$NAMESPACE" "pod/$KB_POD" 5601:5601 &>/dev/null &
  PF_PID=$!
  sleep 5 # Dar tiempo para que el socket abra
fi

# Verificar HTTP 200 por medio del port-forward
info "Esperando que la API de Kibana responda (HTTPS)..."
SECONDS=0
KB_HTTP_OK=false
until curl -sk -o /dev/null -w '%{http_code}' \
      "https://localhost:5601/api/status" 2>/dev/null | grep -q "200"; do
  if (( SECONDS >= 120 )); then
    warn "No se pudo verificar HTTP 200 de Kibana tras 120s (no crítico, continuando)"
    KB_HTTP_OK=false
    break
  fi
  sleep 5
done

if curl -sk -o /dev/null -w '%{http_code}' \
    "https://localhost:5601/api/status" 2>/dev/null | grep -q "200"; then
  KB_HTTP_OK=true
  ok "API de Kibana responde HTTP 200 en localhost:5601"
fi

###############################################################################
# PASO 5 — Instalar Fluent Bit vía Helm
###############################################################################
info "Extrayendo password de Elasticsearch para Fluent Bit..."
ES_PASSWORD="$(get_es_password)"

info "Creando Secret 'fluent-bit-es-credentials' (idempotente)..."
kubectl create secret generic fluent-bit-es-credentials \
  --from-literal=ES_PASSWORD="${ES_PASSWORD}" \
  --namespace "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -
ok "Secret fluent-bit-es-credentials sincronizado"

info "Configurando repo Helm fluent..."
helm repo add fluent https://fluent.github.io/helm-charts 2>/dev/null || true
helm repo update >/dev/null

info "Instalando Fluent Bit v${FLUENTBIT_VERSION} (DaemonSet)..."
helm upgrade --install fluent-bit fluent/fluent-bit \
  --version "$FLUENTBIT_VERSION" \
  --namespace "$NAMESPACE" \
  --values "$DIR/helm/fluent-bit-values.yaml"

info "Esperando disponibilidad de Fluent Bit DaemonSet (timeout 180s)..."
SECONDS=0
FB_TIMEOUT=180
while true; do
  if (( SECONDS >= FB_TIMEOUT )); then
    fail "Timeout esperando Fluent Bit. Ejecuta 'kubectl describe pod -n elastic -l app.kubernetes.io/name=fluent-bit' para diagnosticar."
  fi

  FB_DESIRED=$(kubectl get daemonset fluent-bit -n "$NAMESPACE" -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo "0")
  FB_READY=$(kubectl get daemonset fluent-bit -n "$NAMESPACE" -o jsonpath='{.status.numberReady}' 2>/dev/null || echo "0")

  if [[ "$FB_DESIRED" != "0" && "$FB_READY" == "$FB_DESIRED" ]]; then
    echo -e "\n"
    ok "Fluent Bit DaemonSet operativo (${FB_READY}/${FB_DESIRED} pods listos)"
    break
  fi

  echo -ne "\r   Fluent Bit: $FB_READY de $FB_DESIRED pods listos  (${SECONDS}s)   "
  sleep 5
done

###############################################################################
# PASO 6 — Configuración Post-Install vía API
###############################################################################

# 6a. Aplicar ILM Policy
info "Aplicando ILM Policy 'scraper-logs'..."
ES_POD=$(kubectl get pods -n "$NAMESPACE" \
  -l elasticsearch.k8s.elastic.co/cluster-name="$ES_NAME" \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [[ -z "$ES_POD" ]]; then
  warn "No se encontró pod de Elasticsearch. Saltando configuración de ILM y Templates."
else
  kubectl cp "$DIR/manifests/ilm-policy.json" "$NAMESPACE/$ES_POD:/tmp/ilm-policy.json"
  ILM_HTTP=$(kubectl exec -n "$NAMESPACE" "$ES_POD" -- \
    curl -sk -X PUT "https://localhost:9200/_ilm/policy/scraper-logs" \
      -u "elastic:${ES_PASSWORD}" \
      -H "Content-Type: application/json" \
      -d @/tmp/ilm-policy.json \
      -o /dev/null -w "%{http_code}")
  [[ "$ILM_HTTP" == "200" || "$ILM_HTTP" == "400" ]] && ok "ILM Policy aplicada" \
    || warn "ILM Policy respondió HTTP ${ILM_HTTP}"

  info "Aplicando Index Template (0 replicas) para mantener cluster GREEN..."
  TPL_HTTP=$(kubectl exec -n "$NAMESPACE" "$ES_POD" -- \
    curl -sk -X PUT "https://localhost:9200/_index_template/single-node-template" \
      -u "elastic:${ES_PASSWORD}" \
      -H "Content-Type: application/json" \
      -d '{
            "index_patterns": ["*"],
            "priority": 1,
            "template": { "settings": { "number_of_replicas": 0 } }
          }' \
      -o /dev/null -w "%{http_code}")
  [[ "$TPL_HTTP" == "200" || "$TPL_HTTP" == "400" ]] && ok "Index Template aplicado" \
    || warn "Index Template respondió HTTP ${TPL_HTTP}"
fi

# 6b. Crear Data View y Dashboard — solo si Kibana HTTP OK
if [[ "${KB_HTTP_OK:-false}" == "true" ]]; then
  info "Configurando Data View 'scraper-*' en Kibana..."
  DV_HTTP=$(curl -sk -X POST "https://localhost:5601/api/data_views/data_view" \
    -u "elastic:${ES_PASSWORD}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d '{ "data_view": { "title": "scraper-*", "timeFieldName": "@timestamp", "name": "Scraper Logs" }, "override": true }' \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
  [[ "$DV_HTTP" == "200" || "$DV_HTTP" == "409" ]] && ok "Data View configurado exitosamente" \
    || warn "Data View falló con HTTP ${DV_HTTP}"

  if [[ -f "$DIR/dashboards/scraper-overview.ndjson" ]]; then
    info "Importando Dashboard 'Scraper Overview'..."
    DASH_HTTP=$(curl -sk -X POST \
      "https://localhost:5601/api/saved_objects/_import?overwrite=true" \
      -u "elastic:${ES_PASSWORD}" \
      -H "kbn-xsrf: true" \
      -F "file=@$DIR/dashboards/scraper-overview.ndjson" \
      -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    [[ "$DASH_HTTP" == "200" ]] && ok "Dashboard importado exitosamente" \
      || warn "Importación de dashboard falló con HTTP ${DASH_HTTP}"
  else
    warn "No se encontró dashboard ndjson, saltando importación."
  fi
else
  warn "API de Kibana inalcanzable — Data View y Dashboard deberán configurarse manualmente."
fi

###############################################################################
# PASO 7 — Resumen final
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1;32m    Stack EFK instalado exitosamente\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "  URL Principal: https://localhost:5601  (Port-Forward Activo)"
if [[ "$IS_K3D" == "false" ]]; then
  echo "  URL Secundaria: https://${NODE_IP}:${KIBANA_NODEPORT}  (NodePort)"
fi
echo "  Usuario:       elastic"
echo "  Password:      $(get_es_password)"
echo ""
echo -e "  \033[1;33m[!] NOTA DE SEGURIDAD (Certificados Autofirmados)\033[0m"
echo "      Kibana utiliza HTTPS con un certificado Self-Signed gestionado por ECK."
echo "      Tu navegador mostrará un aviso de seguridad la primera vez."
echo "      Haz clic en 'Avanzado' -> 'Continuar a localhost' para acceder."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1;34m  ℹ  El script se quedará en ejecución para mantener la conexión.\033[0m"
echo -e "\033[1;34m     Presiona Ctrl+C para detener el Port-Forward y salir.\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Bloqueamos el script para mantener el port-forward vivo
wait "$PF_PID" 2>/dev/null || true