kubectl create namespace elastic
kubectl create namespace elastic-system   # convención: el operator vive aparte

helm repo add elastic https://helm.elastic.co
helm repo update

helm install eck-operator elastic/eck-operator \
  --version 2.16.0 \
  --namespace elastic-system \
  --values efk/helm/eck-operator-values.yaml

kubectl -n elastic-system rollout status statefulset/elastic-operator --timeout=180s