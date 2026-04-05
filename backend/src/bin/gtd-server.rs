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
use tracing_subscriber::EnvFilter;

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

fn listen_addr() -> String {
    let port = std::env::var("PORT")
        .or_else(|_| std::env::var("GTD_SERVER_PORT"))
        .unwrap_or_else(|_| "10084".to_string());
    format!("0.0.0.0:{port}")
}

#[tokio::main]
async fn main() {
    color_eyre::install().expect("color_eyre::install");

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .init();

    let addr = listen_addr();
    eprintln!("gtd-server: starting (bind {addr})");

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

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("gtd-server: ERROR bind {addr} failed: {e}");
            std::process::exit(1);
        }
    };

    let local = listener.local_addr().unwrap_or_else(|e| {
        eprintln!("gtd-server: ERROR local_addr: {e}");
        std::process::exit(1);
    });
    tracing::info!(%local, "listening");
    eprintln!("gtd-server: listening on {local}");

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("gtd-server: ERROR server exited: {e}");
        std::process::exit(1);
    }
}
