# PowerShell script sao lưu database trên Windows
param (
    [string]$ContainerName = "pos_postgres_db",
    [string]$DbUser = "postgres",
    [string]$DbName = "posorder"
)

$BackupDir = Join-Path $PSScriptRoot "..\backups"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "pos_backup_$Timestamp.sql"

Write-Host "▶ Đang tiến hành sao lưu database [$DbName]..." -ForegroundColor Cyan

docker exec -t $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists > $BackupFile

if (Test-Path $BackupFile) {
    Write-Host "✅ Đã tạo file sao lưu: $BackupFile" -ForegroundColor Green
} else {
    Write-Host "❌ Sao lưu thất bại!" -ForegroundColor Red
}
