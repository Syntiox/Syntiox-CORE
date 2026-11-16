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
setlocal ENABLEDELAYEDEXPANSION
title Syntiox CORE Installer

echo =================================================================
echo                 Syntiox CORE Installer
echo =================================================================
echo.

set "TARGET_DIR=%LOCALAPPDATA%\.sh4lu-z\Syntiox CORE"
set "BIN_DIR=%LOCALAPPDATA%\.sh4lu-z\bin"
set "DATA_DIR=%USERPROFILE%\.sh4lu-z\Syntiox CORE"
set "CONFIG_DIR=%DATA_DIR%\config"
set "BRAIN_DIR=%DATA_DIR%\brain"
set "SCRATCH_DIR=%DATA_DIR%\scratch"
set "SKILLS_DIR=%DATA_DIR%\skills"
set "MCP_DIR=%DATA_DIR%\mcp"
set "MCP_SCHEMAS_DIR=%MCP_DIR%\mcp_schemas"
set "BROWSER_PROFILE_DIR=%DATA_DIR%\browser_profile"

echo [1/5] Creating directories...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
if not exist "%BRAIN_DIR%" mkdir "%BRAIN_DIR%"
if not exist "%SCRATCH_DIR%" mkdir "%SCRATCH_DIR%"
if not exist "%SKILLS_DIR%" mkdir "%SKILLS_DIR%"
if not exist "%MCP_DIR%" mkdir "%MCP_DIR%"
if not exist "%MCP_SCHEMAS_DIR%" mkdir "%MCP_SCHEMAS_DIR%"
if not exist "%BROWSER_PROFILE_DIR%" mkdir "%BROWSER_PROFILE_DIR%"
attrib +h "%LOCALAPPDATA%\.sh4lu-z" 2>nul
attrib +h "%USERPROFILE%\.sh4lu-z" 2>nul

call :STOP_RUNNING

echo [2/5] Downloading latest Syntiox CORE release from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $rel=Invoke-RestMethod -Uri 'https://api.github.com/repos/Syntiox/Syntiox-CORE/releases/latest' -Headers @{'User-Agent'='Syntiox-CORE-Installer'} -TimeoutSec 30; $assets=@{}; foreach($a in $rel.assets){ $assets[$a.name]=$a.browser_download_url }; foreach($n in @('syntiox-core.exe','syntioxcore-server.exe','requirements.txt')){ if(-not $assets.ContainsKey($n)){ throw ('Missing release asset: ' + $n) }; Invoke-WebRequest -Uri $assets[$n] -OutFile (Join-Path '%TARGET_DIR%' $n) -UseBasicParsing -TimeoutSec 180 }"
if errorlevel 1 (
    echo [ERROR] Failed to download release binaries from Syntiox/Syntiox-CORE.
    pause
    exit /b 1
)

if not exist "%CONFIG_DIR%\.env" echo. > "%CONFIG_DIR%\.env"

echo [3/5] Setting up Python 3.11 Virtual Environment...
set "VENV_DIR=%TARGET_DIR%\venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
if exist "%VENV_PY%" (
    "%VENV_PY%" -c "import sys, pip; sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>nul
    if errorlevel 1 (
        echo Existing virtual environment is missing pip or not Python 3.11, recreating...
        rmdir /S /Q "%VENV_DIR%"
    )
)

if not exist "%VENV_PY%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; function Find-Py311 { $c=Get-Command 'py' -ErrorAction SilentlyContinue; if($c){ try{ $o=& $c.Source '-3.11' '-c' 'import sys; print(sys.executable) if sys.version_info[:2]==(3,11) else sys.exit(1)' 2>$null; if($LASTEXITCODE -eq 0 -and $o){ return ($o|Select-Object -First 1).Trim() } }catch{} }; $c2=Get-Command 'python' -ErrorAction SilentlyContinue; if($c2){ try{ $o=& $c2.Source '-c' 'import sys; print(sys.executable) if sys.version_info[:2]==(3,11) else sys.exit(1)' 2>$null; if($LASTEXITCODE -eq 0 -and $o){ return ($o|Select-Object -First 1).Trim() } }catch{} }; $p=@(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311*\python.exe') -ErrorAction SilentlyContinue)+@(Get-ChildItem (Join-Path $env:ProgramFiles 'Python311*\python.exe') -ErrorAction SilentlyContinue); foreach($i in $p){ if($i){ return $i.FullName } }; return $null }; $py=Find-Py311; if(-not $py){ Write-Host 'Downloading Python 3.11.9 installer...'; $inst=Join-Path $env:TEMP ('python-3.11.9-amd64-' + [guid]::NewGuid().ToString('N') + '.exe'); Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile $inst -UseBasicParsing -TimeoutSec 180; $proc=Start-Process -FilePath $inst -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_doc=0' -Wait -PassThru; Remove-Item -Force $inst -ErrorAction SilentlyContinue; if($proc.ExitCode -ne 0){ throw ('Python installer failed with code ' + $proc.ExitCode) }; $py=Find-Py311 }; if(-not $py){ throw 'Python 3.11 not found after install.' }; & $py -m venv '%VENV_DIR%'"
    if errorlevel 1 (
        echo [ERROR] Failed to create Python 3.11 virtual environment.
        pause
        exit /b 1
    )
)

