# リファクタリング計画: GitHub Codespaces完全移行 2025-01-09

## 1. 現状分析

### 1.1 対象概要
LPlampは現在ローカル開発環境で実装されているが、要件定義では「GitHub Codespaces統合環境」を前提として設計されている。この乖離を解消し、要件定義通りのCodespacesネイティブアプリケーションにリファクタリングする。

### 1.2 問題点と課題

**設計思想と実装の乖離**
- 要件定義: GitHub Codespaces + ClaudeCode CLI直接実行
- 現在実装: ローカル環境 + 独自ターミナル実装

**具体的な課題**
- `.devcontainer`設定が存在しない
- ClaudeCode CLIとの直接連携が未実装
- セキュリティ要件（プロンプト暗号化）が未実装
- Codespacesワークスペース前提の設計になっていない
- 独自ターミナル実装が要件と不一致

### 1.3 関連ファイル一覧

**新規作成が必要**
- `.devcontainer/devcontainer.json`
- `.devcontainer/Dockerfile`（必要に応じて）
- `scripts/setup-claudecode.sh`
- `scripts/security/prompt-manager.sh`

**大幅変更が必要**
- `backend/src/websocket/terminal-session.ts` → ClaudeCode CLI直接実行に変更
- `backend/src/websocket/terminal-handler.ts` → ClaudeCode連携専用に特化
- `backend/package.json` → Codespaces前提の依存関係に更新
- `frontend/package.json` → Codespaces環境での動作に最適化

**設定変更が必要**
- `backend/src/app.ts` → Codespaces環境変数対応
- `backend/src/server.ts` → Codespacesポート設定
- `frontend/vite.config.ts` → Codespacesネットワーク設定

### 1.4 依存関係図

```
GitHub Codespaces
├── .devcontainer → 環境自動構築
├── ClaudeCode CLI → 直接実行
├── LPlamp Backend → Codespacesポート設定
├── LPlamp Frontend → Codespacesネットワーク設定
└── セキュリティ → GitHub Secrets + 一時ファイル管理
```

## 2. リファクタリングの目標

### 2.1 期待される成果

**環境統合**
- Codespacesでのワンクリック環境構築
- ClaudeCode CLIの直接統合
- 要件定義通りの動作実現

**セキュリティ強化**
- プロンプトのGitHub Secrets暗号化保存
- 一時ファイルのRAM上管理（/dev/shm）
- 45秒自動削除機能

**開発効率向上**
- ローカル環境不要
- どこからでもアクセス可能
- VSCode Web統合

### 2.2 維持すべき機能
- 既存のWebSocket通信基盤
- プロジェクト管理機能
- GitHub連携機能
- 認証システム
- レプリカ作成機能

## 3. 理想的な実装

### 3.1 全体アーキテクチャ

```
GitHub Codespaces Environment:
├── .devcontainer/
│   ├── devcontainer.json (ClaudeCode + LPlamp環境)
│   └── setup.sh (初期化スクリプト)
├── LPlamp Application/
│   ├── Backend (localhost:8000)
│   ├── Frontend (localhost:3000)
│   └── ClaudeCode CLI (直接実行)
├── Security/
│   ├── GitHub Secrets (暗号化プロンプト)
│   └── /dev/shm (一時ファイル)
└── Project Workspace/
    └── /workspaces/LPlamp/projects/ (プロジェクトファイル)
```

### 3.2 核心的な改善ポイント

**1. ClaudeCode直接統合**
- 独自ターミナル実装を廃止
- ClaudeCode CLIプロセスを直接起動
- WebSocketでClaudeCodeの入出力をブリッジ

**2. セキュリティ実装**
- GitHub Secretsでプロンプト管理
- 一時ファイルの安全な管理
- 自動削除機能

**3. Codespaces最適化**
- .devcontainerでの環境自動構築
- Codespacesポート設定
- VSCode Web統合

### 3.3 新しいディレクトリ構造

```
LPlamp/
├── .devcontainer/
│   ├── devcontainer.json
│   └── setup.sh
├── scripts/
│   ├── setup-claudecode.sh
│   └── security/
│       └── prompt-manager.sh
├── backend/ (既存構造維持)
├── frontend/ (既存構造維持)
└── docs/
    └── codespaces/
        ├── setup-guide.md
        └── troubleshooting.md
```

## 4. 実装計画

### フェーズ1: Codespaces環境構築
- **目標**: 基本的なCodespaces環境でLPlampが動作する状態
- **影響範囲**: 環境設定、依存関係
- **タスク**:
  1. **T1.1**: `.devcontainer/devcontainer.json`作成
     - 対象: 新規ファイル
     - 実装: Node.js 18+ 環境、必要パッケージの自動インストール
  2. **T1.2**: ClaudeCode CLI自動インストールスクリプト作成
     - 対象: `scripts/setup-claudecode.sh`
     - 実装: npm install -g @anthropic-ai/claude-code
  3. **T1.3**: package.jsonのCodespaces対応
     - 対象: `backend/package.json`, `frontend/package.json`
     - 実装: ポート設定、環境変数の更新
  4. **T1.4**: Vite設定のCodespaces対応
     - 対象: `frontend/vite.config.ts`
     - 実装: host: '0.0.0.0', port: 3000の設定
- **検証ポイント**:
  - Codespacesでの環境自動構築成功
  - フロントエンド・バックエンドの基本動作確認

