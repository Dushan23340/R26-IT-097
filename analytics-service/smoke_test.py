import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from services.suggestion_engine import SuggestionEngine
from services.suggestion_generator import SuggestionGenerator

# Test generator with STU_008 (Declining Achiever)
payload = SuggestionEngine("STU_008").run()
generator = SuggestionGenerator(payload)
suggestion = generator.generate()

print("--- Generated Suggestion ---")
print("LLM Used  :", suggestion.llm_used)
print("Model     :", suggestion.llm_model)
print("\nTeacher   :", suggestion.teacher_suggestion)
print("\nStudent   :", suggestion.student_suggestion)
print("\nOutcome   :", suggestion.expected_outcome)