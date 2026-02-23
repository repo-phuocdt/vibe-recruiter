use std::path::Path;

use crate::error::AppError;

/// Extract raw text from a PDF file
pub fn extract_text_from_pdf(path: &Path) -> Result<String, AppError> {
    let bytes = std::fs::read(path)?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| AppError::Parse(format!("PDF extraction failed: {}", e)))?;
    Ok(text)
}

/// Call LLM via proxy to extract structured data from CV text
pub async fn extract_structured_data(
    raw_text: &str,
    proxy_url: &str,
    api_key: &str,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Request(e.to_string()))?;
    // Limit text to prevent token overflow
    let truncated = &raw_text[..raw_text.len().min(10_000)];

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are a CV parser. Extract structured data and return only valid JSON."
            },
            {
                "role": "user",
                "content": format!(
                    "Extract structured data from this CV/resume. Return JSON with: \
                     name (string), email (string|null), phone (string|null), \
                     skills (string[]), experience ({{title,company,duration}}[]). \
                     Only return valid JSON.\n\n{}", truncated
                )
            }
        ],
        "response_format": { "type": "json_object" }
    });

    let resp = client
        .post(format!("{}/v1/chat/completions", proxy_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Request(e.to_string()))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Request(e.to_string()))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Parse("No content in LLM response".into()))?;

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(content)
        .map_err(|e| AppError::Parse(format!("Invalid JSON from LLM: {}", e)))?;

    Ok(content.to_string())
}
