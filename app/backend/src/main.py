from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings

settings = get_settings()

app = FastAPI(title="LeeView Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
