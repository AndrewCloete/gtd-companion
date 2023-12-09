use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};

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
    tracing::info!("set_tasks");
    Ok(())
}

type SharedState = Arc<RwLock<AppState>>;

#[derive(Default)]
struct AppState {
    tasks: Vec<Task>,
}

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::TRACE)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let shared_state = SharedState::default();

    let app = Router::new()
        .route("/", get(index))
        .route("/tasks", get(get_tasks).post(set_tasks))
        .layer(CorsLayer::permissive())
        .with_state(Arc::clone(&shared_state));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8084")
        .await
        .unwrap();

    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
