import { Camera, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { richTextContentToPlainText, type ContentBlock } from "@shared/enhanced-content";

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
      className="wuxia-icon-action wuxia-icon-danger h-8 w-8"
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
    const textValue = typeof block.content === "string" ? block.content : richTextContentToPlainText(block.content);

    if (!isEditing) {
      return (
        <div className="whitespace-pre-line text-sm leading-7 text-[#55615b] dark:text-[#c7baa3]">
          {textValue || "No text content yet."}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="wuxia-dialog-label mb-0">
            Text content
          </Label>
          <RemoveBlockButton onRemove={onRemove} />
        </div>
        <Textarea
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter detailed text content…"
          aria-label="Text content"
          rows={6}
          className="wuxia-dialog-control min-h-32"
        />
      </div>
    );
  }

  if (block.type === "table") {
    const table = block.content;
    if (!isEditing) {
      return (
        <div className="overflow-x-auto">
          <table className="wuxia-content-table w-full border-collapse border text-sm">
            <thead>
              <tr>
                {table.headers.map((header, index) => (
                  <th key={index} className="border px-4 py-2.5 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border px-4 py-2.5 text-[#55615b] dark:text-[#c7baa3]"
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
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="wuxia-dialog-label mb-0">Table</Label>
          <RemoveBlockButton onRemove={onRemove} />
        </div>

        <fieldset className="space-y-2">
          <legend className="wuxia-dialog-label">Headers</legend>
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
                className="wuxia-dialog-control min-w-32 flex-1"
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
              className="wuxia-secondary-action shrink-0"
              aria-label="Add table column"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="wuxia-dialog-label">Rows</legend>
          {table.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
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
                                candidateCellIndex === cellIndex
                                  ? event.target.value
                                  : candidateCell,
                              )
                            : candidateRow,
                        ),
                      })
                    }
                    className="wuxia-dialog-control w-44"
                    aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`}
                  />
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      ...table,
                      rows: table.rows.filter((_, index) => index !== rowIndex),
                    })
                  }
                  className="wuxia-icon-action wuxia-icon-danger shrink-0"
                  aria-label={`Remove row ${rowIndex + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
            className="wuxia-add-row"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add row
          </Button>
        </fieldset>
      </div>
    );
  }

  const image = block.content;
  if (!isEditing) {
    return (
      <figure className="space-y-2">
        {image.url && (
          <img
            src={image.url}
            alt={image.alt}
            className="h-auto max-w-full rounded-sm border border-[#b8a98d]/70 dark:border-[#806b48]"
          />
        )}
        {image.caption && (
          <figcaption className="text-center font-display text-sm italic text-[#68716b] dark:text-[#ae9f86]">
            {image.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="wuxia-dialog-label mb-0">Image</Label>
        <RemoveBlockButton onRemove={onRemove} />
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor={`image-url-${block.id}`} className="wuxia-dialog-label">
            Image URL or upload
          </Label>
          <div className="flex gap-2">
            <Input
              id={`image-url-${block.id}`}
              value={image.url}
              onChange={(event) => onChange({ ...image, url: event.target.value })}
              placeholder="https://example.com/image.jpg"
              className="wuxia-dialog-control"
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
              className="wuxia-secondary-action shrink-0"
              aria-label="Upload image"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor={`image-alt-${block.id}`} className="wuxia-dialog-label">
            Alt text
          </Label>
          <Input
            id={`image-alt-${block.id}`}
            value={image.alt}
            onChange={(event) => onChange({ ...image, alt: event.target.value })}
            className="wuxia-dialog-control"
          />
        </div>
        <div>
          <Label htmlFor={`image-caption-${block.id}`} className="wuxia-dialog-label">
            Caption <span className="normal-case tracking-normal">(optional)</span>
          </Label>
          <Input
            id={`image-caption-${block.id}`}
            value={image.caption}
            onChange={(event) => onChange({ ...image, caption: event.target.value })}
            className="wuxia-dialog-control"
          />
        </div>
      </div>
      {image.url && (
        <img
          src={image.url}
          alt={image.alt}
          className="h-48 w-full rounded-sm border border-[#b8a98d]/70 object-cover dark:border-[#806b48]"
        />
      )}
    </div>
  );
}
