import "./env.js";
import { createApp, log } from "./app.js";
import { serveStatic } from "./static.js";

export { log };

(async () => {
  const { app, httpServer } = await createApp();

  // Only set up Vite in development, after the API routes, so the catch-all doesn't swallow them.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // Serves both the API and the client. Defaults to 5000 if PORT isn't set.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
