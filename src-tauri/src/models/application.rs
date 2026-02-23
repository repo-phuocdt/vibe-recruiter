use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: String,
    pub candidate_id: String,
    pub job_id: String,
    pub status: String,
    pub score: Option<f64>,
    pub notes: Option<String>,
    pub created_at: String,
}
