// ws-server/src/main.rs
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{sync::mpsc, time::interval};
use tracing::{info, warn};
use uuid::Uuid;

// Name tables

const ADJECTIVES: &[&str] = &[
    "crispy",
    "cheesy",
    "smoky",
    "golden",
    "spicy",
    "zesty",
    "fiery",
    "rustic",
    "velvety",
    "savory",
    "fresh",
    "bold",
    "silky",
    "toasty",
    "herby",
    "tangy",
    "buttery",
    "creamy",
    "loaded",
    "hearty",
    "classic",
    "gourmet",
    "artisan",
    "stonebaked",
    "charred",
    "melty",
    "peppery",
    "garlicky",
    "sizzling",
    "flavorful",
];

const STYLES: &[&str] = &[
    "margherita",
    "marinara",
    "napoli",
    "sicilian",
    "romana",
    "bianca",
    "quattroformaggi",
    "capricciosa",
    "calzone",
    "stromboli",
    "pinsa",
    "detroit",
    "deepdish",
    "hawaiian",
    "supreme",
    "veggie",
    "bbqchicken",
    "pepperoni",
    "paneertikka",
    "tandooriveggie",
    "tandoorichicken",
    "butterchicken",
    "acharipaneer",
    "masalacorn",
    "spicypaneer",
    "vegmaharaja",
    "chickentikka",
    "keemaspice",
    "mumbaimasala",
    "hyderabadispice",
];

// Wire types

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum S2CMsg<'a> {
    Welcome {
        id: &'a str,
        name: &'a str,
    },
    PeerList {
        peers: Vec<PeerSummary>,
    },
    Selected {
        #[serde(rename = "fromId")]
        from_id: &'a str,
        #[serde(rename = "fromName")]
        from_name: &'a str,
    },
    Signal {
        #[serde(rename = "fromId")]
        from_id: &'a str,
        data: &'a Value,
    },
    TransferComplete,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum C2SMsg {
    RegisterIps {
        #[serde(rename = "localIps")]
        local_ips: Vec<String>,
    },

    SelectPeer {
        #[serde(rename = "targetId")]
        target_id: String,
    },

    Signal {
        #[serde(rename = "targetId")]
        target_id: String,
        data: Value,
    },

    TransferComplete {
        #[serde(rename = "targetId")]
        target_id: String,
    },
}

#[derive(Serialize, Clone)]
struct PeerSummary {
    id: String,
    name: String,
}

// Per-peer entry

struct Peer {
    id: String,
    name: String,
    remote_ip: String,
    local_ips: Vec<String>,
    /// Outbound message queue for this peer's write task.
    tx: mpsc::Sender<String>,
}

// Shared state

struct AppState {
    peers: DashMap<String, Peer>,
    used_names: DashMap<String, ()>,
    allowed_origins: Vec<String>,
}

impl AppState {
    /// Picks a unique `adjective-style` name; falls back to numbered suffixes.
    fn pick_unique_name(&self) -> String {
        // Mix connection count + nanos for spread across the table.
        let seed = self.peers.len().wrapping_mul(7919)
            ^ std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.subsec_nanos() as usize)
                .unwrap_or(0);

        let total = ADJECTIVES.len() * STYLES.len();
        for i in 0..total * 2 {
            let adj = ADJECTIVES[(seed.wrapping_add(i.wrapping_mul(7))) % ADJECTIVES.len()];
            let sty = STYLES[(seed.wrapping_add(i.wrapping_mul(13))) % STYLES.len()];
            let name = format!("{}-{}", adj, sty);
            if !self.used_names.contains_key(&name) {
                return name;
            }
        }
        let mut suffix = 1usize;
        loop {
            for adj in ADJECTIVES {
                for sty in STYLES {
                    let name = format!("{}-{}-{}", adj, sty, suffix);
                    if !self.used_names.contains_key(&name) {
                        return name;
                    }
                }
            }
            suffix += 1;
        }
    }

    /*fn is_allowed_origin(&self, origin: &str) -> bool {
        if self.allowed_origins.iter().any(|o| o == origin) {
            return true;
        }
        if let Ok(url) = url::Url::parse(origin) {
            if url.scheme() == "https" {
                if let Some(host) = url.host_str() {
                    if host.ends_with(".vercel.app") {
                        return true;
                    }
                }
            }
        }
        false
    }*/

    fn is_allowed_origin(&self, origin: &str) -> bool {
        self.allowed_origins.iter().any(|o| o == origin)
    }
}

// Room logic (mirrors TS exactly)

fn get_slash24(ip: &str) -> Option<String> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        Some(parts[..3].join("."))
    } else {
        None
    }
}

fn is_link_local(ip: &str) -> bool {
    let lower = ip.to_ascii_lowercase();
    lower.starts_with("fe80:")
}

