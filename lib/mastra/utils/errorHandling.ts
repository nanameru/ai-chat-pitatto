/**
 * エラーハンドリングユーティリティ
 * 
 * JSON解析失敗、エラー報告、指数バックオフなどの機能を提供します。
 */

import * as Sentry from '@sentry/node';

/**
 * JSON解析失敗を処理する関数
 * 
 * @param error パース時に発生したエラー
 * @param rawText 解析しようとしたテキスト
 * @param context 追加コンテキスト情報
 * @returns {isFallback: true} を含むオブジェクト
 */
export function handleJsonParseFailure(error: unknown, rawText: string, context: Record<string, unknown> = {}) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // ログ出力
  console.error(`JSON解析エラー: ${errorMessage}`);
  
  // Sentryにエラーを報告
  reportError('json_parse_failure', error, {
    rawText: rawText.substring(0, 500), // 長すぎるテキストは切り詰める
    ...context
  });
  
  // isFallbackフラグを含むオブジェクトを返す
  return {
    isFallback: true,
    error: errorMessage,
    timestamp: new Date().toISOString()
  };
}

/**
 * エラーをSentryに報告する関数
 * 
 * @param errorType エラータイプ
 * @param error 元のエラーオブジェクト
 * @param extraContext 追加コンテキスト
 */
export function reportError(errorType: string, error: unknown, extraContext: Record<string, unknown> = {}) {
  try {
    // 環境変数で無効化できるようにする（開発中やテスト時）
    if (process.env.DISABLE_ERROR_REPORTING === 'true') {
      return;
    }
    
    // エラーオブジェクトの構築
    const sentryError = error instanceof Error 
      ? error 
      : new Error(typeof error === 'string' ? error : 'Unknown error');
    
    // タグとコンテキストの設定
    Sentry.configureScope(scope => {
      scope.setTag('error_type', errorType);
      scope.setContext('extra_context', extraContext);
    });
    
    // Sentryに送信
    Sentry.captureException(sentryError);
  } catch (reportingError) {
    // エラー報告自体が失敗した場合も、アプリケーションを落とさない
    console.error('エラー報告に失敗:', reportingError);
  }
}

/**
 * 指数バックオフ付きの再試行関数
 * 
 * @param fn 実行する非同期関数
 * @param options 再試行オプション
 * @returns 関数の実行結果
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    retryableErrors?: Array<string | RegExp>;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffFactor = 2,
    retryableErrors = []
  } = options;
  
  let lastError: Error | null = null;
  let delay = initialDelayMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 最後の試行で失敗した場合はエラーをスロー
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // 特定のエラーのみリトライするロジック
      if (retryableErrors.length > 0) {
        const errorMessage = lastError.message;
        const shouldRetry = retryableErrors.some(pattern => {
          if (typeof pattern === 'string') {
            return errorMessage.includes(pattern);
          }
          return pattern.test(errorMessage);
        });
        
        if (!shouldRetry) {
          throw lastError;
        }
      }
      
      // 待機
      console.log(`試行 ${attempt + 1}/${maxRetries} が失敗しました。${delay}ms後に再試行します。エラー: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 次回の遅延を計算（指数バックオフ）
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }
  
  // コードはここに到達しないはずですが、TypeScriptを満足させるため
  throw lastError;
}

/**
 * AIモデル呼び出しのための指数バックオフ付き再試行関数
 * 
 * AI特有のエラーパターンに対応しています。
 * 
 * @param fn 実行する非同期関数
 * @param options 再試行オプション
 * @returns 関数の実行結果
 */
export async function withAIModelBackoff<T>(fn: () => Promise<T>, options = {}): Promise<T> {
  // AI特有のリトライ可能なエラーパターン
  const retryableAIErrors = [
    'rate limit',
    'timeout',
    'server error', 
    'overloaded',
    'capacity',
    'retry',
    /5\d\d error/i,
    /too many requests/i
  ];
  
  return withExponentialBackoff(fn, {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffFactor: 2,
    retryableErrors: retryableAIErrors,
    ...options
  });
}

/**
 * Sentry初期化関数
 * 
 * アプリケーション起動時に一度だけ呼び出してください。
 */
export function initErrorReporting() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,
    });
    console.log('Sentryエラー報告を初期化しました');
  } else {
    console.log('SENTRY_DSNが設定されていないため、エラー報告は無効です');
  }
} 