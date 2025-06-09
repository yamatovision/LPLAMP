# アクセス制御マトリックス

## 1. 概要

このドキュメントでは、LPlampプロジェクトの初期バージョン（個人利用版）におけるアクセス制御を定義します。シンプルな「認証済み/未認証」の2段階制御から始め、将来的なロールベース制御への拡張パスを明確にします。

## 2. ユーザーロール定義（現在）

### 2.1 個人利用版のロール

| ロールID | ロール名 | 説明 | 実装状況 |
|----------|----------|------|----------|
| AUTHENTICATED | 認証済みユーザー | GitHub認証を完了したユーザー | Phase 1 |
| ANONYMOUS | 匿名ユーザー | 未認証の訪問者 | Phase 1 |

### 2.2 将来のロール拡張

| ロールID | ロール名 | 説明 | 実装予定 |
|----------|----------|------|----------|
| SUPER_ADMIN | スーパー管理者 | システム全体の管理者 | Phase 3 |
| ADMIN | 組織管理者 | 組織内の管理権限 | Phase 3 |
| USER | 一般ユーザー | 基本的な利用権限 | Phase 3 |
| VIEWER | 閲覧者 | 読み取り専用権限 | Phase 3 |

## 3. リソースとアクション定義

### 3.1 リソース一覧

| リソース | 説明 | 識別子 |
|----------|------|--------|
| Project | LP/HPプロジェクト | projectId |
| Replica | レプリカデータ | projectId |
| History | 編集履歴 | projectId, historyId |
| Export | エクスポートデータ | projectId, exportId |
| Deployment | デプロイメント | projectId, deploymentId |
| User | ユーザー情報 | userId |
| GitHubAuth | GitHub認証情報 | userId |

### 3.2 アクション定義

- **C**: Create（作成）
- **R**: Read（読取）
- **U**: Update（更新）
- **D**: Delete（削除）
- **E**: Execute（実行）- 特殊操作用

## 4. アクセス制御マトリックス（Phase 1: 個人利用版）

### 4.1 基本ルール

個人利用版では、以下のシンプルなルールを適用：
- **認証済みユーザー**: 自分のリソースにフルアクセス
- **匿名ユーザー**: 認証関連エンドポイントのみアクセス可

### 4.2 詳細マトリックス

| リソース | アクション | AUTHENTICATED | ANONYMOUS | 備考 |
|----------|------------|---------------|-----------|------|
| **Project** | | | | |
| | C | ✓ | ✗ | 自分のプロジェクトを作成 |
| | R | ✓* | ✗ | 自分のプロジェクトのみ |
| | U | ✓* | ✗ | 自分のプロジェクトのみ |
| | D | ✓* | ✗ | 自分のプロジェクトのみ |
| **Replica** | | | | |
| | C | ✓* | ✗ | 自分のプロジェクトに対して |
| | R | ✓* | ✗ | 自分のプロジェクトのレプリカ |
| | U | ✓* | ✗ | 自分のプロジェクトのレプリカ |
| **History** | | | | |
| | R | ✓* | ✗ | 自分のプロジェクトの履歴 |
| | E (revert) | ✓* | ✗ | 履歴への復元 |
| **Export** | | | | |
| | C | ✓* | ✗ | 自分のプロジェクトをエクスポート |
| | R | ✓* | ✗ | エクスポート履歴の確認 |
| **Deployment** | | | | |
| | C | ✓* | ✗ | デプロイ実行 |
| | R | ✓* | ✗ | デプロイ状態確認 |
| **User** | | | | |
| | R | ✓† | ✗ | 自分の情報のみ |
| | U | ✓† | ✗ | 自分の情報のみ |
| **GitHubAuth** | | | | |
| | C | ✗ | ✓ | 認証フローで自動作成 |
| | R | ✓† | ✗ | 自分の認証状態のみ |
| | D | ✓† | ✗ | ログアウト |

凡例：
- ✓: 許可
- ✗: 禁止
- *: 自分が作成したプロジェクト関連のリソースのみ
- †: 自分のアカウント情報のみ

## 5. API エンドポイントごとのアクセス制御

### 5.1 認証不要エンドポイント

```typescript
// 誰でもアクセス可能
PUBLIC_ENDPOINTS = [
  'GET /api/auth/status',
  'GET /api/auth/github/login',
  'GET /api/auth/github/callback',
  'GET /api/health',  // ヘルスチェック
];
```

### 5.2 認証必須エンドポイント

