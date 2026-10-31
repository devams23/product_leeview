import asyncio
import logging

from .prompts import DEBRIEF_SCORING_PROMPT, REAL_WORLD_PROMPT, DEBRIEF_JSON_SCHEMA
from services.llm import create_llm_provider

logger = logging.getLogger(__name__)


class DebriefEngine:
    def __init__(self):
        self.llm = create_llm_provider()

    async def run(self, interview_data: dict) -> dict:
        """Run the full debrief: scoring + real-world mapping.

        Scores are the debrief; the real-world section is a bonus and may be left out.
        """
        scoring_result, real_world = await asyncio.gather(
            self._run_scoring(interview_data),
            self._run_real_world(interview_data),
            return_exceptions=True,
        )
        if isinstance(scoring_result, BaseException):
            raise scoring_result
        if isinstance(real_world, BaseException):
            logger.error(f"Real-world section failed, saving the debrief without it: {real_world}")
        else:
            scoring_result.update(real_world)
        return scoring_result

    async def _run_scoring(self, interview_data: dict) -> dict:
        messages = [
            {
                "role": "system",
                "content": "You are an expert technical interviewer. Return JSON only.",
            },
            {
                "role": "user",
                "content": DEBRIEF_SCORING_PROMPT.format(**interview_data),
            },
        ]
        return await self.llm.generate_structured(messages, DEBRIEF_JSON_SCHEMA)

    async def _run_real_world(self, interview_data: dict) -> dict:
        messages = [
            {"role": "user", "content": REAL_WORLD_PROMPT.format(**interview_data)},
        ]
        schema = {
            "type": "object",
            "properties": {
                "real_world_scenario": {"type": "string"},
                "real_world_naive_approach": {"type": "string"},
                "real_world_why_wins": {"type": "string"},
                "senior_follow_up": {"type": "string"},
            },
            "required": ["real_world_scenario", "real_world_naive_approach", "real_world_why_wins", "senior_follow_up"],
        }
        return await self.llm.generate_structured(messages, schema)
