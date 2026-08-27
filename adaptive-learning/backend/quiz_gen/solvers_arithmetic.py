"""quiz_gen/solvers_arithmetic.py — Deterministic solvers for percentages
and sets. Same correctness role as solvers.py/solvers_geometry.py.
"""

from __future__ import annotations

from fractions import Fraction

# ───────────────────────────── percentages ─────────────────────────────


def profit(cp: int, sp: int) -> int:
    return sp - cp


def loss(cp: int, sp: int) -> int:
    return cp - sp


def profit_percent(cp: int, sp: int) -> Fraction:
    return Fraction((sp - cp) * 100, cp)


def loss_percent(cp: int, sp: int) -> Fraction:
    return Fraction((cp - sp) * 100, cp)


def discount_amount(marked: int, pct: int) -> Fraction:
    return Fraction(marked * pct, 100)


def cp_from_sp_and_profit_pct(sp: int, pct: int) -> Fraction:
    return Fraction(sp * 100, 100 + pct)


def selling_price_after_pct(cp: int, pct: int, is_profit: bool) -> Fraction:
    change = Fraction(cp * pct, 100)
    return cp + change if is_profit else cp - change


def price_for_no_profit_no_loss(cp: int, w1: int, sp: int, w2: int, w3: int) -> Fraction:
    return Fraction(cp * w1 - sp * w2, w3)


def format_money(value: Fraction) -> str:
    if value.denominator == 1:
        return f"Rs {value.numerator}"
    return f"Rs {float(value):.2f}"


def format_plain(value: Fraction) -> str:
    return str(value.numerator) if value.denominator == 1 else f"{float(value):.2f}"


# ───────────────────────────── sets ─────────────────────────────


def format_set(values) -> str:
    ordered = sorted(values)
    if not ordered:
        return "{}"
    return "{" + ", ".join(str(v) for v in ordered) + "}"


def set_intersection(a: set, b: set) -> set:
    return a & b


def set_union(a: set, b: set) -> set:
    return a | b


def set_complement(universal: set, a: set) -> set:
    return universal - a


def all_subsets(values: list) -> list[frozenset]:
    from itertools import combinations
    result = []
    for size in range(len(values) + 1):
        for combo in combinations(values, size):
            result.append(frozenset(combo))
    return result


def format_subsets(values: list) -> str:
    subsets = all_subsets(values)
    subsets.sort(key=lambda s: (len(s), sorted(s)))
    parts = []
    for s in subsets:
        parts.append("{}" if not s else "{" + ", ".join(str(v) for v in sorted(s)) + "}")
    return ", ".join(parts)
