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

    migrations::run_migrations(&conn)?;

    Ok(conn)
}
