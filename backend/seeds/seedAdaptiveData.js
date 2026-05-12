import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test";
const DB_NAME = process.env.MONGODB_DB_NAME || "test";

// Quiz data for all 6 quizzes (3 units × Q1/Q2)
const quizData = [
  // ============================================
  // UNIT: Number Patterns — Q1
  // ============================================
  {
    unit: "Number Patterns",
    quizSet: "Q1",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "In a number pattern, each individual number is called a ___.", options: ["term", "sequence", "pattern", "digit"], correctIndex: 0, explanation: "Each individual number in a sequence is called a term." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "The constant difference between two consecutive terms is called the ___ ___.", options: ["common difference", "common factor", "term value", "sequence gap"], correctIndex: 0, explanation: "The constant difference between consecutive terms is the common difference." },
      { questionNumber: 3, bloomLevel: "Remembering", text: "The general term of a sequence is represented by the symbol ___.", options: ["Tₙ", "Sₙ", "aₙ", "nₜ"], correctIndex: 0, explanation: "The general term is typically represented as Tₙ where n is the position." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "If the common difference is positive, the terms will ___ in value.", options: ["increase", "decrease", "stay the same", "alternate"], correctIndex: 0, explanation: "A positive common difference means each term is larger than the previous." },
      { questionNumber: 5, bloomLevel: "Understanding", text: "The sequence 5, 8, 11, 14, … has a common difference of ___.", options: ["3", "5", "2", "4"], correctIndex: 0, explanation: "The difference between consecutive terms: 8-5=3, 11-8=3, etc." },
      { questionNumber: 6, bloomLevel: "Understanding", text: "For Tₙ = 3n + 1, the 4th term is ___.", options: ["13", "10", "16", "7"], correctIndex: 0, explanation: "T₄ = 3(4) + 1 = 12 + 1 = 13" },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "If Tₙ = 4n − 1, the 10th term is ___.", options: ["39", "41", "35", "43"], correctIndex: 0, explanation: "T₁₀ = 4(10) − 1 = 40 − 1 = 39" },
      { questionNumber: 8, bloomLevel: "Applying", text: "The first three terms of Tₙ = 50 − 3n are ___.", options: ["47, 44, 41", "50, 47, 44", "47, 50, 53", "44, 47, 50"], correctIndex: 0, explanation: "T₁=47, T₂=44, T₃=41" },
      { questionNumber: 9, bloomLevel: "Applying", text: "The 15th term of the sequence 2, 6, 10, 14, … is ___.", options: ["58", "54", "62", "56"], correctIndex: 0, explanation: "Common difference is 4. T₁₅ = 2 + 14(4) = 58" },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "For the sequence 20, 17, 14, 11, …, the nth term Tₙ = ___.", options: ["23 − 3n", "20 − 3n", "3n + 20", "20 + 3n"], correctIndex: 0, explanation: "Common difference is -3. T₁ = 20 = 23-3(1), so Tₙ = 23−3n" },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "If Tₙ = 60 − 4n, the term that equals 0 is the ___th term.", options: ["15", "12", "20", "10"], correctIndex: 0, explanation: "0 = 60−4n ⟹ 4n = 60 ⟹ n = 15" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "The sequences 3, 7, 11, 15, … and 5, 9, 13, 17, … both have the same ___.", options: ["common difference", "first term", "general term", "sum"], correctIndex: 0, explanation: "Both have common difference 4." },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "For 4, 9, 14, 19, … the general term Tₙ = 5n − 1 is ___ (substituting n=1 gives ___).", options: ["correct, 4", "incorrect, 4", "correct, 5", "incorrect, 9"], correctIndex: 0, explanation: "T₁ = 5(1)−1 = 4 ✓. The formula is correct." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "The sequence 1, 4, 9, 16, … ___ have a constant common difference.", options: ["does not", "does", "sometimes does", "always does"], correctIndex: 0, explanation: "These are perfect squares (1², 2², 3², 4²). Differences are 3, 5, 7 — not constant." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "The 20th term of Tₙ = 6n − 5 compared to Tₙ = 5n + 10 is ___.", options: ["greater", "less", "equal", "cannot determine"], correctIndex: 0, explanation: "First: 6(20)−5=115. Second: 5(20)+10=110. 115 > 110." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "General term for first term 8 and common difference 5: Tₙ = ___.", options: ["5n + 3", "5n + 8", "8n + 5", "3n + 5"], correctIndex: 0, explanation: "Tₙ = 8 + (n−1)×5 = 8+5n−5 = 5n+3" },
      { questionNumber: 17, bloomLevel: "Creating", text: "Sequence starting at 100 decreasing by 7 each time: Tₙ = ___.", options: ["107 − 7n", "100 − 7n", "7n + 100", "100 + 7n"], correctIndex: 0, explanation: "Tₙ = 100 + (n−1)×(−7) = 100−7n+7 = 107−7n" },
      { questionNumber: 18, bloomLevel: "Creating", text: "Sequence with first term 3 and common difference 4. First three terms: ___.", options: ["3, 7, 11", "3, 4, 7", "3, 6, 9", "4, 7, 10"], correctIndex: 0, explanation: "T₁=3, T₂=3+4=7, T₃=7+4=11" },
    ],
  },
  // ============================================
  // UNIT: Number Patterns — Q2
  // ============================================
  {
    unit: "Number Patterns",
    quizSet: "Q2",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "The first term of a sequence is usually denoted by ___.", options: ["T₁", "T₀", "a₁", "S₁"], correctIndex: 0, explanation: "The first term is denoted as T₁ in standard notation." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "In the sequence 10, 20, 30, 40, …, the common difference is ___.", options: ["10", "20", "5", "30"], correctIndex: 0, explanation: "The difference between consecutive terms is 10." },
      { questionNumber: 3, bloomLevel: "Remembering", text: "The three dots (…) at the end of a sequence indicate that the pattern ___.", options: ["continues", "ends", "repeats once", "stops"], correctIndex: 0, explanation: "The ellipsis (…) indicates the pattern continues indefinitely." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "If the common difference is negative, the terms will ___ in value.", options: ["decrease", "increase", "stay constant", "alternate"], correctIndex: 0, explanation: "A negative common difference means each term is smaller." },
      { questionNumber: 5, bloomLevel: "Understanding", text: "The sequence 12, 15, 18, 21, … is obtained by adding ___ to the previous term.", options: ["3", "12", "6", "9"], correctIndex: 0, explanation: "15-12=3, 18-15=3, so the common difference is 3." },
      { questionNumber: 6, bloomLevel: "Understanding", text: "The general term Tₙ = 7n + 2, the 3rd term is ___.", options: ["23", "21", "25", "14"], correctIndex: 0, explanation: "T₃ = 7(3) + 2 = 21 + 2 = 23" },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "If Tₙ = 8n − 3, the 7th term is ___.", options: ["53", "56", "50", "47"], correctIndex: 0, explanation: "T₇ = 8(7) − 3 = 56 − 3 = 53" },
      { questionNumber: 8, bloomLevel: "Applying", text: "The first three terms of Tₙ = 5n + 2 are ___.", options: ["7, 12, 17", "5, 7, 12", "7, 9, 12", "2, 7, 12"], correctIndex: 0, explanation: "T₁=7, T₂=12, T₃=17" },
      { questionNumber: 9, bloomLevel: "Applying", text: "The 12th term of the sequence 7, 10, 13, 16, … is ___.", options: ["40", "37", "43", "34"], correctIndex: 0, explanation: "Common difference is 3. T₁₂ = 7 + 11(3) = 40" },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "For the sequence 50, 46, 42, 38, …, Tₙ = ___.", options: ["54 − 4n", "50 − 4n", "4n + 50", "50 + 4n"], correctIndex: 0, explanation: "Common difference is -4. T₁ = 50 = 54-4(1), so Tₙ = 54−4n" },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "If Tₙ = 80 − 5n, the term that equals 20 is the ___th term.", options: ["12", "16", "10", "15"], correctIndex: 0, explanation: "20 = 80−5n ⟹ 5n = 60 ⟹ n = 12" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "The sequences 2, 5, 8, 11, … and 6, 9, 12, 15, … both have the same ___.", options: ["common difference", "first term", "sum", "general term"], correctIndex: 0, explanation: "Both have common difference 3." },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "For 6, 11, 16, 21, … the general term Tₙ = 5n + 1 is ___ (substituting n=1 gives ___).", options: ["correct, 6", "incorrect, 6", "correct, 5", "incorrect, 11"], correctIndex: 0, explanation: "T₁ = 5(1)+1 = 6 ✓. The formula is correct." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "The sequence 2, 4, 8, 16, … has a constant common difference. This statement is ___.", options: ["false", "true", "sometimes true", "cannot determine"], correctIndex: 0, explanation: "These are powers of 2. Differences are 2, 4, 8 — not constant." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "The 10th term of Tₙ = 3n + 5 compared to Tₙ = 4n + 2 is ___.", options: ["less", "greater", "equal", "cannot determine"], correctIndex: 0, explanation: "First: 3(10)+5=35. Second: 4(10)+2=42. 35 < 42." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "General term for first term 12 and common difference 7: Tₙ = ___.", options: ["7n + 5", "7n + 12", "12n + 7", "5n + 7"], correctIndex: 0, explanation: "Tₙ = 12 + (n−1)×7 = 7n+5" },
      { questionNumber: 17, bloomLevel: "Creating", text: "Sequence starting at 200 decreasing by 12 each time: Tₙ = ___.", options: ["212 − 12n", "200 − 12n", "12n + 200", "200 + 12n"], correctIndex: 0, explanation: "Tₙ = 200 + (n−1)×(−12) = 212−12n" },
      { questionNumber: 18, bloomLevel: "Creating", text: "Sequence with first term 5 and common difference 6. First three terms: ___.", options: ["5, 11, 17", "5, 6, 11", "5, 10, 15", "6, 11, 17"], correctIndex: 0, explanation: "T₁=5, T₂=11, T₃=17" },
    ],
  },
  // ============================================
  // UNIT: Fractions — Q1
  // ============================================
  {
    unit: "Fractions",
    quizSet: "Q1",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "A fraction where the numerator is smaller than the denominator is called a ___ fraction.", options: ["proper", "improper", "mixed", "whole"], correctIndex: 0, explanation: "A proper fraction has numerator < denominator." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "A number consisting of a whole number and a proper fraction is called a ___.", options: ["mixed number", "proper fraction", "improper fraction", "whole number"], correctIndex: 0, explanation: "A mixed number combines a whole number and a fraction." },
      { questionNumber: 3, bloomLevel: "Remembering", text: "The reciprocal of ¾ is ___.", options: ["4/3", "3/4", "1/3", "1/4"], correctIndex: 0, explanation: "The reciprocal of a/b is b/a. Reciprocal of 3/4 is 4/3." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "The improper fraction equivalent to 2⅗ is ___.", options: ["13/5", "11/5", "12/5", "15/5"], correctIndex: 0, explanation: "2⅗ = (2×5 + 3)/5 = 13/5" },
      { questionNumber: 5, bloomLevel: "Understanding", text: "The mixed number equivalent to 11/4 is ___.", options: ["2¾", "3¼", "2½", "3¾"], correctIndex: 0, explanation: "11÷4 = 2 remainder 3, so 11/4 = 2¾" },
      { questionNumber: 6, bloomLevel: "Understanding", text: "The product of a number and its reciprocal is always ___.", options: ["1", "0", "2", "the number itself"], correctIndex: 0, explanation: "a × (1/a) = 1" },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "The value of ⅔ of 90 rupees is ___ rupees.", options: ["60", "45", "30", "72"], correctIndex: 0, explanation: "⅔ × 90 = 60" },
      { questionNumber: 8, bloomLevel: "Applying", text: "¾ ÷ ⅖ = ¾ × ___.", options: ["5/2", "2/5", "4/3", "3/2"], correctIndex: 0, explanation: "Dividing by a fraction means multiplying by its reciprocal." },
      { questionNumber: 9, bloomLevel: "Applying", text: "If one pizza is divided equally among 8 people, each person gets ___ of the pizza.", options: ["1/8", "1/4", "1/6", "1/3"], correctIndex: 0, explanation: "One pizza divided by 8 people = 1/8 per person." },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "In ½ + ⅔ × ¾, according to BODMAS the operation performed first is ___.", options: ["multiplication", "addition", "division", "subtraction"], correctIndex: 0, explanation: "BODMAS: Brackets, Orders, Division/Multiplication, Addition/Subtraction." },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "The fraction 12/18 in its simplest form is ___.", options: ["2/3", "3/4", "1/2", "4/6"], correctIndex: 0, explanation: "GCD(12,18) = 6. 12/18 = 2/3" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "Between ⅔ and ¾, the larger fraction is ___.", options: ["3/4", "2/3", "they are equal", "cannot determine"], correctIndex: 0, explanation: "⅔ = 8/12, ¾ = 9/12. 9/12 > 8/12" },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "The statement '⅔ of ¾ = ½' is ___.", options: ["true", "false", "sometimes true", "cannot determine"], correctIndex: 0, explanation: "⅔ × ¾ = 2/4 = ½. Statement is true." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "⅝ + ¼ = 6/12 = ½. This simplification is ___.", options: ["incorrect", "correct", "partially correct", "undefined"], correctIndex: 0, explanation: "⅝ + ¼ = 5/8 + 2/8 = 7/8 ≠ ½. The simplification is incorrect." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "The reciprocal of 1⅔ is 5/3. This statement is ___.", options: ["false", "true", "partially true", "undefined"], correctIndex: 0, explanation: "1⅔ = 5/3. Reciprocal of 5/3 is 3/5 ≠ 5/3. False." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "An expression using 'of' that equals ¼ × ⅔ is ___.", options: ["¼ of ⅔", "¼ + ⅔", "¼ ÷ ⅔", "⅔ − ¼"], correctIndex: 0, explanation: "'Of' in fractions means multiplication." },
      { questionNumber: 17, bloomLevel: "Creating", text: "A fraction division problem where the answer is ⅖: ___.", options: ["2/5 ÷ 1", "4/5 ÷ 2", "2/5 × 1", "1 ÷ 5/2"], correctIndex: 0, explanation: "1 ÷ 5/2 = 1 × 2/5 = 2/5" },
      { questionNumber: 18, bloomLevel: "Creating", text: "A mixed number between 1½ and 2 is ___.", options: ["1¾", "1¼", "2¼", "1⅛"], correctIndex: 0, explanation: "1¾ = 1.75 is between 1.5 and 2." },
    ],
  },
  // ============================================
  // UNIT: Fractions — Q2
  // ============================================
  {
    unit: "Fractions",
    quizSet: "Q2",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "A fraction where the numerator is greater than the denominator is called an ___ fraction.", options: ["improper", "proper", "mixed", "complex"], correctIndex: 0, explanation: "An improper fraction has numerator ≥ denominator." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "The reciprocal of 5/7 is ___.", options: ["7/5", "5/7", "1/5", "2/7"], correctIndex: 0, explanation: "Reciprocal of 5/7 is 7/5." },
      { questionNumber: 3, bloomLevel: "Remembering", text: "In the fraction ⅜, the number 8 is called the ___.", options: ["denominator", "numerator", "quotient", "factor"], correctIndex: 0, explanation: "The denominator is the bottom number of a fraction." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "The mixed number equivalent to 17/5 is ___.", options: ["3⅖", "2⅗", "3⅗", "4⅕"], correctIndex: 0, explanation: "17÷5 = 3 remainder 2, so 17/5 = 3⅖" },
      { questionNumber: 5, bloomLevel: "Understanding", text: "The improper fraction equivalent to 3⅖ is ___.", options: ["17/5", "13/5", "18/5", "15/5"], correctIndex: 0, explanation: "3⅖ = (3×5 + 2)/5 = 17/5" },
      { questionNumber: 6, bloomLevel: "Understanding", text: "The product of ⅔ and its reciprocal is ___.", options: ["1", "2/3", "3/2", "0"], correctIndex: 0, explanation: "⅔ × 3/2 = 1" },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "¾ of 120 rupees is ___ rupees.", options: ["90", "80", "60", "100"], correctIndex: 0, explanation: "¾ × 120 = 90" },
      { questionNumber: 8, bloomLevel: "Applying", text: "⅚ ÷ ⅔ = ⅚ × ___.", options: ["3/2", "2/3", "6/5", "5/6"], correctIndex: 0, explanation: "Divide by a fraction = multiply by its reciprocal." },
      { questionNumber: 9, bloomLevel: "Applying", text: "2½ × 1⅗ = ___.", options: ["4", "3½", "5", "3"], correctIndex: 0, explanation: "2½ × 1⅗ = 5/2 × 8/5 = 4" },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "In ⅓ + ¾ × ⅖, the operation performed first according to BODMAS is ___.", options: ["multiplication", "addition", "subtraction", "division"], correctIndex: 0, explanation: "Multiplication before addition." },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "The fraction 24/36 in its simplest form is ___.", options: ["2/3", "3/4", "4/6", "1/2"], correctIndex: 0, explanation: "GCD(24,36) = 12. 24/36 = 2/3" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "Between ⅝ and ⅔, the larger fraction is ___.", options: ["2/3", "5/8", "they are equal", "cannot determine"], correctIndex: 0, explanation: "⅝ = 15/24, ⅔ = 16/24. ⅔ > ⅝" },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "⅖ + ⅓ = 3/8. This statement is ___.", options: ["false", "true", "partially true", "undefined"], correctIndex: 0, explanation: "⅖ + ⅓ = 6/15 + 5/15 = 11/15 ≠ 3/8. False." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "4/7 of 14/15 = 8/15. This statement is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "4/7 × 14/15 = 56/105 = 8/15. True." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "The reciprocal of 2⅓ is 3/7. This statement is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "2⅓ = 7/3. Reciprocal is 3/7. True." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "An expression using 'of' equal to ⅓ × ⅘ is ___.", options: ["⅓ of ⅘", "⅘ of ⅓", "⅓ + ⅘", "⅓ ÷ ⅘"], correctIndex: 0, explanation: "'Of' means multiplication." },
      { questionNumber: 17, bloomLevel: "Creating", text: "A fraction addition problem where the answer is 5/6 is ___.", options: ["1/2 + 1/3", "1/3 + 1/4", "2/3 + 1/4", "1/4 + 2/3"], correctIndex: 0, explanation: "1/2 + 1/3 = 3/6 + 2/6 = 5/6" },
      { questionNumber: 18, bloomLevel: "Creating", text: "Two fractions equivalent to ⅖ are ___.", options: ["4/10 and 6/15", "2/10 and 4/20", "4/5 and 8/10", "1/5 and 3/15"], correctIndex: 0, explanation: "⅖ = 4/10 = 6/15" },
    ],
  },
  // ============================================
  // UNIT: Percentages — Q1
  // ============================================
  {
    unit: "Percentages",
    quizSet: "Q1",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "If the selling price is greater than the cost price, the seller earns a ___.", options: ["profit", "loss", "discount", "markup"], correctIndex: 0, explanation: "Profit occurs when selling price > cost price." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "The formula for profit percentage is: profit ÷ ___ × 100%.", options: ["cost price", "selling price", "marked price", "discount"], correctIndex: 0, explanation: "Profit % = (Profit / Cost Price) × 100" },
      { questionNumber: 3, bloomLevel: "Remembering", text: "The amount reduced from the marked price is called the ___.", options: ["discount", "profit", "loss", "markup"], correctIndex: 0, explanation: "A discount is a reduction from the marked price." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "If cost price is Rs 500 and selling price is Rs 450, the loss percentage is ___.", options: ["10%", "5%", "15%", "20%"], correctIndex: 0, explanation: "Loss = 500-450 = 50. Loss% = (50/500)×100 = 10%" },
      { questionNumber: 5, bloomLevel: "Understanding", text: "A discount of 10% on a marked price of Rs 2000 means the customer pays Rs ___.", options: ["1800", "1600", "2000", "1900"], correctIndex: 0, explanation: "Discount = 10% of 2000 = 200. SP = 2000-200 = 1800" },
      { questionNumber: 6, bloomLevel: "Understanding", text: "The marked price of an item is the price at which the item is ___ to be sold.", options: ["expected", "bought", "discounted", "manufactured"], correctIndex: 0, explanation: "Marked price is the expected/list price before discounts." },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "A vendor buys 100 mangoes at Rs 15 each and sells at Rs 18 each. Total profit is Rs ___.", options: ["300", "150", "200", "450"], correctIndex: 0, explanation: "Profit per mango = 18-15 = 3. Total = 100×3 = 300" },
      { questionNumber: 8, bloomLevel: "Applying", text: "A book marked at Rs 800 is sold at a 5% discount. The selling price is Rs ___.", options: ["760", "800", "740", "780"], correctIndex: 0, explanation: "Discount = 5% of 800 = 40. SP = 800-40 = 760" },
      { questionNumber: 9, bloomLevel: "Applying", text: "A shopkeeper buys a chair for Rs 1200 and sells it at a 15% profit. Selling price is Rs ___.", options: ["1380", "1320", "1400", "1200"], correctIndex: 0, explanation: "Profit = 15% of 1200 = 180. SP = 1200+180 = 1380" },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "An item bought for Rs 250 and sold for Rs 300. The profit percentage is ___.", options: ["20%", "25%", "15%", "10%"], correctIndex: 0, explanation: "Profit = 300-250 = 50. Profit% = (50/250)×100 = 20%" },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "An item sold for Rs 680 at a loss of 15%. The cost price is Rs ___.", options: ["800", "760", "850", "900"], correctIndex: 0, explanation: "SP = CP×(1-0.15) = CP×0.85. 680 = CP×0.85, CP = 800" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "A TV marked at Rs 25,000 sold at 12% discount. Discount amount is Rs ___.", options: ["3000", "2500", "2000", "4000"], correctIndex: 0, explanation: "Discount = 12% of 25000 = 3000" },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "A vendor buys for Rs 400, sells for Rs 500. Profit % is 25%. This is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "Profit = 500-400 = 100. Profit% = (100/400)×100 = 25%. True." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "20% discount on Rs 1500 gives selling price Rs 1300. This is ___.", options: ["incorrect", "correct", "partially correct", "undefined"], correctIndex: 0, explanation: "20% of 1500 = 300. SP = 1500-300 = 1200 ≠ 1300. Incorrect." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "Selling for Rs 2000 at 25% profit means cost price is Rs 1500. This is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "SP = CP×1.25. 2000 = CP×1.25, CP = 1600 ≠ 1500. False." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "The formula for loss percentage in words is ___.", options: ["loss ÷ cost price × 100%", "loss ÷ selling price × 100%", "cost price ÷ loss × 100%", "selling price ÷ loss × 100%"], correctIndex: 0, explanation: "Loss% = (Loss / Cost Price) × 100" },
      { questionNumber: 17, bloomLevel: "Creating", text: "Someone earns 10% profit selling for Rs 1100. The cost price is Rs ___.", options: ["1000", "990", "1100", "900"], correctIndex: 0, explanation: "SP = CP×1.10. 1100 = CP×1.10, CP = 1000" },
      { questionNumber: 18, bloomLevel: "Creating", text: "15% discount on Rs x. Expression for the selling price is ___.", options: ["x × 85/100", "x × 15/100", "x − 15", "x × 115/100"], correctIndex: 0, explanation: "SP = x - 0.15x = 0.85x = x × 85/100" },
    ],
  },
  // ============================================
  // UNIT: Percentages — Q2
  // ============================================
  {
    unit: "Percentages",
    quizSet: "Q2",
    isActive: true,
    questions: [
      // Remembering
      { questionNumber: 1, bloomLevel: "Remembering", text: "The amount a seller earns when selling price > cost price is called ___.", options: ["profit", "loss", "discount", "interest"], correctIndex: 0, explanation: "Profit is the gain from a transaction." },
      { questionNumber: 2, bloomLevel: "Remembering", text: "The formula for loss percentage is: loss ÷ ___ × 100%.", options: ["cost price", "selling price", "marked price", "profit"], correctIndex: 0, explanation: "Loss% = (Loss / Cost Price) × 100" },
      { questionNumber: 3, bloomLevel: "Remembering", text: "The reduction given on the marked price of an item is called the ___.", options: ["discount", "profit", "loss", "rebate"], correctIndex: 0, explanation: "A discount is a reduction from the marked price." },
      // Understanding
      { questionNumber: 4, bloomLevel: "Understanding", text: "Cost price Rs 800, selling price Rs 720. Loss percentage is ___.", options: ["10%", "8%", "12%", "15%"], correctIndex: 0, explanation: "Loss = 800-720 = 80. Loss% = (80/800)×100 = 10%" },
      { questionNumber: 5, bloomLevel: "Understanding", text: "15% discount on Rs 2000 means customer pays Rs ___.", options: ["1700", "1800", "1500", "1600"], correctIndex: 0, explanation: "Discount = 15% of 2000 = 300. SP = 2000-300 = 1700" },
      { questionNumber: 6, bloomLevel: "Understanding", text: "Marked price Rs 1200, sold at 10% profit. Selling price is Rs ___.", options: ["1320", "1200", "1080", "1400"], correctIndex: 0, explanation: "Profit = 10% of 1200 = 120. SP = 1200+120 = 1320" },
      // Applying
      { questionNumber: 7, bloomLevel: "Applying", text: "50 oranges bought at Rs 10 each, sold at Rs 12 each. Total profit is Rs ___.", options: ["100", "50", "150", "200"], correctIndex: 0, explanation: "Profit per orange = 12-10 = 2. Total = 50×2 = 100" },
      { questionNumber: 8, bloomLevel: "Applying", text: "Book marked at Rs 500, sold at 8% discount. Selling price is Rs ___.", options: ["460", "450", "480", "440"], correctIndex: 0, explanation: "Discount = 8% of 500 = 40. SP = 500-40 = 460" },
      { questionNumber: 9, bloomLevel: "Applying", text: "Fan bought for Rs 2000, sold at 25% profit. Selling price is Rs ___.", options: ["2500", "2250", "2400", "1600"], correctIndex: 0, explanation: "Profit = 25% of 2000 = 500. SP = 2000+500 = 2500" },
      // Analyzing
      { questionNumber: 10, bloomLevel: "Analyzing", text: "Item bought for Rs 400, sold for Rs 480. Profit percentage is ___.", options: ["20%", "15%", "25%", "10%"], correctIndex: 0, explanation: "Profit = 480-400 = 80. Profit% = (80/400)×100 = 20%" },
      { questionNumber: 11, bloomLevel: "Analyzing", text: "Item sold for Rs 850 at 15% loss. Cost price is Rs ___.", options: ["1000", "850", "950", "900"], correctIndex: 0, explanation: "SP = CP×0.85. 850 = CP×0.85, CP = 1000" },
      { questionNumber: 12, bloomLevel: "Analyzing", text: "Watch marked at Rs 8000 sold at 12% discount. Discount amount is Rs ___.", options: ["960", "800", "1200", "600"], correctIndex: 0, explanation: "Discount = 12% of 8000 = 960" },
      // Evaluating
      { questionNumber: 13, bloomLevel: "Evaluating", text: "Buys for Rs 600, sells for Rs 750. Profit % is 20%. This is ___.", options: ["false", "true", "partially true", "undefined"], correctIndex: 0, explanation: "Profit = 150. Profit% = (150/600)×100 = 25% ≠ 20%. False." },
      { questionNumber: 14, bloomLevel: "Evaluating", text: "25% discount on Rs 1200 gives selling price Rs 900. This is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "25% of 1200 = 300. SP = 1200-300 = 900. True." },
      { questionNumber: 15, bloomLevel: "Evaluating", text: "Selling for Rs 2750 at 10% profit means cost price is Rs 2500. This is ___.", options: ["true", "false", "partially true", "undefined"], correctIndex: 0, explanation: "SP = CP×1.10. 2750 = CP×1.10, CP = 2500. True." },
      // Creating
      { questionNumber: 16, bloomLevel: "Creating", text: "The formula for profit percentage in words is ___.", options: ["profit ÷ cost price × 100%", "profit ÷ selling price × 100%", "selling price ÷ profit × 100%", "cost price ÷ profit × 100%"], correctIndex: 0, explanation: "Profit% = (Profit / Cost Price) × 100" },
      { questionNumber: 17, bloomLevel: "Creating", text: "Someone earns 20% profit selling for Rs 1200. The cost price is Rs ___.", options: ["1000", "960", "1100", "800"], correctIndex: 0, explanation: "SP = CP×1.20. 1200 = CP×1.20, CP = 1000" },
      { questionNumber: 18, bloomLevel: "Creating", text: "12% discount on Rs x. Expression for the selling price is ___.", options: ["x × 88/100", "x × 12/100", "x − 12", "x × 112/100"], correctIndex: 0, explanation: "SP = x - 0.12x = 0.88x = x × 88/100" },
    ],
  },
];

