from pathlib import Path
from typing import Any, Dict, Optional
import os
import re
import shutil
import sqlite3
import time
import uuid

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


app = FastAPI(title="QingKang Station API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("QINGKANG_DB_PATH", BASE_DIR / "data.db"))
UPLOAD_DIR = Path(os.getenv("QINGKANG_UPLOAD_DIR", BASE_DIR / "uploads"))

UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

DEFAULT_DEVICE_ID = "esp32_s3_001"
MEASUREMENT_TIMEOUT_SECONDS = 120
DEVICE_OFFLINE_SECONDS = 20

SESSION_ACTIVE_STATUSES = {"QUEUED", "READY", "MEASURING"}
SESSION_DONE_STATUSES = {"FINISHED", "TIMEOUT", "CANCELLED"}
SESSION_STATUSES = SESSION_ACTIVE_STATUSES | SESSION_DONE_STATUSES
DEVICE_STATES = {"IDLE", "READY", "MEASURING", "DISCONNECTED"}
HEART_STATES = {
    "IDLE",
    "READY",
    "PLACE_FINGER",
    "HOLD_STILL",
    "MEASURING",
    "ADJUST_FINGER",
    "FINISHED",
    "TIMEOUT",
    "CANCELLED",
    "DISCONNECTED",
}


def now_ts() -> int:
    return int(time.time())


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    return dict(row) if row else None


def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()
    created_at = now_ts()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            nickname TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS measurement_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            nickname TEXT NOT NULL,
            status TEXT NOT NULL,
            queue_position INTEGER,
            started_at INTEGER,
            finished_at INTEGER,
            expires_at INTEGER,
            created_at INTEGER NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS device_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL UNIQUE,
            current_session_id TEXT,
            state TEXT NOT NULL,
            last_seen INTEGER,
            created_at INTEGER NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS heart_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            user_id TEXT,
            device_id TEXT,
            bpm INTEGER,
            raw INTEGER,
            amplitude REAL,
            state TEXT,
            created_at INTEGER NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tongue_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            user_id TEXT,
            image_path TEXT NOT NULL,
            quality TEXT,
            tongue_detected INTEGER,
            coating_color TEXT,
            coating_ratio REAL,
            note TEXT,
            created_at INTEGER NOT NULL
        )
        """
    )

    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_status_id ON measurement_sessions(status, id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_heart_session_id ON heart_records(session_id, id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_tongue_session_id ON tongue_records(session_id, id)"
    )
    cur.execute(
        """
        INSERT OR IGNORE INTO device_status
        (device_id, current_session_id, state, last_seen, created_at)
        VALUES (?, NULL, 'IDLE', NULL, ?)
        """,
        (DEFAULT_DEVICE_ID, created_at),
    )

    conn.commit()
    conn.close()


class UserLoginRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=50)
    user_id: Optional[str] = None


class QueueJoinRequest(BaseModel):
    user_id: str = Field(min_length=1)
    nickname: Optional[str] = Field(default=None, max_length=50)
    device_id: str = DEFAULT_DEVICE_ID


class HeartRateData(BaseModel):
    session_id: str = Field(min_length=1)
    user_id: Optional[str] = None
    device_id: str = DEFAULT_DEVICE_ID
    bpm: Optional[int] = None
    raw: Optional[int] = None
    amplitude: Optional[float] = None
    state: str = "READY"


class SessionActionRequest(BaseModel):
    device_id: str = DEFAULT_DEVICE_ID
    reason: Optional[str] = None


class DeviceReleaseRequest(BaseModel):
    device_id: str = DEFAULT_DEVICE_ID
    session_id: str = Field(min_length=1)
    status: str = "FINISHED"


def sanitize_identifier(value: str, fallback: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", value or "").strip("._")
    return safe or fallback


def sanitize_nickname(nickname: Optional[str]) -> str:
    normalized = re.sub(r"\s+", " ", (nickname or "").strip())
    return normalized[:32] or "同学"


def sanitize_filename(filename: Optional[str]) -> str:
    original_name = Path(filename or "tongue_image").name
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_name).strip("._")
    return safe_name or "tongue_image"


def normalize_heart_state(state: Optional[str]) -> str:
    normalized = (state or "READY").strip().upper().replace(" ", "_")
    if normalized == "PLACEFINGER":
        normalized = "PLACE_FINGER"
    if normalized not in HEART_STATES:
        raise HTTPException(status_code=422, detail="心率设备状态暂不支持，请检查固件上传状态")
    return normalized


def ensure_device(conn: sqlite3.Connection, device_id: str) -> sqlite3.Row:
    cur = conn.cursor()
    cur.execute("SELECT * FROM device_status WHERE device_id = ?", (device_id,))
    row = cur.fetchone()
    if row:
        return row

    created_at = now_ts()
    cur.execute(
        """
        INSERT INTO device_status
        (device_id, current_session_id, state, last_seen, created_at)
        VALUES (?, NULL, 'IDLE', NULL, ?)
        """,
        (device_id, created_at),
    )
    cur.execute("SELECT * FROM device_status WHERE device_id = ?", (device_id,))
    return cur.fetchone()


def fetch_session(conn: sqlite3.Connection, session_id: str) -> Optional[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM measurement_sessions WHERE session_id = ?", (session_id,))
    return cur.fetchone()


def update_queue_positions(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT session_id
        FROM measurement_sessions
        WHERE status = 'QUEUED'
        ORDER BY id ASC
        """
    )
    for index, row in enumerate(cur.fetchall(), start=1):
        cur.execute(
            "UPDATE measurement_sessions SET queue_position = ? WHERE session_id = ?",
            (index, row["session_id"]),
        )

    cur.execute(
        """
        UPDATE measurement_sessions
        SET queue_position = 0
        WHERE status IN ('READY', 'MEASURING')
        """
    )
    cur.execute(
        """
        UPDATE measurement_sessions
        SET queue_position = NULL
        WHERE status IN ('FINISHED', 'TIMEOUT', 'CANCELLED')
        """
    )


