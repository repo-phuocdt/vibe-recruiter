use chrono::Utc;
use rusqlite::params;
use serde::Serialize;
use tauri::{Manager, State};
use uuid::Uuid;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::Candidate;
use crate::services::{cv_parser, embedding};

#[derive(Debug, Serialize)]
pub struct RankedCandidate {
    pub candidate: Candidate,
    pub similarity_score: f64,
}

fn map_candidate(row: &rusqlite::Row) -> rusqlite::Result<Candidate> {
    Ok(Candidate {
        id: row.get(0)?,
        name: row.get(1)?,
        email: row.get(2)?,
        phone: row.get(3)?,
        resume_path: row.get(4)?,
        parsed_data: row.get(5)?,
        created_at: row.get(6)?,
    })
}

const SELECT_COLS: &str = "id, name, email, phone, resume_path, parsed_data, created_at";

#[tauri::command]
pub fn create_candidate(
    name: String,
    email: Option<String>,
    phone: Option<String>,
    state: State<DbState>,
) -> Result<Candidate, AppError> {
    let conn = state.0.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO candidates (id, name, email, phone, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, email, phone, now],
    )?;

    Ok(Candidate {
        id,
        name,
        email,
        phone,
        resume_path: None,
        parsed_data: None,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_candidates(
    search: Option<String>,
    state: State<DbState>,
) -> Result<Vec<Candidate>, AppError> {
    let conn = state.0.lock().unwrap();

    if let Some(q) = search {
        let pattern = format!("%{}%", q);
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM candidates WHERE name LIKE ?1 OR email LIKE ?1 ORDER BY created_at DESC",
            SELECT_COLS
        ))?;
        let items = stmt
            .query_map(params![pattern], map_candidate)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    } else {
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM candidates ORDER BY created_at DESC",
            SELECT_COLS
        ))?;
        let items = stmt
            .query_map([], map_candidate)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }
}

#[tauri::command]
pub fn get_candidate(id: String, state: State<DbState>) -> Result<Candidate, AppError> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM candidates WHERE id = ?1",
        SELECT_COLS
    ))?;
    Ok(stmt.query_row(params![id], map_candidate)?)
}

