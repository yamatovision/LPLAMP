#!/bin/bash

# LPlamp Codespaces Environment Setup Script
# GitHub Codespaces環境の自動構築スクリプト

set -e

echo "🚀 LPlamp Codespaces環境のセットアップを開始します..."

# 基本パッケージの更新
echo "📦 システムパッケージを更新中..."
sudo apt-get update && sudo apt-get upgrade -y

# 必要なシステムパッケージのインストール
echo "🔧 必要なパッケージをインストール中..."
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    chromium-browser \
    postgresql-client

# Node.js環境の確認
echo "📋 Node.js環境確認中..."
node --version
npm --version

# ClaudeCode CLIのインストール
echo "🤖 ClaudeCode CLIをインストール中..."
npm install -g @anthropic-ai/claude-code

# ClaudeCodeのバージョン確認
echo "✅ ClaudeCode CLIインストール完了"
claude --version || echo "⚠️  ClaudeCode CLI認証が必要です（初回起動時に設定）"

# プロジェクトディレクトリの作成
echo "📁 プロジェクトディレクトリを作成中..."
mkdir -p /workspaces/LPlamp/projects
chmod 755 /workspaces/LPlamp/projects

# 環境変数の設定
echo "🔧 環境変数を設定中..."
echo 'export PROJECTS_BASE_DIR="/workspaces/LPlamp/projects"' >> ~/.bashrc
echo 'export CLAUDECODE_WORKSPACE="/workspaces/LPlamp"' >> ~/.bashrc
echo 'export FORCE_COLOR=1' >> ~/.bashrc
echo 'export TERM=xterm-256color' >> ~/.bashrc

# バックエンドの依存関係インストール
echo "🔙 バックエンド依存関係をインストール中..."
cd /workspaces/LPlamp/backend
npm install

# フロントエンドの依存関係インストール
echo "🎨 フロントエンド依存関係をインストール中..."
cd /workspaces/LPlamp/frontend
npm install

# 開発用の便利なエイリアス設定
echo "⚡ 開発用エイリアスを設定中..."
cat >> ~/.bashrc << 'EOF'

# LPlamp開発用エイリアス
alias lp-backend='cd /workspaces/LPlamp/backend && npm run dev'
alias lp-frontend='cd /workspaces/LPlamp/frontend && npm run dev'
alias lp-build='cd /workspaces/LPlamp && npm run build'
alias lp-test='cd /workspaces/LPlamp && npm test'
alias lp-claude='claude'

# LPlamp開発用関数
lp-start() {
    echo "🚀 LPlampを起動しています..."
    cd /workspaces/LPlamp
    
    # バックエンドをバックグラウンドで起動
    echo "🔙 バックエンドを起動中..."
    cd backend && npm run dev &
    BACKEND_PID=$!
    
    # フロントエンドをバックグラウンドで起動
    echo "🎨 フロントエンドを起動中..."
    cd ../frontend && npm run dev &
    FRONTEND_PID=$!
    
    echo "✅ LPlamp起動完了!"
    echo "📱 フロントエンド: http://localhost:3000"
    echo "🔧 バックエンド: http://localhost:8000"
    echo "⚡ 停止するには: lp-stop"
    
    # PIDをファイルに保存
    echo $BACKEND_PID > /tmp/lplamp-backend.pid
    echo $FRONTEND_PID > /tmp/lplamp-frontend.pid
}

lp-stop() {
    echo "🛑 LPlampを停止しています..."
    
    # PIDファイルから停止
    if [ -f /tmp/lplamp-backend.pid ]; then
        kill $(cat /tmp/lplamp-backend.pid) 2>/dev/null || true
        rm /tmp/lplamp-backend.pid
    fi
    
    if [ -f /tmp/lplamp-frontend.pid ]; then
        kill $(cat /tmp/lplamp-frontend.pid) 2>/dev/null || true
        rm /tmp/lplamp-frontend.pid
    fi
    
    # プロセス名でも停止（念のため）
    pkill -f "npm run dev" 2>/dev/null || true
    
    echo "✅ LPlamp停止完了"
}

EOF

# Git設定の確認
echo "📝 Git設定を確認中..."
if [ -z "$(git config --global user.name)" ]; then
    echo "⚠️  Git user.nameが設定されていません"
    echo "   設定コマンド: git config --global user.name 'Your Name'"
fi

if [ -z "$(git config --global user.email)" ]; then
    echo "⚠️  Git user.emailが設定されていません"
    echo "   設定コマンド: git config --global user.email 'your.email@example.com'"
fi

# セットアップ完了メッセージ
echo ""
echo "✅ LPlamp Codespaces環境のセットアップが完了しました!"
echo ""
echo "🎯 次のステップ:"
echo "   1. ClaudeCode認証: claude"
echo "   2. アプリ起動: lp-start"
echo "   3. 開発開始: http://localhost:3000"
echo ""
echo "📚 便利なコマンド:"
echo "   lp-start    - LPlampを起動"
echo "   lp-stop     - LPlampを停止"
echo "   lp-backend  - バックエンド開発モード"
echo "   lp-frontend - フロントエンド開発モード"
echo "   lp-claude   - ClaudeCode起動"
echo ""

# bashrcを再読み込み
source ~/.bashrc

echo "🎉 セットアップ完了! 新しいターミナルセッションで開発をお楽しみください。"