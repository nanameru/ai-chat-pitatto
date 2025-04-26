# YouTube 動画検索 API 仕様書

## 1. 概要

このドキュメントは、Mastra の `YouTubeSearchTool` が YouTube Data API v3 を利用して動画をキーワード検索する際の仕様を定義します。

参照元: [YouTube Data API v3 Reference](https://developers.google.com/youtube/v3/docs/?apix=true)

## 2. エンドポイント情報

- **HTTP メソッド:** `GET`
- **ベースURL:** `https://www.googleapis.com/youtube/v3`
- **パス:** `/search`
- **完全なURL:** `https://www.googleapis.com/youtube/v3/search`

## 3. 認証

- **方式:** API キー
- **パラメータ名:** `key`
- **値:** Google Cloud Platform で取得した YouTube Data API v3 用の API キー。ツール実装では環境変数 `YOUTUBE_API_KEY` から読み込むことを想定。

## 4. リクエストパラメータ

### 4.1. 必須パラメータ

| パラメータ名 | 型      | 説明                                                                  |
| :----------- | :------ | :-------------------------------------------------------------------- |
| `part`       | string  | 取得するリソースのパートを指定。固定値 `snippet` を使用する。           |
| `key`        | string  | API キー (上記「3. 認証」参照)。                                    |
| `q`          | string  | 検索キーワード（URLエンコードが必要）。ツールへのユーザー入力に対応。 |
| `type`       | string  | 検索対象リソースタイプ。固定値 `video` を使用し、動画のみを対象とする。 |

### 4.2. オプションパラメータ (ツールの入力スキーマに対応)

| パラメータ名      | 型      | デフォルト値 | 説明                                                                                   |
| :---------------- | :------ | :----------- | :------------------------------------------------------------------------------------- |
| `maxResults`      | integer | 5            | 取得する検索結果の最大数 (1-50)。                                                      |
| `order`           | string  | `relevance`  | 結果の並び順 (`relevance`, `date`, `rating`, `title`, `viewCount`)。                  |
| `videoDuration`   | string  | `any`        | 動画の長さでのフィルタ (`any`, `short`, `medium`, `long`)。                           |
| `eventType`       | string  | (指定なし)   | ライブイベントでのフィルタ (`completed`, `live`, `upcoming`)。指定しない場合は全て対象。 |

## 5. レスポンス形式 (成功時)

- **形式:** JSON
- **主要データ:** ルートオブジェクトの `items` 配列内に検索結果リストが含まれる。

### 5.1. `items` 配列の各要素 (動画) から抽出する情報

| プロパティ名      | 取得元 (JSON Path)                  | 型      | 説明                                                  |
| :---------------- | :------------------------------------ | :------ | :---------------------------------------------------- |
| `videoId`         | `item.id.videoId`                     | string  | 動画の一意な ID。                                   |
| `title`           | `item.snippet.title`                  | string  | 動画のタイトル。                                    |
| `description`     | `item.snippet.description`            | string  | 動画の説明文。                                      |
| `channelTitle`    | `item.snippet.channelTitle`           | string  | 動画が属するチャンネル名。                            |
| `publishedAt`     | `item.snippet.publishedAt`            | string  | 動画の公開日時 (ISO 8601 形式)。                     |
| `url`             | (生成) `https://youtube.com/watch?v=` | string  | 動画への完全な URL。`videoId` から生成する。         |
| `thumbnailUrl`    | `item.snippet.thumbnails.default.url` | string  | デフォルトのサムネイル画像 URL。                      |

**レスポンス例 (抜粋):**

```json
{
  "kind": "youtube#searchListResponse",
  "etag": "...",
  "nextPageToken": "...",
  "regionCode": "JP",
  "pageInfo": {
    "totalResults": 1000000,
    "resultsPerPage": 5
  },
  "items": [
    {
      "kind": "youtube#searchResult",
      "etag": "...",
      "id": {
        "kind": "youtube#video",
        "videoId": "VIDEO_ID_HERE"
      },
      "snippet": {
        "publishedAt": "2024-01-01T00:00:00Z",
        "channelId": "CHANNEL_ID_HERE",
        "title": "動画のタイトル",
        "description": "動画の説明文の抜粋...",
        "thumbnails": {
          "default": {
            "url": "https://i.ytimg.com/vi/VIDEO_ID_HERE/default.jpg",
            "width": 120,
            "height": 90
          },
          // medium, high も存在する
        },
        "channelTitle": "チャンネル名",
        "liveBroadcastContent": "none",
        "publishTime": "2024-01-01T00:00:00Z"
      }
    }
    // ... 他の検索結果 ...
  ]
}
```

## 6. エラーハンドリング

API は標準的な HTTP エラーステータスコードと、詳細を示す JSON ボディを返す。

- **400 Bad Request:** パラメータが無効 (例: `key` がない、`part` が不正)。
- **403 Forbidden:** API キーが無効、API が有効になっていない、クオータ超過など。
- **その他:** ネットワークエラーなども考慮する必要がある。

エラーレスポンス例:

```json
{
  "error": {
    "code": 403,
    "message": "The request is missing a valid API key.",
    "errors": [
      {
        "message": "The request is missing a valid API key.",
        "domain": "global",
        "reason": "forbidden"
      }
    ]
  }
}
``` 