# LPlamp 要件定義書

**バージョン**: 1.0.0  
**最終更新日**: 2025-01-09  
**ステータス**: ドラフト  

## 1. プロジェクト概要

### 1.1 目的と背景

既存のLP/HPビルダーツールのテンプレート制限と、コーディングスキル不足の課題を解決し、参考サイトのデザインを活用しながら自社用にカスタマイズできるツールを提供します。これにより、非技術者でも高品質なLP/HPを効率的に作成できるようになります。

### 1.2 ターゲットユーザー

- **個人事業主・マーケター**: コーディングスキルはないが、高成約率のLPを作成したい
- **中小企業の担当者**: 外注コストを抑えて自社でLP/HPを管理したい
- **デザイナー**: デザインはできるがコーディングが苦手な人

### 1.3 核となる機能と価値

以下は、プロジェクトの本質的価値を提供するために「絶対に必要」な機能です。各機能は「この機能がないとプロジェクトの目的達成が不可能になる」という基準で厳選されています。

- **URLからのレプリカ作成**: 参考サイトの完全なレプリカを作成し、デザインの土台として活用 - *この機能がないと参考サイトを活用できず、ゼロから作成することになる*
- **AI支援による精密な差し替え**: セクション単位での緻密なコンテンツ差し替えをAIがサポート - *この機能がないと手作業での編集となり、レイアウト崩れのリスクが高まる*
- **要素クリックによる直感的な指示**: クリックした要素の情報をAIに自動伝達し、自然言語での指示を可能に - *この機能がないとDOM情報の手動コピペが必要となり、作業効率が大幅に低下*
- **GitHub連携による継続的デプロイ**: 編集内容をGitHubにプッシュし、自動的にWebサイトとして公開 - *この機能がないと手動でのファイル管理とアップロードが必要となり、更新が煩雑になる*

## 2. 画面一覧

このアプリケーションは以下の画面要素と実際のページで構成されます。各ページのモックアップは作成後に詳細化されます。

### 2.1 画面要素一覧

以下は機能的に必要な全ての画面要素です。これらは必ずしも独立したページとして実装されるわけではありません。

| 画面要素名 | 目的 | 実現する核心的価値 |
|----------|------|----------------|
| URL入力要素 | レプリカ作成対象の指定 | 参考サイトの取り込み |
| レプリカビューワー要素 | 作成されたレプリカの表示・編集 | ビジュアル編集環境 |
| 要素選択ツール要素 | 編集対象の特定 | 直感的な操作 |
| AI対話パネル要素 | 編集指示の入力と結果表示 | 自然言語での編集 |
| バリエーション表示要素 | 複数案の比較選択 | 最適なデザイン選択 |
| 履歴管理要素 | 変更履歴の確認と復元 | 安心して試行錯誤 |
| プロジェクト管理要素 | 複数プロジェクトの管理 | 効率的な作業管理 |
| エクスポート要素 | 完成したLP/HPの書き出し | 成果物の納品 |
| GitHub連携要素 | GitHubリポジトリとの連携 | 自動デプロイ環境 |
| デプロイ管理要素 | デプロイ状況の確認と管理 | 継続的な更新 |

### 2.2 ページ構成計画

上記の画面要素を、ユーザー体験とナビゲーション効率を最適化するために以下のように統合・構成します。

#### 2.2.1 メインページ

| ID | ページ名 | 主な目的 | 含まれる画面要素 | 優先度 | モックアップ | 実装状況 |
|----|---------|---------|----------------|-------|------------|---------|
| M-000 | ログイン | GitHub認証でのログイン | GitHub OAuth認証ボタン | 高 | [login.html](/mockups/login.html) | 完了 |
| M-001 | ダッシュボード | プロジェクト一覧と新規作成 | プロジェクト管理要素、URL入力要素、デプロイ管理要素 | 高 | [dashboard.html](/mockups/dashboard.html) | 完了 |
| M-002 | エディター | レプリカの編集作業 | レプリカビューワー要素、要素選択ツール要素、AI対話パネル要素、バリエーション表示要素、履歴管理要素 | 高 | [editor.html](/mockups/editor.html) | 完了 |
| M-003 | エクスポート＆デプロイ | 完成物の書き出しとデプロイ | エクスポート要素、GitHub連携要素、デプロイ管理要素 | 高 | [export.html](/mockups/export.html) | 完了 |

