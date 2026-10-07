"""quiz_gen/templates.py — Template registry for generated quiz questions.

Every template is a small object: which lesson/LO levels it can fill, and a
`generate(rng)` function that samples random parameters and returns a fresh
{question, answer, ...} dict. The answer always comes from solvers.py, never
invented here - a template's only creative freedom is phrasing and which
random numbers to plug in.

Difficulty is NOT a template property - it follows the seed content's own
convention (remember/understand -> easy, apply -> medium), applied
uniformly by generator.py regardless of which template fills a given slot.

Only the 3 Bloom levels the Learning Outcome quizzes assess (remember,
understand, apply) are used, and each template's lo_levels follow how the
LO owner's own quizzes (bank.py) level that kind of question - e.g. "find
the area of a parallelogram" is understand, "find its height from the
area" is apply. Some templates are tagged to multiple lo_levels (e.g.
"find the common difference" is a legitimate remember or understand
question) - generator.py picks among the templates valid for the level
it's filling. "pool" templates have no numeric parameters (pure
recall/definition questions) and instead sample one of a few hand-written
phrasing variants, still resampled per request so repeated attempts don't
always show the identical wording.

Besides these, every question in bank.py is registered as a fixed "bank"
template (see _bank_templates at the bottom). `concept` marks a pool
template and a bank item that ask the same thing, so one quiz never
contains both; `quiz_set` restricts a bank template to the quiz (1 = first
attempt, 2 = retake) it came from.
"""

from __future__ import annotations

import random

from . import solvers as s

LEVELS = ["remember", "understand", "apply"]


class Template:
    def __init__(self, template_id, lo_levels, generate_fn, concept=None, quiz_set=None, feature_text=None):
        self.template_id = template_id
        self.lo_levels = lo_levels
        self._generate_fn = generate_fn
        self.concept = concept
        self.quiz_set = quiz_set
        # Text the template selector (model.py) featurises: for bank
        # templates the fixed question itself; for parameterised ones the
        # readable template_id slug plus one fixed-seed sample question, so
        # the selector sees the template's real topic words, not just the
        # few its id happens to spell out.
        if feature_text is None:
            sample = generate_fn(random.Random(0))["question"]
            feature_text = f"{template_id.replace('_', ' ')} {sample}"
        self.feature_text = feature_text

    @property
    def is_bank(self) -> bool:
        return self.quiz_set is not None

    def generate(self, rng: random.Random) -> dict:
        return self._generate_fn(rng)


def _nonzero(rng: random.Random, lo: int, hi: int) -> int:
    while True:
        v = rng.randint(lo, hi)
        if v != 0:
            return v


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# ───────────────────────────── number-patterns ─────────────────────────────

_NP_TERM_WORDS = [
    "What is the term used for the numbers in a number pattern?",
    "In a number pattern, what do we call each individual number?",
]


def _np_r_pool(rng):
    return {"question": rng.choice(_NP_TERM_WORDS), "answer": "Terms", "accepted_answers": ["term"]}


def _np_common_diff(rng):
    a = rng.randint(1, 30)
    d = _nonzero(rng, -9, 9)
    terms = s.first_n_terms(a, d, 4)
    seq = ", ".join(str(t) for t in terms)
    return {"question": f"What is the common difference of the sequence {seq}, ...?", "answer": str(d)}


def _np_first_three(rng):
    a = _nonzero(rng, -8, 8)
    b = rng.randint(-10, 10)
    t1, t2, t3 = (s.nth_term_linear(a, b, 1), s.nth_term_linear(a, b, 2), s.nth_term_linear(a, b, 3))
    sign = "+" if b >= 0 else "-"
    q = f"Write the first three terms of the sequence with general term Tn = {a}n {sign} {abs(b)}."
    answer = f"{t1}, {t2}, {t3}"
    return {"question": q, "answer": answer, "accepted_answers": [f"{t1},{t2},{t3}"]}


_NP_TN_MEANING = [
    "What does Tn represent in a sequence? Answer with a short phrase.",
    "In sequence notation, what does the symbol Tn stand for?",
]


