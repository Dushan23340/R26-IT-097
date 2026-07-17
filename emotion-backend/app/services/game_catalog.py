from typing import Dict, List
from app.models.schemas import GameRecommendation


GAME_CATALOG: Dict[str, Dict[str, List[GameRecommendation]]] = {
    "General": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_gen_happy_01",
                title="Knowledge Relay Race",
                description="Team-based quiz competition with increasing difficulty levels.",
                subject="General",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=15,
                engagement_score=9.2
            ),
            GameRecommendation(
                game_id="gm_gen_happy_02",
                title="Creative Challenge Builder",
                description="Students create their own quiz questions for peers to solve.",
                subject="General",
                game_type="collaborative game",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=20,
                engagement_score=9.5
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_gen_norm_01",
                title="Interactive Lecture Quest",
                description="Gamified lecture with checkpoints and instant feedback.",
                subject="General",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=15,
                engagement_score=7.8
            ),
            GameRecommendation(
                game_id="gm_gen_norm_02",
                title="Collaborative Mind Map",
                description="Build knowledge maps together in real-time.",
                subject="General",
                game_type="interactive game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=8.0
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_gen_conf_01",
                title="Step-by-Step Solver",
                description="Guided problem-solving with hints and visual explanations.",
                subject="General",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.5
            ),
            GameRecommendation(
                game_id="gm_gen_conf_02",
                title="Concept Clarifier",
                description="Interactive analogy game connecting concepts to real life.",
                subject="General",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=8,
                engagement_score=8.7
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_gen_bored_01",
                title="Speed Challenge",
                description="Timed rapid-fire questions to increase adrenaline and focus.",
                subject="General",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.9
            ),
            GameRecommendation(
                game_id="gm_gen_bored_02",
                title="Escape Room Puzzle",
                description="Subject-themed escape room with team collaboration.",
                subject="General",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=15,
                engagement_score=9.1
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_gen_frust_01",
                title="Confidence Builder",
                description="Review previously mastered topics to rebuild confidence.",
                subject="General",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.3
            ),
            GameRecommendation(
                game_id="gm_gen_frust_02",
                title="Peer Helper",
                description="Pair stronger students to mentor others collaboratively.",
                subject="General",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.6
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_gen_angry_01",
                title="Calm Down Challenge",
                description="Breathing exercise + simple puzzle to reset emotional state.",
                subject="General",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.5
            ),
            GameRecommendation(
                game_id="gm_gen_angry_02",
                title="Physical Brain Break",
                description="Quick movement activity followed by gentle review.",
                subject="General",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.8
            ),
        ],
    },
    "Mathematics": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_math_happy_01",
                title="Math Olympiad Relay",
                description="Teams race to solve progressively harder math problems.",
                subject="Mathematics",
                game_type="collaborative game",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=15,
                engagement_score=9.3
            ),
            GameRecommendation(
                game_id="gm_math_happy_02",
                title="Equation Builder Tournament",
                description="Competition to build valid equations from given numbers.",
                subject="Mathematics",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=12,
                engagement_score=9.0
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_math_norm_01",
                title="Number Pattern Explorer",
                description="Interactive discovery of sequences and patterns.",
                subject="Mathematics",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=10,
                engagement_score=8.1
            ),
            GameRecommendation(
                game_id="gm_math_norm_02",
                title="Math Fact Flash Cards",
                description="Quick-fire multiplication and division facts.",
                subject="Mathematics",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=8,
                engagement_score=7.9
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_math_conf_01",
                title="Visual Fraction Solver",
                description="Use visual blocks and circles to understand fractions step-by-step.",
                subject="Mathematics",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=12,
                engagement_score=8.8
            ),
            GameRecommendation(
                game_id="gm_math_conf_02",
                title="Algebra Scaffold Walk",
                description="Guided walkthrough of linear equations with hints at each step.",
                subject="Mathematics",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=15,
                engagement_score=8.6
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_math_bored_01",
                title="Speed Arithmetic Blitz",
                description="60-second rounds of rapid mental math against the clock.",
                subject="Mathematics",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=9.0
            ),
            GameRecommendation(
                game_id="gm_math_bored_02",
                title="Math Escape Room",
                description="Solve math puzzles to unlock clues and escape the room.",
                subject="Mathematics",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=15,
                engagement_score=9.2
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_math_frust_01",
                title="Review Mastery Quiz",
                description="Quiz on previously mastered topics to rebuild math confidence.",
                subject="Mathematics",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.4
            ),
            GameRecommendation(
                game_id="gm_math_frust_02",
                title="Peer Math Tutor",
                description="Pair up: one student explains a concept they know well to another.",
                subject="Mathematics",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.7
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_math_angry_01",
                title="Math Meditation",
                description="Guided breathing with simple counting puzzles to calm down.",
                subject="Mathematics",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.6
            ),
            GameRecommendation(
                game_id="gm_math_angry_02",
                title="Pattern Coloring Break",
                description="Color geometric patterns while listening to calming instructions.",
                subject="Mathematics",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.9
            ),
        ],
    },
    "Science": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_sci_happy_01",
                title="Lab Experiment Race",
                description="Teams compete to design and simulate the best experiment.",
                subject="Science",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=18,
                engagement_score=9.4
            ),
            GameRecommendation(
                game_id="gm_sci_happy_02",
                title="Discovery Challenge",
                description="Investigate a mystery phenomenon using the scientific method.",
                subject="Science",
                game_type="collaborative game",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=20,
                engagement_score=9.1
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_sci_norm_01",
                title="Virtual Lab Walkthrough",
                description="Step-by-step guided simulation of a classic experiment.",
                subject="Science",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=8.2
            ),
            GameRecommendation(
                game_id="gm_sci_norm_02",
                title="Science Trivia Spinner",
                description="Spin-the-wheel trivia covering biology, chemistry, and physics.",
                subject="Science",
                game_type="interactive game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=10,
                engagement_score=7.9
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_sci_conf_01",
                title="Atom Builder Visualizer",
                description="Drag-and-drop electron shells to build atoms visually.",
                subject="Science",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.6
            ),
            GameRecommendation(
                game_id="gm_sci_conf_02",
                title="Food Chain Puzzle",
                description="Arrange organisms in correct order with animated explanations.",
                subject="Science",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=8,
                engagement_score=8.4
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_sci_bored_01",
                title="Element Quiz Blitz",
                description="Rapid-fire periodic table questions with timers and power-ups.",
                subject="Science",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.8
            ),
            GameRecommendation(
                game_id="gm_sci_bored_02",
                title="Science Escape Lab",
                description="Escape a virtual lab by solving science riddles and puzzles.",
                subject="Science",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=15,
                engagement_score=9.0
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_sci_frust_01",
                title="Known Concept Review",
                description="Revisit familiar biology concepts with confidence-building questions.",
                subject="Science",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.2
            ),
            GameRecommendation(
                game_id="gm_sci_frust_02",
                title="Lab Partner Support",
                description="Work in pairs where one guides the other through a safe experiment.",
                subject="Science",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.5
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_sci_angry_01",
                title="Nature Sound Observation",
                description="Observe slow-motion nature videos with guided breathing.",
                subject="Science",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.4
            ),
            GameRecommendation(
                game_id="gm_sci_angry_02",
                title="Grow a Plant Simulation",
                description="Calm plant-growing simulation requiring gentle patience.",
                subject="Science",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.7
            ),
        ],
    },
    "English": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_eng_happy_01",
                title="Story Relay",
                description="Teams build a story sentence by sentence in a timed relay.",
                subject="English",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=15,
                engagement_score=9.1
            ),
            GameRecommendation(
                game_id="gm_eng_happy_02",
                title="Poetry Slam Workshop",
                description="Create and perform short poems in a supportive competition.",
                subject="English",
                game_type="collaborative game",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=18,
                engagement_score=9.3
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_eng_norm_01",
                title="Vocabulary Bingo",
                description="Classic bingo using vocabulary words and definitions.",
                subject="English",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=10,
                engagement_score=8.0
            ),
            GameRecommendation(
                game_id="gm_eng_norm_02",
                title="Grammar Detective",
                description="Find and fix grammar mistakes in fun, silly sentences.",
                subject="English",
                game_type="interactive game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=7.8
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_eng_conf_01",
                title="Sentence Scaffold",
                description="Build complex sentences piece by piece with guided hints.",
                subject="English",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.5
            ),
            GameRecommendation(
                game_id="gm_eng_conf_02",
                title="Comic Strip Sequencer",
                description="Arrange comic panels in order and write narration for each.",
                subject="English",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=12,
                engagement_score=8.3
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_eng_bored_01",
                title="Spelling Bee Speed Round",
                description="Fast-paced spelling challenge with elimination rounds.",
                subject="English",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.7
            ),
            GameRecommendation(
                game_id="gm_eng_bored_02",
                title="Synonym Showdown",
                description="Rapid-fire synonym matching against the clock.",
                subject="English",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=8,
                engagement_score=8.9
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_eng_frust_01",
                title="Known Word Review",
                description="Flashcard review of previously mastered vocabulary words.",
                subject="English",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.1
            ),
            GameRecommendation(
                game_id="gm_eng_frust_02",
                title="Reading Buddy",
                description="Pair up to read a familiar story aloud together.",
                subject="English",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.4
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_eng_angry_01",
                title="Calm Poetry Recital",
                description="Recite calming nature poems with guided breathing rhythm.",
                subject="English",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.5
            ),
            GameRecommendation(
                game_id="gm_eng_angry_02",
                title="Gentle Journal Prompt",
                description="Write three sentences about something positive, then share if willing.",
                subject="English",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.8
            ),
        ],
    },
    "History": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_hist_happy_01",
                title="Historical Debate Club",
                description="Teams debate historical decisions with assigned roles.",
                subject="History",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=18,
                engagement_score=9.2
            ),
            GameRecommendation(
                game_id="gm_hist_happy_02",
                title="Timeline Race",
                description="Compete to place historical events in correct chronological order.",
                subject="History",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=12,
                engagement_score=9.0
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_hist_norm_01",
                title="Map Explorer",
                description="Interactive exploration of historical maps and territories.",
                subject="History",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=10,
                engagement_score=8.1
            ),
            GameRecommendation(
                game_id="gm_hist_norm_02",
                title="Artifact Detective",
                description="Examine historical artifacts and guess their origin and use.",
                subject="History",
                game_type="interactive game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=7.9
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_hist_conf_01",
                title="Cause and Effect Chain",
                description="Link historical causes to their effects in a visual chain.",
                subject="History",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.4
            ),
            GameRecommendation(
                game_id="gm_hist_conf_02",
                title="Historical Figure Matcher",
                description="Match figures to their achievements with animated explanations.",
                subject="History",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=8,
                engagement_score=8.2
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_hist_bored_01",
                title="Date Dash",
                description="Rapid-fire matching of dates to historical events.",
                subject="History",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.6
            ),
            GameRecommendation(
                game_id="gm_hist_bored_02",
                title="History Escape Castle",
                description="Escape a medieval castle by solving history riddles.",
                subject="History",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=15,
                engagement_score=8.8
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_hist_frust_01",
                title="Review Your Timeline",
                description="Revisit a previously studied era with easy recall questions.",
                subject="History",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.0
            ),
            GameRecommendation(
                game_id="gm_hist_frust_02",
                title="History Buddy Quiz",
                description="Pair quiz on familiar topics to rebuild confidence.",
                subject="History",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.3
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_hist_angry_01",
                title="Peaceful Revolution Story",
                description="Listen to a calming story about peaceful change-makers.",
                subject="History",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.3
            ),
            GameRecommendation(
                game_id="gm_hist_angry_02",
                title="Ancient Garden Meditation",
                description="Guided visualization of a peaceful ancient garden.",
                subject="History",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.6
            ),
        ],
    },
    "Programming": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_prog_happy_01",
                title="Hackathon Lite",
                description="Small teams compete to build the coolest mini-project in 20 minutes.",
                subject="Programming",
                game_type="collaborative game",
                difficulty="Hard",
                target_emotion="HAPPY",
                estimated_duration_minutes=20,
                engagement_score=9.5
            ),
            GameRecommendation(
                game_id="gm_prog_happy_02",
                title="Code Golf Challenge",
                description="Write the shortest valid solution to a fun problem.",
                subject="Programming",
                game_type="collaborative game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=15,
                engagement_score=9.1
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_prog_norm_01",
                title="Interactive Code Tracer",
                description="Step through code execution visually with a debugger game.",
                subject="Programming",
                game_type="interactive game",
                difficulty="Easy",
                target_emotion="NORMAL",
                estimated_duration_minutes=12,
                engagement_score=8.3
            ),
            GameRecommendation(
                game_id="gm_prog_norm_02",
                title="Syntax Puzzle",
                description="Drag-and-drop syntax blocks to form valid code statements.",
                subject="Programming",
                game_type="interactive game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=10,
                engagement_score=8.0
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_prog_conf_01",
                title="Variable Visualizer",
                description="Watch variables change values step-by-step in an animated visualization.",
                subject="Programming",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=10,
                engagement_score=8.6
            ),
            GameRecommendation(
                game_id="gm_prog_conf_02",
                title="Loop Unroller",
                description="See what a loop does iteration by iteration with visual output.",
                subject="Programming",
                game_type="concept-based game",
                difficulty="Easy",
                target_emotion="CONFUSED",
                estimated_duration_minutes=12,
                engagement_score=8.4
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_prog_bored_01",
                title="Speed Typing Race",
                description="Type code snippets as fast and accurately as possible.",
                subject="Programming",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=8.8
            ),
            GameRecommendation(
                game_id="gm_prog_bored_02",
                title="Bug Hunt Blitz",
                description="Find as many bugs as possible in broken code within a time limit.",
                subject="Programming",
                game_type="quiz game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=8,
                engagement_score=9.0
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_prog_frust_01",
                title="Easy Review Kata",
                description="Solve a familiar, simple coding exercise to rebuild confidence.",
                subject="Programming",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=8,
                engagement_score=8.2
            ),
            GameRecommendation(
                game_id="gm_prog_frust_02",
                title="Pair Programming Warmup",
                description="Pair up: one types, one guides through an easy exercise.",
                subject="Programming",
                game_type="easy challenge game",
                difficulty="Easy",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=10,
                engagement_score=8.5
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_prog_angry_01",
                title="Rubber Duck Debug",
                description="Explain your code calmly to a rubber duck to vent and refocus.",
                subject="Programming",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=5,
                engagement_score=7.4
            ),
            GameRecommendation(
                game_id="gm_prog_angry_02",
                title="Code Garden Meditation",
                description="Watch satisfying code refactoring animations with calming music.",
                subject="Programming",
                game_type="calm-down game",
                difficulty="Easy",
                target_emotion="ANGRY",
                estimated_duration_minutes=7,
                engagement_score=7.7
            ),
        ],
    },
}


def get_games_for(subject: str, emotion: str) -> List[GameRecommendation]:
    """
    Get games for a (subject, emotion) pair.
    Falls back to General if subject not found.
    Falls back to NORMAL if emotion not found.
    """
    subject_catalog = GAME_CATALOG.get(subject, GAME_CATALOG.get("General", {}))
    games = subject_catalog.get(emotion)
    if not games:
        games = subject_catalog.get("NORMAL", [])
    return games


def list_subjects() -> List[str]:
    """Return all available subjects."""
    return list(GAME_CATALOG.keys())