### 2.3 主要ルート定義

| パス | ページID | 説明 |
|------|---------|------|
| `/login` | M-000 | ログインページ |
| `/` | M-001 | ダッシュボード（認証必須） |
| `/editor/:projectId` | M-002 | プロジェクトエディター |
| `/export/:projectId` | M-003 | エクスポート画面 |

### 2.4 特殊な画面遷移

- 未認証ユーザーがダッシュボードにアクセスした場合、ログインページへリダイレクト
- GitHub認証完了後、ダッシュボードへ自動遷移
- URL入力後、自動的にエディター画面へ遷移
- エクスポート完了後、ダッシュボードへ戻る

### 2.5 共通レイアウト構成

#### レイアウトパターン
- **ダッシュボード用**: シンプルなヘッダーのみ
- **エディター用**: ヘッダー + ツールバー + サイドパネル（AI対話）

#### ヘッダー要素
- アプリケーションロゴ
- プロジェクト名表示
- 保存状態インジケーター
- ヘルプリンク

## 3. ページ詳細

### 3.0 ログイン (M-000)
**モックアップ**: [login.html](/mockups/login.html)

**ページ概要**: GitHub OAuth認証を使用したシンプルなログイン画面

**含まれる要素**:
- アプリケーションロゴ: グラデーション背景のLPアイコン
- アプリケーション名とキャッチコピー: "参考サイトから理想のLP/HPを簡単作成"
- GitHubログインボタン: GitHubアイコン付きの黒いボタン
- フッターリンク: プライバシーポリシーと利用規約へのリンク

**状態と動作**:
- 初期ロード時: 認証状態を自動確認、認証済みの場合は自動リダイレクトメッセージを表示
- 未認証時: GitHubログインボタンを表示
- ログインボタンクリック時: ボタンを非表示にし、ローディングスピナーを表示
- 認証処理中: "認証中..."のメッセージとスピナーアニメーション
- 認証成功時: ダッシュボードへ1.5秒後に自動リダイレクト
- 認証失敗時: エラーメッセージを5秒間表示後、自動的に非表示
- 認証済みユーザー: "ログイン済みです。ダッシュボードへリダイレクトしています..."を表示

**データとAPI**:
- `GET /api/auth/status` → 認証状態確認（既にログイン済みの場合ダッシュボードへ）
  - レスポンス: { authenticated: boolean, user?: User }
- `GET /api/auth/github/login` → GitHub認証開始
  - レスポンス: { redirectUrl: string }
  - エラー: 500 "Authentication service unavailable"
- GitHub認証完了後、`/api/auth/github/callback`で処理
  - 成功時: JWTトークンをCookieに設定、ダッシュボードへリダイレクト
  - 失敗時: エラーメッセージと共にログインページへリダイレクト

### 3.1 ダッシュボード (M-001)
**モックアップ**: [dashboard.html](/mockups/dashboard.html)

**ページ概要**: プロジェクトの素早い開始・再開を実現する起点画面。URL入力を常時表示し、操作ステップを最小化

**含まれる要素**:
- URL入力フィールド: 常時表示され、即座に作成開始可能
- 作成開始ボタン: URL検証後に有効化、エンターキーでも実行可能
- プロジェクトカード: サムネイル、プロジェクト名、URL、作成日時、更新日時を表示
- もっと見るボタン: 3件を超えるプロジェクトがある場合のみ表示

**アクセス制御**:
- 認証必須ページ（未認証ユーザーはログインページへリダイレクト）

**状態と動作**:
- 認証確認: ページロード時に認証状態を確認
- 初期ロード: 最新3件のプロジェクトを表示、それ以上は折りたたみ
- URL入力中: リアルタイムで妥当性を検証（http/https必須）
- 作成開始時: ローディングオーバーレイを表示し、レプリカ作成処理を開始
- 作成完了時: エディター画面（/editor/:projectId）へ自動遷移
- プロジェクトクリック時: 該当プロジェクトのエディター画面へ遷移
- 空の状態: プロジェクトが0件の場合、専用の空状態UIを表示

