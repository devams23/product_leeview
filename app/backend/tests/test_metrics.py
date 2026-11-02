from metrics import SessionUsage, TurnMetrics
from services.llm.base import LLMProvider


class Plain(LLMProvider):
    @property
    def provider_name(self):
        return "plain"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        return ""


def test_cost_usd():
    usage = SessionUsage(tts_characters=1000, llm_input_tokens=1_000_000, llm_output_tokens=500_000)
    # TTS 0.03 + LLM input 0.2 + LLM output 0.2 + STT 10 min at 0.0077 = 0.507
    assert usage.cost_usd(600, 0.2, 0.4) == 0.507


def test_add_turn():
    usage = SessionUsage()
    usage.add_turn(TurnMetrics(turn_index=0, state="INTRO", kind="intro", tts_chars=10, input_tokens=5, output_tokens=2))
    usage.add_turn(TurnMetrics(turn_index=1, state="AWAITING_CODE", kind="reply", tts_chars=20, input_tokens=1, output_tokens=1))
    assert usage.turns == 2
    assert usage.tts_characters == 30
    assert usage.llm_input_tokens == 6
    assert usage.llm_output_tokens == 3


def test_record_usage():
    provider = Plain()
    provider.record_usage({"prompt_tokens": 10, "completion_tokens": 5})
    provider.record_usage({"prompt_tokens": 10, "completion_tokens": 5})
    provider.record_usage(None)
    assert provider.usage_snapshot() == (20, 10, 3)
