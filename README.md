# Prerrequisitos cumplidos

A continuación, se presenta la evidencia técnica correspondiente a los cinco puntos requeridos para la validación de la entrega

### 1. Estado de los Nodos (`kubectl get nodes`)

Al ejecutar el comando, se confirma que el nodo del cluster se encuentra en estado **Ready**.

- **Evidencia:**

```bash
PS C:\Users\Usuario\Documents\SD-Y-PP\Kubernetes> kubectl get nodes
NAME                      VERSION         STATUS     AGE           ROLES
k3d-sobel-server-0     v1.31.5+k3s1       Ready      47m   control-plane, master
```

### 2. Despliegue de nginx-test (replicas: 2)

Se desplegó exitosamente el servicio `nginx-test` con dos réplicas funcionales, verificando el acceso mediante `curl localhost:8080`.

- **Evidencia:**

```bash
PS C:\Users\Usuario\Documents\SD-Y-PP\Kubernetes> kubectl port-forward svc/nginx-test 8080:80
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [ :: 1]:8080 -> 80
Handling connection for 8080
```

```bash
PS C:\Users\Usuario> curl http://localhost:8080

Advertencia de seguridad: riesgo de ejecución de script
Invoke-WebRequest analiza el contenido de la página web. El código de script de la página web se puede ejecutar cuando
se analiza la página.
ACCIÓN RECOMENDADA :
Usa el modificador -UseBasicParsing para evitar la ejecución de código de script.

¿Quieres continuar?

[s] Si [o] Sí a todo [N] No [T] No a todo [U] Suspender [?] Ayuda (el valor predeterminado es "N"): S

StatusCode : 200
StatusDescription : OK
Content : <! DOCTYPE html>
          <html>
          <head>
          <title>Welcome to nginx !< /title>
          <style>
          html { color-scheme: light dark; }
          body { width: 35em; margin: 0 auto;
          font-family: Tahoma, Verdana, Arial, sans-serif; }
          </style ...
RawContent: HTTP/1.1 200 OK
            Connection: keep-alive
            Accept-Ranges: bytes
            Content-Length: 896
            Content-Type: text/html
```

### 3. Autoreparación del Deployment

Se verificó la capacidad de recuperación del sistema eliminando un Pod manualmente y observando cómo el Deployment lo recrea de forma automática para mantener el estado deseado.

- **Evidencia:**

```bash
PS C:\Users\Usuario\Documents\SD-Y-PP\Kubernetes> kubectl get pods -l app=nginx-test
NAME                              READY          STATUS            RESTARTS          AGE
nginx-test-786f4f95d-qjgn5         1/1           Running              0             8m27s
nginx-test-786f4f95d-zhp95         1/1           Running              0             5m16s
PS C:\Users\Usuario\Documents\SD-Y-PP\Kubernetes> kubectl delete pod nginx-test-786f4f95d-qjgn5
pod "nginx-test-786f4f95d-qjgn5" deleted from default namespace
PS C:\Users\Usuario\Documents\SD-Y-PP\Kubernetes> kubectl get pods -l app=nginx-test -- watch
NAME                              READY          STATUS            RESTARTS          AGE
nginx-test-786f4f95d-c4qwf         1/1           Running              0              21s
nginx-test-786f4f95d-zhp95         1/1           Running              0             5m51s
```

### 4. Importación de imágenes Docker

Se domina el flujo de trabajo para importar imágenes locales al entorno de ejecución del cluster (`k3d image import` / `k3s ctr images import`).

- **Evidencia:**

