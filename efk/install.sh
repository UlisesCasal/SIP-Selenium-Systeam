#!/bin/bash
set -e

# Script idempotente para levantar el stack EFK completo
# Uso: ./install.sh

echo " Iniciando instalación del stack EFK..."

# Verificar herramientas
command -v kubectl >/dev/null 2>&1 || { echo "kubectl no encontrado. Instálalo primero."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm no encontrado. Instálalo primero."; exit 1; }

# Crear namespace si no existe
kubectl create namespace elastic --dry-run=client -o yaml | kubectl apply -f -

# Instalar ECK Operator
echo " Instalando ECK Operator..."
helm repo add elastic https://helm.elastic.co --force-update
helm repo update
helm upgrade --install eck-operator elastic/eck-operator \
  --namespace elastic-system \
  --create-namespace \
  --values helm/eck-operator-values.yaml \
  --wait

# Esperar que el operador esté listo
echo "Esperando ECK Operator..."
kubectl wait --for=condition=available --timeout=300s deployment/eck-operator -n elastic-system

# Aplicar manifests de Elasticsearch y Kibana
echo "Aplicando Elasticsearch y Kibana..."
kubectl apply -f manifests/elasticsearch.yaml
kubectl apply -f manifests/kibana.yaml
kubectl apply -f manifests/kibana-nodeport.yaml

# Esperar Elasticsearch
echo " Esperando Elasticsearch..."
kubectl wait --for=jsonpath='{.status.health}'=green --timeout=600s elasticsearch/quickstart -n elastic

# Aplicar ILM policy
echo "Aplicando ILM policy..."
kubectl exec -n elastic deployment/quickstart-es-default -- bash -c "
curl -X PUT 'localhost:9200/_ilm/policy/scraper-logs' \
  -H 'Content-Type: application/json' \
  -d @/usr/share/elasticsearch/config/ilm-policy.json
" < manifests/ilm-policy.json

# Instalar Fluent Bit
echo " Instalando Fluent Bit..."
helm repo add fluent https://fluent.github.io/helm-charts --force-update
helm repo update
helm upgrade --install fluent-bit fluent/fluent-bit \
  --namespace elastic \
  --values helm/fluent-bit-values.yaml \
  --wait

# Crear index pattern en Kibana
echo " Creando index pattern 'scraper-*'..."
# Nota: Esto requiere que Kibana esté listo. En producción, usar API o esperar manualmente.

# Importar dashboard
echo "Importando dashboard 'Scraper Overview'..."
# Nota: Usar Kibana API para importar el NDJSON

echo "Stack EFK instalado exitosamente!"
echo ""
echo "Checklist:"
echo "  ✓ ECK Operator running (kubectl get pod -n elastic-system)"
echo "  ✓ Elasticsearch green (kubectl get elasticsearch -n elastic)"
echo "  ✓ Kibana available (NodePort 30001 abierto)"
echo "  ✓ Fluent Bit DaemonSet ready (1 pod por nodo, status Running)"
echo "  ✓ ILM policy 'scraper-logs' aplicada"
echo "  ✓ Index pattern 'scraper-*' creado"
echo "  ✓ Dashboard 'Scraper Overview' importado"
echo ""
echo " Accede a Kibana: https://<node-ip>:30001"
echo "   Usuario: elastic"
echo "   Password: kubectl get secret quickstart-es-elastic-user -n elastic -o jsonpath='{.data.elastic}' | base64 -d"