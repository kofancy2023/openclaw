#!/bin/bash
#
# OpenClaw_Custom 模型配置一键设置脚本
#
# 使用方法:
#   chmod +x setup.sh
#   ./setup.sh [cn|local|hybrid]
#
# 参数:
#   cn     - 国内优先模式（默认）
#   local  - 本地优先模式
#   hybrid - 混合模式（国内 + 本地 + 国际）

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置目录
CONFIG_DIR="$HOME/.openclaw/openclaw-custom"
SECURE_DIR="$HOME/.openclaw/secure"
AUDIT_DIR="$HOME/.openclaw/audit"

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 创建目录结构
setup_directories() {
    print_info "创建配置目录..."
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$SECURE_DIR"
    mkdir -p "$AUDIT_DIR"
    chmod 700 "$SECURE_DIR"
    print_success "目录创建完成"
}

# 生成主密钥
generate_master_key() {
    if [ -z "$OPENCLAW_MASTER_KEY" ]; then
        print_info "生成主密钥..."
        MASTER_KEY=$(openssl rand -base64 32)
        print_success "主密钥已生成"
        print_warning "请保存以下主密钥，并添加到 ~/.bashrc 或 ~/.zshrc:"
        echo ""
        echo "export OPENCLAW_MASTER_KEY=\"$MASTER_KEY\""
        echo ""
        read -p "按回车键继续..."
    else
        print_success "检测到已有主密钥"
    fi
}

# 复制配置文件
copy_config() {
    local mode=$1
    local config_file=""
    
    case $mode in
        cn)
            config_file="models-security.cn.json5"
            print_info "使用国内优先配置"
            ;;
        local)
            config_file="models-security.local.json5"
            print_info "使用本地优先配置"
            ;;
        hybrid)
            config_file="models-security.example.json5"
            print_info "使用混合模式配置"
            ;;
        *)
            print_error "未知模式: $mode"
            print_info "可用模式: cn, local, hybrid"
            exit 1
            ;;
    esac
    
    if [ -f "$SCRIPT_DIR/$config_file" ]; then
        cp "$SCRIPT_DIR/$config_file" "$CONFIG_DIR/models-security.json5"
        print_success "配置文件已复制到 $CONFIG_DIR/models-security.json5"
    else
        print_error "找不到配置文件: $SCRIPT_DIR/$config_file"
        exit 1
    fi
}

# 配置 API Keys
setup_api_keys() {
    print_info "配置模型 API Keys"
    echo ""
    
    # Moonshot
    read -p "是否配置 Moonshot (Kimi) API Key? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -sp "请输入 Moonshot API Key: " moonshot_key
        echo
        if [ ! -z "$moonshot_key" ]; then
            export MOONSHOT_API_KEY="$moonshot_key"
            print_success "Moonshot API Key 已设置"
        fi
    fi
    
    # Z.AI
    echo
    read -p "是否配置 Z.AI (GLM) API Key? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -sp "请输入 Z.AI API Key: " zai_key
        echo
        if [ ! -z "$zai_key" ]; then
            export ZAI_API_KEY="$zai_key"
            print_success "Z.AI API Key 已设置"
        fi
    fi
    
    # Anthropic
    echo
    read -p "是否配置 Anthropic (Claude) API Key? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -sp "请输入 Anthropic API Key: " anthropic_key
        echo
        if [ ! -z "$anthropic_key" ]; then
            export ANTHROPIC_API_KEY="$anthropic_key"
            print_success "Anthropic API Key 已设置"
        fi
    fi
}

# 验证配置
verify_config() {
    print_info "验证配置..."
    
    if [ -f "$CONFIG_DIR/models-security.json5" ]; then
        print_success "配置文件存在"
    else
        print_error "配置文件不存在"
        exit 1
    fi
    
    # 检查主密钥
    if [ -z "$OPENCLAW_MASTER_KEY" ]; then
        print_warning "主密钥未设置，请先设置 OPENCLAW_MASTER_KEY 环境变量"
    else
        print_success "主密钥已设置"
    fi
    
    print_success "配置验证完成"
}

# 显示使用说明
show_usage() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        OpenClaw_Custom 配置完成！                      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "使用说明:"
    echo ""
    echo "1. 环境变量配置（添加到 ~/.bashrc 或 ~/.zshrc）:"
    echo "   export OPENCLAW_MASTER_KEY=\"你的主密钥\""
    echo ""
    echo "2. 常用命令:"
    echo "   # 查看当前模型状态"
    echo "   openclaw models status"
    echo ""
    echo "   # 切换模型"
    echo "   openclaw models set moonshot/kimi-k2.5"
    echo ""
    echo "   # 在聊天中切换"
    echo "   /model moonshot/kimi-k2.5"
    echo ""
    echo "3. 配置文件位置:"
    echo "   $CONFIG_DIR/models-security.json5"
    echo ""
    echo "4. 修改配置后重新加载:"
    echo "   openclaw-custom security reload-config"
    echo ""
    echo "5. 查看安全层状态:"
    echo "   openclaw-custom security status"
    echo ""
}

# 主函数
main() {
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║     OpenClaw_Custom 模型配置设置工具                   ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    
    # 检查参数
    MODE="${1:-cn}"
    
    # 创建目录
    setup_directories
    
    # 生成主密钥
    generate_master_key
    
    # 复制配置
    copy_config "$MODE"
    
    # 设置 API Keys
    if [ "$MODE" != "local" ]; then
        setup_api_keys
    else
        print_info "本地模式跳过 API Key 配置"
    fi
    
    # 验证配置
    verify_config
    
    # 显示使用说明
    show_usage
}

# 运行主函数
main "$@"
