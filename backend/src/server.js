import "dotenv/config";
import app from "./app.js";
import { testConnection } from "./db/pool.js";
import { migrateSchema } from "./db/migrate.js";
import { startExpireStaleRegistrationsJob } from "./utils/expireStaleRegistrations.js";

const PORT = process.env.PORT || 3000;

try {
  const connected = await testConnection();
  if (!connected) {
    console.error("Starting anyway — API routes that hit the DB will fail until this is fixed.");
  } else {
    await migrateSchema();
  }
} catch (err) {
  console.error("Unexpected error while testing DB connection or applying migrations:", err.message);
}

app.listen(PORT, () => console.log(`API listening on :${PORT}`));

startExpireStaleRegistrationsJob();
