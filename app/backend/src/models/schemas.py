from pydantic import BaseModel
from typing import Optional
from enum import Enum


class Speaker(str, Enum):
    USER = "USER"
    AI = "AI"


class UserUtterance(BaseModel):
    type: str = "USER_UTTERANCE"
    text: str
    current_code: Optional[str] = ""
    language: Optional[str] = "python"
