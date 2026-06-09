@echo off
:: Map UNC path (\\Mac\Home\...) to a temporary drive letter automatically
pushd "%~dp0"

echo ===================================================
echo   LittleCat Mock Windows Packaging Tool
echo ===================================================
echo.
echo [*] Checking Python installation...

:: 1. Check if Python is in current PATH
python --version >nul 2>&1
if not errorlevel 1 goto :start_pack

:: 2. Not in PATH. Let's check common local folders
for /d %%d in ("%LocalAppData%\Programs\Python\Python*") do (
    if exist "%%d\python.exe" (
        set "PATH=%%d;%%d\Scripts;%PATH%"
    )
)

python --version >nul 2>&1
if not errorlevel 1 goto :start_pack

:: 3. Not installed at all. Let's download it
echo [!] Python is not installed on this Windows machine.
echo [*] Downloading and installing Python automatically...
echo [*] Downloading Python 3.11.9 (64-bit)...

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%temp%\python-installer.exe'"
if errorlevel 1 goto :download_fail

echo [*] Installing Python silently (Unattended)... Please wait...
start /wait "" "%temp%\python-installer.exe" /quiet InstallAllUsers=0 AssociateFiles=1 PrependPath=1 Include_launcher=1

:: 4. Add new installation to PATH
for /d %%d in ("%LocalAppData%\Programs\Python\Python*") do (
    if exist "%%d\python.exe" (
        set "PATH=%%d;%%d\Scripts;%PATH%"
    )
)

python --version >nul 2>&1
if not errorlevel 1 goto :start_pack

echo [x] Error: Python installation succeeded but could not be added to PATH automatically.
echo Please restart your Windows machine or add Python to PATH manually.
goto :exit_fail

:download_fail
echo [x] Error: Failed to download Python installer!
echo Please connect to the internet or install Python manually.
goto :exit_fail

:start_pack
echo [*] Python verified successfully!
python --version
echo [*] Starting packaging process...
python package.py
goto :exit_ok

:exit_fail
popd
pause
exit /b 1

:exit_ok
echo.
echo ===================================================
echo   [+] Success! Standalone "LittleCat Mock.exe" generated in dist_win/!
echo ===================================================
popd
pause
