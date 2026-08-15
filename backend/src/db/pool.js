import mysql from "mysql2/promise";

// mysql2's PoolOptions has no `url` key — pass a connection string as the uri
// itself when DATABASE_URL is set, otherwise fall back to the discrete
// DB_HOST/DB_USER/DB_PASSWORD/DB_NAME vars. Mixing both in one object silently
// drops the string (that was the bug: DATABASE_URL was never actually used).
export const pool = process.env.DATABASE_URL
  ? mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
    })
  : mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });

// Pool creation above is lazy — mysql2 doesn't actually open a connection
// until the first query, so a bad host/user/password stays silent until
// something happens to query it. Call this at startup to fail loudly instead.
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log(`DB connected: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    return true;
  } catch (err) {
    console.error("DB connection failed:", err.message);
    return false;
  }
}
