# フェーズ3: セキュリティ実装 - エージェント向け指示書

## 概要

このドキュメントは、LPlampプロジェクトのGitHub Codespaces移行における**フェーズ3: セキュリティ実装**を担当するエージェントへの詳細な指示書です。

## 前提条件

### 完了済みフェーズ
- **フェーズ1**: Codespaces環境構築 ✅
  - `.devcontainer/devcontainer.json` 作成済み
  - `.devcontainer/setup.sh` 作成済み
  - package.json更新済み
  
- **フェーズ2**: ClaudeCode直接統合 ✅
  - `terminal-session.ts`: ClaudeCode CLI直接起動実装済み
  - `terminal-handler.ts`: 要素情報送信機能実装済み
  - フロントエンドターミナルUI統合済み

### 現在の課題
要件定義（`/docs/requirements.md`）では、AIエージェントのプロンプトを**機密情報として暗号化管理**することが必須要件となっているが、現在は未実装。

## フェーズ3の目標

### 3.1 プロンプトのセキュア管理
- GitHub Secretsでの暗号化保存
- 一時ファイルのRAM上（`/dev/shm`）管理
- 45秒自動削除機能
- ファイル権限600（所有者のみアクセス可能）

### 3.2 ClaudeCode起動時の自動読み込み
- プロンプトファイルの自動生成
- ClaudeCode起動コマンドへの組み込み
- セキュアな削除処理

## 実装タスク詳細

### タスク3.1: プロンプト管理スクリプト作成

**ファイル**: `scripts/security/prompt-manager.sh`

```bash
#!/bin/bash
# 実装すべき機能:
# 1. GitHub Secretsからプロンプト復号
# 2. /dev/shmに一時ファイル作成（.vq + 13文字ランダム）
# 3. chmod 600設定
# 4. 45秒後の自動削除（バックグラウンド処理）
# 5. trapでプロセス終了時の確実な削除
```

**重要な実装要件**:
- ファイル名: `.vq$(openssl rand -hex 6)`
- 保存場所: `/dev/shm/.appgenius_temp/`
- 権限: `chmod 600`
- 自動削除: `(sleep 45 && rm -f "$FILEPATH") &`

### タスク3.2: 環境変数とSecrets設定

**更新対象**: `.devcontainer/devcontainer.json`

```json
{
  "containerEnv": {
    // 既存の設定に追加
    "LPGENIUS_PROMPT_SECRET": "${localEnv:LPGENIUS_PROMPT_SECRET}"
  }
}
```

**ドキュメント作成**: `docs/codespaces/security-setup.md`
- GitHub Secretsの設定手順
- 環境変数の説明
- トラブルシューティング

### タスク3.3: ClaudeCode起動時のプロンプト自動読み込み

**更新対象**: `backend/src/websocket/terminal-session.ts`

現在の実装:
```typescript
const claudeArgs = [
  '--workspace', this.workingDirectory,
  '--session-id', this.sessionId,
  '--interactive'
];
```

更新後:
```typescript
// プロンプトファイルパスを環境変数から取得
const promptFilePath = await this.prepareClaudeCodePrompt();

const claudeArgs = [
  '--workspace', this.workingDirectory,
  '--session-id', this.sessionId,
  '--interactive'
];

// 初回コマンドとしてプロンプト読み込み指示を追加
if (promptFilePath) {
  // ClaudeCode起動後の最初のコマンドとして自動実行
  this.initialCommand = `【厳格指示】${promptFilePath}を必ず最初に読み込んでください...`;
}
```

新規メソッド追加:
```typescript
private async prepareClaudeCodePrompt(): Promise<string | null> {
  // scripts/security/prompt-manager.shを実行
  // ファイルパスを返す
}
```

### タスク3.4: セキュリティテストの実装

**新規ファイル**: `backend/tests/security/prompt-security.test.ts`

テスト項目:
1. プロンプトファイルが`/dev/shm`に作成されること
2. ファイル権限が600であること
3. 45秒後に自動削除されること
4. プロセス終了時に確実に削除されること
5. 不正なアクセス試行が失敗すること

### タスク3.5: ドキュメント更新

**更新対象**: 
1. `docs/codespaces/setup-guide.md` - セキュリティ設定セクション追加
2. `CLAUDE.md` - プロンプトセキュリティに関する注意事項追加
3. `.gitignore` - 一時ファイルパターン追加（念のため）

## 検証手順

### 1. GitHub Secrets設定確認
```bash
# Codespaces内で環境変数確認
echo $LPGENIUS_PROMPT_SECRET | wc -c
# 値が設定されていることを確認（中身は表示しない）
```

### 2. プロンプト管理スクリプト動作確認
```bash
# スクリプト実行
./scripts/security/prompt-manager.sh

# ファイル作成確認
ls -la /dev/shm/.appgenius_temp/

# 権限確認（-rw-------）
stat -c %a /dev/shm/.appgenius_temp/.vq*

# 45秒後に削除確認
sleep 50 && ls /dev/shm/.appgenius_temp/
```

### 3. ClaudeCode統合確認
1. LPlamp起動
2. エディターでプロジェクト開く
3. ClaudeCodeターミナルが起動
4. プロンプトが自動読み込みされることを確認
5. `/dev/shm`の一時ファイルが削除されていることを確認

## 注意事項

### セキュリティ上の重要ポイント
1. **プロンプト内容を絶対にログ出力しない**
2. **エラー時でもプロンプト内容を表示しない**
3. **一時ファイルは必ず削除する（trap使用）**
4. **ファイル権限は必ず600に設定**

### 実装の優先順位
1. セキュリティ > 利便性
2. 確実な削除 > パフォーマンス
3. エラーハンドリング > 機能追加

## 成果物チェックリスト

- [ ] `scripts/security/prompt-manager.sh` 作成
- [ ] `.devcontainer/devcontainer.json` 更新
- [ ] `backend/src/websocket/terminal-session.ts` 更新
- [ ] `backend/tests/security/prompt-security.test.ts` 作成
- [ ] `docs/codespaces/security-setup.md` 作成
- [ ] セキュリティテストすべて合格
- [ ] ドキュメント更新完了

## 参考情報

- 要件定義: `/docs/requirements.md` セクション7.5
- 移行計画: `/docs/refactoring/codespaces-migration-2025-01-09.md` フェーズ3
- 現在の実装: `backend/src/websocket/terminal-session.ts`

---

このフェーズ完了後、プロンプトの機密性を保ちながら安全にClaudeCodeと連携できるようになります。