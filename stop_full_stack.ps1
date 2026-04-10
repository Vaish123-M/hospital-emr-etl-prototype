Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $projectRoot ".runtime"

function Stop-ProcessFromPidFile {
    param(
        [Parameter(Mandatory = $true)][string]$PidFile
    )

    if (!(Test-Path $PidFile)) {
        return
    }

    $pidValue = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($pidValue) {
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pidValue -Force
        }
    }

    Remove-Item $PidFile -ErrorAction SilentlyContinue
}

Stop-ProcessFromPidFile -PidFile (Join-Path $runtimeDir "frontend.pid")
Stop-ProcessFromPidFile -PidFile (Join-Path $runtimeDir "backend.pid")
Stop-ProcessFromPidFile -PidFile (Join-Path $runtimeDir "mysqld.pid")

$service = Get-Service -Name "HospitalMySQL" -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Stop-Service -Name "HospitalMySQL"
}

Write-Host "Stopped frontend, backend, and MySQL processes launched by local scripts."