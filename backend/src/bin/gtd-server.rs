use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tokio::sync::watch::{self, Sender};

use tower_http::cors::CorsLayer;

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use gtd_cli::model::Task;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

async fn index() -> String {
    String::from("homepage")
}

async fn set_tasks(
    State(state): State<SharedState>,
    Json(input): Json<HashMap<String, Task>>,
) -> Result<impl IntoResponse, StatusCode> {
    state.write().unwrap().tasks = input;
    state.read().unwrap().tx.send("update".to_string()).unwrap();
    tracing::info!("set_tasks");
    Ok(())
}

async fn get_tasks(State(state): State<SharedState>) -> Result<impl IntoResponse, StatusCode> {
    tracing::info!("get_tasks");
    let s = state.read().unwrap();
    let mut tasks: Vec<Task> = s.tasks.values().cloned().collect();
    tasks.sort_by(|a, b| a.project.cmp(&b.project));
    Ok(Json(tasks))
}

type SharedState = Arc<RwLock<AppState>>;

struct AppState {
    tasks: HashMap<String, Task>,
    tx: Sender<String>,
}

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::TRACE)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let (tx, mut rx) = watch::channel("hello".to_string());

    let shared_state = Arc::new(RwLock::new(AppState {
        tasks: HashMap::new(),
        tx,
    }));

    let handle_socket = |mut socket: WebSocket| async move {
        loop {
            println!("{}! ", *rx.borrow_and_update());
            if rx.changed().await.is_err() {
                break;
            }
            if socket
                .send(Message::Text("update".to_string()))
                .await
                .is_err()
            {
                // client disconnected
                return;
            }
        }
    };

    let ws_handler = |ws: WebSocketUpgrade| async move { ws.on_upgrade(handle_socket) };

    let app = Router::new()
        .route("/", get(index))
        .route("/tasks", get(get_tasks).post(set_tasks))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(Arc::clone(&shared_state));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:10084")
        .await
        .unwrap();

    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
