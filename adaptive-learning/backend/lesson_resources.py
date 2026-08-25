"""
lesson_resources.py — Real, lesson-specific learning resources for the
weak-LO recommendations shown after a real quiz submission (lessons.py +
mastery.py), replacing data.py's RESOURCES: those were generic Bloom-level
placeholders ("Concept Mapping Tutorial", "Evidence-Based Decision Making
Guide") reused for every lesson regardless of topic - not tied to any real
URL, and not actually about the specific lesson topic.

Only covers 4 of the 10 quiz.pdf lessons (fractions-bodmas,
pythagorean-theorem, number-patterns, area-of-shapes) that existed before
the quiz.pdf content replaced their questions and already had curated
resources. The other 6 quiz.pdf lessons (binary-numbers, percentages,
circumference-of-a-circle, sets, data-representation-and-interpretation,
angles-of-a-polygon) have no entries here yet, so get_lesson_resources()
returns [] for them and recommend_resources() in semantic_recommender.py
degrades gracefully to no resource suggestions rather than erroring.

Every resource here is a search-query URL (YouTube or Google) rather than a
hand-picked video/article link - a specific video ID can go dead, be wrong,
or simply not exist; a search query is always valid and still points the
student at real, current, relevant results for that exact topic and
cognitive level.
"""

from __future__ import annotations
from urllib.parse import quote_plus


def _youtube_search(query: str) -> str:
    return f"https://www.youtube.com/results?search_query={quote_plus(query)}"


def _google_search(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}"


