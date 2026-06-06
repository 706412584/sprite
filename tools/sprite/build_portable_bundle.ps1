[CmdletBinding()]
param(
    [string]$OutputRoot = "I:\sprite-video-lab-portable",
    [string]$PythonHome = "C:\Program Files\Python312",
    [string]$VenvRoot = "E:\sprite-video-lab-models\venv",
    [string]$ModelRoot = "E:\sprite-video-lab-models",
    [string]$FfmpegBinRoot = "I:\FF\bin",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function New-Utf8NoBomEncoding {
    return [System.Text.UTF8Encoding]::new($false)
}

function Resolve-ExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction Stop
    return $resolved.ProviderPath
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathValue
    )

    if (-not (Test-Path -LiteralPath $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue | Out-Null
    }
}

function Copy-Tree {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    Ensure-Directory -PathValue $Destination
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-ExistingPath -PathValue $repoRoot
$outputRootResolved = $OutputRoot

if ($Clean -and (Test-Path -LiteralPath $outputRootResolved)) {
    Write-Host "Removing existing bundle at $outputRootResolved"
    Remove-Item -LiteralPath $outputRootResolved -Recurse -Force
}

Ensure-Directory -PathValue $outputRootResolved
$outputRootResolved = Resolve-ExistingPath -PathValue $outputRootResolved

$pythonHomeResolved = Resolve-ExistingPath -PathValue $PythonHome
$venvRootResolved = Resolve-ExistingPath -PathValue $VenvRoot
$modelRootResolved = Resolve-ExistingPath -PathValue $ModelRoot
$ffmpegRootResolved = Resolve-ExistingPath -PathValue $FfmpegBinRoot

$bundleRoot = Join-Path $outputRootResolved "SpriteVideoLab"
$runtimeRoot = Join-Path $bundleRoot "runtime"
$pythonRuntimeRoot = Join-Path $runtimeRoot "python"
$ffmpegRuntimeRoot = Join-Path $runtimeRoot "ffmpeg"
$modelsRuntimeRoot = Join-Path $runtimeRoot "models"
$workRoot = Join-Path $bundleRoot "work"

if (Test-Path -LiteralPath $bundleRoot) {
    Write-Host "Refreshing bundle directory $bundleRoot"
    Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}

Ensure-Directory -PathValue $bundleRoot
Ensure-Directory -PathValue $runtimeRoot
Ensure-Directory -PathValue $workRoot

Write-Host "Copying project files..."
$projectFiles = @(
    "app",
    "server.py",
    "start_sprite_video_lab_portable.bat",
    "README.md",
    "USAGE.md",
    "USAGE.zh-CN.md",
    "AI_MATTING.md",
    "LICENSE",
    "VERSION"
)
foreach ($item in $projectFiles) {
    $sourcePath = Join-Path $repoRoot $item
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Required project path not found: $sourcePath"
    }
    Copy-Item -LiteralPath $sourcePath -Destination $bundleRoot -Recurse -Force
}

Write-Host "Copying Python runtime..."
Copy-Tree -Source $pythonHomeResolved -Destination $runtimeRoot

$sitePackagesSource = Join-Path $venvRootResolved "Lib\site-packages"
$sitePackagesDest = Join-Path $pythonRuntimeRoot "Lib\site-packages"
Ensure-Directory -PathValue $sitePackagesDest

Write-Host "Copying Python packages from venv..."
Get-ChildItem -LiteralPath $sitePackagesSource -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $sitePackagesDest -Recurse -Force
}

Write-Host "Copying ffmpeg..."
Ensure-Directory -PathValue $ffmpegRuntimeRoot
Get-ChildItem -LiteralPath $ffmpegRootResolved -Filter *.exe | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $ffmpegRuntimeRoot -Force
}

Write-Host "Copying AI models..."
$portableModelRoot = Join-Path $modelsRuntimeRoot "portable-models"
Ensure-Directory -PathValue $portableModelRoot
Copy-Tree -Source (Join-Path $modelRootResolved "huggingface") -Destination $portableModelRoot
Copy-Tree -Source (Join-Path $modelRootResolved "CorridorKey") -Destination $portableModelRoot

$readmePath = Join-Path $bundleRoot "PORTABLE_README.txt"
$readmeText = @"
Sprite Video Lab Portable

Usage:
1. Extract the folder anywhere.
2. Double-click start_sprite_video_lab_portable.bat
3. The browser will open automatically.

This bundle includes:
- Python runtime
- ffmpeg / ffprobe
- AI dependencies
- BiRefNet model cache
- CorridorKey code and checkpoints

Notes:
- Runtime outputs are written to the local work folder next to the launcher.
- If Windows Defender prompts on first run, allow the local Python process.
"@
[System.IO.File]::WriteAllText($readmePath, $readmeText, (New-Utf8NoBomEncoding))

$zipPath = Join-Path $outputRootResolved "SpriteVideoLab-portable.zip"
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "Creating zip archive..."
Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath -CompressionLevel Optimal

$summary = [pscustomobject]@{
    BundleRoot = $bundleRoot
    ZipPath = $zipPath
    PythonRuntime = $pythonRuntimeRoot
    FfmpegRuntime = $ffmpegRuntimeRoot
    ModelRoot = $portableModelRoot
}

Write-Host ""
Write-Host "Portable bundle created:"
$summary | Format-List
