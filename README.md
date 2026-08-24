# Cloudflare Quiz

Cloudflare をプロダクト開発に活かせるようになるための学習クイズ PWA です。「Cloudflare は聞いたことがあるが、実際にプロダクトへ組み込んだことはない」というエンジニアが、Workers・KV・R2・D1・Durable Objects・Queues・Workers AI・Vectorize・Pages・Hyperdrive・Workflows・Turnstile・Images・Stream・Email Service・Browser Run・Workers Logs・Tail Workers・Analytics Engine・Containers・Workers for Platforms・AI Gateway・Realtime(SFU・TURN)・Workers VPC・Cloudflare for SaaS・Pipelines・Zero Trust Access・WAF・Bot対策・API Shield・Load Balancing・Cache・Rules・DNS・SSL/TLS・Speed・Cloudflare Tunnel・Client-side Security・Gateway・DLP・Browser Isolation・CASB・DEX・Email Security・Cloudflare WAN・Magic Transit・Spectrum・Waiting Room・Zaraz・Agents などの主要サービスを、実務に近い問題と図解を通じて基礎から身につけられるように作られています。

**公開URL**: https://ip-san.github.io/cloudflare-quiz/

> **免責事項**: 本アプリは個人が作成した非公式の学習ツールであり、Cloudflare, Inc. とは一切関係ありません。Cloudflare の公式ロゴ・商標は使用しておらず、アプリ内のアイコンはすべてオリジナルの図案です。問題内容の正確性については可能な限り公式ドキュメントを参照して作成していますが、内容を保証するものではありません。

## 対象読者

- **個人開発者**: 無料枠でアプリを作って公開したい、サーバー代を抑えたい、自宅サーバーを安全に公開したい——そんな「作りたい」を後押しする知識を優先的に学べます
- Cloudflare を使ったプロダクト開発を学びたいエンジニア
- Workers / KV / R2 / D1 などのサービスの使い分けを整理したい人
- スキマ時間でスマホから手軽にインプットしたい人

プログラミング経験は必要ですが、Cloudflare の利用経験は前提としていません。42カテゴリ・756問を、初級（beginner）から中級（intermediate）、上級（advanced）まで段階的に学べる構成になっています。

## 主な機能

### 学習コンテンツ

- **42カテゴリ・756問**: Workers 基礎 / Wrangler・開発フロー / KV・Cache / D1 / R2 / Durable Objects・Queues / Pages・フレームワーク・デプロイ / Workers AI・Vectorize / Hyperdrive・Workflows / アプリ拡張サービス（Turnstile・Images・Stream・Email Service・Browser Run） / ログ・可観測性（Workers Logs・Tail Workers・Analytics Engine） / Containers / Workers for Platforms / AI Gateway / Realtime（音声・映像通信） / Workers VPC / Cloudflare for SaaS / Pipelines / Zero Trust Access / WAF / Bot対策 / API Shield / Load Balancing / Cache / Rules / DNS / SSL/TLS / Speed / Cloudflare Tunnel / Cloudflare WAN・Magic Transit / Spectrum / Waiting Room / Zaraz / Agents / Client-side Security / Gateway / DLP / Browser Isolation / CASB / DEX / Email Security / 設計・料金・制限
- 各問題に不正解選択肢ごとの解説（wrongFeedback）と、図解（ネットワーク図・比較表・ターミナル実演・設定ファイル例など）付き

### 出題モード

- **個人開発コース**: 個人開発者が「つくって公開して運用する」まで最短で辿れる40問を、つくる → データを持たせる → フロントを公開する → 独自ドメインで見せる → お金を守る → 公開後を支える、の順に出題（企業・情シス向けカテゴリは除外）
- **全体像モード**: 6チャプター構成のガイド付き学習（Cloudflare Workers とは → Wrangler で開発する → データを保存する → 高度な処理 → デプロイと公開 → 設計・料金・制限）
- **実力テスト**: 全カテゴリから100問、60分の制限時間で挑戦
- **カテゴリ別学習**: 選んだカテゴリの問題に集中して学習
- **ランダム20問**: 全カテゴリからランダムに出題
- **復習チェック**: 間隔反復（SRS）の復習期限が来た問題を優先出題
- **苦手克服モード**: 正答率の低い問題を優先出題
- **未正解に挑戦 / 間違い復習 / 後で学ぶ（ブックマーク）**
- **実務即戦力20問 / 上級トリビア20問**: 実務直結の問題、細かい仕様を問う上級問題をそれぞれ集中出題
- **実践シナリオ**: 「週末で作る、はじめてのWorkers API」「自宅のラズパイを世界に公開する」「個人開発がSaaSになった日」など、個人開発のストーリーを先頭に、実務編まで段階的に学べる15本のシナリオ

### 学習支援

- 間隔反復（SRS）による復習リマインド通知
- 進捗ダッシュボード（カテゴリ別正答率、マスタリーレベル、学習履歴、ストリーク）
- 問題検索・解説リーダー
- **無料枠早見表**: 主要サービス（Workers / KV / D1 / R2 / AI Gateway）の無料枠を1画面で確認。数値は `bun run verify:free-tier` が公式ドキュメントのキャッシュと機械照合するため、Cloudflare 側の変更で静かに陳腐化しない
- URL 共有（特定の問題・カテゴリ・モードへ直接リンク可能）

