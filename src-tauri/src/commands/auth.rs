use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const AUTH_STORE: &str = ".auth.dat";

#[derive(Debug, Serialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
}

/// Persist auth tokens to the encrypted store.
#[tauri::command]
pub fn store_auth_token(
    app: AppHandle,
    access_token: String,
    refresh_token: String,
) -> Result<(), String> {
    let store = app.store(AUTH_STORE).map_err(|e| e.to_string())?;
    store.set("access_token", serde_json::json!(access_token));
    store.set("refresh_token", serde_json::json!(refresh_token));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Retrieve stored auth tokens, returns None if not set.
#[tauri::command]
pub fn get_auth_token(app: AppHandle) -> Result<Option<StoredTokens>, String> {
    let store = app.store(AUTH_STORE).map_err(|e| e.to_string())?;
    let access = store
        .get("access_token")
        .and_then(|v| v.as_str().map(String::from));
    let refresh = store
        .get("refresh_token")
        .and_then(|v| v.as_str().map(String::from));
    Ok(access.zip(refresh).map(|(access_token, refresh_token)| StoredTokens {
        access_token,
        refresh_token,
    }))
}

/// Remove auth tokens from the store (logout).
#[tauri::command]
pub fn clear_auth_token(app: AppHandle) -> Result<(), String> {
    let store = app.store(AUTH_STORE).map_err(|e| e.to_string())?;
    store.delete("access_token");
    store.delete("refresh_token");
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
