import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { nanoid } from 'nanoid';

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
  
    // バケット名を直接指定
    const bucketName = 'PitattoChat';
    console.log(`バケット「${bucketName}」を使用します`);
    
    // バケットの存在確認
    console.log('バケットの存在を確認中...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`バケット「${bucketName}」が存在しません。作成します...`);
      const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
        public: true, // パブリックアクセスを許可
      });
      
      if (createBucketError) {
        console.error('バケット作成エラー:', createBucketError);
        return NextResponse.json(
          { error: `バケットの作成に失敗しました: ${createBucketError.message}` },
          { status: 500 }
        );
      }
      
      console.log(`バケット「${bucketName}」を作成しました`);
      
      // バケットのRLSポリシーを設定
      console.log('RLSポリシーを設定中...');
      try {
        // 注意: RLSポリシーはSQL文で設定する必要があるため、
        // ここではSupabaseダッシュボードでの手動設定を推奨するメッセージを表示
        console.log('RLSポリシーはSupabaseダッシュボードで設定してください');
      } catch (policyError) {
        console.error('RLSポリシー設定エラー:', policyError);
      }
    } else {
      console.log(`バケット「${bucketName}」は既に存在します`);
    }
    
    try {
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
            { status: 500 }
          );
        }
        
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