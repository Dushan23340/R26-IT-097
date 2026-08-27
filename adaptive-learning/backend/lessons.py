"""
lessons.py — Real per-lesson quiz content: genuine questions with correct
answers, difficulty, and Bloom's cognitive-level tags (not placeholder
stems like the old QUIZ_TEMPLATES in data.py).

Only 6 lessons now (number-patterns, fractions-bodmas, area-of-shapes,
binary-numbers, percentages, sets) - narrowed from the original 10
quiz.pdf lessons down to exactly the ones covered by
validated_recommendations.py's teacher-validated (lesson x emotion)
video table, per explicit instruction. pythagorean-theorem,
circumference-of-a-circle, data-representation-and-interpretation, and
angles-of-a-polygon were removed entirely (not just their resources) -
quiz_gen's generator/solvers/templates for those 4 were removed too, see
quiz_gen/*.py. Each remaining lesson still sources verbatim from the
project's quiz.pdf reference document, 18 questions each (3 per Bloom
level).

fractions-bodmas, area-of-shapes, and number-patterns are deliberately
the same lesson_ids tagged onto real playable games in emotion-backend's
game_catalog.py (Fraction Room Rescue, Fish Tank Shop, Pattern Islands) -
this is what lets the Teacher Console's Game Recommendation Engine offer
a game genuinely related to the lesson the teacher picked, not just its
subject. pythagorean-theorem was ALSO tagged onto a game ("Uncharted
Waters") before this lesson was removed - that game's lesson_id is now
dangling (the game itself still works, just the lesson cross-link is
gone), same known side-effect as the earlier 8-lesson removal.
"""

