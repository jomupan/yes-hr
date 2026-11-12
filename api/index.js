/* Vercel entry point: every /api/* request comes here (see vercel.json)
   and is handled by the same Express app the Render server uses.
   It loads the backend after it's been compiled to backend/dist by the
   build step ("npm run build --prefix backend"). */
import appModule from "../backend/dist/app.js";
import initModule from "../backend/dist/db/init.js";

const app = appModule.createApp();

export default async function handler(req, res) {
  try {
    await initModule.ensureDatabase();
  } catch (e) {
    console.error("Database not ready:", e);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "The server is starting up. Please try again in a moment.", code: "DB_UNAVAILABLE" }));
    return;
  }
  return app(req, res);
}
