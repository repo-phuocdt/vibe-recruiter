use crate::db::DbState;
use serde::Serialize;
use tauri::State;

const VALID_STAGES: &[&str] = &["new", "screening", "interview", "offer", "hired", "rejected"];

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_candidates: u32,
    pub active_jobs: u32,
    pub total_applications: u32,
    pub pipeline_counts: Vec<StageCount>,
    pub hired_count: u32,
}

#[derive(Debug, Serialize)]
pub struct StageCount {
    pub stage: String,
    pub count: u32,
}

#[derive(Debug, Serialize)]
pub struct PipelineCandidate {
    pub application_id: String,
    pub candidate_id: String,
    pub candidate_name: String,
    pub candidate_email: Option<String>,
    pub job_id: String,
    pub job_title: String,
    pub stage: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsData {
    pub candidates_per_job: Vec<JobCandidateCount>,
    pub stage_distribution: Vec<StageCount>,
}

#[derive(Debug, Serialize)]
pub struct JobCandidateCount {
    pub job_title: String,
    pub count: u32,
}

#[tauri::command]
pub async fn get_dashboard_stats(db: State<'_, DbState>) -> Result<DashboardStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let total_candidates: u32 = conn
        .query_row("SELECT COUNT(*) FROM candidates", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let active_jobs: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM jobs WHERE status = 'open'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_applications: u32 = conn
        .query_row("SELECT COUNT(*) FROM applications", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let hired_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM applications WHERE status = 'hired'",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT status, COUNT(*) as cnt FROM applications GROUP BY status ORDER BY cnt DESC")
        .map_err(|e| e.to_string())?;
    let pipeline_counts: Vec<StageCount> = stmt
        .query_map([], |row| {
            Ok(StageCount {
                stage: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(DashboardStats {
        total_candidates,
        active_jobs,
        total_applications,
        pipeline_counts,
        hired_count,
    })
}

#[tauri::command]
pub async fn get_pipeline_candidates(
    stage: Option<String>,
    db: State<'_, DbState>,
) -> Result<Vec<PipelineCandidate>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let sql = if stage.is_some() {
        "SELECT a.id, a.candidate_id, c.name, c.email, a.job_id, j.title, a.status, a.created_at
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         WHERE a.status = ?1
         ORDER BY a.created_at DESC"
    } else {
        "SELECT a.id, a.candidate_id, c.name, c.email, a.job_id, j.title, a.status, a.created_at
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         ORDER BY a.created_at DESC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = if let Some(ref s) = stage {
        stmt.query_map([s.as_str()], map_pipeline_row)
    } else {
        stmt.query_map([], map_pipeline_row)
    };

    let results: Vec<PipelineCandidate> = rows
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

fn map_pipeline_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PipelineCandidate> {
    Ok(PipelineCandidate {
        application_id: row.get(0)?,
        candidate_id: row.get(1)?,
        candidate_name: row.get(2)?,
        candidate_email: row.get(3)?,
        job_id: row.get(4)?,
        job_title: row.get(5)?,
        stage: row.get(6)?,
        created_at: row.get(7)?,
    })
}

#[tauri::command]
pub async fn update_candidate_stage(
    application_id: String,
    new_stage: String,
    db: State<'_, DbState>,
) -> Result<(), String> {
    if !VALID_STAGES.contains(&new_stage.as_str()) {
        return Err(format!(
            "Invalid stage '{}'. Must be one of: {}",
            new_stage,
            VALID_STAGES.join(", ")
        ));
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let rows_affected = conn
        .execute(
            "UPDATE applications SET status = ?1 WHERE id = ?2",
            [&new_stage, &application_id],
        )
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err(format!("Application '{}' not found", application_id));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_analytics_data(db: State<'_, DbState>) -> Result<AnalyticsData, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT j.title, COUNT(a.id) as cnt
             FROM jobs j
             LEFT JOIN applications a ON a.job_id = j.id
             GROUP BY j.id
             ORDER BY cnt DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let candidates_per_job: Vec<JobCandidateCount> = stmt
        .query_map([], |row| {
            Ok(JobCandidateCount {
                job_title: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    let mut stmt2 = conn
        .prepare("SELECT status, COUNT(*) FROM applications GROUP BY status")
        .map_err(|e| e.to_string())?;
    let stage_distribution: Vec<StageCount> = stmt2
        .query_map([], |row| {
            Ok(StageCount {
                stage: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(AnalyticsData {
        candidates_per_job,
        stage_distribution,
    })
}

#[tauri::command]
pub async fn create_application(
    candidate_id: String,
    job_id: String,
    db: State<'_, DbState>,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO applications (id, candidate_id, job_id, status) VALUES (?1, ?2, ?3, 'new')",
        [&id, &candidate_id, &job_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub async fn get_job_applications(
    job_id: String,
    db: State<'_, DbState>,
) -> Result<Vec<PipelineCandidate>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.candidate_id, c.name, c.email, a.job_id, j.title, a.status, a.created_at
             FROM applications a
             JOIN candidates c ON c.id = a.candidate_id
             JOIN jobs j ON j.id = a.job_id
             WHERE a.job_id = ?1
             ORDER BY a.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let results: Vec<PipelineCandidate> = stmt
        .query_map([&job_id], map_pipeline_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    Ok(results)
}
