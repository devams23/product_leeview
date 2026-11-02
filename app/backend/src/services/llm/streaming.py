"""Primitives for streaming chat completions: SSE parsing, think-tag removal, and spoken-reply parsing."""

import json
import re
from typing import Any, Optional

_STATE_LINE = re.compile(r"^STATE:\s*([A-Z_]+)\s*$")
# A sentence ends at terminal punctuation, or at a line break: some models write one unpunctuated sentence per line.
_SENTENCE_END = re.compile(r"[.?!](?=\s)|\n")
_MIN_SENTENCE = 24
_MAX_STATE_LINE = 200


def parse_sse_line(line: str) -> Optional[dict[str, Any]]:
    """Parse one server-sent event line. Returns None for blanks, comments, [DONE] and bad JSON."""
    line = line.strip()
    if not line or line.startswith(":") or not line.startswith("data:"):
        return None
    payload = line[len("data:"):].strip()
    if payload == "[DONE]":
        return None
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return event if isinstance(event, dict) else None


def _partial_suffix(data: str, tag: str) -> int:
    """Length of the longest proper prefix of tag that data ends with."""
    for k in range(min(len(tag) - 1, len(data)), 0, -1):
        if data.endswith(tag[:k]):
            return k
    return 0


class ThinkFilter:
    """Removes <think>...</think> blocks from a stream, even when the tags are split across chunks."""

    OPEN = "<think>"
    CLOSE = "</think>"

    def __init__(self):
        self._inside = False
        self._pending = ""

    def feed(self, text: str) -> str:
        data = self._pending + text
        self._pending = ""
        out: list[str] = []
        while data:
            if self._inside:
                idx = data.find(self.CLOSE)
                if idx == -1:
                    keep = _partial_suffix(data, self.CLOSE)
                    self._pending = data[len(data) - keep:]
                    break
                data = data[idx + len(self.CLOSE):]
                self._inside = False
            else:
                idx = data.find(self.OPEN)
                if idx == -1:
                    keep = _partial_suffix(data, self.OPEN)
                    out.append(data[:len(data) - keep])
                    self._pending = data[len(data) - keep:]
                    break
                out.append(data[:idx])
                data = data[idx + len(self.OPEN):]
                self._inside = True
        return "".join(out)

    def flush(self) -> str:
        """Return text held back as a possible partial tag when the stream ends."""
        pending = "" if self._inside else self._pending
        self._pending = ""
        return pending


class ReplyParser:
    """Reads a reply whose first line is `STATE: <NAME>` and returns the spoken sentences that follow.

    A first line that is not a STATE line keeps current_state and counts as speech.
    """

    def __init__(self, allowed_states: list[str], current_state: str):
        self.allowed_states = set(allowed_states)
        self.state = current_state
        self.text = ""
        self._current = current_state
        self._head = ""
        self._header_done = False
        self._spoken = ""
        self._sentence = ""

    @property
    def header_known(self) -> bool:
        """True once the STATE line (or the lack of one) has been read, so .state is final."""
        return self._header_done

    def feed(self, text: str) -> list[str]:
        if self._header_done:
            return self._speak(text)
        self._head += text
        stripped = self._head.lstrip()
        if not stripped:
            return []
        if "\n" in stripped:
            line, rest = stripped.split("\n", 1)
            self._finish_header(line)
            return self._speak(" " + rest)
        if "STATE:".startswith(stripped) or (stripped.startswith("STATE:") and len(stripped) <= _MAX_STATE_LINE):
            return []
        self._finish_header(stripped)
        return self._speak("")

    def finish(self) -> list[str]:
        if not self._header_done:
            self._finish_header(self._head.strip())
        remainder = self._sentence.strip()
        self._sentence = ""
        if remainder:
            self._spoken = f"{self._spoken} {remainder}" if self._spoken else remainder
        self.text = self._spoken.strip()
        return [remainder] if remainder else []

    def _finish_header(self, line: str) -> None:
        self._header_done = True
        self._head = ""
        match = _STATE_LINE.match(line.strip())
        if match or line.strip().startswith("STATE:"):
            name = match.group(1) if match else ""
            self.state = name if name in self.allowed_states else self._current
            return
        self._sentence = line

    def _speak(self, text: str) -> list[str]:
        self._sentence += text
        sentences: list[str] = []
        pos = 0
        while True:
            match = _SENTENCE_END.search(self._sentence, pos)
            if not match:
                break
            end = match.end()
            candidate = " ".join(self._sentence[:end].split())
            if len(candidate) >= _MIN_SENTENCE:
                sentences.append(candidate)
                self._spoken = f"{self._spoken} {candidate}" if self._spoken else candidate
                self._sentence = self._sentence[end:].lstrip()
                pos = 0
            else:
                pos = end
        self.text = f"{self._spoken} {self._sentence}".strip()
        return sentences


def interview_stream_instructions(allowed: list[str], allow_silence: bool) -> str:
    """System-prompt suffix asking for a STATE line followed by the spoken reply."""
    text = (
        f"Reply in this exact format. First line: STATE: <one of {', '.join(allowed)}>. "
        "Then, on the next lines, what you say aloud: natural spoken sentences with normal punctuation, "
        "one sentence per line."
    )
    if allow_silence:
        text += (
            " If the candidate is just thinking aloud while coding and nothing needs saying, "
            "write nothing after the STATE line."
        )
    return text