fn peers_share_subnet(a_ips: &[String], b_ips: &[String]) -> bool {
    let a_ll = a_ips.iter().any(|ip| is_link_local(ip));
    let b_ll = b_ips.iter().any(|ip| is_link_local(ip));
    if a_ll && b_ll {
        return true;
    }
    let a_prefixes: std::collections::HashSet<String> =
        a_ips.iter().filter_map(|ip| get_slash24(ip)).collect();
    b_ips
        .iter()
        .filter_map(|ip| get_slash24(ip))
        .any(|p| a_prefixes.contains(&p))
}

fn in_same_room(a: &Peer, b: &Peer) -> bool {
    if !a.local_ips.is_empty() && !b.local_ips.is_empty() {
        peers_share_subnet(&a.local_ips, &b.local_ips)
    } else {
        a.remote_ip == b.remote_ip
    }
}

// Signalling helpers

/// Serialise a message and push it onto a peer's outbound channel.
fn push(tx: &mpsc::Sender<String>, msg: &S2CMsg) {
    if let Ok(json) = serde_json::to_string(msg) {
        let _ = tx.try_send(json); // non-blocking; drops if channel full (slow client)
    }
}

fn broadcast_peer_list(state: &Arc<AppState>, peer_id: &str) {
    // Snapshot the "self" peer's addressing info first.
    let (self_remote, self_locals) = match state.peers.get(peer_id) {
        Some(p) => (p.remote_ip.clone(), p.local_ips.clone()),
        None => return,
    };

    // Build a temporary fake Peer for room comparisons without holding a lock.
    let self_snapshot = Peer {
        id: peer_id.to_string(),
        name: String::new(),
        remote_ip: self_remote,
        local_ips: self_locals,
        tx: state
            .peers
            .get(peer_id)
            .map(|p| p.tx.clone())
            .unwrap_or_else(|| mpsc::channel(1).0),
    };

    // Collect room members and the full peer list.
    let room_txs: Vec<mpsc::Sender<String>> = state
        .peers
        .iter()
        .filter(|e| in_same_room(&self_snapshot, e.value()))
        .map(|e| e.value().tx.clone())
        .collect();

    let list: Vec<PeerSummary> = state
        .peers
        .iter()
        .filter(|e| in_same_room(&self_snapshot, e.value()))
        .map(|e| PeerSummary {
            id: e.value().id.clone(),
            name: e.value().name.clone(),
        })
        .collect();

    let msg = S2CMsg::PeerList { peers: list };
    if let Ok(json) = serde_json::to_string(&msg) {
        for tx in room_txs {
            let _ = tx.try_send(json.clone());
        }
    }
}

fn remove_peer(state: &Arc<AppState>, id: &str) {
    if let Some((_, peer)) = state.peers.remove(id) {
        state.used_names.remove(&peer.name);

        // Notify all peers that shared a room with the removed peer.
        let affected: Vec<String> = state
            .peers
            .iter()
            .filter(|e| in_same_room(&peer, e.value()))
            .map(|e| e.value().id.clone())
            .collect();

        for affected_id in affected {
            broadcast_peer_list(state, &affected_id);
        }
    }
}

// HTTP routes

async fn health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "ok": true, "peers": state.peers.len() }))
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !state.is_allowed_origin(&origin) {
        warn!("[WS] Rejected origin: {origin}");
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }

    let remote_ip = extract_ip(&headers, addr);
    ws.on_upgrade(move |socket| handle_socket(socket, state, remote_ip))
        .into_response()
}

fn extract_ip(headers: &HeaderMap, addr: SocketAddr) -> String {
    if let Some(fwd) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        let ip = fwd.split(',').next().unwrap_or("").trim();
        if !ip.is_empty() {
            return normalize_ip(ip);
        }
    }
    normalize_ip(&addr.ip().to_string())
}

fn normalize_ip(raw: &str) -> String {
    if let Some(s) = raw.strip_prefix("::ffff:") {
        return s.to_string();
    }
    if raw == "::1" {
        return "127.0.0.1".to_string();
    }
    raw.to_string()
}

