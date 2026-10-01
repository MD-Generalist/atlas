//! IPC for the Atlas-owned system notifier (`crate::notifier`). Responses come
//! back on the `atlas:notification-response` event.

use std::sync::Arc;

use tauri::State;

use crate::notifier::{Authorization, Notification, Notifier, NotifierInfo};

/// Call once after the response listener is registered: flushes responses that
/// arrived before it (a click that launched the app) and reports the backend's
/// capabilities.
#[tauri::command]
pub fn notifier_init(notifier: State<'_, Arc<Notifier>>) -> NotifierInfo {
    notifier.init()
}

/// Ask the OS for permission to post (may prompt).
#[tauri::command]
pub async fn notifier_request_authorization(
    notifier: State<'_, Arc<Notifier>>,
) -> Result<Authorization, String> {
    let notifier = notifier.inner().clone();
    let (sender, receiver) = tokio::sync::oneshot::channel();
    tauri::async_runtime::spawn_blocking(move || {
        notifier
            .backend()
            .request_authorization(Box::new(move |authorization| {
                // The receiver is gone only if the command was dropped.
                sender.send(authorization).ok();
            }));
    });
    receiver.await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn notifier_show(
    notifier: State<'_, Arc<Notifier>>,
    notification: Notification,
) -> Result<(), String> {
    let notifier = notifier.inner().clone();
    tauri::async_runtime::spawn_blocking(move || notifier.backend().show(notification))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn notifier_remove(
    notifier: State<'_, Arc<Notifier>>,
    tag: String,
) -> Result<(), String> {
    let notifier = notifier.inner().clone();
    tauri::async_runtime::spawn_blocking(move || notifier.backend().remove(&tag))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn notifier_remove_group(
    notifier: State<'_, Arc<Notifier>>,
    group: String,
) -> Result<(), String> {
    let notifier = notifier.inner().clone();
    tauri::async_runtime::spawn_blocking(move || notifier.backend().remove_group(&group))
        .await
        .map_err(|error| error.to_string())
}
