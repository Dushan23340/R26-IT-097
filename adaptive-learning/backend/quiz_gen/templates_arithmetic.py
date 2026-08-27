"""quiz_gen/templates_arithmetic.py — Templates for percentages and sets.
Same conventions as templates.py: every answer comes from
solvers_arithmetic.py.
"""

from __future__ import annotations

import random
from fractions import Fraction

from .templates import Template
from . import solvers_arithmetic as a


def _nonzero(rng: random.Random, lo: int, hi: int) -> int:
    while True:
        v = rng.randint(lo, hi)
        if v != 0:
            return v


# ───────────────────────────── percentages ─────────────────────────────

_NICE_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]


def _pc_profit_formula_pool(rng):
    return {"question": "What is the formula for calculating profit?", "answer": "Profit = Selling Price - Cost Price", "accepted_answers": ["selling price - cost price", "sp - cp"]}


def _pc_loss_formula_pool(rng):
    return {"question": "What is the formula for calculating loss percentage?", "answer": "Loss% = (Loss / Cost Price) x 100%", "accepted_answers": ["(loss/cost price)x100%", "loss/cost price x 100"]}


def _pc_discount_name_pool(rng):
    return {"question": "What is the amount reduced from the marked price called?", "answer": "Discount"}


def _pc_when_loss_pool(rng):
    return {"question": "When does a seller incur a loss?", "answer": "When the selling price is less than the cost price", "accepted_answers": ["when selling price < cost price", "selling price is lower than cost price"]}


def _pc_discount_meaning(rng):
    pct = rng.choice(_NICE_PERCENTS)
    q = f"What does a discount of {pct}% mean?"
    return {"question": q, "answer": f"{pct}% is reduced from the marked price", "accepted_answers": [f"{pct}% off the marked price", f"{pct} percent reduced from marked price"]}


def _pc_commission_pool(rng):
    return {"question": "What is a commission?", "answer": "A fee charged by a broker for facilitating a sale", "accepted_answers": ["a percentage fee charged by a broker for a sale", "fee for facilitating a sale"]}


def _pc_calc_profit(rng):
    cp = rng.randint(200, 3000)
    sp = cp + rng.randint(50, 800)
    answer = a.profit(cp, sp)
    q = f"A vendor buys an item for Rs {cp} and sells it for Rs {sp}. Calculate the profit."
    return {"question": q, "answer": f"Rs {answer}", "accepted_answers": [str(answer), f"rs{answer}", f"rs {answer}"]}


def _pc_calc_loss(rng):
    cp = rng.randint(500, 3000)
    sp = cp - rng.randint(50, 500)
    answer = a.loss(cp, sp)
    q = f"An item worth Rs {cp} is sold for Rs {sp}. Calculate the loss."
    return {"question": q, "answer": f"Rs {answer}", "accepted_answers": [str(answer), f"rs{answer}", f"rs {answer}"]}


def _pc_calc_discount(rng):
    marked = rng.randint(5, 200) * 100
    pct = rng.choice(_NICE_PERCENTS)
    answer = a.discount_amount(marked, pct)
    assert answer.denominator == 1
    q = f"A discount of {pct}% is offered on an item of marked price Rs {marked}. Calculate the discount amount."
    return {"question": q, "answer": f"Rs {answer.numerator}", "accepted_answers": [str(answer.numerator), f"rs{answer.numerator}", f"rs {answer.numerator}"]}


def _pc_profit_percent(rng):
    pct = rng.choice(_NICE_PERCENTS)
    cp = rng.randint(2, 50) * 100
    sp = a.selling_price_after_pct(cp, pct, is_profit=True)
    assert sp.denominator == 1
    q = f"A vendor buys items at Rs {cp} each and sells at Rs {sp.numerator} each. Calculate the profit percentage."
    return {"question": q, "answer": f"{pct}%", "accepted_answers": [str(pct), f"{pct} percent"]}


def _pc_loss_percent(rng):
    pct = rng.choice(_NICE_PERCENTS)
    cp = rng.randint(2, 50) * 100
    sp = a.selling_price_after_pct(cp, pct, is_profit=False)
    assert sp.denominator == 1
    q = f"An item bought for Rs {cp} is sold at Rs {sp.numerator}. Calculate the loss percentage."
    return {"question": q, "answer": f"{pct}%", "accepted_answers": [str(pct), f"{pct} percent"]}


