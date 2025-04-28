import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数を読み込む（ビルドディレクトリを考慮）
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

// デバッグモード
const DEBUG = process.env.DEBUG === "true";

// APIのベースURL
const API_BASE_URL = "https://note.com/api";

// note API認証情報（環境変数から取得）
const NOTE_GQL_AUTH_TOKEN = process.env.NOTE_GQL_AUTH_TOKEN || "";
const NOTE_SESSION_V5 = process.env.NOTE_SESSION_V5 || "";

// 認証状態
const AUTH_STATUS = {
  hasCookie: NOTE_GQL_AUTH_TOKEN !== "" || NOTE_SESSION_V5 !== "",
  anyAuth: NOTE_GQL_AUTH_TOKEN !== "" || NOTE_SESSION_V5 !== ""
};

// デバッグログ
if (DEBUG) {
  console.error(`Working directory: ${process.cwd()}`);
  console.error(`Script directory: ${__dirname}`);
  console.error(`Authentication status: Cookie=${AUTH_STATUS.hasCookie}`);
}

// MCP サーバーインスタンスを作成
const server = new McpServer({
  name: "note-api",
  version: "1.0.0"
});

// 各種データ型の定義
interface NoteUser {
  id?: string;
  nickname?: string;
  urlname?: string;
  bio?: string;
  profile?: {
    bio?: string;
  };
  followersCount?: number;
  followingCount?: number;
  notesCount?: number;
  magazinesCount?: number;
}

interface Note {
  id?: string;
  name?: string;
  key?: string;
  body?: string;
  user?: NoteUser;
  publishAt?: string;
  likeCount?: number;
  commentsCount?: number;
  status?: string;
}

interface Magazine {
  id?: string;
  name?: string;
  key?: string;
  description?: string;
  user?: NoteUser;
  publishAt?: string;
  notesCount?: number;
}

interface Comment {
  id?: string;
  body?: string;
  user?: NoteUser;
  publishAt?: string;
}

interface Like {
  id?: string;
  user?: NoteUser;
  createdAt?: string;
}

// APIレスポンスの型定義
interface NoteApiResponse {
  data?: {
    notes?: Note[];
    notesCount?: number;
    users?: NoteUser[];
    usersCount?: number;
    contents?: any[];
    totalCount?: number;
    limit?: number;
    magazines?: Magazine[];
    magazinesCount?: number;
    likes?: Like[];
    [key: string]: any;
  };
  comments?: Comment[];
  [key: string]: any;
}

// 整形済みデータの型定義
interface FormattedNote {
  id: string;
  title: string;
  excerpt?: string;
  body?: string;
  user: string | {
    id?: string;
    name?: string;
    nickname?: string;
    urlname?: string;
    bio?: string;
  };
  publishedAt: string;
  likesCount: number;
  commentsCount?: number;
  status?: string;
  url: string;
}

interface FormattedUser {
  id: string;
  nickname: string;
  urlname: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  notesCount: number;
  magazinesCount?: number;
  url: string;
}

interface FormattedMagazine {
  id: string;
  name: string;
  description: string;
  notesCount: number;
  publishedAt: string;
  user: string | {
    id?: string;
    nickname?: string;
    urlname?: string;
  };
  url: string;
}

interface FormattedComment {
  id: string;
  body: string;
  user: string | {
    id?: string;
    nickname?: string;
    urlname?: string;
  };
  publishedAt: string;
}

interface FormattedLike {
  id: string;
  user: string | {
    id?: string;
    nickname?: string;
    urlname?: string;
  };
  createdAt: string;
}

