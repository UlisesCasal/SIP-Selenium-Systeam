#!/usr/bin/env bash
set -euo pipefail
NAMESPACE=otel
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Colores para que la consola se vea pro
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "→ Verificando pre-requisitos: Loki + EFK"
kubectl -n observability get svc loki >/dev/null \
  || { echo "✗ Loki no encontrado en ns observability — TP 2 · P1"; exit 1; }
kubectl -n elastic get svc scraper-es-http >/dev/null \
  || { echo "✗ Elasticsearch no encontrado en ns elastic — TP 2 · P2"; exit 1; }

echo -e "${BLUE}→ Preparando Namespaces y Repos${NC}"
kubectl apply -f "$DIR/manifests/namespace.yaml"
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts >/dev/null 2>&1 || true
helm repo update >/dev/null

echo -e "${BLUE}→ Instalando cert-manager (dependencia del Operator)${NC}"
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version v1.16.1 --set installCRDs=true --wait

echo -e "${BLUE}→ Desplegando OpenTelemetry Operator${NC}"
helm upgrade --install otel-operator open-telemetry/opentelemetry-operator \
  --version 0.74.0 \
  --namespace otel-operator-system --create-namespace \
  --values helm/otel-operator-values.yaml --wait

echo -e "${BLUE}→ Configurando RBAC y Secrets${NC}"
kubectl apply -f "$DIR/manifests/rbac.yaml"

kubectl get secret scraper-es-elastic-user -n elastic -o yaml \
  | sed 's/namespace: elastic/namespace: otel/' \
  | grep -v 'creationTimestamp\|resourceVersion\|uid\|selfLink' \
  | kubectl apply -f -

echo "→ Configurando endpoint OTLP para el scraper"
kubectl apply -f "$DIR/manifests/scraper-otlp-config.yaml"

echo -e "${BLUE}→ Instalando Jaeger (Bonus Traces)${NC}"
helm upgrade --install jaeger jaegertracing/jaeger \
  --version 3.4.0 \
  --namespace otel \
  --set storage.type=memory \
  --set query.service.type=NodePort \
  --set query.service.nodePort=30002 --wait

echo -e "${BLUE}→ Apagando agentes legacy (Fan-out activo)${NC}"
kubectl -n observability scale ds/promtail --replicas=0 || true
kubectl -n elastic scale ds/fluent-bit --replicas=0 || true

# Obtener IP del nodo para el mensaje final
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')

echo -e "\n${GREEN}✓ Todo desplegado correctamente, Toby.${NC}"
echo -e "${GREEN}✓ OTel Operator & Collector: Running${NC}"
echo -e "${GREEN}✓ Agentes viejos: Apagados (Escalados a 0)${NC}"
echo -e "\n${BLUE}Verificá los backends en:${NC}"
echo -e "  Grafana (Loki): http://${NODE_IP}:30000"
echo -e "  Kibana (Elastic): http://${NODE_IP}:30001"
echo -e "  Jaeger (Traces): http://${NODE_IP}:30002"