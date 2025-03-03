import type { Message } from 'ai';

const CONFIRMATION_PATTERNS = [
  '実行', 'はい', 'いいよ', 'お願い',
  'それで', 'どうぞ', 'よろしく',
  // 英語パターン
  'yes', 'ok', 'please', 'go ahead'
];

const CONFIRMATION_CHECK_PROMPT = `
あなたはユーザーの応答が「X検索の実行を承認する」意図を持っているかどうかを判断するアシスタントです。

以下のような応答は承認とみなします：
- 「はい」「実行してください」などの明確な承認
- 「いいよ」「それで」などの口語的な承認
- 「お願いします」「進めてください」などの依頼形
- その他、文脈から実行の承認が明確に読み取れる表現

判断結果は以下のいずれかの1行のみを出力してください：
CONFIRMED - 承認と判断
REJECTED - 承認ではないと判断
`;

export async function checkConfirmation(userResponse: string): Promise<'CONFIRMED' | 'REJECTED'> {
  // まず、単純なパターンマッチを試みる
  const hasConfirmationPattern = CONFIRMATION_PATTERNS.some(pattern => 
    userResponse.toLowerCase().includes(pattern)
  );

  if (hasConfirmationPattern) {
    // パターンマッチした場合は即座に承認と判断
    return 'CONFIRMED';
  }

  // パターンマッチしない場合はAIで判断
  const messages: Message[] = [
    {
      id: 'system',
      role: 'system',
      content: CONFIRMATION_CHECK_PROMPT
    },
    {
      id: 'user',
      role: 'user',
      content: userResponse
    }
  ];

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 10
      })
    });

    if (!response.ok) {
      throw new Error('Failed to check confirmation');
    }

    const result = await response.text();
    return result.includes('CONFIRMED') ? 'CONFIRMED' : 'REJECTED';
  } catch (error) {
    console.error('Error checking confirmation:', error);
    return 'REJECTED';  // エラーの場合は安全のため否定として扱う
  }
}