def set_device_idle(conn: sqlite3.Connection, device_id: str, state: str = "IDLE") -> None:
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE device_status
        SET current_session_id = NULL, state = ?
        WHERE device_id = ?
        """,
        (state, device_id),
    )


def close_session(
    conn: sqlite3.Connection,
    session_id: str,
    status: str,
    device_id: str = DEFAULT_DEVICE_ID,
) -> None:
    if status not in SESSION_DONE_STATUSES:
        raise HTTPException(status_code=422, detail="本次记录结束状态不支持")

    finished_at = now_ts()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE measurement_sessions
        SET status = ?, finished_at = ?, expires_at = NULL, queue_position = NULL
        WHERE session_id = ? AND status NOT IN ('FINISHED', 'TIMEOUT', 'CANCELLED')
        """,
        (status, finished_at, session_id),
    )
    cur.execute(
        """
        UPDATE device_status
        SET current_session_id = NULL, state = 'IDLE'
        WHERE device_id = ? AND current_session_id = ?
        """,
        (device_id, session_id),
    )


def run_queue_maintenance(conn: sqlite3.Connection, device_id: str = DEFAULT_DEVICE_ID) -> None:
    device = ensure_device(conn, device_id)
    timestamp = now_ts()
    cur = conn.cursor()
    device_online = bool(device["last_seen"]) and timestamp - int(device["last_seen"]) <= DEVICE_OFFLINE_SECONDS

    active_session_id = device["current_session_id"]
    if active_session_id:
        active = fetch_session(conn, active_session_id)
        if not active or active["status"] in SESSION_DONE_STATUSES:
            set_device_idle(conn, device_id)
            active_session_id = None
        elif not device_online:
            close_session(conn, active_session_id, "TIMEOUT", device_id)
            active_session_id = None
        elif active["expires_at"] and active["expires_at"] <= timestamp:
            close_session(conn, active_session_id, "TIMEOUT", device_id)
            active_session_id = None

    if not active_session_id:
        cur.execute(
            """
            SELECT *
            FROM measurement_sessions
            WHERE status = 'QUEUED'
            ORDER BY id ASC
            LIMIT 1
            """
        )
        next_session = cur.fetchone()
        if next_session and device_online:
            expires_at = timestamp + MEASUREMENT_TIMEOUT_SECONDS
            cur.execute(
                """
                UPDATE measurement_sessions
                SET status = 'READY',
                    queue_position = 0,
                    started_at = COALESCE(started_at, ?),
                    expires_at = ?
                WHERE session_id = ?
                """,
                (timestamp, expires_at, next_session["session_id"]),
            )
            cur.execute(
                """
                UPDATE device_status
                SET current_session_id = ?, state = 'READY'
                WHERE device_id = ?
                """,
                (next_session["session_id"], device_id),
            )
        else:
            current_state = "IDLE"
            if not device_online:
                current_state = "DISCONNECTED"
            set_device_idle(conn, device_id, current_state)

    update_queue_positions(conn)
    conn.commit()


