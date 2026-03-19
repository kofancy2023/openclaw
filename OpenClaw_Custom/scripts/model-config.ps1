#!/usr/bin/env pwsh
<#
.SYNOPSIS
    设置 OpenClaw 默认使用本地 Ollama 模型
.DESCRIPTION
    配置默认使用本地 qwen3.5:9b，同时保留国内模型作为备用选项
#>

param(
    [Parameter()]
    [ValidateSet("local", "hybrid", "cn")]
    [string]$Mode = "local"
)

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  OpenClaw 模型配置工具                                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

switch ($Mode) {
    "local" {
        Write-Host "📌 模式: 纯本地 (Ollama qwen3.5:9b)" -ForegroundColor Green
        
        # 检查 Ollama 是否运行
        try {
            $ollamaCheck = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -ErrorAction Stop
            Write-Host "✅ Ollama 服务运行正常" -ForegroundColor Green
            
            # 检查模型是否存在
            $models = $ollamaCheck.models
            $hasQwen9b = $models | Where-Object { $_.name -eq "qwen3.5:9b" }
            
            if ($hasQwen9b) {
                Write-Host "✅ 模型 qwen3.5:9b 已安装" -ForegroundColor Green
            } else {
                Write-Host "⚠️  模型 qwen3.5:9b 未找到，正在拉取..." -ForegroundColor Yellow
                ollama pull qwen3.5:9b
            }
        } catch {
            Write-Host "❌ Ollama 服务未启动，请先启动 Ollama" -ForegroundColor Red
            Write-Host "   启动命令: ollama serve" -ForegroundColor Gray
            exit 1
        }
        
        # 复制纯本地配置
        $sourceConfig = "$PSScriptRoot\..\config\models-security.local.json5"
        $targetConfig = "$env:USERPROFILE\.openclaw\openclaw-custom\models-security.json5"
        
        Copy-Item -Path $sourceConfig -Destination $targetConfig -Force
        Write-Host "✅ 已应用纯本地配置" -ForegroundColor Green
        
        # 设置默认模型
        node "$PSScriptRoot\..\..\openclaw.mjs" models set ollama/qwen3.5:9b 2>$null
        Write-Host "✅ 默认模型设置为: ollama/qwen3.5:9b" -ForegroundColor Green
    }
    
    "hybrid" {
        Write-Host "📌 模式: 混合模式 (本地优先，国内备用)" -ForegroundColor Green
        
        $sourceConfig = "$PSScriptRoot\..\config\models-security.hybrid.json5"
        $targetConfig = "$env:USERPROFILE\.openclaw\openclaw-custom\models-security.json5"
        
        Copy-Item -Path $sourceConfig -Destination $targetConfig -Force
        Write-Host "✅ 已应用混合配置" -ForegroundColor Green
        Write-Host "   优先级: 本地(qwen3.5:9b) > 国内(Kimi/GLM) > 国际(Claude)" -ForegroundColor Gray
        
        node "$PSScriptRoot\..\..\openclaw.mjs" models set ollama/qwen3.5:9b 2>$null
        Write-Host "✅ 默认模型设置为: ollama/qwen3.5:9b" -ForegroundColor Green
    }
    
    "cn" {
        Write-Host "📌 模式: 国内优先 (Kimi/GLM)" -ForegroundColor Green
        
        $sourceConfig = "$PSScriptRoot\..\config\models-security.cn.json5"
        $targetConfig = "$env:USERPROFILE\.openclaw\openclaw-custom\models-security.json5"
        
        Copy-Item -Path $sourceConfig -Destination $targetConfig -Force
        Write-Host "✅ 已应用国内优先配置" -ForegroundColor Green
        
        node "$PSScriptRoot\..\..\openclaw.mjs" models set moonshot/kimi-k2.5 2>$null
        Write-Host "✅ 默认模型设置为: moonshot/kimi-k2.5" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "⚠️  请确保已设置环境变量:" -ForegroundColor Yellow
        Write-Host "   `$env:MOONSHOT_API_KEY='sk-your-key'" -ForegroundColor Gray
        Write-Host "   `$env:ZHIPU_API_KEY='your-key'" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📝 当前可用模型:" -ForegroundColor Cyan

# 显示当前配置中的模型
$config = Get-Content $targetConfig -Raw
$allowedModels = [regex]::Matches($config, "'([^']+)'").Groups | Where-Object { $_.Value -like "*/*" } | Select-Object -Unique | ForEach-Object { $_.Value }

$localModels = $allowedModels | Where-Object { $_ -like "ollama/*" }
$cnModels = $allowedModels | Where-Object { $_ -like "moonshot/*" -or $_ -like "zhipu/*" }
$globalModels = $allowedModels | Where-Object { $_ -like "anthropic/*" -or $_ -like "openai/*" }

if ($localModels) {
    Write-Host "  🖥️  本地模型:" -ForegroundColor Green
    $localModels | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

if ($cnModels) {
    Write-Host "  🇨🇳 国内模型:" -ForegroundColor Yellow
    $cnModels | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

if ($globalModels) {
    Write-Host "  🌍 国际模型:" -ForegroundColor Blue
    $globalModels | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

Write-Host ""
Write-Host "💡 使用提示:" -ForegroundColor Cyan
Write-Host "   查看模型列表: openclaw models list" -ForegroundColor Gray
Write-Host "   切换模型:     openclaw models set <model-name>" -ForegroundColor Gray
Write-Host "   查看状态:     node scripts/dev.mjs status" -ForegroundColor Gray
