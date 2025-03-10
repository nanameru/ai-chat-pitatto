import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    console.log('ファイルアップロードAPIが呼び出されました');
    
    // ユーザー認証状態を確認
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (sessionData.session) {
      console.log('認証状態: ログイン済み');
      console.log('ユーザーID:', sessionData.session.user.id);
      console.log('ユーザーロール:', sessionData.session.user.role);
    } else {
      console.log('認証状態: 未ログイン (匿名ユーザー)');
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log('ファイルが見つかりません');
      return NextResponse.json(
        { error: 'ファイルが見つかりません' },
        { status: 400 }
      );
    }

    console.log(`ファイル情報: 名前=${file.name}, サイズ=${file.size}, タイプ=${file.type}`);

    // ファイル名を生成（一意のIDを含む）
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${nanoid()}.${fileExtension}`;
    const filePath = `uploads/${uniqueFileName}`;
    console.log(`生成されたファイルパス: ${filePath}`);

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    console.log(`ファイルバッファサイズ: ${fileBuffer.length}`);
  
    // バケットの存在確認
    console.log('バケットの存在を確認中...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('バケット一覧取得エラー:', bucketsError);
      return NextResponse.json(
        { error: `ストレージバケットの一覧取得に失敗しました: ${bucketsError.message}` },
        { status: 500 }
      );
    }
    
    if (!buckets || buckets.length === 0) {
      console.error('利用可能なバケットがありません');
      return NextResponse.json(
        { error: 'ストレージバケットが存在しません。管理者にバケットの作成を依頼してください。' },
        { status: 500 }
      );
    }
    
    console.log('利用可能なバケット:', JSON.stringify(buckets, null, 2));
    
    // 最初のバケットを使用
    const bucketName = buckets[0].name;
    console.log(`最初のバケット「${bucketName}」を使用します`);
    
    // Supabaseのストレージにファイルをアップロード
    console.log('ファイルをアップロード中...');
    console.log(`ファイルパス: ${filePath}, コンテンツタイプ: ${file.type}, ファイルサイズ: ${fileBuffer.length}`);
    
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: true, // 同名ファイルが存在する場合は上書き
        });

      if (error) {
        console.error('Supabaseアップロードエラー:', error);
        console.error('エラーコード:', error.code);
        console.error('エラーメッセージ:', error.message);
        console.error('エラー詳細:', error.details);
        return NextResponse.json(
          { error: `ファイルのアップロードに失敗しました: ${error.message}` },
          { status: 500 }
        );
      }

      console.log('ファイルアップロード成功:', data);

      // アップロードされたファイルの公開URLを取得
      console.log('公開URLを取得中...');
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('公開URL:', publicUrlData.publicUrl);

      return NextResponse.json({
        url: publicUrlData.publicUrl,
        pathname: file.name,
        contentType: file.type,
      });
    } catch (uploadError) {
      console.error('ファイルアップロード例外:', uploadError);
      return NextResponse.json(
        { error: `ファイルのアップロード中にエラーが発生しました: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: `ファイルのアップロード中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 