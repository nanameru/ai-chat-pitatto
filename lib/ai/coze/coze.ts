const WORKFLOW_ID = '7462445424055746578';
const API_URL = 'https://api.coze.com/v1/workflow/stream_run';
const BATCH_SIZE = 10;        // 5→10に増やしてさらに処理効率を向上
const RETRY_DELAY = 3000;    // 5秒→3秒にさらに短縮
const MAX_RETRIES = 2;       // 2回のまま維持
const BATCH_DELAY = 5000;    // 8秒→5秒にさらに短縮

// レート制限とクォータ制限の管理のための定数
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 30,
  QUOTA_RESET_INTERVAL: 60 * 1000, // 1分
};

// リクエストの追跡
let requestCount = 0;
let lastResetTime = Date.now();

// レート制限のチェックと管理
function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastResetTime >= RATE_LIMIT.QUOTA_RESET_INTERVAL) {
    requestCount = 0;
    lastResetTime = now;
  }
  
  if (requestCount >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  requestCount++;
  return true;
}

export interface TwitterPost {
  id: string;
  text: string;
  author: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
    verified?: boolean;
  };
  metrics: {
    retweets: number;
    replies: number;
    likes: number;
    quotes: number;
    impressions: number;
  };
  created_at: string;
  urls?: {
    url: string;
    expanded_url: string;
    title?: string;
    description?: string;
    image?: string;
  }[];
  media?: {
    type: 'photo' | 'video' | 'gif';
    url: string;
    preview_url?: string;
    alt_text?: string;
  }[];
  referenced_tweets?: {
    type: 'replied_to' | 'quoted' | 'retweeted';
    id: string;
  }[];
  language?: string;
  source?: string;
  context_annotations?: {
    domain: { id: string; name: string; };
    entity: { id: string; name: string; };
  }[];
}

export interface FormattedResponse {
  query: string;
  posts: TwitterPost[];
  metadata: {
    total_count: number;
    newest_id?: string;
    oldest_id?: string;
    processing_time: number;
  };
  error?: string;
}

