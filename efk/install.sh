kubectl create namespace elastic
kubectl create namespace elastic-system   # convención: el operator vive aparte

helm repo add elastic https://helm.elastic.co
helm repo update

helm install eck-operator elastic/eck-operator \
  --version 2.16.0 \
  --namespace elastic-system \
  --values efk/helm/eck-operator-values.yaml

kubectl -n elastic-system rollout status statefulset/elastic-operator --timeout=180s

kubectl apply -f efk/manifests/elasticsearch.yaml

# El cluster pasa por phases: ApplyingChanges → Ready. Tarda 1-3 min en arrancar la JVM.
kubectl -n elastic get elasticsearch scraper -w
# Esperar a HEALTH=green PHASE=Ready

PASSWORD=$(kubectl -n elastic get secret scraper-es-elastic-user \
  -o jsonpath='{.data.elastic}' | base64 -d)

kubectl -n elastic port-forward svc/scraper-es-http 9200:9200 &
sleep 2

curl -k -u "elastic:$PASSWORD" https://localhost:9200/_cluster/health | jq
# Esperado: { "status": "green", "number_of_nodes": 1, ... }

kubectl apply -f efk/manifests/kibana.yaml
kubectl apply -f efk/manifests/kibana-nodeport.yaml

kubectl -n elastic rollout status deployment/scraper-kb --timeout=180s