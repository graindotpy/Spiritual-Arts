import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { isR2Enabled, uploadToR2 } from "../r2";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const baseUrl = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return undefined;
  }
}

async function uploadFolder(localDir: string, keyPrefix: string) {
  if (!fs.existsSync(localDir)) return { uploaded: 0, skipped: 0 };
  const entries = await fs.promises.readdir(localDir, { withFileTypes: true });
  let uploaded = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filename = entry.name;
    const fullPath = path.join(localDir, filename);
    const key = `${keyPrefix}/${filename}`;

    try {
      const body = await fs.promises.readFile(fullPath);
      const contentType = getContentType(filename);
      await uploadToR2({ key, body, contentType });
      uploaded += 1;
      console.log(`Uploaded ${key}`);
    } catch (error) {
      skipped += 1;
      console.error(`Failed to upload ${key}:`, error);
    }
  }

  return { uploaded, skipped };
}

async function updatePortraitUrls() {
  if (!baseUrl) return 0;
  const result = await db.execute(sql`
    UPDATE characters
    SET portrait_url = replace(portrait_url, '/uploads/portraits/', ${baseUrl + "/portraits/"})
    WHERE portrait_url LIKE '/uploads/portraits/%'
  `);
  return result.rowCount || 0;
}

async function updateImageUrlsInText() {
  if (!baseUrl) return 0;
  const replacement = baseUrl + "/images/";
  let updated = 0;

  const tables = [
    { name: "glossary_terms", columns: ["definition", "expanded_content"] },
    { name: "dm_glossary", columns: ["definition", "expanded_content"] },
    { name: "dm_scratchpads", columns: ["content"] },
    { name: "dm_stacks", columns: ["target", "effect"] },
  ];

  for (const table of tables) {
    for (const column of table.columns) {
      const result = await db.execute(sql`
        UPDATE ${sql.raw(table.name)}
        SET ${sql.raw(column)} = replace(${sql.raw(column)}, '/uploads/images/', ${replacement})
        WHERE ${sql.raw(column)} LIKE '%/uploads/images/%'
      `);
      updated += result.rowCount || 0;
    }
  }

  return updated;
}

async function main() {
  if (!isR2Enabled()) {
    console.error("R2 is not configured. Set R2_* environment variables first.");
    process.exit(1);
  }

  if (!baseUrl) {
    console.error("R2_PUBLIC_BASE_URL is required.");
    process.exit(1);
  }

  const uploadsRoot = path.join(process.cwd(), "uploads");
  const portraitsDir = path.join(uploadsRoot, "portraits");
  const imagesDir = path.join(uploadsRoot, "images");

  console.log("Uploading portraits...");
  const portraitStats = await uploadFolder(portraitsDir, "portraits");

  console.log("Uploading images...");
  const imageStats = await uploadFolder(imagesDir, "images");

  console.log("Updating database URLs...");
  const portraitsUpdated = await updatePortraitUrls();
  const textUpdated = await updateImageUrlsInText();

  console.log("Done.");
  console.log(
    JSON.stringify(
      {
        portraits: portraitStats,
        images: imageStats,
        portraitsUpdated,
        textUpdated,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