**データとAPI**:
- Project: { id: string, name: string, url: string, thumbnail: string | null, createdAt: string, updatedAt: string }
- `GET /api/projects` → プロジェクト一覧取得
  - レスポンス: { projects: Project[] }
  - エラー: 500 "Failed to fetch projects"
- `POST /api/projects/create` → レプリカ作成開始
  - リクエスト: { url: string }
  - 成功: { projectId: string, status: 'processing' }
  - エラー: 400 "Invalid URL format" / 500 "Server Error"
- `GET /api/projects/:id/status` → 作成ステータス確認
  - レスポンス: { status: 'processing' | 'completed' | 'failed', progress?: number }
  - エラー: 404 "Project not found"

### 3.2 エディター (M-002)
**モックアップ**: [editor.html](/mockups/editor.html)

**ページ概要**: レプリカの編集作業を効率的に行うための統合環境。要素選択から編集実行まで最小限のステップで完了

**アクセス制御**:
- 認証必須ページ
- 自分が作成したプロジェクトのみアクセス可能

**含まれる要素**:
- レプリカビューワー: 編集対象のレプリカを表示、要素選択可能
- 要素選択オーバーレイ: ホバー時に青枠でハイライト表示
- 浮動ツールバー: 選択時のみ表示される3つのアクションボタン
  - テキストを直接編集: contentEditableモードで即座に編集
  - 画像を差し替え: URLまたはファイル選択で画像変更
  - AIで編集: 自然言語での編集指示を入力
- AI対話ターミナル: 画面下部または右サイドに表示されるClaudeCodeターミナル（切り替え可能）
- ClaudeCode入出力: ターミナル形式でのコマンド入力と応答表示

**状態と動作**:
- 初期状態: レプリカのみ表示、UIは最小限
- 要素ホバー時: 青い半透明オーバーレイで対象を明示
- 要素選択時: 
  - 選択要素の情報（タグ名、テキスト内容）を表示
  - 浮動ツールバーを要素の上部に表示
- テキスト直接編集時: 選択要素をその場で編集可能に
- AI編集時:
  - ClaudeCodeターミナルが展開（下部または右サイド）
  - 要素情報が自動的にClaudeCodeのコンテキストに追加
  - ターミナルで直接ClaudeCodeコマンドを実行
  - ClaudeCodeの応答と編集結果をリアルタイム表示
  - ファイル変更は自動的にレプリカビューワーに反映
- 編集完了時: ターミナルは表示したまま（最小化可能）

**データとAPI**:
- 要素情報: { selector: string, tagName: string, text: string, html: string, styles: { color, backgroundColor, fontSize, fontFamily } }
- `POST /api/element/context` → 要素情報をClaudeCodeに渡す
  - リクエスト: { element: ElementInfo, projectId: string }
  - 成功: { contextId: string, message: string }
- `WebSocket /ws/terminal` → ClaudeCodeターミナルのストリーミング
  - 入力: { type: 'input', data: string }
  - 出力: { type: 'output', data: string }
- ファイル監視: Codespacesのファイルシステムを監視し、変更を自動検出

### 3.3 エクスポート＆デプロイ (M-003)
**モックアップ**: [export.html](/mockups/export.html)

**ページ概要**: 完成したLP/HPの書き出しとGitHub経由での自動デプロイ

**アクセス制御**:
- 認証必須ページ
- 自分が作成したプロジェクトのみアクセス可能

**含まれる要素**:
- プレビュー: 最終確認用の表示（デスクトップ/タブレット/モバイル切り替え）
- エクスポート設定: 形式選択（HTML/ZIP）、ローカルダウンロードボタン
- GitHub連携セクション:
  - GitHub認証ボタン（未認証時）
  - リポジトリ選択/新規作成
  - ブランチ選択
  - コミットメッセージ入力
