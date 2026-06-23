import json
import os
from typing import Any
from pathlib import Path

from src.services.llm.base import LLMProvider
from src.state_machine.states import InterviewState


class MockLLMProvider(LLMProvider):
    """Mock LLM provider that returns pre-recorded responses from JSON files."""

    def __init__(self):
        self.sample_dir = Path(__file__).parent.parent.parent.parent / "sample_responses"
        self.turn_counter = 0
        self.state_to_turn = {
            InterviewState.INTRO: 1,
            InterviewState.AWAITING_CLARIFICATION: 2,
            InterviewState.AWAITING_APPROACH: 3,
            InterviewState.AWAITING_CODE: 4,
            InterviewState.AWAITING_WALKTHROUGH: 5,
            InterviewState.CONCLUDING: 6,
            InterviewState.GENERATING_DEBRIEF: 7,
        }
        self.state_to_filename = {
            InterviewState.INTRO: "intro",
            InterviewState.AWAITING_CLARIFICATION: "clarification",
            InterviewState.AWAITING_APPROACH: "approach",
            InterviewState.AWAITING_CODE: "code",
            InterviewState.AWAITING_WALKTHROUGH: "walkthrough",
            InterviewState.CONCLUDING: "concluding",
            InterviewState.GENERATING_DEBRIEF: "debrief",
        }

    @property
    def provider_name(self) -> str:
        return "mock"

    async def generate(
        self, messages: list[dict[str, str]], temperature: float = 0.7
    ) -> str:
        """Generate a chat completion response (not used in structured mode)."""
        return await self._get_response_text(messages)

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
    ) -> dict[str, Any]:
        """Generate a structured response from sample JSON files."""
        if json_schema and "properties" in json_schema:
            if "approach_score" in json_schema["properties"] or "real_world_scenario" in json_schema["properties"]:
                sample_file = self.sample_dir / "turn_7_debrief.json"
                if sample_file.exists():
                    with open(sample_file, "r") as f:
                        return json.load(f)

        self.turn_counter += 1
        
        current_state = self._extract_state_from_messages(messages)
        turn_num = self.state_to_turn.get(current_state, self.turn_counter)
        filename_suffix = self.state_to_filename.get(current_state, current_state.value.lower())
        
        sample_file = self.sample_dir / f"turn_{turn_num}_{filename_suffix}.json"
        
        if not sample_file.exists():
            sample_file = self.sample_dir / f"turn_{self.turn_counter}.json"
        
        if not sample_file.exists():
            return {
                "response_text": f"Mock response for turn {self.turn_counter} (state: {current_state.value})",
                "next_state": self._get_next_state(current_state).value
            }
        
        with open(sample_file, "r") as f:
            data = json.load(f)
        
        return data

    def _extract_state_from_messages(self, messages: list[dict[str, str]]) -> InterviewState:
        """Extract current interview state from system prompt."""
        for msg in messages:
            if msg.get("role") == "system" and "Current phase:" in msg.get("content", ""):
                content = msg["content"]
                for state in InterviewState:
                    if state.value in content:
                        return state
        return InterviewState.INTRO

    def _get_next_state(self, current: InterviewState) -> InterviewState:
        """Get the next logical state."""
        transitions = {
            InterviewState.INTRO: InterviewState.AWAITING_CLARIFICATION,
            InterviewState.AWAITING_CLARIFICATION: InterviewState.AWAITING_APPROACH,
            InterviewState.AWAITING_APPROACH: InterviewState.AWAITING_CODE,
            InterviewState.AWAITING_CODE: InterviewState.AWAITING_WALKTHROUGH,
            InterviewState.AWAITING_WALKTHROUGH: InterviewState.CONCLUDING,
            InterviewState.CONCLUDING: InterviewState.GENERATING_DEBRIEF,
            InterviewState.GENERATING_DEBRIEF: InterviewState.COMPLETED,
        }
        return transitions.get(current, InterviewState.COMPLETED)

    async def _get_response_text(self, messages: list[dict[str, str]]) -> str:
        """Get just the response text for non-structured calls."""
        result = await self.generate_structured(messages, {})
        return result.get("response_text", "")