def _np_tn_meaning_pool(rng):
    return {
        "question": rng.choice(_NP_TN_MEANING),
        "answer": "the nth term",
        "accepted_answers": ["nth term", "general term", "n-th term", "the general term"],
    }


def _np_uniqueness_tf_pool(rng):
    return {
        "question": "True or False: A sequence's first five terms alone always uniquely determine every later term.",
        "answer": "False",
    }


def _np_nth_term_linear(rng):
    a = _nonzero(rng, -12, 12)
    b = rng.randint(-15, 15)
    n = rng.randint(5, 25)
    sign = "+" if b >= 0 else "-"
    answer = s.nth_term_linear(a, b, n)
    q = f"Find the {_ordinal(n)} term of Tn = {a}n {sign} {abs(b)}."
    return {"question": q, "answer": str(answer)}


def _np_find_term_number(rng):
    a = rng.randint(2, 12)
    b = rng.randint(-10, 10)
    n = rng.randint(4, 30)
    target = a * n - b
    sign = "+" if b < 0 else "-"
    q = f"Which term of the sequence Tn = {a}n {sign} {abs(b)} is equal to {target}?"
    nth = _ordinal(n)
    return {"question": q, "answer": f"{nth} term", "accepted_answers": [str(n), f"term {n}", f"the {nth} term"]}


def _np_descending_nth_term(rng):
    a = rng.randint(2, 12)
    c = rng.randint(20, 100)
    n = rng.randint(3, 15)
    answer = s.nth_term_descending(c, a, n)
    q = f"Find the {_ordinal(n)} term of Tn = {c} - {a}n."
    return {"question": q, "answer": str(answer)}


def _np_is_term_yes(rng):
    a = rng.randint(2, 9)
    c = rng.randint(30, 100)
    n = rng.randint(2, 12)
    v = c - a * n
    q = f"Is {v} a term of the sequence Tn = {c} - {a}n? If yes, give the term number."
    return {"question": q, "answer": str(n), "accepted_answers": [f"yes, {n}", f"yes {n}", f"{_ordinal(n)} term"]}


def _np_is_term_no_descending(rng):
    a = rng.randint(2, 9)
    c = rng.randint(30, 100)
    # pick v that does NOT satisfy (c - v) % a == 0
    while True:
        v = rng.randint(0, c)
        if (c - v) % a != 0:
            break
    q = f"Is {v} a term of the sequence Tn = {c} - {a}n? Answer Yes or No."
    return {"question": q, "answer": "No"}


def _np_is_term_no_ascending(rng):
    a = rng.randint(2, 9)
    b = rng.randint(-10, 10)
    while True:
        v = rng.randint(0, 100)
        if (v + b) % a != 0:
            break
    sign = "+" if b < 0 else "-"
    q = f"Is {v} a term of the sequence Tn = {a}n {sign} {abs(b)}? Answer Yes or No."
    return {"question": q, "answer": "No"}


_NP_OSCILLATING = [
    "Does the sequence 1, 1, 2, 2, 3, 3, ... have a constant common difference? Answer Yes or No.",
    "Does the sequence 5, 5, 6, 6, 7, 7, ... have a constant common difference? Answer Yes or No.",
]


def _np_oscillating_pool(rng):
    return {"question": rng.choice(_NP_OSCILLATING), "answer": "No"}


def _np_negative_threshold(rng):
    a = rng.randint(2, 9)
    c = rng.randint(20, 80)
    n = s.negative_threshold(c, a)
    q = f"After which term do all terms become negative in Tn = {c} - {a}n?"
    return {"question": q, "answer": str(n)}


def _np_general_term_from_ad(rng):
    a = rng.randint(1, 20)
    d = _nonzero(rng, -9, 9)
    terms = s.first_n_terms(a, d, 4)
    seq = ", ".join(str(t) for t in terms)
    coeff, b = s.general_term_from_ad(a, d)
    sign = "+" if b >= 0 else "-"
    answer = f"Tn = {coeff}n {sign} {abs(b)}"
    q = f"Find the general term of the sequence {seq}, ..."
    accepted = [f"{coeff}n{sign}{abs(b)}", f"{coeff}n {sign} {abs(b)}", f"tn={coeff}n{sign}{abs(b)}"]
    return {"question": q, "answer": answer, "accepted_answers": accepted}