def latest_heart(conn: sqlite3.Connection, session_id: str) -> Optional[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT bpm, raw, amplitude, state, created_at
        FROM heart_records
        WHERE session_id = ?
          AND (bpm > 0 OR state IN ('HOLD_STILL', 'MEASURING', 'ADJUST_FINGER'))
        ORDER BY id DESC
        LIMIT 1
        """,
        (session_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "bpm": row["bpm"],
        "raw": row["raw"],
        "amplitude": row["amplitude"],
        "state": row["state"],
        "created_at": row["created_at"],
    }


def latest_tongue(conn: sqlite3.Connection, session_id: str) -> Optional[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT image_path, quality, tongue_detected, coating_color,
               coating_ratio, note, created_at
        FROM tongue_records
        WHERE session_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (session_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "image_path": row["image_path"],
        "quality": row["quality"],
        "tongue_detected": bool(row["tongue_detected"]),
        "coating_color": row["coating_color"],
        "coating_ratio": row["coating_ratio"],
        "note": row["note"],
        "created_at": row["created_at"],
    }


def make_heart_suggestion(bpm: Optional[int], state: str) -> str:
    normalized = normalize_heart_state(state)
    if normalized in {"READY", "PLACE_FINGER"}:
        return "轮到你了，请将手指轻放在传感器上。"
    if normalized == "HOLD_STILL":
        return "正在稳定信号，请保持手指不动。"
    if normalized == "ADJUST_FINGER":
        return "当前信号不够稳定，请轻轻调整接触位置。"
    if normalized != "MEASURING":
        return "当前未处于连续记录状态，请根据页面提示完成测量。"
    if not bpm or bpm <= 0:
        return "正在记录心率变化，请继续保持手指。"
    if bpm < 60:
        return "本次心率记录低于常见静息区间，建议稍后结合趋势继续观察。"
    if bpm <= 100:
        return "本次心率记录处于常见静息区间，可作为学习生活状态参考。"
    return "本次心率记录高于常见静息区间，建议短暂停下并尝试慢呼吸。"


def analyze_tongue_placeholder(image_path: str) -> dict[str, Any]:
    return {
        "quality": "waiting_ai",
        "tongue_detected": False,
        "coating_color": "pending",
        "coating_ratio": 0.0,
        "note": "舌象图片已记录，YOLO 舌体检测和图像质量分析待接入。",
    }


def make_combined_observation(
    session: Optional[dict[str, Any]],
    heart: Optional[dict[str, Any]],
    tongue: Optional[dict[str, Any]],
) -> dict[str, Any]:
    status = session["status"] if session else "UNKNOWN"
    suggestions: list[str] = []

    if status == "QUEUED":
        summary = "你已进入测量队列，请等待公共设备分配。"
    elif status == "READY":
        summary = "轮到你了，可以开始本次轻健康状态记录。"
    elif status == "MEASURING":
        summary = "正在合并本次心率记录和舌象记录。"
    elif status == "FINISHED":
        summary = "本次观察记录已完成，可用于后续趋势对比。"
    elif status == "TIMEOUT":
        summary = "本次测量已超时，可以重新加入队列。"
    elif status == "CANCELLED":
        summary = "本次测量已取消。"
    else:
        summary = "暂无完整测量记录。"

    if heart:
        suggestions.append(make_heart_suggestion(heart.get("bpm"), heart.get("state") or "READY"))
    else:
        suggestions.append("暂无心率记录，建议先完成公共设备测量。")

    if tongue:
        suggestions.append("舌象图片已保存，后续可接入图像质量分析和舌体区域识别。")
    else:
        suggestions.append("可上传一张舌象图片，用于完善本次观察记录。")

    suggestions.append("茶息建议：短暂停下，补充温水，观察身体状态变化。")
    suggestions.append("呼吸建议：尝试 30 秒慢呼吸，让本次记录更稳定。")

    disclaimer = "本系统仅用于健康状态观察和科普记录，不作为医学诊断依据。"
    return {
        "summary": summary,
        "suggestions": suggestions,
        "disclaimer": disclaimer,
    }


def get_session_payload(
    conn: sqlite3.Connection,
    session_id: str,
    device_id: str = DEFAULT_DEVICE_ID,
) -> dict[str, Any]:
    session_row = fetch_session(conn, session_id)
    session = row_to_dict(session_row)
    heart = latest_heart(conn, session_id)
    tongue = latest_tongue(conn, session_id)
    device = row_to_dict(ensure_device(conn, device_id))

    queue = None
    if session:
        position = session.get("queue_position")
        active_session_id = device.get("current_session_id") if device else None
        active_ahead = (
            1
            if session["status"] == "QUEUED"
            and active_session_id
            and active_session_id != session["session_id"]
            else 0
        )
        people_ahead = (
            max(int(position or 0) - 1, 0) + active_ahead
            if session["status"] == "QUEUED"
            else 0
        )
        queue = {
            "position": position,
            "people_ahead": people_ahead,
            "is_active": session["status"] in {"READY", "MEASURING"},
        }

    observation = make_combined_observation(session, heart, tongue)

    return {
        "ok": bool(session or heart or tongue),
        "session_id": session_id,
        "session": session,
        "device": device,
        "queue": queue,
        "heart": heart,
        "tongue": tongue,
        "combined_observation": observation,
        "combined_suggestion": " ".join(observation["suggestions"] + [observation["disclaimer"]]),
    }


def get_user_by_id(conn: sqlite3.Connection, user_id: str) -> Optional[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    return cur.fetchone()


def get_or_create_legacy_session(
    conn: sqlite3.Connection,
    session_id: str,
    user_id: str,
    nickname: str,
) -> None:
    if fetch_session(conn, session_id):
        return
    timestamp = now_ts()
    conn.execute(
        """
        INSERT INTO measurement_sessions
        (session_id, user_id, nickname, status, queue_position,
         started_at, finished_at, expires_at, created_at)
        VALUES (?, ?, ?, 'FINISHED', NULL, ?, ?, NULL, ?)
        """,
        (session_id, user_id, nickname, timestamp, timestamp, timestamp),
    )


init_db()


@app.get("/")
def root():
    return {
        "name": "青康小站 API",
        "status": "running",
        "docs": "/docs",
        "device_poll": "/api/device/poll?device_id=esp32_s3_001",
        "device_status": "/api/device/status?device_id=esp32_s3_001",
        "heart_upload": "/api/heart-rate",
    }


@app.post("/api/users/login")
def login_user(data: UserLoginRequest):
    nickname = sanitize_nickname(data.nickname)
    user_id = sanitize_identifier(data.user_id or f"user_{uuid.uuid4().hex[:12]}", "user")
    timestamp = now_ts()

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO users (user_id, nickname, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname
        """,
        (user_id, nickname, timestamp),
    )
    conn.commit()
    cur.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    user = row_to_dict(cur.fetchone())
    conn.close()

    return {"ok": True, "user": user}


