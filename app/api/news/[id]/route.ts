import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 単一のニュース記事を取得するAPI
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { success: false, message: '記事IDが必要です' },
      { status: 400 }
    );
  }

  try {
    // Supabaseクライアントを取得
    const supabase = await db.getClient();
    
    // IDを使用して記事を取得
    const { data, error } = await supabase
      .from('News')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`ID ${id} の記事取得に失敗しました:`, error);
      return NextResponse.json(
        { 
          success: false, 
          message: '記事の取得に失敗しました', 
          error: error.message 
        }, 
        { status: 404 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, message: '記事が見つかりませんでした' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error(`ID ${id} の記事取得中にエラーが発生しました:`, error);
    return NextResponse.json(
      { 
        success: false, 
        message: '記事の取得中にエラーが発生しました', 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
} 