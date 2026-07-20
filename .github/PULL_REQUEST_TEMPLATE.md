## 概要

<!-- 何を変更したか、なぜ変更したかを簡潔に記載 -->

## 品質ゲート チェックリスト

- [ ] `bun run check`（typecheck + lint + test + `quiz:check` + `quiz:lint:dry`）がローカルで通ること
- [ ] クイズ問題（`src/data/quizzes.json`）を追加・変更した場合:
  - [ ] `bun run quiz:lint`（バッククォート自動修正）を実行した
  - [ ] `bun run quiz:cross-check` で他の問題との矛盾がないか確認した
  - [ ] `referenceUrl` が実在する公式ドキュメントページを指している（`bun run docs:fetch` してから `bun run quiz:lint:url` で検証すると確実）
  - [ ] 不正解の選択肢すべてに `wrongFeedback`（なぜ間違いか）を設定した
- [ ] UI/挙動を変更した場合、実際にアプリを操作して動作確認した

## テスト計画

<!-- どう検証したか（コマンド、手動確認内容など）を記載 -->
