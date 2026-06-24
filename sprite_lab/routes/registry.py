"""HTTP route registry for AppHandler.

Migration strategy: instead of one giant if/elif chain inside AppHandler,
each route is a function that takes (handler, parsed_url) and is registered
into a dispatch table. AppHandler's do_GET/do_POST consult the table first
and only fall through to the legacy chain if nothing matched.

This lets us migrate routes one at a time without breaking anything.

Route handler signature:
    def handler(http: AppHandler, parsed: ParseResult) -> None

The handler is responsible for calling http.send_json / http.send_error_json.
Exceptions raised escape to AppHandler.dispatch which converts them to
404/400 responses.
"""
from __future__ import annotations

from typing import Callable, Protocol
from urllib.parse import ParseResult


class _SupportsResponse(Protocol):
    """Subset of AppHandler that route handlers may call."""

    def send_json(self, payload: dict, status: int = ...) -> None: ...
    def send_error_json(self, message: str, status: int = ...) -> None: ...
    def read_json_body(self) -> dict: ...


RouteHandler = Callable[[_SupportsResponse, ParseResult], None]


# ---------------------------------------------------------------------------
# Module-level registries.
# Exact-match tables map path -> handler.
# Prefix tables hold (prefix, handler) pairs and are scanned in order.
# ---------------------------------------------------------------------------
_GET_EXACT: dict[str, RouteHandler] = {}
_GET_PREFIX: list[tuple[str, RouteHandler]] = []
_POST_EXACT: dict[str, RouteHandler] = {}
_POST_PREFIX: list[tuple[str, RouteHandler]] = []


def get(path: str, *, prefix: bool = False) -> Callable[[RouteHandler], RouteHandler]:
    def deco(fn: RouteHandler) -> RouteHandler:
        if prefix:
            _GET_PREFIX.append((path, fn))
        else:
            if path in _GET_EXACT:
                raise ValueError(f"GET route already registered: {path}")
            _GET_EXACT[path] = fn
        return fn

    return deco


def post(path: str, *, prefix: bool = False) -> Callable[[RouteHandler], RouteHandler]:
    def deco(fn: RouteHandler) -> RouteHandler:
        if prefix:
            _POST_PREFIX.append((path, fn))
        else:
            if path in _POST_EXACT:
                raise ValueError(f"POST route already registered: {path}")
            _POST_EXACT[path] = fn
        return fn

    return deco


def dispatch_get(http, parsed: ParseResult) -> bool:
    """Try GET dispatch; return True if a route handled the request."""
    handler = _GET_EXACT.get(parsed.path)
    if handler is not None:
        handler(http, parsed)
        return True
    for prefix, fn in _GET_PREFIX:
        if parsed.path.startswith(prefix):
            fn(http, parsed)
            return True
    return False


def dispatch_post(http, parsed: ParseResult) -> bool:
    """Try POST dispatch; return True if a route handled the request."""
    handler = _POST_EXACT.get(parsed.path)
    if handler is not None:
        handler(http, parsed)
        return True
    for prefix, fn in _POST_PREFIX:
        if parsed.path.startswith(prefix):
            fn(http, parsed)
            return True
    return False


def registered_routes() -> dict[str, list[str]]:
    """Diagnostics: list every registered route. Used by smoke tests."""
    return {
        "GET": sorted(_GET_EXACT) + [f"{p}*" for p, _ in _GET_PREFIX],
        "POST": sorted(_POST_EXACT) + [f"{p}*" for p, _ in _POST_PREFIX],
    }
