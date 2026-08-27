import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { handleUploadDocument, handleListDocuments } from "../controllers/document.controller.js";
import { ollamaRateLimiter } from "../middlewares/rate-limit.middleware.js";

export const documentRouter = Router();

documentRouter.post("/documents", ollamaRateLimiter, upload.single("file"), handleUploadDocument);

documentRouter.get("/documents", handleListDocuments);
