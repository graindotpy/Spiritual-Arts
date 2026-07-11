import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import multer from "multer";
import { badRequest } from "../http/errors";
import {
  deleteFromR2,
  getR2Configuration,
  getR2ObjectKey,
  uploadToR2,
} from "../r2";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type ImageKind = "card-images" | "images" | "portraits";
type ImagePrefix = "image" | "portrait";
type RasterExtension = ".gif" | ".jpg" | ".png" | ".webp";

interface PreparedImage {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export interface RasterImageFormat {
  contentType: string;
  extension: RasterExtension;
}

interface ImageBackend {
  save(kind: ImageKind, image: PreparedImage): Promise<string>;
  exists(publicUrl: string, kind: ImageKind): Promise<boolean | undefined>;
  remove(publicUrl: string, kind: ImageKind): Promise<boolean>;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
});

export const imageUpload = upload.single("image");
export const portraitUpload = upload.single("portrait");

function hasBytes(buffer: Buffer, expected: readonly number[], offset = 0): boolean {
  return expected.every((byte, index) => buffer[offset + index] === byte);
}

function detectRasterExtension(buffer: Buffer): RasterExtension | undefined {
  if (hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ".png";
  }

  if (hasBytes(buffer, [0xff, 0xd8, 0xff])) {
    return ".jpg";
  }

  const signature = buffer.subarray(0, 6).toString("ascii");
  if (signature === "GIF87a" || signature === "GIF89a") {
    return ".gif";
  }

  if (
    hasBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return ".webp";
  }

  return undefined;
}

function contentTypeFor(extension: RasterExtension): string {
  switch (extension) {
    case ".gif":
      return "image/gif";
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
  }
}

export function inspectRasterImage(buffer: Buffer): RasterImageFormat | undefined {
  const extension = detectRasterExtension(buffer);
  return extension
    ? { extension, contentType: contentTypeFor(extension) }
    : undefined;
}

function prepareImage(prefix: ImagePrefix, file: Express.Multer.File): PreparedImage {
  const format = inspectRasterImage(file.buffer);
  if (!format) {
    throw badRequest("Only PNG, JPEG, GIF, and WebP image files are allowed");
  }

  return {
    buffer: file.buffer,
    contentType: format.contentType,
    filename: `${prefix}-${randomUUID()}${format.extension}`,
  };
}

function isPathInside(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

class LocalImageBackend implements ImageBackend {
  constructor(private readonly rootDirectory: string) {}

  async save(kind: ImageKind, image: PreparedImage): Promise<string> {
    const directory = this.directoryFor(kind);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, image.filename), image.buffer, { flag: "wx" });
    return `/uploads/${kind}/${image.filename}`;
  }

  async exists(publicUrl: string, kind: ImageKind): Promise<boolean | undefined> {
    const filePath = this.resolvePublicUrl(publicUrl, kind);
    if (!filePath) return undefined;

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(publicUrl: string, kind: ImageKind): Promise<boolean> {
    const filePath = this.resolvePublicUrl(publicUrl, kind);
    if (!filePath) return false;

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private directoryFor(kind: ImageKind): string {
    return path.join(this.rootDirectory, kind);
  }

  private resolvePublicUrl(publicUrl: string, kind: ImageKind): string | undefined {
    const prefix = `/uploads/${kind}/`;
    if (!publicUrl.startsWith(prefix)) return undefined;

    let filename: string;
    try {
      filename = decodeURIComponent(publicUrl.slice(prefix.length));
    } catch {
      return undefined;
    }

    if (
      filename.length === 0 ||
      filename.includes("\0") ||
      path.basename(filename) !== filename
    ) {
      return undefined;
    }

    const directory = this.directoryFor(kind);
    const candidate = path.resolve(directory, filename);
    return isPathInside(directory, candidate) ? candidate : undefined;
  }
}

class R2ImageBackend implements ImageBackend {
  async save(kind: ImageKind, image: PreparedImage): Promise<string> {
    return uploadToR2({
      key: `${kind}/${image.filename}`,
      body: image.buffer,
      contentType: image.contentType,
    });
  }

  async exists(_publicUrl: string, _kind: ImageKind): Promise<boolean | undefined> {
    // Avoid an R2 network round trip: remote existence is not used for cleanup.
    return undefined;
  }

  async remove(publicUrl: string, kind: ImageKind): Promise<boolean> {
    if (!this.owns(publicUrl, kind)) return false;
    return deleteFromR2(publicUrl);
  }

  private owns(publicUrl: string, kind: ImageKind): boolean {
    const key = getR2ObjectKey(publicUrl);
    if (!key?.startsWith(`${kind}/`)) return false;
    const filename = key.slice(kind.length + 1);
    return filename.length > 0 && !filename.includes("/");
  }
}

export class ImageStore {
  readonly rootDirectory: string;
  readonly usesLocalStorage: boolean;
  private readonly backend: ImageBackend;

  /** Passing a root explicitly forces local storage, which is useful for tests and tools. */
  constructor(rootDirectory?: string) {
    this.rootDirectory = path.resolve(rootDirectory ?? path.join(process.cwd(), "uploads"));
    const useR2 = rootDirectory === undefined && getR2Configuration() !== undefined;
    this.usesLocalStorage = !useR2;
    this.backend = useR2
      ? new R2ImageBackend()
      : new LocalImageBackend(this.rootDirectory);
  }

  async save(
    kind: ImageKind,
    prefix: ImagePrefix,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.backend.save(kind, prepareImage(prefix, file));
  }

  exists(publicUrl: string, kind: ImageKind): Promise<boolean | undefined> {
    return this.backend.exists(publicUrl, kind);
  }

  remove(publicUrl: string, kind: ImageKind): Promise<boolean> {
    return this.backend.remove(publicUrl, kind);
  }
}
