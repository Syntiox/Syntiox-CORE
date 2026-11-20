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
echo irm https://syntiox.github.io/Syntiox-CORE/install.cmd -OutFile install.cmd ; .\install.cmd
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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $hdr=@{'User-Agent'='Syntiox-CORE-Installer'}; $rel=Invoke-RestMethod -Uri 'https://api.github.com/repos/Syntiox/Syntiox-CORE/releases/latest' -Headers $hdr -TimeoutSec 30; $asset=$rel.assets | Where-Object { $_.name -like 'Syntiox-CORE-Setup-*.exe' } | Select-Object -First 1; if(-not $asset){ throw 'Latest release does not contain Syntiox-CORE-Setup-*.exe.' }; $expectedSha=$null; $sumAsset=$rel.assets | Where-Object { $_.name -eq 'SHA256SUMS.txt' -or $_.name -eq ($asset.name + '.sha256') } | Select-Object -First 1; if($sumAsset){ $sumText=(Invoke-WebRequest -Uri $sumAsset.browser_download_url -Headers $hdr -UseBasicParsing -TimeoutSec 20).Content; foreach($ln in ($sumText -split '\r?\n')){ if($ln.Trim() -match '^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$' -and ([IO.Path]::GetFileName($Matches[2].Trim()) -eq $asset.name)){ $expectedSha=$Matches[1].ToLowerInvariant(); break } elseif($sumAsset.name -ne 'SHA256SUMS.txt' -and $ln.Trim() -match '^[0-9a-fA-F]{64}$'){ $expectedSha=$ln.Trim().ToLowerInvariant(); break } } }; if(-not $expectedSha -and $asset.digest -and $asset.digest.StartsWith('sha256:')){ $expectedSha=$asset.digest.Substring(7).Trim().ToLowerInvariant() }; if(-not $expectedSha){ throw 'Release SHA-256 checksum is missing; refusing unverified installer.' }; $tmpSetup=Join-Path $env:TEMP $asset.name; $tmpPart=$tmpSetup + '.part'; try { Write-Host ('Downloading ' + $asset.name + '...') -ForegroundColor Cyan; Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpPart -UseBasicParsing -TimeoutSec 300; if($asset.size -gt 0 -and (Get-Item $tmpPart).Length -ne $asset.size){ throw 'Downloaded installer size mismatch.' }; $actualSha=(Get-FileHash -Path $tmpPart -Algorithm SHA256).Hash.ToLowerInvariant(); if($actualSha -ne $expectedSha){ throw ('SHA-256 checksum mismatch for ' + $asset.name) }; Write-Host ('Verified SHA-256: ' + $actualSha) -ForegroundColor Green; Move-Item -Path $tmpPart -Destination $tmpSetup -Force; Write-Host ('Launching ' + $asset.name + '...') -ForegroundColor Cyan; if($env:INSTALLER_ARGS){ $proc=Start-Process -FilePath $tmpSetup -ArgumentList $env:INSTALLER_ARGS -Wait -PassThru } else { $proc=Start-Process -FilePath $tmpSetup -Wait -PassThru }; exit $proc.ExitCode } finally { if(Test-Path $tmpPart){ Remove-Item -Force $tmpPart -ErrorAction SilentlyContinue }; if(Test-Path $tmpSetup){ Remove-Item -Force $tmpSetup -ErrorAction SilentlyContinue } }"
if errorlevel 1 (
    echo.
    echo [ERROR] Installation failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo Syntiox CORE setup finished.
exit /b 0