function formatTwitterPost(rawPost: any): TwitterPost {
  // 日付の安全な処理
  let created_at = rawPost.created_at;
  try {
    if (created_at) {
      // タイムスタンプの場合の処理
      if (typeof created_at === 'number') {
        created_at = new Date(created_at * 1000).toISOString();
      } else {
        // 文字列の場合の処理
        const date = new Date(created_at);
        if (!isNaN(date.getTime())) {
          created_at = date.toISOString();
        } else {
          // 無効な日付の場合は現在時刻を使用
          created_at = new Date().toISOString();
        }
      }
    } else {
      created_at = new Date().toISOString();
    }
  } catch (error) {
    console.error('Error parsing date:', error);
    created_at = new Date().toISOString();
  }

  return {
    id: rawPost.id || rawPost.rest_id,
    text: rawPost.text || rawPost.full_text,
    author: {
      id: rawPost.author_id || rawPost.user?.rest_id,
      username: rawPost.username || rawPost.user?.screen_name,
      name: rawPost.name || rawPost.user?.name,
      profile_image_url: rawPost.profile_image_url || rawPost.user?.profile_image_url,
      verified: rawPost.verified || rawPost.user?.verified
    },
    metrics: {
      retweets: rawPost.public_metrics?.retweet_count || rawPost.retweet_count || 0,
      replies: rawPost.public_metrics?.reply_count || rawPost.reply_count || 0,
      likes: rawPost.public_metrics?.like_count || rawPost.favorite_count || 0,
      quotes: rawPost.public_metrics?.quote_count || 0,
      impressions: rawPost.public_metrics?.impression_count || 0
    },
    created_at,
    urls: rawPost.entities?.urls?.map((u: any) => ({
      url: u.url,
      expanded_url: u.expanded_url,
      title: u.title,
      description: u.description,
      image: u.images?.[0]?.url
    })) || [],
    media: rawPost.media?.map((m: any) => ({
      type: m.type,
      url: m.url || m.media_url_https,
      preview_url: m.preview_image_url || m.display_url,
      alt_text: m.alt_text
    })) || [],
    referenced_tweets: rawPost.referenced_tweets || [],
    language: rawPost.lang,
    source: rawPost.source,
    context_annotations: rawPost.context_annotations || []
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ストリームコンテンツをパースするヘルパー関数
function parseStreamContent(content: string): any {
  console.log('\n=== parseStreamContent ===');
  console.log('Input content length:', content.length);

  try {
    // イベントメッセージをスキップ
    if (content.trim().startsWith('event:')) {
      console.log('Skipping event message:', content.trim());
      return null;
    }

    // データ部分を抽出
    const dataPrefix = 'data:';
    if (!content.includes(dataPrefix)) {
      if (content.trim().startsWith('id:')) {
        console.log('Skipping ID-only line:', content.trim());
        return null;
      }
      console.log('No data prefix found in content');
      return null;
    }

    // データ部分の抽出
    const startIndex = content.indexOf(dataPrefix) + dataPrefix.length;
    let jsonStr = content.slice(startIndex).trim();
    console.log('First parse - extracted JSON string length:', jsonStr.length);

    try {
      // 最初のJSONパース
      const firstParse = JSON.parse(jsonStr);
      
      // contentプロパティが文字列として存在する場合は二重パース
      if (firstParse.content && typeof firstParse.content === 'string') {
        console.log('Found nested content, performing second parse');
        const secondParse = JSON.parse(firstParse.content);
        console.log('Second parse successful, data structure:', 
          Object.keys(secondParse));
        return secondParse;
      }

      // debug_urlのみの応答は処理をスキップ
      if (firstParse && Object.keys(firstParse).length === 1 && firstParse.debug_url) {
        console.log('Skipping debug_url only response');
        return null;
      }

      // エラーレスポンスの確認
      if (firstParse.error_code) {
        console.log('Error response detected:', firstParse.error_message);
        return null;
      }

      return firstParse;
    } catch (parseError) {
      console.log('JSON parse error:', parseError);
      return null;
    }
  } catch (e) {
    console.error('Error in parseStreamContent:', e);
    return null;
  }
}

async function processStreamResponse(
  response: Response,
  query: string,
  userId?: string,
  chatId?: string
): Promise<FormattedResponse> {
  const startTime = Date.now();
  console.log('\n=== Starting processStreamResponse ===');
  console.log('Query:', query);

  const formattedResponse: FormattedResponse = {
    query,
    posts: [],
    metadata: {
      total_count: 0,
      processing_time: 0
    }
  };

  try {
    const responseText = await response.text();
    console.log('\n=== Raw Response ===');
    console.log('Response text length:', responseText.length);

    const allPosts: TwitterPost[] = [];
    let newestId: string | undefined;
    let oldestId: string | undefined;

    // レスポンステキストを行ごとに処理
    const lines = responseText.split('\n').filter(line => line.trim());
    console.log('\n=== Processing', lines.length, 'lines ===');

    for (const line of lines) {
      try {
        const parsedContent = parseStreamContent(line);
        if (!parsedContent) {
          continue;
        }

        // outputの配列を処理
        if (parsedContent.output && Array.isArray(parsedContent.output)) {
          console.log('Processing output array, length:', parsedContent.output.length);
          
          for (const item of parsedContent.output) {
            if (item?.freeBusy?.post) {
              const posts = Array.isArray(item.freeBusy.post) 
                ? item.freeBusy.post 
                : [item.freeBusy.post];
              
              console.log(`Found ${posts.length} posts in output item`);
              
              for (const post of posts) {
                try {
                  const formattedPost = formatTwitterPost(post);
                  if (!allPosts.some(p => p.id === formattedPost.id)) {
                    allPosts.push(formattedPost);
                    console.log(`Added post ${formattedPost.id} to results (total: ${allPosts.length})`);

                    if (!newestId || formattedPost.id > newestId) newestId = formattedPost.id;
                    if (!oldestId || formattedPost.id < oldestId) oldestId = formattedPost.id;
                  }
                } catch (postError) {
                  console.error('Error formatting post:', postError);
                }
              }
            }
          }
        }
      } catch (lineError) {
        console.error('Error processing line:', lineError);
      }
    }

    // 結果を設定
    formattedResponse.posts = allPosts;
    formattedResponse.metadata = {
      total_count: allPosts.length,
      processing_time: Date.now() - startTime,
      newest_id: newestId,
      oldest_id: oldestId
    };

    console.log('\n=== Final Response ===');
    console.log('Total posts:', allPosts.length);
    console.log('Processing time:', formattedResponse.metadata.processing_time, 'ms');

    // 結果をDBに保存（Embedding付き）
    if (allPosts.length > 0) {
      await storeDataWithEmbedding(
        query,
        allPosts.map(post => ({
          sourceTitle: `Twitter Post by ${post.author.username}`,
          sourceUrl: `https://twitter.com/${post.author.username}/status/${post.id}`,
          content: post.text,
          metadata: {
            author: post.author,
            metrics: post.metrics,
            created_at: post.created_at,
            urls: post.urls,
            media: post.media,
            referenced_tweets: post.referenced_tweets,
            language: post.language,
          },
        })),
        userId,
        chatId
      );
    } else {
      console.log('No posts to save, skipping embedding generation and storage');
    }

    return formattedResponse;
  } catch (error) {
    console.error('Error in processStreamResponse:', error);
    throw error;
  }
}

// ============== Cohere多言語Embeddingの設定 =============
// Supabase設定
import { createClient } from '@/utils/supabase/client';
let supabase: any;

// Supabaseクライアントの遅延初期化
function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
}

// Cohere API設定
const COHERE_API_URL = 'https://api.cohere.com/v2/embed';
const COHERE_API_KEY = process.env.NEXT_PUBLIC_CO_API_KEY;

/**
 * Cohere API（embed-multilingual-v3.0）を使って
 * テキストのEmbedding(1024次元)を一括で取得するヘルパー関数
 */
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  const BATCH_SIZE = 96; // Cohereの制限に合わせて96に設定

  // 結果を格納する配列
  let allEmbeddings: number[][] = [];

  // テキストを96個ずつのバッチに分割
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (!COHERE_API_KEY) {
          throw new Error('COHERE_API_KEY is not set');
        }

        const truncatedTexts = batch.map(text => text.slice(0, 8000));
        
        const requestBody = {
          texts: truncatedTexts,
          model: 'embed-multilingual-v3.0',
          input_type: 'search_document',
          embedding_types: ['float']
        };

        const response = await fetch(COHERE_API_URL, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authorization': `Bearer ${COHERE_API_KEY}`
          },
          body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(`API error: ${response.status} - ${JSON.stringify(responseData)}`);
        }

        // バッチの結果を全体の結果に追加
        allEmbeddings = [...allEmbeddings, ...responseData.embeddings.float];
        break; // 成功したらリトライループを抜ける

      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue;
        }
        throw error;
      }
    }
  }
  
  return allEmbeddings;
}

