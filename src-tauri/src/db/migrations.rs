use rusqlite::{Connection, Result};

struct Migration {
    version: u32,
    up: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        up: "
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY NOT NULL,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
        ",
    },
    Migration {
        version: 2,
        up: "
            CREATE TABLE IF NOT EXISTS candidates (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                resume_path TEXT,
                parsed_data TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                requirements TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS applications (
                id TEXT PRIMARY KEY NOT NULL,
                candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'new',
                score REAL,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS embedding_chunks (
                id INTEGER PRIMARY KEY,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        ",
    },
    Migration {
        version: 3,
        up: "
            ALTER TABLE messages ADD COLUMN tool_calls TEXT;
        ",
    },
];

pub fn run_migrations(conn: &Connection) -> Result<()> {
    let current_version: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    for migration in MIGRATIONS {
        if migration.version > current_version {
            conn.execute_batch(migration.up)?;
            conn.pragma_update(None, "user_version", migration.version)?;
        }
    }

    Ok(())
}
