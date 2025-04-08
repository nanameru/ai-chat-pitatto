import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveVideo, getVideos } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    console.log('動画登録APIが呼び出されました');
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      return NextResponse.json(
        { error: '認証されていません。ログインしてください。' },
        { status: 401 }
      );
    }
    
    const userId = sessionData.session.user.id;
    
    // 管理者権限チェック
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('ユーザー情報取得エラー:', userError);
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました' },
        { status: 500 }
      );
    }
    
    if (userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'この操作には管理者権限が必要です' },
        { status: 403 }
      );
    }
    
    // JSONデータを取得
    const data = await request.json();
    
    // JSONデータから情報を取得
    const { title, description, tags, youtubeUrl } = data;
    
    if (!title || !description || !youtubeUrl) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }
    
    console.log(`動画情報: タイトル=${title}, YouTubeリンク=${youtubeUrl}`);
    
    // YouTubeリンクの形式を検証（簡易的な検証）
    if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      return NextResponse.json(
        { error: '有効なYouTubeリンクを入力してください' },
        { status: 400 }
      );
    }
    
    // 動画情報をデータベースに保存
    const video = await saveVideo({
      title,
      description,
      tags: tags || '',
      youtubeUrl,
      userId
    });
    
    return NextResponse.json({
      success: true,
      video,
      url: youtubeUrl
    });
    
  } catch (error) {
    console.error('動画登録エラー:', error);
    return NextResponse.json(
      { error: `動画の登録中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('動画一覧取得APIが呼び出されました');
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    
    // 認証済みユーザーであれば閲覧可能（管理者権限は不要）
    if (!sessionData.session) {
      console.log('未認証ユーザーからのリクエスト - 認証が必要です');
      return NextResponse.json(
        { error: '認証されていません。ログインしてください。' },
        { status: 401 }
      );
    }
    
    // 動画の一覧を取得
    const videos = await getVideos();
    
    return NextResponse.json({
      videos
    });
    
  } catch (error) {
    console.error('動画一覧取得エラー:', error);
    return NextResponse.json(
      { error: `動画一覧の取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
