# LPlamp GitHub Codespaces セットアップガイド

## 🚀 クイックスタート

### 1. Codespacesで開く

1. GitHubでLPlampリポジトリを開く
2. 緑色の「Code」ボタンをクリック
3. 「Codespaces」タブを選択
4. 「Create codespace on main」をクリック

### 2. 自動セットアップ

Codespacesが起動すると、以下が自動実行されます：

```bash
# .devcontainer/setup.shが自動実行
✅ Node.js 18+ 環境構築
✅ ClaudeCode CLI インストール
✅ 依存関係インストール
✅ 開発用エイリアス設定
```

### 3. LPlamp起動

セットアップ完了後、以下のコマンドでLPlampを起動：

```bash
# 方法1: 統合起動（推奨）
lp-start

# 方法2: 個別起動
lp-backend  # バックエンドのみ
lp-frontend # フロントエンドのみ
```

## 📱 アクセスURL

起動後、以下のURLでアクセス可能：

- **フロントエンド**: http://localhost:3000
- **バックエンド**: http://localhost:8000

## 🤖 ClaudeCode設定

初回のみClaudeCodeの認証が必要：

```bash
# ClaudeCode起動
claude

# 初回認証画面が表示されるので、指示に従って設定
```

## ⚡ 便利なコマンド

```bash
# アプリケーション操作
lp-start     # LPlamp起動
lp-stop      # LPlamp停止
lp-claude    # ClaudeCode起動

# 開発操作
lp-backend   # バックエンド開発モード
lp-frontend  # フロントエンド開発モード
lp-build     # ビルド実行
lp-test      # テスト実行
```

## 🔧 環境変数設定

GitHub Secretsまたは`.env`ファイルで以下を設定：

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# JWT
JWT_SECRET=your_jwt_secret

# Anthropic (ClaudeCode用)
ANTHROPIC_API_KEY=your_anthropic_api_key

# プロンプトセキュリティ（GitHub Secrets推奨）
LPGENIUS_PROMPT_SECRET=your_agent_prompt
```

### 🔒 セキュリティ設定

AIエージェントプロンプトのセキュア管理：

1. **GitHub Secretsでプロンプト設定**
   - Settings → Secrets → Codespaces
   - `LPGENIUS_PROMPT_SECRET`に精密差し替えエージェントプロンプトを設定

2. **自動セキュリティ機能**
   - プロンプトは暗号化されてRAM上に一時保存
   - ClaudeCode起動時に自動読み込み
   - 45秒後に自動削除

詳細は[セキュリティ設定ガイド](./security-setup.md)を参照。

## 📁 プロジェクトディレクトリ

```
/workspaces/LPlamp/
├── .devcontainer/        # Codespaces設定
├── backend/              # バックエンドAPI
├── frontend/             # フロントエンドUI
├── projects/             # レプリカプロジェクト保存先
└── docs/                 # ドキュメント
```

## 🐛 トラブルシューティング

### ポートアクセスできない場合

1. Codespacesの「PORTS」タブを確認
2. ポート3000、8000が表示されているか確認
3. 「公開」設定になっているか確認

### ClaudeCodeが動作しない場合

```bash
# ClaudeCodeの状態確認
claude --version

# 再インストール
npm install -g @anthropic-ai/claude-code

# 認証確認
claude
```

### 依存関係エラーの場合

```bash
# 依存関係再インストール
cd /workspaces/LPlamp/backend && npm install
cd /workspaces/LPlamp/frontend && npm install
```

## 🔄 開発ワークフロー

1. **開発開始**
   ```bash
   lp-start
   ```

2. **ClaudeCode連携**
   ```bash
   lp-claude
   ```

3. **コード編集**
   - VSCode Webでファイル編集
   - ClaudeCodeで自動編集
   - ホットリロードで即座に反映

4. **テスト・ビルド**
   ```bash
   lp-test
   lp-build
   ```

5. **GitHub連携**
   - 自動コミット・プッシュ
   - GitHub Pagesデプロイ

## 📚 次のステップ

フェーズ1完了後は以下を実施：

1. **フェーズ2**: ClaudeCode直接統合
2. **フェーズ3**: セキュリティ実装
3. **フェーズ4**: 最適化と統合テスト

詳細は `/docs/refactoring/codespaces-migration-2025-01-09.md` を参照。