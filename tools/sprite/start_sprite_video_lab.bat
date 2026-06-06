@echo off
setlocal
cd /d "%~dp0"

if "%SPRITE_VIDEO_LAB_HOST%"=="" set "SPRITE_VIDEO_LAB_HOST=127.0.0.1"
if "%SPRITE_VIDEO_LAB_PORT%"=="" set "SPRITE_VIDEO_LAB_PORT=8894"
if "%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%"=="" if exist "E:\" set "SPRITE_VIDEO_LAB_AI_MODEL_CACHE=E:\sprite-video-lab-models\huggingface"
if "%SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT%"=="" if exist "E:\" set "SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT=E:\sprite-video-lab-models\CorridorKey"
if "%HF_HOME%"=="" set "HF_HOME=%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%"
if "%HUGGINGFACE_HUB_CACHE%"=="" set "HUGGINGFACE_HUB_CACHE=%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%\hub"
if "%TRANSFORMERS_CACHE%"=="" set "TRANSFORMERS_CACHE=%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%\transformers"
if "%HF_MODULES_CACHE%"=="" set "HF_MODULES_CACHE=%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%\modules"
if "%HF_XET_CACHE%"=="" set "HF_XET_CACHE=%SPRITE_VIDEO_LAB_AI_MODEL_CACHE%\xet"
if "%HF_HUB_DISABLE_SYMLINKS_WARNING%"=="" set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

set "PYTHON_EXE="
if not "%SPRITE_VIDEO_LAB_PYTHON%"=="" if exist "%SPRITE_VIDEO_LAB_PYTHON%" (
  set "PYTHON_EXE=%SPRITE_VIDEO_LAB_PYTHON%"
  goto :python_ready
)
if exist "E:\sprite-video-lab-models\venv\Scripts\python.exe" (
  set "PYTHON_EXE=E:\sprite-video-lab-models\venv\Scripts\python.exe"
  goto :python_ready
)
for /f "delims=" %%i in ('where python 2^>nul') do (
  set "PYTHON_EXE=%%i"
  goto :python_ready
)
for /f "delims=" %%i in ('where py 2^>nul') do (
  set "PYTHON_EXE=%%i"
  goto :python_ready
)

echo Python not found.
exit /b 1

:python_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$serverPath = [System.IO.Path]::GetFullPath('%~dp0server.py');" ^
  "$escaped = [Regex]::Escape($serverPath);" ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match $escaped } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }"

start "Sprite Video Lab Server" "%PYTHON_EXE%" "%~dp0server.py" --serve --host "%SPRITE_VIDEO_LAB_HOST%" --port "%SPRITE_VIDEO_LAB_PORT%"
timeout /t 2 >nul
start "" http://%SPRITE_VIDEO_LAB_HOST%:%SPRITE_VIDEO_LAB_PORT%
