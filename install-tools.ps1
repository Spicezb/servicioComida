$ErrorActionPreference = "Stop"

Write-Host "=== Verificando herramientas necesarias ==="

function Test-CommandExists {
    param (
        [string]$Command
    )

    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable(
        "Path",
        [System.EnvironmentVariableTarget]::Machine
    )

    $userPath = [System.Environment]::GetEnvironmentVariable(
        "Path",
        [System.EnvironmentVariableTarget]::User
    )

    $env:Path = "$machinePath;$userPath"

    $wingetLinks = "$env:LOCALAPPDATA\Microsoft\WinGet\Links"

    if (Test-Path $wingetLinks) {
        if ($env:Path -notlike "*$wingetLinks*") {
            $env:Path += ";$wingetLinks"
        }
    }
}

# Actualizar PATH al iniciar
Refresh-Path

# Verificar winget
if (-not (Test-CommandExists "winget")) {
    Write-Error "winget no esta disponible. Instala App Installer desde Microsoft Store antes de continuar."
    exit 1
}

# kubectl
if (Test-CommandExists "kubectl") {
    Write-Host "kubectl ya esta instalado."
}
else {
    Write-Host "Instalando kubectl..."

    winget install --id Kubernetes.kubectl -e --accept-package-agreements --accept-source-agreements

    Refresh-Path
}

# kind
if (Test-CommandExists "kind") {
    Write-Host "kind ya esta instalado."
}
else {
    Write-Host "Instalando kind..."

    winget install --id Kubernetes.kind -e --accept-package-agreements --accept-source-agreements

    Refresh-Path
}

Write-Host ""
Write-Host "=== Verificacion final ==="

Refresh-Path

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
Write-Host "Instalacion/verificacion completada."
Write-Host "Si alguna herramienta recien instalada no aparece, cerra y abri PowerShell otra vez."