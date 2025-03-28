'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLinkIcon, GithubIcon, PlayIcon, EyeIcon, BookOpenIcon, PlusCircleIcon, Trash2Icon, EditIcon } from 'lucide-react';

// コンテンツの型定義
interface Content {
  type: 'oss' | 'video';
  id: string; // 全てのコンテンツに必要なID
  title: string;
  description: string;
  url: string;
  fileUrl?: string; // 動画ファイルのURL
  demoUrl?: string;
  previewUrl?: string;
  githubUrl?: string;
  tags: string[];
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

export default function OSSApplicationsPage() {
  // タブの状態管理
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // GitHub登録モーダルの状態
  const [showGithubModal, setShowGithubModal] = useState(false);
  // 動画登録モーダルの状態
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  // ユーザー情報の状態
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 削除確認モーダルの状態
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 編集モーダルの状態
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Content | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // GitHubフォームの状態
  const [githubForm, setGithubForm] = useState({
    title: '',
    description: '',
    url: '',
    githubUrl: '',
    tags: ''
  });
  
  // 動画フォームの状態
  const [videoForm, setVideoForm] = useState({
    title: '',
    description: '',
    tags: '',
    youtubeUrl: '' // YouTubeリンクを保存するフィールド
  });

  
  // GitHub登録フォームの送信処理
  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('GitHub登録:', githubForm);
    
    try {
      // APIへの送信処理
      const response = await fetch('/api/github-repository', {
        method: 'POST',
        credentials: 'include', // Cookieを送信して認証情報を含める
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(githubForm),
      });
      
      console.log('GitHub登録レスポンスステータス:', response.status);
      
      if (!response.ok) {
        let errorMessage = '登録に失敗しました';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // JSONパースエラーの場合はテキストを取得
          const errorText = await response.text().catch(() => '');
          console.log('エラーレスポンステキスト:', errorText);
          if (errorText) errorMessage = errorText;
        }
        
        // ステータスコードに応じたメッセージ
        if (response.status === 401) {
          errorMessage = '認証が必要です。ログインしてください。';
        } else if (response.status === 403) {
          errorMessage = 'この操作には管理者権限が必要です。';
        }
        
        throw new Error(errorMessage);
      }
      
      // フォームをリセット
      setGithubForm({
        title: '',
        description: '',
        url: '',
        githubUrl: '',
        tags: ''
      });
      
      // モーダルを閉じる
      setShowGithubModal(false);
      
      // 成功メッセージを表示
      alert('GitHubリポジトリが登録されました！');
    } catch (error) {
      console.error('GitHub登録エラー:', error);
      alert(`エラー: ${error instanceof Error ? error.message : '登録に失敗しました'}`);
    }
  };
  
  // 動画登録フォームの送信処理
  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('動画登録:', videoForm);
    
    try {
      // YouTubeリンクが入力されているか確認
      if (!videoForm.youtubeUrl) {
        alert('YouTubeリンクを入力してください');
        return;
      }
      
      // YouTubeリンクの形式を検証（簡易的な検証）
      if (!videoForm.youtubeUrl.includes('youtube.com') && !videoForm.youtubeUrl.includes('youtu.be')) {
        alert('有効なYouTubeリンクを入力してください');
        return;
      }
      
      // APIエンドポイントを呼び出す
      const response = await fetch('/api/video', {
        method: 'POST',
        credentials: 'include', // Cookieを送信して認証情報を含める
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: videoForm.title,
          description: videoForm.description,
          tags: videoForm.tags,
          youtubeUrl: videoForm.youtubeUrl
        })
      });
      
      console.log('動画登録レスポンスステータス:', response.status);
      
      if (!response.ok) {
        let errorMessage = '動画の登録に失敗しました';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // JSONパースエラーの場合はテキストを取得
          const errorText = await response.text().catch(() => '');
          console.log('エラーレスポンステキスト:', errorText);
          if (errorText) errorMessage = errorText;
        }
        
        // ステータスコードに応じたメッセージ
        if (response.status === 401) {
          errorMessage = '認証が必要です。ログインしてください。';
        } else if (response.status === 403) {
          errorMessage = 'この操作には管理者権限が必要です。';
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('登録結果:', data);
      
      // フォームをリセット
      setVideoForm({
        title: '',
        description: '',
        tags: '',
        youtubeUrl: ''
      });
      setShowVideoModal(false);
      
      // 成功メッセージを表示
      alert('YouTube動画が登録されました！');
    } catch (error) {
      console.error('動画登録エラー:', error);
      alert(`エラー: ${error instanceof Error ? error.message : '動画の登録に失敗しました'}`);
    }
  };
  
  // GitHubフォームの入力変更処理
  const handleGithubChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGithubForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 動画フォームの入力変更処理
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVideoForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // YouTubeリンク入力処理
  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setVideoForm(prev => ({
      ...prev,
      youtubeUrl: value
    }));
  };

  // コンテンツデータの状態管理
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 削除処理関数
  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      setIsDeleting(true);
      const { id, type } = itemToDelete;
      
      // 削除APIのエンドポイントを決定
      const endpoint = type === 'oss' 
        ? `/api/github-repository/${id}` 
        : `/api/video/${id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '削除に失敗しました');
      }
      
      // 削除成功後、リストを更新
      setContents(prevContents => 
        prevContents.filter(item => !(item.id === id && item.type === type))
      );
      
      // モーダルを閉じる
      setShowDeleteConfirmModal(false);
      setItemToDelete(null);
    } catch (err: any) {
      console.error('削除エラー:', err);
      alert(`削除中にエラーが発生しました: ${err.message || '不明なエラー'}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 編集モーダルを開く
  const openEditModal = (content: Content) => {
    setItemToEdit(content);
    
    // コンテンツタイプに応じてフォームを初期化
    if (content.type === 'oss') {
      setGithubForm({
        title: content.title,
        description: content.description,
        url: content.url,
        githubUrl: content.githubUrl || '',
        tags: content.tags.join(', ')
      });
    } else {
      setVideoForm({
        title: content.title,
        description: content.description,
        tags: content.tags.join(', '),
        youtubeUrl: content.fileUrl || ''
      });
    }
    
    setShowEditModal(true);
  };
  
  // 編集処理
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit) return;
    
    setIsEditing(true);
    
    try {
      const isOss = itemToEdit.type === 'oss';
      const endpoint = isOss 
        ? `/api/github-repository/${itemToEdit.id}/update`
        : `/api/video/${itemToEdit.id}`;
      
      let requestBody;
      
      if (isOss) {
        // GitHubリポジトリの編集
        requestBody = {
          title: githubForm.title,
          description: githubForm.description,
          url: githubForm.url,
          githubUrl: githubForm.githubUrl,
          tags: githubForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        };
      } else {
        // 動画の編集
        requestBody = {
          title: videoForm.title,
          description: videoForm.description,
          tags: videoForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          youtubeUrl: videoForm.youtubeUrl
        };
      }
      
      // リクエストボディのサイズを確認
      const requestBodyString = JSON.stringify(requestBody);
      console.log(`リクエストボディサイズ: ${requestBodyString.length} bytes`);
      
      // リクエストボディが大きすぎる場合の処理
      if (requestBodyString.length > 100000) { // 100KB以上の場合は警告
        console.warn('リクエストボディが大きすぎます');
        // YouTube URLが長すぎる場合は短縮する
        if (!isOss && requestBody.youtubeUrl && requestBody.youtubeUrl.length > 500) {
          // URLが長すぎる場合は短縮する
          const youtubeId = extractYoutubeId(requestBody.youtubeUrl);
          if (youtubeId) {
            requestBody.youtubeUrl = `https://youtu.be/${youtubeId}`;
            console.log('短縮後のYouTube URL:', requestBody.youtubeUrl);
          }
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.log(`レスポンスステータス: ${response.status}`);
        const responseText = await response.text();
        console.log(`レスポンステキスト:`, responseText);
        
        let errorMessage = `編集に失敗しました (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('レスポンスのJSON解析エラー:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('編集結果:', data);
      
      // レスポンスデータのチェック
      if (isOss && data.repository) {
        console.log('更新されたGitHubリポジトリ:', data.repository);
        // リストを更新
        setContents(prev => prev.map(item => {
          if (item.id === itemToEdit.id) {
            return { ...data.repository, type: 'oss' };
          }
          return item;
        }));
      } else if (!isOss && data.video) {
        console.log('更新された動画:', data.video);
        // リストを更新
        setContents(prev => prev.map(item => {
          if (item.id === itemToEdit.id) {
            return { ...data.video, type: 'video' };
          }
          return item;
        }));
      } else {
        console.error('レスポンスに期待されるデータがありません:', data);
      }
      
      // モーダルを閉じる
      setShowEditModal(false);
      setItemToEdit(null);
      
      // 成功メッセージ
      alert(`${isOss ? 'GitHubリポジトリ' : '動画'}が編集されました！`);
      
    } catch (error) {
      console.error('編集エラー:', error);
      alert(`エラー: ${error instanceof Error ? error.message : '編集に失敗しました'}`);
    } finally {
      setIsEditing(false);
    }
  };
  
  // データの取得
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // GitHubリポジトリの取得
      let repositories: any[] = [];
      try {
        // credentials: 'include'を追加してCookieを送信
        const repoResponse = await fetch('/api/github-repository', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('GitHubリポジトリレスポンスステータス:', repoResponse.status);
        
        if (repoResponse.ok) {
          const repoData = await repoResponse.json();
          console.log('GitHubリポジトリデータ:', repoData);
          repositories = repoData.repositories || [];
        } else if (repoResponse.status === 401) {
          // 認証エラーの場合はログインが必要
          console.log('認証が必要です。ログインしてください。');
          throw new Error('認証が必要です。ログインしてください。');
        } else {
          console.log(`GitHubリポジトリ取得エラー: ${repoResponse.status}`);
          const errorText = await repoResponse.text();
          console.log('エラーレスポンス:', errorText);
        }
      } catch (repoError) {
        console.error('GitHubリポジトリの取得中にエラー:', repoError);
        // リポジトリの取得に失敗しても、動画の取得は続行する
        if (repoError instanceof Error && repoError.message.includes('認証')) {
          throw repoError; // 認証エラーは再スローして処理を中断
        }
      }
      
      // 動画の取得
      let videos: any[] = [];
      try {
        // credentials: 'include'を追加してCookieを送信
        const videoResponse = await fetch('/api/video', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('動画レスポンスステータス:', videoResponse.status);
        
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          console.log('動画データ:', videoData);
          videos = videoData.videos || [];
        } else if (videoResponse.status === 401) {
          // 認証エラーの場合はログインが必要
          console.log('認証が必要です。ログインしてください。');
          throw new Error('認証が必要です。ログインしてください。');
        } else {
          console.log(`動画取得エラー: ${videoResponse.status}`);
          const errorText = await videoResponse.text();
          console.log('エラーレスポンス:', errorText);
        }
      } catch (videoError) {
        console.error('動画の取得中にエラー:', videoError);
        // 動画の取得に失敗しても処理を続行
        if (videoError instanceof Error && videoError.message.includes('認証')) {
          throw videoError; // 認証エラーは再スローして処理を中断
        }
      }
      
      // データの変換と結合
      const contentsList: Content[] = [];
      
      // リポジトリデータの処理
      repositories.forEach((repo: any) => {
        contentsList.push({
          type: 'oss',
          id: repo.id || '', // IDフィールドを追加
          title: repo.title || '無題',
          description: repo.description || '',
          url: repo.url || '#',
          githubUrl: repo.githubUrl || '#',
          tags: repo.tags ? repo.tags.split(',').map((tag: string) => tag.trim()) : []
        });
      });
      
      // 動画データの処理
      videos.forEach((video: any) => {
        contentsList.push({
          type: 'video',
          id: video.id || '',
          title: video.title || '無題',
          description: video.description || '',
          url: '#', // ダミーURLを設定
          fileUrl: video.fileUrl || '#', // fileUrlプロパティを正しく設定
          tags: video.tags ? video.tags.split(',').map((tag: string) => tag.trim()) : []
        });
      });
      
      setContents(contentsList);
      
      // データが取得できなかった場合のメッセージ
      if (contentsList.length === 0) {
        setError('表示できるコンテンツがありません。管理者権限でログインして、コンテンツを追加してください。');
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError(`データの取得中にエラーが発生しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ユーザー情報を取得する関数
  const fetchUserInfo = async () => {
    try {
      // デバッグ用：現在のCookieを表示
      console.log('現在のCookie:', document.cookie);
      
      // セッションチェックを行うためのリクエスト
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // 重要: クッキーを含める
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // キャッシュを無効化
      });
      
      console.log('ユーザー情報取得ステータス:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('ユーザー情報（詳細）:', JSON.stringify(userData, null, 2));
        
        // ユーザーテーブルの内容を確認
        console.log('ユーザーID:', userData.user?.id);
        console.log('ユーザーロール:', userData.user?.role);
        
        // ユーザーがadmin権限を持っているか確認
        const isAdminUser = userData.user?.role === 'admin';
        console.log('管理者権限確認:', isAdminUser ? 'あり' : 'なし', '実際の値:', userData.user?.role);
        
        // 強制的に管理者権限を有効にする（デバッグ用）
        // const isAdminUser = true;
        
        setIsAdmin(isAdminUser);
        console.log('管理者権限を設定しました:', isAdminUser);
      } else {
        // エラーメッセージをログに出力
        const errorText = await response.text().catch(() => '');
        console.log('ユーザー情報の取得に失敗しました:', response.status, errorText);
        
        // 401エラーの場合は非認証状態
        if (response.status === 401) {
          console.log('非認証状態です。ログインが必要です。');
          // 非認証の場合は管理者権限はない
          setIsAdmin(false);
        } else if (response.status === 500) {
          // 500エラーの場合は、サーバーエラーであり、ユーザーが管理者かどうか判断できない
          // 一時的な回避策として、特定のメールアドレスを管理者として扱う
          
          // ローカルストレージからユーザー情報を取得する試み
          let userEmail = '';
          try {
            const supabaseSession = localStorage.getItem('supabase.auth.token');
            if (supabaseSession) {
              const sessionData = JSON.parse(supabaseSession);
              userEmail = sessionData?.currentSession?.user?.email || '';
              console.log('ローカルストレージから取得したメールアドレス:', userEmail);
            }
          } catch (e) {
            console.error('ローカルストレージからのユーザー情報取得エラー:', e);
          }
          
          const isKnownAdminEmail = userEmail === '4869nanataitai@gmail.com';
          console.log('管理者メールアドレスチェック:', isKnownAdminEmail);
          
          if (isKnownAdminEmail) {
            setIsAdmin(true);
            console.log('メールアドレスに基づいて管理者権限を有効化しました（一時的回避策）');
          } else {
            setIsAdmin(false);
          }
        } else {
          // その他のエラーの場合は管理者権限はないと判断
          setIsAdmin(false);
        }
      }
    } catch (error) {
      console.error('ユーザー情報の取得中にエラー:', error);
      // エラーが発生した場合も管理者権限はないと判断
      setIsAdmin(false);
      
      // デバッグ用：強制的に管理者権限を有効にする（テスト用）
      // setIsAdmin(true);
      // console.log('管理者権限を強制的に有効化しました（テスト用）');
    }
  };

  // コンポーネントマウント時にデータとユーザー情報を取得
  useEffect(() => {
    // データ取得とユーザー情報取得を個別に実行
    // 片方が失敗してももう片方は実行されるようにする
    fetchData().catch(err => {
      console.error('データ取得エラー:', err);
    });
    
    fetchUserInfo().catch(err => {
      console.error('ユーザー情報取得エラー:', err);
      // ユーザー情報取得に失敗しても管理者権限はないと判断
      setIsAdmin(false);
    });
    
    // デバッグ用：当初の管理者権限状態を確認
    console.log('コンポーネントマウント時の管理者権限状態:', isAdmin);
  }, []);
  
  // isAdmin状態が変わったときにログを出力
  useEffect(() => {
    console.log('管理者権限状態が変更されました:', isAdmin);
  }, [isAdmin]);
  
  // ローディング状態の表示
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">OSSアプリケーション</h1>
        <p>データを読み込み中...</p>
      </div>
    );
  }

  // エラー状態の表示
  if (error) {
    // エラーが認証関連の場合はログインを促すメッセージを表示
    const isAuthError = error.includes('認証') || error.includes('ログイン');
    
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">OSSアプリケーション</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-600">{error}</p>
          {isAuthError && (
            <p className="mt-2">
              <a href="/login" className="text-blue-600 hover:underline">ログインページへ移動する</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  // フィルタリングされたコンテンツ
  const filteredContents = contents.filter(content => {
    if (activeTab === 'all') return true;
    if (activeTab === 'oss') return content.type === 'oss';
    if (activeTab === 'video') return content.type === 'video';
    return true;
  });

  return (
    <div className="container mx-auto py-12 px-4 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300" data-component-name="OSSApplicationsPage">AIで遊ぼう</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">最新のオープンソースAIツールとハンズオン動画で、AIの可能性を探求しましょう</p>
      </div>
      
      {/* 登録ボタン - 管理者の場合のみ表示 */}
      {isAdmin && (
        <div className="flex justify-center gap-4 mb-10">
          <button
            onClick={() => setShowGithubModal(true)}
            className="bg-gray-800 hover:bg-gray-700 text-white flex items-center gap-2 px-6 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
          >
            <GithubIcon size={16} />
            GitHubリポジトリを登録
          </button>
          
          <button
            onClick={() => setShowVideoModal(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-2 px-6 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
          >
            <PlayIcon size={16} />
            動画を登録
          </button>
        </div>
      )}
      {!isAdmin && (
        <div className="mb-8"></div>
      )}
      
      {/* GitHubリポジトリ登録モーダル */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowGithubModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <h2 className="text-xl font-semibold mb-4">GitHubリポジトリを登録</h2>
            
            <form onSubmit={handleGithubSubmit} className="space-y-4">
              <div>
                <label htmlFor="github-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                <input
                  id="github-title"
                  name="title"
                  type="text"
                  value={githubForm.title}
                  onChange={handleGithubChange}
                  placeholder="リポジトリ名"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="github-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
                <textarea
                  id="github-description"
                  name="description"
                  value={githubForm.description}
                  onChange={handleGithubChange}
                  placeholder="リポジトリの説明"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  required
                ></textarea>
              </div>
              
              <div>
                <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公式URL</label>
                <input
                  id="github-url"
                  name="url"
                  type="url"
                  value={githubForm.url}
                  onChange={handleGithubChange}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="github-repo-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub URL</label>
                <input
                  id="github-repo-url"
                  name="githubUrl"
                  type="url"
                  value={githubForm.githubUrl}
                  onChange={handleGithubChange}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="github-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タグ（カンマ区切り）</label>
                <input
                  id="github-tags"
                  name="tags"
                  type="text"
                  value={githubForm.tags}
                  onChange={handleGithubChange}
                  placeholder="AI, 機械学習, ツール"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                登録する
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* 動画登録モーダル */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <h2 className="text-xl font-semibold mb-4">動画を登録</h2>
            
            <form onSubmit={handleVideoSubmit} className="space-y-4">
              <div>
                <label htmlFor="video-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                <input
                  id="video-title"
                  name="title"
                  type="text"
                  value={videoForm.title}
                  onChange={handleVideoChange}
                  placeholder="動画のタイトル"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="video-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
                <textarea
                  id="video-description"
                  name="description"
                  value={videoForm.description}
                  onChange={handleVideoChange}
                  placeholder="動画の説明"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  required
                ></textarea>
              </div>
              

              
              <div>
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTubeリンク（必須）</label>
                <input
                  id="youtube-url"
                  name="youtubeUrl"
                  type="url"
                  value={videoForm.youtubeUrl}
                  onChange={handleVideoChange}
                  placeholder="https://www.youtube.com/watch?v=xxxx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">YouTubeの動画URLを入力してください</p>
              </div>
              
              <div>
                <label htmlFor="video-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タグ（カンマ区切り）</label>
                <input
                  id="video-tags"
                  name="tags"
                  type="text"
                  value={videoForm.tags}
                  onChange={handleVideoChange}
                  placeholder="AI, チュートリアル, ハンズオン"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                登録する
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* フィルターボタン */}
      <div className="flex justify-center mb-10">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-full shadow-md">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2 rounded-full transition-all duration-200 ${activeTab === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}
          >
            すべて
          </button>
          <button
            onClick={() => setActiveTab('oss')}
            className={`px-6 py-2 rounded-full transition-all duration-200 ${activeTab === 'oss' ? 'bg-white dark:bg-gray-700 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}
          >
            <span className="flex items-center gap-1.5">
              <GithubIcon size={16} />
              OSS
            </span>
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-6 py-2 rounded-full transition-all duration-200 ${activeTab === 'video' ? 'bg-white dark:bg-gray-700 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}
          >
            <span className="flex items-center gap-1.5">
              <PlayIcon size={16} />
              動画
            </span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredContents.length > 0 ? (
          filteredContents.map((content, index) => (
          <Card key={index} className={`border border-gray-100 dark:border-gray-800 bg-white dark:bg-black hover:shadow-xl transition-all duration-300 rounded-xl group ${content.type === 'video' ? 'cursor-pointer' : ''}`}>
            {content.type === 'video' && content.id ? (
              <Link href={`/oss-applications/${content.id}`} className="block">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{content.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {content.tags.map((tag, tagIndex) => (
                      <span 
                        key={tagIndex} 
                        className="inline-block bg-gray-100 dark:bg-gray-800 text-xs px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[150px] overflow-y-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{content.description}</p>
                  </div>
                </CardContent>
              </Link>
            ) : (
              <>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{content.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {content.tags.map((tag, tagIndex) => (
                      <span 
                        key={tagIndex} 
                        className="inline-block bg-gray-100 dark:bg-gray-800 text-xs px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[150px] overflow-y-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{content.description}</p>
                  </div>
                </CardContent>
              </>
            )}
            
            <CardContent className="px-5 pb-5">
              <div className="flex flex-wrap gap-3 mt-auto">
                {/* 動画の場合は動画詳細ページへのリンクを追加 */}
                {content.type === 'video' && content.id ? (
                  <Link 
                    href={`/oss-applications/${content.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-full transition-all duration-200"
                  >
                    <PlayIcon size={14} />
                    動画を見る
                  </Link>
                ) : null}
                
                {/* 動画以外のコンテンツの場合のみ外部リンクを表示 */}
                {content.type !== 'video' && (
                  <a 
                    href={content.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 px-4 py-2 rounded-full transition-all duration-200"
                  >
                    <ExternalLinkIcon size={12} />
                    公式
                  </a>
                )}
                
                {/* 管理者の場合で、かつコンテンツにIDがある場合に編集・削除ボタンを表示 */}
                {isAdmin && content.id && (
                  <>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(content);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 px-4 py-2 rounded-full transition-all duration-200"
                    >
                      <EditIcon size={12} />
                      編集
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setItemToDelete({ id: content.id, type: content.type });
                        setShowDeleteConfirmModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/50 dark:hover:bg-red-900 px-4 py-2 rounded-full transition-all duration-200"
                    >
                      <Trash2Icon size={12} />
                      削除
                    </button>
                  </>
                )}
                
                {content.demoUrl && (
                  <a 
                    href={content.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <PlayIcon size={12} />
                    デモ
                  </a>
                )}
                
                {content.previewUrl && (
                  <a 
                    href={content.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <EyeIcon size={12} />
                    プレビュー
                  </a>
                )}
                
                {content.githubUrl && (
                  <a 
                    href={content.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <GithubIcon size={12} />
                    GitHub
                  </a>
                )}
                
                {content.type === 'video' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                    <BookOpenIcon size={12} />
                    ハンズオン
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-full p-6 mb-4">
              <BookOpenIcon className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">表示するコンテンツがありません</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">管理者権限でログインして、コンテンツを追加してください</p>
          </div>
        )}
      </div>
      
      {/* 削除確認モーダル */}
      {showDeleteConfirmModal && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
            <h2 className="text-xl font-semibold mb-4">削除の確認</h2>
            <p className="mb-6">
              {itemToDelete.type === 'oss' ? 'GitHubリポジトリ' : '動画'}
              を削除してもよろしいですか？この操作は元に戻せません。
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isDeleting}
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                disabled={isDeleting}
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 編集モーダル */}
      {showEditModal && itemToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-semibold mb-4">
              {itemToEdit.type === 'oss' ? 'GitHubリポジトリ' : '動画'}の編集
            </h2>
            
            {itemToEdit.type === 'oss' ? (
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-github-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">リポジトリ名</label>
                    <input
                      id="edit-github-title"
                      name="title"
                      type="text"
                      value={githubForm.title}
                      onChange={handleGithubChange}
                      placeholder="リポジトリ名"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-github-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
                    <textarea
                      id="edit-github-description"
                      name="description"
                      value={githubForm.description}
                      onChange={handleGithubChange}
                      placeholder="リポジトリの説明"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    ></textarea>
                  </div>
                  
                  <div>
                    <label htmlFor="edit-github-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">公式URL</label>
                    <input
                      id="edit-github-url"
                      name="url"
                      type="url"
                      value={githubForm.url}
                      onChange={handleGithubChange}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-github-repo-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub URL</label>
                    <input
                      id="edit-github-repo-url"
                      name="githubUrl"
                      type="url"
                      value={githubForm.githubUrl}
                      onChange={handleGithubChange}
                      placeholder="https://github.com/username/repo"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-github-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タグ（カンマ区切り）</label>
                    <input
                      id="edit-github-tags"
                      name="tags"
                      type="text"
                      value={githubForm.tags}
                      onChange={handleGithubChange}
                      placeholder="javascript, react, nextjs"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setItemToEdit(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    disabled={isEditing}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    disabled={isEditing}
                  >
                    {isEditing ? '更新中...' : '更新する'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-video-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                    <input
                      id="edit-video-title"
                      name="title"
                      type="text"
                      value={videoForm.title}
                      onChange={handleVideoChange}
                      placeholder="動画タイトル"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-video-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
                    <textarea
                      id="edit-video-description"
                      name="description"
                      value={videoForm.description}
                      onChange={handleVideoChange}
                      placeholder="動画の説明"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      rows={3}
                      required
                    ></textarea>
                  </div>
                  
                  <div>
                    <label htmlFor="edit-youtube-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">YouTubeリンク</label>
                    <input
                      id="edit-youtube-url"
                      name="youtubeUrl"
                      type="url"
                      value={videoForm.youtubeUrl}
                      onChange={handleVideoChange}
                      placeholder="https://www.youtube.com/watch?v=xxxx"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-video-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タグ（カンマ区切り）</label>
                    <input
                      id="edit-video-tags"
                      name="tags"
                      type="text"
                      value={videoForm.tags}
                      onChange={handleVideoChange}
                      placeholder="javascript, react, nextjs"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setItemToEdit(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                    disabled={isEditing}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    disabled={isEditing}
                  >
                    {isEditing ? '更新中...' : '更新する'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}