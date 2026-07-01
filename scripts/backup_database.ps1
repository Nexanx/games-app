param(
  [string]$OutputDir = "backups",
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

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $OutputDir "games-app-$timestamp.sql"

docker compose -f $ComposeFile exec -T $Service pg_dump -U $User -d $Database --clean --if-exists --no-owner --no-acl | Set-Content -Encoding UTF8 -Path $backupPath

Write-Host "Backup zapisany: $backupPath"
