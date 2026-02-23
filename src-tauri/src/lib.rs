mod commands;
mod db;
mod error;
mod models;
mod services;

use db::{init_db, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let conn = init_db(app)?;
            app.manage(DbState(Mutex::new(conn)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Conversations
            commands::conversations::create_conversation,
            commands::conversations::list_conversations,
            commands::conversations::rename_conversation,
            commands::conversations::delete_conversation,
            commands::conversations::get_messages,
            commands::conversations::save_message,
            // Candidates
            commands::candidates::create_candidate,
            commands::candidates::list_candidates,
            commands::candidates::get_candidate,
            commands::candidates::update_candidate,
            commands::candidates::delete_candidate,
            commands::candidates::upload_cv,
            commands::candidates::process_cv,
            commands::candidates::rank_candidates,
            // Jobs
            commands::jobs::create_job,
            commands::jobs::list_jobs,
            commands::jobs::get_job,
            commands::jobs::update_job,
            commands::jobs::delete_job,
            commands::jobs::embed_job,
            commands::jobs::generate_report_data,
            // Embeddings
            commands::embeddings::search_similar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