### PWA

- オフライン利用、ホーム画面へのインストールに対応
- ライト/ダークモード切り替え

## 開発

パッケージマネージャーには [bun](https://bun.sh/) を使用しています。

```bash
bun install

bun run dev            # 開発サーバー起動
bun run build           # 本番ビルド（tsc + vite build）
bun run preview         # ビルド結果をローカルでプレビュー

bun run typecheck        # 型チェック（tsc --noEmit）
bun run lint              # Lint（biome check）
bun run format             # フォーマット（biome format --write）

bun run test               # ユニットテスト（vitest）
bun run test:watch          # ユニットテスト（watch モード）
bun run test:coverage        # カバレッジ計測
bun run test:e2e              # E2Eテスト（Playwright）

bun run quiz:check             # クイズデータの整合性チェック（ID重複・wrongFeedback・偏り等）
bun run quiz:randomize          # correctIndex の偏り解消
bun run quiz:stats               # クイズデータの統計表示

bun run check                     # 品質ゲート一式（typecheck + lint + test + quiz:check + quiz:lint:dry + verify:free-tier）

bun run generate-icons             # public/icons/ のアイコンを build/icon.svg から再生成
```

### 品質ゲート・問題レビュー機構

構造的な検証（Zod スキーマ、vitest によるコンテンツ品質テスト）に加え、機械的なレビュー支援ツールを備えています。

```bash
bun run quiz:lint                  # バッククォート不足を自動修正 + 用語/distractor/difficulty をレポート
bun run quiz:lint:dry              # 自動修正せずレポートのみ（CI・pre-commit で使用）
bun run quiz:cross-check           # 問題間の矛盾（数値の食い違い等）を検出
bun run verify:free-tier           # 無料枠早見表の数値をドキュメントキャッシュと照合（`check` に統合済み）

bun run docs:fetch                 # developers.cloudflare.com のMarkdownソースをローカルにキャッシュ
bun run quiz:lint:url               # referenceUrl の見出しアンカーをキャッシュと照合（要 docs:fetch）
bun run quiz:fact-check             # 環境変数・CLIコマンド・設定キーをキャッシュと照合（要 docs:fetch）
```

- `quiz:lint` / `quiz:cross-check` はネットワーク不要で、常に exit code 0（構造検証ではなく人手レビュー支援のため、自動でビルドを落とさない）。
- `quiz:lint:url` / `quiz:fact-check` は `docs:fetch` で取得したキャッシュ（`.claude/tmp/docs/`, gitignore 済み）が必要。ドキュメントの見出し構造（MDXコンポーネント使用ページ等）によっては誤検知することがあるため、レビューの参考情報として扱ってください。
- コミット時は Husky の pre-commit フックが lint-staged（biome）と変更ファイルの vitest、および `quizzes.json` 変更時は `quiz:check` / `quiz:lint` を自動実行します。
- CI（`.github/workflows/deploy.yml`）は PR 作成時に typecheck/lint/test/`quiz:check` をブロッキングで実行し、`quiz-lint`/`quiz-cross-check` の結果を非ブロッキングで可視化します。
- Claude Code から `/quiz-refine` を実行すると、上記スクリプトの出力とドキュメントキャッシュを踏まえて question/explanation/選択肢を1問ずつ検証・修正します（`.claude/skills/quiz-refine/`）。`/quality-loop` はコードレビューとクイズ検証、最終ゲート（`bun run check`）を一括実行します（`.claude/skills/quality-loop/`）。
- `/playtest` は模擬ユーザーエージェントが実 PWA をブラウザ操作でプレイし、分かりにくさ・学びにくさを専門家チームが検証してから改善するゲートです。`--progressive` で全問を1問ずつ計画的にカバーし、進捗は `.claude/playtest-coverage.json` に記録されます（`.claude/skills/playtest/`）。
- `/generate-quiz-data` は公式ドキュメントから新カテゴリの問題を生成するスキルです。安全のためモデルからの自律呼び出しは無効化されており、人が明示的に実行する必要があります（`.claude/skills/generate-quiz-data/`）。

### 技術スタック

React 19 + TypeScript + Zustand 5（状態管理）+ Zod 4（バリデーション）+ Tailwind CSS 4 + Vite（rolldown）+ vite-plugin-pwa。ドメイン駆動設計を意識したレイヤー構成（`src/domain/` にビジネスロジック、`src/infrastructure/` に永続化・検証層、`src/stores/` に状態管理、`src/components/` にUI）になっています。詳細は `src/` 以下のコードとコメントを参照してください。

## 派生元について

本プロジェクトは、作者が個人開発している別プロダクトのコードベースを土台にした独立したプロジェクトです。ドメイン層・状態管理・UIコンポーネントなどの技術的な骨格を流用しつつ、クイズデータ・テーマ・ブランディングはすべて Cloudflare 向けに新規作成しています。

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。
