import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { env, isProd, warnOnInsecureProductionConfig } from "./config/env.js";
import { corsOptions } from "./config/cors.js";
import { connectDB } from "./lib/db.js";
import { auth } from "./lib/auth.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";
import { sendSuccess } from "./utils/api-response.js";
import { authRouter } from "./routes/auth.routes.js";
import { menuRouter } from "./routes/menu.routes.js";
import { orderRouter } from "./routes/order.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(cors(corsOptions));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  if (!isProd) app.use(morgan("dev"));

  // 1) Better Auth parses its own body — mount before express.json.
  app.use("/api/auth", toNodeHandler(auth));

  // 2) Stripe webhook needs the raw body for signature verification.
  app.use("/api/payments/webhook", webhookRouter);

  // 3) JSON body parsing for everything else.
  app.use(express.json({ limit: "2mb" }));

  // Static uploads directory for image uploads fallback
  app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

  app.use("/api/auth-extra", authRouter);
  app.use("/api/menu", menuRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/users", userRouter);
  app.use("/api/uploads", uploadRouter);

  app.get("/api/health", (_req, res) => {
    sendSuccess(res, undefined, {
      message: "PizzaHub API is running 🍕",
      meta: { time: new Date().toISOString() },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  warnOnInsecureProductionConfig();
  await connectDB();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`🍕 PizzaHub server listening on http://localhost:${env.PORT}`);
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
