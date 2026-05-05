#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=observability
: "${GRAFANA_ADMIN_PASSWORD:?Set GRAFANA_ADMIN_PASSWORD before running}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Aplicando Namespace..."
kubectl apply -f "$DIR/manifests/namespace.yaml"

echo "→ Configurando Helm repo..."
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update >/dev/null

echo "→ Secret de admin de Grafana..."
kubectl -n "$NAMESPACE" create secret generic grafana-admin \
  --from-literal=admin-user=admin \
  --from-literal=admin-password="$GRAFANA_ADMIN_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

#echo "→ Aplicando Service NodePort..."
#kubectl apply -f "$DIR/manifests/grafana-nodeport.yaml"

echo "→ Loki (single-binary)..."
helm upgrade --install loki grafana/loki \
  --version 6.16.0 \
  --namespace "$NAMESPACE" \
  --values "$DIR/helm/loki-values.yaml" \
  --wait --timeout 5m

echo "→ Promtail (DaemonSet)..."
helm upgrade --install promtail grafana/promtail \
  --version 6.16.0 \
  --namespace "$NAMESPACE" \
  --values "$DIR/helm/promtail-values.yaml" \
  --wait --timeout 3m

echo "→ Dashboard ConfigMap..."
kubectl -n "$NAMESPACE" create configmap scraper-overview-dashboard \
  --from-file="scraper-overview.json=$DIR/dashboards/scraper-overview.json" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "→ Grafana..."
helm upgrade --install grafana grafana/grafana \
  --version 8.5.0 \
  --namespace "$NAMESPACE" \
  --values "$DIR/helm/grafana-values.yaml" \
  --wait --timeout 3m

mkdir -p "$DIR/screenshots"

echo ""
echo "✓ Loki running"
echo "✓ Promtail running"
echo "✓ Grafana running"
echo "✓ Datasource Loki configurado"
echo "✓ Dashboard 'Scraper Overview' provisionado en carpeta 'SIP 2026'"
echo "→ Abrir http://localhost:30000   (admin / \$GRAFANA_ADMIN_PASSWORD)"
echo "→ Guardar screenshot en: observability/screenshots/hit5-dashboard.png"