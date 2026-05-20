dotnet build -c Server-Debug
@echo off
if %errorlevel% neq 0 (
    echo Publish failed. Exiting.
    pause
    exit /b %errorlevel%
)
dotnet build -c Client-Debug
@echo off
if %errorlevel% neq 0 (
    echo Publish failed. Exiting.
    pause
    exit /b %errorlevel%
)
pause