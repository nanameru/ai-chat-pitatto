---
title: "Docker上でshort-video-makerとn8nを連携させるMCPクライアントセットアップ"
emoji: "🐳"
type: "article"
topics: ["Docker", "n8n", "MCP", "automation", "video"]
published: false
---

# Docker上でshort-video-makerとn8nを連携させるMCPクライアントセットアップ

## はじめに

この記事では、David Gyori氏が開発した`short-video-maker`コンテナとn8nワークフロー自動化ツールを連携させる方法を解説します。MCPクライアント（Multi-Model Chat Protocol）を使用して、両者をシームレスに連携させる手順をご紹介します。

## 前提条件

- Dockerがインストールされていること
- Dockerが起動していること
- ターミナルまたはコマンドプロンプトが使えること

## システム概要

`short-video-maker`は短い動画を自動生成するためのツールで、n8nはノーコードでワークフロー自動化を実現するプラットフォームです。両者をMCPプロトコルで連携させることで、動画生成をワークフローに組み込むことが可能になります。

## セットアップ手順

### 1. Dockerネットワークの作成

まず、両方のコンテナが通信できるための共通ネットワークを作成します。

```bash
docker network create app-network
```

このコマンドで`app-network`という名前のDockerネットワークが作成されます。

### 2. short-video-makerの起動

Pexels API Keyを使用して`short-video-maker`コンテナを起動します。

```bash
docker run -it --rm --name short-video-maker \
  --network app-network \
  -p 3123:3123 \
  -e LOG_LEVEL=debug \
  -e PEXELS_API_KEY=lAkadasj8yDkZ6CvQjYuiCHiCMqIAZz33cNk8X7Bo1A7ORpxPPBeFL2f \
  gyoridavid/short-video-maker:latest-tiny
```

パラメータの説明:
- `--network app-network`: 先ほど作成したネットワークに接続
- `-p 3123:3123`: ホストの3123ポートをコンテナの3123ポートにマッピング
- `-e LOG_LEVEL=debug`: デバッグレベルのログを有効化
- `-e PEXELS_API_KEY=...`: Pexels APIのアクセスキーを設定

### 3. n8nの起動

同じネットワーク上でn8nを起動します。

```bash
docker run -it --rm --name n8n \
  --network app-network \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

パラメータの説明:
- `--network app-network`: short-video-makerと同じネットワークに接続
- `-p 5678:5678`: ホストの5678ポートをコンテナの5678ポートにマッピング
- `-v ~/.n8n:/home/node/.n8n`: n8nの設定を永続化するためのボリュームマウント

### 4. n8nでのMCP Client設定

1. ブラウザで http://localhost:5678 にアクセスしてn8nを開きます
2. 必要に応じてn8nの初期セットアップを完了させます
3. ワークフローを作成し、「MCP Client」ノードを追加します
4. 以下のように設定します：
   - **Parameters タブ**:
     - SSE Endpoint: `http://short-video-maker:3123/mcp/sse`
     - Authentication: `None`
     - Tools to Include: `Selected`

![MCP Client設定](https://storage.googleapis.com/zenn-user-upload/placeholder-image.png)

**重要**: SSE Endpointに`localhost`ではなく`short-video-maker`というコンテナ名を使用していることに注目してください。これはDocker内部のDNS解決によるもので、同じネットワーク内のコンテナにはその名前でアクセスできます。

## 動作確認

設定が完了したら、n8nワークフローを実行して`short-video-maker`のMCP機能にアクセスできるかを確認します。正常に設定されていれば、ワークフロー実行時にMCPクライアントを通じて`short-video-maker`の機能を利用できるようになります。

## トラブルシューティング

### コンテナが既に存在する場合

既存のコンテナを削除してから再起動します：

```bash
# short-video-makerを停止・削除
docker stop short-video-maker
docker rm short-video-maker

# n8nを停止・削除
docker stop n8n
docker rm n8n
```

### 接続の確認

コンテナ間の接続を確認するには：

```bash
# コンテナの実行状態を確認
docker ps | grep -E 'n8n|short-video-maker'

# short-video-makerのログを確認
docker logs short-video-maker
```

### MCPエンドポイントの確認

short-video-makerのMCPエンドポイントが正しく設定されているかを確認：

```bash
curl -v http://localhost:3123/mcp/sse
```

正常に動作している場合、SSEイベントストリームのレスポンスが返されます。

## まとめ

この記事では、`short-video-maker`とn8nを同じDockerネットワーク上で実行し、MCPクライアントを使って連携する方法を説明しました。これにより、動画生成をn8nのワークフローに統合することが可能になります。

Docker内のコンテナ間通信の基本を理解し、適切にネットワークを設定することで、様々なサービスをシームレスに連携させることができます。

## 参考リンク

- [David Gyori's GitHub Repository](https://github.com/gyoridavid/ai_agents_az/tree/main/episode_7)
- [n8n Official Documentation](https://docs.n8n.io/)
- [Docker Networking Guide](https://docs.docker.com/network/)