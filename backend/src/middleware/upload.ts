import multer from "multer";
import { config } from "../config";

/* Files are held in memory just long enough to validate their real type
   (magic bytes) before being written to disk by lib/files.ts. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});