#[tauri::command]
pub fn update_candidate(
    id: String,
    name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    state: State<DbState>,
) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();

    if let Some(n) = name {
        conn.execute(
            "UPDATE candidates SET name = ?1 WHERE id = ?2",
            params![n, id],
        )?;
    }
    if let Some(e) = email {
        conn.execute(
            "UPDATE candidates SET email = ?1 WHERE id = ?2",
            params![e, id],
        )?;
    }
    if let Some(p) = phone {
        conn.execute(
            "UPDATE candidates SET phone = ?1 WHERE id = ?2",
            params![p, id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_candidate(id: String, state: State<DbState>) -> Result<(), AppError> {
    let conn = state.0.lock().unwrap();
    // Clean up embeddings
    let _ = embedding::delete_embeddings(&conn, "candidate", &id);
    conn.execute("DELETE FROM candidates WHERE id = ?1", params![id])?;
    Ok(())
}

/// Upload CV: frontend passes file path from dialog, Rust copies to app data dir
#[tauri::command]
pub fn upload_cv(
    app: tauri::AppHandle,
    candidate_id: String,
    file_path: String,
    state: State<DbState>,
) -> Result<String, AppError> {
    let source = std::path::Path::new(&file_path);
    if !source.exists() {
        return Err(AppError::Parse("File not found".into()));
    }
    // Validate PDF extension
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if !ext.eq_ignore_ascii_case("pdf") {
        return Err(AppError::Parse("Only PDF files are accepted".into()));
    }
    // Sanitize candidate_id to prevent path traversal
    if candidate_id.contains('/') || candidate_id.contains('\\') || candidate_id.contains("..") {
        return Err(AppError::Parse("Invalid candidate ID".into()));
    }

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
    let cvs_dir = app_dir.join("cvs");
    std::fs::create_dir_all(&cvs_dir)?;

    let dest = cvs_dir.join(format!("{}.pdf", candidate_id));
    std::fs::copy(source, &dest)?;
    let dest_str = dest.to_string_lossy().to_string();

    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE candidates SET resume_path = ?1 WHERE id = ?2",
        params![dest_str, candidate_id],
    )?;

    Ok(dest_str)
}

/// Parse CV + generate embeddings (async: HTTP calls to proxy)
#[tauri::command]
pub async fn process_cv(
    candidate_id: String,
    proxy_url: String,
    api_key: String,
    state: State<'_, DbState>,
) -> Result<String, AppError> {
    // 1. Get resume path
    let resume_path = {
        let conn = state.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT resume_path FROM candidates WHERE id = ?1")?;
        let path: Option<String> = stmt.query_row(params![candidate_id], |row| row.get(0))?;
        path.ok_or_else(|| AppError::Parse("No resume uploaded".into()))?
    };

    // 2. Extract text from PDF
    let text = cv_parser::extract_text_from_pdf(std::path::Path::new(&resume_path))?;

    // 3. LLM structured extraction
    let parsed_data = cv_parser::extract_structured_data(&text, &proxy_url, &api_key).await?;

    // 4. Save parsed data
    {
        let conn = state.0.lock().unwrap();
        conn.execute(
            "UPDATE candidates SET parsed_data = ?1 WHERE id = ?2",
            params![parsed_data, candidate_id],
        )?;
    }

    // 5. Chunk + embed
    let chunks = embedding::chunk_text(&text, 200, 50);
    if !chunks.is_empty() {
        let embeddings = embedding::get_embeddings(&chunks, &proxy_url, &api_key).await?;

        let conn = state.0.lock().unwrap();
        // Clean old embeddings first
        let _ = embedding::delete_embeddings(&conn, "candidate", &candidate_id);
        embedding::store_embeddings(&conn, "candidate", &candidate_id, &chunks, &embeddings)?;
    }

    Ok(parsed_data)
}

/// Rank candidates for a job using vector similarity
#[tauri::command]
pub async fn rank_candidates(
    job_id: String,
    top_k: usize,
    proxy_url: String,
    api_key: String,
    state: State<'_, DbState>,
) -> Result<Vec<RankedCandidate>, AppError> {
    // 1. Load job text for embedding
    let job_text = {
        let conn = state.0.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT description, requirements FROM jobs WHERE id = ?1")?;
        let (desc, req): (Option<String>, Option<String>) =
            stmt.query_row(params![job_id], |row| Ok((row.get(0)?, row.get(1)?)))?;
        format!(
            "{} {}",
            desc.unwrap_or_default(),
            req.unwrap_or_default()
        )
    };

    if job_text.trim().is_empty() {
        return Err(AppError::Parse("Job has no description or requirements to rank against".into()));
    }

    // 2. Embed job text
    let embeddings = embedding::get_embeddings(&[job_text], &proxy_url, &api_key).await?;
    let job_embedding = embeddings
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Parse("Failed to embed job text".into()))?;

    // 3. Vector search — fetch extra to filter candidates only
    let results = {
        let conn = state.0.lock().unwrap();
        embedding::search_similar(&conn, &job_embedding, top_k * 3)?
    };

    // 4. Deduplicate candidate IDs, keep best score
    let mut seen = std::collections::HashMap::new();
    for r in &results {
        if r.source_type == "candidate" {
            seen.entry(r.source_id.clone())
                .or_insert(r.score);
        }
    }

    // 5. Sort by score (lower distance = better match), take top_k
    let mut scored: Vec<_> = seen.into_iter().collect();
    scored.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);

    // 6. Fetch candidate data
    let conn = state.0.lock().unwrap();
    let mut ranked = Vec::with_capacity(scored.len());
    for (cid, score) in scored {
        if let Ok(candidate) = conn
            .prepare(&format!("SELECT {} FROM candidates WHERE id = ?1", SELECT_COLS))
            .and_then(|mut stmt| stmt.query_row(params![cid], map_candidate))
        {
            ranked.push(RankedCandidate {
                candidate,
                similarity_score: score,
            });
        }
    }

    Ok(ranked)
}
