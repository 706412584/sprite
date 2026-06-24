"""Route module registration.

Importing this package side-effect-registers every route handler into
sprite_lab.routes.registry. server.py imports `sprite_lab.routes` once
to populate the registry before instantiating AppHandler.
"""
from . import (  # noqa: F401
    bg_inpaint,
    env_models,
    imports,
    jobs_route,
    mcp_status,
    misc,
    pose,
    preview_alpha,
    psd,
    tasks_route,
)

# Re-export the dispatchers so server.py can call them directly.
from .registry import (  # noqa: F401
    dispatch_get,
    dispatch_post,
    registered_routes,
)
