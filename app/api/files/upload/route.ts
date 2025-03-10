import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { nanoid } from 'nanoid';

// CORSヘッダーの設定
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OPTIONSリクエスト（プリフライト）のハンドラー
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// バケットの存在確認と作成を行うヘルパー関数
async function ensureBucketExists(supabase, bucketName) {
  try {
    // バケットの一覧を取得
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('バケット一覧取得エラー:', listError);
      return { success: false, error: listError };
    }
    
    // バケットが存在するか確認
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`バケット「${bucketName}」が存在しないため作成します`);
      
      // バケットを作成
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true, // 公開バケットとして作成
      });
      
      if (createError) {
        console.error('バケット作成エラー:', createError);
        return { success: false, error: createError };
      }
      
      console.log(`バケット「${bucketName}」を作成しました`);
      
      // RLSポリシーを設定（必要に応じて）
      // 注: RLSポリシーの設定はダッシュボードから行う必要があります
      
      return { success: true, created: true };
    }
    
    console.log(`バケット「${bucketName}」は既に存在します`);
    return { success: true, created: false };
  } catch (error) {
    console.error('バケット確認/作成エラー:', error);
    return { success: false, error };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('ファイルアップロードAPIが呼び出されました');
    
    // 環境変数の確認
    console.log('環境変数の確認:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '設定済み' : '未設定');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '設定済み' : '未設定');
    
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
        { status: 400, headers: corsHeaders }
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
    try {
      // バケット名を直接指定
      const bucketName = 'PitattoChat';
      console.log(`バケット「${bucketName}」を使用します`);
      
      // バケットの存在確認と作成
      const bucketResult = await ensureBucketExists(supabase, bucketName);
      if (!bucketResult.success) {
        return NextResponse.json(
          { error: `バケットの確認/作成に失敗しました: ${bucketResult.error?.message || '不明なエラー'}` },
          { status: 500, headers: corsHeaders }
        );
      }
      
      // Supabaseのストレージにファイルをアップロード
      console.log('ファイルをアップロード中...');
      console.log(`ファイルパス: ${filePath}, コンテンツタイプ: ${file.type}, ファイルサイズ: ${fileBuffer.length}`);
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: true, // 同名ファイルが存在する場合は上書き
        });

      if (error) {
        console.error('Supabaseアップロードエラー:', error);
        console.error('エラーメッセージ:', error.message);
        
        // RLSポリシー違反エラーの場合
        if (error.message.includes('row-level security policy')) {
          console.error('RLSポリシー違反エラー: バケットに対する適切なRLSポリシーが設定されていません');
          console.error('以下のRLSポリシーを設定してください:');
          console.error('1. 匿名ユーザー向けの読み取りポリシー（SELECT）');
          console.error('2. 匿名ユーザー向けの書き込みポリシー（INSERT）');
          console.error('3. 認証済みユーザー向けのポリシー（ALL）');
          
          return NextResponse.json(
            { 
              error: `ファイルのアップロードに失敗しました: RLSポリシー違反。Supabaseダッシュボードで適切なRLSポリシーを設定してください。`,
              details: error.message
            },
            { status: 500, headers: corsHeaders }
          );
        }
        
        return NextResponse.json(
          { error: `ファイルのアップロードに失敗しました: ${error.message}` },
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('ファイルアップロード成功:', data);

      // アップロードされたファイルの公開URLを取得
      console.log('公開URLを取得中...');
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('公開URL:', publicUrlData.publicUrl);
      console.log('=== ファイルアップロード情報 ===');
      console.log('ファイル名:', file.name);
      console.log('ファイルタイプ:', file.type);
      console.log('ファイルサイズ:', file.size, 'bytes');
      console.log('保存パス:', filePath);
      console.log('公開URL:', publicUrlData.publicUrl);
      console.log('=============================');

      return NextResponse.json({
        url: publicUrlData.publicUrl,
        pathname: file.name,
        contentType: file.type,
      }, { headers: corsHeaders });
    } catch (uploadError) {
      console.error('ファイルアップロード例外:', uploadError);
      return NextResponse.json(
        { error: `ファイルのアップロード中にエラーが発生しました: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}` },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    return NextResponse.json(
      { error: `ファイルのアップロード中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500, headers: corsHeaders }
    );
  }
} 