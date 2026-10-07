"""quiz_gen/bank.py — The Learning Outcome owner's (IT22186492) two
textbook-aligned quizzes ("quiz new 9-26"), verbatim: per lesson, Quiz 1
and Quiz 2, each 5 remember + 5 understand + 2 apply short-answer
questions with their answers.

Used two ways:
  - lessons.py builds its static quiz sets from these (set 1 = Quiz 1, set
    2 = Quiz 2) - the fallback whenever generation is unavailable.
  - templates.py registers every item as a fixed "bank" template, so the
    generator samples them alongside the parameterised solver-backed
    templates. A first attempt (quiz_set 1) only draws bank items from
    Quiz 1, a retake (quiz_set 2) only from Quiz 2.

Each item: question, answer, plus optional accepted_answers / answer_type
(graded by mastery._is_correct, same as every other question) and
`concept` - set only where the item asks the same thing as one of the
existing pool templates, so the generator never puts both in one quiz.
"""

from __future__ import annotations

LEVEL_CODES = {"r": "remember", "u": "understand", "a": "apply"}


def _q(question, answer, accepted=None, answer_type=None, concept=None):
    item = {"question": question, "answer": answer}
    if accepted:
        item["accepted_answers"] = accepted
    if answer_type:
        item["answer_type"] = answer_type
    if concept:
        item["concept"] = concept
    return item


_MULTIPLY = ["multiply", "multiplication", "times", "x", "×"]

