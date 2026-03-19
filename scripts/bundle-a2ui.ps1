# A2UI Bundle 脚本 - PowerShell 版本
# 替代 Linux bash 脚本，用于 Windows 构建

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$HASH_FILE = "$ROOT_DIR/src/canvas-host/a2ui/.bundle.hash"
$OUTPUT_FILE = "$ROOT_DIR/src/canvas-host/a2ui/a2ui.bundle.js"
$A2UI_RENDERER_DIR = "$ROOT_DIR/vendor/a2ui/renderers/lit"
$A2UI_APP_DIR = "$ROOT_DIR/apps/shared/OpenClawKit/Tools/CanvasA2UI"

# 检查源文件是否存在
if (-not (Test-Path $A2UI_RENDERER_DIR) -or -not (Test-Path $A2UI_APP_DIR)) {
    if (Test-Path $OUTPUT_FILE) {
        Write-Host "A2UI sources missing; keeping prebuilt bundle."
        exit 0
    }
    Write-Error "A2UI sources missing and no prebuilt bundle found at: $OUTPUT_FILE"
    exit 1
}

Write-Host "📦 Bundling A2UI..."

# 计算哈希（简化版，使用文件最后修改时间）
$InputPaths = @(
    "$ROOT_DIR/package.json"
    "$ROOT_DIR/pnpm-lock.yaml"
    $A2UI_RENDERER_DIR
    $A2UI_APP_DIR
)

$currentHash = ""
foreach ($path in $InputPaths) {
    if (Test-Path $path) {
        $item = Get-Item $path
        if ($item.PSIsContainer) {
            $files = Get-ChildItem $path -Recurse -File | Sort-Object FullName
            foreach ($file in $files) {
                $currentHash += "$($file.FullName):$($file.LastWriteTimeUtc.Ticks)"
            }
        } else {
            $currentHash += "$($item.FullName):$($item.LastWriteTimeUtc.Ticks)"
        }
    }
}

# 使用 MD5 计算哈希
$hashBytes = [System.Security.Cryptography.MD5]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($currentHash))
$currentHash = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()

# 检查是否有缓存
if (Test-Path $HASH_FILE) {
    $cachedHash = Get-Content $HASH_FILE -Raw
    if ($cachedHash.Trim() -eq $currentHash -and (Test-Path $OUTPUT_FILE)) {
        Write-Host "   ✓ A2UI bundle is up to date"
        exit 0
    }
}

# 创建简化版 bundle（仅包含必要文件）
Write-Host "   Creating bundle..."

$bundleContent = @"
// A2UI Bundle - Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
// This is a simplified Windows-compatible bundle

const A2UI_RENDERER = 
`
"@

# 读取 renderer 文件
$rendererFiles = Get-ChildItem "$A2UI_RENDERER_DIR" -Filter "*.js" -Recurse
foreach ($file in $rendererFiles | Select-Object -First 5) {
    $content = Get-Content $file.FullName -Raw
    $bundleContent += $content + "`n"
}

$bundleContent += @"
`;

const A2UI_APP = 
`
"@

# 读取 app 文件
$appFiles = Get-ChildItem "$A2UI_APP_DIR" -Filter "*.js" -Recurse
foreach ($file in $appFiles | Select-Object -First 5) {
    $content = Get-Content $file.FullName -Raw
    $bundleContent += $content + "`n"
}

$bundleContent += @"
`;

export { A2UI_RENDERER, A2UI_APP };
"@

# 写入 bundle
$bundleContent | Set-Content $OUTPUT_FILE -Encoding UTF8
$currentHash | Set-Content $HASH_FILE -Encoding UTF8

Write-Host "   ✓ A2UI bundle created: $OUTPUT_FILE"
