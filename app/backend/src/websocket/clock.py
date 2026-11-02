"""Timed checks for a live interview: check-ins after silence, a warning, and the time cap."""
from typing import Literal, Optional

from state_machine.states import InterviewState

IDLE_NUDGE_S = 75
CODING_IDLE_NUDGE_S = 180  # coding is quiet by nature, so wait longer
MAX_NUDGES_IN_ROW = 2
WARN_AT_S = 40 * 60
CAP_AT_S = 45 * 60

_NOT_LIVE = (InterviewState.INTRO, InterviewState.GENERATING_DEBRIEF, InterviewState.COMPLETED)

Action = Literal["cap", "warn", "nudge"]


def timed_action(
    state: InterviewState, elapsed_s: float, idle_s: float, warned: bool, nudges_in_row: int,
) -> Optional[Action]:
    """The one timed action due now, or None. The cap outranks the warning, which outranks a nudge."""
    if state in _NOT_LIVE:
        return None
    if elapsed_s >= CAP_AT_S:
        return "cap"
    if not warned and elapsed_s >= WARN_AT_S:
        return "warn"
    threshold = CODING_IDLE_NUDGE_S if state == InterviewState.AWAITING_CODE else IDLE_NUDGE_S
    if nudges_in_row < MAX_NUDGES_IN_ROW and idle_s >= threshold:
        return "nudge"
    return None
