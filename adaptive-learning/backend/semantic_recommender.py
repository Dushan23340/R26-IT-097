"""
semantic_recommender.py — Sentence-BERT resource matching + emotion +
mastery-tier modulation (proposal SO3 / 3.2 "Emotion-Informed
Recommendation Engine").

Embeds each candidate resource's descriptor and the target LO's
description, ranks resources by cosine similarity (semantic matching
"beyond traditional keyword-based search", per the literature review)
rather than a flat difficulty sort, then re-weights by the student's
current emotional state and how weak/average they scored on this LO:
  happy      -> more challenging materials (hard difficulty)
  normal     -> no bias
  confused   -> simpler notes  (easy difficulty, reading format)
  bored      -> challenging materials (hard difficulty)
  frustrated -> interactive exercises (easy difficulty, interactive format)
  angry      -> interactive exercises (easy difficulty, interactive format)

  weak       -> easier, more scaffolded resources
  average    -> moderate-difficulty resources

resolve_recommendation_strategy() re-weights the semantic-similarity
ranking below for lessons NOT covered by the real, teacher-validated
(lesson x emotion) lookup in validated_recommendations.py. For lessons
that ARE covered, recommend_resources() returns that literal, validated
video directly (skipping this rule-based approximation entirely - a
teacher-validated video outranks a re-ranked generic search-query guess)
BLENDED with lesson_resources.py's matching (lesson x Bloom level) short
note when one exists - the video answers "what to watch for this
emotional state", the note answers "what to read for this Bloom level";
neither replaces the other.
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer, util

from data import LO_DESCRIPTIONS
from lesson_resources import get_lesson_resources
from validated_recommendations import get_validated_video

_MODEL_NAME = "all-MiniLM-L6-v2"

EMOTION_BIAS = {
    "happy": {"preferred_difficulty": "hard", "preferred_type": None},
    "normal": {"preferred_difficulty": None, "preferred_type": None},
    "confused": {"preferred_difficulty": "easy", "preferred_type": "reading"},
    "bored": {"preferred_difficulty": "hard", "preferred_type": None},
    "frustrated": {"preferred_difficulty": "easy", "preferred_type": "interactive"},
    "angry": {"preferred_difficulty": "easy", "preferred_type": "interactive"},
}
MASTERY_BIAS = {
    "weak": {"preferred_difficulty": "easy"},
    "average": {"preferred_difficulty": "medium"},
}
BIAS_BOOST = 0.15


def resolve_recommendation_strategy(mastery_tier: str | None, emotion: str | None) -> list[tuple[str, str, str]]:
    """Returns a list of (resource_field, preferred_value, rationale) boost
    rules for the given mastery tier + emotion. A resource matching a rule's
    field/value gets +BIAS_BOOST and the rationale string appended."""
    rules: list[tuple[str, str, str]] = []

    mastery_bias = MASTERY_BIAS.get((mastery_tier or "").lower())
    if mastery_bias and mastery_bias.get("preferred_difficulty"):
        rules.append(("difficulty", mastery_bias["preferred_difficulty"], f"difficulty suited to a {mastery_tier} understanding of this LO"))

    emotion_bias = EMOTION_BIAS.get((emotion or "").lower())
    if emotion_bias:
        if emotion_bias.get("preferred_difficulty"):
            rules.append(("difficulty", emotion_bias["preferred_difficulty"], f"difficulty suited to a {emotion} state"))
        if emotion_bias.get("preferred_type"):
            rules.append(("type", emotion_bias["preferred_type"], f"format suited to a {emotion} state"))

    return rules


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(_MODEL_NAME)


def _resource_text(resource: dict) -> str:
    return f"{resource['title']} ({resource['type']}, {resource['difficulty']} difficulty)"


def recommend_resources(
    lesson_id: str, lo_name: str, emotion: str | None = None, mastery_tier: str | None = None, top_k: int = 3
) -> list[dict]:
    """Teacher-validated (lesson x emotion) video when one exists
    (validated_recommendations.py) - takes priority since it's a real
    validated answer, not an approximation - blended with
    lesson_resources.py's matching (lesson x Bloom level) short note when
    one exists, so a weak LO surfaces both "watch this" and "read this"
    rather than only one. If no validated video exists, falls back to
    semantic-similarity ranking of lesson_resources.py's resource pool,
    re-weighted by emotional state and mastery tier per
    resolve_recommendation_strategy()."""
    validated = get_validated_video(lesson_id, emotion)
    note = get_lesson_resources(lesson_id, lo_name)
    if validated:
        results = [{
            **validated,
            "match_score": 1.0,
            "rationale": ["teacher-validated resource for this lesson and emotional state"],
        }]
        for resource in note:
            results.append({
                **resource,
                "match_score": 1.0,
                "rationale": ["teacher-prepared short notes for this learning outcome"],
            })
        return results[:top_k]

    candidates = note
    if not candidates:
        return []

    model = _get_model()
    query = LO_DESCRIPTIONS.get(lo_name, lo_name)
    query_embedding = model.encode(query, convert_to_tensor=True)
    resource_embeddings = model.encode([_resource_text(r) for r in candidates], convert_to_tensor=True)
    similarities = util.cos_sim(query_embedding, resource_embeddings)[0].tolist()

    strategy = resolve_recommendation_strategy(mastery_tier, emotion)

    scored = []
    for resource, similarity in zip(candidates, similarities):
        score = similarity
        rationale = ["semantically matched to this learning outcome"]
        for field, preferred_value, reason in strategy:
            if resource.get(field) == preferred_value:
                score += BIAS_BOOST
                rationale.append(reason)
        scored.append({**resource, "match_score": round(float(score), 4), "rationale": rationale})

    scored.sort(key=lambda r: r["match_score"], reverse=True)
    return scored[:top_k]
