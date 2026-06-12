from .states import InterviewState

VALID_TRANSITIONS: dict[InterviewState, set[InterviewState]] = {
    InterviewState.INTRO: {InterviewState.AWAITING_CLARIFICATION},
    InterviewState.AWAITING_CLARIFICATION: {
        InterviewState.AWAITING_APPROACH,
        InterviewState.AWAITING_CLARIFICATION,
    },
    InterviewState.AWAITING_APPROACH: {
        InterviewState.AWAITING_CODE,
        InterviewState.AWAITING_CLARIFICATION,
    },
    InterviewState.AWAITING_CODE: {
        InterviewState.AWAITING_WALKTHROUGH,
        InterviewState.AWAITING_APPROACH,
    },
    InterviewState.AWAITING_WALKTHROUGH: {
        InterviewState.CONCLUDING,
        InterviewState.AWAITING_CODE,
    },
    InterviewState.CONCLUDING: {InterviewState.GENERATING_DEBRIEF},
    InterviewState.GENERATING_DEBRIEF: {InterviewState.COMPLETED},
    InterviewState.COMPLETED: set(),
}


def is_valid_transition(from_state: InterviewState, to_state: InterviewState) -> bool:
    return to_state in VALID_TRANSITIONS.get(from_state, set())