def _pc_compare_profitability(rng):
    cp1 = rng.randint(500, 2000)
    pct1 = rng.choice(_NICE_PERCENTS)
    sp1 = a.selling_price_after_pct(cp1, pct1, is_profit=True).numerator

    cp2 = rng.randint(500, 2000)
    pct2 = rng.choice([p for p in _NICE_PERCENTS if p != pct1])
    sp2 = a.selling_price_after_pct(cp2, pct2, is_profit=True).numerator

    answer = "First" if pct1 > pct2 else "Second"
    q = (
        f"Which is more profitable: selling at Rs {sp1} an item bought for Rs {cp1}, "
        f"or selling at Rs {sp2} an item bought for Rs {cp2}? Answer 'First' or 'Second'."
    )
    return {"question": q, "answer": answer}


def _pc_profit_or_loss_word(rng):
    n_total = rng.randint(50, 150)
    n_spoilt = rng.randint(5, min(30, n_total - 10))
    cp_each = rng.randint(10, 40)
    sp_each = cp_each + rng.choice([-8, -5, -2, 2, 5, 10, 15])
    if sp_each <= 0:
        sp_each = cp_each + 5
    total_cp = n_total * cp_each
    total_sp = (n_total - n_spoilt) * sp_each
    answer = "Profit" if total_sp > total_cp else "Loss"
    q = (
        f"A vendor buys {n_total} items at Rs {cp_each} each, discards {n_spoilt} spoilt ones, "
        f"and sells the rest at Rs {sp_each} each. Did he earn a profit or a loss? Answer 'Profit' or 'Loss'."
    )
    return {"question": q, "answer": answer}


def _pc_verify_loss_sp(rng):
    cp = rng.randint(2, 200) * 100
    pct = rng.choice(_NICE_PERCENTS)
    actual = a.selling_price_after_pct(cp, pct, is_profit=False)
    assert actual.denominator == 1
    make_true = rng.random() < 0.5
    shown = actual.numerator if make_true else actual.numerator + rng.choice([-200, -100, 100, 200])
    answer = "Yes" if make_true else "No"
    q = f"Verify: if an item worth Rs {cp} is sold at a loss of {pct}%, is the selling price Rs {shown}?"
    return {"question": q, "answer": answer}


def _pc_find_cp_from_profit(rng):
    pct = rng.choice(_NICE_PERCENTS)
    cp_true = rng.randint(2, 100) * 100
    sp = a.selling_price_after_pct(cp_true, pct, is_profit=True)
    assert sp.denominator == 1
    q = f"If a profit of {pct}% is earned by selling an item for Rs {sp.numerator}, what was its cost price?"
    return {"question": q, "answer": f"Rs {cp_true}", "accepted_answers": [str(cp_true), f"rs{cp_true}", f"rs {cp_true}"]}


def _pc_find_price_no_profit_no_loss(rng):
    # Built backward from the answer so the division is exact by
    # construction, not by chance: w2 = m*w3, and cp/sp are picked as
    # price + m*delta / cp + delta, which makes
    # (cp*w1 - sp*w2) / w3 collapse to exactly `price` algebraically
    # (see derivation in the accompanying commit/PR notes) - no retry
    # loop needed, unlike a plain "sample then check divisibility"
    # approach which would rarely land on an exact division.
    w3 = rng.randint(2, 10)
    m = rng.randint(2, 6)
    w2 = m * w3
    w1 = w2 + w3
    price = rng.randint(15, 50)
    delta = rng.randint(5, 20) * rng.choice([1, -1])
    cp = price + m * delta
    sp = cp + delta
    if cp <= 0 or sp <= 0 or cp == sp:
        return _pc_find_price_no_profit_no_loss(rng)

    actual = a.price_for_no_profit_no_loss(cp, w1, sp, w2, w3)
    assert actual.denominator == 1 and actual.numerator == price

    q = (
        f"A vendor buys {w1} kg of onions at Rs {cp}/kg, sells {w2} kg at Rs {sp}/kg. "
        f"He must sell the remaining {w3} kg at what price per kg to make no profit and no loss?"
    )
    return {"question": q, "answer": f"Rs {price}/kg", "accepted_answers": [str(price), f"rs{price}", f"rs {price}", f"{price} per kg"]}


def _pc_compare_discounts(rng):
    price = rng.randint(5, 30) * 100
    pct = rng.choice(_NICE_PERCENTS)
    discount_a = a.discount_amount(price, pct)
    assert discount_a.denominator == 1
    flat_b = rng.randint(50, 300)
    answer = "Shop A" if discount_a.numerator > flat_b else "Shop B"
    q = (
        f"A shop offers a {pct}% discount on Rs {price} shoes. Another offers Rs {flat_b} off on purchases over Rs 1,000. "
        f"Which is better for the customer? Answer 'Shop A' or 'Shop B'."
    )
    return {"question": q, "answer": answer}


