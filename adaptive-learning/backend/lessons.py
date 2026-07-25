"""
lessons.py — Real per-lesson quiz content: genuine questions with correct
answers, difficulty, and Bloom's cognitive-level tags (not placeholder
stems like the old QUIZ_TEMPLATES in data.py).

Two representative lessons across different subjects, not an attempt at
exhaustive curriculum coverage - enough to demonstrate the weighted
mastery model and semantic recommender against real content.
"""

LESSONS = {
    "python-functions": {
        "title": "Python Functions",
        "subject": "Programming",
        "questions": [
            {
                "id": "pf-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "Which keyword is used to define a function in Python?",
                "options": ["func", "def", "function", "lambda"],
                "answer": "def",
            },
            {
                "id": "pf-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What does a function return by default if it has no return statement?",
                "options": ["0", "None", "an empty string", "an error"],
                "answer": "None",
            },
            {
                "id": "pf-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "What is the purpose of a default parameter value in a function?",
                "options": [
                    "It makes the parameter required",
                    "It provides a fallback value if the caller doesn't supply one",
                    "It converts the parameter to a string",
                    "It deletes the parameter after use",
                ],
                "answer": "It provides a fallback value if the caller doesn't supply one",
            },
            {
                "id": "pf-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "Why can using a mutable default argument (like a list) be risky?",
                "options": [
                    "It's shared across all calls unless explicitly reset",
                    "Python forbids mutable defaults",
                    "It slows down the function significantly",
                    "It cannot hold more than one item",
                ],
                "answer": "It's shared across all calls unless explicitly reset",
            },
            {
                "id": "pf-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "def add(a, b=10): return a + b. What does add(5) return?",
                "options": ["5", "10", "15", "TypeError"],
                "answer": "15",
            },
            {
                "id": "pf-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "def f(*args, **kwargs): pass. How would you call f with 1, 2 as positional and x=3 as keyword?",
                "options": ["f(1, 2, x=3)", "f([1, 2], {'x': 3})", "f(1, 2, 3)", "f(x=3, 1, 2)"],
                "answer": "f(1, 2, x=3)",
            },
            {
                "id": "pf-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "Two functions both compute a factorial, one recursive and one iterative. For very large n, which is more likely to fail first?",
                "options": ["The iterative version", "The recursive version, due to recursion depth limits", "Neither will fail", "Both fail identically"],
                "answer": "The recursive version, due to recursion depth limits",
            },
            {
                "id": "pf-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "A function modifies a list passed as an argument, and the caller sees the change outside the function. Why?",
                "options": [
                    "Python passes lists by value",
                    "Lists are mutable and passed by object reference",
                    "The function creates a global variable",
                    "This should never happen in Python",
                ],
                "answer": "Lists are mutable and passed by object reference",
            },
            {
                "id": "pf-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A colleague argues all functions should use **kwargs instead of named parameters for flexibility. What's the strongest counter-argument?",
                "options": [
                    "**kwargs is slower to type",
                    "Named parameters give clearer signatures, better error messages, and IDE support",
                    "Python doesn't allow more than 3 named parameters",
                    "There is no valid counter-argument",
                ],
                "answer": "Named parameters give clearer signatures, better error messages, and IDE support",
            },
            {
                "id": "pf-c1", "lo_level": "create", "difficulty": "hard",
                "question": "You need a function that logs every call to another function without modifying that function's code. What pattern would you design?",
                "options": ["A decorator", "A global variable", "A second copy of the function", "A try/except block"],
                "answer": "A decorator",
            },
        ],
    },
    "photosynthesis": {
        "title": "Photosynthesis",
        "subject": "Science",
        "questions": [
            {
                "id": "ph-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What gas do plants absorb from the atmosphere during photosynthesis?",
                "options": ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
                "answer": "Carbon dioxide",
            },
            {
                "id": "ph-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "In which cell organelle does photosynthesis take place?",
                "options": ["Mitochondria", "Nucleus", "Chloroplast", "Ribosome"],
                "answer": "Chloroplast",
            },
            {
                "id": "ph-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why do plants appear green?",
                "options": [
                    "Chlorophyll absorbs green light",
                    "Chlorophyll reflects green light and absorbs other wavelengths",
                    "Green is the only color plants can produce",
                    "Plants filter out all colors except green",
                ],
                "answer": "Chlorophyll reflects green light and absorbs other wavelengths",
            },
            {
                "id": "ph-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "What is the overall relationship between photosynthesis and cellular respiration?",
                "options": [
                    "They are unrelated processes",
                    "Photosynthesis produces the glucose and oxygen that respiration consumes",
                    "Respiration only happens in plants",
                    "Photosynthesis consumes glucose to make CO2",
                ],
                "answer": "Photosynthesis produces the glucose and oxygen that respiration consumes",
            },
            {
                "id": "ph-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "A plant is moved from bright sunlight to a dim room. What would you predict happens to its rate of photosynthesis?",
                "options": ["It increases", "It decreases", "It stays exactly the same", "Photosynthesis stops needing light entirely"],
                "answer": "It decreases",
            },
            {
                "id": "ph-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "If CO2 levels in a sealed greenhouse are experimentally doubled (with light/water non-limiting), what would you expect?",
                "options": [
                    "Photosynthesis rate increases, up to a saturation point",
                    "Photosynthesis stops entirely",
                    "The plant only performs respiration",
                    "No measurable change ever occurs",
                ],
                "answer": "Photosynthesis rate increases, up to a saturation point",
            },
            {
                "id": "ph-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A plant grown in blue-red LED light grows normally, but one grown only in pure green light grows poorly. Why?",
                "options": [
                    "Green light is toxic to plants",
                    "Chlorophyll poorly absorbs green wavelengths, so less light energy is captured",
                    "Plants cannot see green light",
                    "Green light contains no photons",
                ],
                "answer": "Chlorophyll poorly absorbs green wavelengths, so less light energy is captured",
            },
            {
                "id": "ph-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "During a drought, a plant closes its stomata to conserve water. What is the direct consequence for photosynthesis?",
                "options": [
                    "No effect - stomata are unrelated to photosynthesis",
                    "Reduced CO2 intake limits the rate of photosynthesis",
                    "Photosynthesis rate increases",
                    "The plant switches entirely to respiration",
                ],
                "answer": "Reduced CO2 intake limits the rate of photosynthesis",
            },
            {
                "id": "ph-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A farmer claims adding more fertilizer will always increase crop photosynthesis rate. What's the strongest critique?",
                "options": [
                    "Fertilizer has zero effect on plants",
                    "Photosynthesis is also limited by light, CO2, and water - fertilizer alone can't overcome those limits",
                    "Fertilizer only works on animals",
                    "There is no valid critique",
                ],
                "answer": "Photosynthesis is also limited by light, CO2, and water - fertilizer alone can't overcome those limits",
            },
            {
                "id": "ph-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a simple experiment to test whether light intensity affects the rate of photosynthesis in an aquatic plant.",
                "options": [
                    "Count bubbles released per minute at varying distances from a lamp",
                    "Measure the plant's height once, one time",
                    "Ask the plant to self-report",
                    "Weigh the pot before planting",
                ],
                "answer": "Count bubbles released per minute at varying distances from a lamp",
            },
        ],
    },
}


def get_lesson(lesson_id):
    return LESSONS.get(lesson_id)


def list_lessons():
    return [
        {"lesson_id": lid, "title": l["title"], "subject": l["subject"], "question_count": len(l["questions"])}
        for lid, l in LESSONS.items()
    ]


def get_quiz_for_lesson(lesson_id):
    """Question + options only - the answer key never goes to the client."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        return None
    return {
        "lesson_id": lesson_id,
        "title": lesson["title"],
        "subject": lesson["subject"],
        "questions": [
            {"id": q["id"], "lo_level": q["lo_level"], "difficulty": q["difficulty"],
             "question": q["question"], "options": q["options"]}
            for q in lesson["questions"]
        ],
    }
