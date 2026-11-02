from state_machine.states import InterviewState
from websocket.clock import timed_action


def test_nudge_when_idle_past_threshold():
    assert timed_action(InterviewState.AWAITING_APPROACH, 100, 80, False, 0) == "nudge"


def test_coding_gets_longer_patience():
    assert timed_action(InterviewState.AWAITING_CODE, 100, 80, False, 0) is None
    assert timed_action(InterviewState.AWAITING_CODE, 100, 200, False, 0) == "nudge"


def test_no_nudge_after_two_in_a_row():
    assert timed_action(InterviewState.AWAITING_APPROACH, 100, 500, False, 2) is None


def test_warn_at_forty_minutes_once():
    assert timed_action(InterviewState.AWAITING_APPROACH, 2400, 0, False, 0) == "warn"
    assert timed_action(InterviewState.AWAITING_APPROACH, 2400, 0, True, 0) is None


def test_cap_at_forty_five_minutes_even_when_idle():
    assert timed_action(InterviewState.AWAITING_CODE, 2700, 0, True, 0) == "cap"
    assert timed_action(InterviewState.AWAITING_CODE, 2700, 999, False, 2) == "cap"


def test_nothing_during_intro_or_debrief():
    assert timed_action(InterviewState.INTRO, 2700, 999, False, 0) is None
    assert timed_action(InterviewState.GENERATING_DEBRIEF, 2700, 999, False, 0) is None
    assert timed_action(InterviewState.COMPLETED, 2700, 999, False, 0) is None
