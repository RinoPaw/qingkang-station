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

from main import app


client = TestClient(app)


def assert_status(response, expected=200):
    assert response.status_code == expected, response.text
    return response.json()


def main():
    suffix = int(time.time() * 1000)
    user_a_name = f"Rino-{suffix}"
    user_b_name = f"Queue-{suffix}"

    user_a = assert_status(
        client.post("/api/users/login", json={"nickname": user_a_name})
    )["user"]
    user_b = assert_status(
        client.post("/api/users/login", json={"nickname": user_b_name})
    )["user"]

    first = assert_status(
        client.post(
            "/api/queue/join",
            json={"user_id": user_a["user_id"], "nickname": user_a["nickname"]},
        )
    )
    assert first["session"]["status"] == "READY"
    assert first["queue"]["is_active"] is True
    session_a = first["session_id"]

    device = assert_status(client.get("/api/device/poll?device_id=esp32_s3_001"))
    assert device["active_session"]["session_id"] == session_a

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

    tongue = assert_status(
        client.post(
            "/api/tongue-image",
            data={"session_id": session_a, "user_id": user_a["user_id"]},
            files={"file": ("tongue-test.txt", BytesIO(b"fake image bytes"), "text/plain")},
        )
    )
    assert tongue["tongue"]["image_path"].startswith("uploads/")
    assert "不作为医学诊断依据" in tongue["combined_observation"]["disclaimer"]

    finished = assert_status(client.post(f"/api/session/{session_a}/finish", json={}))
    assert finished["session"]["status"] == "FINISHED"

    promoted = assert_status(client.get(f"/api/session/{session_b}"))
    assert promoted["session"]["status"] == "READY"
    assert promoted["queue"]["is_active"] is True

    assert_status(client.post(f"/api/session/{session_b}/cancel", json={}))

    latest = assert_status(client.get("/api/latest"))
    assert latest["ok"] is True

    history = assert_status(client.get(f"/api/history?user_id={user_a['user_id']}"))
    assert history["items"], "history should include at least one session"

    print("API flow acceptance test passed")


if __name__ == "__main__":
    main()
