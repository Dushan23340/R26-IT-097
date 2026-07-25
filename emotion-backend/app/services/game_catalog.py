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
    # Only two games are actually built and playable right now (Fraction
    # Room, Pirate Navigator) - every emotion bucket below points at one of
    # them, nothing else. Previously this held ~60 placeholder entries
    # across 6 subjects with no matching frontend route; that meant the
    # recommendation engine could recommend a "game" that didn't exist,
    # especially whenever dominant_emotion fell back to "UNKNOWN" (no live
    # emotion data yet) since that doesn't match any emotion key and used
    # to fall through to a random placeholder. Add new buckets/entries here
    # as more real games are built.
    "Mathematics": {
        "HAPPY": [
            GameRecommendation(
                game_id="gm_math_fraction_happy",
                title="Fraction Room Rescue",
                description="A grade-9 fraction escape room with hidden papers, brackets, and BODMAS puzzles - a fun challenge to ride the good mood.",
                subject="Mathematics",
                game_type="escape room game",
                difficulty="Medium",
                target_emotion="HAPPY",
                estimated_duration_minutes=5,
                engagement_score=9.4
            ),
        ],
        "NORMAL": [
            GameRecommendation(
                game_id="gm_math_pirate_normal",
                title="Uncharted Waters: The Pirate Navigator",
                description="Sail across four Pythagorean Theorem voyages to chart a course to the treasure - steady practice to keep a settled class engaged.",
                subject="Mathematics",
                game_type="story-based game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=6,
                engagement_score=8.3
            ),
            GameRecommendation(
                game_id="gm_math_equations_eco_01",
                title="Equations Eco: Forest Restoration",
                description="A grade-9 linear equations game - solve for x at each polluted pond to clear the water and restore the forest.",
                subject="Mathematics",
                game_type="adventure game",
                difficulty="Medium",
                target_emotion="NORMAL",
                estimated_duration_minutes=7,
                engagement_score=8.9
            ),
        ],
        "CONFUSED": [
            GameRecommendation(
                game_id="gm_math_fraction_confused",
                title="Fraction Room Rescue",
                description="A grade-9 fraction escape room with hidden papers, brackets, and BODMAS puzzles - step-by-step hints to rebuild understanding.",
                subject="Mathematics",
                game_type="escape room game",
                difficulty="Medium",
                target_emotion="CONFUSED",
                estimated_duration_minutes=5,
                engagement_score=8.8
            ),
            GameRecommendation(
                game_id="gm_math_dark_room_01",
                title="Escape the Dark Room",
                description="A grade-9 algebraic fractions escape room - inspect furniture for hidden question scrolls before the glowing eyes catch you.",
                subject="Mathematics",
                game_type="escape room game",
                difficulty="Medium",
                target_emotion="CONFUSED",
                estimated_duration_minutes=6,
                engagement_score=9.0
            ),
            GameRecommendation(
                game_id="gm_math_fish_tank_01",
                title="Fish Tank Shop",
                description="A grade-9 liquid volume and capacity simulation - calculate l x b x h, convert cm3 to litres, and sell customers the right aquarium.",
                subject="Mathematics",
                game_type="simulation game",
                difficulty="Medium",
                target_emotion="CONFUSED",
                estimated_duration_minutes=7,
                engagement_score=8.7
            ),
        ],
        "BORED": [
            GameRecommendation(
                game_id="gm_math_bored_03",
                title="Fraction Room Rescue",
                description="A grade-9 fraction escape room with hidden papers, brackets, and BODMAS puzzles.",
                subject="Mathematics",
                game_type="escape room game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=5,
                engagement_score=9.6
            ),
            GameRecommendation(
                game_id="gm_math_pattern_islands_01",
                title="Pattern Islands",
                description="A grade-9 number patterns platformer - jump only on stepping stones that match each island's General Term Tn.",
                subject="Mathematics",
                game_type="platformer game",
                difficulty="Medium",
                target_emotion="BORED",
                estimated_duration_minutes=8,
                engagement_score=9.2
            ),
        ],
        "FRUSTRATED": [
            GameRecommendation(
                game_id="gm_math_pirate_01",
                title="Uncharted Waters: The Pirate Navigator",
                description="Sail across four Pythagorean Theorem voyages to chart a course to the treasure - a lighter, story-driven reset after a rough stretch.",
                subject="Mathematics",
                game_type="story-based game",
                difficulty="Medium",
                target_emotion="FRUSTRATED",
                estimated_duration_minutes=6,
                engagement_score=9.3
            ),
        ],
        "ANGRY": [
            GameRecommendation(
                game_id="gm_math_pirate_02",
                title="Uncharted Waters: The Pirate Navigator",
                description="Sail across four Pythagorean Theorem voyages to chart a course to the treasure - a calmer, story-driven reset.",
                subject="Mathematics",
                game_type="story-based game",
                difficulty="Medium",
                target_emotion="ANGRY",
                estimated_duration_minutes=6,
                engagement_score=8.9
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


def get_all_games_for(subject: str) -> List[GameRecommendation]:
    """
    All games for a subject across every emotion bucket, deduped by title
    (not game_id) - the same real game is currently listed under multiple
    emotion buckets with a different game_id each time, which would
    otherwise look like "different" games to a naive dedup and defeat the
    point of cycling through visibly different recommendations. Used while
    emotion->game mapping is intentionally disabled (see
    recommendation_engine.py) so "Recommend" can cycle through every real
    game for a subject instead of being pinned to whichever bucket the
    current dominant emotion falls into.
    """
    subject_catalog = GAME_CATALOG.get(subject, GAME_CATALOG.get("General", {}))
    seen: set = set()
    games: List[GameRecommendation] = []
    for bucket in subject_catalog.values():
        for g in bucket:
            if g.title not in seen:
                seen.add(g.title)
                games.append(g)
    return games
