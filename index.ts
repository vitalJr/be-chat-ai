// App entry point: this is where everything actually starts running.
// We import the already-configured app (routes + middlewares) and just start the server.

import { app } from "./src/app.js";
import { config } from "./src/config/env.js";
import { reindexExistingDocuments } from "./src/services/document/document.store.js";

// Rebuild the in-memory vector store from whatever is already in
// uploads/ before accepting requests — see reindexExistingDocuments()
// for why this is needed on every restart.
await reindexExistingDocuments();

app.listen(config.port, () => {
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Test with: POST http://localhost:${config.port}/api/chat`);
});
