import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { OpenAIVoice } from '@mastra/voice-openai';

/**
 * VoiceAgent
 * - OpenAI Voice (STT & TTS) を用いた音声入出力機能を持つエージェント
 */
const voiceProvider = new OpenAIVoice();

export const voiceAgent = new Agent({
  name: 'Voice Agent',
  instructions: `
    あなたは音声で会話できるAIアシスタントです。
    ユーザーからの音声入力を聞き取り、音声で応答を返します。
  `,
  model: openai('gpt-4o'),
  voice: voiceProvider as any,
}); 