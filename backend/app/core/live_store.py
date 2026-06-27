import asyncio
import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any


class LiveStore:
    def __init__(self, max_items: int = 200, db_path: str | None = None) -> None:
        self._max_items = max_items
        self._items: dict[str, dict[str, Any]] = {}
        self._order: list[str] = []
        self._lock = asyncio.Lock()
        self._connections: set[Any] = set()
        self._db_path = db_path or os.getenv("LIVE_STORE_DB_PATH") or self._default_db_path()
        self._db = sqlite3.connect(self._db_path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._init_db()
        self._load_from_db()

    @staticmethod
    def _default_db_path() -> str:
        app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.abspath(os.path.join(app_dir, "..", "live_store.db"))

    def _init_db(self) -> None:
        self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS live_store (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                updated_at TEXT,
                status TEXT,
                payload TEXT
            )
            """
        )
        self._db.commit()

    def _load_from_db(self) -> None:
        rows = self._db.execute(
            "SELECT id, payload FROM live_store ORDER BY created_at DESC LIMIT ?",
            (self._max_items,),
        ).fetchall()
        for row in rows:
            try:
                payload = json.loads(row["payload"]) if row["payload"] else {}
                item_id = row["id"]
                if not item_id:
                    continue
                self._items[item_id] = payload
                self._order.append(item_id)
            except Exception:
                continue

    def _persist_item(self, item: dict[str, Any]) -> None:
        item_id = item.get("id")
        if not item_id:
            return
        payload = json.dumps(item, ensure_ascii=True)
        self._db.execute(
            """
            INSERT INTO live_store (id, created_at, updated_at, status, payload)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                updated_at=excluded.updated_at,
                status=excluded.status,
                payload=excluded.payload
            """,
            (
                item_id,
                item.get("created_at"),
                item.get("updated_at"),
                item.get("status"),
                payload,
            ),
        )
        self._db.commit()

    async def add_item(self, item: dict[str, Any]) -> dict[str, Any]:
        async with self._lock:
            item_id = item.get("id") or str(uuid.uuid4())
            item["id"] = item_id
            item.setdefault("created_at", datetime.utcnow().isoformat() + "Z")
            item.setdefault("status", "queued")
            self._items[item_id] = item
            if item_id in self._order:
                self._order.remove(item_id)
            self._order.insert(0, item_id)
            if len(self._order) > self._max_items:
                removed = self._order[self._max_items :]
                self._order = self._order[: self._max_items]
                for stale_id in removed:
                    self._items.pop(stale_id, None)
                    self._db.execute("DELETE FROM live_store WHERE id = ?", (stale_id,))
                self._db.commit()
            self._persist_item(item)
            return item

    async def update_item(self, item_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return None
            item.update(updates)
            item["updated_at"] = datetime.utcnow().isoformat() + "Z"
            self._items[item_id] = item
            self._persist_item(item)
            return item

    async def get_item(self, item_id: str) -> dict[str, Any] | None:
        async with self._lock:
            return self._items.get(item_id)

    async def list_items(self, limit: int = 50) -> list[dict[str, Any]]:
        async with self._lock:
            ids = self._order[:limit]
            return [self._items[item_id] for item_id in ids if item_id in self._items]

    async def connect(self, websocket: Any) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    async def disconnect(self, websocket: Any) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        stale: list[Any] = []
        for websocket in list(self._connections):
            try:
                await websocket.send_json(event)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self._connections.discard(websocket)


live_store = LiveStore()