```bash
collazo@MacBook-Air-de-naiara mi-proyecto-k3d % docker build -t mi-imagen:latest .
[[+] Building 23.1s (5/5) FINISHED                                                                                            docker:desktop-linux
[ => [internal] load build definition from Dockerfile                                                                                0.0s
[ => => transferring dockerfile: 55B                                                                                                 0.0s
=> [internal] load metadata for docker.io/library/nginx:alpine                                                                      20.0s
=> [internal] load .dockerignore                                                                                                     0.0s
=> => transferring context: 2B                                                                                                       0.0s
=> [1/1] FROM docker.io/library/nginx: alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b8                    2.8s
=> => resolve docker.io/library/nginx: alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b8                    0.0s
=> => sha256:d17f077ada118cc762df373ff803592abf2dfa3ddafaa7381e364dd27a88fca7 4.20MB / 4.20MB                                        0.7s
=> => sha256: a96b658a00feada62d1fac10d4f49ff5da15023f0e29708ff59127bf7b0e03d2 955B / 955B                                           0.7s
=> => sha256:662c8d6f66200adef0cf551c6decc52e200f0a30d11eb042708157398efaeb48 19.72MB / 19.72MB                                      2.7s
=> => sha256:10cbc192f783597fdf87a6e883b139c1b18228e8ee4313665026137d6a31077d 403B / 403B                                            0.9s
=> => sha256:83fbf849ee89c6ab0fe1aadcf6a85dcc275070854ee1ca76ee88eb24d9f524af 1.40kB / 1.40kB                                        0.4s
=> => sha256: a89d14ef5abe21dda8850d86d557cfa12c57a34bdcbe1c782fb851ec0c52b750 628B / 628B                                           0.4s
=> => sha256:634f1d1ce0f777ef20ee9c698a3022175abda8611de03efb010559c7c411f23c 1.21kB / 1.21kB                                        0.5s
=> => sha256:910c2a6cad6dc66c2058f7ef9d3dbb2dfded05a92d6ba4d7ebfc39fc3f74a1e3 1.89MB / 1.89MB                                        1.1s
=> exporting to image                                                                                                                3.0s
=> => exporting layers                                                                                                               0.0s
=> => exporting manifest sha256:ccc264a062f0c22ab0b8966dc1bf6d48f86e09309ab3b07e65b38a2c5c600245                                     0.0s
=> => exporting config sha256:97217db08391f947222f664f7624608a879033ceb8c727b229c8967a5697f7da                                       0.0s
=> => exporting attestation manifest sha256:32d96ca770c0e3da68bd1048950ef940928a2934d9a55819e35af9ebcb80e154                         0.0s
=> => exporting manifest list sha256:0a4d133f1e7f118d9c556841cb2bee7ec932a431b0ce0795b0da832dd9fb8abd                                0.0s
=> => naming to docker.io/library/mi-imagen:latest                                                                                   0.0s
=> => unpacking to docker.io/library/mi-imagen:latest                                                                                3.0s
collazo@MacBook-Air-de-naiara mi-proyecto-k3d % k3d image import mi-imagen:latest -c sobel
INFO[0000] Importing image(s) into cluster 'sobel'
INFO[0000] Saving 1 image(s) from runtime ...
INFO[0001] Importing images into nodes ...
INFO[0001] Importing images from tarball '/k3d/images/k3d-sobel-images-20260429152620.tar' into node 'k3d-sobel-server-0' ...
INFO[0002] Removing the tarball(s) from image volume ...
INFO[0003] Removing k3d-tools node ...
INFO[0003] Successfully imported image(s)
INFO[0003] Successfully imported 1 image(s) into 1 cluster(s)
collazo@MacBook-Air-de-naiara mi-proyecto-k3d % docker exec k3d-sobel-server-0 ctr image list | grep mi-imagen
docker.io/library/mi-imagen:latest                                                                                         application/vnd.oci.
image.index.v1+json                             sha256:0a4d133f1e7f118d9c556841cb2bee7ec932a431b0ce0795b0da832dd9fb8abd 24.6 MiB linux/arm64
                                                                                io.cri-containerd.image=managed
```

# Cómo correr Parte 1 + Parte 2 (Docker, k3s/k3d)

### Parte 1: Docker

1. **Construir la imagen localmente:**

```bash
docker build -t ml-scraper:latest .
```

2. **Ejecutar el contenedor (Prueba local):**

```bash
docker compose up scraper
```

### Parte 2: Kubernetes (k3s/k3d)

1. **Cargar la imagen al cluster:**

```bash
k3d image import ml-scraper:latest -c scraper
```

2. **Aplicar los manifiestos (ConfigMap, PVC, Jobs):**

```bash
kubectl apply -f HIT7/k8s/
```

3. **Validar el estado de los recursos:**

```bash
kubectl get all,pvc
```

## Cómo ejecutar el proyecto: Demostración Hit #7

### Prerrequisitos

- [ ] Docker instalado.
- [ ] kubectl instalado.
- [ ] k3d instalado.
- [ ] Un cluster llamado `scraper` en ejecución.

### Parte 1: Construcción (Docker & k3d)

Construye la imagen localmente:

```bash
docker build -t ml-scraper:latest .
```

Inyecta la imagen en el cluster local:

```bash
k3d image import ml-scraper:latest -c scraper
```

### Parte 2: Despliegue (Kubernetes)

Aplica todos los manifiestos (ConfigMap, PVC, Job, CronJob):

```bash
kubectl apply -f HIT7/k8s/
```

_Nota: El Job de un solo uso (`scraper-once`) comenzará a ejecutarse inmediatamente._

### Verificación y Comandos Útiles

Ver que el pod se está ejecutando:

```bash
kubectl get pods -w
```

Comprobar que el volumen se creó exitosamente:

```bash
kubectl get pvc
```

Ver el Job completado y el CronJob activo:

```bash
kubectl get jobs
kubectl get cronjobs
```

# Autoverificación

- [x] Tests + cobertura ≥ 70 %
- [x] Linter + formatter (los mismos que corren en pre-commit)
- [x] Detección de secrets
- [x] Manifests Kubernetes válidos
- [x] Build de la imagen Docker
- [x] E2E completo en cluster local
- [x] Verificar que los retries del Hit #5 efectivamente disparan
