# BrainDump 仕様書

## 1. 概要

BrainDump は、LINE公式アカウントのリッチメニューから起動する LIFF Web アプリです。  
タスク管理と日々の気づき記録をチャット形式で行い、バックエンドは Supabase と OpenAI を利用します。

## 2. 利用環境

- クライアント: LIFF（LINE内ブラウザ / 外部ブラウザ）
- フロントエンド: Vanilla JavaScript
- バックエンド: Vercel Serverless Functions（`api/*.js`）
- データストア: Supabase
- AI: OpenAI API

## 3. 主な機能

- タスクの追加 / 一覧 / 完了 / 削除
- タスクの優先度変更 / 期日変更
- 気づきメモの記録 / 一覧
- 気づきの CSV エクスポート（Dropbox）
- 音声入力（録音 → サーバー文字起こし）

## 4. 認証方式

- LIFF SDK で `liff.init()` を実行
- `liff.getAccessToken()` を取得し、API に `Authorization: Bearer <token>` で送信
- 各 API は `https://api.line.me/v2/profile` でトークン検証を行い、`line_user_id` を特定

## 5. 音声入力仕様（2026-05 更新）

### 5.1 変更背景

従来の `SpeechRecognition`（Web Speech API）方式は、iPhone の LINE 内ブラウザで安定しないケースがありました。  
このため、音声入力を以下の構成へ変更しました。

- `getUserMedia` でマイク取得
- `MediaRecorder` で録音データ生成
- `/api/transcribe` へ音声データ送信
- サーバー側で OpenAI 音声文字起こし
- 文字起こし結果を入力欄へ反映

### 5.2 クライアント処理

対象ファイル: `app/main.js`

1. マイクボタン押下で録音開始
2. 再押下で録音停止
3. 音声 Blob を Base64 化して `/api/transcribe` に POST
4. 返却テキストを入力欄へセット

エラー時は以下を実施:

- 録音不能時の案内表示（権限・端末状態など）
- 文字起こし中の重複操作を抑止
- UI（ボタン状態/プレースホルダー）を必ず復帰

### 5.3 サーバー処理

対象ファイル: `api/transcribe.js`

- リクエスト: `POST /api/transcribe`
- 入力: `audioBase64`, `mimeType`
- 認証: LINEアクセストークンを検証
- 処理: OpenAI `audio.transcriptions.create()` を実行（`gpt-4o-mini-transcribe`）
- 出力: `{ text: "..." }`

## 6. API 一覧

- `POST /api/chat`  
  タスク/気づき操作を自然言語で実行
- `GET /api/tasks`  
  タスク一覧取得
- `GET /api/messages`  
  直近チャット履歴取得
- `POST /api/suggest-categories`  
  気づきカテゴリ候補の提案
- `POST /api/transcribe`  
  音声データの文字起こし
- `GET /api/config`  
  クライアント向け設定値取得

## 7. Phase 1 — マルチテナント（法人・招待）

再販向けの法人登録・代表管理者招待を追加しました。詳細は [docs/09_Phase1_マルチテナント.md](docs/09_Phase1_マルチテナント.md) を参照。

| 用途 | URL / API |
|------|-----------|
| 運営コンソール | **`/app/platform-console.html`**（推奨） |
| 法人登録 | `POST /api/platform/organizations` |
| 代表招待 | `POST /api/platform/invite-representative` |
| LINE 紐づけ | `POST /api/auth/activate?invite=...` |

**必須:** Supabase で `SQL/phase1_multi_tenant.sql` を実行し、Vercel に `SUPABASE_SERVICE_ROLE_KEY` と `PLATFORM_ADMIN_SECRET` を設定してください。

## 8. 補足

- LINE 内ブラウザは端末や OS バージョン差の影響を受けるため、音声入力が失敗した場合はテキスト入力へフォールバックする。
- キャッシュ対策のため `app/index.html` の `main.js?v=` を更新して配信する。