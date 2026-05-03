#!/bin/bash
# Setup script for HIT8 - PostgreSQL + Scraper on k3s/k3d

set -e
echo "=== HIT8 Setup for k3s/k3d ==="

# 1. Build Docker image
echo "1. Building Docker image..."
docker build -t ml-scraper:latest .

# 2. Import to k3d if using k3d
echo "2. Importing image to k3d cluster..."
read -p "Enter k3d cluster name (e.g., sdypp-cluster): " cluster_name
k3d image import ml-scraper:latest -c "$cluster_name"

# 3. Create namespace if not exists
echo "3. Creating namespace..."
kubectl create namespace sip-selenium 2>/dev/null || true

# 4. Apply Kubernetes manifests
echo "4. Applying Kubernetes manifests..."
kubectl apply -f k8s/postgres-secret.yaml -n sip-selenium
kubectl apply -f k8s/postgres-pvc.yaml -n sip-selenium
kubectl apply -f k8s/postgres-service.yaml -n sip-selenium
kubectl apply -f k8s/postgres-statefulset.yaml -n sip-selenium
kubectl apply -f k8s/configmap.yaml -n sip-selenium
kubectl apply -f k8s/migrations-configmap.yaml -n sip-selenium
kubectl apply -f k8s/pvc-scraper-output.yaml -n sip-selenium
kubectl apply -f k8s/cronjob.yaml -n sip-selenium

# 5. Wait for PostgreSQL
echo "5. Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n sip-selenium --timeout=60s

# 6. Run manual test
echo "6. Creating manual test job..."
kubectl create job --from=cronjob/scraper-hourly manual-test -n sip-selenium

echo "=== Setup complete! ==="
echo "Check logs: kubectl logs -l job-name=manual-test -n sip-selenium -c scraper"
