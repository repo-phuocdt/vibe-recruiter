pub mod migrations;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

use crate::error::AppError;

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app: &tauri::App) -> Result<Connection, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("vibe-recruiter.db");
    let conn = Connection::open(&db_path)?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // Load sqlite-vec extension before migrations (needed for vec0 tables)
    let vec_available = load_sqlite_vec(&conn);
    if let Err(ref e) = vec_available {
        log::warn!("sqlite-vec not available: {e}");
    }

    migrations::run_migrations(&conn)?;

    // Create vec virtual table if extension loaded
    if vec_available.is_ok() {
        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
                embedding float[1536]
            );",
        )
        .unwrap_or_else(|e| log::warn!("Failed to create vec_embeddings: {e}"));
    }

    Ok(conn)
}

fn load_sqlite_vec(_conn: &Connection) -> Result<(), AppError> {
    // SAFETY: sqlite3_vec_init is a valid SQLite extension entry point with the
    // correct signature for sqlite3_auto_extension. The transmute converts the
    // function pointer to the type expected by the FFI binding.
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }
    Ok(())
}
