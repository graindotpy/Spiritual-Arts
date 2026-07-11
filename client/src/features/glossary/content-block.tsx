import { Camera, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContentBlock } from "@shared/enhanced-content";

interface ContentBlockEditorProps {
  block: ContentBlock;
  isEditing: boolean;
  onChange: (content: ContentBlock["content"]) => void;
  onRemove: () => void;
  onImageUpload: (file: File) => void;
}

function RemoveBlockButton({ onRemove }: { onRemove: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onRemove}
      className="h-8 w-8 text-red-600 hover:text-red-800"
      aria-label="Remove content block"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function ContentBlockEditor({
  block,
  isEditing,
  onChange,
  onRemove,
  onImageUpload,
}: ContentBlockEditorProps) {
  if (block.type === "text") {
    if (!isEditing) {
      return <div className="whitespace-pre-line text-gray-700 dark:text-gray-300">{block.content}</div>;
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`text-block-${block.id}`}>Text Content</Label>
          <RemoveBlockButton onRemove={onRemove} />
        </div>
        <Textarea
          id={`text-block-${block.id}`}
          value={block.content}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter detailed text content…"
          rows={4}
        />
      </div>
    );
  }

  if (block.type === "table") {
    const table = block.content;
    if (!isEditing) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                {table.headers.map((header, index) => (
                  <th key={index} className="border border-gray-300 px-4 py-2 text-left dark:border-gray-600">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border border-gray-300 px-4 py-2 dark:border-gray-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Table</Label>
          <RemoveBlockButton onRemove={onRemove} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Headers</legend>
          <div className="flex flex-wrap gap-2">
            {table.headers.map((header, index) => (
              <Input
                key={index}
                value={header}
                onChange={(event) =>
                  onChange({
                    ...table,
                    headers: table.headers.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  })
                }
                className="min-w-32 flex-1"
                aria-label={`Header ${index + 1}`}
              />
            ))}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() =>
                onChange({
                  headers: [...table.headers, `Column ${table.headers.length + 1}`],
                  rows: table.rows.map((row) => [...row, ""]),
                })
              }
              aria-label="Add table column"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Rows</legend>
          {table.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {row.map((cell, cellIndex) => (
                <Input
                  key={cellIndex}
                  value={cell}
                  onChange={(event) =>
                    onChange({
                      ...table,
                      rows: table.rows.map((candidateRow, candidateRowIndex) =>
                        candidateRowIndex === rowIndex
                          ? candidateRow.map((candidateCell, candidateCellIndex) =>
                              candidateCellIndex === cellIndex ? event.target.value : candidateCell,
                            )
                          : candidateRow,
                      ),
                    })
                  }
                  aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`}
                />
              ))}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onChange({ ...table, rows: table.rows.filter((_, index) => index !== rowIndex) })
                }
                aria-label={`Remove row ${rowIndex + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...table,
                rows: [...table.rows, new Array(table.headers.length).fill("")],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </fieldset>
      </div>
    );
  }

  const image = block.content;
  if (!isEditing) {
    return (
      <figure className="space-y-2">
        {image.url && <img src={image.url} alt={image.alt} className="h-auto max-w-full rounded-lg" />}
        {image.caption && (
          <figcaption className="text-center text-sm italic text-gray-600 dark:text-gray-400">
            {image.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Image</Label>
        <RemoveBlockButton onRemove={onRemove} />
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor={`image-url-${block.id}`}>Image URL or Upload</Label>
          <div className="flex gap-2">
            <Input
              id={`image-url-${block.id}`}
              value={image.url}
              onChange={(event) => onChange({ ...image, url: event.target.value })}
              placeholder="https://example.com/image.jpg"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/png,image/jpeg,image/gif,image/webp";
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (file) onImageUpload(file);
                };
                input.click();
              }}
              aria-label="Upload image"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor={`image-alt-${block.id}`}>Alt Text</Label>
          <Input
            id={`image-alt-${block.id}`}
            value={image.alt}
            onChange={(event) => onChange({ ...image, alt: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`image-caption-${block.id}`}>Caption (optional)</Label>
          <Input
            id={`image-caption-${block.id}`}
            value={image.caption}
            onChange={(event) => onChange({ ...image, caption: event.target.value })}
          />
        </div>
      </div>
      {image.url && <img src={image.url} alt={image.alt} className="h-48 w-full rounded-lg object-cover" />}
    </div>
  );
}
