"""quiz_gen/templates_geometry.py — Templates for pythagorean-theorem,
area-of-shapes, circumference-of-a-circle, angles-of-a-polygon. Same
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


# ───────────────────────────── pythagorean-theorem ─────────────────────────────

_PT_VERTEX_SETS = [("A", "B", "C"), ("P", "Q", "R"), ("X", "Y", "Z"), ("D", "E", "F")]


def _pt_hyp_name_pool(rng):
    return {"question": "What is the longest side of a right-angled triangle called?", "answer": "Hypotenuse"}


def _pt_pythagoras_pool(rng):
    return {"question": "Who introduced the relationship between the sides of a right-angled triangle?", "answer": "Pythagoras"}


def _pt_relation_form(rng):
    v1, v2, v3 = rng.choice(_PT_VERTEX_SETS)
    q = f"In right-angled triangle {v1}{v2}{v3} with the right angle at {v2}, what is the Pythagorean relation? Answer in the form X^2 = Y^2 + Z^2."
    answer = f"{v1}{v3}^2 = {v1}{v2}^2 + {v2}{v3}^2"
    return {"question": q, "answer": answer, "accepted_answers": [answer.lower().replace(" ", "")]}


def _pt_hyp_which_side_pool(rng):
    return {
        "question": "In a right-angled triangle, which side is the hypotenuse?",
        "answer": "The side opposite the right angle",
        "accepted_answers": ["the longest side", "opposite the right angle", "the side opposite the right angle (the longest side)"],
    }


def _pt_area_squares_fillblank_pool(rng):
    return {
        "question": "The Pythagorean relation states that the area of the square on the hypotenuse equals the sum of the areas of the squares on the ___. Fill in the blank.",
        "answer": "other two sides",
        "accepted_answers": ["two other sides", "the other two sides"],
    }


def _random_triple(rng, max_scale=6):
    triple = rng.choice(g.PYTHAGOREAN_TRIPLES)
    k = rng.randint(1, max_scale)
    return g.scale_triple(triple, k)


def _pt_find_hyp(rng):
    a, b, c = _random_triple(rng)
    if rng.random() < 0.5:
        a, b = b, a
    v1, v2, v3 = rng.choice(_PT_VERTEX_SETS)
    q = f"In right-angled triangle {v1}{v2}{v3}, {v1}{v2} = {a} cm and {v2}{v3} = {b} cm. Find {v1}{v3}."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} cm", f"{c}cm"]}


def _pt_find_leg(rng):
    a, b, c = _random_triple(rng)
    v1, v2, v3 = rng.choice(_PT_VERTEX_SETS)
    q = f"In right-angled triangle {v1}{v2}{v3}, {v1}{v3} = {c} cm and {v1}{v2} = {a} cm. Find {v2}{v3}."
    return {"question": q, "answer": str(b), "accepted_answers": [f"{b} cm", f"{b}cm"]}


def _pt_ladder_wall(rng):
    a, b, c = _random_triple(rng)
    q = f"A {c} m rod leans against a {a} m wall. Find the horizontal distance from the wall to the rod's base."
    return {"question": q, "answer": str(b), "accepted_answers": [f"{b}m", f"{b} m"]}


def _pt_rhombus_side(rng):
    a, b, c = _random_triple(rng)
    q = f"The diagonals of a rhombus are {2*a} cm and {2*b} cm. Find the length of one side."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} cm", f"{c}cm"]}


def _pt_chord_radius(rng):
    a, b, c = _random_triple(rng)
    q = f"In a circle, a chord of length {2*a} cm is {b} cm from the centre. Find the radius."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} cm", f"{c}cm"]}


def _pt_verify_hyp(rng):
    a, b, c = _random_triple(rng)
    make_true = rng.random() < 0.5
    shown = c if make_true else c + rng.choice([-2, -1, 1, 2])
    answer = "Yes" if make_true else "No"
    q = f"In a right triangle with sides {a} cm and {b} cm, is the hypotenuse {shown} cm? Answer Yes or No."
    return {"question": q, "answer": answer}


def _pt_verify_right_triangle(rng):
    a, b, c = _random_triple(rng)
    make_true = rng.random() < 0.5
    if make_true:
        sides = (a, b, c)
    else:
        sides = (a, b, c + rng.choice([-2, -1, 1, 2]))
    answer = "Yes" if make_true else "No"
    q = f"Is a triangle with sides {sides[0]} cm, {sides[1]} cm, and {sides[2]} cm right-angled? Answer Yes or No."
    return {"question": q, "answer": answer}


def _pt_verify_square_diagonal(rng):
    k = rng.randint(2, 12)
    d = 2 * k
    area = 2 * k * k
    make_true = rng.random() < 0.5
    shown = area if make_true else area + rng.choice([-4, -2, 2, 4])
    answer = "Yes" if make_true else "No"
    q = f"A square has diagonal {d} cm. Is its area {shown} cm2? Answer Yes or No."
    return {"question": q, "answer": answer}


def _pt_two_cities(rng):
    a, b, c = _random_triple(rng)
    q = f"City Q is {a} km east of city P, and city R is {b} km north of Q. Find the distance between P and R."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} km", f"{c}km"]}


def _pt_flagpole_cable(rng):
    a, b, c = _random_triple(rng)
    q = f"A {a} m flagpole has a cable from the top to a point {b} m from the foot. Find the cable length."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} m", f"{c}m"]}


def _pt_cartesian_distance(rng):
    a, b, c = _random_triple(rng)
    x1, y1 = rng.randint(-5, 5), rng.randint(-5, 5)
    x2, y2 = x1 + a, y1 + b
    q = f"Find the shortest distance between points A({x1}, {y1}) and B({x2}, {y2}) on a Cartesian plane."
    return {"question": q, "answer": str(c), "accepted_answers": [f"{c} units"]}


PYTHAGOREAN_THEOREM_TEMPLATES = [
    Template("pt_hyp_name_pool", ["remember"], _pt_hyp_name_pool),
    Template("pt_pythagoras_pool", ["remember"], _pt_pythagoras_pool),
    Template("pt_relation_form", ["remember", "understand"], _pt_relation_form),
    Template("pt_hyp_which_side_pool", ["understand"], _pt_hyp_which_side_pool),
    Template("pt_area_squares_fillblank_pool", ["understand"], _pt_area_squares_fillblank_pool),
    Template("pt_find_hyp", ["apply"], _pt_find_hyp),
    Template("pt_find_leg", ["apply"], _pt_find_leg),
    Template("pt_flagpole_cable", ["apply", "create"], _pt_flagpole_cable),
    Template("pt_ladder_wall", ["analyze"], _pt_ladder_wall),
    Template("pt_rhombus_side", ["analyze"], _pt_rhombus_side),
    Template("pt_chord_radius", ["analyze"], _pt_chord_radius),
    Template("pt_verify_hyp", ["evaluate"], _pt_verify_hyp),
    Template("pt_verify_right_triangle", ["evaluate"], _pt_verify_right_triangle),
    Template("pt_verify_square_diagonal", ["evaluate"], _pt_verify_square_diagonal),
    Template("pt_two_cities", ["create"], _pt_two_cities),
    Template("pt_cartesian_distance", ["create"], _pt_cartesian_distance),
]


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


def _ar_verify_parallelogram(rng):
    base = rng.randint(4, 15)
    height = rng.randint(3, 12)
    actual = g.parallelogram_area(base, height)
    make_true = rng.random() < 0.5
    shown = actual if make_true else actual + rng.choice([-4, -2, 2, 4])
    answer = "Yes" if make_true else "No"
    q = f"Is the area of a parallelogram with base {base} cm and height {height} cm equal to {shown} cm2? Answer Yes or No."
    return {"question": q, "answer": answer}


def _ar_verify_trapezium(rng):
    height = rng.randint(2, 8) * 2
    p1 = rng.randint(4, 15)
    p2 = rng.randint(4, 15)
    actual = g.trapezium_area(p1, p2, height).numerator
    make_true = rng.random() < 0.5
    shown = actual if make_true else actual + rng.choice([-4, -2, 2, 4])
    answer = "Yes" if make_true else "No"
    q = f"A trapezium has parallel sides {p1} cm and {p2} cm with height {height} cm. Is its area {shown} cm2? Answer Yes or No."
    return {"question": q, "answer": answer}


def _ar_verify_circle_greater(rng):
    k = rng.randint(1, 6)
    r = 7 * k
    actual = g.circle_area_22_7(r)
    threshold = actual + rng.choice([-30, -15, 15, 30])
    threshold = max(threshold, 1)
    answer = "Yes" if actual > threshold else "No"
    q = f"A circle of radius {r} cm has area greater than {threshold} cm2. Is this true? Answer Yes or No. (Use π = 22/7)"
    return {"question": q, "answer": answer}


def _ar_wall_trapezium(rng):
    height = rng.randint(2, 8) * 2
    p1 = rng.randint(4, 15)
    p2 = rng.randint(4, 15)
    answer = g.trapezium_area(p1, p2, height).numerator
    q = f"The side view of a wall is a trapezium with parallel sides {p1} m and {p2} m and height {height} m. Find its area."
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} m2", f"{answer}m2"]}


def _ar_max_circles_cut(rng):
    k = rng.randint(1, 4)
    r = 7 * k
    diameter = 2 * r
    length = diameter * rng.randint(2, 6)
    width = diameter * rng.randint(1, 3)
    answer = g.max_circles_cut(length, width, r)
    q = f"A rectangular lamina of length {length} cm and width {width} cm is used to cut circular laminas of radius {r} cm. Find the maximum number of circles that can be cut."
    return {"question": q, "answer": str(answer)}


def _ar_shaded_square_circle(rng):
    k = rng.randint(1, 6)
    r = 7 * k
    answer = g.shaded_square_minus_inscribed_circle_22_7(r)
    q = f"Find the area of the shaded part of a figure where a circle of radius {r} cm is inscribed in a square of side {2*r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer} cm2", f"{answer}cm2"]}


AREA_OF_SHAPES_TEMPLATES = [
    Template("ar_parallelogram_formula_pool", ["remember"], _ar_parallelogram_formula_pool),
    Template("ar_trapezium_formula_pool", ["remember"], _ar_trapezium_formula_pool),
    Template("ar_circle_formula_pool", ["remember"], _ar_circle_formula_pool),
    Template("ar_perp_height_pool", ["understand"], _ar_perp_height_pool),
    Template("ar_trapezium_diagonal_tf_pool", ["understand"], _ar_trapezium_diagonal_tf_pool),
    Template("ar_parallelogram_rearrange_pool", ["understand"], _ar_parallelogram_rearrange_pool),
    Template("ar_parallelogram_area", ["apply"], _ar_parallelogram_area),
    Template("ar_trapezium_area", ["apply"], _ar_trapezium_area),
    Template("ar_circle_area", ["apply"], _ar_circle_area),
    Template("ar_parallelogram_find_height", ["analyze"], _ar_parallelogram_find_height),
    Template("ar_trapezium_find_height", ["analyze"], _ar_trapezium_find_height),
    Template("ar_circle_find_radius", ["analyze"], _ar_circle_find_radius),
    Template("ar_verify_parallelogram", ["evaluate"], _ar_verify_parallelogram),
    Template("ar_verify_trapezium", ["evaluate"], _ar_verify_trapezium),
    Template("ar_verify_circle_greater", ["evaluate"], _ar_verify_circle_greater),
    Template("ar_wall_trapezium", ["create"], _ar_wall_trapezium),
    Template("ar_max_circles_cut", ["create"], _ar_max_circles_cut),
    Template("ar_shaded_square_circle", ["create"], _ar_shaded_square_circle),
]


# ───────────────────────────── circumference-of-a-circle ─────────────────────────────


def _cc_diameter_formula_pool(rng):
    return {"question": "What is the formula for the circumference of a circle in terms of its diameter?", "answer": "c = πd", "accepted_answers": ["πd", "c=pi*d", "circumference = pi x diameter", "c=πd"]}


def _cc_radius_formula_pool(rng):
    return {"question": "What is the formula for the circumference of a circle in terms of its radius?", "answer": "c = 2πr", "accepted_answers": ["2πr", "c=2*pi*r", "circumference = 2 x pi x radius", "c=2πr"]}


def _cc_pi_value_pool(rng):
    return {"question": "What approximate value of π is used in this textbook?", "answer": "22/7", "answer_type": "fraction"}


def _cc_definition_pool(rng):
    return {"question": "What is the circumference of a circle?", "answer": "The total length of the boundary of the circle", "accepted_answers": ["the perimeter of the circle", "total length of the boundary (perimeter) of the circle"]}


def _cc_semicircle_definition_pool(rng):
    return {"question": "What is a semicircle?", "answer": "Half of a circle obtained by cutting along a diameter", "accepted_answers": ["half a circle cut along the diameter", "half of a circle"]}


def _cc_semicircle_arc_pool(rng):
    return {"question": "What is the arc length of a semicircle of radius r?", "answer": "πr", "accepted_answers": ["pi*r", "pi r", "πr"]}


def _cc_circumference_from_radius(rng):
    k = rng.randint(1, 10)
    r = 7 * k
    answer = g.circumference_from_radius_22_7(r)
    q = f"Find the circumference of a circle of radius {r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_circumference_from_diameter(rng):
    k = rng.randint(1, 10)
    d = 7 * k
    answer = g.circumference_from_diameter_22_7(d)
    q = f"Find the circumference of a circle of diameter {d} m. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}m", f"{answer} m"]}


def _cc_semicircle_perimeter_radius(rng):
    k = rng.randint(1, 10)
    r = 7 * k
    answer = g.semicircle_perimeter_from_radius_22_7(r)
    q = f"Find the perimeter of a semicircle of radius {r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_wheel_rotation(rng):
    k = rng.randint(1, 8)
    r = 7 * k
    answer = g.circumference_from_radius_22_7(r)
    q = f"A wheel of radius {r} cm moves along a road. Find the distance it moves in one full rotation, in cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_wire_to_radius(rng):
    k = rng.randint(1, 10)
    circumference = 22 * k
    r = Fraction(7, 2) * k / 1
    r_frac = Fraction(circumference) * Fraction(7, 44)
    answer = g.format_half(r_frac)
    q = f"A wire of length {circumference} cm is bent to form a circle. Find its radius. (Use π = 22/7)"
    return {"question": q, "answer": answer, "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_semicircle_perimeter_diameter(rng):
    k = rng.randint(1, 8)
    d = 14 * k
    answer = g.semicircle_perimeter_from_diameter_22_7(d)
    q = f"Find the perimeter of a semicircle with diameter {d} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_verify_semicircle_perimeter(rng):
    k = rng.randint(1, 10)
    r = 7 * k
    actual = g.semicircle_perimeter_from_radius_22_7(r)
    make_true = rng.random() < 0.5
    shown = actual if make_true else actual + rng.choice([-4, -2, 2, 4])
    answer = "Yes" if make_true else "No"
    q = f"Is the perimeter of a semicircle of radius {r} cm equal to {shown} cm? Answer Yes or No. (Use π = 22/7)"
    return {"question": q, "answer": answer}


def _cc_verify_cyclist(rng):
    k = rng.randint(1, 8)
    r = 7 * k
    rotations = rng.randint(20, 80)
    total_cm = g.rotations_distance_22_7(r, rotations)
    total_m = Fraction(total_cm, 100)
    threshold_m = int(total_m) + rng.choice([-15, -5, 5, 15])
    threshold_m = max(threshold_m, 1)
    answer = "Yes" if total_m > threshold_m else "No"
    q = f"A cyclist's wheel of radius {r} cm completes {rotations} rotations. Does it travel more than {threshold_m} m? Answer Yes or No. (Use π = 22/7)"
    return {"question": q, "answer": answer}


def _cc_verify_plot_radius(rng):
    k = rng.randint(1, 12)
    r = 7 * k
    circumference = g.circumference_from_radius_22_7(r)
    make_exact = rng.random() < 0.5
    if make_exact:
        threshold = r
        answer = "No"
    else:
        threshold = r - rng.randint(1, 5)
        answer = "Yes"
    q = f"The circumference of a circular plot is {circumference} m. Is its radius greater than {threshold} m? Answer Yes or No. (Use π = 22/7)"
    return {"question": q, "answer": answer}


def _cc_playground_perimeter(rng):
    # length is the straight side of the rectangle - geometrically
    # independent of the semicircle radius, so it doesn't need to be tied
    # to r for the formula (2*length + 2*arc) to stay exact.
    k = rng.randint(1, 6)
    r = 7 * k
    length = rng.randint(15, 60)
    arc = g.semicircle_perimeter_from_radius_22_7(r) - 2 * r  # arc only, one semicircle
    answer = 2 * length + 2 * arc
    q = f"A playground consists of a rectangle of length {length} m and width {2*r} m with two semicircular ends. Find its perimeter. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}m", f"{answer} m"]}


def _cc_frame_semicircles(rng):
    k = rng.randint(1, 8)
    r = 7 * k
    count = rng.choice([2, 3, 4])
    arc = g.circumference_from_radius_22_7(r) // 2
    answer = arc * count
    q = f"Find the total length of wire needed to make a frame consisting of {count} semicircular parts of radius {r} cm. (Use π = 22/7)"
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}cm", f"{answer} cm"]}


def _cc_paperclip_semicircle(rng):
    k = rng.randint(1, 8)
    d = 14 * k
    r = d // 2
    arc = g.circumference_from_radius_22_7(r) // 2
    q = f"A paper clip has semicircular parts. If the diameter of one semicircle is {d} cm, find the length of wire needed for that one semicircle. (Use π = 22/7)"
    return {"question": q, "answer": str(arc), "accepted_answers": [f"{arc}cm", f"{arc} cm"]}


CIRCUMFERENCE_OF_A_CIRCLE_TEMPLATES = [
    Template("cc_diameter_formula_pool", ["remember"], _cc_diameter_formula_pool),
    Template("cc_radius_formula_pool", ["remember"], _cc_radius_formula_pool),
    Template("cc_pi_value_pool", ["remember"], _cc_pi_value_pool),
    Template("cc_definition_pool", ["understand"], _cc_definition_pool),
    Template("cc_semicircle_definition_pool", ["understand"], _cc_semicircle_definition_pool),
    Template("cc_semicircle_arc_pool", ["understand"], _cc_semicircle_arc_pool),
    Template("cc_circumference_from_radius", ["apply"], _cc_circumference_from_radius),
    Template("cc_circumference_from_diameter", ["apply"], _cc_circumference_from_diameter),
    Template("cc_semicircle_perimeter_radius", ["apply"], _cc_semicircle_perimeter_radius),
    Template("cc_wheel_rotation", ["analyze"], _cc_wheel_rotation),
    Template("cc_wire_to_radius", ["analyze"], _cc_wire_to_radius),
    Template("cc_semicircle_perimeter_diameter", ["analyze"], _cc_semicircle_perimeter_diameter),
    Template("cc_verify_semicircle_perimeter", ["evaluate"], _cc_verify_semicircle_perimeter),
    Template("cc_verify_cyclist", ["evaluate"], _cc_verify_cyclist),
    Template("cc_verify_plot_radius", ["evaluate"], _cc_verify_plot_radius),
    Template("cc_playground_perimeter", ["create"], _cc_playground_perimeter),
    Template("cc_frame_semicircles", ["create"], _cc_frame_semicircles),
    Template("cc_paperclip_semicircle", ["create"], _cc_paperclip_semicircle),
]


# ───────────────────────────── angles-of-a-polygon ─────────────────────────────


def _ap_polygon_definition_pool(rng):
    return {"question": "What is a polygon?", "answer": "A plane figure bounded by three or more straight line segments", "accepted_answers": ["a closed plane figure with straight sides", "a shape with 3 or more straight sides"]}


def _ap_triangle_sum_pool(rng):
    return {"question": "What is the sum of the interior angles of a triangle?", "answer": "180", "accepted_answers": ["180°", "180 degrees"]}


def _ap_quadrilateral_sum_pool(rng):
    return {"question": "What is the sum of the interior angles of a quadrilateral?", "answer": "360", "accepted_answers": ["360°", "360 degrees"]}


def _ap_regular_polygon_pool(rng):
    return {"question": "What is a regular polygon?", "answer": "A polygon with all sides equal and all interior angles equal", "accepted_answers": ["a polygon with equal sides and equal angles"]}


def _ap_interior_formula_pool(rng):
    return {"question": "What is the formula for the sum of interior angles of a polygon with n sides?", "answer": "180(n-2)", "accepted_answers": ["180(n - 2)", "(2n-4) right angles", "180 x (n-2)", "180 x (n - 2)"]}


def _ap_exterior_angle_def_pool(rng):
    return {"question": "What is an exterior angle of a polygon?", "answer": "An angle formed by producing one side of the polygon", "accepted_answers": ["angle formed by extending one side"]}


_POLYGON_NAMES = {5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon", 12: "dodecagon"}


def _ap_interior_sum_named(rng):
    n = rng.choice(list(_POLYGON_NAMES.keys()))
    name = _POLYGON_NAMES[n]
    answer = g.interior_angle_sum(n)
    q = f"Find the sum of the interior angles of a {name}{' (' + str(n) + ' sides)' if n in (11, 12) else ''}."
    return {"question": q, "answer": str(answer), "accepted_answers": [f"{answer}°"]}


def _ap_remaining_equal_angles(rng):
    # Bounded retry (not unbounded recursion/while-loop) - divisibility by
    # 2 or 3 isn't guaranteed on the first draw, but always succeeds within
    # a handful of tries, and a capped attempt count keeps this safe even
    # in a freak run of bad luck.
    for _ in range(30):
        n = rng.randint(6, 10)
        known_count = n - rng.randint(2, 3)
        known = [rng.randint(70, 110) for _ in range(known_count)]
        total = g.interior_angle_sum(n)
        answer = g.remaining_equal_angles(n, known)
        if answer.denominator == 1 and answer > 0:
            angles_str = ", ".join(f"{a}°" for a in known[:-1]) + f" and {known[-1]}°"
            remaining_count = n - known_count
            q = (
                f"{known_count} angles of a {_POLYGON_NAMES.get(n, str(n) + '-sided polygon')} are {angles_str}. "
                f"The remaining {remaining_count} are equal. Find each equal angle."
            )
            return {"question": q, "answer": str(answer.numerator), "accepted_answers": [f"{answer.numerator}°"]}
    # Deterministic fallback: 3 known 90° angles in a hexagon, 3 equal remain
    n, known = 6, [90, 90, 90]
    answer = g.remaining_equal_angles(n, known)
    q = f"3 angles of a hexagon are 90°, 90° and 90°. The remaining 3 are equal. Find each equal angle."
    return {"question": q, "answer": str(answer.numerator), "accepted_answers": [f"{answer.numerator}°"]}


def _ap_sides_from_sum(rng):
    n = rng.randint(5, 24)
    total = g.interior_angle_sum(n)
    answer = g.sides_from_interior_sum(total)
    q = f"If the sum of interior angles of a polygon is {total}°, find the number of sides."
    return {"question": q, "answer": str(answer)}


def _ap_exterior_sum_verify_pool(rng):
    return {"question": "Verify: the sum of exterior angles of any polygon is 360°. Answer True or False.", "answer": "True"}


def _ap_heptagon_name_verify(rng):
    correct_names = {7: "heptagon", 5: "pentagon", 6: "hexagon", 8: "octagon", 9: "nonagon", 10: "decagon"}
    n = rng.choice(list(correct_names.keys()))
    make_true = rng.random() < 0.5
    if make_true:
        shown_name = correct_names[n]
        answer = "Yes"
    else:
        wrong_pool = [v for k, v in correct_names.items() if k != n]
        shown_name = rng.choice(wrong_pool)
        answer = "No"
    q = f"Is a polygon with {n} sides called a {shown_name}? Answer Yes or No."
    return {"question": q, "answer": answer}


def _ap_decagon_angle_count_verify(rng):
    shapes = {5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon"}
    n = rng.choice(list(shapes.keys()))
    name = shapes[n]
    make_true = rng.random() < 0.5
    claimed = n if make_true else n + rng.choice([-1, 1])
    answer = "Yes" if make_true else "No"
    q = f"Does a {name} have {claimed} interior angles? Answer Yes or No."
    return {"question": q, "answer": answer}


def _ap_regular_exterior_then_interior(rng):
    n = rng.choice([5, 6, 8, 9, 10, 12, 15])
    ext = g.regular_exterior_angle(n)
    interior = g.regular_interior_angle(n)
    assert ext.denominator == 1 and interior.denominator == 1
    name = _POLYGON_NAMES.get(n, f"{n}-sided regular polygon")
    q = f"Find the magnitude of an exterior angle of a regular {name}, and hence find its interior angle. Give the interior angle."
    return {"question": q, "answer": str(interior.numerator), "accepted_answers": [f"{interior.numerator}°"]}


def _ap_quadrilateral_exterior_ratio(rng):
    for _ in range(30):
        ratios = [rng.randint(1, 6) for _ in range(4)]
        total_ratio = sum(ratios)
        unit = Fraction(360, total_ratio)
        if unit.denominator == 1:
            angles = [unit * r for r in ratios]
            largest = max(angles)
            ratio_str = ":".join(str(r) for r in ratios)
            q = f"The exterior angles of a quadrilateral are in the ratio {ratio_str}. Find the largest exterior angle."
            return {"question": q, "answer": str(largest.numerator), "accepted_answers": [f"{largest.numerator}°"]}
    # Deterministic fallback: ratio 2:2:3:3 (sum=10, unit=36) - matches the seed's own example
    ratios = [2, 2, 3, 3]
    unit = Fraction(360, sum(ratios))
    largest = max(unit * r for r in ratios)
    q = "The exterior angles of a quadrilateral are in the ratio 2:2:3:3. Find the largest exterior angle."
    return {"question": q, "answer": str(largest.numerator), "accepted_answers": [f"{largest.numerator}°"]}


_VALID_EXTERIOR_DIVISORS = [e for e in range(3, 90) if 360 % e == 0]


def _ap_interior_more_than_exterior(rng):
    # difference = 180 - 2*exterior only gives a whole number of sides
    # when `exterior` itself divides 360 - derived directly from that
    # constraint rather than a guessed list (an earlier hardcoded list
    # included 20/30/40, none of which actually solve to a whole n).
    exterior = rng.choice(_VALID_EXTERIOR_DIVISORS)
    difference = 180 - 2 * exterior
    answer = g.sides_from_interior_more_than_exterior(difference)
    q = f"An interior angle of a regular polygon is {difference}° more than its exterior angle. Find the number of sides."
    return {"question": q, "answer": str(answer)}


ANGLES_OF_A_POLYGON_TEMPLATES = [
    Template("ap_polygon_definition_pool", ["remember"], _ap_polygon_definition_pool),
    Template("ap_triangle_sum_pool", ["remember"], _ap_triangle_sum_pool),
    Template("ap_quadrilateral_sum_pool", ["remember"], _ap_quadrilateral_sum_pool),
    Template("ap_regular_polygon_pool", ["understand"], _ap_regular_polygon_pool),
    Template("ap_interior_formula_pool", ["understand"], _ap_interior_formula_pool),
    Template("ap_exterior_angle_def_pool", ["understand"], _ap_exterior_angle_def_pool),
    Template("ap_interior_sum_named", ["apply"], _ap_interior_sum_named),
    Template("ap_remaining_equal_angles", ["analyze"], _ap_remaining_equal_angles),
    Template("ap_sides_from_sum", ["analyze", "apply"], _ap_sides_from_sum),
    Template("ap_exterior_sum_verify_pool", ["evaluate"], _ap_exterior_sum_verify_pool),
    Template("ap_heptagon_name_verify", ["evaluate"], _ap_heptagon_name_verify),
    Template("ap_decagon_angle_count_verify", ["evaluate"], _ap_decagon_angle_count_verify),
    Template("ap_regular_exterior_then_interior", ["create"], _ap_regular_exterior_then_interior),
    Template("ap_quadrilateral_exterior_ratio", ["create"], _ap_quadrilateral_exterior_ratio),
    Template("ap_interior_more_than_exterior", ["create"], _ap_interior_more_than_exterior),
]


TEMPLATES_BY_LESSON = {
    "pythagorean-theorem": PYTHAGOREAN_THEOREM_TEMPLATES,
    "area-of-shapes": AREA_OF_SHAPES_TEMPLATES,
    "circumference-of-a-circle": CIRCUMFERENCE_OF_A_CIRCLE_TEMPLATES,
    "angles-of-a-polygon": ANGLES_OF_A_POLYGON_TEMPLATES,
}
