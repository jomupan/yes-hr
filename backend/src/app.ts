import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { db } from "./db/knex";
import { requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { meRouter } from "./routes/me";
import { notificationsRouter } from "./routes/notifications";
import { adminRouter } from "./routes/admin";
import { calendarRouter } from "./routes/calendar";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          // The website loads Google Fonts and an external logo image, and
          // the selfie camera uses data:/blob: images.
          "img-src": ["'self'", "data:", "blob:", "https:"],
          "media-src": ["'self'", "blob:"],
          "font-src": ["'self'", "https:", "data:"],
          "style-src": ["'self'", "https:", "'unsafe-inline'"],
          // Don't force https on plain http://localhost.
          "upgrade-insecure-requests": null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes("*")),
      credentials: true,
    }),
  );
  // Selfies arrive as base64 data URLs, so allow a larger JSON body.
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: false }));
  if (!config.isTest) app.use(morgan(config.isProd ? "combined" : "dev"));

  // Lightweight "is the server up" check that does NOT touch the database.
  // Use this for hosting health checks and uptime monitors, so a free
  // database that pauses when idle (e.g. Neon) is allowed to sleep.
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true });
  });

  // Full check including the database.
  app.get("/api/health", async (_req, res) => {
    await db.raw("select 1");
    res.json({ ok: true, service: "yeselevate-backend", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/me", requireAuth, meRouter);
  app.use("/api/notifications", requireAuth, notificationsRouter);
  app.use("/api/calendar", requireAuth, calendarRouter);
  app.use("/api/admin", requireAuth, adminRouter);

  // Serve the built website (npm run build in the main folder) from the
  // same address as the API, so one HTTPS link works for phones. Checked on
  // every request, so a build made after the server started is picked up.
  const indexHtml = path.join(config.frontendDist, "index.html");
  const serveSite = express.static(config.frontendDist, {
    index: false,
    setHeaders: (res, file) => {
      if (file.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        // sw.js, manifest, icons: always check for a newer version.
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || !fs.existsSync(indexHtml)) return next();
    serveSite(req, res, () => {
      // Any other page (e.g. /dashboard, /admin/leave-requests) is handled
      // by the React router inside index.html.
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexHtml);
    });
  });

  // Website not built yet: say so instead of a bare "route not found".
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text/plain")
      .send("The website hasn't been built yet. In the backend folder, stop the server (Ctrl + C) and run: npm run app");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
