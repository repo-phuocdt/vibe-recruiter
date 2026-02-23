use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn create_conversation(
    title: String,
    state: State<DbState>,
) -> Result<Conversation, AppError> {
    let conn = state.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, title, now, now],
    )?;

    Ok(Conversation {
        id,
        title,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn list_conversations(state: State<DbState>) -> Result<Vec<Conversation>, AppError> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    )?;

    let items = stmt
        .query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

#[tauri::command]
pub fn rename_conversation(
    id: String,
    title: String,
    state: State<DbState>,
) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn delete_conversation(id: String, state: State<DbState>) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();

    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;

    Ok(())
}

#[tauri::command]
pub fn get_messages(
    conversation_id: String,
    state: State<DbState>,
) -> Result<Vec<Message>, AppError> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, tool_calls, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
    )?;

    let items = stmt
        .query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tool_calls: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

#[tauri::command]
pub fn save_message(
    conversation_id: String,
    role: String,
    content: String,
    tool_calls: Option<String>,
    state: State<DbState>,
) -> Result<Message, AppError> {
    let conn = state.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, conversation_id, role, content, tool_calls, now],
    )?;

    conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, conversation_id],
    )?;

    Ok(Message {
        id,
        conversation_id,
        role,
        content,
        tool_calls,
        created_at: now,
    })
}
