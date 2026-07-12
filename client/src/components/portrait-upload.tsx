import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { Camera, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import type { Character } from "@shared/schema";
import ImageCropEditor from "./image-crop-editor";

interface PortraitUploadProps {
  characterId: string;
  currentPortraitUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PortraitUpload({ characterId, currentPortraitUrl, isOpen, onClose }: PortraitUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Portrait must be smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create a local preview for the crop editor.
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
      setShowCropEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropSave = async (croppedImageBlob: Blob) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('portrait', croppedImageBlob, 'portrait.jpg');

      await requestJson<{ portraitUrl: string }>(
        "POST",
        `/api/character/${characterId}/portrait`,
        formData,
      );

      // Invalidate character queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: characterKeys.all });
      await queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) });

      toast({
        title: "Portrait uploaded",
        description: "Character portrait has been updated successfully",
      });

      handleClose();
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload portrait. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropEditor(false);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!currentPortraitUrl) return;

    setIsDeleting(true);
    try {
      await requestJson<Character>("DELETE", `/api/character/${characterId}/portrait`);

      // Invalidate character queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: characterKeys.all });
      await queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) });

      toast({
        title: "Portrait removed",
        description: "Character portrait has been removed",
      });

      onClose();
    } catch {
      toast({
        title: "Delete failed",
        description: "Failed to remove portrait. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setShowCropEditor(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const displayUrl = previewUrl || currentPortraitUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <CampaignDialogContent className={showCropEditor ? "sm:max-w-lg" : "sm:max-w-md"}>
        <CampaignDialogHeader
          icon={Camera}
          eyebrow="Character portrait"
          title={showCropEditor ? "Crop Portrait" : "Choose a Portrait"}
          description={
            showCropEditor
              ? "Drag to position and zoom to fit your portrait perfectly."
              : "Upload and manage your character's portrait image."
          }
        />

        {showCropEditor && previewUrl ? (
          <ImageCropEditor
            imageUrl={previewUrl}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        ) : (
          <>
            <CampaignDialogBody className="space-y-5">
              {/* Current/Preview Portrait */}
              <div className="wuxia-dialog-section flex justify-center p-6">
                <div className="wuxia-portrait-preview h-32 w-32 overflow-hidden rounded-full border-2">
                  {displayUrl ? (
                    <img
                      src={displayUrl}
                      alt="Character portrait"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Camera className="h-8 w-8 opacity-50" />
                    </div>
                  )}
                </div>
              </div>

              {/* File Input */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="wuxia-secondary-action w-full"
                  disabled={isUploading || isDeleting}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
              </div>

              {/* Help Text */}
              <p className="text-center text-xs text-[var(--wuxia-dialog-muted)]">
                Supported formats: JPG, PNG, GIF, WebP · Max size: 5 MB
              </p>
            </CampaignDialogBody>

            <CampaignDialogFooter className={currentPortraitUrl ? "sm:justify-between" : undefined}>
              {currentPortraitUrl && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={isUploading || isDeleting}
                  variant="destructive"
                  className="wuxia-danger-action w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? "Removing..." : "Remove Portrait"}
                </Button>
              )}

              <Button
                type="button"
                onClick={handleClose}
                variant="outline"
                disabled={isUploading || isDeleting}
                className="wuxia-secondary-action w-full sm:w-auto"
              >
                Close
              </Button>
            </CampaignDialogFooter>
          </>
        )}
      </CampaignDialogContent>
    </Dialog>
  );
}
