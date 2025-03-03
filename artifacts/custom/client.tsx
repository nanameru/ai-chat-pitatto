import { Artifact, type ArtifactActionContext } from "@/components/create-artifact";
import { ExampleComponent } from "@/components/example-component";
import type { ComponentType, Dispatch, SetStateAction } from "react";
import type { Suggestion } from "@/lib/db/schema";

interface CustomArtifactMetadata {
  info: string;
}

interface ArtifactContent<M = any> {
  title: string;
  content: string;
  mode: 'edit' | 'diff';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: 'streaming' | 'idle';
  suggestions: Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

const CustomArtifactContent: ComponentType<ArtifactContent<CustomArtifactMetadata>> = ({
  content,
  metadata,
  onSaveContent,
  isCurrentVersion,
}) => {
  return (
    <ExampleComponent
      content={content}
      metadata={metadata}
      onSaveContent={(content) => onSaveContent(content, true)}
      isCurrentVersion={isCurrentVersion}
    />
  );
};

export const customArtifact = new Artifact<"custom", CustomArtifactMetadata>({
  kind: "custom",
  description: "A custom artifact for demonstrating custom functionality.",
  content: CustomArtifactContent,
  initialize: async ({ documentId, setMetadata }) => {
    setMetadata({
      info: `Document ${documentId} initialized.`,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === "text-delta") {
      // メタデータとコンテンツを同時に更新
      setMetadata((metadata) => ({
        ...metadata,
        info: streamPart.content as string,
      }));
      
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content + (streamPart.content as string),
        status: "streaming",
      }));
    }
  },
  actions: [
    {
      icon: <span>⟳</span>,
      description: "Refresh artifact info",
      onClick: (context: ArtifactActionContext<CustomArtifactMetadata>) => {
        context.setMetadata({
          ...context.metadata,
          info: "Refreshing info...",
        });
      },
    },
  ],
  toolbar: [
    {
      icon: <span>✎</span>,
      description: "Edit custom artifact",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content: "Edit the custom artifact content.",
        });
      },
    },
  ],
});