- デプロイ設定:
  - デプロイ先選択（GitHub Pages/Vercel/Netlify）
  - カスタムドメイン設定（オプション）
  - デプロイステータス表示
- アクションボタン:
  - ローカルダウンロード
  - GitHubにプッシュ
  - デプロイ実行

**状態と動作**:
- 初期状態: プレビューとエクスポートオプションを表示
- GitHub未認証時: 認証を促すUIを表示
- GitHub認証済み時: リポジトリ一覧を取得・表示
- プッシュ実行時: 
  1. 最適化されたファイルを生成
  2. 選択したリポジトリ/ブランチにコミット
  3. 自動的にデプロイをトリガー
- デプロイ中: プログレスバーとログを表示
- デプロイ完了時: 公開URLを表示、「サイトを開く」ボタンを有効化

**データとAPI**:
- `GET /api/auth/github/status` → GitHub認証状態確認
  - レスポンス: { authenticated: boolean, username?: string }
- `GET /api/github/repos` → リポジトリ一覧取得
  - レスポンス: { repos: Repository[] }
- `POST /api/export/prepare` → エクスポートファイル準備
  - リクエスト: { projectId: string, format: 'html' | 'zip', optimize: boolean }
  - レスポンス: { exportId: string, files: FileInfo[] }
- `POST /api/github/push` → GitHubへプッシュ
  - リクエスト: { exportId: string, repo: string, branch: string, message: string }
  - レスポンス: { commitHash: string, success: boolean }
- `POST /api/deploy/trigger` → デプロイ実行
  - リクエスト: { repo: string, provider: 'github-pages' | 'vercel' | 'netlify' }
  - レスポンス: { deploymentId: string, status: 'pending' }
- `GET /api/deploy/:id/status` → デプロイ状況確認
  - レスポンス: { status: 'pending' | 'building' | 'ready' | 'error', url?: string, logs?: string[] }

## 4. データモデル概要

### 4.1 主要エンティティ

| エンティティ | 主な属性 | 関連エンティティ | 備考 |
|------------|----------|----------------|------|
| User | id, githubId, username, email, avatarUrl, lastLoginAt, createdAt, updatedAt | Project | ユーザー情報 |
| Project | id, userId, name, originalUrl, githubRepo, deploymentUrl, createdAt, updatedAt | User, History, Export, Deployment | プロジェクトの基本情報 |
| History | id, projectId, timestamp, snapshot, description | Project | 変更履歴の管理 |
| Element | selector, content, styles, metadata | - | 編集対象要素の情報 |
| Variation | id, elementId, content, preview | Element | AI提案のバリエーション |
| Export | id, projectId, format, url, createdAt | Project | エクスポート履歴 |
| Deployment | id, projectId, provider, status, url, deployedAt | Project | デプロイ履歴と状態 |
| GitHubAuth | userId, accessToken, username, repos | User | GitHub認証情報 |

## 5. 特記すべき非機能要件

以下は標準的な実装方針から特に注意すべき点です：

- **大規模サイト対応**: 
  - 画像やリソースが多いサイトでも確実にレプリカを作成できること
  - GitHubの100MBファイル制限を考慮し、大きなファイルは自動圧縮または除外
  - 必要に応じてGit LFSの利用を提案
- **リアルタイムプレビュー**: 編集結果を即座に確認できるレスポンス性能
- **データ永続性**: Codespacesのワークスペースに作業内容が保持されること
- **同時編集制御**: 複数タブで同じプロジェクトを開いた際の整合性確保
- **Codespaces前提条件**: 
  - GitHubアカウントとCodespacesの利用権限が必要
  - 初回セットアップ時にClaudeCodeのインストールと認証が必要
  - `.devcontainer`設定による環境の自動構築
- **セキュリティ要件**:
  - AIエージェントプロンプトは機密情報として扱い、GitHub Secretsで暗号化保存
  - 一時ファイルはRAM上（/dev/shm）に作成し、45秒後に自動削除
  - ファイル権限は600に設定し、所有者のみアクセス可能
