<#
.SYNOPSIS
    Generate AI context files for WasiCore projects.
.DESCRIPTION
    Reads src/WasiCoreSDK.props, discovers SDK path, creates docs junctions,
    and writes:
      - .cursor/rules/project-context.mdc
      - .cursor/rules/wasicore-coding-rules.mdc
      - AGENTS.md
      - CLAUDE.md
#>
param(
    [string]$ProjectPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$ProjectPath = $ProjectPath.TrimEnd('\', '/')

function New-JunctionIfNeeded {
    param(
        [string]$LinkPath,
        [string]$TargetPath
    )

    if (-not (Test-Path $TargetPath)) {
        Write-Warning "Junction target does not exist: $TargetPath"
        return $false
    }

    $parentDir = Split-Path -Parent $LinkPath
    if (-not (Test-Path $parentDir)) {
        New-Item -Path $parentDir -ItemType Directory -Force | Out-Null
    }

    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $existingTarget = $item.Target
            if ($existingTarget -eq $TargetPath) {
                Write-Host "  Junction up-to-date: $LinkPath" -ForegroundColor DarkGray
                return $true
            }
            cmd /c rmdir "$LinkPath" 2>$null | Out-Null
        } else {
            Remove-Item -Path $LinkPath -Recurse -Force
        }
    }

    cmd /c mklink /J "$LinkPath" "$TargetPath" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Junction created: $LinkPath -> $TargetPath" -ForegroundColor Green
        return $true
    }

    Write-Warning "  Failed to create junction: $LinkPath"
    return $false
}

# 1) Read SDK path
$propsFile = Join-Path $ProjectPath "src\WasiCoreSDK.props"
if (-not (Test-Path $propsFile)) {
    Write-Error "Missing src/WasiCoreSDK.props. Open project once in editor first. Path: $propsFile"
    exit 1
}

[xml]$propsXml = Get-Content $propsFile -Encoding UTF8
$sdkPath = $propsXml.Project.PropertyGroup.WasiCoreSDKPath
if ([string]::IsNullOrWhiteSpace($sdkPath)) {
    Write-Error "WasiCoreSDKPath not found in src/WasiCoreSDK.props."
    exit 1
}

