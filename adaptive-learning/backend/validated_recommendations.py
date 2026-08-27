"""validated_recommendations.py — Teacher/expert-validated, emotion-aware
video recommendations (proposal SO3's "(bloom_level x mastery_tier x
emotion) recommendation mapping" that semantic_recommender.py's
resolve_recommendation_strategy() docstring flagged as "the user is
preparing separately as an external document").

The source document maps (topic x bloom_level x mastery_tier x emotion)
to one specific YouTube video, covering all 6 lessons lessons.py has -
the original quiz.pdf set was narrowed from 10 down to exactly these 6
(number-patterns, fractions-bodmas, area-of-shapes, binary-numbers,
percentages, sets) specifically so every lesson has a validated
recommendation here; the other 4 (pythagorean-theorem,
circumference-of-a-circle, data-representation-and-interpretation,
angles-of-a-polygon) were removed from lessons.py entirely rather than
left without coverage. In practice every Bloom level and both mastery
tiers (weak/average) resolve to the IDENTICAL video within a lesson once
emotion is fixed - the document's 6-Bloom-level x 2-mastery-tier rows
never actually differ - so the effective, faithful lookup here is
(lesson_id x emotion), not a real 4-dimensional table.

The original quiz.pdf only exposed each video's title, not its href -
"url" was a YouTube search-query built from that title as a fallback (a
search page can surface ads/unrelated results first, but a search is
never a dead link). recomandation_type__1__updated.pdf added real
hyperlink annotations for every entry; those were extracted directly
(PyMuPDF link-annotation extraction, not guessed) and cross-checked for
internal consistency - all 6 Bloom levels x both mastery tiers agreed on
one URL per (lesson, emotion) for every cell except two, which the
source document itself leaves ambiguous (two different videos cited
inconsistently across bloom levels for the same cell) - those two keep
the search-query fallback rather than guessing which one was meant:
fractions-bodmas/confused and area-of-shapes/angry (that cell's title
also literally names two "P 05"/"P 04" video parts; only "P 05"'s link
resolved unambiguously, so it's used alone rather than picking one of a
pair with no way to tell which is right without asking the source).

This fully REPLACES lesson_resources.py's Bloom-level-keyed generic pool
for the lessons it covers - it isn't blended with it. See
semantic_recommender.recommend_resources(), which checks here first and
short-circuits the semantic-similarity ranking when a match exists,
since a teacher-validated answer is more authoritative than a re-ranked
generic search-query guess.
"""

from __future__ import annotations
from urllib.parse import quote_plus


def _youtube_search(query: str) -> str:
    return f"https://www.youtube.com/results?search_query={quote_plus(query)}"


