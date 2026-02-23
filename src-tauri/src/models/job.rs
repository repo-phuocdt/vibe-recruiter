use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub requirements: Option<String>,
    pub status: String,
    pub created_at: String,
}