PERCENTAGES_TEMPLATES = [
    Template("pc_profit_formula_pool", ["remember"], _pc_profit_formula_pool),
    Template("pc_loss_formula_pool", ["remember"], _pc_loss_formula_pool),
    Template("pc_discount_name_pool", ["remember"], _pc_discount_name_pool),
    Template("pc_when_loss_pool", ["understand"], _pc_when_loss_pool),
    Template("pc_discount_meaning", ["understand"], _pc_discount_meaning),
    Template("pc_commission_pool", ["understand"], _pc_commission_pool),
    Template("pc_calc_profit", ["apply"], _pc_calc_profit),
    Template("pc_calc_loss", ["apply"], _pc_calc_loss),
    Template("pc_calc_discount", ["apply"], _pc_calc_discount),
    Template("pc_profit_percent", ["analyze"], _pc_profit_percent),
    Template("pc_loss_percent", ["analyze"], _pc_loss_percent),
    Template("pc_compare_profitability", ["analyze", "evaluate"], _pc_compare_profitability),
    Template("pc_profit_or_loss_word", ["evaluate"], _pc_profit_or_loss_word),
    Template("pc_verify_loss_sp", ["evaluate"], _pc_verify_loss_sp),
    Template("pc_find_cp_from_profit", ["create"], _pc_find_cp_from_profit),
    Template("pc_find_price_no_profit_no_loss", ["create"], _pc_find_price_no_profit_no_loss),
    Template("pc_compare_discounts", ["create"], _pc_compare_discounts),
]


# ───────────────────────────── sets ─────────────────────────────


def _st_set_definition_pool(rng):
    return {"question": "What is a set?", "answer": "A collection of items that can be clearly identified", "accepted_answers": ["a collection of clearly identified items", "a well-defined collection of objects"]}


def _st_universal_symbol_pool(rng):
    return {"question": "What is the symbol used to denote the universal set?", "answer": "ε", "accepted_answers": ["u", "epsilon"]}


def _st_null_set_pool(rng):
    return {"question": "What is the null set?", "answer": "A set with no elements", "accepted_answers": ["empty set", "a set with no elements", "{}", "φ"]}


def _st_finite_infinite_pool(rng):
    return {"question": "What is the difference between a finite set and an infinite set?", "answer": "A finite set has a specific number of elements; an infinite set has an endless number of elements", "accepted_answers": ["finite has a limited number of elements, infinite does not"]}


def _st_intersection_def_pool(rng):
    return {"question": "What is the intersection of two sets?", "answer": "The set of elements common to both sets", "accepted_answers": ["elements common to both sets", "a ∩ b"]}


def _st_complement_def_pool(rng):
    return {"question": "What is the complement of a set A?", "answer": "The set of elements in the universal set which are not in A", "accepted_answers": ["elements not in a", "a'"]}


def _random_small_set(rng, lo=1, hi=20, size=4):
    return set(rng.sample(range(lo, hi), size))


def _st_intersection_calc(rng):
    A = _random_small_set(rng, 1, 20, 4)
    B = _random_small_set(rng, 1, 20, 4)
    result = a.set_intersection(A, B)
    q = f"If A = {a.format_set(A)} and B = {a.format_set(B)}, find A ∩ B."
    ans = a.format_set(result)
    return {"question": q, "answer": ans, "accepted_answers": [ans.replace(" ", "")]}


def _st_union_calc(rng):
    A = _random_small_set(rng, 1, 15, 3)
    B = _random_small_set(rng, 1, 15, 3)
    result = a.set_union(A, B)
    q = f"If A = {a.format_set(A)} and B = {a.format_set(B)}, find A ∪ B."
    ans = a.format_set(result)
    return {"question": q, "answer": ans, "accepted_answers": [ans.replace(" ", "")]}


def _st_complement_calc(rng):
    universal = set(range(1, rng.randint(7, 10)))
    A = set(rng.sample(sorted(universal), rng.randint(2, len(universal) - 2)))
    result = a.set_complement(universal, A)
    q = f"If ε = {a.format_set(universal)} and A = {a.format_set(A)}, find A'."
    ans = a.format_set(result)
    return {"question": q, "answer": ans, "accepted_answers": [ans.replace(" ", "")]}


def _st_subsets_calc(rng):
    x1, x2 = rng.sample(range(1, 10), 2)
    q = f"Write all subsets of the set X = {{{min(x1,x2)}, {max(x1,x2)}}}."
    ans = a.format_subsets([min(x1, x2), max(x1, x2)])
    return {"question": q, "answer": ans}


