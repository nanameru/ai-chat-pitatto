import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react'; // Assuming lucide-react is installed

export type ReasoningSidebarProps = {
  onClose?: () => void;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
};

const DEFAULT_MIN_WIDTH = 200; // Adjusted default min width
const DEFAULT_MAX_WIDTH = 800; // Adjusted default max width
const DEFAULT_INITIAL_WIDTH = 350; // Adjusted default initial width

export const ReasoningSidebar: React.FC<ReasoningSidebarProps> = ({
  onClose,
  initialWidth = DEFAULT_INITIAL_WIDTH,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  className = '',
}) => {
  const [width, setWidth] = useState<number>(initialWidth);
  const isResizingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null); // Ref for the sidebar itself

  // Memoized mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !sidebarRef.current) return;
    // Calculate width from the right edge of the screen
    const newWidth = window.innerWidth - e.clientX;
    // Clamp width within min/max bounds
    const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setWidth(clampedWidth);
  }, [minWidth, maxWidth]); // Include dependencies

  // Memoized mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // Remove cursor style override from body
    document.body.style.cursor = '';
    // Re-enable text selection if it was disabled
    document.body.style.userSelect = '';
  }, [handleMouseMove]); // handleMouseMove is stable due to its own useCallback

  // Mouse down handler for the resizer element
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent text selection during drag
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    // Change cursor for the whole body during resize
    document.body.style.cursor = 'ew-resize';
    // Disable text selection globally during resize
    document.body.style.userSelect = 'none';
  };

  // Effect for attaching and detaching global listeners
  useEffect(() => {
    // Cleanup function to remove listeners if the component unmounts
    return () => {
      // Ensure listeners are removed if resizing is in progress during unmount
      if (isResizingRef.current) {
        handleMouseUp(); // This also removes the listeners
      }
    };
  }, [handleMouseUp]); // Dependency ensures cleanup runs if handler changes (though it's stable here)

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className={`fixed right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-lg rounded-l-xl flex flex-col overflow-hidden ${className}`}
      // Removed width transition for smoother resizing
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-[-4px] top-0 h-full w-2 cursor-ew-resize group z-10" // Positioned slightly outside, higher z-index
        aria-label="Resize sidebar"
      >
        <div className="w-full h-full bg-transparent transition-colors duration-150 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 opacity-0 group-hover:opacity-50 rounded-l-full"></div> {/* Visual feedback */}
      </div>

      {/* Header with optional close button */}
      {(onClose) && ( // Render header only if onClose is provided
        <div className="flex items-center justify-end p-2 border-b border-gray-200 dark:border-zinc-700 flex-shrink-0">
          {/* Optional: Add a title here if needed */}
          {/* <span className="font-semibold text-sm text-gray-700 dark:text-zinc-300">サイドバータイトル</span> */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-grow overflow-auto p-4">
        {/* Content will go here */}
      </div>
    </aside>
  );
};
