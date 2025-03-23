'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLinkIcon, GithubIcon, PlayIcon, EyeIcon } from 'lucide-react';

// OSSアプリケーションの型定義
interface OSSApplication {
  title: string;
  description: string;
  url: string;
  demoUrl?: string;
  previewUrl?: string;
  githubUrl: string;
  tags: string[];
}

export default function OSSApplicationsPage() {
  // OSSアプリケーションのサンプルデータ
  const applications: OSSApplication[] = [
    {
      title: "ChatGPT",
      description: "OpenAIが開発した会話型AIモデル。自然言語処理の技術を用いて、人間のような会話を行うことができます。",
      url: "https://chat.openai.com",
      demoUrl: "https://www.youtube.com/watch?v=e0aKI2GGZNg",
      previewUrl: "https://chat.openai.com",
      githubUrl: "https://github.com/openai/openai-cookbook",
      tags: ["AI", "自然言語処理", "チャットボット"]
    },
    {
      title: "Stable Diffusion",
      description: "テキストから画像を生成するAIモデル。高品質な画像生成が可能で、オープンソースとして公開されています。",
      url: "https://stability.ai",
      demoUrl: "https://www.youtube.com/watch?v=nYqNDJd9gJ0",
      previewUrl: "https://huggingface.co/spaces/stabilityai/stable-diffusion",
      githubUrl: "https://github.com/Stability-AI/stablediffusion",
      tags: ["AI", "画像生成", "テキスト to イメージ"]
    },
    {
      title: "LangChain",
      description: "言語モデルを使ったアプリケーション開発のためのフレームワーク。さまざまなAIモデルを連携させた複雑なアプリケーションを構築できます。",
      url: "https://langchain.com",
      demoUrl: "https://www.youtube.com/watch?v=aywZrzNaKjs",
      previewUrl: "https://python.langchain.com/docs/get_started/introduction.html",
      githubUrl: "https://github.com/langchain-ai/langchain",
      tags: ["AI", "フレームワーク", "開発ツール"]
    },
    {
      title: "Hugging Face",
      description: "機械学習モデルの共有プラットフォーム。数多くのAIモデルやデータセットが公開されており、簡単に利用できます。",
      url: "https://huggingface.co",
      demoUrl: "https://www.youtube.com/watch?v=QEaBAZQCtwE",
      previewUrl: "https://huggingface.co/models",
      githubUrl: "https://github.com/huggingface",
      tags: ["AI", "機械学習", "モデル共有"]
    },
    {
      title: "Ollama",
      description: "ローカル環境でAIモデルを実行するためのツール。プライバシーを保ちながら、様々な言語モデルを利用できます。",
      url: "https://ollama.com",
      demoUrl: "https://www.youtube.com/watch?v=dVeIGX0Nj68",
      previewUrl: "https://ollama.com/library",
      githubUrl: "https://github.com/ollama/ollama",
      tags: ["AI", "ローカル実行", "プライバシー"]
    },
    {
      title: "Auto-GPT",
      description: "自律的にタスクを実行するAIエージェント。ユーザーの目標に向かって、自動的に計画を立てて実行します。",
      url: "https://autogpt.net",
      demoUrl: "https://www.youtube.com/watch?v=jn8p3qU-6mQ",
      previewUrl: "https://github.com/Significant-Gravitas/Auto-GPT#demo",
      githubUrl: "https://github.com/Significant-Gravitas/Auto-GPT",
      tags: ["AI", "自律エージェント", "タスク自動化"]
    }
  ];

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">AIで遊ぼうOSS</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {applications.map((app, index) => (
          <Card key={index} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">{app.title}</CardTitle>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {app.tags.map((tag, tagIndex) => (
                  <span 
                    key={tagIndex} 
                    className="inline-block bg-gray-100 dark:bg-gray-800 text-xs px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{app.description}</p>
              
              <div className="flex flex-wrap gap-2">
                <a 
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ExternalLinkIcon size={12} />
                  公式
                </a>
                
                {app.demoUrl && (
                  <a 
                    href={app.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <PlayIcon size={12} />
                    デモ
                  </a>
                )}
                
                {app.previewUrl && (
                  <a 
                    href={app.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <EyeIcon size={12} />
                    プレビュー
                  </a>
                )}
                
                <a 
                  href={app.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <GithubIcon size={12} />
                  GitHub
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 