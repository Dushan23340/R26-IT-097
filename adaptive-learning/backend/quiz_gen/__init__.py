"""quiz_gen — Per-student generated quiz questions for the pilot lessons
(number-patterns, fractions-bodmas, binary-numbers).

solvers.py owns correctness (pure deterministic math). templates.py owns
phrasing + parameter sampling, each answer always computed by solvers.py.
model.py is a small trained classifier that learns which of several valid
templates to prefer for a given (lesson, LO level) slot - it never touches
answers. generator.py assembles a full 18-question instance; store.py
holds the real answer key server-side so it never reaches the client.
"""
