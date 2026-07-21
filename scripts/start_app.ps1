[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$StopExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDirectory = Join-Path $ProjectRoot "backend"
$FrontendDirectory = Join-Path $ProjectRoot "frontend"
$VirtualEnvPython = Join-Path $BackendDirectory ".venv\Scripts\python.exe"
$BackendPort = 8000
$FrontendPort = 3000

function Find-Executable {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names,

        [Parameter(Mandatory = $true)]
        [string]$InstallHint
    )

    foreach ($name in $Names) {
        $command = Get-Command -Name $name -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1

        if ($null -ne $command) {
            return $command.Source
        }
    }

    throw $InstallHint
}

function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [string[]]$Arguments = @(),

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Polecenie '$Label' zakonczylo sie kodem $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Stop-ProcessTree {
    param(
        [System.Diagnostics.Process]$Process
    )

    if (($null -eq $Process) -or $Process.HasExited) {
        return
    }

    & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
}

function Get-ListeningProcessIds {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $NetstatOutput = & netstat.exe -ano -p tcp
    $Pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"

    $NetstatOutput |
        Select-String -Pattern $Pattern |
        ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
        Sort-Object -Unique
}

function Ensure-PortAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $ProcessIds = @(Get-ListeningProcessIds -Port $Port | Where-Object { $_ -ne $PID })

    if ($ProcessIds.Count -eq 0) {
        return
    }

    if (-not $StopExisting) {
        $PidList = ($ProcessIds -join ", ")
        throw "$Name nie moze wystartowac, bo port $Port jest juz zajety przez PID: $PidList. Zamknij poprzednie uruchomienie albo odpal skrypt z parametrem -StopExisting."
    }

    foreach ($ProcessId in $ProcessIds) {
        $ExistingProcess = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($null -ne $ExistingProcess) {
            Write-Host "Zatrzymywanie procesu na porcie $Port (PID $ProcessId)..." -ForegroundColor Yellow
            Stop-ProcessTree -Process $ExistingProcess
        }
    }
}

function Start-ChildProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $StartInfo.FileName = $FilePath
    $StartInfo.Arguments = $Arguments
    $StartInfo.WorkingDirectory = $WorkingDirectory
    $StartInfo.UseShellExecute = $false
    $StartInfo.CreateNoWindow = $true

    $Process = New-Object System.Diagnostics.Process
    $Process.StartInfo = $StartInfo

    if (-not $Process.Start()) {
        throw "Nie udalo sie uruchomic procesu: $FilePath $Arguments"
    }

    return $Process
}

Write-Host "Games Tracker - uruchamianie" -ForegroundColor Green

$DockerCommand = Find-Executable -Names @("docker.exe", "docker") `
    -InstallHint "Nie znaleziono Docker CLI. Zainstaluj i uruchom Docker Desktop."
$NodeCommand = Find-Executable -Names @("node.exe", "node") `
    -InstallHint "Nie znaleziono Node.js. Zainstaluj Node.js 20 lub nowszy."
$NpmCommand = Find-Executable -Names @("npm.cmd", "npm.exe", "npm") `
    -InstallHint "Nie znaleziono npm. Zainstaluj Node.js 20 lub nowszy."

$PythonCommand = $null
$PythonPrefix = @()

if (Test-Path -LiteralPath $VirtualEnvPython) {
    $PythonCommand = $VirtualEnvPython
}
else {
    $PythonCandidates = @(
        @{ Name = "python.exe"; Prefix = @() },
        @{ Name = "py.exe"; Prefix = @("-3") }
    )

    foreach ($Candidate in $PythonCandidates) {
        $CandidateCommand = Get-Command -Name $Candidate.Name -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1

        if ($null -eq $CandidateCommand) {
            continue
        }

        $CandidatePrefix = @($Candidate.Prefix)
        & $CandidateCommand.Source @CandidatePrefix -c "import sys" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $PythonCommand = $CandidateCommand.Source
            $PythonPrefix = $CandidatePrefix
            break
        }
    }
}

if ($null -eq $PythonCommand) {
    throw "Nie znaleziono Pythona. Zainstaluj Python 3.11 lub nowszy."
}

$PythonVersionText = & $PythonCommand @PythonPrefix -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
if ($LASTEXITCODE -ne 0) {
    throw "Nie udalo sie uruchomic Pythona. Sprawdz jego instalacje."
}
$PythonVersion = [version]($PythonVersionText | Select-Object -Last 1)
if ($PythonVersion -lt [version]"3.11") {
    throw "Wymagany jest Python 3.11 lub nowszy (wykryto $PythonVersion)."
}

$NodeVersionText = & $NodeCommand -p "process.versions.node"
if ($LASTEXITCODE -ne 0) {
    throw "Nie udalo sie uruchomic Node.js. Sprawdz jego instalacje."
}
$NodeVersion = [version]($NodeVersionText | Select-Object -Last 1)
if ($NodeVersion -lt [version]"20.0") {
    throw "Wymagany jest Node.js 20 lub nowszy (wykryto $NodeVersion)."
}

$RootEnv = Join-Path $ProjectRoot ".env"
$ProductionEnv = Join-Path $ProjectRoot ".env.production"
if ((-not (Test-Path -LiteralPath $RootEnv)) -and (-not (Test-Path -LiteralPath $ProductionEnv))) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot ".env.example") -Destination $RootEnv
    Write-Host "Utworzono .env na podstawie .env.example. Uzupelnij w nim potrzebne klucze API." -ForegroundColor Yellow
}

$FrontendEnv = Join-Path $FrontendDirectory ".env.local"
$LocalApiSetting = "NEXT_PUBLIC_API_URL=/api"
if (-not (Test-Path -LiteralPath $FrontendEnv)) {
    Set-Content -LiteralPath $FrontendEnv -Value $LocalApiSetting -Encoding Ascii
    Write-Host "Utworzono frontend/.env.local."
}
else {
    $FrontendEnvContent = Get-Content -LiteralPath $FrontendEnv -Raw
    $MigratedFrontendEnvContent = $FrontendEnvContent `
        -replace '(?m)^NEXT_PUBLIC_API_URL=http://(?:localhost|127\.0\.0\.1):8000/api\s*$', $LocalApiSetting

    if ($MigratedFrontendEnvContent -ne $FrontendEnvContent) {
        Set-Content -LiteralPath $FrontendEnv -Value $MigratedFrontendEnvContent.TrimEnd() -Encoding Ascii
        Write-Host "Zmieniono lokalny adres API na /api (proxy Next.js)." -ForegroundColor Yellow
    }
}

