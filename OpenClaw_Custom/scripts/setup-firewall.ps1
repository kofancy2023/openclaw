# OpenClaw_Custom Windows 防火墙配置脚本
# 配置防火墙规则以保护非默认端口

param(
    [Parameter(Mandatory=$false)]
    [int]$Port = 55443,
    
    [Parameter(Mandatory=$false)]
    [switch]$BlockDefaultPort,
    
    [Parameter(Mandatory=$false)]
    [switch]$RemoveRules
)

$RuleName = "OpenClaw Custom Port ($Port)"
$BlockRuleName = "OpenClaw Block Default Port (18789)"

function Test-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Show-Header {
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  OpenClaw_Custom Firewall Configuration                ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Add-FirewallRules {
    param([int]$Port)
    
    Write-Host "🔧 Configuring firewall rules..." -ForegroundColor Yellow
    Write-Host "   Port: $Port" -ForegroundColor Gray
    
    try {
        # 添加入站规则（允许）
        $inboundRule = New-NetFirewallRule -DisplayName $RuleName `
            -Direction Inbound `
            -Protocol TCP `
            -LocalPort $Port `
            -Action Allow `
            -Profile Private,Domain `
            -Description "Allow OpenClaw Custom secure port $Port"
        
        Write-Host "   ✓ Inbound rule created: $($inboundRule.DisplayName)" -ForegroundColor Green
        
        # 可选：阻止默认端口 18789
        if ($BlockDefaultPort) {
            try {
                $blockRule = New-NetFirewallRule -DisplayName $BlockRuleName `
                    -Direction Inbound `
                    -Protocol TCP `
                    -LocalPort 18789 `
                    -Action Block `
                    -Profile Any `
                    -Description "Block OpenClaw default port 18789 for security"
                
                Write-Host "   ✓ Default port blocked: 18789" -ForegroundColor Green
            } catch {
                Write-Warning "   ⚠ Could not create block rule: $_"
            }
        }
        
        Write-Host ""
        Write-Host "✅ Firewall configuration complete!" -ForegroundColor Green
        
    } catch {
        Write-Error "❌ Failed to create firewall rules: $_"
        exit 1
    }
}

function Remove-FirewallRules {
    Write-Host "🗑️  Removing firewall rules..." -ForegroundColor Yellow
    
    try {
        # 移除自定义端口规则
        $rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
        if ($rule) {
            Remove-NetFirewallRule -DisplayName $RuleName
            Write-Host "   ✓ Removed: $RuleName" -ForegroundColor Green
        } else {
            Write-Host "   ℹ Rule not found: $RuleName" -ForegroundColor Gray
        }
        
        # 移除阻止规则
        $blockRule = Get-NetFirewallRule -DisplayName $BlockRuleName -ErrorAction SilentlyContinue
        if ($blockRule) {
            Remove-NetFirewallRule -DisplayName $BlockRuleName
            Write-Host "   ✓ Removed: $BlockRuleName" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "✅ Rules removed!" -ForegroundColor Green
        
    } catch {
        Write-Error "❌ Failed to remove rules: $_"
    }
}

function Show-Status {
    Write-Host "📊 Current Firewall Rules:" -ForegroundColor Cyan
    Write-Host ""
    
    $rules = Get-NetFirewallRule -DisplayName "OpenClaw*" -ErrorAction SilentlyContinue
    
    if ($rules) {
        $rules | ForEach-Object {
            $portFilter = $_ | Get-NetFirewallPortFilter
            Write-Host "   • $($_.DisplayName)" -ForegroundColor White
            Write-Host "     Direction: $($_.Direction), Action: $($_.Action), Port: $($portFilter.LocalPort)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ℹ No OpenClaw rules found" -ForegroundColor Gray
    }
    Write-Host ""
}

# 主逻辑
Show-Header

# 检查管理员权限
if (-not (Test-Admin)) {
    Write-Error "❌ This script requires Administrator privileges!"
    Write-Host "   Please run PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

if ($RemoveRules) {
    Remove-FirewallRules
} else {
    # 检查端口是否有效
    if ($Port -lt 1 -or $Port -gt 65535) {
        Write-Error "❌ Invalid port number: $Port (must be 1-65535)"
        exit 1
    }
    
    if ($Port -eq 18789) {
        Write-Warning "⚠️  You are using the default OpenClaw port (18789)"
        Write-Warning "   This is not recommended for security reasons"
        Write-Host ""
        $confirm = Read-Host "   Continue anyway? (y/N)"
        if ($confirm -ne 'y') {
            exit 0
        }
    }
    
    Add-FirewallRules -Port $Port
}

Show-Status

Write-Host "📚 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Start OpenClaw with: node example/start-secure-port.mjs" -ForegroundColor White
Write-Host "   2. Verify connection to port $Port" -ForegroundColor White
Write-Host "   3. Test that port 18789 is blocked (if enabled)" -ForegroundColor White
Write-Host ""

pause
