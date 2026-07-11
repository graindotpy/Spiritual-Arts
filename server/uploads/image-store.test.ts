import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getR2Configuration, getR2ObjectKey } from "../r2";
import { ImageStore } from "./image-store";

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

function preserveR2Environment(): () => void {
  const previous = Object.fromEntries(
    R2_KEYS.map((key) => [key, process.env[key]]),
  );
  return () => {
    R2_KEYS.forEach((key) => {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  };
}

function clearR2Environment(): void {
  R2_KEYS.forEach((key) => delete process.env[key]);
}

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
    const cardUrl = await store.save(
      "card-images",
      "image",
      uploadedFile(pngHeader),
    );
    assert.match(cardUrl, /^\/uploads\/card-images\/image-[\w-]+\.png$/);
    assert.equal(await store.exists(cardUrl, "card-images"), true);
    assert.equal(await store.remove(cardUrl, "images"), false);
    assert.equal(await store.remove(cardUrl, "card-images"), true);
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

test("partial R2 configuration fails instead of silently selecting local storage", () => {
  const restore = preserveR2Environment();

  try {
    clearR2Environment();
    process.env.R2_ACCOUNT_ID = "account";
    assert.throws(() => new ImageStore(), /R2 configuration is incomplete/);
  } finally {
    restore();
  }
});

test("R2 public URLs are normalized and only owned object keys are accepted", () => {
  const restore = preserveR2Environment();

  try {
    clearR2Environment();
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_ACCESS_KEY_ID = "access";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "bucket";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.test/assets///";

    assert.equal(
      getR2Configuration()?.publicBaseUrl,
      "https://cdn.example.test/assets",
    );
    assert.equal(
      getR2ObjectKey("https://cdn.example.test/assets/card-images/a%20b.png"),
      "card-images/a b.png",
    );
    assert.equal(
      getR2ObjectKey("https://cdn.example.test/other/card-images/a.png"),
      undefined,
    );
    assert.equal(
      getR2ObjectKey("https://cdn.example.test/assets/card-images/a%2Fb.png"),
      undefined,
    );
    assert.equal(
      getR2ObjectKey("https://cdn.example.test/assets/card-images/a.png?download=1"),
      undefined,
    );

    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.test/assets?token=nope";
    assert.throws(() => getR2Configuration(), /cannot contain credentials/);
  } finally {
    restore();
  }
});
