use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::services::embedding::{self, SearchResult};

#[tauri::command]
pub async fn search_similar(
    query: String,
    top_k: Option<usize>,
    proxy_url: String,
    api_key: String,
    state: State<'_, DbState>,
) -> Result<Vec<SearchResult>, AppError> {
    let k = top_k.unwrap_or(5);

    // Get query embedding
    let embeddings = embedding::get_embeddings(&[query], &proxy_url, &api_key).await?;
    let query_embedding = embeddings
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Parse("No embedding returned".into()))?;

    // Search
    let conn = state.0.lock().unwrap();
    embedding::search_similar(&conn, &query_embedding, k)
}
