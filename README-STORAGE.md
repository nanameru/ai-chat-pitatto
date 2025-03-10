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

## RLSポリシーの設定（重要）

バケットを作成したら、**必ず**適切なRLS（Row Level Security）ポリシーを設定する必要があります。これがないとファイルのアップロードや取得ができません：

1. 作成したバケット「PitattoChat」をクリックします。
2. 「Policies」タブを選択します。
3. 以下のポリシーを追加します：

### 匿名ユーザー向けの読み取りポリシー（SELECT）

1. 「New Policy」ボタンをクリックします。
2. 「Policy name」に「anon-read」と入力します。
3. 「Definition」に以下を入力します：
   ```sql
   true
   ```
   （すべてのファイルにアクセス可能）
4. 「For operations」で「SELECT」を選択します。
5. 「For roles」で「anon」を選択します。
6. 「Save Policy」ボタンをクリックします。

### 匿名ユーザー向けの書き込みポリシー（INSERT）

1. 「New Policy」ボタンをクリックします。
2. 「Policy name」に「anon-insert」と入力します。
3. 「Definition」に以下を入力します：
   ```sql
   true
   ```
   （すべてのファイルをアップロード可能）
4. 「For operations」で「INSERT」を選択します。
5. 「For roles」で「anon」を選択します。
6. 「Save Policy」ボタンをクリックします。

### 認証済みユーザー向けのポリシー（すべての操作）

1. 「New Policy」ボタンをクリックします。
2. 「Policy name」に「auth-all」と入力します。
3. 「Definition」に以下を入力します：
   ```sql
   true
   ```
4. 「For operations」で「ALL」を選択します。
5. 「For roles」で「authenticated」を選択します。
6. 「Save Policy」ボタンをクリックします。

## バケット設定の確認

バケットの設定を確認するには：

1. 「Configuration」タブを選択します。
2. 「Public」が「Enabled」になっていることを確認します（公開バケットの場合）。
3. 必要に応じて「File size limit」を設定します（例：50MB）。

## トラブルシューティング

### エラー: new row violates row-level security policy

このエラーは、適切なRLSポリシーが設定されていない場合に発生します。解決策：

1. 上記の「RLSポリシーの設定」セクションに従って、必要なポリシーをすべて設定してください。
2. 特に「匿名ユーザー向けの書き込みポリシー（INSERT）」が設定されていることを確認してください。
3. ポリシーを設定した後、アプリケーションを再起動してください。

### ポリシー設定時の注意点

1. **ポリシー名は自由に設定可能**ですが、わかりやすい名前を付けることをお勧めします。
2. **Definition（条件）**は、特定の条件を設定したい場合は変更できますが、すべてのファイルにアクセスを許可する場合は `true` を使用します。
3. **For operations**は、許可する操作を選択します（SELECT, INSERT, UPDATE, DELETE, ALL）。
4. **For roles**は、ポリシーを適用するロールを選択します（anon, authenticated）。

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