# lesson_id -> quiz_set -> level code -> [items]
BANK = {
    "number-patterns": {
        1: {
            "r": [
                _q("What is the difference between successive terms called?", "Common difference"),
                _q("What symbol represents the general term of a sequence?", "Tn",
                   ["T n", "Tₙ", "T_n"], concept="np-tn"),
                _q("What is the common difference of 2, 4, 6, 8, ...?", "2"),
                _q("What is the common difference of 3, 3, 3, 3, ...?", "0"),
                _q("What value of n gives the first term of a sequence?", "1", ["n = 1", "n=1"]),
            ],
            "u": [
                _q("Find the common difference of 5, 8, 11, 14, ...", "3"),
                _q("Find the common difference of 17, 12, 7, 2, ...", "-5"),
                _q("If Tn = 2n + 3, find T1.", "5"),
                _q("If Tn = 3n + 2, find T3.", "11"),
                _q("Find the general term of 1, 4, 7, 10, ...", "3n - 2", ["Tn = 3n - 2"]),
            ],
            "a": [
                _q("A runner starts at 500 m and increases the distance by 100 m each day. "
                   "Find the distance on day 20. Give the answer in metres.", "2400"),
                _q("Stadium rows have 9, 12, 15, ... seats. How many seats are in row 15?", "51"),
            ],
        },
        2: {
            "r": [
                _q("What is each number in a number pattern called?", "Term", ["terms"], concept="np-term-name"),
                _q("What letter is commonly used to represent the position of a term?", "n"),
                _q("What is the common difference of 4, 8, 12, 16, ...?", "4"),
                _q("What is the common difference of 20, 15, 10, 5, ...?", "-5"),
                _q("If the common difference is positive, does the pattern increase or decrease?", "Increase",
                   ["increases", "it increases", "increasing"]),
            ],
            "u": [
                _q("Find the common difference of 7, 12, 17, 22, ...", "5"),
                _q("Find the common difference of 30, 24, 18, 12, ...", "-6"),
                _q("If Tn = 4n + 1, find T2.", "9"),
                _q("If Tn = 5n - 2, find T4.", "18"),
                _q("Find the general term of 2, 5, 8, 11, ...", "3n - 1", ["Tn = 3n - 1"]),
            ],
            "a": [
                _q("A student saves Rs. 200 on the first week and increases the amount by Rs. 50 each week. "
                   "How much does the student save in week 10?", "650"),
                _q("The number of seats in successive rows is 12, 16, 20, ... . How many seats are in row 20?", "88"),
            ],
        },
    },
    "binary-numbers": {
        1: {
            "r": [
                _q("Which two digits are used in the binary number system?", "0 and 1",
                   ["1 and 0", "0, 1", "0,1", "0 1", "zero and one"], concept="bn-digits"),
                _q("What is the base of the binary number system?", "2", ["base 2", "two"], concept="bn-base"),
                _q("What is the base of the decimal number system?", "10", ["base 10", "ten"]),
                _q("What is the value of 2^0?", "1"),
                _q("Name one device that uses the binary number system.", "Computer",
                   ["computers", "calculator", "phone", "mobile phone", "smartphone", "laptop", "tablet", "television", "tv"]),
            ],
            "u": [
                _q("Is 1011 a valid binary number?", "Yes"),
                _q("Is 1201 a valid binary number?", "No"),
                _q("Convert 13 from decimal to binary.", "1101"),
                _q("Convert 101 from binary to decimal.", "5"),
                _q("What binary digit represents the “current on” condition?", "1"),
            ],
            "a": [
                _q("Add the binary numbers 101 and 10.", "111"),
                _q("Subtract 1 from the binary number 110.", "101"),
            ],
        },
        2: {
            "r": [
                _q("How many different digits are used in the binary number system?", "2", ["two"], concept="bn-digits"),
                _q("What is the largest digit used in the binary number system?", "1", ["one"]),
                _q("What is the value of 2^1?", "2"),
                _q("What is the value of 2^3?", "8"),
                _q("What binary digit represents the “current off” condition?", "0"),
            ],
            "u": [
                _q("Is 11001 a valid binary number?", "Yes"),
                _q("Is 10201 a valid binary number?", "No"),
                _q("Convert 10 from decimal to binary.", "1010"),
                _q("Convert 110 from binary to decimal.", "6"),
                _q("Convert 15 from decimal to binary.", "1111"),
            ],
            "a": [
                _q("Add the binary numbers 110 and 11.", "1001"),
                _q("Subtract 10 from the binary number 111.", "101"),
            ],
        },
    },
    "fractions-bodmas": {
        1: {
            "r": [
                _q("What operation does “of” represent in fractions?", "Multiplication", _MULTIPLY, concept="fr-of-op"),
                _q("What does the letter B in BODMAS stand for?", "Brackets", ["bracket"]),
                _q("What does the letter O in BODMAS stand for in this lesson?", "Of"),
                _q("Which operation is performed first in BODMAS?", "Brackets", ["bracket"]),
                _q("Which operations are performed last in BODMAS?", "Addition and subtraction",
                   ["subtraction and addition", "addition, subtraction", "addition & subtraction", "a and s"]),
            ],
            "u": [
                _q("Find 1/2 of 3/4.", "3/8", answer_type="fraction"),
                _q("Find 2/3 of 3/5.", "2/5", answer_type="fraction"),
                _q("Simplify (1/2 + 1/4).", "3/4", answer_type="fraction"),
                _q("Simplify (3/4 - 1/2).", "1/4", answer_type="fraction"),
                _q("Simplify 1/2 + (1/4 × 2).", "1", answer_type="fraction"),
            ],
            "a": [
                _q("Simplify 1/2 + 2/3 × 3/4.", "1", answer_type="fraction"),
                _q("A person owns 3/5 of a land and gives 1/3 of it to his daughter. "
                   "What fraction of the whole land does the daughter receive?", "1/5", answer_type="fraction"),
            ],
        },
        2: {
            "r": [
                _q("What mathematical symbol can replace “of” in a fraction expression?", "×",
                   ["x", "*", "multiplication", "multiply", "times"], concept="fr-of-op"),
                _q("What does the letter D in BODMAS stand for?", "Division"),
                _q("What does the letter M in BODMAS stand for?", "Multiplication"),
                _q("What does the letter A in BODMAS stand for?", "Addition"),
                _q("What does the letter S in BODMAS stand for?", "Subtraction"),
            ],
            "u": [
                _q("Find 1/3 of 3/5.", "1/5", answer_type="fraction"),
                _q("Find 3/4 of 2/3.", "1/2", answer_type="fraction"),
                _q("Simplify (1/3 + 1/6).", "1/2", answer_type="fraction"),
                _q("Simplify (5/6 - 1/3).", "1/2", answer_type="fraction"),
                _q("Simplify 1/4 + (1/2 × 1/2).", "1/2", answer_type="fraction"),
            ],
            "a": [
                _q("Simplify 1/3 + 1/2 × 2/3.", "2/3", answer_type="fraction"),
                _q("A farmer owns 4/5 of a land and uses 1/2 of his portion for cultivation. "
                   "What fraction of the whole land is used for cultivation?", "2/5", answer_type="fraction"),
            ],
        },
    },
    "percentages": {
        1: {
            "r": [
                _q("What is earned when the selling price is greater than the cost?", "Profit"),
                _q("What is incurred when the cost is greater than the selling price?", "Loss", concept="pc-loss-def"),
                _q("What is the formula for profit?", "Selling price - Cost",
                   ["selling price - cost price", "sp - cp", "selling price minus cost price",
                    "selling price minus cost", "profit = selling price - cost price", "profit = sp - cp"],
                   concept="pc-profit-formula"),
                _q("What is a reduction from the marked price called?", "Discount", concept="pc-discount-name"),
                _q("What is the fee charged for facilitating a sale called?", "Commission", concept="pc-commission"),
            ],
            "u": [
                _q("An item costs Rs. 1000 and is sold for Rs. 1200. Find the profit.", "200"),
                _q("An item costs Rs. 800 and is sold for Rs. 700. Find the loss.", "100"),
                _q("An item costs Rs. 500 and earns a profit of Rs. 100. Find the profit percentage.", "20%"),
                _q("An item costs Rs. 1000 and incurs a loss of Rs. 100. Find the loss percentage.", "10%"),
                _q("Find the discount on an item marked Rs. 2000 if the discount is 10%.", "200"),
            ],
            "a": [
                _q("A television has a marked price of Rs. 25000 and a discount of 5%. Find the selling price.", "23750"),
                _q("Find the commission on a sale of Rs. 3000000 if the commission rate is 5%.", "150000"),
            ],
        },
        2: {
            "r": [
                _q("What is the price at which an item is sold called?", "Selling price", ["sp", "selling"]),
                _q("What is the price paid to obtain an item called?", "Cost", ["cost price", "cp"]),
                _q("What is the formula for loss?", "Cost - Selling price",
                   ["cost price - selling price", "cp - sp", "cost price minus selling price",
                    "cost minus selling price", "loss = cost price - selling price", "loss = cp - sp"],
                   concept="pc-loss-formula"),
                _q("What is the price written on an item before a discount called?", "Marked price", ["mp", "marked"]),
                _q("What type of fee may a brokerage charge for facilitating a sale?", "Commission", concept="pc-commission"),
            ],
            "u": [
                _q("An item costs Rs. 1500 and is sold for Rs. 1800. Find the profit.", "300"),
                _q("An item costs Rs. 2000 and is sold for Rs. 1700. Find the loss.", "300"),
                _q("An item costs Rs. 800 and earns a profit of Rs. 200. Find the profit percentage.", "25%"),
                _q("An item costs Rs. 1200 and incurs a loss of Rs. 120. Find the loss percentage.", "10%"),
                _q("Find the discount on an item marked Rs. 3000 if the discount is 10%.", "300"),
            ],
            "a": [
                _q("A shirt has a marked price of Rs. 4000 and a discount of 15%. Find the selling price.", "3400"),
                _q("Find the commission on a sale of Rs. 500000 if the commission rate is 4%.", "20000"),
            ],
        },
    },
    "sets": {
        1: {
            "r": [
                _q("What is a set with a limited number of elements called?", "Finite set", ["finite"], concept="st-finite"),
                _q("What is a set with an unlimited number of elements called?", "Infinite set", ["infinite"]),
                _q("What are sets with the same elements called?", "Equal sets", ["equal"]),
                _q("What are sets with the same number of elements called?", "Equivalent sets", ["equivalent"]),
                _q("What is a set containing all the elements under consideration called?", "Universal set",
                   ["universal", "ε"], concept="st-universal"),
            ],
            "u": [
                _q("Is {2, 4, 6, 8} a finite or infinite set?", "Finite", ["finite set"]),
                _q("Are {1, 2, 3} and {3, 2, 1} equal sets?", "Yes"),
                _q("Are {1, 2} and {a, b} equivalent sets?", "Yes"),
                _q("If A = {1, 2, 3} and B = {3, 4, 5}, find A intersection B.", "{3}", answer_type="set"),
                _q("If U = {1, 2, 3, 4, 5} and A = {1, 3, 5}, find the complement of A.", "{2, 4}", answer_type="set"),
            ],
            "a": [
                _q("Write all the subsets of A = {1, 2}.", "{}, {1}, {2}, {1, 2}", answer_type="set_list"),
                _q("If A = {1, 2, 3} and B = {3, 4, 5}, find the union of A and B.", "{1, 2, 3, 4, 5}", answer_type="set"),
            ],
        },
        2: {
            "r": [
                _q("What is a set with no elements called?", "Null set", ["empty set", "null", "φ", "{}"], concept="st-null"),
                _q("What are the objects in a set called?", "Elements", ["element", "members"]),
                _q("What type of brackets are used to list the elements of a set?", "Curly brackets",
                   ["curly", "curly braces", "braces", "{ }", "{}"]),
                _q("What are two sets with no common elements called?", "Disjoint sets", ["disjoint"]),
                _q("What is the set of common elements of two sets called?", "Intersection",
                   ["intersection set", "∩"], concept="st-intersection-def"),
            ],
            "u": [
                _q("Is the set of positive multiples of 5 less than 30 finite or infinite?", "Finite", ["finite set"]),
                _q("Are {2, 4, 6} and {6, 4, 2} equal sets?", "Yes"),
                _q("Are {1, 3, 5} and {a, b, c} equivalent sets?", "Yes"),
                _q("If A = {2, 4, 6, 8} and B = {4, 8, 10}, find A intersection B.", "{4, 8}", answer_type="set"),
                _q("If U = {1, 2, 3, 4, 5, 6} and A = {2, 4, 6}, find the complement of A.", "{1, 3, 5}", answer_type="set"),
            ],
            "a": [
                _q("Write all the subsets of A = {a, b}.", "{}, {a}, {b}, {a, b}", answer_type="set_list"),
                _q("If A = {1, 3, 5} and B = {2, 3, 4}, find the union of A and B.", "{1, 2, 3, 4, 5}", answer_type="set"),
            ],
        },
    },
    "area-of-shapes": {
        1: {
            "r": [
                _q("What is the formula for the area of a parallelogram?", "base × height",
                   ["base x height", "base times height", "b x h", "b × h", "bh", "a x h", "a × h"],
                   concept="ar-para-formula"),
                _q("What type of height is used to find the area of a parallelogram?", "Perpendicular height",
                   ["perpendicular", "the perpendicular height", "vertical height"], concept="ar-perp-height"),
                _q("What is the formula for the area of a trapezium?", "1/2 × (a + b) × h",
                   ["1/2(a+b)h", "½ × (a + b) × h", "½(a+b)h", "(a+b)h/2", "(a+b)/2 × h", "0.5 × (a + b) × h",
                    "1/2 × (sum of parallel sides) × height", "1/2 x (sum of parallel sides) x height"],
                   concept="ar-trap-formula"),
                _q("What is the formula for the area of a circle?", "πr²",
                   ["πr^2", "pi r^2", "pi r squared", "πr squared", "pir^2", "pi*r^2", "π × r × r", "22/7 × r²"],
                   concept="ar-circle-formula"),
                _q("What value can be used for π in calculations?", "22/7", ["3.142", "3.14"]),
            ],
            "u": [
                _q("Find the area of a parallelogram with base 10 cm and height 5 cm.", "50"),
                _q("Find the area of a parallelogram with base 8 cm and height 6 cm.", "48"),
                _q("Find the area of a trapezium with parallel sides 11 cm and 6 cm and height 8 cm.", "68"),
                _q("Find the area of a trapezium with parallel sides 8 cm and 12 cm and height 7 cm.", "70"),
                _q("Find the area of a circle with radius 7 cm. Use π = 22/7.", "154"),
            ],
            "a": [
                _q("A parallelogram has an area of 48 cm² and a base of 8 cm. Find its height in cm.", "6"),
                _q("A circular lamina has an area of 154 cm². Find its radius in cm. Use π = 22/7.", "7"),
            ],
        },
        2: {
            "r": [
                _q("What two measurements are multiplied to find the area of a parallelogram?", "Base and height",
                   ["height and base", "base, height", "base x height", "base × height"], concept="ar-para-formula"),
                _q("What is the perpendicular distance between the parallel sides of a parallelogram called?", "Height",
                   ["perpendicular height", "the height"], concept="ar-perp-height"),
                _q("How many parallel sides are used in the area formula of a trapezium?", "2", ["two"]),
                _q("Which measurement of a circle is represented by r?", "Radius", ["the radius"]),
                _q("What is another value that can be used for π in calculations?", "3.142", ["3.14", "22/7"]),
            ],
            "u": [
                _q("Find the area of a parallelogram with base 12 cm and height 7 cm.", "84"),
                _q("Find the area of a parallelogram with base 15 cm and height 4 cm.", "60"),
                _q("Find the area of a trapezium with parallel sides 10 cm and 6 cm and height 5 cm.", "40"),
                _q("Find the area of a trapezium with parallel sides 14 cm and 8 cm and height 6 cm.", "66"),
                _q("Find the area of a circle with radius 14 cm. Use π = 22/7.", "616"),
            ],
            "a": [
                _q("A parallelogram has an area of 105 cm² and a height of 7 cm. Find its base in cm.", "15"),
                _q("A trapezium has an area of 70 cm² and parallel sides of 12 cm and 8 cm. "
                   "Find its perpendicular height in cm.", "7"),
            ],
        },
    },
}


def bank_items(lesson_id: str, quiz_set: int):
    """Yields (level, level_code, index, item) for one lesson's quiz, in quiz order."""
    for code in ("r", "u", "a"):
        for i, item in enumerate(BANK[lesson_id][quiz_set][code], start=1):
            yield LEVEL_CODES[code], code, i, item
