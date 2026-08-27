"""quiz_gen/solvers_geometry.py — Deterministic solvers for the geometry
lessons (area-of-shapes). Same correctness role as solvers.py: every number
a generated question shows the student is computed here, never guessed by
a template or the model.
"""

from __future__ import annotations

from fractions import Fraction

# ───────────────────────────── area-of-shapes ─────────────────────────────


def parallelogram_area(base: int, height: int) -> int:
    return base * height


def trapezium_area(p1: int, p2: int, height: int) -> Fraction:
    return Fraction(p1 + p2, 2) * height


def circle_area_22_7(radius_multiple_of_7: int) -> int:
    """radius must be a multiple of 7 so 22/7 * r^2 is always exact."""
    r = radius_multiple_of_7
    assert r % 7 == 0
    return 22 * 7 * (r // 7) ** 2


def parallelogram_height(area: int, base: int) -> Fraction:
    return Fraction(area, base)


def trapezium_height(area: int, p1: int, p2: int) -> Fraction:
    return Fraction(2 * area, p1 + p2)


def circle_radius_from_area_22_7(area: int) -> int:
    """area must be 22*7*k^2 for some integer k (see circle_area_22_7)."""
    k_squared = area // 154
    k = int(round(k_squared ** 0.5))
    assert 154 * k * k == area
    return 7 * k


def max_circles_cut(length: int, width: int, radius: int) -> int:
    diameter = 2 * radius
    return (length // diameter) * (width // diameter)


def shaded_square_minus_inscribed_circle_22_7(radius_multiple_of_7: int) -> int:
    r = radius_multiple_of_7
    side = 2 * r
    return side * side - circle_area_22_7(r)