async function getCurrentQueryId(searchQuery: string, userId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    // XSearchSessionから最新のセッションを取得
    const { data: session, error: sessionError } = await supabase
      .from('XSearchSession')
      .select('*')
      .eq('userId', userId)
      .eq('query', searchQuery)
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (sessionError) {
      console.error('セッション取得エラー:', sessionError);
      return null;
    }

    return session?.id || null;
  } catch (error) {
    console.error('クエリID取得エラー:', error);
    return null;
  }
}

// コサイン類似度を計算する関数をエクスポート
export function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (norm1 * norm2);
}

// データをランク付けする関数をエクスポート
export function rankByEmbeddingSimilarity(userQueryEmbedding: number[], dataEmbeddings: number[][]): number[] {
  // 各データとユーザークエリとの類似度を計算
  const similarities = dataEmbeddings.map(embedding => 
    calculateCosineSimilarity(userQueryEmbedding, embedding)
  );

  // 類似度に基づいてインデックスをソート
  const indexesWithSimilarities = similarities.map((sim, index) => ({ sim, index }));
  indexesWithSimilarities.sort((a, b) => b.sim - a.sim); // 降順ソート

  // ランクを割り当て（1から始まる）
  const ranks = new Array(similarities.length).fill(0);
  indexesWithSimilarities.forEach(({ index }, rank) => {
    ranks[index] = rank + 1;
  });

  return ranks;
}

