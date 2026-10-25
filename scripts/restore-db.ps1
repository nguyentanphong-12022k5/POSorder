# PowerShell script khôi phục database trên Windows
param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "pos_postgres_db",
    [string]$DbUser = "postgres",
    [string]$DbName = "posorder"
)

if (!(Test-Path $BackupFile)) {
    Write-Host "❌ Không tìm thấy file: $BackupFile" -ForegroundColor Red
    exit 1
}

$Confirm = Read-Host "⚠️ Bạn có chắc chắn muốn ghi đè cơ sở dữ liệu [$DbName] bằng file này không? (nhập 'yes')"
if ($Confirm -ne "yes") {
    Write-Host "Đã hủy thao tác." -ForegroundColor Yellow
    exit 0
}

Write-Host "▶ Đang khôi phục dữ liệu từ $BackupFile..." -ForegroundColor Cyan
Get-Content $BackupFile | docker exec -i $ContainerName psql -U $DbUser -d $DbName

Write-Host "✅ Khôi phục thành công!" -ForegroundColor Green