LESSONS = {
    "fractions-bodmas": {
        "title": "Fractions & BODMAS",
        "subject": "Mathematics",
        "questions": [
            {"id": "fr-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the reciprocal of 3/8?",
             "answer": "8/3", "answer_type": "fraction"},
            {"id": "fr-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the mixed number equivalent of the improper fraction 11/8? Answer in the form 'a b/c'.",
             "answer": "1 3/8", "answer_type": "fraction"},
            {"id": "fr-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "In the BODMAS rule, what does the 'O' stand for?",
             "answer": "Of", "accepted_answers": ["order", "orders", "of or order"]},
            {"id": "fr-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "'1/2 of 1/3' means 1/2 ___ 1/3. Fill in the blank with the correct operation symbol.",
             "answer": "x", "accepted_answers": ["×", "*", "multiplication"]},
            {"id": "fr-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "5/3 is called an improper fraction because the numerator is ___ than the denominator. Fill in the blank.",
             "answer": "greater", "accepted_answers": ["bigger", "larger"]},
            {"id": "fr-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What operation replaces the word 'of' in fraction expressions?",
             "answer": "Multiplication", "accepted_answers": ["multiply", "times", "x", "×"]},
            {"id": "fr-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Simplify: 1/2 x 4/7",
             "answer": "2/7", "answer_type": "fraction"},
            {"id": "fr-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Simplify: 3/7 + 2/7",
             "answer": "5/7", "answer_type": "fraction"},
            {"id": "fr-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Simplify: 6/7 / 3",
             "answer": "2/7", "answer_type": "fraction"},
            {"id": "fr-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Simplify: 2/3 of 4/5",
             "answer": "8/15", "answer_type": "fraction"},
            {"id": "fr-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Simplify: 1/4 + 2/3 - 5/6",
             "answer": "1/12", "answer_type": "fraction"},
            {"id": "fr-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Simplify: 1 1/2 / 2 1/4",
             "answer": "2/3", "answer_type": "fraction"},
            {"id": "fr-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is 1/2 of 2/3 equal to 1/3? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "fr-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is 3 3/10 x 2 1/3 = 7 7/10? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "fr-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Which is greater: 2/3 of 3/4, or 3/4 of 2/3? Answer 'Equal' if they are the same.",
             "answer": "Equal", "accepted_answers": ["both are equal", "same", "neither"]},
            {"id": "fr-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Simplify using BODMAS: 5/6 / 7/18 of 2/3 x 3/4",
             "answer": "15/14", "answer_type": "fraction"},
            {"id": "fr-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "A person spends 1/4 of his income on food and 1/2 on business. What fraction does he save?",
             "answer": "1/4", "answer_type": "fraction"},
            {"id": "fr-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "A father gives 1/2 of his land to his son and 1/3 to his daughter. The son then donates 1/5 of his portion. What fraction of the TOTAL land did the son donate?",
             "answer": "1/10", "answer_type": "fraction"},
        ],
    },
    "number-patterns": {
        "title": "Number Patterns",
        "subject": "Mathematics",
        "questions": [
            {"id": "np-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the term used for the numbers in a number pattern?",
             "answer": "Terms", "accepted_answers": ["term"]},
            {"id": "np-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the common difference of the sequence 5, 8, 11, 14, ...?",
             "answer": "3"},
            {"id": "np-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "Write the first three terms of the sequence with general term Tn = 2n + 5.",
             "answer": "7, 9, 11", "accepted_answers": ["7,9,11", "7,9, 11"]},
            {"id": "np-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What does Tn represent in a sequence? Answer with a short phrase.",
             "answer": "the nth term", "accepted_answers": ["nth term", "general term", "n-th term", "the general term"]},
            {"id": "np-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the common difference of the sequence 10, 7, 4, 1, ...?",
             "answer": "-3"},
            {"id": "np-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "True or False: A sequence's first five terms alone always uniquely determine every later term.",
             "answer": "False"},
            {"id": "np-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Find the 12th term of Tn = 7n + 1.",
             "answer": "85"},
            {"id": "np-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Which term of the sequence Tn = 4n - 3 is equal to 97?",
             "answer": "25th term", "accepted_answers": ["25", "term 25", "the 25th term"]},
            {"id": "np-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Find the 10th term of Tn = 50 - 7n.",
             "answer": "-20"},
            {"id": "np-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Is 0 a term of the sequence Tn = 56 - 4n? If yes, give the term number.",
             "answer": "14", "accepted_answers": ["yes, 14", "yes 14", "14th term"]},
            {"id": "np-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Is 18 a term of the sequence Tn = 56 - 4n? Answer Yes or No.",
             "answer": "No"},
            {"id": "np-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "What is the common difference of the sequence 22, 19, 16, 13, ...?",
             "answer": "-3"},
            {"id": "np-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is 75 a term of the sequence Tn = 4n - 3? Answer Yes or No.",
             "answer": "No"},
            {"id": "np-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Does the sequence 1, 1, 2, 2, 3, 3, ... have a constant common difference? Answer Yes or No.",
             "answer": "No"},
            {"id": "np-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "After which term do all terms become negative in Tn = 50 - 7n? Give the term number.",
             "answer": "7"},
            {"id": "np-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Write the first 5 terms of a sequence with first term 20 and common difference -5.",
             "answer": "20, 15, 10, 5, 0", "accepted_answers": ["20,15,10,5,0"]},
            {"id": "np-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Find the general term of the sequence 9, 17, 25, 33, ...",
             "answer": "Tn = 8n + 1", "accepted_answers": ["8n+1", "8n + 1", "tn=8n+1"]},
            {"id": "np-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Find the 20th term of the sequence 9, 17, 25, 33, ...",
             "answer": "161"},
        ],
    },
    "area-of-shapes": {
        "title": "Area",
        "subject": "Mathematics",
        "questions": [
            {"id": "ar-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the formula for the area of a parallelogram?",
             "answer": "base x height", "accepted_answers": ["base × height", "base times height", "b x h"]},
            {"id": "ar-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the formula for the area of a trapezium? Answer in the form '1/2 x (sum of parallel sides) x height'.",
             "answer": "1/2 x (sum of parallel sides) x height", "accepted_answers": ["½ x (sum of parallel sides) x height", "0.5 x (sum of parallel sides) x height"]},
            {"id": "ar-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the formula for the area of a circle?",
             "answer": "πr^2", "accepted_answers": ["pi r^2", "pi*r^2", "πr²", "pir^2"]},
            {"id": "ar-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the perpendicular height corresponding to base AB of a parallelogram?",
             "answer": "The perpendicular distance between AB and the side parallel to it", "accepted_answers": ["perpendicular distance between ab and dc", "the perpendicular distance between the two parallel sides"]},
            {"id": "ar-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "True or False: The area of a trapezium can be found by drawing a diagonal to split it into two triangles with the same height.",
             "answer": "True"},
            {"id": "ar-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "Why does the area formula for a parallelogram use base x height (not half)? Answer in one short phrase.",
             "answer": "It can be rearranged into a rectangle of the same base and height", "accepted_answers": ["a parallelogram can be rearranged into a rectangle of the same base and height"]},
            {"id": "ar-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Find the area of a parallelogram with base 10 cm and height 5 cm.",
             "answer": "50", "accepted_answers": ["50 cm2", "50cm2", "50 cm^2"]},
            {"id": "ar-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Find the area of a trapezium with parallel sides 11 cm and 6 cm and height 8 cm.",
             "answer": "68", "accepted_answers": ["68 cm2", "68cm2"]},
            {"id": "ar-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Find the area of a circle of radius 14 cm. (Use π = 22/7)",
             "answer": "616", "accepted_answers": ["616 cm2", "616cm2"]},
            {"id": "ar-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "The area of a parallelogram is 48 cm2 with base 8 cm. Find its height.",
             "answer": "6", "accepted_answers": ["6 cm", "6cm"]},
            {"id": "ar-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "The area of a trapezium is 70 cm2 with parallel sides 12 cm and 8 cm. Find its height.",
             "answer": "7", "accepted_answers": ["7 cm", "7cm"]},
            {"id": "ar-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "A circle has area 154 cm2. Find its radius. (Use π = 22/7)",
             "answer": "7", "accepted_answers": ["7 cm", "7cm"]},
            {"id": "ar-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is the area of a parallelogram with base 7 cm and height 4 cm equal to 28 cm2? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "ar-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "A trapezium has parallel sides 10 cm and 6 cm with height 5 cm. Is its area 40 cm2? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "ar-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "A circle of radius 7 cm has area greater than 150 cm2. Is this true? Answer Yes or No. (Use π = 22/7)",
             "answer": "Yes"},
            {"id": "ar-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "The side view of a wall is a trapezium with parallel sides 8 m and 5 m and height 4 m. Find its area.",
             "answer": "26", "accepted_answers": ["26 m2", "26m2"]},
            {"id": "ar-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "A rectangular lamina of length 70 cm and width 14 cm is used to cut circular laminas of radius 7 cm. Find the maximum number of circles that can be cut.",
             "answer": "5"},
            {"id": "ar-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Find the area of the shaded part of a figure where a circle of radius 7 cm is inscribed in a square of side 14 cm. (Use π = 22/7)",
             "answer": "42", "accepted_answers": ["42 cm2", "42cm2"]},
        ],
    },
    "binary-numbers": {
        "title": "Binary Numbers",
        "subject": "Mathematics",
        "questions": [
            {"id": "bn-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What are the only two digits used in the binary number system?",
             "answer": "0 and 1", "accepted_answers": ["0,1", "0 1", "zero and one"]},
            {"id": "bn-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the place value of the leftmost digit in the binary number 101100? Answer as a plain number.",
             "answer": "32", "accepted_answers": ["2^5"]},
            {"id": "bn-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "Write the decimal number 13 as a binary number.",
             "answer": "1101"},
            {"id": "bn-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the base of the binary number system?",
             "answer": "2", "accepted_answers": ["base 2"]},
            {"id": "bn-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "Why is 10 (binary) equal to 2 in decimal? Answer as a sum of powers of 2, e.g. '1x2^1 + 0x2^0'.",
             "answer": "1x2^1 + 0x2^0", "accepted_answers": ["1x2^1+0x2^0"]},
            {"id": "bn-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the result of 1 (binary) + 1 (binary)? Answer in binary.",
             "answer": "10"},
            {"id": "bn-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Convert 101 (binary) to a decimal number.",
             "answer": "5"},
            {"id": "bn-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Convert the decimal number 22 to a binary number.",
             "answer": "10110"},
            {"id": "bn-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "Add (in binary): 101 + 10",
             "answer": "111"},
            {"id": "bn-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Convert 1101 (binary) to decimal by expanding in powers of 2. Give the decimal value.",
             "answer": "13"},
            {"id": "bn-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Add (in binary): 11101 + 1101",
             "answer": "101010"},
            {"id": "bn-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Subtract (in binary): 110 - 1",
             "answer": "101"},
            {"id": "bn-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Verify whether 10011 - 1100 = 111 (all in binary) is correct. Answer Yes or No.",
             "answer": "Yes"},
            {"id": "bn-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is 1101 + 111 = 10100 (all in binary) correct? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "bn-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Which is larger: 1010 (binary) or 12 (decimal)? Answer '1010' or '12'.",
             "answer": "12"},
            {"id": "bn-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Write the next binary number after 111.",
             "answer": "1000"},
            {"id": "bn-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Convert 49 (decimal) to binary, then subtract 32 (decimal, converted to binary). Give the answer in binary.",
             "answer": "10001"},
            {"id": "bn-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Add (in binary): 1110 + 111 + 1",
             "answer": "10110"},
        ],
    },
    "percentages": {
        "title": "Percentages",
        "subject": "Mathematics",
        "questions": [
            {"id": "pc-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the formula for calculating profit?",
             "answer": "Profit = Selling Price - Cost Price", "accepted_answers": ["selling price - cost price", "sp - cp"]},
            {"id": "pc-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the formula for calculating loss percentage?",
             "answer": "Loss% = (Loss / Cost Price) x 100%", "accepted_answers": ["(loss/cost price)x100%", "loss/cost price x 100"]},
            {"id": "pc-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the amount reduced from the marked price called?",
             "answer": "Discount"},
            {"id": "pc-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "When does a seller incur a loss?",
             "answer": "When the selling price is less than the cost price", "accepted_answers": ["when selling price < cost price", "selling price is lower than cost price"]},
            {"id": "pc-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What does a discount of 20% mean?",
             "answer": "20% is reduced from the marked price", "accepted_answers": ["20% off the marked price", "20 percent reduced from marked price"]},
            {"id": "pc-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is a commission?",
             "answer": "A fee charged by a broker for facilitating a sale", "accepted_answers": ["a percentage fee charged by a broker for a sale", "fee for facilitating a sale"]},
            {"id": "pc-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "A vendor buys a pair of trousers for Rs 500 and sells it for Rs 650. Calculate the profit.",
             "answer": "Rs 150", "accepted_answers": ["150", "rs150", "rs. 150", "rs 150"]},
            {"id": "pc-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "An electric iron worth Rs 2500 is sold for Rs 2300. Calculate the loss.",
             "answer": "Rs 200", "accepted_answers": ["200", "rs200", "rs 200"]},
            {"id": "pc-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "A discount of 5% is offered on a TV of marked price Rs 25,000. Calculate the discount amount.",
             "answer": "Rs 1250", "accepted_answers": ["1250", "rs1250", "rs 1,250", "rs 1250"]},
            {"id": "pc-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "A vendor buys exercise books at Rs 25 each and sells at Rs 30 each. Calculate the profit percentage.",
             "answer": "20%", "accepted_answers": ["20", "20 percent"]},
            {"id": "pc-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "A pair of trousers bought for Rs 500 is sold at Rs 450. Calculate the loss percentage.",
             "answer": "10%", "accepted_answers": ["10", "10 percent"]},
            {"id": "pc-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "A carpenter makes a table for Rs 4000 and sells it for Rs 5600. Calculate the profit percentage.",
             "answer": "40%", "accepted_answers": ["40", "40 percent"]},
            {"id": "pc-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Which is more profitable: selling at Rs 900 an item bought for Rs 800, or selling at Rs 2600 an item bought for Rs 2500? Answer 'First' or 'Second'.",
             "answer": "First"},
            {"id": "pc-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "A vendor buys 100 mangoes at Rs 18 each, discards 20 spoilt ones, and sells the rest at Rs 30 each. Did he earn a profit or a loss? Answer 'Profit' or 'Loss'.",
             "answer": "Profit"},
            {"id": "pc-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Verify: if a bicycle worth Rs 12,000 is sold at a loss of 10%, is the selling price Rs 10,800? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "pc-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "If a profit of 10% is earned by selling a TV for Rs 22,000, what was its cost price?",
             "answer": "Rs 20000", "accepted_answers": ["20000", "rs20000", "rs 20,000", "rs 20000"]},
            {"id": "pc-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "A vendor buys 50 kg of onions at Rs 60/kg, sells 30 kg at Rs 80/kg. He must sell the remaining 20 kg at what price per kg to make no profit and no loss?",
             "answer": "Rs 30/kg", "accepted_answers": ["30", "rs30", "rs 30", "30 per kg"]},
            {"id": "pc-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "A shop offers an 8% discount on Rs 1,500 shoes. Another offers Rs 100 off on purchases over Rs 1,000. Which is better for the customer? Answer 'Shop A' or 'Shop B'.",
             "answer": "Shop A"},
        ],
    },
    "sets": {
        "title": "Sets",
        "subject": "Mathematics",
        "questions": [
            {"id": "st-r1", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is a set?",
             "answer": "A collection of items that can be clearly identified", "accepted_answers": ["a collection of clearly identified items", "a well-defined collection of objects"]},
            {"id": "st-r2", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the symbol used to denote the universal set?",
             "answer": "ε", "accepted_answers": ["u", "epsilon"]},
            {"id": "st-r3", "lo_level": "remember", "difficulty": "easy", "set": 1,
             "question": "What is the null set?",
             "answer": "A set with no elements", "accepted_answers": ["empty set", "a set with no elements", "{}", "φ"]},
            {"id": "st-u1", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the difference between a finite set and an infinite set?",
             "answer": "A finite set has a specific number of elements; an infinite set has an endless number of elements", "accepted_answers": ["finite has a limited number of elements, infinite does not"]},
            {"id": "st-u2", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the intersection of two sets?",
             "answer": "The set of elements common to both sets", "accepted_answers": ["elements common to both sets", "a ∩ b"]},
            {"id": "st-u3", "lo_level": "understand", "difficulty": "easy", "set": 1,
             "question": "What is the complement of a set A?",
             "answer": "The set of elements in the universal set which are not in A", "accepted_answers": ["elements not in a", "a'"]},
            {"id": "st-a1", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "If A = {2, 4, 6, 8} and B = {1, 2, 3, 4}, find A ∩ B.",
             "answer": "{2, 4}", "accepted_answers": ["{2,4}", "2,4", "2, 4"]},
            {"id": "st-a2", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "If A = {1, 3, 5, 7} and B = {2, 4, 6, 8}, find A ∪ B.",
             "answer": "{1, 2, 3, 4, 5, 6, 7, 8}", "accepted_answers": ["{1,2,3,4,5,6,7,8}", "1,2,3,4,5,6,7,8"]},
            {"id": "st-a3", "lo_level": "apply", "difficulty": "medium", "set": 1,
             "question": "If ε = {1, 2, 3, 4, 5, 6, 7} and A = {2, 4, 6}, find A'.",
             "answer": "{1, 3, 5, 7}", "accepted_answers": ["{1,3,5,7}", "1,3,5,7"]},
            {"id": "st-n1", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "P = {prime numbers between 0 and 10}, Q = {odd numbers between 0 and 15}. Find P ∩ Q.",
             "answer": "{3, 5, 7}", "accepted_answers": ["{3,5,7}", "3,5,7"]},
            {"id": "st-n2", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "If set A has 4 elements and set B also has 4 elements but different elements, are they equal sets or equivalent sets?",
             "answer": "Equivalent sets", "accepted_answers": ["equivalent"]},
            {"id": "st-n3", "lo_level": "analyze", "difficulty": "medium", "set": 1,
             "question": "Write all subsets of the set X = {1, 2}.",
             "answer": "{}, {1}, {2}, {1, 2}", "accepted_answers": ["{},{1},{2},{1,2}", "empty set, {1}, {2}, {1,2}"]},
            {"id": "st-e1", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is {red} a subset of {colours of the rainbow}? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "st-e2", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Are sets A = {even numbers between 0 and 10} and B = {digits of 48268} equal sets? Answer Yes or No.",
             "answer": "Yes"},
            {"id": "st-e3", "lo_level": "evaluate", "difficulty": "hard", "set": 1,
             "question": "Is {cylinder} a subset of {polygons}? Answer Yes or No.",
             "answer": "No"},
            {"id": "st-c1", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Write the elements of D = {whole numbers between 5 and 10}.",
             "answer": "{6, 7, 8, 9}", "accepted_answers": ["{6,7,8,9}", "6,7,8,9"]},
            {"id": "st-c2", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Express the null set in descriptive form using a common characteristic, e.g. '{even numbers between 1 and 2}'.",
             "answer": "{even numbers between 1 and 2}", "accepted_answers": ["{prime numbers between 10 and 12}", "even numbers between 1 and 2", "prime numbers between 10 and 12"]},
            {"id": "st-c3", "lo_level": "create", "difficulty": "hard", "set": 1,
             "question": "Given ε = {1,2,3,4,5,6,7,8}, P = {2,4,6}, Q = {1,5,8}. Find P ∪ Q.",
             "answer": "{1, 2, 4, 5, 6, 8}", "accepted_answers": ["{1,2,4,5,6,8}", "1,2,4,5,6,8"]},
        ],
    },
}


