import {
  Component,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Extensions, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  normalizeRichTextContent,
  type RichTextDocument,
} from "@shared/enhanced-content";

function createExtensions(openOnClick: boolean) {
  return [StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: {
      openOnClick,
      autolink: false,
      linkOnPaste: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    },
  })];
}

const editorExtensions = createExtensions(false);
export const richTextViewerExtensions = createExtensions(true);

interface RichTextErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
}

interface RichTextErrorBoundaryState {
  failed: boolean;
}

export class RichTextErrorBoundary extends Component<
  RichTextErrorBoundaryProps,
  RichTextErrorBoundaryState
> {
  state: RichTextErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RichTextErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Rich text editor failed; using the plain-text fallback.", error, errorInfo);
  }

  componentDidUpdate(previousProps: RichTextErrorBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface RichTextEditorProps {
  value: string | RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  label: string;
  placeholder?: string;
  expanded?: boolean;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = "Write expanded content…",
  expanded = false,
  disabled = false,
}: RichTextEditorProps) {
  const normalized = normalizeRichTextContent(value);
  const editor = useEditor({
    extensions: editorExtensions,
    content: normalized,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "wuxia-rich-text px-4 py-3 focus:outline-none transition-[min-height]",
          expanded ? "min-h-[28rem]" : "min-h-44",
        ),
        "aria-label": label,
        "aria-placeholder": placeholder,
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      try {
        onChange(currentEditor.getJSON() as RichTextDocument);
      } catch (error) {
        console.error("Rich text update could not be applied.", error);
      }
    },
  }, [expanded]);

  const serializedValue = JSON.stringify(normalized);
  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === serializedValue) return;
    editor.commands.setContent(normalized, { emitUpdate: false });
  }, [editor, serializedValue]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <div className="min-h-44 animate-pulse rounded-sm bg-black/5 dark:bg-white/[0.04]" />;
  }

  const buttonClass = "rich-text-toolbar-button h-8 min-w-8 px-2";
  const iconButton = "rich-text-toolbar-button h-8 w-8";
  const setLink = () => {
    const previous = String(editor.getAttributes("link").href ?? "");
    const entered = typeof window !== "undefined" && typeof window.prompt === "function"
      ? window.prompt("Enter a web or email address:", previous)
      : null;
    if (entered === null) return;
    if (!entered.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^(https?:\/\/|mailto:)/i.test(entered.trim())
      ? entered.trim()
      : `https://${entered.trim()}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const insertHorizontalRule = () => {
    const chain = editor.chain().focus();
    if (editor.isActive("blockquote")) chain.toggleBlockquote();
    if (editor.isActive("bulletList")) chain.toggleBulletList();
    if (editor.isActive("orderedList")) chain.toggleOrderedList();
    chain.setHorizontalRule().run();
  };

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-[0.4rem] border border-[var(--wuxia-dialog-line-strong)]",
        disabled && "pointer-events-none opacity-55",
      )}
      aria-disabled={disabled || undefined}
    >
      <div
        className="rich-text-toolbar flex flex-wrap items-center gap-1 border-b border-[var(--wuxia-dialog-line)] px-2 py-1.5"
        role="toolbar"
        aria-label="Text formatting"
      >
        {([1, 2, 3, 4] as const).map((level) => (
          <Button
            key={level}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(buttonClass, "text-xs font-semibold", editor.isActive("heading", { level }) && "is-active")}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            title={`Heading ${level}`}
            aria-label={`Heading ${level}`}
            aria-pressed={editor.isActive("heading", { level })}
          >
            H{level}
          </Button>
        ))}
        <span className="rich-text-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="Bold" active={editor.isActive("bold")} className={iconButton} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} className={iconButton} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive("underline")} className={iconButton} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} className={iconButton} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Inline code" active={editor.isActive("code")} className={iconButton} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label={editor.isActive("link") ? "Edit link" : "Add link"} active={editor.isActive("link")} className={iconButton} onClick={setLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="rich-text-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="Quote" active={editor.isActive("blockquote")} className={iconButton} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} className={iconButton} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} className={iconButton} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Horizontal rule" className={iconButton} onClick={insertHorizontalRule}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <span className="rich-text-toolbar-divider" aria-hidden="true" />
        <ToolbarButton label="Undo" className={iconButton} disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Redo" className={iconButton} disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  className,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(className, active && "is-active")}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
    >
      {children}
    </Button>
  );
}

export function RichTextContent({
  content,
  className,
  extensions = richTextViewerExtensions,
}: {
  content: string | JSONContent;
  className?: string;
  extensions?: Extensions;
}) {
  const normalizeViewerContent = (value: string | JSONContent): JSONContent =>
    typeof value === "string" ? normalizeRichTextContent(value) : value;

  const editor = useEditor({
    extensions,
    content: normalizeViewerContent(content),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: cn("wuxia-rich-text", className) },
    },
  }, [extensions]);

  const normalized = normalizeViewerContent(content);
  const serializedContent = JSON.stringify(normalized);
  useEffect(() => {
    if (!editor || JSON.stringify(editor.getJSON()) === serializedContent) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (
        cancelled ||
        editor.isDestroyed ||
        JSON.stringify(editor.getJSON()) === serializedContent
      ) {
        return;
      }
      editor.commands.setContent(normalized, { emitUpdate: false });
    });

    return () => {
      cancelled = true;
    };
  }, [editor, serializedContent]);

  return editor ? <EditorContent editor={editor} /> : null;
}
