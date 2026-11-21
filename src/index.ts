import { createApp } from "./app.js";
import { connectDB } from "./lib/db.js";
import { env, warnOnInsecureProductionConfig } from "./config/env.js";

const app = createApp();

// Start HTTP server listener when running locally or on traditional hosts (non-serverless)
if (!process.env.VERCEL) {
  warnOnInsecureProductionConfig();
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`PizzaHub server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    console.log("\nShutting down gracefully...");
    const { disconnectDB } = await import("./lib/db.js");
    await disconnectDB();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Export for Vercel serverless execution
export default app;
