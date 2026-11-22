from pydantic import BaseModel, Field, field_validator
import re

ORIGIN_RE = re.compile(r"^https?://[A-Za-z0-9.-]+(:\d{1,5})?$")

class BotIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    greeting: str = Field(default="Hi! How can I help?", max_length=300)
    system_prompt: str | None = Field(default=None, max_length=2000)
    theme: dict = {}
    allowed_origins: list[str] = []

    @field_validator("allowed_origins")
    @classmethod
    def check_origins(cls, v):
        out = [o.strip().rstrip("/") for o in v]
        if any(not ORIGIN_RE.match(o) for o in out):
            raise ValueError("Use origins like https://example.com (no paths)")
        return out

class BotPatch(BaseModel):          # all optional
    name: str | None = Field(default=None, max_length=100)
    greeting: str | None = Field(default=None, max_length=300)
    system_prompt: str | None = Field(default=None, max_length=2000)
    theme: dict | None = None
    allowed_origins: list[str] | None = None
    _check = field_validator("allowed_origins")(lambda cls, v: BotIn.check_origins(v) if v else v)