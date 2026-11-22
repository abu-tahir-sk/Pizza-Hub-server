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
import { authDb } from "./lib/mongo-client.js";
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

  // Ensure DB connection for serverless invocations (e.g. Vercel)
  app.use(async (req, _res, next) => {
    if (req.path === "/" || req.path === "/api/health") {
      connectDB().catch((e) => console.warn("Background DB connection warning:", e.message));
      return next();
    }
    try {
      await connectDB();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use(cors(corsOptions));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  if (!isProd) app.use(morgan("dev"));

  // Root welcoming endpoint
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "PizzaHub Server API is running smoothly!",
      health: "/api/health",
    });
  });

  // 1) Better Auth parses its own body — mount before express.json.
  const authNodeHandler = toNodeHandler(auth);

  app.use("/api/auth", async (req, res, next) => {
    // Intercept OAuth callback redirects to bridge the session token across decoupled domains
    if (req.originalUrl?.includes("/callback/")) {
      try {
        // Self-healing: if an OAuth account exists whose userId no longer exists in user collection,
        // clean it up so Better Auth will never fail with "unable_to_link_account".
        const oauthAccounts = await authDb
          .collection("account")
          .find({ providerId: { $ne: "credential" } })
          .toArray();
        if (oauthAccounts.length > 0) {
          const users = await authDb
            .collection("user")
            .find({}, { projection: { _id: 1 } })
            .toArray();
          const validUserIds = new Set(users.map((u) => String(u._id)));
          const orphanedIds = oauthAccounts
            .filter((a) => !validUserIds.has(String(a.userId)))
            .map((a) => a._id);
          if (orphanedIds.length > 0) {
            await authDb.collection("account").deleteMany({ _id: { $in: orphanedIds } });
          }
        }
      } catch (cleanupErr) {
        console.warn("OAuth orphaned account cleanup warning:", cleanupErr);
      }

      try {
        const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
        const host = req.headers.host;
        const fullUrl = `${proto}://${host}${req.originalUrl}`;

        const webHeaders = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (v) {
            if (Array.isArray(v)) v.forEach((item) => webHeaders.append(k, item));
            else webHeaders.set(k, v);
          }
        }

        const webReq = new Request(fullUrl, {
          method: req.method,
          headers: webHeaders,
        });

        const webRes = await auth.handler(webReq);

        if (webRes.status >= 300 && webRes.status < 400) {
          const loc = webRes.headers.get("Location") || webRes.headers.get("location");
          const setCookies = webRes.headers.getSetCookie?.() || [webRes.headers.get("set-cookie") || ""];

          let extractedToken: string | null = null;
          for (const c of setCookies) {
            const m = /(?:pizzahub|better-auth)\.session_token=([^;.\s]+)/i.exec(c);
            if (m?.[1]) {
              extractedToken = matchToken(m[1]);
              break;
            }
          }

          function matchToken(val: string): string {
            return val;
          }

          let finalLoc = loc;
          if (finalLoc && extractedToken && !finalLoc.includes("session_token=")) {
            const sep = finalLoc.includes("?") ? "&" : "?";
            finalLoc = `${finalLoc}${sep}session_token=${extractedToken}`;
          }

          res.statusCode = webRes.status;
          for (const [k, v] of webRes.headers.entries()) {
            if (k.toLowerCase() === "location" || k.toLowerCase() === "set-cookie") continue;
            res.setHeader(k, v);
          }
          if (finalLoc) {
            res.setHeader("Location", finalLoc);
          }
          for (const c of setCookies) {
            if (c) res.append("Set-Cookie", c);
          }
          res.end();
          return;
        }
      } catch (err) {
        console.error("OAuth callback bridge error:", err);
      }
    }

    try {
      await authNodeHandler(req, res);
    } catch (err: any) {
      console.error("Better Auth handler error:", err);
      if (!res.headersSent) {
        res.status(err?.status || err?.statusCode || 500).json({
          success: false,
          message: err?.message || "Authentication error",
          code: err?.code || "AUTH_ERROR",
        });
      }
    }
  });

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
    sendSuccess(
      res,
      {
        dbStatus: mongoose.connection.readyState === 1 ? "connected" : "connecting_or_disconnected",
        hasMongoUri: Boolean(process.env.MONGODB_URI),
        isVercel: Boolean(process.env.VERCEL),
        clientUrl: env.CLIENT_URL,
        betterAuthUrl: env.BETTER_AUTH_URL,
      },
      {
        message: "PizzaHub API is running",
        meta: { time: new Date().toISOString() },
      }
    );
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
