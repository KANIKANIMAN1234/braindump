# Phase 1 — マルチテナント基盤

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-05-29 | 初版 |
| 2.0 | 2026-05-30 | 運営コンソール UI・推奨 URL・Phase 2 連携・運用ルール追記 |

---

## 概要

法人（テナント）の登録、代表管理者（`org_admin`）の招待、LINE 初回ログインによる `line_user_id` 紐づけを実装。

組織階層（0〜3段）は Phase 2: [10_Phase2_組織階層.md](10_Phase2_組織階層.md)  
本日の追補・障害対応: [11_Phase2_追補_2026-05-30.md](11_Phase2_追補_2026-05-30.md)

---

## セットアップ手順

### 1. Supabase で SQL 実行

| 順 | ファイル |
|----|----------|
| 1 | `SQL/phase1_multi_tenant.sql` |
| 2 | `SQL/phase2_org_hierarchy.sql` |
| 3 | `SQL/phase2_depth0.sql`（0段を使う場合・既存 DB） |

既存タスクの法人紐づけ: `SQL/phase2_backfill_task_org.sql`

### 2. 環境変数（Vercel）

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | ○ | 運営・認証・スコープ付き API 用 |
| `PLATFORM_ADMIN_SECRET` | ○ | 運営コンソール認証 |
| `LIFF_ID` | 任意 | 招待 URL 生成（未設定時は既定値） |
| `PLATFORM_DATA_ACCESS` | 任意 | `full`（既定）または `metadata_only` |

### 3. 運営コンソール

| 項目 | 内容 |
|------|------|
| **推奨 URL** | `https://<your-domain>/app/platform-console.html` |
| 代替 | `https://<your-domain>/platform/`（同一機能の配置） |
| 認証 | `PLATFORM_ADMIN_SECRET` を入力してセッション保存 |

**操作**

1. 法人登録（名称・郵便番号・住所・代表電話）
2. 代表管理者の氏名を入力 → **招待 URL を発行**
3. 招待 URL は画面上で**強調表示＋コピーボタン**（JSON は詳細欄に残す）
4. 法人一覧に組織階層ラベル（0〜3段、未設定は「未設定」）

### 4. 代表管理者の初回登録（運用ルール）

| 手順 | 内容 |
|------|------|
| 1 | 運営が発行した**招待 URL** を LINE で開く |
| 2 | LIFF ログイン |
| 3 | `POST /api/auth/activate` で `line_user_id` を紐づけ（サーバー側で trim） |
| 4 | `members.status` が **`active`** であること |
| 5 | `organizations.status` は `pending_setup`（Phase 2 ウィザード待ち） |

**禁止:** Supabase で代表の `line_user_id` を手入力（改行混入・`invited` のまま等の障害原因）

---

## API 一覧（Phase 1 追加）

| メソッド | パス | 認証 | 説明 |
|----------|------|------|------|
| GET | `/api/platform/organizations` | `X-Platform-Secret` | 法人一覧 |
| POST | `/api/platform/organizations` | 同上 | 法人登録 + 任意で代表招待 |
| POST | `/api/platform/invite-representative` | 同上 | 既存法人へ代表招待 |
| POST | `/api/auth/activate` | LINE Bearer | 招待コードで紐づけ |
| GET | `/api/auth/me` | LINE Bearer | メンバー・法人名・legacy 判定 |

---

## 既存アプリとの互換

- `members` に未登録の LINE ユーザーは `auth/me` が `legacy: true` を返し、従来どおり `line_user_id` のみでタスク・気づきを利用可能。

---

## Phase 2（実装済み）

- 組織階層 **0 / 1 / 2 / 3** 段ウィザード
- 連鎖招待（0段は代表のみ・招待なし）
- `lib/data-scope.js` による閲覧範囲
- 詳細: [10_Phase2_組織階層.md](10_Phase2_組織階層.md)
