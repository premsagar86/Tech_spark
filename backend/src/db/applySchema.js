import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { migrateSchema } from "./migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  // Connect without a target database first — DB_NAME may not exist yet on a first run.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME;
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await connection.query(sql);
  await connection.end();

  // CREATE TABLE IF NOT EXISTS above won't add new columns to a table that
  // already existed before this column was introduced — migrateSchema() (the
  // same function server.js runs on every boot) handles that via the shared pool.
  await migrateSchema();

  console.log(`Schema applied to \`${dbName}\`.`);
}

applySchema()
  .then(() => process.exit(0)) // migrateSchema() uses the pool, which otherwise keeps the process alive
  .catch((err) => {
    console.error("Failed to apply schema:", err.message);
    process.exit(1);
  });
