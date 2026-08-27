import { app } from "./src/app.js";
import { config } from "./src/config/env.js";
import { reindexExistingDocuments } from "./src/services/document/document.store.js";

await reindexExistingDocuments();

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Test with: POST http://localhost:${config.port}/api/chat`);
});