@app.post("/api/queue/join")
def join_queue(data: QueueJoinRequest):
    user_id = sanitize_identifier(data.user_id, "user")
    device_id = sanitize_identifier(data.device_id, DEFAULT_DEVICE_ID)
    nickname = sanitize_nickname(data.nickname)
    timestamp = now_ts()

    conn = get_conn()
    cur = conn.cursor()

    user = get_user_by_id(conn, user_id)
    if user:
        nickname = sanitize_nickname(data.nickname or user["nickname"])
    else:
        cur.execute(
            """
            INSERT INTO users (user_id, nickname, created_at)
            VALUES (?, ?, ?)
            """,
            (user_id, nickname, timestamp),
        )

    cur.execute(
        """
        SELECT session_id
        FROM measurement_sessions
        WHERE user_id = ? AND status IN ('QUEUED', 'READY', 'MEASURING')
        ORDER BY id DESC
        LIMIT 1
        """,
        (user_id,),
    )
    existing = cur.fetchone()
    if existing:
        run_queue_maintenance(conn, device_id)
        payload = get_session_payload(conn, existing["session_id"], device_id)
        conn.close()
        return {"ok": True, "message": "already in queue or measuring", **payload}

    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    cur.execute(
        """
        INSERT INTO measurement_sessions
        (session_id, user_id, nickname, status, queue_position,
         started_at, finished_at, expires_at, created_at)
        VALUES (?, ?, ?, 'QUEUED', NULL, NULL, NULL, NULL, ?)
        """,
        (session_id, user_id, nickname, timestamp),
    )

    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, session_id, device_id)
    conn.close()
    return {"ok": True, "message": "joined queue", **payload}


