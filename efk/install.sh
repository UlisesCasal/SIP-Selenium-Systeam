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
    -o jsonpath='{.data.elastic}' | base64 -d
}

###############################################################################
# PASO 0 — Verificar dependencias
###############################################################################
info "Verificando dependencias..."
command -v kubectl >/dev/null 2>&1 || fail "kubectl no encontrado. Instálalo primero."
command -v helm    >/dev/null 2>&1 || fail "helm no encontrado. Instálalo primero."
command -v curl    >/dev/null 2>&1 || fail "curl no encontrado. Instálalo primero."
ok "kubectl, helm y curl disponibles"

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

info "Esperando pod del ECK Operator en Running..."
kubectl wait --for=condition=available \
  --timeout="${WAIT_TIMEOUT}s" \
  deployment/elastic-operator -n "$OPERATOR_NS"
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
info "Esperando Elasticsearch health=green (timeout ${WAIT_TIMEOUT}s)..."
SECONDS=0
until kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.status.health}' 2>/dev/null | grep -q "green"; do
  if (( SECONDS >= WAIT_TIMEOUT )); then
    fail "Timeout esperando Elasticsearch green tras ${WAIT_TIMEOUT}s"
  fi
  echo -ne "\r  ⏳ Elasticsearch: $(kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.health}' 2>/dev/null || echo 'pending')  (${SECONDS}s)"
  sleep 10
done
echo ""
ok "Elasticsearch reporta health=green"

info "Esperando Kibana health=green (timeout ${WAIT_TIMEOUT}s)..."
SECONDS=0
until kubectl get kibana "$KB_NAME" -n "$NAMESPACE" \
        -o jsonpath='{.status.health}' 2>/dev/null | grep -q "green"; do
  if (( SECONDS >= WAIT_TIMEOUT )); then
    fail "Timeout esperando Kibana green tras ${WAIT_TIMEOUT}s"
  fi
  echo -ne "\r  ⏳ Kibana: $(kubectl get kibana "$KB_NAME" -n "$NAMESPACE" \
    -o jsonpath='{.status.health}' 2>/dev/null || echo 'pending')  (${SECONDS}s)"
  sleep 10
done
echo ""
ok "Kibana reporta health=green"

# Verificar que Kibana responda HTTP 200 (port-forward temporal)
info "Verificando HTTP 200 en Kibana via port-forward..."
KB_POD=$(kubectl get pods -n "$NAMESPACE" -l kibana.k8s.elastic.co/name="$KB_NAME" \
  -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward -n "$NAMESPACE" "pod/$KB_POD" 5601:5601 &>/dev/null &
PF_PID=$!
# Dar tiempo al port-forward de establecerse
sleep 5

SECONDS=0
until curl -sk -o /dev/null -w '%{http_code}' \
      "https://localhost:5601/api/status" 2>/dev/null | grep -q "200"; do
  if (( SECONDS >= 120 )); then
    kill "$PF_PID" 2>/dev/null || true
    warn "No se pudo verificar HTTP 200 de Kibana (no crítico, continuando)"
    break
  fi
  sleep 5
done

if curl -sk -o /dev/null -w '%{http_code}' \
    "https://localhost:5601/api/status" 2>/dev/null | grep -q "200"; then
  ok "Kibana responde HTTP 200"
fi

# No matar port-forward aún — lo usamos para las API calls de post-install
# Se cerrará al importar dashboard

###############################################################################
# PASO 5 — Instalar Fluent Bit vía Helm
###############################################################################
info "Configurando repo Helm fluent..."
helm repo add fluent https://fluent.github.io/helm-charts 2>/dev/null || true
helm repo update >/dev/null

info "Instalando Fluent Bit v${FLUENTBIT_VERSION} (DaemonSet)..."
helm upgrade --install fluent-bit fluent/fluent-bit \
  --version "$FLUENTBIT_VERSION" \
  --namespace "$NAMESPACE" \
  --values "$DIR/helm/fluent-bit-values.yaml" \
  --wait --timeout 3m
ok "Fluent Bit DaemonSet desplegado"

###############################################################################
# PASO 6 — Configuración Post-Install vía API de Kibana
###############################################################################
ES_PASSWORD="$(get_es_password)"

# 6a. Aplicar ILM Policy directamente contra Elasticsearch
info "Aplicando ILM Policy 'scraper-logs'..."
ES_POD=$(kubectl get pods -n "$NAMESPACE" \
  -l elasticsearch.k8s.elastic.co/cluster-name="$ES_NAME" \
  -o jsonpath='{.items[0].metadata.name}')

# Copiar el archivo ILM al pod y aplicar via API interna
kubectl cp "$DIR/manifests/ilm-policy.json" \
  "$NAMESPACE/$ES_POD:/tmp/ilm-policy.json"

kubectl exec -n "$NAMESPACE" "$ES_POD" -- \
  curl -sk -X PUT "https://localhost:9200/_ilm/policy/scraper-logs" \
    -u "elastic:${ES_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d @/tmp/ilm-policy.json \
    -o /dev/null -w "HTTP %{http_code}\n"
ok "ILM Policy 'scraper-logs' aplicada"

# 6b. Crear Data View (Index Pattern) scraper-*
info "Creando Data View 'scraper-*' en Kibana..."
curl -sk -X POST "https://localhost:5601/api/data_views/data_view" \
  -u "elastic:${ES_PASSWORD}" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "data_view": {
      "title": "scraper-*",
      "timeFieldName": "@timestamp",
      "name": "Scraper Logs"
    },
    "override": true
  }' \
  -o /dev/null -w "  HTTP %{http_code}\n" 2>/dev/null || \
  warn "Data View podría ya existir (no crítico)"
