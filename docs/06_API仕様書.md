# API仕様書 — BrainDump

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-05-23 | 初版（/api/chat・/api/config・/api/suggest-categories） |
| 1.1 | 2026-05-24 | GET /api/messages・update_task ツール追加 |
| 2.0 | 2026-05-24 | GET /api/tasks 追加・全APIにLINE認証ヘッダー必須化・Dropboxリフレッシュトークン対応 |
| 3.0 | 2026-05-30 | Phase 1/2 API・メンバーコンテキスト・tasks スコープ・auth 追補 |
| 4.0 | 2026-06-15 | prompts API・chat 拡張レスポンス・list_insights/list_prompts タグ絞り込み |

---

## 1. 共通仕様

### 認証

全APIエンドポイント（`/api/config` 除く）は `Authorization` ヘッダーにLINEアクセストークンが必要です。

```
Authorization: Bearer <liff.getAccessToken()で取得したトークン>
```

サーバー側では `GET https://api.line.me/v2/profile` に当該トークンを送信し検証します。  
検証失敗時は `401 Unauthorized` を返します。

法人メンバー向け API は、検証後に `members` を解決し `lib/data-scope.js` でクエリを絞り込みます。  
未登録ユーザーは `legacy: true` として従来の `line_user_id` スコープのみ適用します。

### CORS

全エンドポイントは `Access-Control-Allow-Origin: *` を返します。

### エラーレスポンス

```json
{ "error": "エラーメッセージ" }
```

---

## 2. エンドポイント一覧

| メソッド | パス | 認証 | 概要 |
|--------|------|------|------|
| `POST` | `/api/chat` | 必須 | チャットメッセージ処理（OpenAI + Supabase） |
| `GET` | `/api/config` | 不要 | Supabase接続設定取得 |
| `GET` | `/api/messages` | 必須 | チャット履歴取得（直近12時間） |
| `GET` | `/api/tasks` | 必須 | 未完了タスク一覧取得 |
| `POST` | `/api/tasks` | 必須 | タスク直接追加 |
| `PATCH` | `/api/tasks` | 必須 | タスク完了 |
| `GET` | `/api/prompts` | 必須 | プロンプト一覧取得（`?tag=` 絞り込み可） |
| `POST` | `/api/prompts` | 必須 | プロンプト直接追加 |
| `POST` | `/api/suggest-categories` | 必須 | AIカテゴリ提案（気づき/プロンプト） |
| `POST` | `/api/transcribe` | 必須 | 音声文字起こし |
| `GET` | `/api/auth/me` | 必須 | メンバー・法人情報 |
| `POST` | `/api/auth/activate` | 必須 | 招待コードで LINE 紐づけ |
| `POST` | `/api/org/setup` | 必須 | 組織階層の初回確定 |
| `GET` | `/api/org/tree` | 必須 | 組織ツリー |
| `POST` | `/api/org/invite` | 必須 | メンバー招待 |
| `GET` | `/api/org/members` | 必須 | メンバー一覧 |
| `GET` | `/api/platform/organizations` | Platform Secret | 法人一覧 |
| `POST` | `/api/platform/organizations` | 同上 | 法人登録 |
| `POST` | `/api/platform/invite-representative` | 同上 | 代表招待 |

動的ルート: `api/auth/[action].js` / `api/org/[action].js` / `api/platform/[action].js`

---

## 3. 各エンドポイント詳細

### POST /api/chat

チャットメッセージを受け取り、OpenAI Function Callingで解析・実行してレスポンスを返します。

**リクエストボディ**