@app.get("/api/session/{session_id}")
def get_session(session_id: str, device_id: str = Query(DEFAULT_DEVICE_ID)):
    conn = get_conn()
    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, session_id, device_id)
    conn.close()
    if not payload["ok"]:
        raise HTTPException(status_code=404, detail="没有找到对应记录，请重新开始")
    return payload


@app.post("/api/session/{session_id}/finish")
def finish_session(session_id: str, data: SessionActionRequest = SessionActionRequest()):
    device_id = sanitize_identifier(data.device_id, DEFAULT_DEVICE_ID)
    conn = get_conn()
    if not fetch_session(conn, session_id):
        conn.close()
        raise HTTPException(status_code=404, detail="没有找到对应记录，请重新开始")
    close_session(conn, session_id, "FINISHED", device_id)
    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, session_id, device_id)
    conn.close()
    return {"ok": True, "message": "session finished", **payload}


@app.post("/api/session/{session_id}/cancel")
def cancel_session(session_id: str, data: SessionActionRequest = SessionActionRequest()):
    device_id = sanitize_identifier(data.device_id, DEFAULT_DEVICE_ID)
    conn = get_conn()
    if not fetch_session(conn, session_id):
        conn.close()
        raise HTTPException(status_code=404, detail="没有找到对应记录，请重新开始")
    close_session(conn, session_id, "CANCELLED", device_id)
    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, session_id, device_id)
    conn.close()
    return {"ok": True, "message": "session cancelled", **payload}