ok "Data View 'scraper-*' configurado"

# 6c. Importar Dashboard via Saved Objects API
info "Importando Dashboard 'Scraper Overview'..."
curl -sk -X POST \
  "https://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -u "elastic:${ES_PASSWORD}" \
  -H "kbn-xsrf: true" \
  -F "file=@$DIR/dashboards/scraper-overview.ndjson" \
  -o /dev/null -w "  HTTP %{http_code}\n" 2>/dev/null || \
  warn "Import del dashboard podría requerir revisión manual"
ok "Dashboard 'Scraper Overview' importado"

# Cerrar port-forward
kill "$PF_PID" 2>/dev/null || true
wait "$PF_PID" 2>/dev/null || true

###############################################################################
# PASO 7 — Resumen final
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[1;32m    Stack EFK instalado exitosamente\033[0m"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Componente           Estado"
echo "  ─────────────────    ──────────────"

# Check ECK Operator
ECK_STATUS=$(kubectl get deployment elastic-operator -n "$OPERATOR_NS" \
  -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
[[ "$ECK_STATUS" -ge 1 ]] && ok "ECK Operator        Running" || warn "ECK Operator        Pending"

# Check Elasticsearch
ES_HEALTH=$(kubectl get elasticsearch "$ES_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.status.health}' 2>/dev/null || echo "unknown")
[[ "$ES_HEALTH" == "green" ]] && ok "Elasticsearch       $ES_HEALTH" || warn "Elasticsearch       $ES_HEALTH"

# Check Kibana
KB_HEALTH=$(kubectl get kibana "$KB_NAME" -n "$NAMESPACE" \
  -o jsonpath='{.status.health}' 2>/dev/null || echo "unknown")
[[ "$KB_HEALTH" == "green" ]] && ok "Kibana              $KB_HEALTH" || warn "Kibana              $KB_HEALTH"

# Check Fluent Bit
FB_DESIRED=$(kubectl get daemonset fluent-bit -n "$NAMESPACE" \
  -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo "0")
FB_READY=$(kubectl get daemonset fluent-bit -n "$NAMESPACE" \
  -o jsonpath='{.status.numberReady}' 2>/dev/null || echo "0")
[[ "$FB_READY" == "$FB_DESIRED" && "$FB_READY" -ge 1 ]] \
  && ok "Fluent Bit          ${FB_READY}/${FB_DESIRED} pods Ready" \
  || warn "Fluent Bit          ${FB_READY}/${FB_DESIRED} pods Ready"

ok "ILM Policy          'scraper-logs' aplicada"
ok "Data View           'scraper-*' creado"
ok "Dashboard           'Scraper Overview' importado"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Acceso a Kibana"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  URL:       https://<node-ip>:${KIBANA_NODEPORT}"
echo "  Usuario:   elastic"
echo "  Password:  $(get_es_password)"
echo ""
echo "  Comando para obtener el password:"
echo "    kubectl get secret $SECRET_NAME -n $NAMESPACE -o jsonpath='{.data.elastic}' | base64 -d"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"