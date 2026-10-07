"""quiz_gen/templates_geometry.py — Templates for area-of-shapes. Same
conventions as templates.py: every answer comes from solvers_geometry.py,
templates only sample parameters and phrasing.
"""

from __future__ import annotations

import random
from fractions import Fraction

from .templates import Template, _ordinal  # noqa: F401 (reused helper)
from . import solvers_geometry as g


def _nonzero(rng: random.Random, lo: int, hi: int) -> int:
    while True:
        v = rng.randint(lo, hi)
        if v != 0:
            return v


# ───────────────────────────── area-of-shapes ─────────────────────────────


def _ar_parallelogram_formula_pool(rng):
    return {"question": "What is the formula for the area of a parallelogram?", "answer": "base x height", "accepted_answers": ["base × height", "base times height", "b x h"]}


def _ar_trapezium_formula_pool(rng):
    return {
        "question": "What is the formula for the area of a trapezium? Answer in the form '1/2 x (sum of parallel sides) x height'.",
        "answer": "1/2 x (sum of parallel sides) x height",
        "accepted_answers": ["½ x (sum of parallel sides) x height", "0.5 x (sum of parallel sides) x height"],
    }


def _ar_circle_formula_pool(rng):
    return {"question": "What is the formula for the area of a circle?", "answer": "πr^2", "accepted_answers": ["pi r^2", "pi*r^2", "πr²", "pir^2"]}


def _ar_perp_height_pool(rng):
    return {
        "question": "What is the perpendicular height corresponding to base AB of a parallelogram?",
        "answer": "The perpendicular distance between AB and the side parallel to it",
        "accepted_answers": ["perpendicular distance between ab and dc", "the perpendicular distance between the two parallel sides"],
    }


def _ar_trapezium_diagonal_tf_pool(rng):
    return {
        "question": "True or False: The area of a trapezium can be found by drawing a diagonal to split it into two triangles with the same height.",
        "answer": "True",
    }


def _ar_parallelogram_rearrange_pool(rng):
    return {
        "question": "Why does the area formula for a parallelogram use base x height (not half)? Answer in one short phrase.",
        "answer": "It can be rearranged into a rectangle of the same base and height",
        "accepted_answers": ["a parallelogram can be rearranged into a rectangle of the same base and height"],
    }


def _ar_parallelogram_area(rng):
    base = rng.randint(4, 20)
    height = rng.randint(3, 15)
    answer = g.parallelogram_area(base, height)
    q = f"Find the area of a parallelogram with base {base} cm and height {height} cm."
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} cm2", f"{answer}cm2"]}


def _ar_trapezium_area(rng):
    height = rng.randint(2, 10) * 2
    p1 = rng.randint(4, 20)
    p2 = rng.randint(4, 20)
    answer = g.trapezium_area(p1, p2, height)
    assert answer.denominator == 1
    q = f"Find the area of a trapezium with parallel sides {p1} cm and {p2} cm and height {height} cm."
    return {"question": q, "answer": str(answer.numerator), "accepted_answers": [f"{answer.numerator} cm2", f"{answer.numerator}cm2"]}


def _ar_circle_area(rng):
    k = rng.randint(1, 6)
    r = 7 * k
    answer = g.circle_area_22_7(r)
    q = f"Find the area of a circle of radius {r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} cm2", f"{answer}cm2"]}


def _ar_parallelogram_find_height(rng):
    height = rng.randint(3, 15)
    base = rng.randint(4, 20)
    area = g.parallelogram_area(base, height)
    q = f"The area of a parallelogram is {area} cm2 with base {base} cm. Find its height."
    return {"question": q, "answer": str(height), "accepted_answers": [f"{height} cm", f"{height}cm"]}


def _ar_trapezium_find_height(rng):
    height = rng.randint(2, 10) * 2
    p1 = rng.randint(4, 20)
    p2 = rng.randint(4, 20)
    area = g.trapezium_area(p1, p2, height)
    q = f"The area of a trapezium is {area.numerator} cm2 with parallel sides {p1} cm and {p2} cm. Find its height."
    return {"question": q, "answer": str(height), "accepted_answers": [f"{height} cm", f"{height}cm"]}


def _ar_circle_find_radius(rng):
    k = rng.randint(1, 6)
    r = 7 * k
    area = g.circle_area_22_7(r)
    q = f"A circle has area {area} cm2. Find its radius. (Use π = 22/7)"
    return {"question": q, "answer": str(r), "accepted_answers": [f"{r} cm", f"{r}cm"]}


def _ar_wall_trapezium(rng):
    height = rng.randint(2, 8) * 2
    p1 = rng.randint(4, 15)
    p2 = rng.randint(4, 15)
    answer = g.trapezium_area(p1, p2, height).numerator
    q = f"The side view of a wall is a trapezium with parallel sides {p1} m and {p2} m and height {height} m. Find its area."
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} m2", f"{answer}m2"]}


def _ar_shaded_square_circle(rng):
    k = rng.randint(1, 6)
    r = 7 * k
    answer = g.shaded_square_minus_inscribed_circle_22_7(r)
    q = f"Find the area of the shaded part of a figure where a circle of radius {r} cm is inscribed in a square of side {2*r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} cm2", f"{answer}cm2"]}


AREA_OF_SHAPES_TEMPLATES = [
    Template("ar_parallelogram_formula_pool", ["remember"], _ar_parallelogram_formula_pool, concept="ar-para-formula"),
    Template("ar_trapezium_formula_pool", ["remember"], _ar_trapezium_formula_pool, concept="ar-trap-formula"),
    Template("ar_circle_formula_pool", ["remember"], _ar_circle_formula_pool, concept="ar-circle-formula"),
    Template("ar_perp_height_pool", ["understand"], _ar_perp_height_pool, concept="ar-perp-height"),
    Template("ar_trapezium_diagonal_tf_pool", ["understand"], _ar_trapezium_diagonal_tf_pool),
    Template("ar_parallelogram_rearrange_pool", ["understand"], _ar_parallelogram_rearrange_pool),
    Template("ar_parallelogram_area", ["understand"], _ar_parallelogram_area),
    Template("ar_trapezium_area", ["understand"], _ar_trapezium_area),
    Template("ar_circle_area", ["understand"], _ar_circle_area),
    Template("ar_parallelogram_find_height", ["apply"], _ar_parallelogram_find_height),
    Template("ar_trapezium_find_height", ["apply"], _ar_trapezium_find_height),
    Template("ar_circle_find_radius", ["apply"], _ar_circle_find_radius),
    Template("ar_wall_trapezium", ["apply"], _ar_wall_trapezium),
    Template("ar_shaded_square_circle", ["apply"], _ar_shaded_square_circle),
]


TEMPLATES_BY_LESSON = {
    "area-of-shapes": AREA_OF_SHAPES_TEMPLATES,
}