Invoke-ExternalCommand -Label "Sprawdzanie Docker Compose" `
    -FilePath $DockerCommand `
    -Arguments @("compose", "version") `
    -WorkingDirectory $ProjectRoot

if (-not (Test-Path -LiteralPath $VirtualEnvPython)) {
    if ($SkipInstall) {
        throw "Brak backend/.venv. Uruchom skrypt bez parametru -SkipInstall."
    }

    Invoke-ExternalCommand -Label "Tworzenie srodowiska Python" `
        -FilePath $PythonCommand `
        -Arguments ($PythonPrefix + @("-m", "venv", ".venv")) `
        -WorkingDirectory $BackendDirectory
}

if (-not $SkipInstall) {
    Invoke-ExternalCommand -Label "Instalowanie zaleznosci backendu" `
        -FilePath $VirtualEnvPython `
        -Arguments @("-m", "pip", "install", "-r", "requirements.txt") `
        -WorkingDirectory $BackendDirectory

    Invoke-ExternalCommand -Label "Instalowanie zaleznosci frontendu" `
        -FilePath $NpmCommand `
        -Arguments @("install") `
        -WorkingDirectory $FrontendDirectory
}
elseif (-not (Test-Path -LiteralPath (Join-Path $FrontendDirectory "node_modules"))) {
    throw "Brak frontend/node_modules. Uruchom skrypt bez parametru -SkipInstall."
}

Invoke-ExternalCommand -Label "Uruchamianie PostgreSQL" `
    -FilePath $DockerCommand `
    -Arguments @("compose", "up", "-d", "--wait", "--wait-timeout", "90", "postgres") `
    -WorkingDirectory $ProjectRoot

Write-Host "PostgreSQL jest gotowy." -ForegroundColor Green

Invoke-ExternalCommand -Label "Wykonywanie migracji bazy" `
    -FilePath $VirtualEnvPython `
    -Arguments @("-m", "alembic", "upgrade", "head") `
    -WorkingDirectory $BackendDirectory

    Invoke-ExternalCommand -Label "Dodawanie ustawien startowych" `
    -FilePath $VirtualEnvPython `
    -Arguments @("-m", "app.database.seed") `
    -WorkingDirectory $BackendDirectory

$BackendProcess = $null
$FrontendProcess = $null
$NextCli = Join-Path $FrontendDirectory "node_modules\next\dist\bin\next"

if (-not (Test-Path -LiteralPath $NextCli)) {
    throw "Nie znaleziono Next.js w frontend/node_modules. Uruchom skrypt bez parametru -SkipInstall."
}

Ensure-PortAvailable -Port $BackendPort -Name "Backend"
Ensure-PortAvailable -Port $FrontendPort -Name "Frontend"

$NextCache = Join-Path $FrontendDirectory ".next"
if (Test-Path -LiteralPath $NextCache) {
    Write-Host ""
    Write-Host "==> Czyszczenie cache Next.js" -ForegroundColor Cyan
    Remove-Item -LiteralPath $NextCache -Recurse -Force
}

try {
    Write-Host ""
    Write-Host "==> Uruchamianie backendu i frontendu" -ForegroundColor Cyan

    $BackendProcess = Start-ChildProcess `
        -FilePath $VirtualEnvPython `
        -Arguments "-m uvicorn app.main:app --reload --host 0.0.0.0 --port $BackendPort" `
        -WorkingDirectory $BackendDirectory

    $FrontendProcess = Start-ChildProcess `
        -FilePath $NodeCommand `
        -Arguments "`"$NextCli`" dev -H 0.0.0.0 -p $FrontendPort" `
        -WorkingDirectory $FrontendDirectory

    Write-Host ""
    Write-Host "Aplikacja zostala uruchomiona:" -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:$FrontendPort"
    Write-Host "  Backend:  http://localhost:$BackendPort"
    Write-Host "  OpenAPI:  http://localhost:$BackendPort/docs"
    Write-Host ""
    Write-Host "Nacisnij Ctrl+C, aby zatrzymac backend i frontend." -ForegroundColor Yellow

    while ($true) {
        Start-Sleep -Seconds 1

        if ($BackendProcess.HasExited) {
            throw "Backend zakonczyl dzialanie (kod $($BackendProcess.ExitCode))."
        }

        if ($FrontendProcess.HasExited) {
            throw "Frontend zakonczyl dzialanie (kod $($FrontendProcess.ExitCode))."
        }
    }
}
finally {
    Write-Host ""
    Write-Host "Zatrzymywanie aplikacji..." -ForegroundColor Yellow
    Stop-ProcessTree -Process $FrontendProcess
    Stop-ProcessTree -Process $BackendProcess
}
