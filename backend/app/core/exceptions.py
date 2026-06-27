from typing import Any


class UpstreamRequestError(Exception):
    def __init__(self, status_code: int, message: str, payload: Any | None = None) -> None:
        self.status_code = status_code
        self.message = message
        self.payload = payload
        super().__init__(message)
