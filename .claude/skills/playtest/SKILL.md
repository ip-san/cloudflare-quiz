---
name: playtest
description: 一般ユーザーを模したエージェントが実 PWA のクイズをプレイし、分かりにくさ・学び改善のリクエストを出し、専門家チームがレビュー・改善するゲート。プレイテスト、ユーザーテスト、playtest、分かりにくさ、学習改善
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
argument-hint: "[--persona ...] [--count N] [--report-only] [--no-build] [--progressive [N]]"
---

# Playtest Skill — 模擬ユーザー・プレイテスト & 専門家レビューゲート

模擬ユーザーエージェントが**実 PWA をブラウザで操作**してクイズをプレイし、
「分かりにくい / 学びにくい」を**ユーザーの声**として出す。それを**専門家チームが妥当性検証**してから
クイズ内容・学習設計を改善し、UX/UI は報告する。ユーザーの不満を鵜呑みにせず、
事実正確性（`quiz:lint`/`quiz:fact-check`）と教育設計を守るのが「ゲート」の役割。

参照: `personas.md`（ペルソナ定義）, `feedback-schema.md`（JSON 契約）。

## 引数

- `--persona <name>`: 単一ペルソナのみ実行（既定は3ペルソナ全部）
- `--count N`: 1ペルソナあたりのプレイ問題数（既定: beginner 9 / 他 10）
- `--report-only`: 改善を適用せず、リクエストと専門家判定の**報告のみ**（dry-run）
- `--no-build`: 既に preview サーバーが起動済みの場合、ビルド/起動をスキップ
- `--progressive [N]`: プログレッシブ・カバレッジモード（下記）。未テストの問題を N 問（既定5）狙って1バッチ実行

## プログレッシブ・カバレッジモード（`--progressive`）

全クイズを「ユーザー視点で1問ずつ」テストし切るためのモード。毎回**未テストの問題**を狙うので、
全問を1周するまで毎バッチ新しい発見がある（空振り・同じ不満の再生産を避ける）。記録は
`.claude/playtest-coverage.json`（git追跡で進捗が永続）。

1. `node scripts/playtest-coverage.mjs status` で進捗確認
2. `node scripts/playtest-coverage.mjs next [N]` で「次に testする persona + 問題ID + `?q=` deep link」を取得（残数最多ペルソナを自動選択）
3. `bun run build && (bun run preview &)`（`--no-build` 時はスキップ）
4. `user-simulator`（取得した persona）を**ターゲットモード**で起動。プロンプトに `ids` と `deepLinks` を渡し、指定問題だけを deep link で順にプレイさせる（各 item に `quizId` 直記録、最終 `played:[{id,outcome}]` を返す）
5. `node scripts/playtest-resolve.mjs` → ドメイン別 `learning-experience-reviewer` で検証 → `playtest-apply.mjs` で承認分適用 → 事実変更時は該当カテゴリで `bun run quiz:lint:dry`/`bun run quiz:fact-check` 再検証 → `bun run quiz:randomize && bun run quiz:check && bun run test`
6. `node scripts/playtest-coverage.mjs mark-batch <played.json>` でテスト済みを記録
7. preview 停止。`auto/playtest-cov-<日時>` ブランチにコミット（coverage 更新 + 改善）。**push/PR はしない**
8. 報告: 今回のカバレッジ進捗（例 beginner 40/254）、採用/却下、UX課題、残数

**1周完了**（全問 covered）したら維持モード（新規/変更問題のみ）に移行する。

## 前提チェック（最初に実行）

1. claude-in-chrome（ブラウザ自動化）MCP が利用可能か確認。不可なら「ブラウザ MCP 未接続」と報告して中止
   （データレベル代替は本スキルの対象外。実 UI 体験が目的のため）
2. `mkdir -p .claude/tmp/playtest`

## Phase A: プレイスルー（3ペルソナ並列・実ブラウザ）

1. `--no-build` でなければアプリを用意:
   ```bash
   bun run build && (bun run preview &)   # http://localhost:4173/cloudflare-quiz/
   ```
   起動待ち（`until curl -sf http://localhost:4173/cloudflare-quiz/ >/dev/null; do sleep 1; done` 相当）

   **`--no-build` の場合でも、ペルソナを起動する前に必ず次を実行すること:**
   ```bash
   node scripts/check-preview-fresh.mjs   # exit 1 なら再ビルドするまで進まない
   ```
   preview は `dist/` を配信するため、ビルドが古いと模擬ユーザーは
   **修正済みの問題を修正前の状態でプレイ**する。2026-08-26 に実際これが起き、
   ac-008 / ac-009 / ag-001 の3件が「修正済みなのに再指摘」として戻ってきた。
   結果からは「古いビルドを見ていた」と「本当にまだ直っていない」を区別できないので、
   走らせる前に落とす。
2. 対象ペルソナごとに `user-simulator` を **同一メッセージ内で同時に** `run_in_background: true` 起動:
   ```
   Agent(subagent_type: "user-simulator", model: "sonnet",
         prompt: "persona=<name>。personas.md と feedback-schema.md に従い実 PWA をプレイし
                  requests-<name>.json を書く。count=<N>。")
   ```
3. 全エージェントの完了通知を待つ → `requests-<persona>.json` が出力される

## Phase B: 集約・名寄せ（決定論的）

```bash
node scripts/playtest-resolve.mjs   # → requests.json（domain別・quizId名寄せ・stats）
```
`unresolved` があれば Phase C の reviewer が Grep で手当てする。

## Phase C: 専門家レビューゲート（ドメイン別並列）

`requests.json` の `byDomain` に項目があるドメインごとに `learning-experience-reviewer` を並列起動:
```
Agent(subagent_type: "learning-experience-reviewer", model: "sonnet",
      prompt: "domain=<content|learning|ux>。requests.json の byDomain[domain] を検証し
               verdicts-<domain>.json を書く。content/learning は事実裏取り、ux は report-only。")
```
- content/learning: accept/modify/reject + 具体 change を判定（事実は変えない）
- ux: report-only（`change` は null、ルーティング先を明記）

## Phase D: 適用 + 事実安全網（`--report-only` なら skip）

```bash
node scripts/playtest-apply.mjs            # accept/modify を quizzes.json へ（from不一致は安全スキップ）
bun run quiz:randomize && bun run quiz:check && bun run test
```
適用で**事実に触れた変更**があれば、該当カテゴリについて `bun run quiz:lint:dry` / `bun run quiz:fact-check` を
実行し、`.claude/tmp/docs/` のキャッシュと突き合わせて最終事実検証を行う。NG なら該当変更を巻き戻す。

## Phase E: レポート

```
## Playtest 結果
| ペルソナ | プレイ数 | 詰まり報告 | 主な声 |
|---------|---------|-----------|--------|
| ...     | ...     | ...       | ...    |

| ドメイン | accept | modify | reject | 代表例 |
|---------|--------|--------|--------|--------|
| content | ... |
| learning| ... |
| ux (報告のみ) | — | — | — | ルーティング先: /code-review 等 |

- quizzes.json 変更: N問（事実再検証 ✅）
- UX/UI 課題: M件（/code-review へ）
- 未解決名寄せ: K件
```

## quality-loop との統合

`/quality-loop --playtest` で Step 3.5 として本スキルを呼ぶ（コスト高のため既定では実行しない／月次・任意）。
UX 課題は quality-loop の Step 1（code-review）へ、内容修正は Step 3（最終ゲート）前に合流させる。

## モデル選択

- `user-simulator` / `learning-experience-reviewer`: Sonnet（文脈理解）
