# X API 検索スクリプト

このスクリプトはX（旧Twitter）APIを使用して、キーワードによるツイート検索を行うための単体実行可能なツールです。

## 前提条件

- Node.js がインストールされていること
- X Developer Portal でアプリが作成され、API Key と API Secret が取得済みであること

## 環境設定

以下のいずれかの方法でAPI認証情報を設定してください：

1. `.env.local` ファイルに以下の環境変数を設定
   ```
   NEXT_PUBLIC_X_API_KEY=あなたのAPIキー
   NEXT_PUBLIC_X_API_SECRET=あなたのAPIシークレット
   ```

2. コマンドライン引数で直接指定（下記参照）

## 使用方法

### NPMスクリプトとして実行（推奨）

```bash
npm run x-search -- --query "検索キーワード" [オプション]
```

### 直接実行

```bash
node x-search-script.js --query "検索キーワード" [オプション]
```

または実行権限を付与して：

```bash
chmod +x x-search-script.js
./x-search-script.js --query "検索キーワード" [オプション]
```

## オプション

| オプション | 短縮形 | 説明 | デフォルト |
|------------|--------|------|------------|
| `--query` | `-q` | 検索クエリ（必須） | - |
| `--count` | `-c` | 取得件数 | 10 |
| `--full` | `-f` | 全文検索を使用（Academic Research アクセスが必要） | false |
| `--start` | `-s` | 検索開始日時（ISO 8601形式） | - |
| `--end` | `-e` | 検索終了日時（ISO 8601形式） | - |
| `--key` | - | X API Key | 環境変数から |
| `--secret` | - | X API Secret | 環境変数から |
| `--help` | `-h` | ヘルプを表示 | - |

## 実行例

### 基本的な検索（直近のツイート）
```bash
npm run x-search -- --query "AI" --count 5
```

### 日付範囲を指定した全文検索
```bash
npm run x-search -- -q "ChatGPT" -c 20 -f -s "2023-01-01T00:00:00Z" -e "2023-12-31T23:59:59Z"
```

### APIキーを直接指定
```bash
npm run x-search -- -q "機械学習" --key "あなたのAPIキー" --secret "あなたのAPIシークレット"
```

## 出力例

```
検索クエリ: "AI"
取得件数: 5
検索モード: 直近の検索

検索を実行中...

検索結果: 5件のツイートが見つかりました

--- ツイート #1 ---
ユーザー: AI News (@AI_News_JP)
日時: 2023/10/15 12:34:56
内容: 最新のAI技術についてのニュースをお届けします。#AI #人工知能

リツイート: 5, いいね: 20

--- ツイート #2 ---
...

--- メタデータ ---
結果件数: 5
次ページトークン: abc123xyz789
```

## 注意事項

- X APIの利用制限に注意してください
- 全文検索（`--full`オプション）はAcademic Research アクセスが必要です
- 検索クエリの構文はX APIのドキュメントに従ってください 