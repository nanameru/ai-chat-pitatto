import { NextResponse } from 'next/server';
import { initErrorReporting } from '@/lib/mastra/utils/errorHandling';

// エラー報告システムを初期化
initErrorReporting();

export async function GET() {
  return NextResponse.json({ status: 'ok', version: '1.0.0' });
} 