- **認証要件**:
  - GitHub OAuth 2.0を使用したシングルサインオン
  - JWTでのセッション管理（有効期間30日）
  - すべてのプロジェクトはユーザーに紐付け

## 6. 機能中心ディレクトリ構造

### 6.1 バックエンド構造

```
backend/
├── src/
│   ├── common/                       # 全機能で共有する共通コード
│   │   ├── middlewares/              # 共通ミドルウェア
│   │   │   ├── auth.middleware.ts    # 認証ミドルウェア
│   │   │   ├── error.middleware.ts   # エラーハンドリング
│   │   │   └── validation.middleware.ts # バリデーション
│   │   ├── utils/                    # ユーティリティ
│   │   │   ├── logger.ts             # ロギング
│   │   │   └── response.ts           # レスポンスフォーマッター
│   │   └── validators/               # 共通バリデーター
│   │       └── url.validator.ts      # URL検証
│   │
│   ├── features/                     # 機能ごとにグループ化
│   │   ├── projects/                 # プロジェクト管理機能
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   ├── projects.routes.ts
│   │   │   └── projects.types.ts    # 機能固有の追加型
│   │   │
│   │   ├── replica/                  # レプリカ作成・管理機能
│   │   │   ├── replica.controller.ts
│   │   │   ├── replica.service.ts
│   │   │   ├── replica.routes.ts
│   │   │   ├── puppeteer.service.ts # スクレイピング処理
│   │   │   └── replica.types.ts
│   │   │
│   │   ├── editor/                   # 編集機能
│   │   │   ├── editor.controller.ts
│   │   │   ├── editor.service.ts
│   │   │   ├── editor.routes.ts
│   │   │   ├── claude.service.ts     # ClaudeCode連携
│   │   │   └── editor.types.ts
│   │   │
│   │   ├── history/                  # 履歴管理機能
│   │   │   ├── history.controller.ts
│   │   │   ├── history.service.ts
│   │   │   ├── history.routes.ts
│   │   │   └── history.types.ts
│   │   │
│   │   ├── export/                   # エクスポート機能
│   │   │   ├── export.controller.ts
│   │   │   ├── export.service.ts
│   │   │   ├── export.routes.ts
│   │   │   ├── optimizer.service.ts  # ファイル最適化
│   │   │   └── export.types.ts
│   │   │
│   │   ├── github/                   # GitHub連携機能
│   │   │   ├── github.controller.ts
│   │   │   ├── github.service.ts
│   │   │   ├── github.routes.ts
│   │   │   ├── oauth.service.ts      # OAuth認証
│   │   │   └── github.types.ts
│   │   │
│   │   └── deploy/                   # デプロイ機能
│   │       ├── deploy.controller.ts
│   │       ├── deploy.service.ts
│   │       ├── deploy.routes.ts
│   │       ├── providers/            # プロバイダー別実装
│   │       │   ├── github-pages.ts
│   │       │   ├── vercel.ts
│   │       │   └── netlify.ts
│   │       └── deploy.types.ts
│   │
│   ├── types/                        # フロントエンドと同期する型定義
│   │   └── index.ts                  # バックエンド用型定義とAPIパス
│   │
│   ├── config/                       # アプリケーション設定
│   │   ├── database.ts               # データベース設定
│   │   ├── environment.ts            # 環境変数
│   │   └── codespaces.ts             # Codespaces固有設定
│   │
│   ├── db/                           # データベース関連
│   │   ├── migrations/               # マイグレーション
│   │   └── seeds/                    # シードデータ
│   │
│   ├── websocket/                    # WebSocket処理
│   │   └── terminal.gateway.ts       # ClaudeCodeターミナル
│   │
│   └── app.ts                        # アプリケーションエントリーポイント
│
├── tests/                            # テストファイル
├── package.json
└── tsconfig.json
```

### 6.2 フロントエンド構造

