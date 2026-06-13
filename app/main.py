import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import clear_auth_cookie, create_session_token, require_auth, set_auth_cookie
from .config import Settings, get_settings
from .orbit import OrbitClient

STATIC_DIR = Path(__file__).parent / "static"


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    model: str = Field(min_length=1)
    max_tokens: int = Field(default=1024, ge=1, le=8192)
    messages: List[Message] = Field(min_length=1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.orbit = OrbitClient(settings)
    try:
        await app.state.orbit.fetch_models(force=True)
    except Exception:
        # Startup should not fail if the upstream provider is temporarily unavailable.
        pass
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["content-type"],
        )

    @app.get("/health", include_in_schema=False)
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/login")
    async def login(body: LoginRequest, response: Response, settings: Settings = Depends(get_settings)):
        if not secrets.compare_digest(body.password, settings.app_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
        set_auth_cookie(response, create_session_token(settings), settings)
        return {"ok": True}

    @app.post("/api/auth/logout")
    async def logout(response: Response):
        clear_auth_cookie(response)
        return {"ok": True}

    @app.get("/api/auth/session")
    async def session(_: None = Depends(require_auth)):
        return {"authenticated": True}

    @app.get("/api/models")
    async def models(_: None = Depends(require_auth)):
        return {"data": await app.state.orbit.fetch_models()}

    @app.post("/api/chat")
    async def chat(body: ChatRequest, _: None = Depends(require_auth)):
        payload: Dict[str, Any] = body.model_dump()
        return await app.state.orbit.create_message(payload)

    app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        return FileResponse(STATIC_DIR / "index.html")

    return app


app = create_app()
