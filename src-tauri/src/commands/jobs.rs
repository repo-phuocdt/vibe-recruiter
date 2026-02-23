use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::Job;
use crate::services::embedding;

fn map_job(row: &rusqlite::Row) -> rusqlite::Result<Job> {
    Ok(Job {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        requirements: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
    })
}

const SELECT_COLS: &str = "id, title, description, requirements, status, created_at";

#[tauri::command]
pub fn create_job(
    title: String,
    description: Option<String>,
    requirements: Option<String>,
    state: State<DbState>,
) -> Result<Job, AppError> {
    let conn = state.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO jobs (id, title, description, requirements, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, title, description, requirements, now],
    )?;

    Ok(Job {
        id,
        title,
        description,
        requirements,
        status: "open".into(),
        created_at: now,
    })
}

#[tauri::command]
pub fn list_jobs(
    status_filter: Option<String>,
    state: State<DbState>,
) -> Result<Vec<Job>, AppError> {
    let conn = state.0.lock().unwrap();

    if let Some(status) = status_filter {
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM jobs WHERE status = ?1 ORDER BY created_at DESC",
            SELECT_COLS
        ))?;
        let items = stmt
            .query_map(params![status], map_job)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    } else {
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM jobs ORDER BY created_at DESC",
            SELECT_COLS
        ))?;
        let items = stmt
            .query_map([], map_job)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }
}

#[tauri::command]
pub fn get_job(id: String, state: State<DbState>) -> Result<Job, AppError> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM jobs WHERE id = ?1",
        SELECT_COLS
    ))?;
    Ok(stmt.query_row(params![id], map_job)?)
}

#[tauri::command]
pub fn update_job(
    id: String,
    title: Option<String>,
    description: Option<String>,
    requirements: Option<String>,
    status: Option<String>,
    state: State<DbState>,
) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();

    if let Some(t) = title {
        conn.execute("UPDATE jobs SET title = ?1 WHERE id = ?2", params![t, id])?;
    }
    if let Some(d) = description {
        conn.execute(
            "UPDATE jobs SET description = ?1 WHERE id = ?2",
            params![d, id],
        )?;
    }
    if let Some(r) = requirements {
        conn.execute(
            "UPDATE jobs SET requirements = ?1 WHERE id = ?2",
            params![r, id],
        )?;
    }
    if let Some(s) = status {
        conn.execute("UPDATE jobs SET status = ?1 WHERE id = ?2", params![s, id])?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_job(id: String, state: State<DbState>) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();
    let _ = embedding::delete_embeddings(&conn, "job", &id);
    conn.execute("DELETE FROM jobs WHERE id = ?1", params![id])?;
    Ok(())
}

/// Generate aggregated report data for the agent
#[tauri::command]
pub fn generate_report_data(
    report_type: String,
    state: State<DbState>,
) -> Result<serde_json::Value, AppError> {
    let conn = state.0.lock().unwrap();

    match report_type.as_str() {
        "pipeline" => {
            let total_candidates: i64 =
                conn.query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))?;
            let total_jobs: i64 =
                conn.query_row("SELECT COUNT(*) FROM jobs", [], |r| r.get(0))?;
            let open_jobs: i64 =
                conn.query_row("SELECT COUNT(*) FROM jobs WHERE status = 'open'", [], |r| {
                    r.get(0)
                })?;
            let total_applications: i64 =
                conn.query_row("SELECT COUNT(*) FROM applications", [], |r| r.get(0))?;

            Ok(serde_json::json!({
                "type": "pipeline",
                "total_candidates": total_candidates,
                "total_jobs": total_jobs,
                "open_jobs": open_jobs,
                "total_applications": total_applications,
            }))
        }
        "candidate_summary" => {
            let mut stmt = conn.prepare(
                "SELECT id, name, email, parsed_data FROM candidates ORDER BY created_at DESC LIMIT 50",
            )?;
            let candidates: Vec<serde_json::Value> = stmt
                .query_map([], |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "name": row.get::<_, String>(1)?,
                        "email": row.get::<_, Option<String>>(2)?,
                        "has_parsed_data": row.get::<_, Option<String>>(3)?.is_some(),
                    }))
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(serde_json::json!({
                "type": "candidate_summary",
                "count": candidates.len(),
                "candidates": candidates,
            }))
        }
        _ => Err(AppError::Parse(format!(
            "Unknown report type: {}",
            report_type
        ))),
    }
}

/// Embed job description for RAG search
#[tauri::command]
pub async fn embed_job(
    job_id: String,
    proxy_url: String,
    api_key: String,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    let description = {
        let conn = state.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT description FROM jobs WHERE id = ?1")?;
        let desc: Option<String> = stmt.query_row(params![job_id], |row| row.get(0))?;
        desc.ok_or_else(|| AppError::Parse("Job has no description".into()))?
    };

    let chunks = embedding::chunk_text(&description, 200, 50);
    if !chunks.is_empty() {
        let embeddings = embedding::get_embeddings(&chunks, &proxy_url, &api_key).await?;

        let conn = state.0.lock().unwrap();
        let _ = embedding::delete_embeddings(&conn, "job", &job_id);
        embedding::store_embeddings(&conn, "job", &job_id, &chunks, &embeddings)?;
    }

    Ok(())
}
