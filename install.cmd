@echo off
goto :VERIFY_EXECUTION
:VERIFY_EXECUTION_FAILED
echo.
echo =================================================================
echo [ERROR] This script cannot be run by piping into cmd.
echo =================================================================
echo.
echo Please use the following PowerShell command to install correctly:
echo.
echo irm https://raw.githubusercontent.com/Syntiox/Syntiox-CORE/master/install.cmd -OutFile install.cmd ; .\install.cmd
echo.
exit /b 1

:VERIFY_EXECUTION
setlocal
title Syntiox CORE Installer

echo =================================================================
echo                 Syntiox CORE Installer
echo =================================================================
echo.
echo Fetching latest Syntiox CORE setup from GitHub...

set "INSTALLER_ARGS=%*"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $rel=Invoke-RestMethod -Uri 'https://api.github.com/repos/Syntiox/Syntiox-CORE/releases/latest' -Headers @{'User-Agent'='Syntiox-CORE-Installer'} -TimeoutSec 30; $asset=$rel.assets | Where-Object { $_.name -like 'Syntiox-CORE-Setup-*.exe' } | Select-Object -First 1; if(-not $asset){ throw 'Latest release does not contain Syntiox-CORE-Setup-*.exe.' }; $tmpSetup=Join-Path $env:TEMP $asset.name; try { Write-Host ('Downloading ' + $asset.name + '...') -ForegroundColor Cyan; Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpSetup -UseBasicParsing -TimeoutSec 300; Write-Host ('Launching ' + $asset.name + '...') -ForegroundColor Cyan; if($env:INSTALLER_ARGS){ $proc=Start-Process -FilePath $tmpSetup -ArgumentList $env:INSTALLER_ARGS -Wait -PassThru } else { $proc=Start-Process -FilePath $tmpSetup -Wait -PassThru }; exit $proc.ExitCode } finally { if(Test-Path $tmpSetup){ Remove-Item -Force $tmpSetup -ErrorAction SilentlyContinue } }"
if errorlevel 1 (
    echo.
    echo [ERROR] Installation failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo Syntiox CORE setup finished.
exit /b 0
