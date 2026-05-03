# Recetario de ejecución

## Requisitos Previos

### Tener un cluster scraper

```bash
k3d cluster create scraper
```

## 1. Construir la imagen Docker (igual que en Infra base)

```bash
docker build -t ml-scraper:latest .
```

## 2. Cargar la imagen en el cluster

Si usás **k3s nativo**:

```bash
docker save ml-scraper:latest -o ml-scraper.tar
sudo k3s ctr images import ml-scraper.tar
rm ml-scraper.tar
```

Si usás **k3d**:

```ba
k3d image import ml-scraper:latest -c scraper
```

## 3. Aplicar todos los manifiestos

```bash
kubectl apply -f HIT7/k8s/
```

## 4. Disparar el Job one-off y seguir los logs

```bash
kubectl get jobs
kubectl logs -l job-name=scraper-once -f
```

## 5. Inspeccionar el PVC y verificar los JSON

```bash
kubectl get pvc
kubectl exec -it $(kubectl get pod -l job-name=scraper-once -o jsonpath='{.items[0].metadata.name}') -- ls /app/output
```

## 6. Verificar el CronJob

```bash
kubectl get cronjobs
kubectl get jobs --watch  # vas a ver corridas cada hora
```

## 7. Cleanup

```bash
kubectl delete -f k8s/
```
