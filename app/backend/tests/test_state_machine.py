import pytest
from  state_machine.states import InterviewState
from  state_machine.transitions import is_valid_transition
from  state_machine.machine import StateMachine


def test_valid_transition():
    sm = StateMachine(InterviewState.INTRO)
    assert sm.transition(InterviewState.AWAITING_CLARIFICATION) is True
    assert sm.current_state == InterviewState.AWAITING_CLARIFICATION


def test_invalid_transition():
    sm = StateMachine(InterviewState.INTRO)
    assert sm.transition(InterviewState.AWAITING_APPROACH) is False
    assert sm.current_state == InterviewState.INTRO


def test_clarification_can_stay():
    sm = StateMachine(InterviewState.AWAITING_CLARIFICATION)
    assert sm.transition(InterviewState.AWAITING_CLARIFICATION) is True


def test_force_transition():
    sm = StateMachine(InterviewState.AWAITING_CODE)
    sm.force_transition(InterviewState.GENERATING_DEBRIEF)
    assert sm.current_state == InterviewState.GENERATING_DEBRIEF
