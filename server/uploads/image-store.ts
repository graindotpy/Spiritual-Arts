import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import multer from "multer";
import { badRequest } from "../http/errors";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type ImageKind = "images" | "portraits";
type RasterExtension = ".gif" | ".jpg" | ".png" | ".webp";

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

function isPathInside(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class ImageStore {
  readonly rootDirectory: string;

  constructor(rootDirectory = path.join(process.cwd(), "uploads")) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async save(kind: ImageKind, prefix: "image" | "portrait", file: Express.Multer.File): Promise<string> {
    const extension = detectRasterExtension(file.buffer);
    if (!extension) {
      throw badRequest("Only PNG, JPEG, GIF, and WebP image files are allowed");
    }

    const directory = this.directoryFor(kind);
    await fs.mkdir(directory, { recursive: true });

    const filename = `${prefix}-${randomUUID()}${extension}`;
    const filePath = path.join(directory, filename);
    await fs.writeFile(filePath, file.buffer, { flag: "wx" });

    return `/uploads/${kind}/${filename}`;
  }

  async exists(publicUrl: string, kind: ImageKind): Promise<boolean | undefined> {
    const filePath = this.resolvePublicUrl(publicUrl, kind);
    if (!filePath) {
      return undefined;
    }

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(publicUrl: string, kind: ImageKind): Promise<boolean> {
    const filePath = this.resolvePublicUrl(publicUrl, kind);
    if (!filePath) {
      return false;
    }

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  private directoryFor(kind: ImageKind): string {
    return path.join(this.rootDirectory, kind);
  }

  private resolvePublicUrl(publicUrl: string, kind: ImageKind): string | undefined {
    const prefix = `/uploads/${kind}/`;
    if (!publicUrl.startsWith(prefix)) {
      return undefined;
    }

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
