$clusterName = "sservicio-comida"

Write-Host "Eliminando cluster '$clusterName'..."
kind delete cluster --name $clusterName

Write-Host "Cluster eliminado."