### フェーズ2: ClaudeCode直接統合
- **目標**: ClaudeCode CLIとの直接連携実現
- **影響範囲**: WebSocketターミナル実装
- **タスク**:
  1. **T2.1**: TerminalSessionのClaudeCode対応
     - 対象: `backend/src/websocket/terminal-session.ts`
     - 実装: spawn('claude', args)でClaudeCode直接起動
  2. **T2.2**: ClaudeCode専用環境変数設定
     - 対象: `backend/src/websocket/terminal-session.ts:88-96`
     - 実装: ANTHROPIC_API_KEY等の環境変数設定
  3. **T2.3**: WebSocket通信のClaudeCode対応
     - 対象: `backend/src/websocket/terminal-handler.ts`
     - 実装: ClaudeCodeの入出力フォーマットに対応
  4. **T2.4**: フロントエンドのClaudeCodeターミナル最適化
     - 対象: フロントエンドコンポーネント
     - 実装: ClaudeCode特有のUI/UX調整
- **検証ポイント**:
  - ClaudeCode CLIの正常起動
  - WebSocket経由でのClaudeCode操作
  - 要素選択→ClaudeCode指示の流れ動作確認

### フェーズ3: セキュリティ実装
- **目標**: プロンプト暗号化とセキュアな一時ファイル管理
- **影響範囲**: セキュリティ機能、プロンプト管理
- **タスク**:
  1. **T3.1**: プロンプト管理スクリプト作成
     - 対象: `scripts/security/prompt-manager.sh`
     - 実装: GitHub Secretsからプロンプト復号、/dev/shmに一時保存
  2. **T3.2**: 自動削除機能実装
     - 対象: `scripts/security/prompt-manager.sh`
     - 実装: 45秒後の自動削除、trapによる確実な削除
  3. **T3.3**: ClaudeCode起動時のプロンプト自動読み込み
     - 対象: `backend/src/websocket/terminal-session.ts`
     - 実装: claude "【厳格指示】${FILEPATH}を必ず最初に読み込んでください..."
  4. **T3.4**: ファイル権限とセキュリティ設定
     - 対象: `scripts/security/prompt-manager.sh`
     - 実装: chmod 600、所有者のみアクセス可能
- **検証ポイント**:
  - GitHub Secretsからのプロンプト復号成功
  - 一時ファイルの自動削除動作確認
  - ClaudeCodeでのプロンプト自動読み込み確認

### フェーズ4: 最適化と統合テスト
- **目標**: Codespaces環境での完全動作とパフォーマンス最適化
- **影響範囲**: 全体最適化、ドキュメント整備
- **タスク**:
  1. **T4.1**: Codespacesポート設定最適化
     - 対象: `.devcontainer/devcontainer.json`
     - 実装: forwardPorts設定、portsAttributes設定
  2. **T4.2**: 環境変数の統合管理
     - 対象: `.devcontainer/devcontainer.json`
     - 実装: containerEnv設定、GitHub Secrets連携
  3. **T4.3**: セットアップガイド作成
     - 対象: `docs/codespaces/setup-guide.md`
     - 実装: 初回セットアップ手順、トラブルシューティング
  4. **T4.4**: 統合テスト実行
     - 対象: 全機能
     - 実装: URL入力→レプリカ作成→ClaudeCode編集→GitHub連携
- **検証ポイント**:
  - 全機能のCodespaces環境での動作確認
  - 要件定義通りの動作実現
  - パフォーマンス最適化完了

## 5. 期待される効果

### 5.1 コード削減
- 独自ターミナル実装削除: 約500行削減
- 重複する環境設定削除: 約200行削減
- 予想削減量: 700行 (約15%削減)

### 5.2 保守性向上
- 要件定義との完全整合
- ClaudeCode公式実装活用による安定性向上
- Codespaces標準機能活用による保守負荷軽減

### 5.3 拡張性改善
- ClaudeCode新機能の自動活用
- Codespaces環境のスケーラビリティ活用
- GitHub連携の更なる強化可能性

## 6. リスクと対策

### 6.1 潜在的リスク

**技術的リスク**
- ClaudeCode CLI の動作不安定性
- Codespaces環境での予期しない制限
- WebSocket経由でのClaudeCode制御の複雑性

**互換性リスク**
- 既存のローカル開発環境との併用困難
- ユーザーのCodespaces利用権限要件
- GitHub Secrets設定の複雑性

### 6.2 対策

**技術的対策**
- ClaudeCode CLIのフォールバック機能実装
- Codespaces制限の事前調査と回避策準備
- WebSocket通信の堅牢なエラーハンドリング

**互換性対策**
- ローカル開発モードの並行維持（環境変数での切り替え）
- Codespaces設定ガイドの詳細作成
- GitHub Secrets設定の自動化スクリプト提供

## 7. 備考

### 7.1 実装順序の重要性
フェーズは依存関係順に実行する必要があり、特にフェーズ2（ClaudeCode統合）はフェーズ1（環境構築）完了後でなければ動作確認できない。

### 7.2 要件定義整合性
この移行により、LPlampは完全に要件定義通りの「GitHub Codespacesネイティブアプリケーション」となる。

### 7.3 将来的な発展性
Codespaces統合により、以下の機能拡張が容易になる：
- 複数人での同時編集
- GitHub Actions との更なる統合
- VSCode Extensions の活用
- Container技術を活用した環境カスタマイズ