"""
data.py — Learning Outcomes, Quiz Data & Adaptive Resources
Based on Bloom's Taxonomy + Adaptive Support System
"""

from enum import Enum

# ───────────────────────────────────────────────
# STEP 2 — Define Learning Outcomes (LOs)
# ───────────────────────────────────────────────
# Bloom's Taxonomy levels mapped to learning outcomes

class BloomLevel(Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"

# All learning outcomes
LEARNING_OUTCOMES = [level.value for level in BloomLevel]

# Descriptions for each LO
LO_DESCRIPTIONS = {
    "remember": "Recall facts, terms, basic concepts, and answers.",
    "understand": "Explain ideas or concepts in your own words.",
    "apply": "Use information in new situations and solve problems.",
    "analyze": "Draw connections among ideas and break information into parts.",
    "evaluate": "Justify a stand or decision by critiquing evidence.",
    "create": "Produce new or original work by combining elements."
}

# ───────────────────────────────────────────────
# STEP 3 — Quiz Data & Templates
# ───────────────────────────────────────────────

# Sample quiz results (simulates student answers)
SAMPLE_QUIZ_RESULTS = {
    "remember": True,
    "understand": True,
    "apply": False,
    "analyze": False,
    "evaluate": False,
    "create": False
}

# Quiz templates per LO (for generating adaptive quizzes)
QUIZ_TEMPLATES = {
    "remember": {
        "question_type": "multiple_choice",
        "examples": [
            "What is the definition of ___?",
            "List the main components of ___.",
            "Identify the correct term for ___."
        ]
    },
    "understand": {
        "question_type": "short_answer",
        "examples": [
            "Explain the concept of ___ in your own words.",
            "Summarize the main idea of ___.",
            "Describe how ___ works."
        ]
    },
    "apply": {
        "question_type": "problem_solving",
        "examples": [
            "Solve the following problem using ___.",
            "Apply the formula to calculate ___.",
            "Demonstrate how you would use ___ in a real scenario."
        ]
    },
    "analyze": {
        "question_type": "case_study",
        "examples": [
            "Compare and contrast ___ and ___.",
            "Identify the relationships between ___ and ___.",
            "Break down the following scenario and identify key elements."
        ]
    },
    "evaluate": {
        "question_type": "essay",
        "examples": [
            "Critique the argument presented in ___.",
            "Defend your position on ___.",
            "Assess the strengths and weaknesses of ___."
        ]
    },
    "create": {
        "question_type": "project",
        "examples": [
            "Design a new solution for ___.",
            "Develop a plan to implement ___.",
            "Construct a model that demonstrates ___."
        ]
    }
}

# ───────────────────────────────────────────────
# Adaptive Learning Resources Mapped to Each LO
# ───────────────────────────────────────────────

RESOURCES = {
    "remember": [
        {"id": "r1", "title": "Flashcards for Key Terms", "type": "interactive", "difficulty": "easy", "duration_min": 10},
        {"id": "r2", "title": "Memory Palace Technique Video", "type": "video", "difficulty": "easy", "duration_min": 8},
        {"id": "r3", "title": "Spaced Repetition Quiz", "type": "quiz", "difficulty": "easy", "duration_min": 15},
        {"id": "r4", "title": "Glossary & Definitions PDF", "type": "reading", "difficulty": "easy", "duration_min": 12},
    ],
    "understand": [
        {"id": "u1", "title": "Concept Mapping Tutorial", "type": "interactive", "difficulty": "easy", "duration_min": 15},
        {"id": "u2", "title": "Explain Like I'm 5 (ELI5) Guide", "type": "reading", "difficulty": "easy", "duration_min": 10},
        {"id": "u3", "title": "Paraphrasing Practice Exercises", "type": "quiz", "difficulty": "medium", "duration_min": 20},
        {"id": "u4", "title": "Visual Summary Infographic", "type": "video", "difficulty": "easy", "duration_min": 7},
    ],
    "apply": [
        {"id": "a1", "title": "Guided Problem-Solving Walkthrough", "type": "video", "difficulty": "medium", "duration_min": 25},
        {"id": "a2", "title": "Practice Problems with Hints", "type": "interactive", "difficulty": "medium", "duration_min": 30},
        {"id": "a3", "title": "Real-World Scenario Cases", "type": "reading", "difficulty": "medium", "duration_min": 20},
        {"id": "a4", "title": "Step-by-Step Solution Generator", "type": "quiz", "difficulty": "medium", "duration_min": 25},
    ],
    "analyze": [
        {"id": "n1", "title": "Compare & Contrast Framework", "type": "interactive", "difficulty": "medium", "duration_min": 20},
        {"id": "n2", "title": "Cause-and-Effect Analysis Video", "type": "video", "difficulty": "medium", "duration_min": 18},
        {"id": "n3", "title": "Data Interpretation Exercises", "type": "quiz", "difficulty": "hard", "duration_min": 35},
        {"id": "n4", "title": "Critical Thinking Case Studies", "type": "reading", "difficulty": "hard", "duration_min": 30},
    ],
    "evaluate": [
        {"id": "e1", "title": "Argument Evaluation Checklist", "type": "interactive", "difficulty": "hard", "duration_min": 25},
        {"id": "e2", "title": "Peer Review Simulation", "type": "quiz", "difficulty": "hard", "duration_min": 40},
        {"id": "e3", "title": "Evidence-Based Decision Making Guide", "type": "reading", "difficulty": "hard", "duration_min": 25},
        {"id": "e4", "title": "Debate & Discussion Prompts", "type": "video", "difficulty": "hard", "duration_min": 20},
    ],
    "create": [
        {"id": "c1", "title": "Design Thinking Workshop", "type": "interactive", "difficulty": "hard", "duration_min": 45},
        {"id": "c2", "title": "Project-Based Learning Template", "type": "reading", "difficulty": "hard", "duration_min": 30},
        {"id": "c3", "title": "Innovation Challenge Prompts", "type": "quiz", "difficulty": "hard", "duration_min": 50},
        {"id": "c4", "title": "Portfolio Building Guide", "type": "video", "difficulty": "hard", "duration_min": 25},
    ]
}

# ───────────────────────────────────────────────
# Support Levels Based on Performance
# ───────────────────────────────────────────────

SUPPORT_LEVELS = {
    "intensive": {
        "name": "Intensive Support",
        "description": "Multiple weak areas detected. Extra scaffolding, guided practice, and frequent check-ins recommended.",
        "check_in_frequency": "daily",
        "max_resources_per_lo": 4,
        "hint_level": "high"
    },
    "moderate": {
        "name": "Moderate Support",
        "description": "Some weak areas detected. Targeted practice with moderate hints and periodic reviews.",
        "check_in_frequency": "every_2_days",
        "max_resources_per_lo": 3,
        "hint_level": "medium"
    },
    "light": {
        "name": "Light Support",
        "description": "Few weak areas. Self-paced practice with minimal scaffolding.",
        "check_in_frequency": "weekly",
        "max_resources_per_lo": 2,
        "hint_level": "low"
    },
    "mastery": {
        "name": "Mastery Track",
        "description": "Strong performance across all areas. Advance to higher-order challenges and enrichment activities.",
        "check_in_frequency": "bi_weekly",
        "max_resources_per_lo": 1,
        "hint_level": "minimal"
    }
}

# ───────────────────────────────────────────────
# Difficulty Progression Paths
# ───────────────────────────────────────────────

DIFFICULTY_PROGRESSION = {
    "remember": ["easy"],
    "understand": ["easy", "medium"],
    "apply": ["easy", "medium", "hard"],
    "analyze": ["medium", "hard"],
    "evaluate": ["medium", "hard"],
    "create": ["medium", "hard"]
}


def get_resources_for_lo(lo_name, difficulty_filter=None, max_count=None):
    """Fetch adaptive resources for a specific learning outcome."""
    resources = RESOURCES.get(lo_name, [])
    if difficulty_filter:
        resources = [r for r in resources if r["difficulty"] == difficulty_filter]
    if max_count:
        resources = resources[:max_count]
    return resources


def get_quiz_template(lo_name):
    """Get quiz template for a specific learning outcome."""
    return QUIZ_TEMPLATES.get(lo_name, {})


if __name__ == "__main__":
    print("Learning Outcomes:", LEARNING_OUTCOMES)
    print("Sample Quiz:", SAMPLE_QUIZ_RESULTS)
    print("Resources for 'apply':", get_resources_for_lo("apply"))
