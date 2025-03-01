# プロジェクト構造規約

```
pitattochatui/
├── app/                      # Next.js アプリケーションルート
│   ├── (auth)/               # 認証関連ページ
│   ├── (chat)/               # チャット関連ページ
│   │   ├── api/              # チャット関連APIエンドポイント
│   │   │   ├── chat/         # チャットAPI
│   │   │   ├── history/      # 履歴API
│   │   │   ├── vote/         # 投票API
│   │   │   └── x-search/     # X検索API
│   │   ├── chat/             # チャットページ
│   │   └── page.tsx          # メインページ
│   ├── api/                  # グローバルAPIエンドポイント
│   │   └── auth/             # 認証API
│   ├── globals.css           # グローバルスタイル
│   └── layout.tsx            # ルートレイアウト
├── components/               # コンポーネント
│   ├── ui/                   # 基本UI要素
│   ├── message.tsx           # メッセージコンポーネント
│   ├── messages.tsx          # メッセージリストコンポーネント
│   ├── multimodal-input.tsx  # 入力コンポーネント
│   ├── chat.tsx              # チャットコンポーネント
│   └── ...                   # その他のコンポーネント
├── hooks/                    # カスタムフック
├── lib/                      # ユーティリティ
│   ├── ai/                   # AI関連機能
│   │   ├── coze/             # Coze AI統合
│   │   ├── tools/            # AIツール
│   │   ├── x-search/         # X検索機能
│   │   └── ...               # その他のAI関連ファイル
│   ├── db/                   # データベース関連
│   ├── editor/               # エディタ関連
│   └── utils.ts              # 共通ユーティリティ関数
├── memory_bank/              # メモリーバンク
├── public/                   # 静的ファイル
└── utils/                    # ルートレベルユーティリティ
```

## 重要な制約
1. **変更禁止ファイル**
   - `lib/ai/coze/coze.ts`
   - `lib/ai/models.ts`
   - `lib/ai/prompts.ts`

2. **バージョン管理**
   - 技術スタックのバージョン変更は要承認
   - AIモデルのバージョンは固定

3. **コード配置**
   - 共通処理は `lib/utils.ts` に配置
   - UIコンポーネントは `components/ui/` に配置
   - APIエンドポイントは `app/(chat)/api/[endpoint]/route.ts` または `app/api/[endpoint]/route.ts` に配置
   - メッセージ関連のコンポーネントは `components/message.tsx` と `components/messages.tsx` に配置
   - 入力関連のコンポーネントは `components/multimodal-input.tsx` に配置
   - X検索関連の機能は `lib/ai/x-search/` に配置

4. **メモリーバンク管理**
   - コードベースの変更後は対応する `memory_bank` ディレクトリ内のmdファイルを更新すること
   - 更新内容には変更日時、詳細、影響を受けるファイル、関連する改善や機能、今後の予定や課題を含めること
