import { useEffect, useState } from "react";
import { Image, Save, Table, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ContentBlockEditor } from "@/features/glossary/content-block";
import { useGlossaryMutations, type GlossaryScope } from "@/hooks/use-glossary";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/api";
import {
  createContentBlock,
  parseEnhancedContent,
  serializeEnhancedContent,
  type ContentBlock,
  type ContentBlockType,
} from "@shared/enhanced-content";
import type { DmGlossaryTerm, GlossaryTerm } from "@shared/schema";

interface ExpandedTooltipDialogProps {
  open: boolean;
  onClose: () => void;
  term: GlossaryTerm | DmGlossaryTerm;
  entityId: string;
  scope: GlossaryScope;
}

export default function ExpandedTooltipDialog({
  open,
  onClose,
  term,
  entityId,
  scope,
}: ExpandedTooltipDialogProps) {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState(term.definition);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || isEditing) return;
    setContentBlocks(parseEnhancedContent(term.expandedContent));
    setEditedDefinition(term.definition);
  }, [open, term.definition, term.expandedContent, term.id]);

  const { updateTerm } = useGlossaryMutations(
    scope,
    entityId,
    () => toast({ title: "Enhanced content saved" }),
    () => toast({ title: "Enhanced content could not be saved", variant: "destructive" }),
  );

  const resetDraft = () => {
    setContentBlocks(parseEnhancedContent(term.expandedContent));
    setEditedDefinition(term.definition);
    setIsEditing(false);
  };

  const save = async () => {
    await updateTerm.mutateAsync({
      termId: term.id,
      update: {
        definition: editedDefinition.trim(),
        expandedContent: serializeEnhancedContent(contentBlocks),
        hasExpandedContent: contentBlocks.length > 0,
      },
    });
    setIsEditing(false);
  };

  const addBlock = (type: ContentBlockType) => {
    setContentBlocks((blocks) => [...blocks, createContentBlock(type)]);
  };

  const updateBlock = (id: string, content: ContentBlock["content"]) => {
    setContentBlocks((blocks) =>
      blocks.map((block) =>
        block.id === id ? ({ ...block, content } as ContentBlock) : block,
      ),
    );
  };

  const uploadImage = async (blockId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { url } = await requestJson<{ url: string }>(
        "POST",
        "/api/upload/image",
        formData,
      );
      setContentBlocks((blocks) =>
        blocks.map((block) =>
          block.id === blockId && block.type === "image"
            ? { ...block, content: { ...block.content, url } }
            : block,
        ),
      );
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetDraft();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-300">
                {term.keyword}
              </DialogTitle>
              <DialogDescription>
                Basic definition and optional rich reference content.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={save} disabled={updateTerm.isPending || !editedDefinition.trim()}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateTerm.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={resetDraft} disabled={updateTerm.isPending}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  Edit Enhanced Content
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="bg-gray-50 p-4 dark:bg-gray-800">
              <h3 className="mb-2 font-semibold text-spiritual-600 dark:text-spiritual-400">
                Basic Definition
              </h3>
              {isEditing ? (
                <Textarea
                  value={editedDefinition}
                  onChange={(event) => setEditedDefinition(event.target.value)}
                  rows={3}
                  aria-label="Basic definition"
                  data-testid="textarea-basic-definition"
                />
              ) : (
                <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                  {term.definition}
                </p>
              )}
            </CardContent>
          </Card>

          <section className="space-y-4" aria-labelledby={`enhanced-content-${term.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3
                id={`enhanced-content-${term.id}`}
                className="font-semibold text-spiritual-600 dark:text-spiritual-400"
              >
                Enhanced Content
              </h3>
              {isEditing && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => addBlock("text")}>
                    <Type className="mr-2 h-4 w-4" />
                    Add Text
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("table")}>
                    <Table className="mr-2 h-4 w-4" />
                    Add Table
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addBlock("image")}>
                    <Image className="mr-2 h-4 w-4" />
                    Add Image
                  </Button>
                </div>
              )}
            </div>

            {contentBlocks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p className="mb-4">
                    {isEditing
                      ? "No enhanced content yet. Add a text, table, or image block."
                      : "No enhanced content is available for this term yet."}
                  </p>
                  {!isEditing && (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      Create Enhanced Content
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {contentBlocks.map((block) => (
                  <Card key={block.id}>
                    <CardContent className="bg-gray-50 p-4 dark:bg-gray-800">
                      <ContentBlockEditor
                        block={block}
                        isEditing={isEditing}
                        onChange={(content) => updateBlock(block.id, content)}
                        onRemove={() =>
                          setContentBlocks((blocks) => blocks.filter((item) => item.id !== block.id))
                        }
                        onImageUpload={(file) => uploadImage(block.id, file)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
