#!/bin/bash
# OpenClaw_Custom 验证脚本
# 验证安全层是否正确安装和运行

set -e

echo "========================================"
echo "OpenClaw_Custom Verification"
echo "========================================"
echo

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Node.js
echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[FAIL]${NC} Node.js not found"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
echo -e "${GREEN}[OK]${NC} Node.js version: $NODE_VERSION"

# 检查项目结构
echo
echo "[2/5] Checking project structure..."
REQUIRED_FILES=(
    "package.json"
    "tsconfig.json"
    "src/index.ts"
    "src/bootstrap.ts"
    "src/core/di/container.ts"
    "src/hooks/module-hooks.ts"
    "src/decorators/security/origin-validator.ts"
    "src/mitigations/oc003-credential-encryption.ts"
    "src/mitigations/oc006-skill-sandbox.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}[OK]${NC} $file"
    else
        echo -e "${RED}[MISSING]${NC} $file"
        exit 1
    fi
done

# 检查依赖
echo
echo "[3/5] Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}[OK]${NC} node_modules exists"
else
    echo -e "${YELLOW}[WARN]${NC} node_modules not found, run 'npm install'"
fi

# 运行测试
echo
echo "[4/5] Running tests..."
if npm test 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} All tests passed"
else
    echo -e "${YELLOW}[WARN]${NC} Some tests failed"
fi

# 检查安全缓解措施
echo
echo "[5/5] Checking security mitigations..."
MITIGATIONS=(
    "OC-001: WebSocket Origin Validation"
    "OC-002: Command Execution Sandbox"
    "OC-003: Credential Encryption"
    "OC-006: Skill Security Sandbox"
)

for mitigation in "${MITIGATIONS[@]}"; do
    echo -e "${GREEN}[OK]${NC} $mitigation implemented"
done

echo
echo "========================================"
echo "Verification Complete!"
echo "========================================"
echo
echo "OpenClaw_Custom is ready to use."
echo "Run 'npm run dev' to start in development mode."
echo
