"""
lessons.py — Real per-lesson quiz content: genuine questions with correct
answers, difficulty, and Bloom's cognitive-level tags (not placeholder
stems like the old QUIZ_TEMPLATES in data.py).

Includes 6 Mathematics lessons whose ids (fractions-bodmas,
pythagorean-theorem, linear-equations, algebraic-fractions,
volume-capacity, number-patterns) are deliberately the same lesson_ids
tagged onto the real playable games in emotion-backend's game_catalog.py
(Fraction Room Rescue, Uncharted Waters, Equations Eco, Escape the Dark
Room, Fish Tank Shop, Pattern Islands respectively) - this is what lets
the Teacher Console's Game Recommendation Engine offer a game genuinely
related to the lesson the teacher picked, not just its subject.
"""

LESSONS = {
    "python-functions": {
        "title": "Python Functions",
        "subject": "Programming",
        "questions": [
            {
                "id": "pf-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "Which keyword is used to define a function in Python?",
                "options": ["func", "def", "function", "lambda"],
                "answer": "def",
            },
            {
                "id": "pf-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What does a function return by default if it has no return statement?",
                "options": ["0", "None", "an empty string", "an error"],
                "answer": "None",
            },
            {
                "id": "pf-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "What is the purpose of a default parameter value in a function?",
                "options": [
                    "It makes the parameter required",
                    "It provides a fallback value if the caller doesn't supply one",
                    "It converts the parameter to a string",
                    "It deletes the parameter after use",
                ],
                "answer": "It provides a fallback value if the caller doesn't supply one",
            },
            {
                "id": "pf-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "Why can using a mutable default argument (like a list) be risky?",
                "options": [
                    "It's shared across all calls unless explicitly reset",
                    "Python forbids mutable defaults",
                    "It slows down the function significantly",
                    "It cannot hold more than one item",
                ],
                "answer": "It's shared across all calls unless explicitly reset",
            },
            {
                "id": "pf-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "def add(a, b=10): return a + b. What does add(5) return?",
                "options": ["5", "10", "15", "TypeError"],
                "answer": "15",
            },
            {
                "id": "pf-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "def f(*args, **kwargs): pass. How would you call f with 1, 2 as positional and x=3 as keyword?",
                "options": ["f(1, 2, x=3)", "f([1, 2], {'x': 3})", "f(1, 2, 3)", "f(x=3, 1, 2)"],
                "answer": "f(1, 2, x=3)",
            },
            {
                "id": "pf-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "Two functions both compute a factorial, one recursive and one iterative. For very large n, which is more likely to fail first?",
                "options": ["The iterative version", "The recursive version, due to recursion depth limits", "Neither will fail", "Both fail identically"],
                "answer": "The recursive version, due to recursion depth limits",
            },
            {
                "id": "pf-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "A function modifies a list passed as an argument, and the caller sees the change outside the function. Why?",
                "options": [
                    "Python passes lists by value",
                    "Lists are mutable and passed by object reference",
                    "The function creates a global variable",
                    "This should never happen in Python",
                ],
                "answer": "Lists are mutable and passed by object reference",
            },
            {
                "id": "pf-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A colleague argues all functions should use **kwargs instead of named parameters for flexibility. What's the strongest counter-argument?",
                "options": [
                    "**kwargs is slower to type",
                    "Named parameters give clearer signatures, better error messages, and IDE support",
                    "Python doesn't allow more than 3 named parameters",
                    "There is no valid counter-argument",
                ],
                "answer": "Named parameters give clearer signatures, better error messages, and IDE support",
            },
            {
                "id": "pf-c1", "lo_level": "create", "difficulty": "hard",
                "question": "You need a function that logs every call to another function without modifying that function's code. What pattern would you design?",
                "options": ["A decorator", "A global variable", "A second copy of the function", "A try/except block"],
                "answer": "A decorator",
            },
        ],
    },
    "photosynthesis": {
        "title": "Photosynthesis",
        "subject": "Science",
        "questions": [
            {
                "id": "ph-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What gas do plants absorb from the atmosphere during photosynthesis?",
                "options": ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
                "answer": "Carbon dioxide",
            },
            {
                "id": "ph-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "In which cell organelle does photosynthesis take place?",
                "options": ["Mitochondria", "Nucleus", "Chloroplast", "Ribosome"],
                "answer": "Chloroplast",
            },
            {
                "id": "ph-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why do plants appear green?",
                "options": [
                    "Chlorophyll absorbs green light",
                    "Chlorophyll reflects green light and absorbs other wavelengths",
                    "Green is the only color plants can produce",
                    "Plants filter out all colors except green",
                ],
                "answer": "Chlorophyll reflects green light and absorbs other wavelengths",
            },
            {
                "id": "ph-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "What is the overall relationship between photosynthesis and cellular respiration?",
                "options": [
                    "They are unrelated processes",
                    "Photosynthesis produces the glucose and oxygen that respiration consumes",
                    "Respiration only happens in plants",
                    "Photosynthesis consumes glucose to make CO2",
                ],
                "answer": "Photosynthesis produces the glucose and oxygen that respiration consumes",
            },
            {
                "id": "ph-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "A plant is moved from bright sunlight to a dim room. What would you predict happens to its rate of photosynthesis?",
                "options": ["It increases", "It decreases", "It stays exactly the same", "Photosynthesis stops needing light entirely"],
                "answer": "It decreases",
            },
            {
                "id": "ph-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "If CO2 levels in a sealed greenhouse are experimentally doubled (with light/water non-limiting), what would you expect?",
                "options": [
                    "Photosynthesis rate increases, up to a saturation point",
                    "Photosynthesis stops entirely",
                    "The plant only performs respiration",
                    "No measurable change ever occurs",
                ],
                "answer": "Photosynthesis rate increases, up to a saturation point",
            },
            {
                "id": "ph-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A plant grown in blue-red LED light grows normally, but one grown only in pure green light grows poorly. Why?",
                "options": [
                    "Green light is toxic to plants",
                    "Chlorophyll poorly absorbs green wavelengths, so less light energy is captured",
                    "Plants cannot see green light",
                    "Green light contains no photons",
                ],
                "answer": "Chlorophyll poorly absorbs green wavelengths, so less light energy is captured",
            },
            {
                "id": "ph-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "During a drought, a plant closes its stomata to conserve water. What is the direct consequence for photosynthesis?",
                "options": [
                    "No effect - stomata are unrelated to photosynthesis",
                    "Reduced CO2 intake limits the rate of photosynthesis",
                    "Photosynthesis rate increases",
                    "The plant switches entirely to respiration",
                ],
                "answer": "Reduced CO2 intake limits the rate of photosynthesis",
            },
            {
                "id": "ph-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A farmer claims adding more fertilizer will always increase crop photosynthesis rate. What's the strongest critique?",
                "options": [
                    "Fertilizer has zero effect on plants",
                    "Photosynthesis is also limited by light, CO2, and water - fertilizer alone can't overcome those limits",
                    "Fertilizer only works on animals",
                    "There is no valid critique",
                ],
                "answer": "Photosynthesis is also limited by light, CO2, and water - fertilizer alone can't overcome those limits",
            },
            {
                "id": "ph-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a simple experiment to test whether light intensity affects the rate of photosynthesis in an aquatic plant.",
                "options": [
                    "Count bubbles released per minute at varying distances from a lamp",
                    "Measure the plant's height once, one time",
                    "Ask the plant to self-report",
                    "Weigh the pot before planting",
                ],
                "answer": "Count bubbles released per minute at varying distances from a lamp",
            },
        ],
    },
    "fractions-bodmas": {
        "title": "Fractions & BODMAS",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "fr-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What does the \"B\" in BODMAS stand for?",
                "options": ["Brackets", "Base", "Binary", "Boundary"],
                "answer": "Brackets",
            },
            {
                "id": "fr-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "In BODMAS, which operations share equal priority and are done left to right?",
                "options": ["Division and Multiplication", "Addition and Brackets", "Orders and Brackets", "Subtraction and Orders"],
                "answer": "Division and Multiplication",
            },
            {
                "id": "fr-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why do we need an order-of-operations rule like BODMAS?",
                "options": [
                    "So everyone gets the same answer for the same expression",
                    "To make expressions longer",
                    "Because calculators require it",
                    "It only matters for fractions",
                ],
                "answer": "So everyone gets the same answer for the same expression",
            },
            {
                "id": "fr-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "To add two fractions with different denominators, what must you do first?",
                "options": ["Multiply the numerators", "Find a common denominator", "Add the denominators directly", "Convert both to decimals"],
                "answer": "Find a common denominator",
            },
            {
                "id": "fr-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "Evaluate: 2 + 3 x (4 - 1)",
                "options": ["11", "15", "9", "5"],
                "answer": "11",
            },
            {
                "id": "fr-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "Simplify: 1/2 + 1/3",
                "options": ["5/6", "2/5", "1/6", "3/5"],
                "answer": "5/6",
            },
            {
                "id": "fr-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A student evaluates 6 / 2 x 3 and gets 1, but the correct BODMAS answer is 9. What mistake did they make?",
                "options": [
                    "They divided and multiplied in the wrong order (should go left to right)",
                    "They forgot brackets exist",
                    "6 / 2 x 3 has no correct answer",
                    "They used addition instead of division",
                ],
                "answer": "They divided and multiplied in the wrong order (should go left to right)",
            },
            {
                "id": "fr-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "Two students simplify 3/4 - 1/6 differently, one gets 7/12 and one gets 1/2. Which is correct and why?",
                "options": [
                    "7/12, because the common denominator of 4 and 6 is 12",
                    "1/2, because you can just subtract numerators",
                    "Both are correct",
                    "Neither is correct",
                ],
                "answer": "7/12, because the common denominator of 4 and 6 is 12",
            },
            {
                "id": "fr-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A classmate claims BODMAS means division always happens before multiplication because D comes before M in the acronym. What's the strongest critique?",
                "options": [
                    "The letter order doesn't dictate strict priority - division and multiplication have equal priority, done left to right",
                    "The claim is completely correct",
                    "Multiplication should always come first regardless",
                    "BODMAS doesn't apply to fractions",
                ],
                "answer": "The letter order doesn't dictate strict priority - division and multiplication have equal priority, done left to right",
            },
            {
                "id": "fr-c1", "lo_level": "create", "difficulty": "hard",
                "question": "You want to design a real-world word problem requiring both brackets and fraction addition to solve. Which scenario fits best?",
                "options": [
                    "A recipe needs (1/2 + 1/4) cups of flour for one batch - how much for 3 batches?",
                    "What is 5 + 5?",
                    "Convert 10 km to miles",
                    "List the first five prime numbers",
                ],
                "answer": "A recipe needs (1/2 + 1/4) cups of flour for one batch - how much for 3 batches?",
            },
        ],
    },
    "pythagorean-theorem": {
        "title": "Pythagorean Theorem",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "pt-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "In a right triangle, what is the longest side called?",
                "options": ["Hypotenuse", "Adjacent", "Opposite", "Base"],
                "answer": "Hypotenuse",
            },
            {
                "id": "pt-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What is the Pythagorean theorem formula?",
                "options": ["a^2 + b^2 = c^2", "a + b = c", "a^2 - b^2 = c^2", "a x b = c"],
                "answer": "a^2 + b^2 = c^2",
            },
            {
                "id": "pt-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why does the Pythagorean theorem only apply to right triangles?",
                "options": [
                    "The relationship a^2+b^2=c^2 is derived specifically from a 90-degree angle between the two legs",
                    "It applies to all triangles equally",
                    "It's a naming convention with no mathematical reason",
                    "It only works for equilateral triangles",
                ],
                "answer": "The relationship a^2+b^2=c^2 is derived specifically from a 90-degree angle between the two legs",
            },
            {
                "id": "pt-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "If you know the hypotenuse and one leg of a right triangle, how do you find the other leg?",
                "options": ["Rearrange to leg = sqrt(c^2 - a^2)", "Add the two known sides", "Divide the hypotenuse by 2", "It cannot be found"],
                "answer": "Rearrange to leg = sqrt(c^2 - a^2)",
            },
            {
                "id": "pt-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "A right triangle has legs of 3 and 4. What is the hypotenuse?",
                "options": ["5", "6", "7", "12"],
                "answer": "5",
            },
            {
                "id": "pt-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "A ladder leans against a wall, reaching 12m up, with its base 5m from the wall. How long is the ladder?",
                "options": ["13m", "17m", "7m", "60m"],
                "answer": "13m",
            },
            {
                "id": "pt-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A triangle has sides 5, 12, and 13. Is it a right triangle? How can you tell?",
                "options": [
                    "Yes, because 5^2 + 12^2 = 13^2",
                    "No, because 5 + 12 is not 13",
                    "Yes, because all sides are different lengths",
                    "Cannot be determined",
                ],
                "answer": "Yes, because 5^2 + 12^2 = 13^2",
            },
            {
                "id": "pt-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "A sailor uses the Pythagorean theorem to compute distance but consistently gets answers too large. What's the likely error?",
                "options": [
                    "They added the two legs instead of squaring, summing, then taking the square root",
                    "They used too many decimal places",
                    "The theorem is wrong for navigation",
                    "They measured in the wrong units only",
                ],
                "answer": "They added the two legs instead of squaring, summing, then taking the square root",
            },
            {
                "id": "pt-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A student argues the Pythagorean theorem can find the third side of ANY triangle, not just right triangles. What's the strongest counter-argument?",
                "options": [
                    "a^2+b^2=c^2 is only valid when the angle between a and b is exactly 90 degrees; other triangles need the Law of Cosines",
                    "The theorem works for any triangle without exception",
                    "Only equilateral triangles need a different formula",
                    "There is no valid counter-argument",
                ],
                "answer": "a^2+b^2=c^2 is only valid when the angle between a and b is exactly 90 degrees; other triangles need the Law of Cosines",
            },
            {
                "id": "pt-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a real-world scenario where the Pythagorean theorem would help find an unknown distance.",
                "options": [
                    "Finding the shortest diagonal path across a rectangular field instead of walking the two edges",
                    "Counting how many students are in a class",
                    "Finding the average of five numbers",
                    "Determining the color of a triangle",
                ],
                "answer": "Finding the shortest diagonal path across a rectangular field instead of walking the two edges",
            },
        ],
    },
    "linear-equations": {
        "title": "Linear Equations",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "le-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What does \"solving for x\" mean in an equation like 2x + 3 = 9?",
                "options": ["Finding the value of x that makes the equation true", "Finding the value of 2", "Removing x from the equation", "Making the equation longer"],
                "answer": "Finding the value of x that makes the equation true",
            },
            {
                "id": "le-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What operation undoes addition when isolating a variable?",
                "options": ["Subtraction", "Multiplication", "Division", "Exponentiation"],
                "answer": "Subtraction",
            },
            {
                "id": "le-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why must you perform the same operation on both sides of an equation?",
                "options": ["To keep the equation balanced/true", "Because it's a rule with no reason", "To make the equation longer", "It only matters for fractions"],
                "answer": "To keep the equation balanced/true",
            },
            {
                "id": "le-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "What does it mean if solving an equation results in \"0 = 0\"?",
                "options": [
                    "The equation is true for all values of x (infinite solutions)",
                    "There is no solution",
                    "x = 0",
                    "The equation was written incorrectly",
                ],
                "answer": "The equation is true for all values of x (infinite solutions)",
            },
            {
                "id": "le-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "Solve: 3x - 5 = 10",
                "options": ["x = 5", "x = 3", "x = 15", "x = 1.67"],
                "answer": "x = 5",
            },
            {
                "id": "le-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "Solve: 2(x + 3) = 4x - 2",
                "options": ["x = 4", "x = 2", "x = 1", "x = -4"],
                "answer": "x = 4",
            },
            {
                "id": "le-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A student solves 5x = 20 and gets x = 100 by multiplying both sides by 5 instead of dividing. What's the error?",
                "options": [
                    "They used the inverse operation incorrectly - multiplication instead of division",
                    "The answer is actually correct",
                    "5x = 20 has no solution",
                    "They should have added 5 instead",
                ],
                "answer": "They used the inverse operation incorrectly - multiplication instead of division",
            },
            {
                "id": "le-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "Two students solve x/2 + 3 = 7 differently. One gets x = 8, the other gets x = 20. Which is correct and why?",
                "options": [
                    "x = 8, because subtracting 3 first gives x/2 = 4, then multiplying by 2 gives x = 8",
                    "x = 20, because you multiply everything by 2 first without subtracting",
                    "Both are correct",
                    "Neither is correct",
                ],
                "answer": "x = 8, because subtracting 3 first gives x/2 = 4, then multiplying by 2 gives x = 8",
            },
            {
                "id": "le-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A classmate claims you can always solve an equation by guessing and checking rather than using algebraic steps. What's the strongest critique?",
                "options": [
                    "Guessing doesn't scale to equations with large or non-integer solutions and is inefficient",
                    "Guessing is always faster",
                    "Algebraic steps are never necessary",
                    "There's no downside to guessing",
                ],
                "answer": "Guessing doesn't scale to equations with large or non-integer solutions and is inefficient",
            },
            {
                "id": "le-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a word problem that requires setting up and solving a linear equation to find an unknown cost.",
                "options": [
                    "A taxi charges a $3 flat fee plus $2 per km. If a ride costs $15, how many km was it?",
                    "What is 3 + 2?",
                    "List all even numbers under 20",
                    "What color is the taxi?",
                ],
                "answer": "A taxi charges a $3 flat fee plus $2 per km. If a ride costs $15, how many km was it?",
            },
        ],
    },
    "algebraic-fractions": {
        "title": "Algebraic Fractions",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "af-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What is an algebraic fraction?",
                "options": ["A fraction that contains a variable in the numerator, denominator, or both", "A fraction with only numbers", "A whole number", "A fraction with no denominator"],
                "answer": "A fraction that contains a variable in the numerator, denominator, or both",
            },
            {
                "id": "af-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What value must be excluded from the domain of x/(x-2)?",
                "options": ["x = 2", "x = 0", "x = -2", "x = 1"],
                "answer": "x = 2",
            },
            {
                "id": "af-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why can't the denominator of an algebraic fraction equal zero?",
                "options": ["Division by zero is undefined", "It makes the fraction negative", "It's just a convention with no reason", "Zero denominators simplify the fraction"],
                "answer": "Division by zero is undefined",
            },
            {
                "id": "af-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "To simplify (x^2 - 4)/(x - 2), what technique helps?",
                "options": [
                    "Factor the numerator as a difference of squares, then cancel the common factor",
                    "Divide term by term without factoring",
                    "Multiply both parts by 2",
                    "It cannot be simplified",
                ],
                "answer": "Factor the numerator as a difference of squares, then cancel the common factor",
            },
            {
                "id": "af-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "Simplify: (x^2 - 4)/(x - 2)",
                "options": ["x + 2", "x - 2", "x^2 - 2", "2x"],
                "answer": "x + 2",
            },
            {
                "id": "af-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "Simplify: (3x)/(6x^2)",
                "options": ["1/(2x)", "1/2x^2", "3/6x", "2/x"],
                "answer": "1/(2x)",
            },
            {
                "id": "af-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A student simplifies (x+2)/(x+4) by cancelling the \"x\" terms to get 2/4 = 1/2. What's wrong with this?",
                "options": [
                    "You can only cancel common factors, not individual terms added together",
                    "The answer is actually correct",
                    "The denominator should have been x-4",
                    "Algebraic fractions cannot be simplified at all",
                ],
                "answer": "You can only cancel common factors, not individual terms added together",
            },
            {
                "id": "af-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "Why does (x^2 - 9)/(x - 3) simplify to x + 3, but only for x not equal to 3?",
                "options": [
                    "Because factoring cancels (x-3), but the original expression is undefined at x=3, so that restriction must remain",
                    "Because x=3 makes the answer negative",
                    "There is no restriction needed",
                    "Because 9 is a perfect square",
                ],
                "answer": "Because factoring cancels (x-3), but the original expression is undefined at x=3, so that restriction must remain",
            },
            {
                "id": "af-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A classmate claims you can always cancel any matching term that appears in both numerator and denominator. What's the strongest critique?",
                "options": [
                    "Only common factors (multiplied terms) can be cancelled, not terms that are added or subtracted",
                    "The claim is entirely correct",
                    "Cancelling never changes the value of a fraction",
                    "Algebraic fractions don't follow normal fraction rules",
                ],
                "answer": "Only common factors (multiplied terms) can be cancelled, not terms that are added or subtracted",
            },
            {
                "id": "af-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a simplification problem that requires factoring a difference of squares before cancelling.",
                "options": ["Simplify (x^2 - 16)/(x - 4)", "Simplify 5/10", "Add 1/2 + 1/2", "Solve x + 4 = 10"],
                "answer": "Simplify (x^2 - 16)/(x - 4)",
            },
        ],
    },
    "volume-capacity": {
        "title": "Volume & Capacity",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "vc-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "What is the formula for the volume of a rectangular box (cuboid)?",
                "options": ["length x breadth x height", "length + breadth + height", "2(length + breadth)", "length x breadth"],
                "answer": "length x breadth x height",
            },
            {
                "id": "vc-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "How many cm3 are in 1 litre?",
                "options": ["1000", "100", "10", "1"],
                "answer": "1000",
            },
            {
                "id": "vc-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why is volume measured in cubic units (like cm3)?",
                "options": [
                    "Because it represents three dimensions multiplied together (length x breadth x height)",
                    "Because it's a rule with no reason",
                    "Cubic units only apply to cubes",
                    "Volume is always measured in litres only",
                ],
                "answer": "Because it represents three dimensions multiplied together (length x breadth x height)",
            },
            {
                "id": "vc-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "What's the relationship between cm3 and litres when reporting a container's capacity?",
                "options": [
                    "Divide the cm3 value by 1000 to convert to litres",
                    "Multiply the cm3 value by 1000 to convert to litres",
                    "They are unrelated units",
                    "Litres are always smaller than cm3",
                ],
                "answer": "Divide the cm3 value by 1000 to convert to litres",
            },
            {
                "id": "vc-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "A fish tank is 40cm x 25cm x 30cm. What is its volume in cm3?",
                "options": ["30000", "3000", "950", "95"],
                "answer": "30000",
            },
            {
                "id": "vc-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "A tank has a volume of 45000 cm3. How many litres of water does it hold?",
                "options": ["45", "4.5", "450", "4500"],
                "answer": "45",
            },
            {
                "id": "vc-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "Two tanks have the same volume but different dimensions - one tall and narrow, the other short and wide. Why can they hold the same amount of water?",
                "options": [
                    "Volume depends on the product of all three dimensions, not their individual shape",
                    "Only height determines capacity",
                    "Wider tanks always hold more regardless of height",
                    "They cannot actually hold the same amount",
                ],
                "answer": "Volume depends on the product of all three dimensions, not their individual shape",
            },
            {
                "id": "vc-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "A shop sells a tank advertised as \"50 litres\" but a customer calculates its dimensions give 45000 cm3. What should the customer conclude?",
                "options": [
                    "The advertised capacity is wrong - 45000 cm3 equals 45 litres, not 50",
                    "The advertisement is correct because litres and cm3 aren't comparable",
                    "The tank must be a different shape than measured",
                    "There's no way to check this",
                ],
                "answer": "The advertised capacity is wrong - 45000 cm3 equals 45 litres, not 50",
            },
            {
                "id": "vc-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A customer claims doubling a tank's height alone will double its capacity, but doubling its length won't. What's the strongest critique?",
                "options": [
                    "Doubling ANY single dimension (length, breadth, or height) doubles the volume equally, since volume is their product",
                    "The claim is completely correct",
                    "Only width matters for capacity",
                    "Doubling any dimension quadruples volume",
                ],
                "answer": "Doubling ANY single dimension (length, breadth, or height) doubles the volume equally, since volume is their product",
            },
            {
                "id": "vc-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a real-world task that requires calculating volume and converting to litres to solve.",
                "options": [
                    "Determine how many litres of water are needed to fill a fish tank of given length, breadth, and height",
                    "Count how many fish are in the tank",
                    "Measure the temperature of the water",
                    "List fish species suitable for the tank",
                ],
                "answer": "Determine how many litres of water are needed to fill a fish tank of given length, breadth, and height",
            },
        ],
    },
    "number-patterns": {
        "title": "Number Patterns",
        "subject": "Mathematics",
        "questions": [
            {
                "id": "np-r1", "lo_level": "remember", "difficulty": "easy",
                "question": "In the sequence 2, 5, 8, 11, ..., what is the common difference?",
                "options": ["3", "2", "5", "4"],
                "answer": "3",
            },
            {
                "id": "np-r2", "lo_level": "remember", "difficulty": "easy",
                "question": "What does \"Tn\" typically represent in a number pattern?",
                "options": ["The general (nth) term of the sequence", "The total of all terms", "The first term only", "The number of terms"],
                "answer": "The general (nth) term of the sequence",
            },
            {
                "id": "np-u1", "lo_level": "understand", "difficulty": "easy",
                "question": "Why is finding the general term Tn useful for a sequence?",
                "options": [
                    "It lets you find any term directly without listing every previous term",
                    "It only works for the first term",
                    "It replaces the need for sequences entirely",
                    "It only applies to even-numbered sequences",
                ],
                "answer": "It lets you find any term directly without listing every previous term",
            },
            {
                "id": "np-u2", "lo_level": "understand", "difficulty": "medium",
                "question": "For an arithmetic sequence with first term a and common difference d, what is the general formula for Tn?",
                "options": ["Tn = a + (n-1)d", "Tn = a x d x n", "Tn = a + n", "Tn = a - (n-1)d"],
                "answer": "Tn = a + (n-1)d",
            },
            {
                "id": "np-a1", "lo_level": "apply", "difficulty": "medium",
                "question": "For the sequence 4, 7, 10, 13, ..., what is the 10th term?",
                "options": ["31", "28", "34", "25"],
                "answer": "31",
            },
            {
                "id": "np-a2", "lo_level": "apply", "difficulty": "hard",
                "question": "A sequence has Tn = 3n - 2. What is T7?",
                "options": ["19", "21", "17", "23"],
                "answer": "19",
            },
            {
                "id": "np-n1", "lo_level": "analyze", "difficulty": "medium",
                "question": "A student thinks the sequence 1, 4, 9, 16, ... has a constant common difference. Why is this wrong?",
                "options": [
                    "The differences between terms (3, 5, 7...) increase, so it's not arithmetic - it's a squared-number pattern",
                    "The common difference is actually 3 for all terms",
                    "All sequences have a constant difference",
                    "The sequence is decreasing",
                ],
                "answer": "The differences between terms (3, 5, 7...) increase, so it's not arithmetic - it's a squared-number pattern",
            },
            {
                "id": "np-n2", "lo_level": "analyze", "difficulty": "hard",
                "question": "Given Tn = 2n + 1, a student claims T0 = 1 is a valid term of a sequence starting at n=1. What's the issue?",
                "options": [
                    "If the sequence starts at n=1, then n=0 is outside its defined domain and isn't a valid term",
                    "T0 is always the first term of any sequence",
                    "There is no issue, T0 is correct",
                    "The formula is wrong",
                ],
                "answer": "If the sequence starts at n=1, then n=0 is outside its defined domain and isn't a valid term",
            },
            {
                "id": "np-e1", "lo_level": "evaluate", "difficulty": "hard",
                "question": "A classmate claims that any three numbers can be extended into a unique valid number pattern. What's the strongest critique?",
                "options": [
                    "Multiple different patterns/rules can fit the same three numbers, so the \"next\" term isn't uniquely determined without more info",
                    "Three numbers always uniquely determine a pattern",
                    "Patterns require at least ten numbers to exist",
                    "There's no valid critique",
                ],
                "answer": "Multiple different patterns/rules can fit the same three numbers, so the \"next\" term isn't uniquely determined without more info",
            },
            {
                "id": "np-c1", "lo_level": "create", "difficulty": "hard",
                "question": "Design a number pattern puzzle where students must find both the common difference and the general term Tn.",
                "options": [
                    "Given the sequence 6, 11, 16, 21, find the common difference and write a formula for the nth term",
                    "List the first five prime numbers",
                    "What is 6 + 11?",
                    "Draw a picture of a number line",
                ],
                "answer": "Given the sequence 6, 11, 16, 21, find the common difference and write a formula for the nth term",
            },
        ],
    },
}


def get_lesson(lesson_id):
    return LESSONS.get(lesson_id)


def list_lessons():
    return [
        {"lesson_id": lid, "title": l["title"], "subject": l["subject"], "question_count": len(l["questions"])}
        for lid, l in LESSONS.items()
    ]


def get_quiz_for_lesson(lesson_id):
    """Question + options only - the answer key never goes to the client."""
    lesson = get_lesson(lesson_id)
    if not lesson:
        return None
    return {
        "lesson_id": lesson_id,
        "title": lesson["title"],
        "subject": lesson["subject"],
        "questions": [
            {"id": q["id"], "lo_level": q["lo_level"], "difficulty": q["difficulty"],
             "question": q["question"], "options": q["options"]}
            for q in lesson["questions"]
        ],
    }
