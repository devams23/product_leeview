from dataclasses import dataclass
from typing import Optional

# List prices in USD. Model token prices come from settings, since they change with the provider.
PRICE_STT_PER_MIN = 0.0077
PRICE_TTS_PER_1K_CHARS = 0.030


@dataclass
class TurnMetrics:
    turn_index: int
    state: str
    kind: str  # "intro" | "reply" | "nudge" | "notice"
    llm_ms: Optional[int] = None
    llm_first_token_ms: Optional[int] = None
    tts_first_audio_ms: Optional[int] = None
    first_audio_ms: Optional[int] = None
    total_ms: Optional[int] = None
    tts_chars: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    llm_attempts: int = 0
    error: Optional[str] = None


@dataclass
class SessionUsage:
    turns: int = 0
    tts_characters: int = 0
    llm_input_tokens: int = 0
    llm_output_tokens: int = 0
    llm_calls: int = 0

    def add_turn(self, t: TurnMetrics) -> None:
        self.turns += 1
        self.tts_characters += t.tts_chars
        self.llm_input_tokens += t.input_tokens
        self.llm_output_tokens += t.output_tokens
        self.llm_calls += t.llm_attempts

    def cost_usd(self, stt_seconds: float, in_price_per_mtok: float, out_price_per_mtok: float) -> float:
        cost = (
            stt_seconds / 60 * PRICE_STT_PER_MIN
            + self.tts_characters / 1000 * PRICE_TTS_PER_1K_CHARS
            + self.llm_input_tokens / 1_000_000 * in_price_per_mtok
            + self.llm_output_tokens / 1_000_000 * out_price_per_mtok
        )
        return round(cost, 6)
