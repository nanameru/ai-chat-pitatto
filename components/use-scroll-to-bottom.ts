import { useEffect, useRef, type RefObject, useState } from 'react';

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T>,
  RefObject<T>,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const lastScrollHeightRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) return;

    // 初期スクロール
    end.scrollIntoView({ behavior: 'instant', block: 'end' });
    
    // スクロール位置の監視
    const handleScroll = () => {
      if (!container) return;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      lastScrollTopRef.current = scrollTop;
      
      // ユーザーが手動でスクロールアップした場合、自動スクロールを無効化
      const isScrolledUp = scrollTop < scrollHeight - clientHeight - 10;
      setIsAutoScrollEnabled(!isScrolledUp);
    };

    // コンテンツ変更の監視
    const observer = new MutationObserver(() => {
      if (!container || !isAutoScrollEnabled) return;
      
      const { scrollHeight } = container;
      
      // スクロール位置を調整（コンテンツが増えた場合のみ）
      if (scrollHeight > lastScrollHeightRef.current) {
        requestAnimationFrame(() => {
          end.scrollIntoView({ behavior: 'instant', block: 'end' });
        });
      }
      
      lastScrollHeightRef.current = scrollHeight;
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isAutoScrollEnabled]);

  return [containerRef, endRef];
}