```
frontend/
├── src/
│   ├── types/                        # バックエンドと同期する型定義
│   │   └── index.ts                  # APIパスと型定義（単一の真実源）
│   │
│   ├── layouts/                      # 共通レイアウト
│   │   ├── MainLayout.tsx            # メインレイアウト（ヘッダー含む）
│   │   └── EditorLayout.tsx          # エディター専用レイアウト
│   │
│   ├── pages/                        # ページコンポーネント
│   │   ├── Dashboard.tsx             # M-001: ダッシュボード
│   │   ├── Editor.tsx                # M-002: エディター
│   │   └── Export.tsx                # M-003: エクスポート＆デプロイ
│   │
│   ├── components/                   # 再利用可能なコンポーネント
│   │   ├── common/                   # 汎用UI部品
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Modal/
│   │   │   └── LoadingOverlay/
│   │   │
│   │   └── features/                 # 機能別コンポーネント
│   │       ├── projects/             # プロジェクト関連
│   │       │   ├── ProjectCard.tsx
│   │       │   ├── ProjectGrid.tsx
│   │       │   └── URLInput.tsx
│   │       │
│   │       ├── editor/               # エディター関連
│   │       │   ├── ReplicaViewer.tsx
│   │       │   ├── ElementSelector.tsx
│   │       │   ├── FloatingToolbar.tsx
│   │       │   └── ClaudeCodeTerminal.tsx
│   │       │
│   │       ├── export/               # エクスポート関連
│   │       │   ├── PreviewPanel.tsx
│   │       │   ├── ExportOptions.tsx
│   │       │   └── DeployStatus.tsx
│   │       │
│   │       └── github/               # GitHub連携
│   │           ├── GitHubAuth.tsx
│   │           ├── RepoSelector.tsx
│   │           └── CommitForm.tsx
│   │
│   ├── services/                     # API接続層（差し替えの中心）
│   │   ├── api/                      # 実API接続実装
│   │   │   ├── client.ts             # APIクライアント基盤
│   │   │   ├── projects.api.ts      # プロジェクトAPI
│   │   │   ├── replica.api.ts       # レプリカAPI
│   │   │   ├── editor.api.ts        # 編集API
│   │   │   ├── export.api.ts        # エクスポートAPI
│   │   │   ├── github.api.ts        # GitHub API
│   │   │   └── deploy.api.ts        # デプロイAPI
│   │   │
│   │   ├── mock/                     # モックデータ・ロジック
│   │   │   ├── data/                 # モックデータ定義
│   │   │   │   ├── projects.mock.ts
│   │   │   │   └── github.mock.ts
│   │   │   └── handlers/             # モックハンドラー
│   │   │       ├── projects.handler.ts
│   │   │       └── github.handler.ts
│   │   │
│   │   └── index.ts                  # 統合層（自動フォールバック）
│   │
│   ├── hooks/                        # カスタムフック
│   │   ├── useApi.ts                 # API呼び出し汎用フック
│   │   ├── useAuth.ts                # 認証状態管理
│   │   ├── useWebSocket.ts           # WebSocket接続
│   │   └── useProject.ts             # プロジェクト操作
│   │
│   ├── contexts/                     # グローバル状態管理
│   │   ├── AuthContext.tsx           # 認証コンテキスト
│   │   ├── ProjectContext.tsx        # プロジェクトコンテキスト
│   │   └── TerminalContext.tsx       # ターミナル状態
│   │
│   ├── routes/                       # ルーティング設定
│   │   ├── index.tsx                 # メインルーター
│   │   └── ProtectedRoute.tsx        # 認証ガード
│   │
│   ├── utils/                        # ユーティリティ
│   │   ├── mockIndicator.ts          # モック使用状態の表示制御
│   │   ├── validators.ts             # フォームバリデーション
│   │   └── formatters.ts             # データフォーマッター
│   │
│   └── styles/                       # スタイル定義
│       ├── globals.css               # グローバルスタイル
│       └── theme.ts                  # テーマ定義
│
├── public/                           # 静的ファイル
├── package.json
└── tsconfig.json
```

### 6.3 ディレクトリ構造の設計思想

1. **機能単位の分割**
   - 技術的な層（controllers, services）ではなく、ビジネス機能でディレクトリを分割
   - 各機能ディレクトリは自己完結的で、関連するすべてのコードを含む

