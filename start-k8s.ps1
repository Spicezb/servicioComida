$ErrorActionPreference = "Stop"

$clusterName = "servicio-comida"
$imageName = "servicio-comida-app:local"
$overlayPath = "kubernetes\overlays\local"
$kindConfig = "kubernetes\kind-config.yml"

Write-Host "========================================"
Write-Host " Iniciando entorno Kubernetes"
Write-Host "========================================"
Write-Host ""

# Verificar herramientas
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker no está instalado o no está disponible en PATH."
}

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    throw "kubectl no está instalado o no está disponible en PATH."
}

if (-not (Get-Command kind -ErrorAction SilentlyContinue)) {
    throw "kind no está instalado o no está disponible en PATH."
}

# Verificar que Docker esté corriendo
Write-Host "Verificando Docker..."

docker info *> $null

if ($LASTEXITCODE -ne 0) {
    throw "Docker está instalado, pero Docker Desktop no parece estar corriendo."
}

Write-Host "Docker disponible."
Write-Host ""

# Verificar archivos necesarios
if (-not (Test-Path $kindConfig)) {
    throw "No se encontró el archivo: $kindConfig"
}

if (-not (Test-Path $overlayPath)) {
    throw "No se encontró el overlay: $overlayPath"
}

# 1. Crear cluster si no existe
Write-Host "Verificando cluster kind..."

$clusters = @(kind get clusters)

if ($clusters -notcontains $clusterName) {

    Write-Host "Creando cluster '$clusterName'..."

    kind create cluster --name $clusterName --config $kindConfig

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo crear el cluster '$clusterName'."
    }
}
else {
    Write-Host "El cluster '$clusterName' ya existe."
}

Write-Host ""

# Confirmar que realmente existe
$clusters = @(kind get clusters)

if ($clusters -notcontains $clusterName) {
    throw "El cluster no aparece después de intentar crearlo."
}

Write-Host "Clusters disponibles:"
kind get clusters
Write-Host ""

# 2. Verificar Kubernetes
Write-Host "Verificando nodo Kubernetes..."

kubectl config use-context "kind-$clusterName"

kubectl wait --for=condition=Ready node --all --timeout=120s

if ($LASTEXITCODE -ne 0) {
    throw "El nodo Kubernetes no llegó al estado Ready."
}

kubectl get nodes

Write-Host ""

# 3. Construir imagen
Write-Host "Construyendo imagen Docker '$imageName'..."

docker build -t $imageName .

if ($LASTEXITCODE -ne 0) {
    throw "Falló la construcción de la imagen Docker."
}

Write-Host ""

# 4. Cargar imagen dentro de kind
Write-Host "Cargando imagen en kind..."

kind load docker-image $imageName --name $clusterName

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo cargar la imagen en el cluster kind."
}

Write-Host ""

# 5. Aplicar Kubernetes con Kustomize
Write-Host "Aplicando configuración con Kustomize..."

kubectl apply -k $overlayPath

if ($LASTEXITCODE -ne 0) {
    throw "Falló kubectl apply -k."
}

Write-Host ""

# 6. Esperar PostgreSQL
Write-Host "Esperando PostgreSQL..."

kubectl rollout status deployment/postgres --timeout=180s

if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL no quedó disponible."
}

# 7. Esperar Keycloak
Write-Host "Esperando Keycloak..."

kubectl rollout status deployment/keycloak --timeout=240s

if ($LASTEXITCODE -ne 0) {
    throw "Keycloak no quedó disponible."
}

# 8. Esperar aplicación
Write-Host "Esperando aplicación..."

kubectl rollout status deployment/servicio-comida-app --timeout=180s

if ($LASTEXITCODE -ne 0) {
    throw "La aplicación no quedó disponible."
}

Write-Host ""

# 9. Mostrar estado final
Write-Host "========================================"
Write-Host " Pods"
Write-Host "========================================"

kubectl get pods

Write-Host ""
Write-Host "========================================"
Write-Host " Services"
Write-Host "========================================"

kubectl get services

Write-Host ""
Write-Host "========================================"
Write-Host " PersistentVolumeClaims"
Write-Host "========================================"

kubectl get pvc

Write-Host ""
Write-Host "========================================"
Write-Host " Kubernetes levantado correctamente"
Write-Host "========================================"
Write-Host ""

Write-Host "Aplicacion:"
Write-Host "http://localhost:3000"
Write-Host ""

Write-Host "Health:"
Write-Host "http://localhost:3000/health"
Write-Host ""

Write-Host "Ready:"
Write-Host "http://localhost:3000/ready"
Write-Host ""

Write-Host "Keycloak:"
Write-Host "http://localhost:8080"
Write-Host ""