$sdkPath = $sdkPath.TrimEnd('\', '/') + '/'
Write-Host "SDK Path: $sdkPath" -ForegroundColor Cyan

# 1b) Detect csproj
$srcDir = Join-Path $ProjectPath "src"
$csprojFiles = @(Get-ChildItem -Path $srcDir -Filter "*.csproj" -File -ErrorAction SilentlyContinue)
if ($csprojFiles.Count -eq 0) {
    $csprojName = "GameEntry.csproj"
    Write-Warning "No .csproj found in src/. Using GameEntry.csproj."
} elseif ($csprojFiles.Count -eq 1) {
    $csprojName = $csprojFiles[0].Name
} else {
    $preferredCsproj = $csprojFiles | Where-Object { $_.Name -eq "GameEntry.csproj" } | Select-Object -First 1
    if ($preferredCsproj) {
        $csprojName = $preferredCsproj.Name
    } else {
        $csprojName = $csprojFiles[0].Name
    }
    Write-Warning "Multiple .csproj files found. Using: $csprojName"
}
Write-Host "Project: src/$csprojName" -ForegroundColor Cyan

# 2) Create docs junctions
$docsLinkDir = Join-Path $ProjectPath "docs"
$sdkDocsLink = Join-Path $docsLinkDir "sdk"
$sdkApiLink = Join-Path $docsLinkDir "api"
$sdkSchemasLink = Join-Path $docsLinkDir "schemas"

$sdkDocsTarget = (Join-Path $sdkPath "docs") -replace '/', '\'
$sdkApiTarget = (Join-Path $sdkPath "api") -replace '/', '\'
$sdkSchemasTarget = (Join-Path $sdkPath "schemas") -replace '/', '\'

Write-Host "Creating documentation junctions..." -ForegroundColor Cyan
New-JunctionIfNeeded -LinkPath $sdkDocsLink -TargetPath $sdkDocsTarget | Out-Null
New-JunctionIfNeeded -LinkPath $sdkApiLink -TargetPath $sdkApiTarget | Out-Null
New-JunctionIfNeeded -LinkPath $sdkSchemasLink -TargetPath $sdkSchemasTarget | Out-Null

# 3) Write .cursor/rules
$cursorRulesDir = Join-Path $ProjectPath ".cursor\rules"
if (-not (Test-Path $cursorRulesDir)) {
    New-Item -Path $cursorRulesDir -ItemType Directory -Force | Out-Null
}

$sdkPathUnix = $sdkPath -replace '\\', '/'

$projectContext = @"
---
description: WasiCore project context (auto-generated). Do not edit manually.
alwaysApply: true
---

# WasiCore Project

## SDK
`$sdkPathUnix

## Workspace Docs
- `docs/sdk/` : framework docs and guides
- `docs/api/` : API signatures (client/server/shared)
- `docs/schemas/` : data schemas (`types-index.json`, `types/*.json`, `TableData.schema.json`)

## Build Commands
```bash
dotnet build src/$csprojName -c Client-Debug
dotnet build src/$csprojName -c Server-Debug
```

## Read Order
1. `docs/sdk/ai/`
2. `docs/sdk/systems/`
3. `docs/api/`
4. `docs/schemas/`
"@

$codingRules = @"
---
description: WasiCore coding rules (auto-generated). Do not edit manually.
globs: ["src/**/*.cs"]
---

# WasiCore Coding Rules

## Banned APIs
- `Task.Run()` (single-threaded runtime)
- `Task.Delay()` (use `Game.Delay()`)
- `Thread` and thread APIs
- `Console.WriteLine` (use `Game.Logger.*`)
- `goto`

## Client / Server
- Use `#if CLIENT` and `#if SERVER`
- Entity/Unit creation: server only
- Actor creation: client only
- `GameDataGameMode` registration: both sides (not inside `#if`)

## Logging
- Use parameterized logs (no string interpolation)
"@

$projectContext | Out-File -FilePath (Join-Path $cursorRulesDir "project-context.mdc") -Encoding UTF8 -NoNewline
$codingRules | Out-File -FilePath (Join-Path $cursorRulesDir "wasicore-coding-rules.mdc") -Encoding UTF8 -NoNewline

# 4) Write AGENTS.md / CLAUDE.md
$agentsMd = @"
# WasiCore Game Project

> Auto-generated. Do not edit manually.

## SDK
Path: `$sdkPathUnix

## Build
```bash
dotnet build src/$csprojName -c Client-Debug
dotnet build src/$csprojName -c Server-Debug
```

## Docs
- `docs/sdk/`
- `docs/api/`
- `docs/schemas/`
"@

$claudeMd = @"
# WasiCore Game Project

> Auto-generated. Do not edit manually.

## SDK
Path: `$sdkPathUnix

## Build
```bash
dotnet build src/$csprojName -c Client-Debug
dotnet build src/$csprojName -c Server-Debug
```

## Docs
- `docs/sdk/`
- `docs/api/`
- `docs/schemas/`
"@

$agentsMd | Out-File -FilePath (Join-Path $ProjectPath "AGENTS.md") -Encoding UTF8 -NoNewline
$claudeMd | Out-File -FilePath (Join-Path $ProjectPath "CLAUDE.md") -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "=== AI Context Setup Complete ===" -ForegroundColor Magenta
Write-Host "  docs/sdk/                                (junction -> SDK docs)" -ForegroundColor White
Write-Host "  docs/api/                                (junction -> SDK API source)" -ForegroundColor White
Write-Host "  docs/schemas/                            (junction -> SDK schemas)" -ForegroundColor White
Write-Host "  .cursor/rules/project-context.mdc        (Cursor auto-applied rule)" -ForegroundColor White
Write-Host "  .cursor/rules/wasicore-coding-rules.mdc  (Cursor coding rules for C#)" -ForegroundColor White
Write-Host "  AGENTS.md                                (IDE-agnostic AI discovery)" -ForegroundColor White
Write-Host "  CLAUDE.md                                (Claude Code project instructions)" -ForegroundColor White
Write-Host ""