2. **型定義の一元管理**
   - フロントエンドとバックエンドで完全に同一の型定義ファイルを使用
   - APIパスも型定義ファイルで管理し、ハードコードを防止

3. **モックファースト開発**
   - フロントエンドはモックデータで完全に動作
   - APIが完成次第、services/index.tsの切り替えのみで移行可能

4. **非技術者への配慮**
   - 機能名から何をするコードか明確に分かる構造
   - 技術用語を最小限に抑えた命名

## 7. 開発計画とマイルストーン

| フェーズ | 内容 | 期間 | ステータス |
|---------|------|------|----------|
| フェーズ0 | 認証システム実装（GitHub OAuth、JWT、ログインページ） | 1週間 | 未着手 |
| フェーズ1 | 基本機能実装（URL入力、レプリカ作成、要素選択） | 2週間 | 未着手 |
| フェーズ2 | AI連携機能（要素情報伝達、編集提案、適用） | 3週間 | 未着手 |
| フェーズ3 | 高度な機能（履歴管理、バリエーション表示、エクスポート） | 2週間 | 未着手 |
| フェーズ4 | UI/UX改善とパフォーマンス最適化 | 1週間 | 未着手 |

## 7. 技術構成案

### 7.1 推奨アーキテクチャ

**GitHub Codespaces統合環境**を推奨します。

理由：
- 完全なクラウド環境でローカル環境不要
- どこからでもアクセス可能
- ClaudeCode CLIの全機能を活用
- GitHubとの自然な連携
- VSCode Web UIとの統合

### 7.2 主要技術スタック案

- **実行環境**: GitHub Codespaces
- **フロントエンド**: React/Vue.js + TypeScript
- **Webサーバー**: Node.js + Express（Codespaces内で実行）
- **レプリカ作成**: Puppeteer（Codespaces内で実行）
- **AI連携**: ClaudeCode CLI（直接実行）
- **データ保存**: Codespacesワークスペース内
- **ターミナルUI**: xterm.js（ClaudeCode表示用）
- **認証**: GitHub OAuth 2.0 + JWT

### 7.3 Codespaces環境構成

```
GitHub Codespaces内:
├── レプリカビューワー (localhost:3000)
├── ClaudeCode CLI (ターミナル)
├── プロジェクトファイル
└── .devcontainer/
    └── devcontainer.json (環境設定)
```

### 7.4 セットアップ手順

1. GitHubリポジトリをCodespacesで開く
2. 自動的に`.devcontainer`の設定に基づいて環境構築
3. ClaudeCodeのインストール: `npm install -g @anthropic-ai/claude-code`
4. ClaudeCodeの認証: `claude` コマンドで初回OAuth認証
5. Webサーバー起動: `npm run dev`でレプリカビューワーを起動

### 7.5 プロンプトセキュリティ

AIエージェントのプロンプトは機密情報として扱い、以下のセキュリティ対策を実装：

#### 実装方式：Codespaces Secrets + 環境変数

1. **プロンプトの保存**
   - GitHub Secretsに暗号化して保存
   - 環境変数名: `LPGENIUS_PROMPT_SECRET`

2. **一時ファイル管理**
   ```bash
   # 保存場所: RAM上のtmpfs（ディスクに書き込まない）
   TEMP_DIR="/dev/shm/.appgenius_temp"
   
   # ファイル名: .vq{13文字のランダム文字列}
   FILENAME=".vq$(openssl rand -hex 6)"
   
   # ファイル権限: 600（所有者のみ読み書き可能）
   chmod 600 "$FILEPATH"
   ```

3. **自動削除機能**
   - 45秒後に自動削除
   - プロセス終了時に確実に削除（trap使用）

4. **ClaudeCode起動コマンド**
   ```bash
   claude "【厳格指示】${FILEPATH}を必ず最初に読み込んでください..."
   ```

この実装により、プロンプトの機密性を保ちながら、安全にClaudeCodeと連携できます。

## 8. 添付資料

- 精密差し替えエージェントプロンプト: ユーザー提供のAI用プロンプトテンプレート
- 参考ワークフロー図: 理想的な作業フローの視覚化（作成予定）