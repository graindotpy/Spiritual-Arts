import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DmScratchpad } from "@shared/schema";
import type { DmScratchpadUpdate } from "./api";

interface ScratchpadCardProps {
  scratchpad: DmScratchpad;
  onUpdate: (update: DmScratchpadUpdate) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const SAVE_DELAY_MS = 500;

export function ScratchpadCard({
  scratchpad,
  onUpdate,
  onDelete,
}: ScratchpadCardProps) {
  const initialTitle = scratchpad.title || "Scratchpad";
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState(scratchpad.content);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const latestTitle = useRef(initialTitle);
  const latestContent = useRef(scratchpad.content);
  const titleIsDirty = useRef(false);
  const contentIsDirty = useRef(false);
  const updateHandler = useRef(onUpdate);
  const titleSaveQueued = useRef<string | null>(null);
  const contentSaveQueued = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const flushDraftOnUnmount = useRef(true);

  useEffect(() => {
    updateHandler.current = onUpdate;
  }, [onUpdate]);

  const enqueueUpdate = useCallback((update: DmScratchpadUpdate) => {
    const operation = saveQueue.current.then(async () => {
      await updateHandler.current(update);
    });

    // Keep the queue usable after a failed request. The individual operation
    // still rejects so its caller can preserve the dirty state.
    saveQueue.current = operation.catch(() => undefined);
    return operation;
  }, []);

  useEffect(() => {
    if (!titleIsDirty.current) {
      const nextTitle = scratchpad.title || "Scratchpad";
      latestTitle.current = nextTitle;
      setLocalTitle(nextTitle);
    }
  }, [scratchpad.title]);

  useEffect(() => {
    if (!contentIsDirty.current) {
      latestContent.current = scratchpad.content;
      setLocalContent(scratchpad.content);
    }
  }, [scratchpad.content]);

  useEffect(() => {
    if (!contentIsDirty.current) {
      return;
    }

    const contentToSave = localContent;
    const timer = window.setTimeout(async () => {
      contentSaveQueued.current = contentToSave;
      try {
        await enqueueUpdate({ id: scratchpad.id, content: contentToSave });
        if (latestContent.current === contentToSave) {
          contentIsDirty.current = false;
        }
      } catch {
        // Keep the draft marked dirty so a subsequent edit can retry the save.
      } finally {
        if (contentSaveQueued.current === contentToSave) {
          contentSaveQueued.current = null;
        }
      }
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [enqueueUpdate, localContent, scratchpad.id]);

  useEffect(() => {
    if (!titleIsDirty.current) {
      return;
    }

    const titleToSave = localTitle;
    const timer = window.setTimeout(async () => {
      titleSaveQueued.current = titleToSave;
      try {
        await enqueueUpdate({ id: scratchpad.id, title: titleToSave });
        if (latestTitle.current === titleToSave) {
          titleIsDirty.current = false;
        }
      } catch {
        // Keep the draft marked dirty so a subsequent edit can retry the save.
      } finally {
        if (titleSaveQueued.current === titleToSave) {
          titleSaveQueued.current = null;
        }
      }
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [enqueueUpdate, localTitle, scratchpad.id]);

  useEffect(() => {
    return () => {
      if (!flushDraftOnUnmount.current) {
        return;
      }

      if (
        titleIsDirty.current &&
        titleSaveQueued.current !== latestTitle.current
      ) {
        void enqueueUpdate({
          id: scratchpad.id,
          title: latestTitle.current,
        })
          .catch(() => undefined);
      }
      if (
        contentIsDirty.current &&
        contentSaveQueued.current !== latestContent.current
      ) {
        void enqueueUpdate({
          id: scratchpad.id,
          content: latestContent.current,
        })
          .catch(() => undefined);
      }
    };
  }, [enqueueUpdate, scratchpad.id]);

  const handleTitleChange = (value: string) => {
    latestTitle.current = value;
    titleIsDirty.current = true;
    setLocalTitle(value);
  };

  const handleContentChange = (value: string) => {
    latestContent.current = value;
    contentIsDirty.current = true;
    setLocalContent(value);
  };

  const titleInputId = `scratchpad-title-${scratchpad.id}`;
  const contentInputId = `scratchpad-content-${scratchpad.id}`;

  return (
    <Card
      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      data-testid={`card-scratchpad-${scratchpad.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {isEditingTitle ? (
            <Input
              id={titleInputId}
              aria-label="Scratchpad title"
              value={localTitle}
              onChange={(event) => handleTitleChange(event.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="text-lg font-semibold"
              data-testid={`input-scratchpad-title-${scratchpad.id}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-left text-lg font-semibold leading-none tracking-tight text-spiritual-700 dark:text-spiritual-400 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid={`title-scratchpad-${scratchpad.id}`}
              aria-label={`Edit ${localTitle || "scratchpad"} title`}
            >
              {localTitle || "Scratchpad"}
            </button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={async () => {
              flushDraftOnUnmount.current = false;
              try {
                await onDelete(scratchpad.id);
              } catch {
                flushDraftOnUnmount.current = true;
              }
            }}
            aria-label={`Delete ${localTitle || "scratchpad"}`}
            data-testid={`button-delete-scratchpad-${scratchpad.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <label htmlFor={contentInputId} className="sr-only">
          {localTitle || "Scratchpad"} notes
        </label>
        <Textarea
          id={contentInputId}
          value={localContent}
          onChange={(event) => handleContentChange(event.target.value)}
          placeholder="Enter your notes here..."
          rows={8}
          className="bg-white dark:bg-gray-700 resize-none"
          data-testid={`textarea-scratchpad-${scratchpad.id}`}
        />
      </CardContent>
    </Card>
  );
}