// APIリクエスト用のヘルパー関数
async function noteApiRequest(path: string, method: string = "GET", body: any = null, requireAuth: boolean = false): Promise<NoteApiResponse> {
  const headers: { [key: string]: string } = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
  };

  // 認証設定
  if (AUTH_STATUS.hasCookie) {
    // Cookieベースの認証
    const cookies = [];
    if (NOTE_GQL_AUTH_TOKEN) {
      cookies.push(`gql_auth_token=${NOTE_GQL_AUTH_TOKEN}`);
    }
    if (NOTE_SESSION_V5) {
      cookies.push(`_note_session_v5=${NOTE_SESSION_V5}`);
    }

    if (cookies.length > 0) {
      headers["Cookie"] = cookies.join("; ");
    }
  } else if (requireAuth) {
    // 認証が必要なのに認証情報がない場合
    throw new Error("認証情報が必要です。.envファイルに認証情報を設定してください。");
  }

  const options: any = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  try {
    if (DEBUG) {
      console.error(`Requesting ${API_BASE_URL}${path}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, options);

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "（レスポンステキストの取得に失敗）";
      }

      if (DEBUG) {
        console.error(`API error: ${response.status} ${response.statusText}, Body: ${errorText}`);
      }

      // 認証エラーの特別処理
      if (response.status === 401 || response.status === 403) {
        throw new Error("認証エラー: noteへのアクセス権限がありません。認証情報を確認してください。");
      }

      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NoteApiResponse;
    return data;
  } catch (error) {
    if (DEBUG) {
      console.error(`Error calling note API: ${error}`);
    }
    throw error;
  }
}

// 認証状態を確認する関数
function hasAuth() {
  return AUTH_STATUS.anyAuth;
}

// 1. 記事検索ツール
server.tool(
  "search-notes",
  "記事を検索する",
  {
    query: z.string().describe("検索キーワード"),
    size: z.number().default(10).describe("取得する件数（最大20）"),
    start: z.number().default(0).describe("検索結果の開始位置"),
  },
  async ({ query, size, start }) => {
    try {
      const data = await noteApiRequest(`/v3/searches?context=note&q=${encodeURIComponent(query)}&size=${size}&start=${start}`);

      // 結果を見やすく整形
      let formattedNotes: FormattedNote[] = [];
      if (data.data && data.data.notes) {
        formattedNotes = data.data.notes.map((note: Note) => ({
          id: note.id || "",
          title: note.name || "",
          excerpt: note.body ? (note.body.length > 100 ? note.body.substr(0, 100) + '...' : note.body) : '本文なし',
          user: note.user?.nickname || 'ユーザー不明',
          publishedAt: note.publishAt || '日付不明',
          likesCount: note.likeCount || 0,
          url: `https://note.com/${note.user?.urlname || 'unknown'}/n/${note.key || ''}`
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: data.data?.notesCount || 0,
              notes: formattedNotes
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `検索に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 2. 記事詳細取得ツール
server.tool(
  "get-note",
  "記事の詳細情報を取得する",
  {
    noteId: z.string().describe("記事ID（例: n4f0c7b884789）"),
  },
  async ({ noteId }) => {
    try {
      const data = await noteApiRequest(`/v3/notes/${noteId}`);

      // 結果を見やすく整形
      const noteData = data.data || {};
      const formattedNote: FormattedNote = {
        id: noteData.id || "",
        title: noteData.name || "",
        body: noteData.body || "",
        user: {
          id: noteData.user?.id || "",
          name: noteData.user?.nickname || "",
          urlname: noteData.user?.urlname || "",
          bio: noteData.user?.bio || "",
        },
        publishedAt: noteData.publishAt || "",
        likesCount: noteData.likeCount || 0,
        commentsCount: noteData.commentsCount || 0,
        status: noteData.status || "",
        url: `https://note.com/${noteData.user?.urlname || 'unknown'}/n/${noteData.key || ''}`
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedNote, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `記事の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 3. ユーザー検索ツール
server.tool(
  "search-users",
  "ユーザーを検索する",
  {
    query: z.string().describe("検索キーワード"),
    size: z.number().default(10).describe("取得する件数（最大20）"),
    start: z.number().default(0).describe("検索結果の開始位置"),
  },
  async ({ query, size, start }) => {
    try {
      const data = await noteApiRequest(`/v3/searches?context=user&q=${encodeURIComponent(query)}&size=${size}&start=${start}`);

      // 結果を見やすく整形
      let formattedUsers: FormattedUser[] = [];
      if (data.data && data.data.users) {
        formattedUsers = data.data.users.map((user: NoteUser) => ({
          id: user.id || "",
          nickname: user.nickname || "",
          urlname: user.urlname || "",
          bio: user.profile?.bio || '',
          followersCount: user.followersCount || 0,
          followingCount: user.followingCount || 0,
          notesCount: user.notesCount || 0,
          url: `https://note.com/${user.urlname || ''}`
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: data.data?.usersCount || 0,
              users: formattedUsers
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `検索に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 4. ユーザー詳細取得ツール
server.tool(
  "get-user",
  "ユーザーの詳細情報を取得する",
  {
    username: z.string().describe("ユーザー名（例: princess_11）"),
  },
  async ({ username }) => {
    try {
      const data = await noteApiRequest(`/v2/creators/${username}`);

      // 結果を見やすく整形
      const userData = data.data || {};
      const formattedUser: FormattedUser = {
        id: userData.id || "",
        nickname: userData.nickname || "",
        urlname: userData.urlname || "",
        bio: userData.profile?.bio || '',
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        notesCount: userData.notesCount || 0,
        magazinesCount: userData.magazinesCount || 0,
        url: `https://note.com/${userData.urlname || ''}`
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedUser, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `ユーザー情報の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 5. ユーザーの記事一覧取得ツール
server.tool(
  "get-user-notes",
  "ユーザーの記事一覧を取得する",
  {
    username: z.string().describe("ユーザー名"),
    page: z.number().default(1).describe("ページ番号"),
  },
  async ({ username, page }) => {
    try {
      const data = await noteApiRequest(`/v2/creators/${username}/contents?kind=note&page=${page}`);

      // 結果を見やすく整形
      let formattedNotes: FormattedNote[] = [];
      if (data.data && data.data.contents) {
        formattedNotes = data.data.contents.map((note: Note) => ({
          id: note.id || "",
          title: note.name || "",
          excerpt: note.body ? (note.body.length > 100 ? note.body.substr(0, 100) + '...' : note.body) : '本文なし',
          publishedAt: note.publishAt || '日付不明',
          likesCount: note.likeCount || 0,
          commentsCount: note.commentsCount || 0,
          user: username,
          url: `https://note.com/${username}/n/${note.key || ''}`
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: data.data?.totalCount || 0,
              limit: data.data?.limit || 0,
              notes: formattedNotes
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `記事一覧の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 6. コメント一覧取得ツール
server.tool(
  "get-comments",
  "記事へのコメント一覧を取得する",
  {
    noteId: z.string().describe("記事ID"),
  },
  async ({ noteId }) => {
    try {
      const data = await noteApiRequest(`/v1/note/${noteId}/comments`);

      // 結果を見やすく整形
      let formattedComments: FormattedComment[] = [];
      if (data.comments) {
        formattedComments = data.comments.map((comment: Comment) => ({
          id: comment.id || "",
          body: comment.body || "",
          user: comment.user?.nickname || "匿名ユーザー",
          publishedAt: comment.publishAt || ""
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              comments: formattedComments
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `コメントの取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 7. 記事投稿ツール（下書き保存）
server.tool(
  "post-draft-note",
  "下書き状態の記事を投稿する",
  {
    title: z.string().describe("記事のタイトル"),
    body: z.string().describe("記事の本文"),
    tags: z.array(z.string()).optional().describe("タグ（最大10個）"),
    id: z.string().optional().describe("既存の下書きID（既存の下書きを更新する場合）"),
  },
  async ({ title, body, tags, id }) => {
    try {
      // 認証が必要なエンドポイント
      if (!hasAuth()) {
        return {
          content: [
            {
              type: "text",
              text: "認証情報がないため、投稿できません。.envファイルに認証情報を設定してください。"
            }
          ],
          isError: true
        };
      }

      const postData = {
        title,
        body,
        tags: tags || [],
      };

      const endpoint = id
        ? `/v1/text_notes/draft_save?id=${id}`
        : "/v1/text_notes/draft_save";

      const data = await noteApiRequest(endpoint, "POST", postData, true);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `記事の投稿に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 8. コメント投稿ツール
server.tool(
  "post-comment",
  "記事にコメントを投稿する",
  {
    noteId: z.string().describe("記事ID"),
    text: z.string().describe("コメント本文"),
  },
  async ({ noteId, text }) => {
    try {
      // 認証が必要なエンドポイント
      if (!hasAuth()) {
        return {
          content: [
            {
              type: "text",
              text: "認証情報がないため、コメントできません。.envファイルに認証情報を設定してください。"
            }
          ],
          isError: true
        };
      }

      const data = await noteApiRequest(`/v1/note/${noteId}/comments`, "POST", { text }, true);

      return {
        content: [
          {
            type: "text",
            text: `コメントを投稿しました：\n${JSON.stringify(data, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `コメントの投稿に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 9. スキ取得ツール
server.tool(
  "get-likes",
  "記事のスキ一覧を取得する",
  {
    noteId: z.string().describe("記事ID"),
  },
  async ({ noteId }) => {
    try {
      const data = await noteApiRequest(`/v3/notes/${noteId}/likes`);

      // 結果を見やすく整形
      let formattedLikes: FormattedLike[] = [];
      if (data.data && data.data.likes) {
        formattedLikes = data.data.likes.map((like: Like) => ({
          id: like.id || "",
          createdAt: like.createdAt || "",
          user: like.user?.nickname || "匿名ユーザー"
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              likes: formattedLikes
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `スキ一覧の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 10. スキをつけるツール
server.tool(
  "like-note",
  "記事にスキをする",
  {
    noteId: z.string().describe("記事ID"),
  },
  async ({ noteId }) => {
    try {
      // 認証が必要なエンドポイント
      if (!hasAuth()) {
        return {
          content: [
            {
              type: "text",
              text: "認証情報がないため、スキできません。.envファイルに認証情報を設定してください。"
            }
          ],
          isError: true
        };
      }

      const data = await noteApiRequest(`/v3/notes/${noteId}/likes`, "POST", {}, true);

      return {
        content: [
          {
            type: "text",
            text: "スキをつけました"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `スキに失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 11. スキを削除するツール
server.tool(
  "unlike-note",
  "記事のスキを削除する",
  {
    noteId: z.string().describe("記事ID"),
  },
  async ({ noteId }) => {
    try {
      // 認証が必要なエンドポイント
      if (!hasAuth()) {
        return {
          content: [
            {
              type: "text",
              text: "認証情報がないため、スキの削除ができません。.envファイルに認証情報を設定してください。"
            }
          ],
          isError: true
        };
      }

      const data = await noteApiRequest(`/v3/notes/${noteId}/likes`, "DELETE", {}, true);

      return {
        content: [
          {
            type: "text",
            text: "スキを削除しました"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `スキの削除に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 12. マガジン検索ツール
server.tool(
  "search-magazines",
  "マガジンを検索する",
  {
    query: z.string().describe("検索キーワード"),
    size: z.number().default(10).describe("取得する件数（最大20）"),
    start: z.number().default(0).describe("検索結果の開始位置"),
  },
  async ({ query, size, start }) => {
    try {
      const data = await noteApiRequest(`/v3/searches?context=magazine&q=${encodeURIComponent(query)}&size=${size}&start=${start}`);

      // 結果を見やすく整形
      let formattedMagazines: FormattedMagazine[] = [];
      if (data.data && data.data.magazines) {
        formattedMagazines = data.data.magazines.map((magazine: Magazine) => ({
          id: magazine.id || "",
          name: magazine.name || "",
          description: magazine.description || "",
          notesCount: magazine.notesCount || 0,
          publishedAt: magazine.publishAt || "",
          user: magazine.user?.nickname || "匿名ユーザー",
          url: `https://note.com/${magazine.user?.urlname || ''}/m/${magazine.key || ''}`
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: data.data?.magazinesCount || 0,
              magazines: formattedMagazines
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `検索に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 13. マガジン詳細取得ツール
server.tool(
  "get-magazine",
  "マガジンの詳細情報を取得する",
  {
    magazineId: z.string().describe("マガジンID（例: m75081e161aeb）"),
  },
  async ({ magazineId }) => {
    try {
      const data = await noteApiRequest(`/v1/magazines/${magazineId}`);

      // 結果を見やすく整形
      const magazineData = data.data || {};
      const formattedMagazine: FormattedMagazine = {
        id: magazineData.id || "",
        name: magazineData.name || "",
        description: magazineData.description || "",
        notesCount: magazineData.notesCount || 0,
        publishedAt: magazineData.publishAt || "",
        user: magazineData.user?.nickname || "匿名ユーザー",
        url: `https://note.com/${magazineData.user?.urlname || ''}/m/${magazineData.key || ''}`
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedMagazine, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `マガジンの取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 14. カテゴリー記事一覧取得ツール
server.tool(
  "get-category-notes",
  "カテゴリーに含まれる記事一覧を取得する",
  {
    category: z.string().describe("カテゴリー名（例: tech）"),
    page: z.number().default(1).describe("ページ番号"),
    sort: z.enum(["new", "trend"]).default("new").describe("ソート方法（new: 新着順, trend: 人気順）"),
  },
  async ({ category, page, sort }) => {
    try {
      const data = await noteApiRequest(`/v1/categories/${category}?note_intro_only=true&sort=${sort}&page=${page}`);

      // 結果を見やすく整形
      let formattedNotes: FormattedNote[] = [];
      if (data.data && data.data.notes) {
        formattedNotes = data.data.notes.map((note: Note) => ({
          id: note.id || "",
          title: note.name || "",
          excerpt: note.body ? (note.body.length > 100 ? note.body.substr(0, 100) + '...' : note.body) : '本文なし',
          user: {
            nickname: note.user?.nickname || "",
            urlname: note.user?.urlname || ""
          },
          publishedAt: note.publishAt || '日付不明',
          likesCount: note.likeCount || 0,
          url: `https://note.com/${note.user?.urlname || ''}/n/${note.key || ''}`
        }));
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              category,
              page,
              notes: formattedNotes
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `カテゴリー記事の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// 15. PV統計情報取得ツール
server.tool(
  "get-stats",
  "ダッシュボードのPV統計情報を取得する",
  {
    filter: z.enum(["all", "day", "week", "month"]).default("all").describe("期間フィルター"),
    page: z.number().default(1).describe("ページ番号"),
    sort: z.enum(["pv", "date"]).default("pv").describe("ソート方法（pv: PV数順, date: 日付順）"),
  },
  async ({ filter, page, sort }) => {
    try {
      // 認証が必要なエンドポイント
      if (!hasAuth()) {
        return {
          content: [
            {
              type: "text",
              text: "認証情報がないため、統計情報を取得できません。.envファイルに認証情報を設定してください。"
            }
          ],
          isError: true
        };
      }

      const data = await noteApiRequest(`/v1/stats/pv?filter=${filter}&page=${page}&sort=${sort}`, "GET", null, true);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `統計情報の取得に失敗しました: ${error}`
          }
        ],
        isError: true
      };
    }
  }
);

// プロンプトの追加
// 検索用のプロンプトテンプレート
server.prompt(
  "note-search",
  {
    query: z.string().describe("検索したいキーワード"),
  },
  ({ query }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `note.comで「${query}」に関する記事を検索して、要約してください。特に参考になりそうな記事があれば詳しく教えてください。`
      }
    }]
  })
);

// 競合分析プロンプト
server.prompt(
  "competitor-analysis",
  {
    username: z.string().describe("分析したい競合のユーザー名"),
  },
  ({ username }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `note.comの「${username}」というユーザーの記事を分析して、以下の観点から教えてください：\n\n- 主なコンテンツの傾向\n- 人気記事の特徴\n- 投稿の頻度\n- エンゲージメントの高い記事の特徴\n- 差別化できそうなポイント`
      }
    }]
  })
);

// アイデア生成プロンプト
server.prompt(
  "content-idea-generation",
  {
    topic: z.string().describe("記事のトピック"),
  },
  ({ topic }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `「${topic}」に関するnote.comの記事のアイデアを5つ考えてください。各アイデアには以下を含めてください：\n\n- キャッチーなタイトル案\n- 記事の概要（100文字程度）\n- 含めるべき主なポイント（3-5つ）\n- 差別化できるユニークな切り口`
      }
    }]
  })
);

// 記事分析プロンプト
server.prompt(
  "article-analysis",
  {
    noteId: z.string().describe("分析したい記事のID"),
  },
  ({ noteId }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `note.comの記事ID「${noteId}」の内容を分析して、以下の観点から教えてください：\n\n- 記事の主なテーマと要点\n- 文章の構成と特徴\n- エンゲージメントを得ている要素\n- 改善できそうなポイント\n- 参考にできる文章テクニック`
      }
    }]
  })
);

// サーバーの起動
async function main() {
  try {
    // STDIOトランスポートを作成して接続
    const transport = new StdioServerTransport();
    console.error("Starting note API MCP Server...");
    await server.connect(transport);
    console.error("note API MCP Server is running on stdio transport");

    // 認証状態を表示
    if (hasAuth()) {
      console.error("認証情報が設定されています。認証が必要な機能も利用できます。");
    } else {
      console.error("警告: 認証情報が設定されていません。読み取り機能のみ利用可能です。");
      console.error("投稿、コメント、スキなどの機能を使うには.envファイルに認証情報を設定してください。");
    }
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 