def get_lesson(lesson_id):
    return LESSONS.get(lesson_id)


def list_lessons():
    return [
        {
            "lesson_id": lid,
            "title": l["title"],
            "subject": l["subject"],
            # Count for quiz_set 1 specifically (what a student actually
            # sees on their first attempt), not the full question bank -
            # pilot-format lessons have a second, equally-sized retake set
            # that would otherwise double this number.
            "question_count": sum(1 for q in l["questions"] if q.get("set", 1) == 1),
        }
        for lid, l in LESSONS.items()
    ]


# Curriculum-judgment difficulty tag per lesson (easy/medium/hard), used by
# IT22197146's analytics-service for its "lesson difficulty vs achievement"
# analysis (learning_sessions.difficulty). Deliberately NOT derived from the
# quiz questions' own per-LO-level difficulty tags above - every lesson has
# an identical 6-easy/6-medium/6-hard Bloom-level split, so that would give
# every lesson the same value and make the analysis meaningless. This is a
# genuine, distinguishing per-lesson judgment instead.
LESSON_DIFFICULTY = {
    "percentages": "easy",
    "number-patterns": "medium",
    "fractions-bodmas": "medium",
    "area-of-shapes": "medium",
    "binary-numbers": "hard",
    "sets": "hard",
}


def get_lesson_difficulty(lesson_id):
    return LESSON_DIFFICULTY.get(lesson_id)


def get_quiz_for_lesson(lesson_id, quiz_set=1):
    """Question (+ options, for legacy MCQ lessons) only - the answer key
    never goes to the client. Lessons not yet migrated to the free-text
    pilot format have no "set" field on their questions at all - treated as
    set 1 implicitly, so requesting quiz_set=2 against one of them falls
    back to returning its one and only set rather than an empty quiz."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        return None

    questions = [q for q in lesson["questions"] if q.get("set", 1) == quiz_set]
    if not questions and quiz_set != 1:
        questions = [q for q in lesson["questions"] if q.get("set", 1) == 1]
        quiz_set = 1

    return {
        "lesson_id": lesson_id,
        "title": lesson["title"],
        "subject": lesson["subject"],
        "quiz_set": quiz_set,
        "questions": [
            {
                "id": q["id"], "lo_level": q["lo_level"], "difficulty": q["difficulty"],
                "question": q["question"],
                **({"options": q["options"]} if "options" in q else {}),
            }
            for q in questions
        ],
    }
