import { analysisTool } from './lib/mastra/tools/analysis-tool';

/**
 * 分析ツールのテスト関数
 */
async function testAnalysisTool() {
  console.log('===================================================');
  console.log('          分析ツールのテストを開始します          ');
  console.log('===================================================\n');
  
  // テスト用の検索結果セット
  const testSets = [
    // セット1: 基本情報のみ (2件)
    [
      {
        title: '量子コンピューティングとは？基本概念と仕組み',
        snippet: '量子コンピューティングは量子力学の原理を利用した計算方式です。従来のコンピュータと異なり、量子ビット（キュービット）を使用し、重ね合わせと量子もつれの特性により並列計算を実現します。',
        url: 'https://example.com/quantum-computing-basics',
      },
      {
        title: '量子コンピューティングの最新進展 2025年版',
        snippet: '2025年の量子コンピューティング分野では、エラー訂正技術の向上により実用的な量子アルゴリズムの実装が進んでいます。Google、IBM、Amazonなどの大手企業が量子クラウドサービスを拡充中。',
        url: 'https://example.com/quantum-computing-advancements-2025',
      },
    ],
    
    // セット2: 基本情報 + 市場影響 (3件)
    [
      {
        title: '量子コンピューティングとは？基本概念と仕組み',
        snippet: '量子コンピューティングは量子力学の原理を利用した計算方式です。従来のコンピュータと異なり、量子ビット（キュービット）を使用し、重ね合わせと量子もつれの特性により並列計算を実現します。',
        url: 'https://example.com/quantum-computing-basics',
      },
      {
        title: '量子コンピューティングの最新進展 2025年版',
        snippet: '2025年の量子コンピューティング分野では、エラー訂正技術の向上により実用的な量子アルゴリズムの実装が進んでいます。Google、IBM、Amazonなどの大手企業が量子クラウドサービスを拡充中。',
        url: 'https://example.com/quantum-computing-advancements-2025',
      },
      {
        title: '量子コンピューティングの市場影響と経済効果',
        snippet: '量子コンピューティングは暗号解読、創薬、金融モデリング、気象予測などの分野に革命をもたらすと予測されています。2025年の市場規模は前年比30%増加し、特に金融セクターでの採用が加速しています。',
        url: 'https://example.com/quantum-computing-market-impact',
      },
    ],
    
    // セット3: 基本情報 + 市場影響 + 事例 (4件)
    [
      {
        title: '量子コンピューティングとは？基本概念と仕組み',
        snippet: '量子コンピューティングは量子力学の原理を利用した計算方式です。従来のコンピュータと異なり、量子ビット（キュービット）を使用し、重ね合わせと量子もつれの特性により並列計算を実現します。',
        url: 'https://example.com/quantum-computing-basics',
      },
      {
        title: '量子コンピューティングの最新進展 2025年版',
        snippet: '2025年の量子コンピューティング分野では、エラー訂正技術の向上により実用的な量子アルゴリズムの実装が進んでいます。Google、IBM、Amazonなどの大手企業が量子クラウドサービスを拡充中。',
        url: 'https://example.com/quantum-computing-advancements-2025',
      },
      {
        title: '量子コンピューティングの市場影響と経済効果',
        snippet: '量子コンピューティングは暗号解読、創薬、金融モデリング、気象予測などの分野に革命をもたらすと予測されています。2025年の市場規模は前年比30%増加し、特に金融セクターでの採用が加速しています。',
        url: 'https://example.com/quantum-computing-market-impact',
      },
      {
        title: '量子コンピューティングの実例と応用事例',
        snippet: 'VWは量子アルゴリズムを使用して交通最適化問題を解決し、渋滞を15%削減。製薬会社は量子シミュレーションで新薬開発期間を短縮し、従来の3年から1年に短縮しました。',
        url: 'https://example.com/quantum-computing-case-studies',
      },
    ],
    
    // セット4: すべての側面をカバー (5件)
    [
      {
        title: '量子コンピューティングとは？基本概念と仕組み',
        snippet: '量子コンピューティングは量子力学の原理を利用した計算方式です。従来のコンピュータと異なり、量子ビット（キュービット）を使用し、重ね合わせと量子もつれの特性により並列計算を実現します。',
        url: 'https://example.com/quantum-computing-basics',
      },
      {
        title: '量子コンピューティングの最新進展 2025年版',
        snippet: '2025年の量子コンピューティング分野では、エラー訂正技術の向上により実用的な量子アルゴリズムの実装が進んでいます。Google、IBM、Amazonなどの大手企業が量子クラウドサービスを拡充中。',
        url: 'https://example.com/quantum-computing-advancements-2025',
      },
      {
        title: '量子コンピューティングの市場影響と経済効果',
        snippet: '量子コンピューティングは暗号解読、創薬、金融モデリング、気象予測などの分野に革命をもたらすと予測されています。2025年の市場規模は前年比30%増加し、特に金融セクターでの採用が加速しています。',
        url: 'https://example.com/quantum-computing-market-impact',
      },
      {
        title: '量子コンピューティングの実例と応用事例',
        snippet: 'VWは量子アルゴリズムを使用して交通最適化問題を解決し、渋滞を15%削減。製薬会社は量子シミュレーションで新薬開発期間を短縮し、従来の3年から1年に短縮しました。',
        url: 'https://example.com/quantum-computing-case-studies',
      },
      {
        title: '量子コンピューティングの将来展望と課題',
        snippet: '今後5年間で量子ビット数は現在の500から5000に増加すると予測されています。主な課題はエラー訂正、量子コヒーレンス時間の延長、スケーラビリティの向上です。',
        url: 'https://example.com/quantum-computing-future',
      },
    ],
  ];
  
  // 各テストセットで分析ツールを実行
  for (let i = 0; i < testSets.length; i++) {
    const iteration = i + 1;
    const results = testSets[i];
    
    console.log(`\n===================================================`);
    console.log(`          テストセット ${iteration}: 検索結果 ${results.length}件          `);
    console.log(`===================================================\n`);
    
    // 検索結果の概要を表示
    console.log('検索結果の概要:');
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
    });
    console.log('');
    
    // 分析ツールを実行
    try {
      const analysisResult = await analysisTool.execute({
        context: {
          query: '量子コンピューティングの最新の進展について教えてください',
          results: results,
          iteration: iteration,
          maxIterations: 10
        }
      });
      
      console.log(`\n----- 分析結果 -----\n`);
      console.log(`完全性スコア: ${analysisResult.completenessScore}/10`);
      console.log(`十分な情報か: ${analysisResult.isSufficient ? 'はい' : 'いいえ'}`);
      console.log(`\n不足情報:`);
      analysisResult.missingInformation.forEach(info => console.log(`- ${info}`));
      
      console.log(`\nフォローアップクエリ:`);
      analysisResult.followUpQueries.forEach(query => console.log(`- ${query}`));
      
    } catch (error) {
      console.error('エラーが発生しました:', error);
    }
  }
  
  console.log('\n===================================================');
  console.log('                テスト完了                  ');
  console.log('===================================================');
}

// テスト実行
testAnalysisTool();
