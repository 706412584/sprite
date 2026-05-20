dotnet build src\GameEntry.csproj -c Client-Resource
@echo off
if %errorlevel% neq 0 (
    echo Resource collect failed. Exiting.
    pause
    exit /b %errorlevel%
)