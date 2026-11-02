import asyncio
import json
import os

import httpx

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")

from services.llm.base import LLMProvider
from services.llm.streaming import ReplyParser, ThinkFilter, interview_stream_instructions, parse_sse_line

MESSAGES = [{"role": "system", "content": "You are an interviewer."}, {"role": "user", "content": "Hi."}]


def collect(agen):
    async def run():
        return [chunk async for chunk in agen]
    return asyncio.run(run())


def feed_all(parser, text, size):
    sentences = []
    for i in range(0, len(text), size):
        sentences.extend(parser.feed(text[i:i + size]))
    return sentences


def test_parse_sse_line_reads_data_json():
    assert parse_sse_line('data: {"choices": [{"delta": {"content": "Hi"}}]}') == {
        "choices": [{"delta": {"content": "Hi"}}]
    }


def test_parse_sse_line_ignores_done_blank_comment_and_bad_json():
    assert parse_sse_line("data: [DONE]") is None
    assert parse_sse_line("") is None
    assert parse_sse_line("   ") is None
    assert parse_sse_line(": keep-alive") is None
    assert parse_sse_line("data: {not json") is None


def test_think_filter_drops_think_block_split_across_chunks():
    f = ThinkFilter()
    out = "".join(f.feed(chunk) for chunk in ["<thi", "nk>x</th", "ink>Hello"])
    assert out + f.flush() == "Hello"


def test_think_filter_keeps_text_that_only_looks_like_a_partial_tag():
    f = ThinkFilter()
    out = "".join(f.feed(chunk) for chunk in ["a <", "b"])
    assert out + f.flush() == "a <b"


def test_reply_parser_splits_state_and_short_sentence_merges_into_next():
    text = "STATE: AWAITING_APPROACH\nGreat question. The input is sorted, so think about two pointers. "
    parser = ReplyParser(["AWAITING_APPROACH", "AWAITING_CODE"], "AWAITING_CODE")
    sentences = feed_all(parser, text, 5)
    assert parser.state == "AWAITING_APPROACH"
    assert sentences == ["Great question. The input is sorted, so think about two pointers."]
    assert parser.finish() == []
    assert parser.text == "Great question. The input is sorted, so think about two pointers."


def test_reply_parser_unknown_state_falls_back_to_current():
    parser = ReplyParser(["AWAITING_APPROACH"], "AWAITING_CODE")
    parser.feed("STATE: MADE_UP\nThat is a reasonable plan to try.")
    parser.finish()
    assert parser.state == "AWAITING_CODE"


def test_reply_parser_without_state_line_treats_everything_as_speech():
    parser = ReplyParser(["AWAITING_APPROACH"], "AWAITING_CODE")
    sentences = feed_all(parser, "Walk me through your reasoning, please. ", 7)
    sentences.extend(parser.finish())
    assert parser.state == "AWAITING_CODE"
    assert sentences == ["Walk me through your reasoning, please."]
    assert parser.text == "Walk me through your reasoning, please."


def test_reply_parser_silence_after_state_line_speaks_nothing():
    parser = ReplyParser(["AWAITING_CODE"], "AWAITING_CODE")
    assert parser.feed("STATE: AWAITING_CODE\n") == []
    assert parser.finish() == []
    assert parser.text == ""
    assert parser.state == "AWAITING_CODE"


def test_reply_parser_finish_returns_unterminated_remainder():
    parser = ReplyParser(["AWAITING_CODE"], "AWAITING_CODE")
    parser.feed("STATE: AWAITING_CODE\nGo ahead and write it out")
    assert parser.finish() == ["Go ahead and write it out"]


class Canned(LLMProvider):
    @property
    def provider_name(self):
        return "canned"

    async def generate(self, messages, temperature=0.7, response_format=None, max_tokens=1024):
        return "abc"


def test_default_stream_yields_the_whole_generate_reply_once():
    assert collect(Canned().stream(MESSAGES)) == ["abc"]


def test_interview_stream_instructions_lists_states_and_optional_silence():
    text = interview_stream_instructions(["AWAITING_CODE", "CONCLUDING"], allow_silence=False)
    assert "First line: STATE: <one of AWAITING_CODE, CONCLUDING>" in text
    assert "write nothing" not in text

    quiet = interview_stream_instructions(["AWAITING_CODE"], allow_silence=True)
    assert "write nothing after the STATE line" in quiet


def sse(*events):
    body = "".join(f"data: {json.dumps(e)}\n\n" for e in events) + "data: [DONE]\n\n"
    return httpx.Response(200, content=body.encode(), headers={"content-type": "text/event-stream"})


def test_nim_stream_yields_deltas_without_think_block_and_records_usage():
    from services.llm.nvidia_nim import NVIDIANIMProvider

    def handler(request):
        payload = json.loads(request.content)
        assert payload["stream"] is True
        assert payload["stream_options"] == {"include_usage": True}
        return sse(
            {"choices": [{"delta": {"content": "<think>hmm</think>Hel"}}]},
            {"choices": [{"delta": {"content": "lo."}}]},
            {"choices": [], "usage": {"prompt_tokens": 12, "completion_tokens": 3}},
        )

    provider = NVIDIANIMProvider()
    provider._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    assert "".join(collect(provider.stream(MESSAGES))) == "Hello."
    assert provider.usage_snapshot() == (12, 3, 1)
    asyncio.run(provider.aclose())


def test_openrouter_stream_yields_deltas_and_records_usage():
    from services.llm.openrouter import OpenRouterProvider

    def handler(request):
        return sse(
            {"choices": [{"delta": {"content": "Good "}}]},
            {"choices": [{"delta": {"content": "point."}}]},
            {"choices": [], "usage": {"prompt_tokens": 5, "completion_tokens": 2}},
        )

    provider = OpenRouterProvider()
    provider._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    assert collect(provider.stream(MESSAGES)) == ["Good ", "point."]
    assert provider.usage_snapshot() == (5, 2, 1)
    asyncio.run(provider.aclose())


def test_reply_parser_splits_unpunctuated_lines_at_line_breaks():
    # Some models write one sentence per line with no punctuation at all.
    text = ("STATE: AWAITING_CLARIFICATION\nHi thanks for joining today\n"
            "The problem is Two Sum given an array of integers and a target\nDo you have any questions")
    parser = ReplyParser(["AWAITING_CLARIFICATION"], "INTRO")
    sentences = feed_all(parser, text, 6)
    assert sentences == ["Hi thanks for joining today",
                         "The problem is Two Sum given an array of integers and a target"]
    assert parser.finish() == ["Do you have any questions"]


def test_interview_stream_instructions_ask_for_punctuated_sentences():
    text = interview_stream_instructions(["AWAITING_CODE"], allow_silence=False)
    assert "normal punctuation" in text
