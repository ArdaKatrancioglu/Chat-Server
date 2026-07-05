import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

function configFromDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "")
  };
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const databaseConfig = databaseUrl ? configFromDatabaseUrl(databaseUrl) : null;

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? databaseConfig?.host ?? "localhost",
  port: Number(process.env.DB_PORT ?? databaseConfig?.port ?? 3306),
  user: process.env.DB_USER ?? databaseConfig?.user ?? "chat_api",
  password: process.env.DB_PASSWORD ?? databaseConfig?.password ?? "chat_api_password",
  database: process.env.DB_NAME ?? databaseConfig?.database ?? "chat_server",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  namedPlaceholders: false
});
