import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { saveGithubRepository, getGithubRepositories } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    console.log('GitHubリポジトリ登録APIが呼び出されました');
    
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
    
    const json = await request.json();
    
    const { title, description, url, githubUrl, tags } = json;
    
    if (!title || !description || !url || !githubUrl) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }
    
    // GitHubリポジトリをデータベースに保存
    const repository = await saveGithubRepository({
      title,
      description,
      url,
      githubUrl,
      tags: tags || '',
      userId
    });
    
    return NextResponse.json({
      success: true,
      repository
    });
    
  } catch (error) {
    console.error('GitHubリポジトリ登録エラー:', error);
    return NextResponse.json(
      { error: `GitHubリポジトリの登録中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('GitHubリポジトリ取得APIが呼び出されました');
    
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
    
    // GitHubリポジトリの一覧を取得
    const repositories = await getGithubRepositories();
    
    return NextResponse.json({
      repositories
    });
    
  } catch (error) {
    console.error('GitHubリポジトリ取得エラー:', error);
    return NextResponse.json(
      { error: `GitHubリポジトリの取得中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
