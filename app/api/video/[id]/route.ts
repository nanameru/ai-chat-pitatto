import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { deleteVideo, getVideoById, updateVideo } from '@/lib/db/queries';

// 動画の詳細情報を取得するGETメソッド
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // paramsをunwrapする
    const unwrappedParams = params instanceof Promise ? await params : params;
    const videoId = unwrappedParams.id;
    
    console.log(`動画詳細取得APIが呼び出されました - ID: ${videoId}`);
    
    // 動画の存在確認
    const video = await getVideoById({ id: videoId });
    if (!video) {
      return NextResponse.json(
        { error: '指定された動画が見つかりません' },
        { status: 404 }
      );
    }
    
    // 動画情報を返す
    return NextResponse.json({ video });
  } catch (error) {
    console.error('動画詳細取得エラー:', error);
    return NextResponse.json(
      { error: '動画情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 動画情報を更新するPUTメソッド
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // paramsをunwrapする
    const unwrappedParams = params instanceof Promise ? await params : params;
    const videoId = unwrappedParams.id;
    
    console.log(`動画更新APIが呼び出されました - ID: ${videoId}`);
    
    // リクエストボディの取得
    const body = await request.json();
    const { title, description, tags, youtubeUrl } = body;
    
    // 必須フィールドの確認
    if (!title || !description || !youtubeUrl) {
      return NextResponse.json(
        { error: 'タイトル、説明、YouTubeリンクは必須です' },
        { status: 400 }
      );
    }
    
    // YouTubeリンクの形式を検証（簡易的な検証）
    if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be') && !youtubeUrl.includes('watch?v=')) {
      return NextResponse.json(
        { error: '有効なYouTubeリンクを入力してください' },
        { status: 400 }
      );
    }
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      console.log('未認証ユーザーからのリクエスト - 認証が必要です');
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
    
    // 動画の存在確認
    const video = await getVideoById({ id: videoId });
    if (!video) {
      return NextResponse.json(
        { error: '指定された動画が見つかりません' },
        { status: 404 }
      );
    }
    
    // リクエストデータのログ出力
    console.log('動画更新リクエストデータ:', {
      id: videoId,
      title,
      description,
      tags,
      youtubeUrl
    });
    
    // 動画情報の更新
    const updatedVideo = await updateVideo({
      id: videoId,
      title,
      description,
      tags: Array.isArray(tags) ? tags.join(', ') : tags,
      youtubeUrl
    });
    
    console.log('更新後の動画情報:', updatedVideo);
    
    // レスポンスデータのサイズを確認
    const responseData = {
      success: true,
      message: '動画情報が正常に更新されました',
      video: updatedVideo
    };
    
    console.log('レスポンスデータサイズ:', JSON.stringify(responseData).length, 'bytes');
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('動画更新エラー:', error);
    
    // 詳細なエラー情報をログ出力
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('エラースタック:', error.stack);
    }
    
    // エラーオブジェクトの詳細な情報を取得
    let errorMessage = '動画の更新中にエラーが発生しました';
    
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage += `: ${JSON.stringify(error)}`;
      } catch (jsonError) {
        errorMessage += ': エラーオブジェクトを文字列化できませんでした';
      }
    } else {
      errorMessage += `: ${String(error)}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // paramsをunwrapする
    const unwrappedParams = params instanceof Promise ? await params : params;
    const videoId = unwrappedParams.id;
    
    console.log(`動画削除APIが呼び出されました - ID: ${videoId}`);
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      console.log('未認証ユーザーからのリクエスト - 認証が必要です');
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
    
    // 動画の存在確認
    const video = await getVideoById({ id: videoId });
    if (!video) {
      return NextResponse.json(
        { error: '指定された動画が見つかりません' },
        { status: 404 }
      );
    }
    
    // 動画の削除（データベースとストレージの両方から）
    await deleteVideo({ id: videoId });
    
    return NextResponse.json({
      success: true,
      message: '動画が正常に削除されました'
    });
    
  } catch (error) {
    console.error('動画削除エラー:', error);
    return NextResponse.json(
      { error: `動画の削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
