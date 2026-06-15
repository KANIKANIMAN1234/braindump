# Phase 2 — 組織階層・連鎖招待・データスコープ

## 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0 | 2026-05-29 | 初版（1〜3段・連鎖招待・API） |
| 2.0 | 2026-05-30 | 0段追加・データスコープ確定・UI/運用・移行 SQL・追補 doc 11 |

---

## セットアップ

1. `SQL/phase1_multi_tenant.sql`（未実行なら）
2. **`SQL/phase2_org_hierarchy.sql`** を Supabase SQL Editor で実行
3. **`SQL/phase2_depth0.sql`**（既存 DB で 0 段を使う場合）
4. 既存タスクがある法人は **`SQL/phase2_backfill_task_org.sql`** を実行
5. Vercel 再デプロイ（`SUPABASE_SERVICE_ROLE_KEY` / `PLATFORM_ADMIN_SECRET` 必須）

詳細な運用・障害対応は [11_Phase2_追補_2026-05-30.md](11_Phase2_追補_2026-05-30.md) を参照。

---

## 組織階層の段数

| `org_structure_depth` | 構造 | メンバー招待 |
|----------------------|------|--------------|
| **0** | 代表者のみ（`org_units` なし） | **不可** |
| **1** | 部門のみ | 可（連鎖招待ルールに従う） |
| **2** | 本部 → 部門 | 可 |
| **3** | 本部 → 課 → 部門 | 可 |

**重要:** 段数と組織ツリーは **初回ウィザードで1回だけ確定**。**事後変更は未実装**（今後も不要）。

---

## 代表管理者（org_admin）の流れ

1. 運営コンソールで法人登録 → **招待 URL** を代表に共有（DB 手入力禁止）
2. 招待 URL で LINE 登録 → `auth/activate` → `members.status` は `active` になること
3. アプリ右上 **⚙️** → 組織階層ウィザード（0 / 1 / 2 / 3 から選択）
4. 利用規約に同意して保存 → 法人 `status` が `active`
5. **0段以外:** 同じ ⚙️ からメンバー招待（本部長 / 部門長 / メンバー）
6. **0段:** 招待なし。設定完了後 **⚙️ は非表示**

---

## 連鎖招待

| 招待する人 | 招待できるロール |
|------------|------------------|
| org_admin | 本部管理者・部門管理者・メンバー |
| unit_admin | 部門管理者・メンバー（配下のみ） |
| dept_admin | メンバー（自部門のみ） |

0段法人では上記は適用されない（代表のみ）。

---

## データの見え方（確定仕様）

実装: `lib/data-scope.js`

| ロール | タスク・気づき・チャット履歴 |
|--------|------------------------------|
| legacy（未登録） | 自分の `line_user_id` のみ |
| member | 自分のみ（移行データ `organization_id` NULL 含む） |
| dept_admin / unit_admin | 配下組織の全メンバー分 ＋ 自分 |
| **org_admin** | **法人内すべて**（`organization_id` 一致。他ユーザーの `line_user_id` も可） |

新規 INSERT には `organization_id` / `org_unit_id` / `member_id` を付与。

---

## タスク一覧（UI）

| 操作 | 経路 |
|------|------|
| [📋 タスク一覧] | `GET /api/tasks` を直接呼び出し（AI チャット経由ではない） |
| 完了・優先度・期日修正 | 従来どおり `GET /api/tasks` でボタン生成 |

---

## ヘッダー（LIFF）

右端の並び: **企業名**（`organizations.name`）→ **LINE表示名** → **LINEアイコン**  
条件付きで左に **⚙️**（組織管理）。

---

## API（Vercel 動的ルート）

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/auth/me` | メンバー・法人名・legacy 判定 |
| POST | `/api/auth/activate` | 招待コードで LINE 紐づけ（trim・再紐づけ対応） |
| POST | `/api/org/setup` | 初回組織階層の確定 |
| GET | `/api/org/tree` | 組織ツリー取得 |
| POST | `/api/org/invite` | メンバー招待（0段では UI 非表示） |
| GET | `/api/org/members` | メンバー一覧 |

業務 API（`tasks` / `chat` / `messages` 等）は `requireLineMember` + `applyTasksScope` を適用。

---

## 既存法人（例: TAKEBYPLACE）の移行

| 状態 | 操作 |
|------|------|
| `organizations.status = pending_setup` | ⚙️ ウィザードが自動表示 |
| タスクはあるが一覧が空 | `members.status=active`、`line_user_id` trim、backfill SQL を確認 |
| 代表の LINE ID とタスクの ID が不一致 | `SQL/phase2_fix_line_user_id.sql` の診断・2a を参照 |

---

## 運営コンソール

- URL: **`/app/platform-console.html`**（推奨）
- 代表招待 URL: 強調表示＋コピーボタン
- 法人一覧: 階層 0〜3 段ラベル

Phase 1 詳細: [09_Phase1_マルチテナント.md](09_Phase1_マルチテナント.md)
