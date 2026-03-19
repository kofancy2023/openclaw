# OpenClaw + OpenClaw_Custom 启动脚本
# 一键启动带安全层的 OpenClaw Gateway

param(
    [Parameter(Mandatory=$false)]
    [int]$Port = 0,  # 0 = 随机端口
    
    [Parameter(Mandatory=$false)]
    [switch]$StatusOnly
)

$ErrorActionPreference = "Stop"

function Show-Header {
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  OpenClaw + OpenClaw_Custom 启动器                     ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-SecurityLayer {
    $distPath = Join-Path $PSScriptRoot "..\dist\index.js"
    if (Test-Path $distPath) {
        Write-Host "✅ 安全层已编译" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ 安全层未编译" -ForegroundColor Red
        Write-Host "   正在编译..." -ForegroundColor Yellow
        
        $customPath = Join-Path $PSScriptRoot ".."
        try {
            Push-Location $customPath
            npx tsc 2>&1 | Out-Null
            Pop-Location
            
            if (Test-Path $distPath) {
                Write-Host "✅ 编译成功" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "❌ 编译失败: $_" -ForegroundColor Red
        }
        return $false
    }
}

function Get-RandomPort {
    return Get-Random -Minimum 49152 -Maximum 65535
}

function Start-OpenClawGateway {
    param([int]$Port)
    
    Write-Host "🚀 正在启动 OpenClaw Gateway..." -ForegroundColor Yellow
    Write-Host "   端口: $Port" -ForegroundColor Gray
    Write-Host "   绑定: 127.0.0.1" -ForegroundColor Gray
    Write-Host ""
    
    $env:OPENCLAW_GATEWAY_PORT = $Port
    $env:OPENCLAW_GATEWAY_HOST = "127.0.0.1"
    $env:OPENCLAW_CUSTOM_ENABLED = "true"
    
    $openclawRoot = Join-Path $PSScriptRoot "..\.."
    
    try {
        Push-Location $openclawRoot
        node openclaw.mjs gateway run --port $Port --bind 127.0.0.1
    } finally {
        Pop-Location
    }
}

function Show-Status {
    Write-Host "📊 OpenClaw 状态:" -ForegroundColor Cyan
    
    $openclawRoot = Join-Path $PSScriptRoot "..\.."
    
    try {
        Push-Location $openclawRoot
        
        # 版本
        $version = node openclaw.mjs --version 2>$null
        Write-Host "   版本: $version" -ForegroundColor Gray
        
        # Gateway 状态
        $status = node openclaw.mjs gateway status --json 2>$null | ConvertFrom-Json
        if ($status) {
            Write-Host "   Gateway: 运行中" -ForegroundColor Green
        } else {
            Write-Host "   Gateway: 未运行" -ForegroundColor Red
        }
        
        Pop-Location
    } catch {
        Write-Host "   无法获取状态: $_" -ForegroundColor Red
    }
}

# 主逻辑
Show-Header

if ($StatusOnly) {
    Show-Status
    exit 0
}

if (-not (Test-SecurityLayer)) {
    Write-Host ""
    Write-Host "❌ 安全层检查失败，无法启动" -ForegroundColor Red
    exit 1
}

$actualPort = if ($Port -eq 0) { Get-RandomPort } else { $Port }

Write-Host "🔒 安全配置:" -ForegroundColor Yellow
Write-Host "   端口: $actualPort (非默认 18789)" -ForegroundColor Gray
Write-Host "   绑定: 127.0.0.1 (仅本地)" -ForegroundColor Gray
Write-Host ""

Start-OpenClawGateway -Port $actualPort
