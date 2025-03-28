'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, LockIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { use } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// 動画データの型定義
interface VideoData {
  id: string;
  title: string;
  description: string;
  videoUrl: string | null;
  tags: string[];
  transcript: string | null;
}

// 動画詳細ページのコンポーネント
export default function VideoDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  // paramsをReact.use()でラップして正しく取得
  const unwrappedParams = params instanceof Promise ? use(params) : params;
  const videoId = unwrappedParams.id;
  
  const router = useRouter();
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // 認証状態を管理

  useEffect(() => {
    // 認証状態を確認する
    const checkAuthStatus = async () => {
      try {
        // 認証状態を確認するAPIを呼び出す
        const authResponse = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          setIsAuthenticated(!!authData.user);
          console.log('認証状態:', !!authData.user ? '認証済み' : '未認証');
        } else {
          setIsAuthenticated(false);
          console.log('認証状態の確認に失敗しました。未認証として処理します。');
        }
      } catch (error) {
        console.error('認証状態確認エラー:', error);
        setIsAuthenticated(false); // エラー時は未認証として処理
      }
    };
    
    // APIから動画データを取得する
    const fetchVideoData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // まず認証状態を確認
        await checkAuthStatus();
        
        // APIから動画データを取得
        const response = await fetch(`/api/video/${videoId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`動画データの取得に失敗しました: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('取得した動画データ:', data);
        
        // APIから取得したデータを設定
        if (data.video) {
          console.log('取得した動画データの詳細:', JSON.stringify(data.video, null, 2));
          console.log('動画ファイルURL:', data.video.fileUrl);
          
          // fileUrlが存在するか確認
          if (!data.video.fileUrl) {
            console.error('動画ファイルのURLが見つかりません');
          }
          
          // デバッグ用に動画URLをログ出力
          console.log('元の動画URL:', data.video.fileUrl);
          
          // 正しいバケットパスで動画を読み込むように修正したので、元のコードを使用
          setVideoData({
            id: data.video.id,
            title: data.video.title || 'タイトルなし',
            description: data.video.description || '',
            videoUrl: data.video.fileUrl, // 元の動画ファイルのURLを使用
            tags: data.video.tags ? data.video.tags.split(',').map((tag: string) => tag.trim()) : [],
            transcript: data.video.transcript || getTranscriptForVideo(data.video) // APIから取得した文字起こしを使用
          });
          
          // テスト用のコード（必要に応じて使用）
          // const testVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          // console.log('テスト用動画URLを使用します:', testVideoUrl);
          // setVideoData({
          //   id: data.video.id,
          //   title: data.video.title || 'タイトルなし',
          //   description: data.video.description || '',
          //   videoUrl: testVideoUrl, // テスト用の動画URLを使用
          //   tags: data.video.tags ? data.video.tags.split(',').map((tag: string) => tag.trim()) : [],
          //   transcript: data.video.transcript || getTranscriptForVideo(data.video)
          // });
        } else {
          throw new Error('動画データが見つかりませんでした');
        }
      } catch (error) {
        console.error("動画データの取得に失敗しました", error);
        setError(error instanceof Error ? error.message : '動画データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [videoId]);

  // 戻るボタンのハンドラー
  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-10 px-4">
        <button 
          onClick={handleBack}
          className="mb-6 flex items-center text-sm text-blue-500 hover:text-blue-700"
        >
          <ArrowLeftIcon size={16} className="mr-1" />
          一覧に戻る
        </button>
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!videoData) {
    return (
      <div className="container mx-auto py-10 px-4">
        <button 
          onClick={handleBack}
          className="mb-6 flex items-center text-sm text-blue-500 hover:text-blue-700"
        >
          <ArrowLeftIcon size={16} className="mr-1" />
          一覧に戻る
        </button>
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">動画データが見つかりません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <button 
        onClick={handleBack}
        className="mb-8 flex items-center text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-full transition-all duration-200"
      >
        <ArrowLeftIcon size={16} className="mr-2" />
        一覧に戻る
      </button>

      <h1 className="text-3xl font-bold mb-6 text-center max-w-4xl mx-auto">{videoData.title}</h1>
      
      {/* 動画埋め込み */}
      <div className="w-full max-w-4xl mx-auto mb-10">
        <div className="aspect-video w-full overflow-hidden rounded-xl shadow-lg bg-gray-50 dark:bg-gray-800">
          {videoData.videoUrl ? (
            isAuthenticated === false ? (
              // 未認証ユーザー向けの表示
              <div className="flex flex-col justify-center items-center h-full p-8">
                <div className="flex items-center mb-5">
                  <LockIcon className="w-10 h-10 text-gray-400 mr-3" />
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">認証が必要です</h3>
                </div>
                <p className="text-center mb-6 text-gray-600 dark:text-gray-400">この動画を視聴するにはログインが必要です。</p>
                <Link href="/login" passHref>
                  <Button className="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-full px-6 py-2 transition-all duration-200">
                    ログインする
                  </Button>
                </Link>
              </div>
            ) : (
              // 認証済みユーザー向けの動画表示
              <div className="w-full h-full">
                {videoData.videoUrl && (videoData.videoUrl.includes('youtube.com') || videoData.videoUrl.includes('youtu.be') || videoData.videoUrl.includes('watch?v=')) ? (
                  // YouTube動画の埋め込み
                  <div className="relative w-full h-0 pb-[56.25%]">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${extractYoutubeId(videoData.videoUrl)}`}
                      title={videoData.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  // 通常の動画ファイルの場合
                  <video
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                    onError={(e) => console.error('動画読み込みエラー:', e)}
                  >
                    <source src={videoData.videoUrl} type="video/mp4" />
                    お使いのブラウザは動画再生をサポートしていません。
                  </video>
                )}
              </div>
            )
          ) : (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-500">動画が利用できません</p>
            </div>
          )}
        </div>
        {/* デバッグ情報（開発時のみ表示） */}
        {process.env.NODE_ENV === 'development' && videoData.videoUrl && isAuthenticated && (
          <div className="mt-2 text-xs text-gray-400 px-2">
            <p>動画URL: {videoData.videoUrl || 'URLなし'}</p>
            <p>YouTube ID: {extractYoutubeId(videoData.videoUrl) || 'IDなし'}</p>
            <p>認証状態: {isAuthenticated ? '認証済み' : '未認証'}</p>
          </div>
        )}
      </div>

      {/* 説明 */}
      <div className="mb-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">説明</h2>
        <Card className="border border-gray-100 dark:border-gray-800 shadow-md rounded-xl overflow-hidden">
          <CardContent className="pt-6 px-6">
            <div className="prose dark:prose-invert max-w-none">
              <p className="mb-4 text-gray-700 dark:text-gray-300">{videoData.description || '説明はありません'}</p>
              
              {/* タグ表示 */}
              {videoData.tags && videoData.tags.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">タグ</h3>
                  <div className="flex flex-wrap gap-2">
                    {videoData.tags.map((tag: string, index: number) => (
                      <span 
                        key={index} 
                        className="inline-block bg-gray-100 dark:bg-gray-800 text-xs px-3 py-1 rounded-full text-gray-600 dark:text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 文字起こし（あれば表示） */}
              {videoData.transcript && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-2">文字起こし</h3>
                  {videoData.transcript.split('\n\n').map((paragraph: string, index: number) => (
                    <p key={index} className="mb-4">{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 動画IDからタイトルを取得するためのマップ
// 削除：videoTitlesは不要（APIから取得するため）

// 動画IDから文字起こしを取得する関数（APIから取得できない場合のフォールバック）
function getTranscriptForVideo(videoData: any): string | null {
  // APIから取得したデータに文字起こしがある場合はそれを使用
  if (videoData && videoData.transcript) {
    return videoData.transcript;
  }
  
  // 文字起こしがない場合はnullを返す
  return null;
}

// YouTube URLからビデオIDを抽出する関数
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  
  // Supabaseに保存されたYouTubeリンクの場合の処理
  if (url.includes('/videos/watch?v=')) {
    const parts = url.split('watch?v=');
    if (parts.length > 1) {
      return parts[1].split('&')[0]; // 追加パラメータがあれば除去
    }
  }
  
  // 通常のYouTube URLの形式をチェック
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[7]?.length === 11) ? match[7] : null;
}
