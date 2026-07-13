import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Image, Pencil, Save, Table, Type, type LucideIcon } from "lucide-react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ContentBlockEditor } from "@/features/glossary/content-block";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/api";
import {
  createContentBlock,
  hasMeaningfulEnhancedContent,
  parseEnhancedContent,
  serializeEnhancedContent,
  type ContentBlock,
  type ContentBlockType,
} from "@shared/enhanced-content";

export interface EnhancedContentSaveData {
  summary: string;
  expandedContent: string;
  hasExpandedContent: boolean;
}

interface EnhancedContentDialogProps {
  open: boolean;
  onClose: () => void;
  recordKey: string;
  title: string;
  eyebrow: string;
  description: string;
  summaryTitle: string;
  summary: string;
  expandedContent: string | null;
  imageUrl?: string | null;
  imageAlt?: string;
  icon?: LucideIcon;
  canEdit?: boolean;
  onSave?: (data: EnhancedContentSaveData) => Promise<unknown>;
}

export function EnhancedContentDialog({
  open,
  onClose,
  recordKey,
  title,
  eyebrow,
  description,
  summaryTitle,
  summary,
  expandedContent,
  imageUrl,
  imageAlt = "",
  icon: Icon = BookOpen,
  canEdit = false,
  onSave,
}: EnhancedContentDialogProps) {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(summary);
  const [isSaving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || isEditing) return;
    setContentBlocks(parseEnhancedContent(expandedContent));
    setEditedSummary(summary);
  }, [open, recordKey, summary, expandedContent, isEditing]);

  const resetDraft = () => {
    setContentBlocks(parseEnhancedContent(expandedContent));
    setEditedSummary(summary);
    setIsEditing(false);
  };

  const save = async () => {
    if (!onSave || !editedSummary.trim()) return;
    setSaving(true);
    try {
      await onSave({
        summary: editedSummary.trim(),
        expandedContent: serializeEnhancedContent(contentBlocks),
        hasExpandedContent: hasMeaningfulEnhancedContent(contentBlocks),
      });
      setIsEditing(false);
    } catch {
      // The record adapter owns its error toast; keep the draft open for retry.
    } finally {
      setSaving(false);
    }
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

  const moveBlock = (id: string, direction: -1 | 1) => {
    setContentBlocks((blocks) => {
      const currentIndex = blocks.findIndex((block) => block.id === id);
      const nextIndex = currentIndex + direction;

      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= blocks.length) {
        return blocks;
      }

      const reorderedBlocks = [...blocks];
      [reorderedBlocks[currentIndex], reorderedBlocks[nextIndex]] = [
        reorderedBlocks[nextIndex],
        reorderedBlocks[currentIndex],
      ];
      return reorderedBlocks;
    });
  };

  const uploadImage = async (blockId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { url } = await requestJson<{ url: string }>("POST", "/api/upload/image", formData);
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
        if (!nextOpen && !isSaving) {
          resetDraft();
          onClose();
        }
      }}
    >
      <CampaignDialogContent className="max-w-6xl">
        <CampaignDialogHeader
          icon={Icon}
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={
            canEdit && onSave ? (
              isEditing ? (
                <>
                  <Button
                    type="button"
                    onClick={resetDraft}
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    className="wuxia-secondary-action"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void save()}
                    size="sm"
                    disabled={isSaving || !editedSummary.trim()}
                    className="wuxia-primary-action"
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="wuxia-secondary-action"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit entry
                </Button>
              )
            ) : undefined
          }
        />

        <CampaignDialogBody className="space-y-7">
          {imageUrl && (
            <div className="wuxia-dialog-section mx-auto flex w-full max-w-2xl justify-center overflow-hidden p-2 sm:p-3">
              <img
                src={imageUrl}
                alt={imageAlt}
                className="block h-auto max-h-[min(36dvh,20rem)] max-w-full rounded-[0.3rem] object-contain"
              />
            </div>
          )}

          <section className="wuxia-dialog-section p-4 sm:p-5" aria-labelledby={`summary-${recordKey}`}>
            <p className="wuxia-dialog-kicker">At a glance</p>
            <h3 id={`summary-${recordKey}`} className="font-display mb-3 text-xl text-[#31594d] dark:text-[#e2ca9b]">
              {summaryTitle}
            </h3>
            {isEditing ? (
              <Textarea
                value={editedSummary}
                onChange={(event) => setEditedSummary(event.target.value)}
                rows={4}
                aria-label={summaryTitle}
                className="wuxia-dialog-control"
              />
            ) : (
              <p className="whitespace-pre-line text-sm leading-7 text-[#526059] dark:text-[#c8bba4]">
                {editedSummary}
              </p>
            )}
          </section>

          <section className="space-y-4" aria-labelledby={`enhanced-content-${recordKey}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="wuxia-dialog-kicker">Further details</p>
                <h3 id={`enhanced-content-${recordKey}`} className="font-display text-xl text-[#2b4138] dark:text-[#eadcc2]">
                  Expanded notes
                </h3>
              </div>
              {isEditing && (
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                  <Button type="button" size="sm" variant="outline" onClick={() => addBlock("text")} className="wuxia-add-row">
                    <Type className="mr-1.5 h-3.5 w-3.5" /> Text
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addBlock("table")} className="wuxia-add-row">
                    <Table className="mr-1.5 h-3.5 w-3.5" /> Table
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addBlock("image")} className="wuxia-add-row">
                    <Image className="mr-1.5 h-3.5 w-3.5" /> Image
                  </Button>
                </div>
              )}
            </div>

            {contentBlocks.length === 0 ? (
              <div className="wuxia-dialog-section wuxia-dialog-section-muted p-8 text-center">
                <BookOpen className="mx-auto mb-3 h-7 w-7 text-[#75867d] dark:text-[#aa936b]" />
                <p className="font-display text-lg text-[#3d554b] dark:text-[#decbaa]">
                  {isEditing ? "This page is ready for notes" : "No expanded notes yet"}
                </p>
                <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[#74766e] dark:text-[#aa9d86]">
                  {isEditing
                    ? "Add a rich text, table, or image block using the controls above."
                    : "The summary above is the complete reference for now."}
                </p>
                {!isEditing && canEdit && onSave && (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="wuxia-secondary-action mt-5">
                    <Pencil className="mr-2 h-4 w-4" /> Add expanded notes
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {contentBlocks.map((block, index) => (
                  <article key={block.id} className="wuxia-dialog-section p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="wuxia-dialog-kicker">Reference block {index + 1}</p>
                      {isEditing && (
                        <div className="flex gap-1" aria-label={`Reorder reference block ${index + 1}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveBlock(block.id, -1)}
                            disabled={index === 0}
                            aria-label={`Move reference block ${index + 1} up`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => moveBlock(block.id, 1)}
                            disabled={index === contentBlocks.length - 1}
                            aria-label={`Move reference block ${index + 1} down`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <ContentBlockEditor
                      block={block}
                      isEditing={isEditing}
                      onChange={(content) => updateBlock(block.id, content)}
                      onRemove={() => setContentBlocks((blocks) => blocks.filter((item) => item.id !== block.id))}
                      onImageUpload={(file) => void uploadImage(block.id, file)}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        </CampaignDialogBody>
      </CampaignDialogContent>
    </Dialog>
  );
}
