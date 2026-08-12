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

resolve_recommendation_strategy() is a placeholder for the
(bloom_level x mastery_tier x emotion) recommendation mapping the user is
preparing separately as an external document (level itself is already
handled upstream - by WHICH lo_name's resource pool a call draws from).
It's deliberately isolated to one small function returning a list of
boost rules, so replacing this rule-based approximation with a literal
72-entry lookup later is a one-function swap - no call site changes.
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer, util

from data import LO_DESCRIPTIONS
from lesson_resources import get_lesson_resources

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
    """Semantic-similarity ranking of resources for one LO within a specific
    lesson, re-weighted by emotional state and mastery tier per
    resolve_recommendation_strategy(). Resources are real, lesson-specific
    search-query URLs (see lesson_resources.py) - not generic Bloom-level
    placeholders reused across every lesson regardless of topic."""
    candidates = get_lesson_resources(lesson_id, lo_name)
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
