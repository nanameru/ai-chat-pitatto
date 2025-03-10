import type { Attachment } from 'ai';
import Image from 'next/image';
import { LoaderIcon } from './icons';
import { X } from 'lucide-react';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  
  // URLとコンテンツタイプをコンソールに出力
  console.log(`PreviewAttachment: name=${name}, url=${url}, contentType=${contentType}`);

  return (
    <div className="flex flex-col gap-2 relative group">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
        {contentType ? (
          contentType.startsWith('image') ? (
            url ? (
              <Image
                key={url}
                src={url}
                alt={name ?? 'An image attachment'}
                className="rounded-md object-cover"
                fill
                sizes="80px"
                unoptimized={url.startsWith('https://') && !url.includes('localhost')}
              />
            ) : (
              <div className="text-xs text-zinc-500">No URL</div>
            )
          ) : (
            <div className="text-xs text-zinc-500">{contentType.split('/')[0]}</div>
          )
        ) : (
          <div className="text-xs text-zinc-500">Unknown</div>
        )}

        {isUploading && (
          <div className="animate-spin absolute text-zinc-500">
            <LoaderIcon />
          </div>
        )}

        {onDelete && !isUploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-1 right-1 bg-zinc-700/70 hover:bg-zinc-800/90 rounded-sm p-0.5 text-white transition-opacity opacity-0 group-hover:opacity-100 z-10"
            aria-label="削除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
