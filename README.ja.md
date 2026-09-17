[English](./README.md) | **Japanese**

# ContexML

ContexML は Opencode プロジェクトをブラウザから操作できるフル機能の Web クライアントです。新規セッションの開始、既存会話の再開、タスク監視、履歴確認をブラウザで完結でき、`~/.local/share/opencode/storage/`（session / message / part）と双方向に同期します。

> **注記**: 本プロジェクトは d-kimuson 氏による [claude-code-viewer](https://github.com/d-kimuson/claude-code-viewer) を OpenCode 向けに派生させたものです。

![Projects view](./docs/assets/images/img001.png)

![Session list](./docs/assets/images/img002.png)

![Session detail](./docs/assets/images/img003.png)

## 主な機能

### プロジェクト一覧
- プロジェクト名・パスでフィルタリング、最終更新／名前／メッセージ数のソート切り替えが可能。
- グリッド（カード）／テーブル表示をワンクリックで切り替え、用途に応じた視認性を確保。
- Opencode セッションメタデータを元に最新アクティビティやメッセージ件数を集計。

### セッション管理
- ヘッダーの `sessionId` バッジからワンクリックで ID をコピーし、UUID も併記。
- 実行中／一時停止中タスクをリアルタイム表示。Abort/Resume 操作で CLI タスクを制御。
- Diff ビューアやコマンド出力が SSE でストリーミングされ、再読み込み不要で更新を追跡。
- 監視対象を session / message / part ディレクトリに拡張したことで、再開直後のアシスタント応答も即座に表示されます。

### 自動ブラウザ起動 & 設定
- サーバーが立ち上がると既定ブラウザを自動で開く（macOS / Linux / Windows）。
- `CC_VIEWER_NO_AUTO_OPEN=1`、`NO_AUTO_OPEN=1`、`NO_AUTO_BROWSER=1` で自動起動を抑制可能。
- `OPENCODE_STORAGE_ROOT` を指定するとデータディレクトリを任意の場所に変更できます。

## クイックスタート

インストール不要で実行:

```bash
PORT=3400 npx @nogataka/contexml@latest
```

既定ポート 3400 でサーバーが起動し、到達可能になると `http://localhost:3400` が自動で開きます。ブラウザ自動起動を避ける場合は実行前に `CC_VIEWER_NO_AUTO_OPEN=1` を設定してください。

### グローバルインストール

```bash
npm install -g @nogataka/contexml
contexml
```

### ソースから利用

```bash
git clone https://github.com/nogataka/contexml.git
cd contexml
pnpm install
pnpm build
pnpm start
```

## 利用ガイド

### 1. プロジェクトページ
- 検索ボックスでワークスペース名やパスをフィルタ。
- ソートメニューで「最終更新」「プロジェクト名」「メッセージ数」を選択し、昇順／降順を切り替え。
- カード表示はショートカット主体、テーブル表示は一覧性重視でセッションへすばやく遷移できます。

### 2. セッションページ
- タイトルは最初のコマンド名を表示し、履歴の文脈を把握しやすくします。
- Running / Paused バッジ付きでタスク状態を提示し、Abort ボタンで即停止可能。
- ツール呼び出し／結果、Reasoning、システムイベントを折りたたみ表示し、必要な情報を集中して確認。

### 3. リアルタイム同期
- `session/*.json` のメタ更新だけでなく、`message/*.json` や `part/*.json` の変化も監視し、`session_changed` SSE を発火。
- フロントでは React Query のキャッシュを無効化して再フェッチするため、ユーザー／アシスタント両方のメッセージが即座に反映されます。

## 環境設定

- **ポート変更**: 例 `PORT=8080 npx @nogataka/contexml@latest`
- **ブラウザ自動起動の停止**: `CC_VIEWER_NO_AUTO_OPEN=1`（または `NO_AUTO_OPEN=1`, `NO_AUTO_BROWSER=1`）
- **データディレクトリ変更**: `OPENCODE_STORAGE_ROOT` を任意のパスに設定

## 開発コマンド

- `pnpm dev` — Next.js (Turbopack) + Hono API をポート 3400 で起動
- `pnpm lint` / `pnpm fix` — Biome 2.2 によるフォーマット／Lint
- `pnpm typecheck` — TypeScript の厳格チェック
- `pnpm test` — Vitest でユニット／統合テスト
- `pnpm build` — CLI バンドルと `dist/index.js` を生成

## 紹介記事

- [Qiita: Codexプロジェクト管理を加速するCodex Viewerガイド](https://qiita.com/nogataka/items/28d04db421663a4a46fd)
- [Zenn: Codex ViewerでCodexセッションを俯瞰する](https://zenn.dev/taka000/articles/74a60c37fae5bb)

## ライセンス / コントリビュート

MIT License。詳細は [LICENSE](./LICENSE) を参照してください。開発に関するメモは [docs/dev.md](./docs/dev.md) にまとまっています。

## 注意事項

- `dist/index.js` は CLI (bin) のエントリーポイントです。削除・リネームすると `npx @nogataka/contexml` やグローバルインストールが動作しなくなるため、リリース時も必ず保持してください。