def _np_nth_term_from_ad(rng):
    a = rng.randint(1, 20)
    d = _nonzero(rng, -9, 9)
    n = rng.randint(5, 25)
    terms = s.first_n_terms(a, d, 4)
    seq = ", ".join(str(t) for t in terms)
    answer = a + (n - 1) * d
    q = f"Find the {_ordinal(n)} term of the sequence {seq}, ..."
    return {"question": q, "answer": str(answer)}


_NP_WORD_PROBLEMS = [
    # Real-life arithmetic sequences, same shape as the LO quizzes' apply
    # questions: first term {a}, common difference {d}, asked term {n}.
    ("A runner runs {a} m on day 1 and increases the distance by {d} m each day. "
     "How far does the runner run on day {n}? Give the answer in metres."),
    ("The first row of a hall has {a} seats and each row has {d} more seats than the row before it. "
     "How many seats are in row {n}?"),
    ("A student saves Rs. {a} in the first week and increases the amount by Rs. {d} each week. "
     "How much does the student save in week {n}?"),
]


def _np_word_problem(rng):
    template = rng.choice(_NP_WORD_PROBLEMS)
    a = rng.randint(2, 50) * (10 if "runner" in template else 1)
    d = rng.randint(2, 10) * (10 if "runner" in template else 1)
    n = rng.randint(8, 25)
    answer = s.first_n_terms(a, d, n)[-1]
    return {"question": template.format(a=a, d=d, n=n), "answer": str(answer)}


NUMBER_PATTERNS_TEMPLATES = [
    Template("np_r_pool", ["remember"], _np_r_pool, concept="np-term-name"),
    Template("np_common_diff", ["remember", "understand"], _np_common_diff),
    Template("np_first_three", ["remember"], _np_first_three),
    Template("np_tn_meaning_pool", ["understand"], _np_tn_meaning_pool, concept="np-tn"),
    Template("np_uniqueness_tf_pool", ["understand"], _np_uniqueness_tf_pool),
    Template("np_oscillating_pool", ["understand"], _np_oscillating_pool),
    Template("np_nth_term_linear", ["understand"], _np_nth_term_linear),
    Template("np_descending_nth_term", ["understand"], _np_descending_nth_term),
    Template("np_general_term_from_ad", ["understand"], _np_general_term_from_ad),
    Template("np_find_term_number", ["apply"], _np_find_term_number),
    Template("np_is_term_yes", ["apply"], _np_is_term_yes),
    Template("np_is_term_no_descending", ["apply"], _np_is_term_no_descending),
    Template("np_is_term_no_ascending", ["apply"], _np_is_term_no_ascending),
    Template("np_negative_threshold", ["apply"], _np_negative_threshold),
    Template("np_nth_term_from_ad", ["apply"], _np_nth_term_from_ad),
    Template("np_word_problem", ["apply"], _np_word_problem),
]


# ───────────────────────────── fractions-bodmas ─────────────────────────────

def _coprime_pair(rng: random.Random, lo=2, hi=12):
    from math import gcd
    while True:
        a, b = rng.randint(lo, hi), rng.randint(lo, hi)
        if a != b and gcd(a, b) == 1:
            return a, b


def _proper_fraction_pair(rng: random.Random, lo=2, hi=12):
    """Like _coprime_pair but guarantees numerator < denominator (a real
    "portion of a whole", needed anywhere a fraction represents a share
    that must stay below 1 - avoids the a>b case that made
    _fr_donation_word_problem's old "keep sampling until <= 1" loop hang
    forever whenever the sampled fraction already exceeded 1 on its own)."""
    from math import gcd
    while True:
        a, b = rng.randint(lo, hi), rng.randint(lo + 1, hi + 1)
        if a < b and gcd(a, b) == 1:
            return a, b


