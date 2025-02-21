import React from 'react';

interface ExampleComponentProps {
  content: string;
  metadata?: {
    info: string;
  };
  onSaveContent?: (content: string) => void;
  isCurrentVersion?: boolean;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  content,
  metadata,
  onSaveContent,
  isCurrentVersion = true,
}) => {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Content</div>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
      
      {metadata && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Metadata</div>
          <div className="text-sm text-muted-foreground">{metadata.info}</div>
        </div>
      )}

      {isCurrentVersion && onSaveContent && (
        <div className="flex justify-end">
          <button
            onClick={() => onSaveContent(content)}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};
