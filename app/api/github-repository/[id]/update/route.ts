import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGithubRepositoryById, updateGithubRepository } from '@/lib/db/queries';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // paramsをunwrapする
    const unwrappedParams = params instanceof Promise ? await params : params;
    const repoId = unwrappedParams.id;
    
    console.log(`GitHubリポジトリ更新APIが呼び出されました - ID: ${repoId}`);
    
    // リクエストボディを解析
    const { title, description, url, githubUrl, tags } = await request.json();
    
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
    
    // リポジトリの存在確認
    const repository = await getGithubRepositoryById({ id: repoId });
    if (!repository) {
      return NextResponse.json(
        { error: '指定されたGitHubリポジトリが見つかりません' },
        { status: 404 }
      );
    }
    
    // GitHubリポジトリの更新
    const updatedRepository = await updateGithubRepository({
      id: repoId,
      title,
      description,
      url,
      githubUrl,
      tags
    });
    
    return NextResponse.json({
      success: true,
      message: 'GitHubリポジトリが正常に更新されました',
      repository: updatedRepository
    });
    
  } catch (error) {
    console.error('GitHubリポジトリ更新エラー:', error);
    return NextResponse.json(
      { error: `GitHubリポジトリの更新中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
