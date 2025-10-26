import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, Image, Table, Type, X, Upload, Camera } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GlossaryTerm } from "@shared/schema";

interface ExpandedTooltipDialogProps {
  open: boolean;
  onClose: () => void;
  term: GlossaryTerm;
  characterId: string;
}

interface ContentBlock {
  id: string;
  type: 'text' | 'table' | 'image';
  content: any;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

export default function ExpandedTooltipDialog({ 
  open, 
  onClose, 
  term, 
  characterId 
}: ExpandedTooltipDialogProps) {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [editedDefinition, setEditedDefinition] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse expanded content only when dialog opens or term changes
  // Don't reload while editing to prevent losing changes
  useEffect(() => {
    if (open && !isEditing) {
      if (term.expandedContent) {
        try {
          const parsed = JSON.parse(term.expandedContent);
          setContentBlocks(parsed.blocks || []);
        } catch {
          setContentBlocks([]);
        }
      } else {
        setContentBlocks([]);
      }
      // Also set the definition when opening
      setEditedDefinition(term.definition);
    }
  }, [open, term.id, isEditing, term.definition]);

  // Handle graceful closing with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 350); // Slightly longer than animation duration
  }, [onClose]);

  const updateTerm = useMutation({
    mutationFn: async (data: Partial<GlossaryTerm>) => {
      const response = await apiRequest("PUT", `/api/glossary/${term.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "glossary"] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Enhanced tooltip content saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save enhanced content",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    const expandedContent = JSON.stringify({ blocks: contentBlocks });
    await updateTerm.mutateAsync({
      definition: editedDefinition,
      expandedContent,
      hasExpandedContent: contentBlocks.length > 0
    });
  };

  const addContentBlock = (type: 'text' | 'table' | 'image') => {
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      content: type === 'text' ? '' : 
               type === 'table' ? { headers: ['Column 1'], rows: [['Row 1']] } :
               { url: '', alt: '', caption: '', file: null }
    };
    setContentBlocks([...contentBlocks, newBlock]);
  };

  const handleImageUpload = async (blockId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      const imageUrl = result.url;
      
      setContentBlocks(blocks => 
        blocks.map(block => 
          block.id === blockId 
            ? { ...block, content: { ...block.content, url: imageUrl, file: null } }
            : block
        )
      );
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateContentBlock = (id: string, content: any) => {
    setContentBlocks(blocks => 
      blocks.map(block => 
        block.id === id ? { ...block, content } : block
      )
    );
  };

  const removeContentBlock = (id: string) => {
    setContentBlocks(blocks => blocks.filter(block => block.id !== id));
  };

  const renderContentBlock = (block: ContentBlock, isEditing: boolean) => {
    switch (block.type) {
      case 'text':
        return isEditing ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Text Content</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeContentBlock(block.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Textarea
              value={block.content}
              onChange={(e) => updateContentBlock(block.id, e.target.value)}
              placeholder="Enter detailed text content..."
              rows={4}
              className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
        ) : (
          <div className="whitespace-pre-line text-gray-700 dark:text-gray-300">
            {block.content}
          </div>
        );

      case 'table':
        const tableData = block.content as TableData;
        return isEditing ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Table</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeContentBlock(block.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Headers */}
            <div className="space-y-2">
              <Label className="text-sm">Headers</Label>
              <div className="flex gap-2 flex-wrap">
                {tableData.headers.map((header, index) => (
                  <Input
                    key={index}
                    value={header}
                    onChange={(e) => {
                      const newHeaders = [...tableData.headers];
                      newHeaders[index] = e.target.value;
                      updateContentBlock(block.id, { ...tableData, headers: newHeaders });
                    }}
                    className="flex-1 min-w-32"
                    placeholder={`Header ${index + 1}`}
                  />
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newHeaders = [...tableData.headers, `Column ${tableData.headers.length + 1}`];
                    const newRows = tableData.rows.map(row => [...row, '']);
                    updateContentBlock(block.id, { headers: newHeaders, rows: newRows });
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-2">
              <Label className="text-sm">Rows</Label>
              {tableData.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-2">
                  {row.map((cell, cellIndex) => (
                    <Input
                      key={cellIndex}
                      value={cell}
                      onChange={(e) => {
                        const newRows = [...tableData.rows];
                        newRows[rowIndex][cellIndex] = e.target.value;
                        updateContentBlock(block.id, { ...tableData, rows: newRows });
                      }}
                      className="flex-1"
                      placeholder={`R${rowIndex + 1}C${cellIndex + 1}`}
                    />
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newRows = tableData.rows.filter((_, i) => i !== rowIndex);
                      updateContentBlock(block.id, { ...tableData, rows: newRows });
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newRow = new Array(tableData.headers.length).fill('');
                  updateContentBlock(block.id, { ...tableData, rows: [...tableData.rows, newRow] });
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Row
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  {tableData.headers.map((header, index) => (
                    <th
                      key={index}
                      className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-medium"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border border-gray-300 dark:border-gray-600 px-4 py-2"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'image':
        const imageData = block.content;
        return isEditing ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Image</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeContentBlock(block.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div>
                <Label htmlFor={`image-url-${block.id}`}>Image URL or Upload</Label>
                <div className="flex gap-2">
                  <Input
                    id={`image-url-${block.id}`}
                    value={imageData.url}
                    onChange={(e) => updateContentBlock(block.id, { ...imageData, url: e.target.value })}
                    placeholder="https://example.com/image.jpg or upload below"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          handleImageUpload(block.id, file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor={`image-alt-${block.id}`}>Alt Text</Label>
                <Input
                  id={`image-alt-${block.id}`}
                  value={imageData.alt}
                  onChange={(e) => updateContentBlock(block.id, { ...imageData, alt: e.target.value })}
                  placeholder="Description of the image"
                />
              </div>
              <div>
                <Label htmlFor={`image-caption-${block.id}`}>Caption (optional)</Label>
                <Input
                  id={`image-caption-${block.id}`}
                  value={imageData.caption}
                  onChange={(e) => updateContentBlock(block.id, { ...imageData, caption: e.target.value })}
                  placeholder="Image caption"
                />
              </div>
            </div>
            {imageData.url && (
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={imageData.url}
                  alt={imageData.alt}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {imageData.url && (
              <img
                src={imageData.url}
                alt={imageData.alt}
                className="max-w-full h-auto rounded-lg"
              />
            )}
            {imageData.caption && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center italic">
                {imageData.caption}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open && !isClosing} 
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          handleClose();
        }
      }}
      modal={true}
    >
      <DialogContent 
        className={`max-w-6xl max-h-[95vh] overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-all duration-300 ${isClosing ? 'animate-out fade-out-0 zoom-out-95 slide-out-to-top-[48%]' : ''}`}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-300">
              {term.keyword}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enhanced tooltip content for {term.keyword} with rich text, tables, and images
            </DialogDescription>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={updateTerm.isPending}
                    className="bg-spiritual-600 hover:bg-spiritual-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset to original content
                      if (term.expandedContent) {
                        try {
                          const parsed = JSON.parse(term.expandedContent);
                          setContentBlocks(parsed.blocks || []);
                        } catch {
                          setContentBlocks([]);
                        }
                      }
                      // Also reset the definition
                      setEditedDefinition(term.definition);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400"
                >
                  Edit Enhanced Content
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Definition */}
          <Card>
            <CardContent className="p-4 bg-gray-50 dark:bg-gray-800">
              <h3 className="font-semibold mb-2 text-spiritual-600 dark:text-spiritual-400">
                Basic Definition
              </h3>
              {isEditing ? (
                <Textarea
                  value={editedDefinition}
                  onChange={(e) => setEditedDefinition(e.target.value)}
                  placeholder="Enter basic definition..."
                  rows={3}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 relative z-10"
                  data-testid="textarea-basic-definition"
                  autoFocus
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {term.definition}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-spiritual-600 dark:text-spiritual-400">
                Enhanced Content
              </h3>
              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addContentBlock('text')}
                  >
                    <Type className="w-4 h-4 mr-2" />
                    Add Text
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addContentBlock('table')}
                  >
                    <Table className="w-4 h-4 mr-2" />
                    Add Table
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addContentBlock('image')}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Add Image
                  </Button>
                </div>
              )}
            </div>

            {contentBlocks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {isEditing 
                      ? "No enhanced content yet. Use the buttons above to add tables, images, or detailed text."
                      : "No enhanced content available for this term yet."
                    }
                  </p>
                  {!isEditing && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400"
                    >
                      Create Enhanced Content
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {contentBlocks.map((block) => (
                  <Card key={block.id}>
                    <CardContent className="p-4 bg-gray-50 dark:bg-gray-800">
                      {renderContentBlock(block, isEditing)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}