// Emotions and resources template
const emotions = ["Happy", "Normal", "Confused", "Bored", "Frustrated", "Angry"];
const bloomLevels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];
const units = ["Number Patterns", "Fractions", "Percentages"];

// Helper function to generate dummy resources
function generateResources(unit, bloomLevel, emotion) {
  const types = ["video", "reading", "quiz", "interactive"];
  const videoUrls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=9bZkp7q19f0",
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  ];
  const readingUrls = [
    "https://www.khanacademy.org/math",
    "https://www.bbc.co.uk/bitesize/collections/maths-guides",
    "https://www.mathsisfun.com",
  ];

  const emotionNotes = {
    Happy: "You're doing great! This resource will help you explore even deeper.",
    Normal: "Here's a clear resource to help you understand this concept better.",
    Confused: "Take it step by step. Watch the videos first, then try the interactive part.",
    Bored: "Ready for a challenge? This resource has some advanced applications.",
    Frustrated: "Don't worry, this is broken down into simple steps. You can do this!",
    Angry: "Let's take a short, focused approach. You've got this.",
  };

  const resources = [
    {
      id: `${unit.replace(/\s+/g, "-").toLowerCase()}-${bloomLevel.toLowerCase()}-${emotion.toLowerCase()}-1`,
      type: types[0],
      title: `${bloomLevel} Level Mastery for ${unit}`,
      url: videoUrls[Math.floor(Math.random() * videoUrls.length)],
      duration_min: 5 + Math.floor(Math.random() * 10),
      notes: emotionNotes[emotion] || "A helpful resource to support your learning.",
      difficulty: emotion === "Bored" ? "hard" : emotion === "Confused" ? "easy" : "medium",
    },
    {
      id: `${unit.replace(/\s+/g, "-").toLowerCase()}-${bloomLevel.toLowerCase()}-${emotion.toLowerCase()}-2`,
      type: types[1],
      title: `Detailed Notes: ${bloomLevel} Concepts in ${unit}`,
      url: readingUrls[Math.floor(Math.random() * readingUrls.length)],
      duration_min: 10 + Math.floor(Math.random() * 15),
      notes: emotionNotes[emotion] || "A supportive guide for understanding.",
      difficulty: emotion === "Bored" ? "hard" : emotion === "Confused" ? "easy" : "medium",
    },
    {
      id: `${unit.replace(/\s+/g, "-").toLowerCase()}-${bloomLevel.toLowerCase()}-${emotion.toLowerCase()}-3`,
      type: types[2],
      title: `Practice Quiz: ${bloomLevel} Skills`,
      url: "https://quizlet.com/dummy/practice-quiz",
      duration_min: 8,
      notes: emotionNotes[emotion] || "Test your understanding with this practice.",
      difficulty: emotion === "Bored" ? "hard" : emotion === "Confused" ? "easy" : "medium",
    },
  ];

  return resources;
}

