param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$Service = "postgres",
  [string]$Database = $env:POSTGRES_DB,
  [string]$User = $env:POSTGRES_USER
)

if ([string]::IsNullOrWhiteSpace($Database)) {
  $Database = "games_app"
}

if ([string]::IsNullOrWhiteSpace($User)) {
  $User = "games"
}

if (-not (Test-Path $BackupPath)) {
  throw "Nie znaleziono pliku backupu: $BackupPath"
}

Write-Host "Przywracanie nadpisze dane w bazie '$Database'. Przerwij Ctrl+C, jeśli to pomyłka."
Start-Sleep -Seconds 5

Get-Content -Encoding UTF8 -Path $BackupPath | docker compose -f $ComposeFile exec -T $Service psql -U $User -d $Database -v ON_ERROR_STOP=1

Write-Host "Backup przywrócony z: $BackupPath"
