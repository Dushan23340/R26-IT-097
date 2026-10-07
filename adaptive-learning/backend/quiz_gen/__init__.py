"""quiz_gen — Per-student generated quiz questions for all 6 lessons, in the
Learning Outcome quizzes' format (5 remember + 5 understand + 2 apply).

solvers.py owns correctness (pure deterministic math). templates.py owns
phrasing + parameter sampling, each answer always computed by solvers.py;
bank.py holds the LO owner's own verified quiz questions, registered as
fixed templates alongside them. model.py is a small trained classifier
that learns which of several valid templates to prefer for a given
(lesson, LO level) slot - it never touches answers. generator.py assembles
a full 12-question instance; store.py holds the real answer key
server-side so it never reaches the client.
"""
