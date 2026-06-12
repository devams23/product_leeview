from .prompts import DEBRIEF_SCORING_PROMPT, REAL_WORLD_PROMPT, DEBRIEF_JSON_SCHEMA
from src.services.llm import create_llm_provider


class DebriefEngine:
    def __init__(self):
        self.llm = create_llm_provider()

    async def run(self, interview_data: dict) -> dict:
        """Run the full debrief: scoring + real-world mapping."""
        scoring_result = await self._run_scoring(interview_data)
        real_world = await self._run_real_world(interview_data)
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
