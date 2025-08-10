use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    routing::post,
    Json, Router,
};
use tokio::sync::watch::{self, Sender};

use tower_http::cors::CorsLayer;

use std::sync::{Arc, RwLock};

use gtd_cli::model::Task;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;

async fn index() -> String {
    String::from("homepage")
}
async fn get_tasks(State(state): State<SharedState>) -> Result<impl IntoResponse, StatusCode> {
    tracing::info!("get_tasks");
    Ok(Json(state.read().unwrap().tasks.clone()))
}

async fn set_tasks(
    State(state): State<SharedState>,
    Json(input): Json<Vec<Task>>,
) -> Result<impl IntoResponse, StatusCode> {
    state.write().unwrap().tasks = input;
    state.read().unwrap().tx.send("update".to_string()).unwrap();
    tracing::info!("set_tasks");
    Ok(())
}

async fn star_task(
    State(state): State<SharedState>,
    input: String,
) -> Result<impl IntoResponse, StatusCode> {
    let s = &mut state.write().unwrap();
    let tasks = &mut s.tasks;
    for task in tasks.iter_mut() {
        if task.description.contains(&input) {
            task.starred = !task.starred
        }
    }
    s.tx.send("update".to_string()).unwrap();
    tracing::info!("star_task");
    Ok(())
}

type SharedState = Arc<RwLock<AppState>>;

struct AppState {
    tasks: Vec<Task>,
    tx: Sender<String>,
}

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::TRACE)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let (tx, mut rx) = watch::channel("hello".to_string());

    let shared_state = Arc::new(RwLock::new(AppState { tasks: vec![], tx }));

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
        .route("/star", post(star_task))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(Arc::clone(&shared_state));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:10084")
        .await
        .unwrap();

    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