# lesson_id -> emotion -> {"title": ..., "url": ...}. "url" is optional -
# only present once the real direct link has been confirmed (extracted
# from the source PDF's own hyperlink annotations, or given directly);
# the two entries without one still fall back to a search-query URL
# built from the title, because the source document itself is ambiguous
# for those two cells (see module docstring). Both mastery tiers
# (weak/average) and all 6 Bloom levels point to this same title/url in
# the source document.
VALIDATED_VIDEOS: dict[str, dict[str, dict[str, str]]] = {
    "number-patterns": {
        "happy": {
            "title": "Math Antics - Number Patterns",
            "url": "https://www.youtube.com/watch?v=vV7C7bXm4VI",
        },
        "normal": {
            "title": "Grade 09 - Maths - English Medium - Number Patterns - Unit 01 | Begining of 2025 Online Maths Class",
            "url": "https://www.youtube.com/live/XYNP2IRf8aA?si=UjxFFLwHsw33-RIu",
        },
        "confused": {
            "title": "Lesson 1. Number Patterns | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=x2HZ8apKcVE",
        },
        "bored": {
            "title": "Grade 9 Maths in English(number patterns_lesson 01) part 1",
            "url": "https://www.youtube.com/watch?v=Paa6Yndv3pU",
        },
        "frustrated": {
            "title": "Mathematics With Malshi Teacher || Grade 9 || English Medium || Number Patterns",
            "url": "https://www.youtube.com/watch?v=8Ffn6fmGTPo",
        },
        "angry": {
            "title": "Grade 9 | Mathematics - Number Patterns ( Lesson 1 )",
            "url": "https://www.youtube.com/watch?v=niXdSw-TUJ8",
        },
    },
    "fractions-bodmas": {
        "happy": {
            "title": "Fractions Grade 9 Mathematics | National Curriculum",
            "url": "https://www.youtube.com/watch?v=CSBsHjPrMdY",
        },
        "normal": {
            "title": "Fractions on the number line (practice) | Khan Academy",
            "url": "https://www.khanacademy.org/math/arithmetic-home/arith-review-fractions/fractions-on-the-number-line/e/fractions_on_the_number_line_1",
        },
        # Ambiguous in the source: rows cite "Lesson 3. Fractions..." AND
        # "Understand fractions... Khan Academy" together for some Bloom
        # levels, but only the Khan Academy one alone for others - no
        # single answer to extract with confidence. Search-query fallback.
        "confused": {"title": "Understand fractions | Arithmetic | Math | Khan Academy"},
        "bored": {
            "title": "Fractions Are Parts",
            "url": "https://www.mathantics.com/lesson/fractions-are-parts",
        },
        "frustrated": {
            "title": "Fractions – Corbettmaths",
            "url": "https://corbettmaths.com/tag/fractions/",
        },
        "angry": {
            "title": "Lesson 3. Fractions | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=IAa5_qwUC48",
        },
    },
    "percentages": {
        "happy": {
            "title": "Grade 9 | lesson 4 | percentages | exercises | part 1",
            "url": "https://www.youtube.com/watch?v=RUAJEdIsdps&t=13s",
        },
        "normal": {
            "title": "PERCENTAGE INCREASE & DECREASE (Grade 8 & 9)",
            "url": "https://www.youtube.com/watch?v=qS4FWpDpbHA",
        },
        "confused": {
            "title": "English Medium Grade 9-2026 Saturday session PERCENTAGES - Part 3",
            "url": "https://www.youtube.com/watch?v=xiHA9yuNQuM",
        },
        "bored": {
            "title": "Grade 9 - Percentages - English Medium",
            "url": "https://www.youtube.com/watch?v=i-YX6DKjG0M",
        },
        "frustrated": {
            "title": "GRADE 9 | MATHS | PERCENTAGES | SANSITHA KODITHUWAKKU",
            "url": "https://www.youtube.com/watch?v=MRupMWf18Rw&list=PLnki_B5Wj7tsFH8cNRfSAJf4tZgZE5K64",
        },
        "angry": {
            "title": "Lesson 4. Percentages | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=PaXQ2QiCFn8",
        },
    },
    "area-of-shapes": {
        "happy": {
            "title": "Grade 9 Maths | Area Exercise Discussion (Full Video) | All Questions Explained | Sri Lanka Syllabus",
            "url": "https://www.youtube.com/watch?v=bNeOh3UG_oQ",
        },
        "normal": {
            "title": "Maths in English. Sri Lankan Syllabus. Area part 1 (Grade 9)",
            "url": "https://www.youtube.com/watch?v=PaxYKQtXytE",
        },
        "confused": {
            "title": "Lesson 23. Area | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=m0t02oAxaWc",
        },
        "bored": {
            "title": "How to Find Area | Rectangles, Squares, Triangles, & Circles | Math Mr. J",
            "url": "https://www.youtube.com/watch?v=LpyzdO2fXtA",
        },
        "frustrated": {
            "title": "Maths - Grade 9 - Unit 23 - Area - Part 03 - English Medium",
            "url": "https://www.youtube.com/watch?v=PeQVWeapbb4",
        },
        # Source cites two parts ("P 05" and "P 04") for this cell; only
        # P 05's link resolved unambiguously in the extraction, so that
        # one is used alone rather than guessing at the unresolved P 04.
        "angry": {
            "title": "Grade 09 - Mathematics (English Medium) - Area - 02 ( Lesson 23 ) - P 05",
            "url": "https://www.youtube.com/watch?v=jbWPTL_l5hQ&t=1s",
        },
    },
    "sets": {
        "happy": {
            "title": "Master Grade 9 Mathematics: Unit 1 Part 4: Further on Sets Questions & Answers | Easy Tutorial",
            "url": "https://www.youtube.com/watch?v=CNbW9X1q44E",
        },
        "normal": {
            "title": "Set Theory | All-in-One Video",
            "url": "https://www.youtube.com/watch?v=5ZhNmKb-dqk",
        },
        "confused": {
            "title": "Lesson 22. Sets | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=VIUXzZVPBl4",
        },
        "bored": {
            "title": "Sets - Grade 9 - 22nd lesson - Maths English Medium - Sri Lankan National Curriculum",
            "url": "https://www.youtube.com/watch?v=luvamEBETP4",
        },
        "frustrated": {
            "title": "Sets (Lesson 22) | Grade 09 - Mathematics - P 02",
            "url": "https://www.youtube.com/watch?v=8iXmGTTr3Z8",
        },
        "angry": {
            "title": "SET part 1 | Grade 9 Maths | English medium",
            "url": "https://www.youtube.com/watch?v=cxgs9eEgMF8",
        },
    },
    "binary-numbers": {
        "happy": {
            "title": "Binary Numbers Grade 9 Maths",
            "url": "https://www.youtube.com/watch?v=T2yEpuhiz8Q",
        },
        "normal": {
            "title": "Gr 9 Mathematics Unit 2 - Binary Numbers",
            "url": "https://www.youtube.com/watch?v=jkssfzPl9Po",
        },
        "confused": {
            "title": "Lesson 2. Binary Numbers | Maths Session for Grade 09",
            "url": "https://www.youtube.com/watch?v=itOHM3vkgk0",
        },
        "bored": {
            "title": "Grade 9 | Mathematics - Binary Numbers ( Lesson 2 )",
            "url": "https://www.youtube.com/watch?v=IFqMhpdHgQM",
        },
        "frustrated": {
            "title": "Maths - Grade 9 - 2nd lesson - Binary Numbers (Sinhala Medium)",
            "url": "https://www.youtube.com/watch?v=-zymY0NLW7k",
        },
        "angry": {
            "title": "Grade 09 | Binary Numbers | Unit 02 | Day 01 | English Medium | 2025.2.2",
            "url": "https://www.youtube.com/watch?v=DFrJbEsGfEQ",
        },
    },
}


def get_validated_video(lesson_id: str, emotion: str | None) -> dict | None:
    """One teacher-validated video for this lesson + emotional state, or
    None if this lesson isn't covered by the source document. `emotion`
    is matched case-insensitively and falls back to "normal" when not
    supplied - the document's own "no strong emotional state detected"
    case."""
    lesson_videos = VALIDATED_VIDEOS.get(lesson_id)
    if not lesson_videos:
        return None

    key = (emotion or "normal").strip().lower()
    entry = lesson_videos.get(key) or lesson_videos.get("normal")
    if not entry:
        return None

    title = entry["title"]
    return {
        "id": f"validated-{lesson_id}-{key}",
        "title": title,
        "type": "video",
        "difficulty": "medium",
        "url": entry.get("url") or _youtube_search(title),
    }
