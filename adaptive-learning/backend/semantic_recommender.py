"""
semantic_recommender.py — Sentence-BERT resource matching + emotion
modulation (proposal SO3 / 3.2 "Emotion-Informed Recommendation Engine").

Embeds each candidate resource's descriptor and the target LO's
description, ranks resources by cosine similarity (semantic matching
"beyond traditional keyword-based search", per the literature review)
rather than a flat difficulty sort, then re-weights by the student's
current emotional state:
  confused   -> simpler notes  (easy difficulty, reading format)
  frustrated -> interactive exercises (easy difficulty, interactive format)
  bored      -> challenging materials (hard difficulty)
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer, util

from data import LO_DESCRIPTIONS
from lesson_resources import get_lesson_resources

_MODEL_NAME = "all-MiniLM-L6-v2"

EMOTION_BIAS = {
    "confused": {"preferred_difficulty": "easy", "preferred_type": "reading"},
    "frustrated": {"preferred_difficulty": "easy", "preferred_type": "interactive"},
    "bored": {"preferred_difficulty": "hard", "preferred_type": None},
}
BIAS_BOOST = 0.15


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(_MODEL_NAME)


def _resource_text(resource: dict) -> str:
    return f"{resource['title']} ({resource['type']}, {resource['difficulty']} difficulty)"


def recommend_resources(lesson_id: str, lo_name: str, emotion: str | None = None, top_k: int = 3) -> list[dict]:
    """Semantic-similarity ranking of resources for one LO within a specific
    lesson, re-weighted by emotional state per the proposal's modulation
    rules. Resources are real, lesson-specific search-query URLs (see
    lesson_resources.py) - not generic Bloom-level placeholders reused
    across every lesson regardless of topic."""
    candidates = get_lesson_resources(lesson_id, lo_name)
    if not candidates:
        return []

    model = _get_model()
    query = LO_DESCRIPTIONS.get(lo_name, lo_name)
    query_embedding = model.encode(query, convert_to_tensor=True)
    resource_embeddings = model.encode([_resource_text(r) for r in candidates], convert_to_tensor=True)
    similarities = util.cos_sim(query_embedding, resource_embeddings)[0].tolist()

    bias = EMOTION_BIAS.get((emotion or "").lower())

    scored = []
    for resource, similarity in zip(candidates, similarities):
        score = similarity
        rationale = ["semantically matched to this learning outcome"]
        if bias:
            if resource["difficulty"] == bias["preferred_difficulty"]:
                score += BIAS_BOOST
                rationale.append(f"difficulty suited to a {emotion} state")
            if bias["preferred_type"] and resource["type"] == bias["preferred_type"]:
                score += BIAS_BOOST
                rationale.append(f"format suited to a {emotion} state")
        scored.append({**resource, "match_score": round(float(score), 4), "rationale": rationale})

    scored.sort(key=lambda r: r["match_score"], reverse=True)
    return scored[:top_k]
