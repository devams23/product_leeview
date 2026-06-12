from .states import InterviewState
from .transitions import is_valid_transition


class StateMachine:
    def __init__(self, initial_state: InterviewState = InterviewState.INTRO):
        self._state = initial_state

    @property
    def current_state(self) -> InterviewState:
        return self._state

    def transition(self, next_state: InterviewState) -> bool:
        if is_valid_transition(self._state, next_state):
            self._state = next_state
            return True
        return False

    def force_transition(self, next_state: InterviewState) -> None:
        """Override for edge cases like user interrupt or timeout."""
        self._state = next_state
