import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ImageStore } from "./image-store";

function uploadedFile(buffer: Buffer): Express.Multer.File {
  return {
    fieldname: "image",
    originalname: "untrusted.svg",
    encoding: "7bit",
    mimetype: "image/svg+xml",
    size: buffer.length,
    destination: "",
    filename: "",
    path: "",
    buffer,
    stream: undefined as never,
  };
}

test("image storage derives a safe extension from bytes and blocks traversal", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "spiritual-arts-images-"));
  const store = new ImageStore(root);
  try {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const url = await store.save("images", "image", uploadedFile(pngHeader));
    assert.match(url, /^\/uploads\/images\/image-[\w-]+\.png$/);
    assert.equal(await store.exists(url, "images"), true);
    assert.equal(await store.remove("/uploads/images/../../outside.txt", "images"), false);
    assert.equal(await store.remove(url, "images"), true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("image storage rejects content whose bytes are not an allowed raster format", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "spiritual-arts-images-"));
  try {
    const store = new ImageStore(root);
    await assert.rejects(
      () => store.save("images", "image", uploadedFile(Buffer.from("<svg></svg>"))),
      /Only PNG, JPEG, GIF, and WebP/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
