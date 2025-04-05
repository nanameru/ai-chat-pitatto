import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('ユーザー情報取得APIが呼び出されました');
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    console.log('Supabaseクライアントの作成に成功しました');
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('セッションデータ取得結果:', sessionError ? 'エラー発生' : '成功');
    
    if (sessionError) {
      console.error('セッション取得エラー詳細:', sessionError);
      return NextResponse.json(
        { error: 'セッション情報の取得に失敗しました', details: sessionError },
        { status: 500 }
      );
    }
    
    if (!sessionData.session) {
      console.log('セッションが存在しません - 未認証状態');
      return NextResponse.json(
        { error: '認証されていません。ログインしてください。' },
        { status: 401 }
      );
    }
    
    const userId = sessionData.session.user.id;
    console.log('ユーザーID:', userId);
    console.log('セッションユーザー情報:', {
      id: sessionData.session.user.id,
      email: sessionData.session.user.email,
      role: sessionData.session.user.role // これはおそらく存在しない
    });
    
    // テーブル名の確認
    console.log('テーブル一覧を取得します...');
    try {
      const { data: tableList, error: tableError } = await supabase
        .from('_tables')
        .select('*');
      
      if (tableError) {
        console.log('テーブル一覧取得エラー:', tableError);
      } else {
        console.log('利用可能なテーブル:', tableList);
      }
    } catch (tableListError) {
      console.log('テーブル一覧取得中に例外が発生:', tableListError);
    }
    
    // ユーザー情報を取得
    console.log('Userテーブルからユーザー情報を取得します...');
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('ユーザー情報取得エラー詳細:', userError);
      
      // ユーザーが存在しない場合は作成を試みる
      if (userError.code === 'PGRST116') {
        console.log('ユーザーが存在しないため、新規作成を試みます');
        try {
          const { data: newUser, error: createError } = await supabase
            .from('User')
            .insert([
              { 
                id: userId, 
                email: sessionData.session.user.email,
                role: 'user' // デフォルトは一般ユーザー
              }
            ])
            .select()
            .single();
          
          if (createError) {
            console.error('ユーザー作成エラー:', createError);
            return NextResponse.json(
              { error: 'ユーザー情報の作成に失敗しました', details: createError },
              { status: 500 }
            );
          }
          
          console.log('新規ユーザーを作成しました:', newUser);
          return NextResponse.json({
            user: newUser,
            session: sessionData.session,
            isNewUser: true
          });
        } catch (createUserError) {
          console.error('ユーザー作成中に例外が発生:', createUserError);
          return NextResponse.json(
            { error: 'ユーザー情報の作成中に例外が発生しました', details: createUserError },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました', details: userError },
        { status: 500 }
      );
    }
    
    console.log('ユーザー情報取得成功:', userData);
    
    // ユーザー情報を返す
    return NextResponse.json({
      user: userData,
      session: sessionData.session
    });
    
  } catch (error) {
    console.error('ユーザー情報取得中に例外が発生しました:', error);
    return NextResponse.json(
      { error: 'ユーザー情報の取得に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
