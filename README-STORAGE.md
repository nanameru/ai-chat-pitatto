# Supabaseストレージ設定ガイド

このドキュメントでは、PitattoChatアプリケーションで使用するSupabaseストレージの設定方法について説明します。

## 前提条件

- Supabaseプロジェクトが作成済みであること
- 管理者権限を持つアカウントでSupabaseダッシュボードにアクセスできること

## ストレージバケットの作成

1. [Supabaseダッシュボード](https://app.supabase.io/)にログインします。
2. 該当するプロジェクトを選択します。
3. 左側のメニューから「Storage」を選択します。
4. 「New Bucket」ボタンをクリックします。
5. バケット名に「PitattoChat」と入力します。
6. 「Public Bucket」オプションをオンにします（ファイルを公開アクセス可能にする場合）。
7. 「Create Bucket」ボタンをクリックしてバケットを作成します。

## RLSポリシーの設定

バケットを作成したら、適切なRLS（Row Level Security）ポリシーを設定する必要があります：

1. 作成したバケット「PitattoChat」をクリックします。
2. 「Policies」タブを選択します。
3. 以下のポリシーを追加します：

### 匿名ユーザー向けの読み取りポリシー

1. 「New Policy」ボタンをクリックします。
2. 「For templates」から「Get public URL of objects (select)」を選択します。
3. 「Policy name」に「public-read」と入力します。
4. 「Definition」は以下のようにします：
   ```sql
   (bucket_id = 'PitattoChat'::text)
   ```
5. 「Save Policy」ボタンをクリックします。

### 認証済みユーザー向けの書き込みポリシー

1. 「New Policy」ボタンをクリックします。
2. 「For templates」から「Upload, update, and delete objects (insert, update, delete)」を選択します。
3. 「Policy name」に「auth-write」と入力します。
4. 「Definition」は以下のようにします：
   ```sql
   (bucket_id = 'PitattoChat'::text)
   ```
5. 「Save Policy」ボタンをクリックします。

## バケット設定の確認

バケットの設定を確認するには：

1. 「Configuration」タブを選択します。
2. 「Public」が「Enabled」になっていることを確認します（公開バケットの場合）。
3. 必要に応じて「File size limit」を設定します（例：50MB）。

## トラブルシューティング

### エラー: new row violates row-level security policy

このエラーは、通常、バケットの作成や更新に必要な権限がない場合に発生します。解決策：

1. Supabaseダッシュボードから管理者としてバケットを手動で作成してください。
2. RLSポリシーが正しく設定されていることを確認してください。
3. アプリケーションの環境変数（`.env.local`）に正しいSupabase URLとAnon Keyが設定されていることを確認してください。

### ファイルのアップロードに失敗する場合

1. バケットが存在することを確認してください。
2. 適切なRLSポリシーが設定されていることを確認してください。
3. ファイルサイズが制限を超えていないことを確認してください。
4. サーバーログでエラーメッセージを確認してください。

## 環境変数の設定

アプリケーションの`.env.local`ファイルに以下の環境変数が正しく設定されていることを確認してください：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

これらの値はSupabaseダッシュボードの「Project Settings」→「API」から取得できます。 