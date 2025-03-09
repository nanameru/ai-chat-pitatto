import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    console.log('ファイルアップロードAPIが呼び出されました');
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

    // Supabaseクライアントを作成
    console.log('Supabaseクライアントを作成中...');
    const supabase = await createClient();
    console.log('Supabaseクライアント作成完了');

    // バケットの存在確認
    console.log('バケットの存在を確認中...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('バケット一覧取得エラー:', bucketsError);
      return NextResponse.json(
        { error: 'ストレージバケットの一覧取得に失敗しました' },
        { status: 500 }
      );
    }
    
    console.log('利用可能なバケット:', buckets.map(b => b.name));
    
    // バケットが存在しない場合は作成を試みる
    const bucketExists = buckets.some(b => b.name === 'PitattoChat');
    if (!bucketExists) {
      console.log('バケット「PitattoChat」が存在しないため作成を試みます');
      const { error: createBucketError } = await supabase.storage.createBucket('PitattoChat', {
        public: true
      });
      
      if (createBucketError) {
        console.error('バケット作成エラー:', createBucketError);
        return NextResponse.json(
          { error: 'ストレージバケットの作成に失敗しました' },
          { status: 500 }
        );
      }
      console.log('バケット「PitattoChat」を作成しました');
    }

    // Supabaseのストレージにファイルをアップロード
    console.log('ファイルをアップロード中...');
    const { data, error } = await supabase.storage
      .from('PitattoChat')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabaseアップロードエラー:', error);
      return NextResponse.json(
        { error: `ファイルのアップロードに失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('ファイルアップロード成功:', data);

    // アップロードされたファイルの公開URLを取得
    console.log('公開URLを取得中...');
    const { data: publicUrlData } = supabase.storage
      .from('PitattoChat')
      .getPublicUrl(filePath);

    console.log('公開URL:', publicUrlData.publicUrl);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      pathname: file.name,
      contentType: file.type,
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: `ファイルのアップロード中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 