echo [4/5] Installing Python dependencies...
"%VENV_PY%" -m pip install -r "%TARGET_DIR%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo [5/5] Configuring 'stx' commands and PATH...
set "PY_HOME="
for /f "tokens=1,* delims==" %%A in ('type "%VENV_DIR%\pyvenv.cfg" 2^>nul') do (
    for /f "tokens=* delims= " %%K in ("%%A") do (
        if /I "%%K"=="home" (
            for /f "tokens=* delims= " %%V in ("%%B") do set "PY_HOME=%%V"
        )
    )
)

set "PATH_PREFIX=%VENV_DIR%\Scripts;%VENV_DIR%\Lib\site-packages\pywin32_system32"
if defined PY_HOME set "PATH_PREFIX=%PY_HOME%;%VENV_DIR%\Scripts;%VENV_DIR%\Lib\site-packages\pywin32_system32"
set "PYTHONPATH_PREFIX=%TARGET_DIR%\venv\Lib\site-packages"
if defined PY_HOME set "PYTHONPATH_PREFIX=%PY_HOME%\Lib;%PY_HOME%\DLLs;%TARGET_DIR%\venv\Lib\site-packages"

(
    echo $ErrorActionPreference = 'Stop'
    echo $ProgressPreference = 'SilentlyContinue'
    echo [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    echo $appDir = '%TARGET_DIR%'
    echo $venvPython = Join-Path $appDir 'venv\Scripts\python.exe'
    echo $desktopExe = Join-Path $appDir 'syntiox-core.exe'
    echo $serverExe = Join-Path $appDir 'syntioxcore-server.exe'
    echo $reqFile = Join-Path $appDir 'requirements.txt'
    echo.
    echo Write-Host 'Stopping running Syntiox CORE processes...' -ForegroundColor Cyan
    echo foreach ^($procName in @^('syntiox-core', 'syntioxcore-server'^)^) {
    echo     Get-Process -Name $procName -ErrorAction SilentlyContinue ^| Stop-Process -Force -ErrorAction SilentlyContinue
    echo }
    echo Get-NetTCPConnection -LocalPort 9999 -State Listen -ErrorAction SilentlyContinue ^| ForEach-Object {
    echo     Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    echo }
    echo Start-Sleep -Milliseconds 800
    echo.
    echo Write-Host 'Checking latest release on Syntiox/Syntiox-CORE...' -ForegroundColor Cyan
    echo $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/Syntiox/Syntiox-CORE/releases/latest' -Headers @{ 'User-Agent' = 'Syntiox-CORE-Updater' } -TimeoutSec 30
    echo $assets = @{}
    echo foreach ^($a in $release.assets^) { $assets[$a.name] = $a.browser_download_url }
    echo.
    echo if ^($assets.ContainsKey^('syntiox-core.exe'^) -and $assets.ContainsKey^('syntioxcore-server.exe'^)^) {
    echo     Invoke-WebRequest -Uri $assets['syntiox-core.exe'] -OutFile $desktopExe -UseBasicParsing -TimeoutSec 180
    echo     Invoke-WebRequest -Uri $assets['syntioxcore-server.exe'] -OutFile $serverExe -UseBasicParsing -TimeoutSec 180
    echo     if ^($assets.ContainsKey^('requirements.txt'^)^) {
    echo         Invoke-WebRequest -Uri $assets['requirements.txt'] -OutFile $reqFile -UseBasicParsing -TimeoutSec 60
    echo         if ^(Test-Path $venvPython^) {
    echo             ^& $venvPython -m pip install -r $reqFile
    echo             if ^($LASTEXITCODE -ne 0^) { throw 'Failed to install updated requirements.' }
    echo         }
    echo     }
    echo     if ^(Test-Path $desktopExe^) { Start-Process -FilePath $desktopExe -WorkingDirectory $appDir }
    echo } else {
    echo     $setupAsset = $release.assets ^| Where-Object { $_.name -like 'Syntiox-CORE-Setup-*.exe' } ^| Select-Object -First 1
    echo     if ^(-not $setupAsset^) { throw 'Release does not contain expected executable assets.' }
    echo     $tmpSetup = Join-Path $env:TEMP $setupAsset.name
    echo     Invoke-WebRequest -Uri $setupAsset.browser_download_url -OutFile $tmpSetup -UseBasicParsing -TimeoutSec 300
    echo     Start-Process -FilePath $tmpSetup -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -Wait
    echo     if ^(Test-Path $tmpSetup^) { Remove-Item -Force $tmpSetup -ErrorAction SilentlyContinue }
    echo }
) > "%BIN_DIR%\stx-update.ps1"

(
    echo @echo off
    echo if "%%~1"=="--update" ^(
    echo     powershell -NoProfile -ExecutionPolicy Bypass -File "%%~dp0stx-update.ps1"
    echo     exit /b %%ERRORLEVEL%%
    echo ^)
    echo set "SYNTIOX_DATA_DIR=%DATA_DIR%"
    echo set "SYNTIOX_PYTHON_EXE=%VENV_PY%"
    echo set "PATH=%PATH_PREFIX%;%%PATH%%"
    echo set "PYTHONPATH=%PYTHONPATH_PREFIX%"
    echo cd /d "%TARGET_DIR%"
    echo "%TARGET_DIR%\syntioxcore-server.exe" %%*
) > "%BIN_DIR%\stx.cmd"

(
    echo @echo off
    echo set "SYNTIOX_DATA_DIR=%DATA_DIR%"
    echo set "SYNTIOX_PYTHON_EXE=%VENV_PY%"
    echo set "PATH=%PATH_PREFIX%;%%PATH%%"
    echo set "PYTHONPATH=%PYTHONPATH_PREFIX%"
    echo cd /d "%TARGET_DIR%"
    echo if exist "%%SYNTIOX_DATA_DIR%%\config\token.json" del /q "%%SYNTIOX_DATA_DIR%%\config\token.json"
    echo "%TARGET_DIR%\syntioxcore-server.exe" --auth-setup
) > "%BIN_DIR%\stx-google-login.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$u=[Environment]::GetEnvironmentVariable('PATH','User'); $segs=@(); if($u){ $segs=$u.Split(';',[System.StringSplitOptions]::RemoveEmptyEntries) }; foreach($e in @('%PY_HOME%','%BIN_DIR%')){ if($e -and -not ($segs | Where-Object { $_.TrimEnd('\') -ieq $e.TrimEnd('\') })){ $segs+=$e } }; [Environment]::SetEnvironmentVariable('PATH',($segs -join ';'),'User'); $k='HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\syntioxcore-server.exe'; New-Item -Path $k -Force | Out-Null; Set-ItemProperty -Path $k -Name '(Default)' -Value '%TARGET_DIR%\syntioxcore-server.exe'; Set-ItemProperty -Path $k -Name 'Path' -Value '%PATH_PREFIX%'"

echo.
echo =================================================================
echo Syntiox CORE installed successfully!
echo You can now use 'stx' from anywhere in your terminal.
echo Data, brain, and scratch files are saved in: %DATA_DIR%
echo =================================================================
if exist "%TARGET_DIR%\syntiox-core.exe" start "" "%TARGET_DIR%\syntiox-core.exe"
pause
exit /b 0

:STOP_RUNNING
echo Stopping running Syntiox CORE processes...
cd /d "%TEMP%"
taskkill /F /IM syntiox-core.exe >nul 2>nul
taskkill /F /IM syntioxcore-server.exe >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9999 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /T /PID %%a >nul 2>nul
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = $env:TARGET_DIR; Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(python|pythonw|uvicorn|node)' -and (($_.ExecutablePath -and $_.ExecutablePath.StartsWith($t, [System.StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($t, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800" >nul 2>nul
goto :eof
