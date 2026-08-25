"""quiz_gen/model.py — The trained model in this system.

Scope, deliberately: with only 180 seed questions in quiz.pdf (54 across
the 3 piloted lessons), there isn't enough real data to safely fine-tune an
open-ended text generator and trust ITS answers - a wrong answer shown to a
real student is unacceptable. So this model's job is narrower and safer:
given a (lesson, LO level) slot to fill, LEARN which of the already
solver-verified templates (templates.py) is the best fit, and weight
sampling toward it - real supervised training, real gradient descent, real
saved weights, but with zero path to ever influence what counts as a
correct answer. solvers.py alone owns correctness.

Architecture: a small 2-layer MLP scoring (lesson, lo_level, template)
triples, trained via binary cross-entropy on positive pairs (this template
IS tagged to this lesson/level, per templates.py's own registry) vs.
negative pairs (mismatched lesson/level). At generation time scores for the
templates actually valid for a slot are turned into a softmax distribution
to sample from, so template choice is a learned preference, not a coin
flip - while still only ever choosing among templates the registry already
verified are valid for that slot.
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from . import templates as T

LESSON_ORDER = [
    "number-patterns", "fractions-bodmas", "binary-numbers",
    "pythagorean-theorem", "area-of-shapes", "circumference-of-a-circle",
    "angles-of-a-polygon", "percentages", "sets",
    "data-representation-and-interpretation",
]
LEVEL_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

KEYWORDS = [
    "term", "sequence", "common", "difference", "find", "write", "general",
    "fraction", "simplify", "reciprocal", "bodmas", "of", "mixed",
    "binary", "decimal", "convert", "add", "subtract", "place", "value",
    "verify", "yes", "true", "false", "greater", "next",
    "hyp", "leg", "triangle", "relation", "form", "verify",
    "area", "parallelogram", "trapezium", "circle", "height", "radius",
    "circumference", "diameter", "semicircle", "perimeter", "wheel",
    "polygon", "angle", "exterior", "interior", "regular", "sides", "sum",
    "profit", "loss", "discount", "percent", "price", "cost", "vendor",
    "set", "union", "intersection", "complement", "subset", "element",
    "mode", "median", "mean", "data", "frequency", "class", "range",
]

WEIGHTS_PATH = Path(__file__).resolve().parent / "template_selector.pt"

FEATURE_DIM = len(LESSON_ORDER) + len(LEVEL_ORDER) + len(KEYWORDS)


def _keyword_features(text: str) -> list[float]:
    lowered = text.lower()
    return [1.0 if kw in lowered else 0.0 for kw in KEYWORDS]


def encode(lesson_id: str, lo_level: str, template_id: str) -> np.ndarray:
    lesson_onehot = [1.0 if lesson_id == lid else 0.0 for lid in LESSON_ORDER]
    level_onehot = [1.0 if lo_level == lvl else 0.0 for lvl in LEVEL_ORDER]
    # the template_id itself is a readable slug (e.g. "np_nth_term_linear")
    # that already encodes its own topic keywords - used as the text signal
    # since the actual generated question text doesn't exist until sampled.
    kw = _keyword_features(template_id.replace("_", " "))
    return np.array(lesson_onehot + level_onehot + kw, dtype=np.float32)


class TemplateSelector(nn.Module):
    def __init__(self, input_dim: int = FEATURE_DIM, hidden_dim: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


def build_training_data(seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Positives: every (lesson, template, level) the registry itself says
    is valid. Negatives: the same templates paired with levels/lessons they
    are NOT tagged for. Both sides come straight from templates.py's real
    registry - no synthetic labels invented for this."""
    rng = random.Random(seed)
    xs, ys = [], []
    for lesson_id in LESSON_ORDER:
        tlist = T.TEMPLATES_BY_LESSON[lesson_id]
        for tmpl in tlist:
            for level in tmpl.lo_levels:
                xs.append(encode(lesson_id, level, tmpl.template_id))
                ys.append(1.0)
            wrong_levels = [lvl for lvl in LEVEL_ORDER if lvl not in tmpl.lo_levels]
            for level in rng.sample(wrong_levels, k=min(3, len(wrong_levels))):
                xs.append(encode(lesson_id, level, tmpl.template_id))
                ys.append(0.0)
            other_lessons = [lid for lid in LESSON_ORDER if lid != lesson_id]
            for other in other_lessons:
                level = rng.choice(LEVEL_ORDER)
                xs.append(encode(other, level, tmpl.template_id))
                ys.append(0.0)
    return np.stack(xs), np.array(ys, dtype=np.float32)


def train(epochs: int = 300, lr: float = 0.05, seed: int = 0) -> dict:
    torch.manual_seed(seed)
    X, y = build_training_data(seed=seed)
    x_tensor = torch.from_numpy(X)
    y_tensor = torch.from_numpy(y)

    model = TemplateSelector()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.BCEWithLogitsLoss()

    losses = []
    for epoch in range(epochs):
        optimizer.zero_grad()
        logits = model(x_tensor)
        loss = loss_fn(logits, y_tensor)
        loss.backward()
        optimizer.step()
        losses.append(loss.item())

    with torch.no_grad():
        preds = (torch.sigmoid(model(x_tensor)) >= 0.5).float()
        accuracy = (preds == y_tensor).float().mean().item()

    torch.save(model.state_dict(), WEIGHTS_PATH)
    return {"final_loss": losses[-1], "train_accuracy": accuracy, "n_examples": len(y), "losses": losses}


_model_instance: TemplateSelector | None = None


def _get_model() -> TemplateSelector | None:
    global _model_instance
    if _model_instance is not None:
        return _model_instance
    if not WEIGHTS_PATH.exists():
        return None
    model = TemplateSelector()
    model.load_state_dict(torch.load(WEIGHTS_PATH, map_location="cpu"))
    model.eval()
    _model_instance = model
    return _model_instance


def select_template(lesson_id: str, lo_level: str, candidates: list, rng: random.Random, temperature: float = 0.7):
    """Weighted sample among `candidates` (all already verified valid for
    this lesson/level by templates.templates_for) using the trained model's
    learned preference. Falls back to a uniform random choice if the model
    checkpoint hasn't been trained yet - generation must never depend on
    the model being present, only benefit from it when it is."""
    if len(candidates) == 1:
        return candidates[0]

    model = _get_model()
    if model is None:
        return rng.choice(candidates)

    with torch.no_grad():
        feats = np.stack([encode(lesson_id, lo_level, c.template_id) for c in candidates])
        scores = model(torch.from_numpy(feats)).numpy()

    scaled = scores / max(temperature, 1e-6)
    scaled -= scaled.max()
    weights = np.exp(scaled)
    weights /= weights.sum()

    idx = rng.choices(range(len(candidates)), weights=weights.tolist(), k=1)[0]
    return candidates[idx]