def build_device_status_payload(
    conn: sqlite3.Connection,
    device_id: str,
    timestamp: Optional[int] = None,
) -> Dict[str, Any]:
    timestamp = timestamp or now_ts()
    device = row_to_dict(ensure_device(conn, device_id))

    active_payload = None
    if device and device.get("current_session_id"):
        session = fetch_session(conn, device["current_session_id"])
        if session:
            active_payload = {
                "session_id": session["session_id"],
                "user_id": session["user_id"],
                "nickname": session["nickname"],
                "status": session["status"],
                "started_at": session["started_at"],
                "expires_at": session["expires_at"],
            }

    state = device["state"] if device else "IDLE"
    message = "Waiting / Idle" if not active_payload else f"Active session: {active_payload['nickname']}"
    return {
        "ok": True,
        "server_time": timestamp,
        "device_id": device_id,
        "state": state,
        "active_session": active_payload,
        "heart_upload": "/api/heart-rate",
        "poll_interval_ms": 1000,
        "message": message,
    }


@app.get("/api/device/poll")
def poll_device(device_id: str = Query(DEFAULT_DEVICE_ID)):
    device_id = sanitize_identifier(device_id, DEFAULT_DEVICE_ID)
    timestamp = now_ts()
    conn = get_conn()
    ensure_device(conn, device_id)
    conn.execute(
        """
        UPDATE device_status
        SET last_seen = ?
        WHERE device_id = ?
        """,
        (timestamp, device_id),
    )
    run_queue_maintenance(conn, device_id)
    payload = build_device_status_payload(conn, device_id, timestamp)
    conn.close()
    return payload


@app.get("/api/device/status")
def get_device_status(device_id: str = Query(DEFAULT_DEVICE_ID)):
    device_id = sanitize_identifier(device_id, DEFAULT_DEVICE_ID)
    conn = get_conn()
    ensure_device(conn, device_id)
    run_queue_maintenance(conn, device_id)
    payload = build_device_status_payload(conn, device_id)
    conn.close()
    return payload


@app.post("/api/device/release")
def release_device(data: DeviceReleaseRequest):
    device_id = sanitize_identifier(data.device_id, DEFAULT_DEVICE_ID)
    status = data.status.strip().upper()
    if status not in SESSION_DONE_STATUSES:
        raise HTTPException(status_code=422, detail="本次记录结束状态不支持")

    conn = get_conn()
    if not fetch_session(conn, data.session_id):
        conn.close()
        raise HTTPException(status_code=404, detail="没有找到对应记录，请重新开始")
    close_session(conn, data.session_id, status, device_id)
    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, data.session_id, device_id)
    conn.close()
    return {"ok": True, "message": "device released", **payload}


