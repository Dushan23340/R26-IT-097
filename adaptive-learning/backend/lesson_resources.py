"""
lesson_resources.py — Real, lesson-specific learning resources for the
weak-LO recommendations shown after a real quiz submission (lessons.py +
mastery.py), replacing data.py's RESOURCES: those were generic Bloom-level
placeholders ("Concept Mapping Tutorial", "Evidence-Based Decision Making
Guide") reused for every lesson regardless of topic - not tied to any real
URL, and not actually about Python functions or photosynthesis specifically.

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
    "python-functions": {
        "remember": [
            {"id": "pf-r-1", "title": "Python Functions Basics, Explained", "type": "video", "difficulty": "easy",
             "url": _youtube_search("python functions basics explained for beginners")},
            {"id": "pf-r-2", "title": "Python Functions Cheat Sheet", "type": "reading", "difficulty": "easy",
             "url": _google_search("python functions cheat sheet definition syntax")},
            {"id": "pf-r-3", "title": "Python Functions Quiz for Beginners", "type": "quiz", "difficulty": "easy",
             "url": _google_search("python functions quiz beginner")},
        ],
        "understand": [
            {"id": "pf-u-1", "title": "Python Functions Explained Simply", "type": "reading", "difficulty": "easy",
             "url": _google_search("python functions explained simply for beginners")},
            {"id": "pf-u-2", "title": "Python Functions Tutorial (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("python functions tutorial for beginners")},
            {"id": "pf-u-3", "title": "Try It Yourself: Python Functions", "type": "interactive", "difficulty": "medium",
             "url": "https://www.w3schools.com/python/python_functions.asp"},
        ],
        "apply": [
            {"id": "pf-a-1", "title": "Python Functions Practice Walkthrough", "type": "video", "difficulty": "medium",
             "url": _youtube_search("python functions practice problems walkthrough")},
            {"id": "pf-a-2", "title": "Python Functions Practice Exercises", "type": "interactive", "difficulty": "medium",
             "url": _google_search("python functions practice exercises with solutions")},
            {"id": "pf-a-3", "title": "Real-World Python Function Examples", "type": "reading", "difficulty": "medium",
             "url": _google_search("python functions real world examples")},
        ],
        "analyze": [
            {"id": "pf-n-1", "title": "Default vs Mutable Arguments Explained", "type": "reading", "difficulty": "hard",
             "url": _google_search("python mutable default arguments gotcha explained")},
            {"id": "pf-n-2", "title": "Python Scope and Parameters (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("python function scope and parameters explained")},
            {"id": "pf-n-3", "title": "Python Functions - Advanced Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("python functions advanced quiz recursion args kwargs")},
        ],
        "evaluate": [
            {"id": "pf-e-1", "title": "Python Function Design Best Practices", "type": "reading", "difficulty": "hard",
             "url": _google_search("python function design best practices clean code")},
            {"id": "pf-e-2", "title": "Python Code Review: Functions (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("python function code review anti patterns")},
            {"id": "pf-e-3", "title": "Named Parameters vs **kwargs Debate", "type": "interactive", "difficulty": "hard",
             "url": _google_search("python named parameters vs kwargs pros and cons")},
        ],
        "create": [
            {"id": "pf-c-1", "title": "Beginner Python Project Ideas Using Functions", "type": "interactive", "difficulty": "hard",
             "url": _google_search("beginner python project ideas using functions")},
            {"id": "pf-c-2", "title": "Build a Python Decorator (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("build a python decorator from scratch tutorial")},
            {"id": "pf-c-3", "title": "Python Function Design Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("python function design project guide")},
        ],
    },
    "photosynthesis": {
        "remember": [
            {"id": "ph-r-1", "title": "Photosynthesis Basics, Explained", "type": "video", "difficulty": "easy",
             "url": _youtube_search("photosynthesis basics explained for students")},
            {"id": "ph-r-2", "title": "Photosynthesis: Key Terms & Definition", "type": "reading", "difficulty": "easy",
             "url": "https://en.wikipedia.org/wiki/Photosynthesis"},
            {"id": "ph-r-3", "title": "Photosynthesis Quiz (Grade 9)", "type": "quiz", "difficulty": "easy",
             "url": _google_search("photosynthesis quiz grade 9")},
        ],
        "understand": [
            {"id": "ph-u-1", "title": "Photosynthesis Explained Simply", "type": "reading", "difficulty": "easy",
             "url": _google_search("photosynthesis explained simply for students")},
            {"id": "ph-u-2", "title": "Photosynthesis Animation (Video)", "type": "video", "difficulty": "easy",
             "url": _youtube_search("photosynthesis explained animation for beginners")},
            {"id": "ph-u-3", "title": "Interactive Photosynthesis Diagram", "type": "interactive", "difficulty": "medium",
             "url": _google_search("photosynthesis interactive diagram labeled")},
        ],
        "apply": [
            {"id": "ph-a-1", "title": "Photosynthesis Experiment (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("photosynthesis experiment real world example")},
            {"id": "ph-a-2", "title": "Photosynthesis Practice Worksheet", "type": "interactive", "difficulty": "medium",
             "url": _google_search("photosynthesis practice problems worksheet")},
            {"id": "ph-a-3", "title": "Photosynthesis in Everyday Life", "type": "reading", "difficulty": "medium",
             "url": _google_search("photosynthesis real world applications everyday life")},
        ],
        "analyze": [
            {"id": "ph-n-1", "title": "Photosynthesis vs Cellular Respiration", "type": "reading", "difficulty": "hard",
             "url": _google_search("photosynthesis vs cellular respiration comparison")},
            {"id": "ph-n-2", "title": "What Affects Photosynthesis Rate? (Video)", "type": "video", "difficulty": "medium",
             "url": _youtube_search("factors affecting rate of photosynthesis explained")},
            {"id": "ph-n-3", "title": "Photosynthesis Analysis Quiz", "type": "quiz", "difficulty": "hard",
             "url": _google_search("photosynthesis analysis quiz advanced grade 9")},
        ],
        "evaluate": [
            {"id": "ph-e-1", "title": "Design a Photosynthesis Experiment", "type": "reading", "difficulty": "hard",
             "url": _google_search("how to design a photosynthesis experiment variables")},
            {"id": "ph-e-2", "title": "Photosynthesis Critical Thinking (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("photosynthesis critical thinking questions explained")},
            {"id": "ph-e-3", "title": "Evaluate a Photosynthesis Case Study", "type": "interactive", "difficulty": "hard",
             "url": _google_search("photosynthesis case study evaluation questions")},
        ],
        "create": [
            {"id": "ph-c-1", "title": "Photosynthesis Science Fair Ideas", "type": "interactive", "difficulty": "hard",
             "url": _google_search("photosynthesis science fair project ideas")},
            {"id": "ph-c-2", "title": "Build Your Own Photosynthesis Model (Video)", "type": "video", "difficulty": "hard",
             "url": _youtube_search("build a photosynthesis model project")},
            {"id": "ph-c-3", "title": "Photosynthesis Project Guide", "type": "reading", "difficulty": "hard",
             "url": _google_search("photosynthesis project guide for students")},
        ],
    },
}


def get_lesson_resources(lesson_id: str, lo_name: str) -> list[dict]:
    return LESSON_RESOURCES.get(lesson_id, {}).get(lo_name, [])
