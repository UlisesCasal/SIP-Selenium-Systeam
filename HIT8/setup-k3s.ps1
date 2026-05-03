# Setup script for HIT8 - PostgreSQL + Scraper on k3s/k3d
# Run this script to deploy everything

Write-Host "=== HIT8 Setup for k3s/k3d ===" -ForegroundColor Cyan

# 1. Build Docker image
Write-Host "1. Building Docker image..." -ForegroundColor Yellow
docker build -t ml-scraper:latest .

# 2. Import to k3d if using k3d
Write-Host "2. Importing image to k3d cluster..." -ForegroundColor Yellow
$clusterName = Read-Host "Enter k3d cluster name (e.g., sdypp-cluster)"
k3d image import ml-scraper:latest -c $clusterName

# 3. Apply Kubernetes manifests
Write-Host "3. Applying Kubernetes manifests..." -ForegroundColor Yellow
kubectl apply -f k8s/postgres-secret.yaml -n sip-selenium
kubectl apply -f k8s/postgres-pvc.yaml -n sip-selenium
kubectl apply -f k8s/postgres-service.yaml -n sip-selenium
kubectl apply -f k8s/postgres-statefulset.yaml -n sip-selenium
kubectl apply -f k8s/configmap.yaml -n sip-selenium
kubectl apply -f k8s/migrations-configmap.yaml -n sip-selenium
kubectl apply -f k8s/pvc-scraper-output.yaml -n sip-selenium
kubectl apply -f k8s/cronjob.yaml -n sip-selenium
kubectl apply -f k8s/debug-pod.yaml -n sip-selenium

# 4. Wait for PostgreSQL
Write-Host "4. Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=postgres -n sip-selenium --timeout=60s

# 5. Run manual test
Write-Host "5. Creating manual test job..." -ForegroundColor Yellow
kubectl create job --from=cronjob/scraper-hourly manual-test -n sip-selenium

Write-Host "=== Setup complete! ===" -ForegroundColor Green
Write-Host "Check logs: kubectl logs -l job-name=manual-test -n sip-selenium -c scraper"
