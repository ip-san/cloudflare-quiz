# Diagram Examples

各タイプの JSON 例。SKILL.md の `diagrams` フィールド仕様と合わせて参照。

## `network`

```json
{
  "type": "network",
  "label": "Cloudflare Access のリバースプロキシ構成",
  "nodes": [
    { "id": "browser", "text": "ブラウザ", "sub": "エンドユーザー" },
    { "id": "access", "text": "Cloudflare Access", "sub": "認証プロキシ" },
    { "id": "origin", "text": "オリジンアプリ" }
  ],
  "edges": [
    { "from": "browser", "to": "access", "label": "未認証リクエスト" },
    { "from": "access", "to": "browser", "label": "IdPログイン要求", "dashed": true },
    { "from": "access", "to": "origin", "label": "認証済みリクエストのみ転送" }
  ]
}
```

## `sequence`

```json
{
  "type": "sequence",
  "label": "Cache Rules によるキャッシュ判定フロー",
  "actors": ["クライアント", "エッジ", "オリジン"],
  "messages": [
    { "from": 0, "to": 1, "text": "GETリクエスト" },
    { "from": 1, "to": 1, "text": "Cache Keyでキャッシュ照会" },
    { "from": 1, "to": 2, "text": "キャッシュミス時のみ転送", "dashed": true },
    { "from": 2, "to": 1, "text": "レスポンス(Cache-Control付き)" },
    { "from": 1, "to": 0, "text": "レスポンスを返却" }
  ]
}
```

## `layer`

```json
{
  "type": "layer",
  "label": "Workersのルート一致優先順位（内側が優先）",
  "layers": [
    { "text": "ワイルドカードなしのルート", "sub": "example.com/api/users" },
    { "text": "サブパスワイルドカード", "sub": "example.com/api/*" },
    { "text": "全体ワイルドカード", "sub": "example.com/*" }
  ]
}
```

## `swimlane`

```json
{
  "type": "swimlane",
  "label": "Load Balancingのヘルスチェック並列実行",
  "lanes": [
    { "name": "プール: US", "segments": [{ "start": 0, "end": 2, "text": "HTTPチェック" }] },
    { "name": "プール: EU", "segments": [{ "start": 0, "end": 2, "text": "HTTPチェック" }] },
    { "name": "トラフィック振り分け", "segments": [{ "start": 2, "end": 4, "text": "健全なプールへルーティング" }] }
  ],
  "totalSteps": 4
}
```

## `venn`

```json
{
  "type": "venn",
  "label": "CASBとDLPの役割の重なり",
  "sets": [
    { "text": "CASB", "items": ["SaaSのAPI連携監査", "設定ミスの検出"] },
    { "text": "DLP", "items": ["機密データパターンの検出", "アップロード/ダウンロードの制御"] }
  ],
  "intersectionLabel": "SaaS上の機密データ検出"
}
```

## `matrix`

```json
{
  "type": "matrix",
  "label": "SSL/TLS暗号化モード別の暗号化区間",
  "rowHeader": "モード",
  "colHeader": "区間",
  "rows": ["Flexible", "Full", "Full (strict)"],
  "cols": ["クライアント⇔エッジ", "エッジ⇔オリジン"],
  "cells": [
    ["✓ 暗号化", "✗ 平文"],
    ["✓ 暗号化", "✓ 暗号化（証明書検証なし）"],
    ["✓ 暗号化", "✓ 暗号化（証明書検証あり）"]
  ]
}
```

## `tree`

```json
{
  "type": "tree",
  "label": "D1を使うWorkersプロジェクトの構成",
  "root": {
    "text": "プロジェクトルート",
    "children": [
      { "text": "wrangler.jsonc", "sub": "d1_databases 等のバインディング定義" },
      { "text": "src/", "children": [{ "text": "index.ts", "sub": "fetchハンドラ" }] },
      {
        "text": "migrations/",
        "children": [{ "text": "0001_init.sql", "sub": "wrangler d1 migrations create で生成" }]
      }
    ]
  }
}
```

## `formula`

```json
{
  "type": "formula",
  "label": "R2の月次保存コストの内訳",
  "result": "月次保存コスト",
  "components": [
    { "text": "保存データ量(GB)", "sub": "月間平均" },
    { "text": "GBあたりの月額単価" }
  ],
  "operator": "×"
}
```
