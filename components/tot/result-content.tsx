'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ResultContentProps {
  content: string;
}

export const ResultContent: React.FC<ResultContentProps> = ({ content }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // 段階的なアニメーション表示
    setIsVisible(true);
    
    if (contentRef.current) {
      const elements = contentRef.current.querySelectorAll('h1, h2, h3, p, div.list-item');
      elements.forEach((el, index) => {
        const element = el as HTMLElement;
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, 100 + index * 50);
      });
    }
  }, [content]);
  
  // マークダウン風のテキストをHTMLに変換
  const formatContent = (text: string): string => {
    return text.split('\n').map(line => {
      if (line.startsWith('# ')) {
        return `<h1 class="text-2xl font-medium mt-8 mb-6 text-gray-900 dark:text-gray-100 tracking-tight transition-all duration-500">${line.substring(2)}</h1>`;
      } else if (line.startsWith('## ')) {
        return `<h2 class="text-xl font-medium mt-7 mb-4 text-gray-800 dark:text-gray-200 tracking-tight transition-all duration-500">${line.substring(3)}</h2>`;
      } else if (line.startsWith('### ')) {
        return `<h3 class="text-lg font-medium mt-6 mb-3 text-gray-700 dark:text-gray-300 tracking-tight transition-all duration-500">${line.substring(4)}</h3>`;
      } else if (line.match(/^\d+\.\s/)) {
        const boldPart = line.match(/\*\*(.*?)\*\*/);
        if (boldPart) {
          const boldText = boldPart[1];
          const restText = line.replace(`**${boldText}**`, `<span class="font-medium text-gray-900 dark:text-white">${boldText}</span>`);
          return `<div class="list-item flex items-start my-3 transition-all duration-500">
            <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center mr-3">
              <span class="text-sm font-medium text-gray-500 dark:text-gray-400">${line.match(/^\d+/)?.[0] || ''}</span>
            </div>
            <p class="flex-1 text-gray-700 dark:text-gray-300">${restText.replace(/^\d+\.\s/, '')}</p>
          </div>`;
        }
        return `<div class="list-item flex items-start my-3 transition-all duration-500">
          <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center mr-3">
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">${line.match(/^\d+/)?.[0] || ''}</span>
          </div>
          <p class="flex-1 text-gray-700 dark:text-gray-300">${line.replace(/^\d+\.\s/, '')}</p>
        </div>`;
      } else if (line.startsWith('- ')) {
        return `<div class="list-item flex items-start my-2 transition-all duration-500">
          <div class="flex-shrink-0 w-4 h-4 flex items-center justify-center mr-2 mt-1">
            <span class="block w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
          </div>
          <p class="flex-1 text-gray-700 dark:text-gray-300">${line.substring(2)}</p>
        </div>`;
      } else if (line.match(/\*\*(.*?)\*\*/)) {
        const boldParts = line.match(/\*\*(.*?)\*\*/g) || [];
        let formattedLine = line;
        boldParts.forEach(part => {
          const text = part.replace(/\*\*/g, '');
          formattedLine = formattedLine.replace(part, `<span class="font-medium text-gray-900 dark:text-white">${text}</span>`);
        });
        return line ? `<p class="my-4 text-gray-700 dark:text-gray-300 leading-relaxed transition-all duration-500">${formattedLine}</p>` : '';
      } else {
        return line ? `<p class="my-4 text-gray-700 dark:text-gray-300 leading-relaxed transition-all duration-500">${line}</p>` : '';
      }
    }).join('');
  };

  return (
    <div 
      ref={contentRef}
      className={`result-content p-8 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div 
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: formatContent(content) }}
      />
      
      <style jsx global>{`
        .prose h1 {
          position: relative;
          display: inline-block;
        }
        
        .prose h1::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 0;
          width: 40px;
          height: 2px;
          background-color: currentColor;
          opacity: 0.3;
        }
        
        .prose h2 {
          position: relative;
        }
        
        .prose h2::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 50%;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
          opacity: 0.4;
          transform: translateY(-50%);
        }
        
        .prose p, .prose .list-item {
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        
        .prose p {
          line-height: 1.8;
          letter-spacing: 0.01em;
        }
        
        @media (prefers-color-scheme: dark) {
          .prose {
            color: #e5e7eb;
          }
        }
      `}</style>
    </div>
  );
};
