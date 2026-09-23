$ErrorActionPreference = "Stop"

Write-Host "=== Verificando herramientas necesarias ==="

function Test-CommandExists {
    param (
        [string]$Command
    )

    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# Verificar winget
if (-not (Test-CommandExists "winget")) {
    Write-Error "winget no está disponible. Instalá App Installer desde Microsoft Store antes de continuar."
    exit 1
}

# kubectl
if (Test-CommandExists "kubectl") {
    Write-Host "kubectl ya está instalado."
}
else {
    Write-Host "Instalando kubectl..."

    winget install --id Kubernetes.kubectl -e --accept-package-agreements --accept-source-agreements
}

# kind
if (Test-CommandExists "kind") {
    Write-Host "kind ya está instalado."
}
else {
    Write-Host "Instalando kind..."

    winget install --id Kubernetes.kind -e --accept-package-agreements --accept-source-agreements
}

Write-Host ""
Write-Host "=== Verificación final ==="

if (Test-CommandExists "kubectl") {
    kubectl version --client
}
else {
    Write-Warning "kubectl fue instalado, pero puede requerir cerrar y abrir la terminal."
}

if (Test-CommandExists "kind") {
    kind version
}
else {
    Write-Warning "kind fue instalado, pero puede requerir cerrar y abrir la terminal."
}

Write-Host ""
Write-Host "Instalación/verificación completada."
Write-Host "Si alguna herramienta recién instalada no aparece, cerrá y abrí PowerShell otra vez."