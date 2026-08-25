"""quiz_gen/solvers.py — Pure, deterministic answer functions for generated
quiz questions. This module is the correctness boundary of the whole
generation system: templates.py samples random parameters and phrasing,
but every numeric/symbolic ANSWER shown to a student is computed here,
never by the trained model in model.py. The model only ever chooses which
already-verified template to use for a slot - it has no path to influence
what counts as correct.

Grouped by lesson (number patterns, fractions/BODMAS, binary numbers) to
match the three pilot lessons wired up in generator.py.
"""

from __future__ import annotations

from fractions import Fraction

# ───────────────────────────── number-patterns ─────────────────────────────


def nth_term_linear(a: int, b: int, n: int) -> int:
    """Tn = a*n + b"""
    return a * n + b


def find_term_number(a: int, b: int, target: int) -> int:
    """Tn = a*n - b = target -> n. Caller guarantees this divides evenly."""
    assert (target + b) % a == 0
    return (target + b) // a


def nth_term_descending(c: int, a: int, n: int) -> int:
    """Tn = c - a*n"""
    return c - a * n


def is_term_of_descending(c: int, a: int, v: int) -> tuple[bool, int | None]:
    """Tn = c - a*n; is v a term? Returns (is_term, term_number_or_None)."""
    if (c - v) % a == 0:
        n = (c - v) // a
        if n >= 1:
            return True, n
    return False, None


def is_term_of_ascending(a: int, b: int, v: int) -> tuple[bool, int | None]:
    """Tn = a*n - b; is v a term? Returns (is_term, term_number_or_None)."""
    if (v + b) % a == 0:
        n = (v + b) // a
        if n >= 1:
            return True, n
    return False, None


def first_n_terms(a: int, d: int, count: int) -> list[int]:
    return [a + i * d for i in range(count)]


def general_term_from_ad(a: int, d: int) -> tuple[int, int]:
    """Sequence a, a+d, a+2d, ... -> Tn = d*n + b where b = a - d."""
    return d, a - d


def negative_threshold(c: int, a: int) -> int:
    """Tn = c - a*n; returns the last term index n where Tn >= 0."""
    return c // a


# ───────────────────────────── fractions-bodmas ─────────────────────────────


def reduced_fraction(num: int, den: int) -> Fraction:
    return Fraction(num, den)


def reciprocal(a: int, b: int) -> Fraction:
    return Fraction(b, a)


def mixed_to_improper(whole: int, num: int, den: int) -> Fraction:
    return whole + Fraction(num, den)


def multiply_fractions(a: int, b: int, c: int, d: int) -> Fraction:
    return Fraction(a, b) * Fraction(c, d)


def add_fractions(fractions_list: list[tuple[int, int]]) -> Fraction:
    total = Fraction(0)
    for num, den in fractions_list:
        total += Fraction(num, den)
    return total


def divide_fraction_by_whole(a: int, b: int, n: int) -> Fraction:
    return Fraction(a, b) / n


def divide_mixed(w1: int, n1: int, d1: int, w2: int, n2: int, d2: int) -> Fraction:
    return (w1 + Fraction(n1, d1)) / (w2 + Fraction(n2, d2))


def bodmas_fraction_combo(a: int, b: int, c: int, d: int, e: int, f: int, g: int, h: int) -> Fraction:
    """a/b / c/d of e/f x g/h — division, 'of' (multiply), and 'x' (multiply)
    share equal BODMAS precedence, evaluated strictly left to right."""
    result = Fraction(a, b) / Fraction(c, d)
    result = result * Fraction(e, f)
    result = result * Fraction(g, h)
    return result


def savings_fraction(a: int, b: int, c: int, d: int) -> Fraction:
    return 1 - (Fraction(a, b) + Fraction(c, d))


def donation_fraction(a: int, b: int, e: int, f: int) -> Fraction:
    return Fraction(a, b) * Fraction(e, f)


def fraction_to_answer_string(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)
    whole = abs(value.numerator) // value.denominator
    remainder = abs(value.numerator) % value.denominator
    sign = "-" if value.numerator < 0 else ""
    if whole == 0:
        return f"{sign}{remainder}/{value.denominator}"
    return f"{sign}{whole} {remainder}/{value.denominator}"


# ───────────────────────────── binary-numbers ─────────────────────────────


def dec_to_bin(n: int) -> str:
    return bin(n)[2:]


def bin_to_dec(b: str) -> int:
    return int(b, 2)


def bin_add(*binaries: str) -> str:
    total = sum(int(b, 2) for b in binaries)
    return dec_to_bin(total)


def bin_sub(b1: str, b2: str) -> str:
    result = int(b1, 2) - int(b2, 2)
    assert result >= 0
    return dec_to_bin(result)


def place_value_of_leftmost(binstr: str) -> int:
    return 2 ** (len(binstr) - 1)


def expand_powers_string(binstr: str) -> str:
    n = len(binstr)
    terms = [f"{digit}x2^{n - 1 - i}" for i, digit in enumerate(binstr)]
    return " + ".join(terms)


def next_binary(binstr: str) -> str:
    return dec_to_bin(int(binstr, 2) + 1)