@app.post("/api/heart-rate")
def upload_heart_rate(data: HeartRateData):
    state = normalize_heart_state(data.state)
    device_id = sanitize_identifier(data.device_id, DEFAULT_DEVICE_ID)
    timestamp = now_ts()

    conn = get_conn()
    run_queue_maintenance(conn, device_id)
    device = ensure_device(conn, device_id)
    current_session_id = device["current_session_id"]
    if not current_session_id:
        conn.close()
        raise HTTPException(status_code=409, detail="公共设备暂未分配给本次记录，请先加入队列")
    if current_session_id != data.session_id:
        conn.close()
        raise HTTPException(status_code=409, detail="当前还没有轮到这位同学，请继续等待")

    session = fetch_session(conn, data.session_id)
    if not session or session["status"] in SESSION_DONE_STATUSES:
        conn.close()
        raise HTTPException(status_code=409, detail="本次记录已结束，请重新加入队列")

    if state in {"FINISHED", "TIMEOUT", "CANCELLED"}:
        final_status = "FINISHED" if state == "FINISHED" else state
        close_session(conn, data.session_id, final_status, device_id)
    else:
        session_status = "MEASURING" if state == "MEASURING" else "READY"
        device_state = "MEASURING" if state == "MEASURING" else "READY"
        conn.execute(
            """
            UPDATE measurement_sessions
            SET status = ?,
                started_at = COALESCE(started_at, ?)
            WHERE session_id = ?
            """,
            (session_status, timestamp, data.session_id),
        )
        conn.execute(
            """
            UPDATE device_status
            SET state = ?
            WHERE device_id = ?
            """,
            (device_state, device_id),
        )

    should_record_heart = state not in {"READY", "PLACE_FINGER"} or bool(data.bpm and data.bpm > 0)
    if should_record_heart:
        conn.execute(
            """
            INSERT INTO heart_records
            (session_id, user_id, device_id, bpm, raw, amplitude, state, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.session_id,
                data.user_id or session["user_id"],
                device_id,
                data.bpm,
                data.raw,
                data.amplitude,
                state,
                timestamp,
            ),
        )

    conn.commit()
    run_queue_maintenance(conn, device_id)
    payload = get_session_payload(conn, data.session_id, device_id)
    conn.close()
    return {
        "accepted": True,
        "recorded": should_record_heart,
        "message": "心率记录已接收" if should_record_heart else "心率状态已接收",
        **payload,
    }


@app.post("/api/tongue-image")
async def upload_tongue_image(
    session_id: str = Form(""),
    user_id: str = Form("demo_user"),
    file: UploadFile = File(...),
):
    timestamp = now_ts()
    user_id = sanitize_identifier(user_id, "demo_user")
    requested_session_id = session_id.strip()
    session_id = sanitize_identifier(requested_session_id or f"sess_{uuid.uuid4().hex[:12]}", "session")
    safe_session = sanitize_identifier(session_id, "session")
    safe_name = sanitize_filename(file.filename)
    safe_filename = f"{safe_session}_{timestamp}_{safe_name}"

    absolute_image_path = UPLOAD_DIR / safe_filename
    stored_image_path = str(Path("uploads") / safe_filename).replace("\\", "/")

    with absolute_image_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_tongue_placeholder(stored_image_path)

    conn = get_conn()
    if not fetch_session(conn, session_id):
        user = get_user_by_id(conn, user_id)
        get_or_create_legacy_session(
            conn,
            session_id=session_id,
            user_id=user_id,
            nickname=sanitize_nickname(user["nickname"] if user else user_id),
        )

    conn.execute(
        """
        INSERT INTO tongue_records
        (session_id, user_id, image_path, quality, tongue_detected,
         coating_color, coating_ratio, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            user_id,
            stored_image_path,
            result["quality"],
            int(result["tongue_detected"]),
            result["coating_color"],
            result["coating_ratio"],
            result["note"],
            timestamp,
        ),
    )

    conn.commit()
    payload = get_session_payload(conn, session_id)
    conn.close()

    return {
        "ok": True,
        "message": "tongue image uploaded",
        "session_id": session_id,
        "image_path": stored_image_path,
        "tongue_result": result,
        **payload,
    }


@app.get("/api/latest")
def get_latest(device_id: str = Query(DEFAULT_DEVICE_ID)):
    conn = get_conn()
    run_queue_maintenance(conn, device_id)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT session_id
        FROM measurement_sessions
        ORDER BY COALESCE(finished_at, started_at, created_at) DESC, id DESC
        LIMIT 1
        """
    )
    row = cur.fetchone()

    if not row:
        cur.execute(
            """
            SELECT session_id
            FROM heart_records
            ORDER BY id DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        conn.close()
        return {"ok": False, "message": "no data"}

    payload = get_session_payload(conn, row["session_id"], device_id)
    conn.close()
    return payload


@app.get("/api/history")
def get_history(
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=8, ge=1, le=50),
    device_id: str = Query(DEFAULT_DEVICE_ID),
):
    conn = get_conn()
    run_queue_maintenance(conn, device_id)
    cur = conn.cursor()
    if user_id:
        cur.execute(
            """
            SELECT session_id
            FROM measurement_sessions
            WHERE user_id = ?
            ORDER BY COALESCE(finished_at, started_at, created_at) DESC, id DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
    else:
        cur.execute(
            """
            SELECT session_id
            FROM measurement_sessions
            ORDER BY COALESCE(finished_at, started_at, created_at) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
    sessions = [get_session_payload(conn, row["session_id"], device_id) for row in cur.fetchall()]
    conn.close()
    return {"ok": True, "items": sessions}