// Per-connection handler

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, remote_ip: String) {
    use futures_util::{SinkExt, StreamExt};

    let id = Uuid::new_v4().to_string();
    let name = state.pick_unique_name();
    state.used_names.insert(name.clone(), ());

    // 256-slot channel — enough for bursts; drops silently for lagging clients.
    let (tx, mut rx) = mpsc::channel::<String>(256);

    state.peers.insert(
        id.clone(),
        Peer {
            id: id.clone(),
            name: name.clone(),
            remote_ip,
            local_ips: vec![],
            tx: tx.clone(),
        },
    );

    info!(
        "[WS] Connected: {id} ({name}). Total: {}",
        state.peers.len()
    );

    let (mut sink, mut stream) = socket.split();

    // Dedicated write task: drains rx → WS sink.
    // Keeps the read loop below free of send awaits.
    let write_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            // "__ping__" sentinel triggers a real WS ping frame.
            let frame = if msg == "__ping__" {
                Message::Ping(vec![].into())
            } else {
                Message::Text(msg.into())
            };
            if sink.send(frame).await.is_err() {
                break;
            }
        }
    });

    // Send welcome then broadcast initial peer list.
    if tx
        .send(
            serde_json::to_string(&S2CMsg::Welcome {
                id: &id,
                name: &name,
            })
            .unwrap_or_default(),
        )
        .await
        .is_err()
    {
        write_task.abort();
        remove_peer(&state, &id);
        return;
    }
    broadcast_peer_list(&state, &id);

    // Read loop + heartbeat
    let mut hb = interval(Duration::from_secs(30));
    hb.tick().await; // skip the immediate first tick
    let mut missed = 0u8;

    loop {
        tokio::select! {
            _ = hb.tick() => {
                missed += 1;
                if missed > 1 {
                    warn!("[WS] Heartbeat timeout for {id} ({name}), terminating");
                    break;
                }
                if tx.send("__ping__".to_string()).await.is_err() {
                    break;
                }
            }

            msg = stream.next() => {
                match msg {
                    None | Some(Ok(Message::Close(_))) => break,
                    Some(Err(_)) => break,

                    Some(Ok(Message::Pong(_))) => {
                        missed = 0;
                    }

                    Some(Ok(Message::Text(text))) => {
                        missed = 0;
                        if text.len() > 65_536 {
                            warn!("[WS] Oversized message from {id}, ignoring");
                            continue;
                        }
                        match serde_json::from_str::<C2SMsg>(&text) {
                            Ok(c2s) => handle_c2s(&state, &id, &name, c2s),
                            Err(e) => {
                                println!("DESERIALIZE ERROR: {}", e);
                        }
                        }
                    }

                    Some(Ok(_)) => { missed = 0; } // Binary / Ping handled by axum
                }
            }
        }
    }

    write_task.abort();
    remove_peer(&state, &id);
    info!(
        "[WS] Disconnected: {id} ({name}). Total: {}",
        state.peers.len()
    );
}

fn handle_c2s(state: &Arc<AppState>, id: &str, name: &str, msg: C2SMsg) {
    match msg {
        C2SMsg::RegisterIps { local_ips } => {
            // println!("REGISTER IPS: {:?}", local_ips);
            if let Some(mut peer) = state.peers.get_mut(id) {
                peer.local_ips = local_ips
                    .into_iter()
                    .filter(|ip| ip.len() < 64 && !ip.starts_with("127.") && ip != "::1")
                    .take(20)
                    .collect();
                info!(
                    "[WS] {id} ({name}) registered local IPs: {}",
                    peer.local_ips.join(", ")
                );
            }
            // Broadcast to all room members so peers who connected before us
            // also learn we exist now that IPs are resolved.
            let room_members: Vec<String> = state
                .peers
                .iter()
                .filter(|e| {
                    if let Some(self_peer) = state.peers.get(id) {
                        in_same_room(&self_peer, e.value())
                    } else {
                        false
                    }
                })
                .map(|e| e.key().clone())
                .collect();
            for member_id in room_members {
                broadcast_peer_list(state, &member_id);
            }
        }

        C2SMsg::SelectPeer { target_id } => {
            // println!("SELECT {}", target_id);
            if target_id == id {
                return;
            }
            let self_ref = state.peers.get(id);
            let tgt_ref = state.peers.get(&target_id);
            if let (Some(s), Some(t)) = (self_ref, tgt_ref) {
                if in_same_room(&s, &t) {
                    push(
                        &t.tx,
                        &S2CMsg::Selected {
                            from_id: id,
                            from_name: &s.name,
                        },
                    );
                }
            }
        }

        C2SMsg::Signal { target_id, data } => {
            // println!("SIGNAL to {}: {}", target_id, data);
            if target_id == id {
                return;
            }
            if let Some(t) = state.peers.get(&target_id) {
                push(
                    &t.tx,
                    &S2CMsg::Signal {
                        from_id: id,
                        data: &data,
                    },
                );
            }
        }

        C2SMsg::TransferComplete { target_id } => {
            if target_id == id {
                return;
            }
            let self_ref = state.peers.get(id);
            let tgt_ref = state.peers.get(&target_id);
            if let (Some(s), Some(t)) = (self_ref, tgt_ref) {
                if in_same_room(&s, &t) {
                    push(&t.tx, &S2CMsg::TransferComplete);
                }
            }
        }
    }
}

// Entry point

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("ws_server=info".parse().unwrap()),
        )
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4000);

    let allowed_origins: Vec<String> = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    info!("[WS] Allowed origins: {}", allowed_origins.join(", "));

    let state = Arc::new(AppState {
        peers: DashMap::new(),
        used_names: DashMap::new(),
        allowed_origins,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_upgrade))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("[WS] Listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