// 特定の親クエリに紐づくデータのランクを更新する関数を追加
export async function updateRankingsForParentQuery(
  parentQueryId: string,
  supabase: any
): Promise<void> {
  try {
    // 1. セッションの取得
    const { data: session, error: sessionError } = await supabase
      .from('XSearchSession')
      .select('*')
      .eq('id', parentQueryId)
      .single();

    if (sessionError) {
      throw new Error(`セッション取得エラー: ${sessionError.message}`);
    }

    // 2. 関連する検索結果の取得
    const { data: results, error: resultsError } = await supabase
      .from('XSearchResultMessage')
      .select(`
        id,
        resultId,
        XSearchResult (
          id,
          content
        )
      `)
      .eq('sessionId', session.id)
      .gte('embeddingScore', 0.5)  // embeddingScore >= 0.5のデータのみを取得
      .order('embeddingScore', { ascending: false })
      .limit(RERANK_BATCH_SIZE) as { 
        data: (XSearchResultMessage & { 
          XSearchResult: Pick<XSearchResult, 'id' | 'content'> 
        })[] | null;
        error: any;
      };

    if (resultsError) {
      throw new Error(`検索結果取得エラー: ${resultsError.message}`);
    }

    if (!results?.length) {
      console.log('Rerankする結果がありません');
      return;
    }

    // バッチ処理のための準備
    const validDocuments = results.filter((r): r is XSearchResultMessage & { XSearchResult: Pick<XSearchResult, 'id' | 'content'> } => 
      r.XSearchResult?.content != null
    );
    const batches = validDocuments.length > RERANK_BATCH_SIZE 
      ? Array.from({ length: Math.ceil(validDocuments.length / RERANK_BATCH_SIZE) }, (_, i) =>
          validDocuments.slice(i * RERANK_BATCH_SIZE, (i + 1) * RERANK_BATCH_SIZE)
        )
      : [validDocuments];

    // 全ての結果を一時的に保持
    let tempResults: XSearchResultMessage[] = [];
    
    // バッチ処理
    for (const batch of batches) {
      const documents = batch.map((r: XSearchResultMessage & { XSearchResult: Pick<XSearchResult, 'id' | 'content'> }) => 
        r.XSearchResult.content
      );
      
      // Cohereのrerank APIを呼び出し
      const response = await fetch('https://api.cohere.ai/v1/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'rerank-multilingual-v3.0',
          query: session.query,
          documents,
          top_n: documents.length,
          return_documents: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Rerank API error: ${response.statusText}`);
      }

      const rerankResults = await response.json();
      
      // バッチ内の各結果のスコアを更新
      const batchResults = rerankResults.results
        .map((result: any, index: number) => {
          if (!batch[index]) return null;
          
          const finalScore = calculateFinalScore(
            result.relevance_score,
            batch[index].embeddingScore
          );
          
          return {
            id: batch[index].id,
            resultId: batch[index].resultId,
            sessionId: session.id,
            messageId: session.messageId,
            embeddingScore: batch[index].embeddingScore,
            rerankScore: result.relevance_score,
            finalScore: finalScore,
            updatedAt: new Date().toISOString()
          };
        })
        .filter((update: XSearchResultMessage | null): update is XSearchResultMessage => update !== null);

      tempResults = [...tempResults, ...batchResults];
      
      // APIレート制限を考慮して待機
      if (batches.length > 1) {
        await sleep(1000);
      }
    }

    // 結果をデータベースに保存
    if (tempResults.length > 0) {
      const { error: updateError } = await supabase
        .from('XSearchResultMessage')
        .upsert(tempResults);

      if (updateError) {
        throw new Error(`結果の更新に失敗: ${updateError.message}`);
      }
    }

    // セッションの進捗を更新
    const { error: sessionUpdateError } = await supabase
      .from('XSearchSession')
      .update({
        progress: 100,  // rerank完了
        status: 'completed',
        updatedAt: new Date().toISOString()
      })
      .eq('id', session.id);

    if (sessionUpdateError) {
      console.error('セッション更新エラー:', sessionUpdateError);
    }

  } catch (error) {
    console.error('Rerank処理エラー:', error);
    throw error;
  }
}

// Rerankスコアと初回Embeddingスコアを組み合わせて最終スコアを計算
function calculateFinalScore(rerankScore: number, embeddingScore: number): number {
  // Rerankスコアを優先しつつ、Embeddingスコアも考慮
  // Rerankスコアに0.8の重みを、Embeddingスコアに0.2の重みを設定
  return (rerankScore * 0.8) + (embeddingScore * 0.2);
}

/**
 * XSearchResultテーブルに、Embedding付きで複数の投稿を一括保存する関数。
 * CohereのgetEmbeddings()で Embeddingを一括取得して保存します。
 */
export async function storeDataWithEmbedding(
  searchQuery: string,
  items: Array<{
    sourceTitle: string;
    sourceUrl: string;
    content: string;
    metadata: any;
  }>,
  userId?: string,
  chatId?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // セッションの取得
    const { data: session, error: sessionError } = await supabase
      .from('XSearchSession')
      .select('*')
      .eq('messageId', chatId)
      .single();

    if (sessionError) {
      throw new Error(`セッションの取得に失敗: ${sessionError.message}`);
    }

    // テキストからEmbeddingを生成
    const texts = items.map(item => item.content);
    const embeddings = await getEmbeddings(texts);
    
    // コサイン類似度の計算
    const queryEmbedding = await getEmbeddings([searchQuery]);
    const similarities = embeddings.map((embedding: number[]) => 
      calculateCosineSimilarity(queryEmbedding[0], embedding)
    );

    const now = new Date().toISOString();

    // XSearchResultに投稿を保存
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // XSearchResultに保存
      const { data: resultData, error: resultError } = await supabase
        .from('XSearchResult')
        .upsert({
          xPostId: item.metadata.id,
          content: item.content,
          embedding: embeddings[i],
          metadata: item.metadata,
          updatedAt: now
        }, {
          onConflict: 'xPostId'
        })
        .select()
        .single();

      if (resultError) {
        console.error('XSearchResult保存エラー:', resultError);
        continue;
      }

      // XSearchResultMessageに中間データを保存
      const { error: messageError } = await supabase
        .from('XSearchResultMessage')
        .insert({
          resultId: resultData.id,
          sessionId: session.id,
          messageId: chatId,
          embeddingScore: similarities[i],
          rerankScore: null,  // rerankは後で実行
          finalScore: similarities[i]  // 初期値としてembeddingScoreを使用
        });

      if (messageError) {
        console.error('XSearchResultMessage保存エラー:', messageError);
      }
    }

    // セッションの進捗を更新
    const { error: updateError } = await supabase
      .from('XSearchSession')
      .update({
        progress: 50,  // embeddingまで完了
        updatedAt: now
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('セッション更新エラー:', updateError);
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('データの保存エラー:', error.message);
      throw error;
    }
    throw new Error('不明なエラーが発生しました');
  }
}

export async function executeCozeQueries(
  subQueries: string[],
  userId?: string,
  chatId?: string,
  onProgress?: (processed: number) => void
): Promise<FormattedResponse[]> {
  const results: FormattedResponse[] = [];
  let processedCount = 0;
  
  // 最初のクエリ開始時に進捗を0として通知
  if (onProgress) {
    onProgress(0);
  }
  
  // Split queries into batches
  for (let i = 0; i < subQueries.length; i += BATCH_SIZE) {
    const batch = subQueries.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(subQueries.length / BATCH_SIZE)}`);
    
    // Process queries in parallel within each batch
    const batchPromises = batch.map(async (query) => {
      let retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          // レート制限のチェック
          if (!checkRateLimit()) {
            console.log('Rate limit reached, waiting for reset...');
            await sleep(RATE_LIMIT.QUOTA_RESET_INTERVAL);
            continue;
          }

          const cleanQuery = query
            .replace(/```json\s*\[?\s*/g, '')
            .replace(/\s*\]?\s*```\s*$/, '')
            .replace(/[{}"\\]/g, '')
            .replace(/^\s*query:\s*/, '')
            .replace(/,\s*$/, '')
            .trim();

          console.log(`Executing query: ${cleanQuery}`);
          const response = await fetch('https://api.coze.com/v1/workflow/stream_run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_COZE_API_KEY}`,
            },
            body: JSON.stringify({
              parameters: { input: cleanQuery },
              workflow_id: '7462445424055746578'
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            if (errorData.error_code === 4009 || 
                errorData.error_message?.includes('QUOTA_BYTES quota exceeded')) {
              console.log(`API limit reached, waiting ${RETRY_DELAY/1000} seconds before retry...`);
              await sleep(RETRY_DELAY);
              retries++;
              continue;
            }
            throw new Error(`API error: ${response.statusText}`);
          }

          const result = await processStreamResponse(response, cleanQuery, userId, chatId);
          processedCount++;
          if (onProgress) {
            onProgress(processedCount);
          }
          return result;
        } catch (error) {
          const err = error as Error;
          console.error(`Error processing query (attempt ${retries + 1}/${MAX_RETRIES}):`, err);
          if (retries === MAX_RETRIES - 1) {
            return {
              query,
              posts: [],
              metadata: { total_count: 0, processing_time: 0 },
              error: err.message
            };
          }
          await sleep(RETRY_DELAY);
          retries++;
        }
      }
      
      return {
        query,
        posts: [],
        metadata: { total_count: 0, processing_time: 0 },
        error: 'Max retries reached'
      };
    });

    // バッチ内のクエリを並列実行
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // バッチ間の待機
    if (i + BATCH_SIZE < subQueries.length) {
      console.log(`Waiting ${BATCH_DELAY/1000} seconds before processing next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  return results;
}

// 新しいテーブル構造に対応する型定義
type XSearchSession = {
  id: string;
  userId: string;
  messageId: string;
  query: string;
  modelId: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

type XSearchResult = {
  id: string;
  xPostId: string;
  content: string;
  embedding: number[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
};

type XSearchResultMessage = {
  id: string;
  resultId: string;
  sessionId: string;
  messageId: string;
  embeddingScore: number;
  rerankScore: number | null;
  finalScore: number;
  createdAt: string;
};

const RERANK_BATCH_SIZE = 100; // Cohereのrerank APIの制限に応じて調整

// Cohereのrerankを実行する関数
export async function rerankSimilarDocuments(parentQueryId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // セッションの取得
    const { data: session, error: sessionError } = await supabase
      .from('XSearchSession')
      .select('*')
      .eq('id', parentQueryId)
      .single();

    if (sessionError) {
      throw new Error(`セッション取得エラー: ${sessionError.message}`);
    }

    // 関連する検索結果の取得
    const { data: results, error: resultsError } = await supabase
      .from('XSearchResultMessage')
      .select(`
        id,
        resultId,
        XSearchResult (
          id,
          content
        )
      `)
      .eq('sessionId', session.id)
      .gte('embeddingScore', 0.5)  // embeddingScore >= 0.5のデータのみを取得
      .order('embeddingScore', { ascending: false })
      .limit(RERANK_BATCH_SIZE) as { 
        data: (XSearchResultMessage & { 
          XSearchResult: Pick<XSearchResult, 'id' | 'content'> 
        })[] | null;
        error: any;
      };

    if (resultsError) {
      throw new Error(`検索結果取得エラー: ${resultsError.message}`);
    }

    if (!results?.length) {
      console.log('Rerankする結果がありません');
      return;
    }

    // バッチ処理のための準備
    const validDocuments = results.filter((r): r is XSearchResultMessage & { XSearchResult: Pick<XSearchResult, 'id' | 'content'> } => 
      r.XSearchResult?.content != null
    );
    const batches = validDocuments.length > RERANK_BATCH_SIZE 
      ? Array.from({ length: Math.ceil(validDocuments.length / RERANK_BATCH_SIZE) }, (_, i) =>
          validDocuments.slice(i * RERANK_BATCH_SIZE, (i + 1) * RERANK_BATCH_SIZE)
        )
      : [validDocuments];

    // 全ての結果を一時的に保持
    let tempResults: XSearchResultMessage[] = [];
    
    // バッチ処理
    for (const batch of batches) {
      const documents = batch.map((r: XSearchResultMessage & { XSearchResult: Pick<XSearchResult, 'id' | 'content'> }) => 
        r.XSearchResult.content
      );
      
      // Cohereのrerank APIを呼び出し
      const response = await fetch('https://api.cohere.ai/v1/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'rerank-multilingual-v3.0',
          query: session.query,
          documents,
          top_n: documents.length,
          return_documents: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Rerank API error: ${response.statusText}`);
      }

      const rerankResults = await response.json();
      
      // バッチ内の各結果のスコアを更新
      const batchResults = rerankResults.results
        .map((result: any, index: number) => {
          if (!batch[index]) return null;
          
          const finalScore = calculateFinalScore(
            result.relevance_score,
            batch[index].embeddingScore
          );
          
          return {
            id: batch[index].id,
            resultId: batch[index].resultId,
            sessionId: session.id,
            messageId: session.messageId,
            embeddingScore: batch[index].embeddingScore,
            rerankScore: result.relevance_score,
            finalScore: finalScore,
            updatedAt: new Date().toISOString()
          };
        })
        .filter((update: XSearchResultMessage | null): update is XSearchResultMessage => update !== null);

      tempResults = [...tempResults, ...batchResults];
      
      // APIレート制限を考慮して待機
      if (batches.length > 1) {
        await sleep(1000);
      }
    }

    // 結果をデータベースに保存
    if (tempResults.length > 0) {
      const { error: updateError } = await supabase
        .from('XSearchResultMessage')
        .upsert(tempResults);

      if (updateError) {
        throw new Error(`結果の更新に失敗: ${updateError.message}`);
      }
    }

    // セッションの進捗を更新
    const { error: sessionUpdateError } = await supabase
      .from('XSearchSession')
      .update({
        progress: 100,  // rerank完了
        status: 'completed',
        updatedAt: new Date().toISOString()
      })
      .eq('id', session.id);

    if (sessionUpdateError) {
      console.error('セッション更新エラー:', sessionUpdateError);
    }

  } catch (error) {
    console.error('Rerank処理エラー:', error);
    throw error;
  }
}

export async function generateCozeResponse(
  prompt: string,
  options: any,
): Promise<string> {
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await fetch('https://api.coze.com/v1/workflow/stream_run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_COZE_API_KEY}`,
      },
      body: JSON.stringify({
        workflow_id: '7462445424055746578',
        inputs: {
          prompt,
          ...options,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await parseStreamContent(await response.text());
    return result.content || '';
  } catch (error) {
    console.error('Error generating Coze response:', error);
    throw error;
  }
}
