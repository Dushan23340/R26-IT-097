"""quiz_gen/solvers_geometry.py — Deterministic solvers for the geometry
lessons (pythagorean-theorem, area-of-shapes, circumference-of-a-circle,
angles-of-a-polygon). Same correctness role as solvers.py: every number a
generated question shows the student is computed here, never guessed by
a template or the model.
"""

from __future__ import annotations

from fractions import Fraction

# ───────────────────────────── pythagorean-theorem ─────────────────────────────

# (leg1, leg2, hypotenuse) primitive triples - scaled by a random factor at
# generation time so every triangle used is a REAL Pythagorean triple,
# guaranteeing whole-number answers exactly like the seed content.
PYTHAGOREAN_TRIPLES = [
    (3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25),
    (20, 21, 29), (9, 40, 41), (12, 35, 37), (11, 60, 61),
]


def scale_triple(triple: tuple[int, int, int], k: int) -> tuple[int, int, int]:
    a, b, c = triple
    return a * k, b * k, c * k


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


# ───────────────────────────── circumference-of-a-circle ─────────────────────────────

PI_22_7 = Fraction(22, 7)


def circumference_from_radius_22_7(radius_multiple_of_7: int) -> int:
    assert radius_multiple_of_7 % 7 == 0
    return 2 * 22 * (radius_multiple_of_7 // 7)


def circumference_from_diameter_22_7(diameter_multiple_of_7: int) -> int:
    assert diameter_multiple_of_7 % 7 == 0
    return 22 * (diameter_multiple_of_7 // 7)


def semicircle_perimeter_from_radius_22_7(radius_multiple_of_7: int) -> int:
    """arc + diameter, radius must be a multiple of 7."""
    r = radius_multiple_of_7
    assert r % 7 == 0
    arc = 22 * (r // 7)
    return arc + 2 * r


def semicircle_perimeter_from_diameter_22_7(diameter_multiple_of_14: int) -> int:
    d = diameter_multiple_of_14
    assert d % 14 == 0
    r = d // 2
    return semicircle_perimeter_from_radius_22_7(r)


def format_half(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)
    if value.denominator == 2:
        whole = value.numerator // 2
        return f"{whole}.5"
    raise ValueError(f"unexpected non-half fraction: {value}")


def rotations_distance_22_7(radius_multiple_of_7: int, rotations: int) -> int:
    return circumference_from_radius_22_7(radius_multiple_of_7) * rotations


# ───────────────────────────── angles-of-a-polygon ─────────────────────────────


def interior_angle_sum(n_sides: int) -> int:
    return 180 * (n_sides - 2)


def sides_from_interior_sum(total_degrees: int) -> int:
    assert total_degrees % 180 == 0
    return total_degrees // 180 + 2


def regular_exterior_angle(n_sides: int) -> Fraction:
    return Fraction(360, n_sides)


def regular_interior_angle(n_sides: int) -> Fraction:
    return 180 - regular_exterior_angle(n_sides)


def remaining_equal_angles(n_sides: int, known_angles: list[int]) -> Fraction:
    total = interior_angle_sum(n_sides)
    remaining_count = n_sides - len(known_angles)
    remaining_total = total - sum(known_angles)
    return Fraction(remaining_total, remaining_count)


def sides_from_interior_more_than_exterior(difference: int) -> int:
    """interior = exterior + difference, interior + exterior = 180
    -> exterior = (180 - difference) / 2, n = 360 / exterior."""
    exterior = Fraction(180 - difference, 2)
    n = Fraction(360) / exterior
    assert n.denominator == 1
    return int(n)
