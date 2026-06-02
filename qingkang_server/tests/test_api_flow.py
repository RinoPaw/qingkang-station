from io import BytesIO
from pathlib import Path
import os
import sys
import time
import tempfile

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

temp_dir = tempfile.TemporaryDirectory()
temp_path = Path(temp_dir.name)
os.environ["QINGKANG_DB_PATH"] = str(temp_path / "test.db")
os.environ["QINGKANG_UPLOAD_DIR"] = str(temp_path / "uploads")

from main import DEFAULT_DEVICE_ID, app, get_conn


client = TestClient(app)


def assert_status(response, expected=200):
    assert response.status_code == expected, response.text
    return response.json()


def main():
    suffix = int(time.time() * 1000)
    user_a_name = f"Rino-{suffix}"
    user_b_name = f"Queue-{suffix}"

    initial_device_status = assert_status(
        client.get("/api/device/status?device_id=esp32_s3_001")
    )
    assert initial_device_status["state"] == "DISCONNECTED"

    user_a = assert_status(
        client.post("/api/users/login", json={"nickname": user_a_name})
    )["user"]
    user_b = assert_status(
        client.post("/api/users/login", json={"nickname": user_b_name})
    )["user"]

    tongue_first_user = assert_status(
        client.post("/api/users/login", json={"nickname": f"TongueFirst-{suffix}"})
    )["user"]
    tongue_first = assert_status(
        client.post(
            "/api/tongue-image",
            data={"user_id": tongue_first_user["user_id"]},
            files={"file": ("tongue-first.jpg", BytesIO(b"fake image bytes"), "image/jpeg")},
        )
    )
    assert tongue_first["session_id"].startswith("sess_")
    assert tongue_first["session"]["status"] == "FINISHED"
    assert tongue_first["heart"] is None
    assert tongue_first["tongue"]["image_path"].startswith("uploads/")
    tongue_first_history = assert_status(
        client.get(f"/api/history?user_id={tongue_first_user['user_id']}")
    )
    assert tongue_first_history["items"], "tongue-first upload should create history"

    first = assert_status(
        client.post(
            "/api/queue/join",
            json={"user_id": user_a["user_id"], "nickname": user_a["nickname"]},
        )
    )
    assert first["session"]["status"] == "QUEUED"
    assert first["queue"]["is_active"] is False
    session_a = first["session_id"]

    device = assert_status(client.get("/api/device/poll?device_id=esp32_s3_001"))
    assert device["active_session"]["session_id"] == session_a
    active_a = assert_status(client.get(f"/api/session/{session_a}"))
    assert active_a["session"]["status"] == "READY"
    assert active_a["queue"]["is_active"] is True
    ready_zero = assert_status(
        client.post(
            "/api/heart-rate",
            json={
                "session_id": session_a,
                "user_id": user_a["user_id"],
                "device_id": "esp32_s3_001",
                "bpm": 0,
                "raw": 2000,
                "amplitude": 0,
                "state": "READY",
            },
        )
    )
    assert ready_zero["accepted"] is True
    assert ready_zero["recorded"] is False
    assert ready_zero["heart"] is None
    conn = get_conn()
    ready_zero_count = conn.execute(
        """
        SELECT COUNT(*) AS count
        FROM heart_records
        WHERE session_id = ? AND state = 'READY' AND COALESCE(bpm, 0) = 0
        """,
        (session_a,),
    ).fetchone()["count"]
    before_status_seen = conn.execute(
        "SELECT last_seen FROM device_status WHERE device_id = ?",
        (DEFAULT_DEVICE_ID,),
    ).fetchone()["last_seen"]
    conn.close()
    assert ready_zero_count == 0

    device_status = assert_status(client.get("/api/device/status?device_id=esp32_s3_001"))
    assert device_status["active_session"]["session_id"] == session_a
    conn = get_conn()
    after_status_seen = conn.execute(
        "SELECT last_seen FROM device_status WHERE device_id = ?",
        (DEFAULT_DEVICE_ID,),
    ).fetchone()["last_seen"]
    conn.close()
    assert after_status_seen == before_status_seen

    second = assert_status(
        client.post(
            "/api/queue/join",
            json={"user_id": user_b["user_id"], "nickname": user_b["nickname"]},
        )
    )
    assert second["session"]["status"] == "QUEUED"
    assert second["queue"]["people_ahead"] >= 1
    session_b = second["session_id"]

    idle_reject = client.post(
        "/api/heart-rate",
        json={
            "session_id": session_b,
            "device_id": "esp32_s3_001",
            "bpm": 88,
            "raw": 2048,
            "amplitude": 380,
            "state": "MEASURING",
        },
    )
    assert idle_reject.status_code == 409, idle_reject.text

    heart = assert_status(
        client.post(
            "/api/heart-rate",
            json={
                "session_id": session_a,
                "user_id": user_a["user_id"],
                "device_id": "esp32_s3_001",
                "bpm": 82,
                "raw": 2090,
                "amplitude": 410,
                "state": "MEASURING",
            },
        )
    )
    assert heart["heart"]["state"] == "MEASURING"
    assert heart["session"]["status"] == "MEASURING"

    conn = get_conn()
    conn.execute(
        "UPDATE device_status SET last_seen = ? WHERE device_id = ?",
        (int(time.time()) - 30, DEFAULT_DEVICE_ID),
    )
    conn.commit()
    conn.close()
    disconnected = assert_status(client.get("/api/device/status?device_id=esp32_s3_001"))
    assert disconnected["state"] == "DISCONNECTED"
    timed_out = assert_status(client.get(f"/api/session/{session_a}"))
    assert timed_out["session"]["status"] == "TIMEOUT"
    waiting_b = assert_status(client.get(f"/api/session/{session_b}"))
    assert waiting_b["session"]["status"] == "QUEUED"

    device = assert_status(client.get("/api/device/poll?device_id=esp32_s3_001"))
    assert device["active_session"]["session_id"] == session_b
    active_b = assert_status(client.get(f"/api/session/{session_b}"))
    assert active_b["session"]["status"] == "READY"

    session_a = session_b

    tongue = assert_status(
        client.post(
            "/api/tongue-image",
            data={"session_id": session_a, "user_id": user_b["user_id"]},
            files={"file": ("tongue-test.txt", BytesIO(b"fake image bytes"), "text/plain")},
        )
    )
    assert tongue["tongue"]["image_path"].startswith("uploads/")
    assert "不作为医学诊断依据" in tongue["combined_observation"]["disclaimer"]
    combined_text = " ".join(
        [tongue["combined_observation"]["summary"]]
        + tongue["combined_observation"]["suggestions"]
    )
    assert "session" not in combined_text.lower()
    assert "硬件空闲" not in combined_text

    finished = assert_status(client.post(f"/api/session/{session_a}/finish", json={}))
    assert finished["session"]["status"] == "FINISHED"

    latest = assert_status(client.get("/api/latest"))
    assert latest["ok"] is True

    history = assert_status(client.get(f"/api/history?user_id={user_b['user_id']}"))
    assert history["items"], "history should include at least one session"

    print("API flow acceptance test passed")


if __name__ == "__main__":
    main()
