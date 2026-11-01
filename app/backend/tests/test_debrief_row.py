from websocket.handler import _debrief_row


def test_punctuation_only_feedback_is_dropped():
    row = _debrief_row({"actionable_feedback": [":", "  ", "Name the edge cases first.", 3]})
    assert row["actionable_feedback"] == ["Name the edge cases first."]


def test_feedback_that_is_not_a_list_becomes_empty():
    assert _debrief_row({"actionable_feedback": "Explain more."})["actionable_feedback"] == []
