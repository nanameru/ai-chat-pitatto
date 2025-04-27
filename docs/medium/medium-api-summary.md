# Medium API (旧) 概要と現状

## 1. 概要

Medium は過去に、記事の投稿などをプログラムで行うための API を提供していました。この記事 (Mike Wolfe 氏による "Medium Has An API?") は、その API の利用方法 (認証トークン取得、記事投稿) について解説しています。

**しかし、記事のコメントおよび Medium の公式ヘルプによると、この API は現在、新規のインテグレーションを受け付けていません。**

参照元記事: [Medium Has An API?](https://medium.com/codex/medium-has-an-api-d Mediumteam/medium-has-an-api-d)
参照元ヘルプ: [Get an integration token](https://help.medium.com/hc/en-us/articles/213480228-Get-an-integration-token-for-your-writing-app)

## 2. API の (旧) 機能概要

過去に提供されていた API の主な機能は以下の通りです。

- **記事の投稿:**
    - Markdown 形式のコンテンツを HTML に変換して投稿。
    - `draft` ステータスで投稿し、公開前にレビューが可能。
    - 記事にタグを設定。
    - Canonical URL を設定し、元の記事ソースを指定。
- **ユーザー情報の取得:**
    - `/me` エンドポイントで認証ユーザーの ID を取得。

## 3. (旧) 認証方法

- **インテグレーショントークン:** Medium の設定画面から取得したトークンを `Authorization: Bearer <token>` ヘッダーに含めてリクエストを送信していました。

## 4. (旧) 主要エンドポイント

記事内で言及されているエンドポイント:

- `GET /me`: 認証ユーザーの情報を取得。
- `POST /users/{authorId}/posts`: 記事を投稿。

## 5. 現状と結論 (重要)

- **新規利用不可:** 上記の参照元ヘルプ記事にも記載されている通り、Medium は **現在、この API を利用した新規のインテグレーションを許可していません。**
- **限定的な利用:** 過去に承認されたインテグレーションや、特定の契約を結んだサードパーティのみが利用できる可能性があります。

**結論として、Mastra ツールとして Medium API を利用して新規に記事検索や投稿機能などを実装することは、現状では不可能です。** `MediumSearchTool` を実装する場合、代替案（例: `site:medium.com` を使った汎用検索エンジンの利用）を検討する必要があります。 