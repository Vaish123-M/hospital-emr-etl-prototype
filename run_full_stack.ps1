Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $projectRoot ".runtime"
if (!(Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

$mysqlExe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$mysqlClientExe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
$mysqlBaseDir = "C:/Program Files/MySQL/MySQL Server 8.4"
$nodeDir = "C:\Program Files\nodejs"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"

$env:Path = "$nodeDir;$env:Path"

$mysqlDataDir = "C:\mysql-data-hospital"
$mysqlLogFile = Join-Path $runtimeDir "mysqld.log"
$mysqlErrFile = Join-Path $runtimeDir "mysqld.err.log"
$mysqlPidFile = Join-Path $runtimeDir "mysqld.pid"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend.pid"

function Test-TcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port
    )

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(500)) {
            $client.Close()
            return $false
        }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

if (!(Test-Path $mysqlExe)) {
    throw "MySQL server executable not found at $mysqlExe"
}

if (!(Test-Path $npmCmd)) {
    throw "npm not found at $npmCmd"
}

if (!(Test-Path $venvPython)) {
    throw "Project virtual environment Python not found at $venvPython"
}

if (!(Test-Path $mysqlDataDir)) {
    New-Item -ItemType Directory -Path $mysqlDataDir | Out-Null
    & $mysqlExe --no-defaults --initialize-insecure --basedir="$mysqlBaseDir" --datadir="$mysqlDataDir"
}

if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3306)) {
    $mysqlProcess = Start-Process -FilePath $mysqlExe -ArgumentList @(
        "--no-defaults",
        "--basedir=`"$mysqlBaseDir`"",
        "--datadir=$mysqlDataDir",
        "--port=3306",
        "--bind-address=127.0.0.1",
        "--console"
    ) -WorkingDirectory $projectRoot -RedirectStandardOutput $mysqlLogFile -RedirectStandardError $mysqlErrFile -PassThru
    $mysqlProcess.Id | Set-Content -Path $mysqlPidFile -Encoding ASCII
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-TcpPort -HostName "127.0.0.1" -Port 3306) {
        break
    }
}

if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3306)) {
    throw "MySQL failed to start on port 3306. See $mysqlLogFile"
}

Get-Content (Join-Path $projectRoot "schema.sql") | & $mysqlClientExe -h 127.0.0.1 -P 3306 -u root

if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 8000)) {
    $backendProcess = Start-Process -FilePath $venvPython -ArgumentList @(
        "-m",
        "uvicorn",
        "backend.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000"
    ) -WorkingDirectory $projectRoot -PassThru
    $backendProcess.Id | Set-Content -Path $backendPidFile -Encoding ASCII
}

if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 5173)) {
    $frontendProcess = Start-Process -FilePath $npmCmd -ArgumentList @(
        "run",
        "dev",
        "--",
        "--host",
        "0.0.0.0",
        "--port",
        "5173"
    ) -WorkingDirectory (Join-Path $projectRoot "frontend") -PassThru
    $frontendProcess.Id | Set-Content -Path $frontendPidFile -Encoding ASCII
}

Write-Host "Started MySQL (port 3306), backend (http://localhost:8000), frontend (http://localhost:5173)."
Write-Host "Use stop_full_stack.ps1 to stop the processes launched by this script."