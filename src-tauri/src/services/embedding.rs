use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub source_type: String,
    pub source_id: String,
    pub chunk_text: String,
    pub score: f64,
}

/// Split text into overlapping word-based chunks
pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }
    if words.len() <= chunk_size {
        return vec![words.join(" ")];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    while start < words.len() {
        let end = (start + chunk_size).min(words.len());
        chunks.push(words[start..end].join(" "));
        if end >= words.len() {
            break;
        }
        start += chunk_size.saturating_sub(overlap).max(1);
    }
    chunks
}

/// Call proxy embedding API
pub async fn get_embeddings(
    texts: &[String],
    proxy_url: &str,
    api_key: &str,
) -> Result<Vec<Vec<f32>>, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Request(e.to_string()))?;

    let resp = client
        .post(format!("{}/v1/embeddings", proxy_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "text-embedding-3-small",
            "input": texts
        }))
        .send()
        .await
        .map_err(|e| AppError::Request(e.to_string()))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Request(e.to_string()))?;

    let data = json["data"]
        .as_array()
        .ok_or_else(|| AppError::Parse("No data in embeddings response".into()))?;

    let mut embeddings = Vec::with_capacity(data.len());
    for item in data {
        let emb: Vec<f32> = item["embedding"]
            .as_array()
            .ok_or_else(|| AppError::Parse("Invalid embedding format".into()))?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect();
        embeddings.push(emb);
    }

    Ok(embeddings)
}

/// Serialize f32 vector to little-endian bytes for sqlite-vec
fn serialize_embedding(embedding: &[f32]) -> Vec<u8> {
    embedding.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Store text chunks + their embeddings in DB (transactional)
pub fn store_embeddings(
    conn: &Connection,
    source_type: &str,
    source_id: &str,
    chunks: &[String],
    embeddings: &[Vec<f32>],
) -> Result<(), AppError> {
    conn.execute_batch("BEGIN")?;
    let result = (|| -> Result<(), AppError> {
        for (chunk, embedding) in chunks.iter().zip(embeddings.iter()) {
            conn.execute(
                "INSERT INTO embedding_chunks (source_type, source_id, chunk_text) VALUES (?1, ?2, ?3)",
                params![source_type, source_id, chunk],
            )?;
            let chunk_id = conn.last_insert_rowid();

            let bytes = serialize_embedding(embedding);
            conn.execute(
                "INSERT INTO vec_embeddings(rowid, embedding) VALUES (?1, ?2)",
                params![chunk_id, bytes],
            )?;
        }
        Ok(())
    })();
    match result {
        Ok(()) => { conn.execute_batch("COMMIT")?; Ok(()) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

/// Delete embeddings for a given source
pub fn delete_embeddings(
    conn: &Connection,
    source_type: &str,
    source_id: &str,
) -> Result<(), AppError> {
    // Get chunk IDs first
    let mut stmt = conn.prepare(
        "SELECT id FROM embedding_chunks WHERE source_type = ?1 AND source_id = ?2",
    )?;
    let chunk_ids: Vec<i64> = stmt
        .query_map(params![source_type, source_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    // Delete from vec table
    for id in &chunk_ids {
        let _ = conn.execute("DELETE FROM vec_embeddings WHERE rowid = ?1", params![id]);
    }

    // Delete metadata
    conn.execute(
        "DELETE FROM embedding_chunks WHERE source_type = ?1 AND source_id = ?2",
        params![source_type, source_id],
    )?;

    Ok(())
}

/// Vector similarity search
pub fn search_similar(
    conn: &Connection,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<SearchResult>, AppError> {
    let query_bytes = serialize_embedding(query_embedding);

    // Query vec table
    let mut vec_stmt = match conn.prepare(
        "SELECT rowid, distance FROM vec_embeddings WHERE embedding MATCH ?1 ORDER BY distance LIMIT ?2",
    ) {
        Ok(stmt) => stmt,
        Err(_) => return Ok(vec![]), // vec table not available
    };

    let matches: Vec<(i64, f64)> = vec_stmt
        .query_map(params![query_bytes, top_k as i64], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Fetch metadata for each match
    let mut meta_stmt = conn.prepare(
        "SELECT source_type, source_id, chunk_text FROM embedding_chunks WHERE id = ?1",
    )?;

    let mut results = Vec::with_capacity(matches.len());
    for (rowid, distance) in matches {
        if let Ok(r) = meta_stmt.query_row(params![rowid], |row| {
            Ok(SearchResult {
                source_type: row.get(0)?,
                source_id: row.get(1)?,
                chunk_text: row.get(2)?,
                score: distance,
            })
        }) {
            results.push(r);
        }
    }

    Ok(results)
}