```json
{
  "message": "プロジェクト企画書を明日までに提出する（優先度：高）"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `message` | string | ○ | ユーザーのメッセージ |

**レスポンス（200）**

```json
{
  "reply": "タスクを登録しました！\n📌 プロジェクト企画書を提出する（期限：2026-05-24、優先度：高）",
  "tasks": [
    {
      "id": "uuid-xxxx",
      "title": "企画書を作成する",
      "due_date": "2026-05-28",
      "priority": "高",
      "completed": false
    }
  ]
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `reply` | string | ボットの返答テキスト |
| `tasks` | array or undefined | タスク一覧表示時のみ付与 |
| `insights` | array or undefined | 気づき一覧表示時のみ付与 |
| `insightTag` | string or undefined | 気づき一覧の絞り込みタグ |
| `prompts` | array or undefined | プロンプト一覧表示時のみ付与 |
| `promptTag` | string or undefined | プロンプト一覧の絞り込みタグ |

**処理フロー**

1. `Authorization` ヘッダーからトークン抽出
2. `GET https://api.line.me/v2/profile` でトークン検証 → `lineUserId` 取得
3. OpenAI `gpt-4o-mini` に `message` + tools を送信
4. OpenAI がツールを選択した場合は `executeTool(toolName, args, lineUserId)` を実行
5. `chat_messages` に user/bot メッセージをINSERT
6. レスポンス返却

---

### GET /api/config

Supabase 接続情報をフロントエンドに返します。

**リクエスト**: ヘッダー不要、パラメータなし

**レスポンス（200）**

```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseAnonKey": "eyJxxxx..."
}
```

---

### GET /api/messages

直近12時間のチャット履歴を返します。

**リクエスト**: `Authorization` ヘッダー必須

**レスポンス（200）**

```json
[
  { "id": "uuid-...", "role": "user", "content": "タスク一覧", "created_at": "2026-05-24T10:00:00Z" },
  { "id": "uuid-...", "role": "bot",  "content": "未完了タスクが3件あります", "created_at": "2026-05-24T10:00:02Z" }
]
```

**DB クエリ**

```sql
select id, role, content, created_at from chat_messages
where line_user_id = ? and created_at >= now() - interval '12 hours'
order by created_at asc;
```

---

### GET /api/tasks

未完了タスク一覧を返します。**[📋 タスク一覧]**・ガイドフロー（完了・優先度・期日修正）で使用します。

**リクエスト**: `Authorization` ヘッダー必須

**レスポンス（200）**

```json
{
  "tasks": [
    {
      "id": "uuid-xxxx",
      "title": "企画書を作成する",
      "due_date": "2026-05-28",
      "priority": "高",
      "completed": false
    }
  ]
}
```

**スコープ（`applyTasksScope`）**

| コンテキスト | フィルタ |
|-------------|----------|
| legacy | `line_user_id` = ログインユーザー |
| member | 自分のタスク（法人内 + organization_id NULL の移行分） |
| dept_admin / unit_admin | 配下 org_unit + 自分 |
| org_admin | `organization_id` = 所属法人の**全タスク** |

**前提:** `members.status` は `active`。`line_user_id` は trim 済みであること。

---

### POST /api/tasks

タスクを直接追加します（ガイドフローの優先度選択後に使用）。

**リクエストボディ**

```json
{
  "title": "企画書を作成する",
  "due_date": "6/10",
  "priority": "高"
}
```

**レスポンス（201）**

```json
{
  "success": true,
  "task": { "id": "uuid", "title": "...", "due_date": "2026-06-10", "priority": "高" }
}
```

---

### PATCH /api/tasks

タスクを完了にします（ガイドフローの完了結果入力後に使用）。

**リクエストボディ**

```json
{
  "id": "uuid-xxxx",
  "action": "complete",
  "result": "無事に提出できた"
}
```

---

### GET /api/prompts

保存済みプロンプト一覧を返します。

**クエリパラメータ**

| パラメータ | 説明 |
|-----------|------|
| `tag` / `tags` | カンマ区切りタグで絞り込み（OR 条件） |
| `limit` | 取得件数（最大50、デフォルト10） |

**レスポンス（200）**

```json
{
  "prompts": [
    {
      "id": "uuid-xxxx",
      "title": "ブログ記事作成",
      "content": "あなたはプロの編集者です...",
      "tags": "文章作成,要約",
      "created_at": "2026-06-15T10:00:00Z"
    }
  ]
}
```

**スコープ:** `applyPromptsScope`（`insights` と同様）

---

### POST /api/prompts

プロンプトを直接追加します。

**リクエストボディ**

```json
{
  "title": "コードレビュー",
  "content": "以下のコードをレビューしてください...",
  "tags": "コーディング,分析"
}
```

---

### POST /api/suggest-categories

気づきまたはプロンプト本文に基づいてAIが関連カテゴリを提案します。

**リクエストボディ**

```json
{
  "content": "ポモドーロテクニックを実践してみると集中力が上がった",
  "type": "insight"
}
```

| `type` | デフォルトカテゴリ |
|--------|-------------------|
| 省略 / `insight` | 仕事, 学び, アイデア, 日常, その他 |
| `prompt` | 文章作成, コーディング, 分析, 要約, その他 |

**レスポンス（200）**

```json
{ "categories": ["生産性", "集中力", "習慣化", "時間管理"] }
```

---

## 4. OpenAI ツール定義（Function Calling）

`api/chat.js` が OpenAI に渡すツール定義の全仕様。

### add_task

```json
{
  "name": "add_task",
  "description": "新しいタスクを追加する",
  "parameters": {
    "type": "object",
    "properties": {
      "title":    { "type": "string", "description": "タスク名" },
      "due_date": { "type": "string", "description": "期限日 YYYY-MM-DD 形式。省略可" },
      "priority": { "type": "string", "enum": ["高", "中", "低"], "description": "優先度。デフォルトは中" }
    },
    "required": ["title"]
  }
}
```

### list_tasks

```json
{
  "name": "list_tasks",
  "description": "未完了タスクの一覧を取得する",
  "parameters": { "type": "object", "properties": {} }
}
```

### complete_task

```json
{
  "name": "complete_task",
  "description": "タスクを完了済みにする",
  "parameters": {
    "type": "object",
    "properties": {
      "task_id": { "type": "string", "description": "完了するタスクのUUID" },
      "result":  { "type": "string", "description": "完了時の結果・成果メモ（省略可）" }
    },
    "required": ["task_id"]
  }
}
```

### delete_task

```json
{
  "name": "delete_task",
  "description": "タスクを削除する",
  "parameters": {
    "type": "object",
    "properties": {
      "task_id": { "type": "string", "description": "削除するタスクのUUID" }
    },
    "required": ["task_id"]
  }
}
```

### update_task

```json
{
  "name": "update_task",
  "description": "タスクの優先度または期限日を更新する",
  "parameters": {
    "type": "object",
    "properties": {
      "task_id":  { "type": "string", "description": "更新するタスクのUUID" },
      "priority": { "type": "string", "enum": ["高", "中", "低"], "description": "新しい優先度（省略可）" },
      "due_date": { "type": "string", "description": "新しい期限日 YYYY-MM-DD 形式。'なし'でNULL（省略可）" }
    },
    "required": ["task_id"]
  }
}
```

### add_insight

```json
{
  "name": "add_insight",
  "description": "気づきを記録する",
  "parameters": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "気づきの本文" },
      "tags":    { "type": "string", "description": "カンマ区切りのタグ（省略可）" }
    },
    "required": ["content"]
  }
}
```

### list_insights

```json
{
  "name": "list_insights",
  "description": "記録した気づきを一覧取得する",
  "parameters": {
    "type": "object",
    "properties": {
      "limit": { "type": "number" },
      "tag":   { "type": "string", "description": "タグ絞り込み（カンマ区切り可）" },
      "tags":  { "type": "string" }
    }
  }
}
```

### export_insights_to_dropbox

```json
{
  "name": "export_insights_to_dropbox",
  "description": "未エクスポートの気づきをCSV化してDropboxに保存する",
  "parameters": { "type": "object", "properties": {} }
}
```

### add_prompt

```json
{
  "name": "add_prompt",
  "description": "AIプロンプトを記録・保存する",
  "parameters": {
    "type": "object",
    "properties": {
      "title":   { "type": "string" },
      "content": { "type": "string" },
      "tags":    { "type": "string", "description": "カンマ区切りタグ" }
    },
    "required": ["title", "content"]
  }
}
```

### list_prompts

```json
{
  "name": "list_prompts",
  "description": "保存したプロンプトを一覧取得する",
  "parameters": {
    "type": "object",
    "properties": {
      "limit": { "type": "number" },
      "tag":   { "type": "string" },
      "tags":  { "type": "string" }
    }
  }
}
```

---

## 5. LINE API 連携

### トークン検証

```
GET https://api.line.me/v2/profile
Authorization: Bearer <accessToken>
```

**成功レスポンス**

```json
{
  "userId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "displayName": "山田太郎",
  "pictureUrl": "https://profile.line-scdn.net/..."
}
```

**エラー（401）**

```json
{ "message": "The access token expired" }
```

---

## 6. Dropbox API 連携

### 認証方式

リフレッシュトークン方式（OAuth 2.0 offline access）

```javascript
const dbx = new Dropbox({
  clientId:     process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
});
```

SDK が内部でリフレッシュトークンを使って短期アクセストークンを自動取得します。

### ファイルアップロード

```
POST https://content.dropboxapi.com/2/files/upload
```

| 項目 | 値 |
|------|-----|
| アップロードパス | `/braindump/insights/insights_YYYYMMDD.csv` |
| mode | `add`（同名ファイルが存在する場合は `overwrite`） |
| エンコード | UTF-8 |

---

## 7. バリデーションルール

| フィールド | ルール |
|-----------|--------|
| `priority` | '高'/'中'/'低' のみ受け付ける。それ以外の値は '中' に補正 |
| `due_date` | YYYY-MM-DD 形式、または null |
| `update_task.due_date` | '`なし`' または空文字 → `null`（期日削除）として処理 |
| `message` | 空文字は400エラーを返す |

---

## 8. Phase 1 / 2 API 概要

詳細な運用・障害対応は [11_Phase2_追補_2026-05-30.md](11_Phase2_追補_2026-05-30.md) を参照。

### GET /api/auth/me

| 項目 | 内容 |
|------|------|
| 認証 | LINE Bearer |
| 未登録 | `{ legacy: true, lineUserId }` |
| 登録済 | `member`, `organization`（`name` 含む）, `accessibleUnitIds` 等 |
| 備考 | DB の `line_user_id` は応答前に trim |

### POST /api/auth/activate

| 項目 | 内容 |
|------|------|
| Body | `{ "invite": "招待コード" }` |
| 処理 | 招待検証 → `members.line_user_id` を trim して保存 → `status: active` |
| 再紐づけ | invited かつ既存 line_id があるケース等を許可（詳細は実装参照） |

### POST /api/org/setup

代表の初回のみ。`org_structure_depth`（0〜3）と `org_units` を確定し法人を `active` にする。**再実行による段数変更は想定しない。**

### 運営 API（Platform）

```
X-Platform-Secret: <PLATFORM_ADMIN_SECRET>
```

| パス | 説明 |
|------|------|
| `GET/POST /api/platform/organizations` | 法人一覧・登録（代表招待 URL 同時発行可） |
| `POST /api/platform/invite-representative` | 既存法人への代表招待 |

`chat` / `messages` / `insights` / `prompts` もメンバーコンテキスト下では `applyTasksScope` / `applyInsightsScope` / `applyPromptsScope` / `applyMessagesScope` を適用します。