LESSON_RESOURCES: dict[str, dict[str, list[dict]]] = {
    "fractions-bodmas": {
        "remember": [
            {"id": "fr-r-1", "title": "BODMAS Explained, Step by Step", "type": "video", "difficulty": "easy",
             "url": _youtube_search("BODMAS order of operations explained for grade 9")},
            {"id": "fr-r-2", "title": "BODMAS Rules Cheat Sheet", "type": "reading", "difficulty": "easy",
             "url": _google_search("BODMAS order of operations rules cheat sheet")},
            {"id": "fr-r-3", "title": "BODMAS Quiz for Beginners", "type": "quiz", "difficulty": "easy",
             "url": _google_search("BODMAS order of operations quiz grade 9")},
        ],
        "understand": [
            {"id": "fr-u-1", "title": "Why Order of Operations Matters", "type": "reading", "difficulty": "easy",
             "url": _google_search("why order of operations BODMAS matters explained")},
            {"id": "fr-u-2", "title": "Adding Fractions with Different Denominators (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("adding fractions with different denominators explained")},
            {"id": "fr-u-3", "title": "Try It Yourself: Fraction Addition", "type": "interactive", "difficulty": "medium",
             "url": "https://www.mathsisfun.com/fractions_addition.html"},
        ],
        "apply": [
            {"id": "fr-a-1", "title": "BODMAS Practice Problems Walkthrough", "type": "video", "difficulty": "medium",
             "url": _youtube_search("BODMAS practice problems walkthrough grade 9")},
            {"id": "fr-a-2", "title": "Fraction and BODMAS Practice Exercises", "type": "interactive", "difficulty": "medium",
             "url": _google_search("BODMAS fractions practice exercises with solutions")},
            {"id": "fr-a-3", "title": "Real-World BODMAS Examples", "type": "reading", "difficulty": "medium",
             "url": _google_search("BODMAS real world word problems examples")},
        ],
        "analyze": [
            {"id": "fr-n-1", "title": "Common BODMAS Mistakes Explained", "type": "reading", "difficulty": "hard",
             "url": _google_search("common BODMAS order of operations mistakes explained")},
            {"id": "fr-n-2", "title": "Multiplication vs Division Order (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("BODMAS multiplication division left to right explained")},
            {"id": "fr-n-3", "title": "BODMAS Advanced Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("BODMAS advanced quiz mixed fractions brackets")},
        ],
        "evaluate": [
            {"id": "fr-e-1", "title": "Debunking BODMAS Misconceptions", "type": "reading", "difficulty": "hard",
             "url": _google_search("BODMAS misconceptions debunked division multiplication")},
            {"id": "fr-e-2", "title": "BODMAS Critical Thinking Questions (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("BODMAS critical thinking tricky questions explained")},
            {"id": "fr-e-3", "title": "Evaluate BODMAS Problem Solutions", "type": "interactive", "difficulty": "hard",
             "url": _google_search("BODMAS evaluate correct solution word problems")},
        ],
        "create": [
            {"id": "fr-c-1", "title": "Design Your Own BODMAS Word Problem", "type": "interactive", "difficulty": "hard",
             "url": _google_search("how to write a BODMAS fraction word problem")},
            {"id": "fr-c-2", "title": "BODMAS Word Problem Design (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("creating BODMAS word problems tutorial")},
            {"id": "fr-c-3", "title": "BODMAS Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("BODMAS fractions project guide for students")},
        ],
    },
    "pythagorean-theorem": {
        "remember": [
            {"id": "pt-r-1", "title": "Pythagorean Theorem Basics, Explained", "type": "video", "difficulty": "easy",
             "url": _youtube_search("Pythagorean theorem basics explained for beginners")},
            {"id": "pt-r-2", "title": "Pythagorean Theorem Cheat Sheet", "type": "reading", "difficulty": "easy",
             "url": _google_search("Pythagorean theorem formula cheat sheet")},
            {"id": "pt-r-3", "title": "Pythagorean Theorem Quiz for Beginners", "type": "quiz", "difficulty": "easy",
             "url": _google_search("Pythagorean theorem quiz grade 9")},
        ],
        "understand": [
            {"id": "pt-u-1", "title": "Why the Pythagorean Theorem Works", "type": "reading", "difficulty": "easy",
             "url": _google_search("why does the Pythagorean theorem work proof explained simply")},
            {"id": "pt-u-2", "title": "Pythagorean Theorem Visual Proof (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("Pythagorean theorem visual proof animation")},
            {"id": "pt-u-3", "title": "Try It Yourself: Right Triangles", "type": "interactive", "difficulty": "medium",
             "url": "https://www.mathsisfun.com/pythagoras.html"},
        ],
        "apply": [
            {"id": "pt-a-1", "title": "Pythagorean Theorem Practice Walkthrough", "type": "video", "difficulty": "medium",
             "url": _youtube_search("Pythagorean theorem practice problems walkthrough")},
            {"id": "pt-a-2", "title": "Pythagorean Theorem Practice Exercises", "type": "interactive", "difficulty": "medium",
             "url": _google_search("Pythagorean theorem practice exercises with solutions")},
            {"id": "pt-a-3", "title": "Real-World Pythagorean Theorem Examples", "type": "reading", "difficulty": "medium",
             "url": _google_search("Pythagorean theorem real world applications examples")},
        ],
        "analyze": [
            {"id": "pt-n-1", "title": "Common Pythagorean Theorem Mistakes", "type": "reading", "difficulty": "hard",
             "url": _google_search("common Pythagorean theorem mistakes explained")},
            {"id": "pt-n-2", "title": "Identifying Right Triangles (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("how to tell if a triangle is a right triangle Pythagorean")},
            {"id": "pt-n-3", "title": "Pythagorean Theorem Advanced Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("Pythagorean theorem advanced quiz word problems")},
        ],
        "evaluate": [
            {"id": "pt-e-1", "title": "When the Pythagorean Theorem Doesn't Apply", "type": "reading", "difficulty": "hard",
             "url": _google_search("Pythagorean theorem limitations non right triangles Law of Cosines")},
            {"id": "pt-e-2", "title": "Pythagorean Theorem Critical Thinking (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("Pythagorean theorem critical thinking tricky questions")},
            {"id": "pt-e-3", "title": "Evaluate Pythagorean Theorem Claims", "type": "interactive", "difficulty": "hard",
             "url": _google_search("Pythagorean theorem true or false evaluate claims")},
        ],
        "create": [
            {"id": "pt-c-1", "title": "Design a Pythagorean Theorem Word Problem", "type": "interactive", "difficulty": "hard",
             "url": _google_search("how to write a Pythagorean theorem word problem")},
            {"id": "pt-c-2", "title": "Pythagorean Theorem Project Ideas (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("Pythagorean theorem project ideas for students")},
            {"id": "pt-c-3", "title": "Pythagorean Theorem Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("Pythagorean theorem project guide real world design")},
        ],
    },
    "number-patterns": {
        "remember": [
            {"id": "np-r-1", "title": "Number Patterns Basics, Explained", "type": "video", "difficulty": "easy",
             "url": _youtube_search("number patterns sequences basics explained for beginners")},
            {"id": "np-r-2", "title": "Number Patterns Cheat Sheet", "type": "reading", "difficulty": "easy",
             "url": _google_search("number patterns general term Tn cheat sheet")},
            {"id": "np-r-3", "title": "Number Patterns Quiz for Beginners", "type": "quiz", "difficulty": "easy",
             "url": _google_search("number patterns sequences quiz grade 9")},
        ],
        "understand": [
            {"id": "np-u-1", "title": "Why the General Term Formula Works", "type": "reading", "difficulty": "easy",
             "url": _google_search("why general term formula Tn works explained")},
            {"id": "np-u-2", "title": "Finding the Common Difference (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("finding common difference arithmetic sequence explained")},
            {"id": "np-u-3", "title": "Try It Yourself: Number Sequences", "type": "interactive", "difficulty": "medium",
             "url": "https://www.mathsisfun.com/algebra/sequences-finding-rule.html"},
        ],
        "apply": [
            {"id": "np-a-1", "title": "Number Patterns Practice Walkthrough", "type": "video", "difficulty": "medium",
             "url": _youtube_search("number patterns general term practice walkthrough")},
            {"id": "np-a-2", "title": "Number Patterns Practice Exercises", "type": "interactive", "difficulty": "medium",
             "url": _google_search("number patterns practice exercises with solutions")},
            {"id": "np-a-3", "title": "Real-World Number Pattern Examples", "type": "reading", "difficulty": "medium",
             "url": _google_search("number patterns real world examples applications")},
        ],
        "analyze": [
            {"id": "np-n-1", "title": "Arithmetic vs Quadratic Patterns", "type": "reading", "difficulty": "hard",
             "url": _google_search("arithmetic sequence vs quadratic number pattern difference")},
            {"id": "np-n-2", "title": "Spotting Non-Arithmetic Sequences (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("identifying non arithmetic number sequences explained")},
            {"id": "np-n-3", "title": "Number Patterns Advanced Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("number patterns advanced quiz general term")},
        ],
        "evaluate": [
            {"id": "np-e-1", "title": "Why One Pattern Can Have Many Rules", "type": "reading", "difficulty": "hard",
             "url": _google_search("multiple rules fit same number sequence ambiguity")},
            {"id": "np-e-2", "title": "Number Patterns Critical Thinking (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("number patterns critical thinking tricky questions")},
            {"id": "np-e-3", "title": "Evaluate Number Pattern Claims", "type": "interactive", "difficulty": "hard",
             "url": _google_search("evaluate true or false number pattern claims")},
        ],
        "create": [
            {"id": "np-c-1", "title": "Design Your Own Number Pattern Puzzle", "type": "interactive", "difficulty": "hard",
             "url": _google_search("how to create a number pattern sequence puzzle")},
            {"id": "np-c-2", "title": "Number Pattern Puzzle Design (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("creating number pattern puzzles tutorial")},
            {"id": "np-c-3", "title": "Number Patterns Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("number patterns project guide for students")},
        ],
    },
    "area-of-shapes": {
        "remember": [
            {"id": "ar-r-1", "title": "Area of Squares, Rectangles & Triangles", "type": "video", "difficulty": "easy",
             "url": _youtube_search("area of square rectangle triangle explained for beginners")},
            {"id": "ar-r-2", "title": "Area Formulas Cheat Sheet", "type": "reading", "difficulty": "easy",
             "url": _google_search("area formulas cheat sheet square rectangle triangle")},
            {"id": "ar-r-3", "title": "Area of Shapes Quiz for Beginners", "type": "quiz", "difficulty": "easy",
             "url": _google_search("area of shapes quiz grade 9")},
        ],
        "understand": [
            {"id": "ar-u-1", "title": "Why Triangle Area Is Half Base Times Height", "type": "reading", "difficulty": "easy",
             "url": _google_search("why is triangle area half base times height explained")},
            {"id": "ar-u-2", "title": "Area of Shapes Explained Simply (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("area of shapes explained simply for beginners")},
            {"id": "ar-u-3", "title": "Try It Yourself: Area Calculator", "type": "interactive", "difficulty": "medium",
             "url": "https://www.mathsisfun.com/area.html"},
        ],
        "apply": [
            {"id": "ar-a-1", "title": "Area of Shapes Practice Walkthrough", "type": "video", "difficulty": "medium",
             "url": _youtube_search("area of shapes practice problems walkthrough")},
            {"id": "ar-a-2", "title": "Area of Shapes Practice Exercises", "type": "interactive", "difficulty": "medium",
             "url": _google_search("area of shapes practice exercises with solutions")},
            {"id": "ar-a-3", "title": "Real-World Area Calculation Examples", "type": "reading", "difficulty": "medium",
             "url": _google_search("area calculation real world examples land plots")},
        ],
        "analyze": [
            {"id": "ar-n-1", "title": "Common Area Formula Mistakes", "type": "reading", "difficulty": "hard",
             "url": _google_search("common area formula mistakes triangle rectangle explained")},
            {"id": "ar-n-2", "title": "Same Area, Different Shapes (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("same area different shape dimensions explained")},
            {"id": "ar-n-3", "title": "Area of Shapes Advanced Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("area of shapes advanced quiz word problems")},
        ],
        "evaluate": [
            {"id": "ar-e-1", "title": "Evaluating Land Plot Area Claims", "type": "reading", "difficulty": "hard",
             "url": _google_search("how to verify advertised land plot area claims")},
            {"id": "ar-e-2", "title": "Area of Shapes Critical Thinking (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("area of shapes critical thinking tricky questions")},
            {"id": "ar-e-3", "title": "Evaluate Area Calculation Claims", "type": "interactive", "difficulty": "hard",
             "url": _google_search("evaluate true or false area calculation claims")},
        ],
        "create": [
            {"id": "ar-c-1", "title": "Design Your Own Area Word Problem", "type": "interactive", "difficulty": "hard",
             "url": _google_search("how to write an area of shapes word problem")},
            {"id": "ar-c-2", "title": "Area Word Problem Design (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("creating area of shapes word problems tutorial")},
            {"id": "ar-c-3", "title": "Area of Shapes Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("area of shapes project guide for students")},
        ],
    },
}


def get_lesson_resources(lesson_id: str, lo_name: str) -> list[dict]:
    return LESSON_RESOURCES.get(lesson_id, {}).get(lo_name, [])
