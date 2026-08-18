import mysql from "mysql2/promise";

let pool;

export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the self-hosted server.");
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      charset: "utf8mb4",
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
      enableKeepAlive: true
    });
  }
  return pool;
}

export async function transaction(callback) {
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function migrate() {
  const db = database();
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    status ENUM('pending','active','suspended','expired') NOT NULL DEFAULT 'pending',
    activation_expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.execute(`CREATE TABLE IF NOT EXISTS resources (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    kind ENUM('device','plan','template','batch') NOT NULL,
    payload JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX resources_user_kind_idx (user_id, kind),
    CONSTRAINT resources_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.execute(`CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    actor_id CHAR(36) NULL,
    action VARCHAR(120) NOT NULL,
    subject_type VARCHAR(50) NOT NULL,
    subject_id CHAR(36) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX audit_actor_idx (actor_id, created_at)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = undefined;
}
