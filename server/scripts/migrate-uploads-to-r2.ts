import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { databaseConnection, requireDatabase } from "../db";
import { isR2Enabled, uploadToR2 } from "../r2";
import { inspectRasterImage } from "../uploads/image-store";

const baseUrl = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

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
      const format = inspectRasterImage(body);
      if (!format) {
        skipped += 1;
        console.warn(`Skipped unsupported image format: ${key}`);
        continue;
      }
      await uploadToR2({ key, body, contentType: format.contentType });
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
  const db = requireDatabase();
  const result = await db.execute(sql`
    UPDATE characters
    SET portrait_url = replace(portrait_url, '/uploads/portraits/', ${baseUrl + "/portraits/"})
    WHERE portrait_url LIKE '/uploads/portraits/%'
  `);
  return result.rowCount || 0;
}

async function updateImageUrlsInText() {
  if (!baseUrl) return 0;
  const db = requireDatabase();
  const replacement = baseUrl + "/images/";
  let updated = 0;

  const tables = [
    { name: "glossary_terms", columns: ["definition", "expanded_content"] },
    { name: "dm_glossary", columns: ["definition", "expanded_content"] },
    { name: "dm_scratchpads", columns: ["content"] },
    { name: "dm_stacks", columns: ["target", "effect"] },
    { name: "spiritual_instruments", columns: ["image_url", "expanded_content"] },
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

  const cardImageReplacement = baseUrl + "/card-images/";
  const cardStates = await db.execute(sql`
    UPDATE card_game_states
    SET state = replace(
      replace(state::text, '/uploads/images/', ${replacement}),
      '/uploads/card-images/',
      ${cardImageReplacement}
    )::jsonb
    WHERE state::text LIKE '%/uploads/images/%'
       OR state::text LIKE '%/uploads/card-images/%'
  `);
  updated += cardStates.rowCount || 0;

  return updated;
}

async function main() {
  if (!isR2Enabled()) {
    throw new Error("R2 is not configured. Set R2_* environment variables first.");
  }

  if (!baseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is required");
  }

  requireDatabase();

  const uploadsRoot = path.join(process.cwd(), "uploads");
  const portraitsDir = path.join(uploadsRoot, "portraits");
  const imagesDir = path.join(uploadsRoot, "images");
  const cardImagesDir = path.join(uploadsRoot, "card-images");

  console.log("Uploading portraits...");
  const portraitStats = await uploadFolder(portraitsDir, "portraits");

  console.log("Uploading images...");
  const imageStats = await uploadFolder(imagesDir, "images");

  console.log("Uploading card images...");
  const cardImageStats = await uploadFolder(cardImagesDir, "card-images");

  if (
    portraitStats.skipped > 0 ||
    imageStats.skipped > 0 ||
    cardImageStats.skipped > 0
  ) {
    throw new Error(
      "Some local images could not be uploaded; database URLs were not changed",
    );
  }

  console.log("Updating database URLs...");
  const portraitsUpdated = await updatePortraitUrls();
  const textUpdated = await updateImageUrlsInText();

  console.log("Done.");
  console.log(
    JSON.stringify(
      {
        portraits: portraitStats,
        images: imageStats,
        cardImages: cardImageStats,
        portraitsUpdated,
        textUpdated,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await databaseConnection?.pool.end();
  });
