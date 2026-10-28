import path from "path";
import dotenv from "dotenv";

dotenv.config();

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const nodeEnv = process.env.NODE_ENV || "development";

export const config = {
  port: num(process.env.PORT, 4000),
  nodeEnv,
  isProd: nodeEnv === "production",
  isTest: nodeEnv === "test",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:8080,http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8080",
  timezone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur",

  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  /** Login length when "Remember me" is ticked. */
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || "30d",

  dbClient: (process.env.DB_CLIENT || "sqlite") as "sqlite" | "mysql" | "pg",
  sqliteFile: process.env.SQLITE_FILE || "./data/yeselevate.db",
  databaseUrl: process.env.DATABASE_URL || "",

  uploadDir: path.resolve(process.env.UPLOAD_DIR || "./uploads"),
  /** Where uploads go: "disk" (UPLOAD_DIR) or "db" (inside the database,
   *  for hosts with no permanent disk such as Render's free plan). */
  fileStorage: (process.env.FILE_STORAGE === "db" ? "db" : "disk") as "disk" | "db",
  /** Built website to serve alongside the API (main folder: npm run build).
   *  Relative to the backend folder, like the other paths here. */
  frontendDist: path.resolve(process.env.FRONTEND_DIST || "../dist"),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 5) * 1024 * 1024,
  selfieKeepHours: num(process.env.SELFIE_KEEP_HOURS, 24),
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL || "",
  sheetsSecret: process.env.SHEETS_SECRET || "",

  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123",
  seedStaffPassword: process.env.SEED_STAFF_PASSWORD || "staff123",
  /** Create the demo staff account (aina). Off in production unless asked for. */
  seedDemoStaff: process.env.SEED_DEMO_STAFF ? process.env.SEED_DEMO_STAFF === "true" : nodeEnv !== "production",

  /** Business rules carried over from the frontend. */
  rules: {
    // 8:30 is on time; 8:31 or later is Late.
    lateAfter: { hour: 8, minute: 30 },
    defaultLeave: { Annual: 14, Medical: 14, Emergency: 3 },
    dopeValidDays: 182,
    dopeReminderDays: 14,
    resetTokenTtlMs: 30 * 60 * 1000,
    notificationsPerUser: 100,
  },
};

if (config.isProd && config.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("JWT_SECRET must be set in production (any long random string).");
}
if (config.isProd && (!process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD === "admin123")) {
  throw new Error("SEED_ADMIN_PASSWORD must be set to your own password in production (used for the first admin account).");
}
