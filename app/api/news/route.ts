import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 全てのニュース記事を取得するAPI
 */
export async function GET(request: Request) {
  try {
    // Supabaseクライアントを取得
    const supabase = await db.getClient();
    
    // ニュース記事を取得（新しい順）
    const { data, error } = await supabase
      .from('News')
      .select('*')
      .order('publishedAt', { ascending: false })
      .limit(50); // 最新50件を表示
    
    if (error) {
      console.error('ニュース記事の取得に失敗しました:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'データの取得に失敗しました',
        error: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('ニュース取得エラー:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'ニュース記事の取得中にエラーが発生しました',
      error: (error as Error).message
    }, { status: 500 });
  }
} 