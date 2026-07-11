import { Router } from "express";
import { asyncHandler } from "../http/async-handler";
import { badRequest } from "../http/errors";
import { imageUpload, type ImageStore } from "../uploads/image-store";

export function createUploadRouter(images: ImageStore): Router {
  const router = Router();

  router.post(
    "/api/upload/image",
    imageUpload,
    asyncHandler("Failed to upload image", async (req, res) => {
      if (!req.file) {
        throw badRequest("No image file provided");
      }

      const imageUrl = await images.save("images", "image", req.file);
      res.status(201).json({ url: imageUrl });
    }),
  );

  return router;
}