```typescript
// 認証済みユーザーのみアクセス可能
AUTHENTICATED_ENDPOINTS = [
  // プロジェクト管理
  'GET /api/projects',
  'POST /api/projects/create',
  'GET /api/projects/:projectId',
  'PUT /api/projects/:projectId',
  'DELETE /api/projects/:projectId',
  
  // レプリカ操作
  'GET /api/projects/:projectId/replica',
  'PUT /api/projects/:projectId/replica',
  
  // 編集機能
  'POST /api/element/context',
  'GET /api/projects/:projectId/variations',
  
  // 履歴管理
  'GET /api/projects/:projectId/history',
  'POST /api/projects/:projectId/history/:historyId/revert',
  
  // エクスポート
  'POST /api/export/prepare',
  'GET /api/export/:exportId/download',
  
  // GitHub連携
  'GET /api/github/repos',
  'POST /api/github/push',
  
  // デプロイ
  'POST /api/deploy/trigger',
  'GET /api/deploy/:deploymentId/status',
  
  // ユーザー情報
  'GET /api/auth/me',
  'POST /api/auth/logout',
];
```

## 6. 実装ガイドライン

### 6.1 バックエンドでの実装

#### 基本的な認証チェック

```typescript
// すべての保護されたルートに適用
router.use('/api/projects*', requireAuth);
router.use('/api/element*', requireAuth);
router.use('/api/export*', requireAuth);
router.use('/api/github*', requireAuth);
router.use('/api/deploy*', requireAuth);
```

#### リソース所有者チェック

```typescript
// プロジェクト所有者チェックミドルウェア
export async function checkProjectOwner(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId;
  const userId = req.user.id;
  
  const project = await projectService.findById(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'プロジェクトが見つかりません' });
  }
  
  if (project.userId !== userId) {
    return res.status(403).json({ 
      error: 'このプロジェクトへのアクセス権限がありません',
      code: 'FORBIDDEN'
    });
  }
  
  req.project = project;
  next();
}

// 使用例
router.get('/api/projects/:projectId', 
  requireAuth, 
  checkProjectOwner,
  projectController.getProject
);
```

### 6.2 フロントエンドでの実装

#### 認証状態に基づくルート保護

```typescript
// ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading]);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return isAuthenticated ? <>{children}</> : null;
}
```

#### 認証状態に基づくUI制御

```typescript
// 条件付きレンダリング例
function ProjectList() {
  const { user } = useAuth();
  const { projects } = useProjects();
  
  return (
    <div>
      <h1>マイプロジェクト</h1>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

## 7. エラーハンドリング

### 7.1 標準エラーレスポンス

```typescript
// 401 Unauthorized - 認証が必要
{
  "error": "認証が必要です",
  "code": "AUTH_REQUIRED"
}

// 403 Forbidden - 権限不足
{
  "error": "このリソースへのアクセス権限がありません",
  "code": "FORBIDDEN"
}

// 404 Not Found - リソースが存在しない
{
  "error": "指定されたリソースが見つかりません",
  "code": "NOT_FOUND"
}
```

### 7.2 フロントエンドでのエラー処理

```typescript
// API呼び出しの共通エラーハンドラー
export function handleApiError(error: any) {
  if (error.response?.status === 401) {
    // 認証エラー: ログイン画面へリダイレクト
    authService.logout();
    window.location.href = '/login';
  } else if (error.response?.status === 403) {
    // 権限エラー: エラーメッセージ表示
    toast.error('このリソースへのアクセス権限がありません');
  } else {
    // その他のエラー
    toast.error('エラーが発生しました');
  }
}
```

## 8. 将来の拡張計画

### 8.1 Phase 2: 基本的な共有機能

- プロジェクトの読み取り専用共有
- 共有URLの生成
- 共有プロジェクトの一覧表示

### 8.2 Phase 3: 完全なRBAC実装

1. **組織（Organization）の導入**
   - 組織単位でのユーザー管理
   - 組織内でのプロジェクト共有

2. **詳細な権限レベル**
   - プロジェクトごとの権限設定
   - カスタムロールの作成

3. **権限の継承**
   - 組織 → プロジェクト → リソース

### 8.3 実装時の考慮事項

```typescript
// 将来の権限チェック関数の例
export function can(
  user: User,
  action: Action,
  resource: Resource,
  context?: any
): boolean {
  // Phase 1: シンプルな所有者チェック
  if (resource.userId === user.id) {
    return true;
  }
  
  // Phase 2: 共有チェック
  // if (isSharedWith(user, resource, 'read') && action === 'read') {
  //   return true;
  // }
  
  // Phase 3: ロールベースチェック
  // const userRole = getUserRole(user, resource);
  // return hasPermission(userRole, action, resource.type);
  
  return false;
}
```

## 9. セキュリティベストプラクティス

1. **最小権限の原則**
   - 必要最小限の権限のみ付与
   - デフォルトは「拒否」

2. **明示的な許可**
   - 許可は明示的に定義
   - 暗黙的な許可は避ける

3. **監査ログ**
   - 重要な操作はログに記録
   - 特に削除・更新操作

4. **定期的なレビュー**
   - アクセス制御の定期的な見直し
   - 不要な権限の削除