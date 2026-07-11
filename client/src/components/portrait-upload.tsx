import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
      <DialogContent className={showCropEditor ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {showCropEditor ? "Crop Portrait" : "Character Portrait"}
          </DialogTitle>
          <DialogDescription>
            {showCropEditor 
              ? "Drag to position and zoom to fit your portrait perfectly"
              : "Upload and manage your character's portrait image"
            }
          </DialogDescription>
        </DialogHeader>

        {showCropEditor && previewUrl ? (
          <ImageCropEditor
            imageUrl={previewUrl}
            onSave={handleCropSave}
            onCancel={handleCropCancel}
          />
        ) : (
          <div className="space-y-4">
          {/* Current/Preview Portrait */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="Character portrait"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
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
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={isUploading || isDeleting}
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Image
            </Button>
          </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {currentPortraitUrl && (
                <Button
                  onClick={handleDelete}
                  disabled={isUploading || isDeleting}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? "Removing..." : "Remove Portrait"}
                </Button>
              )}

              <Button
                onClick={handleClose}
                variant="outline"
                disabled={isUploading || isDeleting}
                className={currentPortraitUrl ? "flex-1" : "w-full"}
              >
                Close
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Supported formats: JPG, PNG, GIF, WebP · Max size: 5 MB
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
