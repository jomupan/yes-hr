import { defineConfig } from "vitest/config";
import os from "os";
import path from "path";

const tmp = path.join(os.tmpdir(), `yeselevate-test-${process.pid}`);

export default defineConfig({
  // Don't inherit the frontend's postcss/tailwind config from the parent folder.
  css: { postcss: {} },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    // Runs on SQLite by default. Set TEST_DATABASE_URL to a throwaway
    // PostgreSQL database to run the same tests on Postgres, and
    // TEST_FILE_STORAGE=db to keep uploads in the database.
    env: {
      NODE_ENV: "test",
      DB_CLIENT: process.env.TEST_DATABASE_URL ? "pg" : "sqlite",
      DATABASE_URL: process.env.TEST_DATABASE_URL || "",
      SQLITE_FILE: path.join(tmp, "test.db"),
      UPLOAD_DIR: path.join(tmp, "uploads"),
      FILE_STORAGE: process.env.TEST_FILE_STORAGE || "disk",
      JWT_SECRET: "test-secret",
    },
  },
});