async function seedDatabase() {
  try {
    console.log("🌱 Connecting to MongoDB...");
    const connectOptions = {};
    if (!MONGODB_URI.includes("/test")) {
      connectOptions.dbName = DB_NAME;
    }
    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;

    // Drop and recreate quizzes collection
    console.log("🗑️  Dropping quizzes collection...");
    try {
      await db.collection("quizzes").drop();
    } catch (e) {
      // Collection might not exist yet
    }

    console.log("📝 Seeding quizzes collection...");
    await db.collection("quizzes").insertMany(quizData);
    console.log(`✅ Seeded ${quizData.length} quizzes`);

    // Drop and recreate recommendations collection
    console.log("🗑️  Dropping recommendations collection...");
    try {
      await db.collection("recommendations").drop();
    } catch (e) {
      // Collection might not exist yet
    }

    console.log("📚 Seeding recommendations collection...");
    const recommendations = [];
    for (const unit of units) {
      for (const bloomLevel of bloomLevels) {
        for (const emotion of emotions) {
          recommendations.push({
            unit,
            bloomLevel,
            emotion,
            resources: generateResources(unit, bloomLevel, emotion),
          });
        }
      }
    }
    await db.collection("recommendations").insertMany(recommendations);
    console.log(`✅ Seeded ${recommendations.length} recommendation documents (3 units × 6 bloom × 6 emotions)`);

    // Create quizattempts collection with indexes
    console.log("🗂️  Creating quizattempts collection with indexes...");
    try {
      await db.collection("quizattempts").drop();
    } catch (e) {
      // Collection might not exist yet
    }
    await db.createCollection("quizattempts");
    await db.collection("quizattempts").createIndex({ studentId: 1, createdAt: -1 });
    await db.collection("quizattempts").createIndex({ unit: 1, quizSet: 1 });
    console.log("✅ Created quizattempts collection with indexes");

    console.log("\n✨ Database seeding complete!");
    console.log(`📊 Summary:`);
    console.log(`   - Quizzes: 6 (3 units × Q1/Q2)`);
    console.log(`   - Questions per quiz: 18`);
    console.log(`   - Recommendations: 108 (3 units × 6 bloom × 6 emotions)`);
    console.log(`   - Resources per recommendation: 3`);
    console.log(`\n🎉 All collections ready for adaptive learning!`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB\n");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