def _st_equal_vs_equivalent(rng):
    n = rng.randint(3, 8)
    q = f"If set A has {n} elements and set B also has {n} elements but different elements, are they equal sets or equivalent sets?"
    return {"question": q, "answer": "Equivalent sets", "accepted_answers": ["equivalent"]}


def _st_verify_subset_pool(rng):
    pairs = [
        ("{red}", "{colours of the rainbow}", "Yes"),
        ("{cylinder}", "{polygons}", "No"),
        ("{square}", "{polygons}", "Yes"),
        ("{sphere}", "{polygons}", "No"),
    ]
    subset, superset, answer = rng.choice(pairs)
    return {"question": f"Is {subset} a subset of {superset}? Answer Yes or No.", "answer": answer}


def _st_verify_equal_sets(rng):
    n = rng.randint(2, 3)
    digits = rng.sample(range(1, 10), rng.randint(4, 6))
    even_digits = sorted(d for d in digits if d % 2 == 0)
    if not even_digits:
        return _st_verify_equal_sets(rng)
    number = "".join(str(d) for d in digits)
    a_set_desc = "{even numbers between 0 and 10}"
    a_set = sorted(d for d in range(1, 10) if d % 2 == 0)
    b_set = sorted(set(int(ch) for ch in number))
    answer = "Yes" if a_set == b_set else "No"
    q = f"Are sets A = {a_set_desc} and B = {{digits of {number}}} equal sets? Answer Yes or No."
    return {"question": q, "answer": answer}


def _st_write_elements(rng):
    lo, hi = sorted(rng.sample(range(1, 15), 2))
    q = f"Write the elements of D = {{whole numbers between {lo} and {hi}}}."
    ans = a.format_set(set(range(lo + 1, hi)))
    return {"question": q, "answer": ans, "accepted_answers": [ans.replace(" ", "")]}


def _st_null_set_descriptive_pool(rng):
    options = ["{even numbers between 1 and 2}", "{prime numbers between 10 and 12}", "{whole numbers between 3 and 4}"]
    return {
        "question": "Express the null set in descriptive form using a common characteristic (e.g. '{even numbers between 1 and 2}').",
        "answer": rng.choice(options),
        "accepted_answers": options,
    }


def _st_union_and_complement(rng):
    universal = set(range(1, rng.randint(7, 10)))
    P = set(rng.sample(sorted(universal), 3))
    remaining = sorted(universal - P)
    Q = set(rng.sample(remaining, min(3, len(remaining)))) if remaining else set()
    result = a.set_union(P, Q)
    q = f"Given ε = {a.format_set(universal)}, P = {a.format_set(P)}, Q = {a.format_set(Q)}. Find P ∪ Q."
    ans = a.format_set(result)
    return {"question": q, "answer": ans, "accepted_answers": [ans.replace(" ", "")]}


SETS_TEMPLATES = [
    Template("st_set_definition_pool", ["remember"], _st_set_definition_pool),
    Template("st_universal_symbol_pool", ["remember"], _st_universal_symbol_pool),
    Template("st_null_set_pool", ["remember"], _st_null_set_pool),
    Template("st_finite_infinite_pool", ["understand"], _st_finite_infinite_pool),
    Template("st_intersection_def_pool", ["understand"], _st_intersection_def_pool),
    Template("st_complement_def_pool", ["understand"], _st_complement_def_pool),
    Template("st_intersection_calc", ["apply"], _st_intersection_calc),
    Template("st_union_calc", ["apply"], _st_union_calc),
    Template("st_complement_calc", ["apply"], _st_complement_calc),
    Template("st_intersection_calc_analyze", ["analyze"], _st_intersection_calc),
    Template("st_equal_vs_equivalent", ["analyze"], _st_equal_vs_equivalent),
    Template("st_subsets_calc", ["analyze"], _st_subsets_calc),
    Template("st_verify_subset_pool", ["evaluate"], _st_verify_subset_pool),
    Template("st_verify_equal_sets", ["evaluate"], _st_verify_equal_sets),
    Template("st_write_elements", ["create"], _st_write_elements),
    Template("st_null_set_descriptive_pool", ["create"], _st_null_set_descriptive_pool),
    Template("st_union_and_complement", ["create"], _st_union_and_complement),
]


TEMPLATES_BY_LESSON = {
    "percentages": PERCENTAGES_TEMPLATES,
    "sets": SETS_TEMPLATES,
}
