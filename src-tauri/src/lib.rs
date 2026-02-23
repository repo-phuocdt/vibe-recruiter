mod commands;
mod db;
mod error;

use db::{init_db, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            commands::conversations::create_conversation,
            commands::conversations::list_conversations,
            commands::conversations::rename_conversation,
            commands::conversations::delete_conversation,
            commands::conversations::get_messages,
            commands::conversations::save_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
