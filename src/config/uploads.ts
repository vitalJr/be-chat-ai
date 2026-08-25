// Centralizes everything related to WHERE files uploaded by the user are
// stored. For now it's just a local folder inside the project — if this
// ever needs to move to an external service (e.g. S3), this is the only
// place to touch, without needing to change middleware/controller/routes.

import path from "node:path";
import fs from "node:fs";

// process.cwd() is the folder the "npm start" command was run from
// (the project root), so this creates an "uploads" folder there.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensures the folder exists before the server starts receiving files
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
