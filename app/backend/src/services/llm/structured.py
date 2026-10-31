import json
import re
from typing import Any

MAX_ATTEMPTS = 3
STRUCTURED_MAX_TOKENS = 2048


class StructuredOutputError(Exception):
    """The model never produced JSON matching the schema."""


def extract_json(text: str) -> Any:
    """Return the first JSON object in a reply, ignoring fences, reasoning and trailing text."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", text):
        try:
            return decoder.raw_decode(text, match.start())[0]
        except json.JSONDecodeError:
            continue
    raise ValueError("the reply contained no JSON object")


def schema_errors(parsed: Any, schema: dict[str, Any]) -> list[str]:
    """Check the parts of JSON Schema our schemas use. Empty means valid."""
    if not isinstance(parsed, dict):
        return [f"expected a JSON object, got {type(parsed).__name__}"]

    errors = [f"'{key}' is missing" for key in schema.get("required", []) if key not in parsed]
    for key, spec in schema.get("properties", {}).items():
        if key not in parsed:
            continue
        value = parsed[key]
        kind = spec.get("type")
        if kind == "string" and not (isinstance(value, str) and value.strip()):
            errors.append(f"'{key}' must be a non-empty string")
        elif kind == "array" and not isinstance(value, list):
            errors.append(f"'{key}' must be an array")
        # Decimals pass: _debrief_row rounds and clamps scores before they are stored.
        elif kind == "integer" and (isinstance(value, bool) or not isinstance(value, (int, float))):
            errors.append(f"'{key}' must be a number")
        if "enum" in spec and value not in spec["enum"]:
            errors.append(f"'{key}' must be one of {spec['enum']}")
    return errors


def with_json_instructions(messages: list[dict[str, str]], schema: dict[str, Any]) -> list[dict[str, str]]:
    """Add the schema to the system prompt and repeat the format rule at the end of the prompt.

    History turns are plain prose, so a rule that only appears before them is ignored:
    the model carries on in the style of the conversation.
    """
    rules = f"Reply with one JSON object and nothing else. Schema: {json.dumps(schema)}"
    result = [dict(m) for m in messages]
    if result and result[0]["role"] == "system":
        result[0]["content"] = f"{result[0]['content']}\n\n{rules}"
    else:
        result.insert(0, {"role": "system", "content": rules})

    keys = ", ".join(schema.get("required", []))
    reminder = f"Reply with only a JSON object with the keys {keys}. No prose, markdown or code fences."
    if result[-1]["role"] == "user":
        result[-1]["content"] = f"{result[-1]['content']}\n\n{reminder}"
    else:
        result.append({"role": "user", "content": reminder})
    return result


def correction(reply: str, problem: str) -> list[dict[str, str]]:
    """Turns that tell the model what was wrong; resending the same prompt repeats the same reply."""
    return [
        {"role": "assistant", "content": reply},
        {"role": "user", "content": f"That reply was rejected: {problem}. Send it again as only the JSON object."},
    ]