def _fr_reciprocal(rng):
    a, b = _coprime_pair(rng, 2, 12)
    ans = s.reciprocal(a, b)
    return {"question": f"What is the reciprocal of {a}/{b}?", "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_mixed_number(rng):
    d = rng.randint(3, 9)
    w = rng.randint(1, 5)
    r = rng.randint(1, d - 1)
    n = w * d + r
    q = f"What is the mixed number equivalent of the improper fraction {n}/{d}? Answer in the form 'a b/c'."
    answer = f"{w} {r}/{d}"
    return {"question": q, "answer": answer, "answer_type": "fraction"}


def _fr_of_means_multiply(rng):
    a, b = _coprime_pair(rng, 2, 9)
    c, d = _coprime_pair(rng, 2, 9)
    q = f"'{a}/{b} of {c}/{d}' means {a}/{b} ___ {c}/{d}. Fill in the blank with the correct operation symbol."
    return {"question": q, "answer": "x", "accepted_answers": ["×", "*", "multiplication"]}


def _fr_improper_reason_fillblank(rng):
    d = rng.randint(3, 9)
    n = d + rng.randint(1, 6)
    q = f"{n}/{d} is called an improper fraction because the numerator is ___ than the denominator."
    return {"question": q, "answer": "greater", "accepted_answers": ["bigger", "larger"]}


def _fr_of_operation_pool(rng):
    return {
        "question": "What operation replaces the word 'of' in fraction expressions?",
        "answer": "Multiplication",
        "accepted_answers": ["multiply", "times", "x", "×"],
    }


def _fr_multiply(rng):
    a, b = _coprime_pair(rng, 2, 9)
    c, d = _coprime_pair(rng, 2, 9)
    ans = s.multiply_fractions(a, b, c, d)
    return {"question": f"Simplify: {a}/{b} x {c}/{d}", "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_add_same_denom(rng):
    denom = rng.randint(4, 12)
    a = rng.randint(1, denom - 2)
    c = rng.randint(1, denom - a - 1) if denom - a - 1 >= 1 else 1
    ans = s.add_fractions([(a, denom), (c, denom)])
    return {"question": f"Simplify: {a}/{denom} + {c}/{denom}", "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_divide_by_whole(rng):
    n = rng.randint(2, 6)
    b = rng.randint(2, 9)
    a = n * rng.randint(1, 4)
    ans = s.divide_fraction_by_whole(a, b, n)
    return {"question": f"Simplify: {a}/{b} / {n}", "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_of_two_fractions(rng):
    a, b = _coprime_pair(rng, 2, 9)
    c, d = _coprime_pair(rng, 2, 9)
    ans = s.multiply_fractions(a, b, c, d)
    return {"question": f"Simplify: {a}/{b} of {c}/{d}", "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_add_sub_three(rng):
    # mastery.py's fraction grading (_normalize_fraction) only parses
    # non-negative fractions, matching every hand-written seed question in
    # this lesson - so the subtracted term must never exceed the sum ahead
    # of it, or a mathematically-correct negative answer would be
    # ungradeable.
    d1, d2 = rng.randint(2, 8), rng.randint(2, 8)
    n1, n2 = rng.randint(1, d1 - 1), rng.randint(1, d2 - 1)
    partial_sum = s.add_fractions([(n1, d1), (n2, d2)])
    d3 = rng.randint(2, 8)
    valid_n3 = [n for n in range(1, d3) if Fraction_of(n, d3) <= partial_sum]
    n3 = rng.choice(valid_n3) if valid_n3 else 1
    d3 = d3 if valid_n3 else 1  # n3/d3 = 1/1 = 1 <= partial_sum is not guaranteed either; see fallback below
    if not valid_n3:
        # partial_sum was too small (e.g. 1/8 + 1/8) for any k/d3 <= it with d3 in [2,8];
        # fall back to subtracting a fraction of the partial sum's own denominator
        n3, d3 = partial_sum.numerator, partial_sum.denominator
    ans = partial_sum - Fraction_of(n3, d3)
    q = f"Simplify: {n1}/{d1} + {n2}/{d2} - {n3}/{d3}"
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def Fraction_of(n, d):
    from fractions import Fraction
    return Fraction(n, d)


def _reduced_proper_numerator(rng: random.Random, d: int) -> int:
    from math import gcd
    return rng.choice([n for n in range(1, d) if gcd(n, d) == 1])


def _fr_divide_mixed(rng):
    w1, d1 = rng.randint(1, 3), rng.randint(2, 5)
    n1 = _reduced_proper_numerator(rng, d1)
    w2, d2 = rng.randint(1, 3), rng.randint(2, 5)
    n2 = _reduced_proper_numerator(rng, d2)
    ans = s.divide_mixed(w1, n1, d1, w2, n2, d2)
    q = f"Simplify: {w1} {n1}/{d1} / {w2} {n2}/{d2}"
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_bodmas_combo(rng):
    a, b = _coprime_pair(rng, 2, 9)
    c, d = _coprime_pair(rng, 2, 9)
    e, f = _coprime_pair(rng, 2, 9)
    g, h = _coprime_pair(rng, 2, 9)
    ans = s.bodmas_fraction_combo(a, b, c, d, e, f, g, h)
    q = f"Simplify using BODMAS: {a}/{b} / {c}/{d} of {e}/{f} x {g}/{h}"
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_savings_word_problem(rng):
    b = rng.randint(3, 6)
    a = rng.randint(1, b // 2)  # keeps a/b <= 1/2, so c=1 is always a valid fallback below
    d = rng.randint(3, 6)
    remaining = Fraction_of(1, 1) - Fraction_of(a, b)
    # largest c in [1, d-1] with c/d strictly less than the remaining share;
    # bounded search over at most 5 candidates, never an unbounded loop
    valid_cs = [c for c in range(1, d) if Fraction_of(c, d) < remaining]
    c = rng.choice(valid_cs)
    ans = s.savings_fraction(a, b, c, d)
    q = f"A person spends {a}/{b} of his income on food and {c}/{d} on business. What fraction does he save?"
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_donation_word_problem(rng):
    a, b = _proper_fraction_pair(rng, 2, 5)
    c = rng.randint(1, b - a)
    e, f = _proper_fraction_pair(rng, 2, 6)
    ans = s.donation_fraction(a, b, e, f)
    q = (
        f"A father gives {a}/{b} of his land to his son and {c}/{b} to his daughter. "
        f"The son then donates {e}/{f} of his portion. What fraction of the TOTAL land did the son donate?"
    )
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


def _fr_bodmas_add_times(rng):
    a, b = _proper_fraction_pair(rng, 1, 5)
    c, d = _proper_fraction_pair(rng, 1, 5)
    e, f = _proper_fraction_pair(rng, 1, 5)
    ans = s.add_then_multiply(a, b, c, d, e, f)
    q = f"Simplify {a}/{b} + {c}/{d} × {e}/{f}."
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


_FR_PORTION_STORIES = [
    "A person owns {a}/{b} of a land and gives {c}/{d} of it to his daughter. "
    "What fraction of the whole land does the daughter receive?",
    "A farmer owns {a}/{b} of a land and uses {c}/{d} of his portion for cultivation. "
    "What fraction of the whole land is used for cultivation?",
]


def _fr_portion_word_problem(rng):
    a, b = _proper_fraction_pair(rng, 1, 7)
    c, d = _proper_fraction_pair(rng, 1, 5)
    ans = s.multiply_fractions(a, b, c, d)
    q = rng.choice(_FR_PORTION_STORIES).format(a=a, b=b, c=c, d=d)
    return {"question": q, "answer": s.fraction_to_answer_string(ans), "answer_type": "fraction"}


FRACTIONS_BODMAS_TEMPLATES = [
    Template("fr_reciprocal", ["remember"], _fr_reciprocal),
    Template("fr_mixed_number", ["remember"], _fr_mixed_number),
    Template("fr_of_means_multiply", ["understand"], _fr_of_means_multiply, concept="fr-of-op"),
    Template("fr_improper_reason_fillblank", ["understand"], _fr_improper_reason_fillblank),
    Template("fr_of_operation_pool", ["understand"], _fr_of_operation_pool, concept="fr-of-op"),
    Template("fr_multiply", ["understand"], _fr_multiply),
    Template("fr_add_same_denom", ["understand"], _fr_add_same_denom),
    Template("fr_divide_by_whole", ["understand"], _fr_divide_by_whole),
    Template("fr_of_two_fractions", ["understand"], _fr_of_two_fractions),
    Template("fr_add_sub_three", ["understand"], _fr_add_sub_three),
    Template("fr_divide_mixed", ["apply"], _fr_divide_mixed),
    Template("fr_bodmas_combo", ["apply"], _fr_bodmas_combo),
    Template("fr_bodmas_add_times", ["apply"], _fr_bodmas_add_times),
    Template("fr_savings_word_problem", ["apply"], _fr_savings_word_problem),
    Template("fr_donation_word_problem", ["apply"], _fr_donation_word_problem),
    Template("fr_portion_word_problem", ["apply"], _fr_portion_word_problem),
]


# ───────────────────────────── binary-numbers ─────────────────────────────

_BN_DIGITS_POOL = [
    "What are the only two digits used in the binary number system?",
    "Which two digits make up every binary number?",
]


def _bn_digits_pool(rng):
    return {"question": rng.choice(_BN_DIGITS_POOL), "answer": "0 and 1", "accepted_answers": ["0,1", "0 1", "zero and one"]}


def _random_binstr(rng: random.Random, min_len=4, max_len=7) -> str:
    length = rng.randint(min_len, max_len)
    return "1" + "".join(rng.choice("01") for _ in range(length - 1))


def _bn_place_value(rng):
    b = _random_binstr(rng, 4, 7)
    ans = s.place_value_of_leftmost(b)
    q = f"What is the place value of the leftmost digit in the binary number {b}? Answer as a plain number."
    return {"question": q, "answer": str(ans), "accepted_answers": [f"2^{len(b)-1}"]}


def _bn_dec_to_bin(rng):
    n = rng.randint(5, 60)
    ans = s.dec_to_bin(n)
    return {"question": f"Write the decimal number {n} as a binary number.", "answer": ans}


_BN_BASE_POOL = [
    "What is the base of the binary number system?",
    "What number base does the binary system use?",
]


def _bn_base_pool(rng):
    return {"question": rng.choice(_BN_BASE_POOL), "answer": "2", "accepted_answers": ["base 2"]}


def _bn_expand_small(rng):
    b = _random_binstr(rng, 2, 2)
    val = s.bin_to_dec(b)
    expansion = s.expand_powers_string(b)
    q = f"Why is {b} (binary) equal to {val} in decimal? Answer as a sum of powers of 2, e.g. '1x2^1 + 0x2^0'."
    return {"question": q, "answer": expansion, "accepted_answers": [expansion.replace(" ", "")]}


_BN_SINGLE_BIT = [("1", "1", "10"), ("1", "0", "1"), ("0", "0", "0")]


def _bn_add_single_bit(rng):
    x, y, ans = rng.choice(_BN_SINGLE_BIT)
    q = f"What is the result of {x} (binary) + {y} (binary)? Answer in binary."
    return {"question": q, "answer": ans}


def _bn_bin_to_dec(rng):
    b = _random_binstr(rng, 4, 6)
    ans = s.bin_to_dec(b)
    return {"question": f"Convert {b} (binary) to a decimal number.", "answer": str(ans)}


def _bn_bin_add(rng):
    b1 = _random_binstr(rng, 4, 5)
    b2 = _random_binstr(rng, 4, 5)
    ans = s.bin_add(b1, b2)
    return {"question": f"Add (in binary): {b1} + {b2}", "answer": ans}


def _bn_bin_sub(rng):
    b1 = _random_binstr(rng, 4, 6)
    v1 = s.bin_to_dec(b1)
    b2 = _random_binstr(rng, 2, max(2, len(b1) - 1))
    if s.bin_to_dec(b2) >= v1:
        b2 = dec_to_bin_safe(rng.randint(0, v1))
    ans = s.bin_sub(b1, b2)
    return {"question": f"Subtract (in binary): {b1} - {b2}", "answer": ans}


def dec_to_bin_safe(n):
    return s.dec_to_bin(n) if n > 0 else "0"


def _bn_bin_add3(rng):
    b1 = _random_binstr(rng, 3, 5)
    b2 = _random_binstr(rng, 3, 5)
    b3 = _random_binstr(rng, 2, 3)
    ans = s.bin_add(b1, b2, b3)
    return {"question": f"Add (in binary): {b1} + {b2} + {b3}", "answer": ans}


def _bn_power_of_two(rng):
    k = rng.randint(0, 8)
    return {"question": f"What is the value of 2^{k}?", "answer": str(s.power_of_two(k))}


def _bn_valid_binary(rng):
    b = _random_binstr(rng, 4, 6)
    if rng.random() < 0.5:
        return {"question": f"Is {b} a valid binary number?", "answer": "Yes"}
    pos = rng.randint(1, len(b) - 1)
    invalid = b[:pos] + str(rng.randint(2, 9)) + b[pos + 1:]
    return {"question": f"Is {invalid} a valid binary number?", "answer": "No"}


BINARY_NUMBERS_TEMPLATES = [
    Template("bn_digits_pool", ["remember"], _bn_digits_pool, concept="bn-digits"),
    Template("bn_base_pool", ["remember"], _bn_base_pool, concept="bn-base"),
    Template("bn_place_value", ["remember"], _bn_place_value),
    Template("bn_power_of_two", ["remember"], _bn_power_of_two),
    Template("bn_valid_binary", ["understand"], _bn_valid_binary),
    Template("bn_dec_to_bin", ["understand"], _bn_dec_to_bin),
    Template("bn_bin_to_dec", ["understand"], _bn_bin_to_dec),
    Template("bn_expand_small", ["understand"], _bn_expand_small),
    Template("bn_add_single_bit", ["understand"], _bn_add_single_bit),
    Template("bn_bin_add", ["apply"], _bn_bin_add),
    Template("bn_bin_sub", ["apply"], _bn_bin_sub),
    Template("bn_bin_add3", ["apply"], _bn_bin_add3),
]


TEMPLATES_BY_LESSON = {
    "number-patterns": NUMBER_PATTERNS_TEMPLATES,
    "fractions-bodmas": FRACTIONS_BODMAS_TEMPLATES,
    "binary-numbers": BINARY_NUMBERS_TEMPLATES,
}

# Imported at the bottom (not the top) because templates_geometry.py and
# templates_arithmetic.py both import Template/_ordinal FROM this module -
# by the time this runs, those names already exist in this module's
# namespace, so the circular import resolves cleanly.
from . import templates_geometry, templates_arithmetic  # noqa: E402

TEMPLATES_BY_LESSON.update(templates_geometry.TEMPLATES_BY_LESSON)
TEMPLATES_BY_LESSON.update(templates_arithmetic.TEMPLATES_BY_LESSON)


# ───────────────────────────── bank templates ─────────────────────────────

from . import bank as B  # noqa: E402


def _fixed(item):
    def generate(_rng):
        return {k: v for k, v in item.items() if k != "concept"}
    return generate


_BANK_PREFIX = {
    "number-patterns": "np", "fractions-bodmas": "fr", "binary-numbers": "bn",
    "area-of-shapes": "ar", "percentages": "pc", "sets": "st",
}


def _bank_templates(lesson_id: str) -> list[Template]:
    prefix = _BANK_PREFIX[lesson_id]
    return [
        Template(
            f"{prefix}_bank_q{quiz_set}_{code}{i}", [level], _fixed(item),
            concept=item.get("concept"), quiz_set=quiz_set, feature_text=item["question"],
        )
        for quiz_set in (1, 2)
        for level, code, i, item in B.bank_items(lesson_id, quiz_set)
    ]


for _lesson_id in TEMPLATES_BY_LESSON:
    TEMPLATES_BY_LESSON[_lesson_id] = TEMPLATES_BY_LESSON[_lesson_id] + _bank_templates(_lesson_id)


def templates_for(lesson_id: str, lo_level: str, quiz_set: int | None = None) -> list[Template]:
    """Templates valid for one (lesson, level) slot. Bank templates are
    limited to the requested quiz_set (1 = first attempt, 2 = retake);
    quiz_set=None returns every bank template."""
    return [
        t for t in TEMPLATES_BY_LESSON.get(lesson_id, [])
        if lo_level in t.lo_levels and (not t.is_bank or quiz_set is None or t.quiz_set == quiz_set)
    ]
