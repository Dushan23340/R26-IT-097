"""
recommendation.py — Learning Outcome Scoring, Weak Area Detection & Adaptive Support
"""

from data import (
    LEARNING_OUTCOMES,
    LO_DESCRIPTIONS,
    RESOURCES,
    SUPPORT_LEVELS,
    DIFFICULTY_PROGRESSION,
    get_resources_for_lo,
    get_quiz_template
)


# ───────────────────────────────────────────────
# STEP 4 — Calculate Score
# ───────────────────────────────────────────────

def calculate_score(results):
    """
    Calculate overall mastery percentage from quiz results.
    
    Args:
        results: dict {lo_name: bool} — True = passed, False = failed
    
    Returns:
        float: percentage score (0.0 - 100.0)
    """
    if not results:
        return 0.0
    total = len(results)
    correct = sum(1 for status in results.values() if status)
    return round((correct / total) * 100, 2)


# ───────────────────────────────────────────────
# STEP 5 — Detect Weak Areas (VERY IMPORTANT)
# ───────────────────────────────────────────────

def get_weak_LOs(results):
    """
    Identify learning outcomes where the student failed.
    
    Args:
        results: dict {lo_name: bool}
    
    Returns:
        list: names of weak learning outcomes
    """
    weak = []
    for lo, status in results.items():
        if not status:
            weak.append(lo)
    return weak


def get_strong_LOs(results):
    """
    Identify learning outcomes where the student succeeded.
    
    Args:
        results: dict {lo_name: bool}
    
    Returns:
        list: names of strong learning outcomes
    """
    return [lo for lo, status in results.items() if status]


# ───────────────────────────────────────────────
# STEP 6 — Classify Support Level
# ───────────────────────────────────────────────

def classify_support_level(score, weak_count, total_count):
    """
    Determine the intensity of adaptive support needed.
    
    Args:
        score: float (0-100)
        weak_count: int number of weak LOs
        total_count: int total number of LOs
    
    Returns:
        dict: support level configuration
    """
    weak_ratio = weak_count / total_count if total_count else 0

    if score >= 85:
        return SUPPORT_LEVELS["mastery"]
    elif score >= 60:
        return SUPPORT_LEVELS["light"]
    elif score >= 40:
        return SUPPORT_LEVELS["moderate"]
    else:
        return SUPPORT_LEVELS["intensive"]


# ───────────────────────────────────────────────
# STEP 7 — Generate Adaptive Recommendations
# ───────────────────────────────────────────────

def get_recommendations(weak_los, support_level_config=None):
    """
    Generate personalized resource recommendations for weak areas.
    
    Args:
        weak_los: list of weak learning outcome names
        support_level_config: dict from classify_support_level()
    
    Returns:
        dict: {lo_name: [recommended_resources]}
    """
    if not support_level_config:
        support_level_config = SUPPORT_LEVELS["moderate"]

    max_resources = support_level_config.get("max_resources_per_lo", 3)
    hint_level = support_level_config.get("hint_level", "medium")

    recommendations = {}
    for lo in weak_los:
        # Pick resources: easier ones first for weak areas
        all_resources = get_resources_for_lo(lo)
        
        # Sort by difficulty (easy -> medium -> hard)
        difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
        sorted_resources = sorted(
            all_resources,
            key=lambda r: difficulty_order.get(r.get("difficulty", "medium"), 1)
        )

        # Adjust based on hint level
        if hint_level == "high":
            # More easy resources
            filtered = [r for r in sorted_resources if r["difficulty"] in ("easy", "medium")]
        elif hint_level == "low":
            # Include harder resources too
            filtered = sorted_resources
        else:
            filtered = sorted_resources

        # Fallback: if filter removes everything, use all available
        if not filtered:
            filtered = sorted_resources

        recommendations[lo] = filtered[:max_resources]

    return recommendations


def generate_adaptive_path(results):
    """
    Generate a step-by-step personalized learning path.
    
    Builds a progression from weakest to strongest areas,
    respecting Bloom's Taxonomy order (lower-order skills first).
    
    Args:
        results: dict {lo_name: bool}
    
    Returns:
        dict: structured learning path
    """
    weak = get_weak_LOs(results)
    strong = get_strong_LOs(results)
    score = calculate_score(results)
    support = classify_support_level(score, len(weak), len(results))

    # Bloom's order for sequencing (lower-order first)
    bloom_order = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    
    # Sort weak areas by Bloom's hierarchy
    ordered_weak = [lo for lo in bloom_order if lo in weak]

    # Build path stages
    stages = []
    for idx, lo in enumerate(ordered_weak, 1):
        resources = get_resources_for_lo(lo)
        max_res = support.get("max_resources_per_lo", 3)
        
        # Filter by appropriate difficulty for this stage
        if idx <= 2:
            # First stages: focus on easy resources
            stage_resources = [r for r in resources if r["difficulty"] == "easy"][:max_res]
            # Fallback: if no easy resources, use all (sorted easiest first)
            if not stage_resources:
                stage_resources = resources[:max_res]
        else:
            stage_resources = resources[:max_res]

        total_duration = sum(r.get("duration_min", 0) for r in stage_resources)

        stages.append({
            "stage_number": idx,
            "learning_outcome": lo,
            "description": LO_DESCRIPTIONS.get(lo, ""),
            "resources": stage_resources,
            "estimated_duration_min": total_duration,
            "quiz_template": get_quiz_template(lo),
            "objective": f"Strengthen {lo} skills through guided practice"
        })

    # Add enrichment for strong areas if mastery level
    enrichment = []
    if score >= 85 and strong:
        for lo in strong[:2]:  # Top 2 strong areas for enrichment
            enrichment.append({
                "learning_outcome": lo,
                "activity": f"Advanced challenge: Teach {lo} to a peer or create content",
                "type": "enrichment"
            })

    return {
        "overall_score": score,
        "support_level": support["name"],
        "support_description": support["description"],
        "weak_areas_count": len(weak),
        "strong_areas_count": len(strong),
        "learning_path": stages,
        "enrichment_activities": enrichment,
        "estimated_total_duration_min": sum(s["estimated_duration_min"] for s in stages),
        "check_in_frequency": support["check_in_frequency"]
    }


# ───────────────────────────────────────────────
# STEP 8 — Estimate Time to Mastery
# ───────────────────────────────────────────────

def estimate_time_to_master(weak_los, support_level_config=None):
    """
    Estimate how long it will take to master weak areas.
    
    Args:
        weak_los: list of weak learning outcome names
        support_level_config: dict from classify_support_level()
    
    Returns:
        dict: time estimates per LO and total
    """
    if not support_level_config:
        support_level_config = SUPPORT_LEVELS["moderate"]

    base_minutes_per_lo = {
        "remember": 30,
        "understand": 45,
        "apply": 60,
        "analyze": 75,
        "evaluate": 90,
        "create": 120
    }

    # Multiplier based on support level
    multipliers = {
        "intensive": 1.5,
        "moderate": 1.2,
        "light": 1.0,
        "mastery": 0.8
    }
    multiplier = multipliers.get(
        support_level_config.get("name", "moderate").lower().replace(" ", "_"), 1.2
    )

    estimates = {}
    for lo in weak_los:
        base = base_minutes_per_lo.get(lo, 60)
        estimates[lo] = round(base * multiplier)

    total_minutes = sum(estimates.values())
    total_hours = round(total_minutes / 60, 1)

    return {
        "per_lo": estimates,
        "total_minutes": total_minutes,
        "total_hours": total_hours,
        "sessions_estimated": max(1, round(total_minutes / 30))  # 30-min sessions
    }


# ───────────────────────────────────────────────
# STEP 9 — Full Adaptive Report
# ───────────────────────────────────────────────

def generate_full_report(student_id, results):
    """
    Generate a complete adaptive learning report for a student.
    
    Args:
        student_id: str unique identifier
        results: dict {lo_name: bool}
    
    Returns:
        dict: comprehensive adaptive report
    """
    weak = get_weak_LOs(results)
    strong = get_strong_LOs(results)
    score = calculate_score(results)
    support = classify_support_level(score, len(weak), len(results))
    recommendations = get_recommendations(weak, support)
    path = generate_adaptive_path(results)
    time_estimate = estimate_time_to_master(weak, support)

    return {
        "student_id": student_id,
        "report_generated": "auto",
        "summary": {
            "overall_score": score,
            "total_los": len(results),
            "mastered": len(strong),
            "needs_work": len(weak),
            "support_level": support["name"],
            "support_description": support["description"]
        },
        "weak_areas": [
            {
                "learning_outcome": lo,
                "description": LO_DESCRIPTIONS.get(lo, ""),
                "recommended_resources": recommendations.get(lo, [])
            }
            for lo in weak
        ],
        "strengths": [
            {
                "learning_outcome": lo,
                "description": LO_DESCRIPTIONS.get(lo, "")
            }
            for lo in strong
        ],
        "adaptive_learning_path": path,
        "time_estimate": time_estimate,
        "next_actions": [
            f"Start with: {path['learning_path'][0]['learning_outcome']}" if path["learning_path"] else "All areas mastered!",
            f"Estimated study time: {time_estimate['total_hours']} hours",
            f"Check-in recommended: {support['check_in_frequency']}"
        ]
    }


# ───────────────────────────────────────────────
# Quick Test
# ───────────────────────────────────────────────

if __name__ == "__main__":
    from data import SAMPLE_QUIZ_RESULTS

    print("=" * 50)
    print("ADAPTIVE LEARNING RECOMMENDATION ENGINE")
    print("=" * 50)

    results = SAMPLE_QUIZ_RESULTS
    score = calculate_score(results)
    weak = get_weak_LOs(results)
    strong = get_strong_LOs(results)

    print(f"\nScore: {score}%")
    print(f"Weak Areas: {weak}")
    print(f"Strong Areas: {strong}")

    support = classify_support_level(score, len(weak), len(results))
    print(f"\nSupport Level: {support['name']}")
    print(f"Description: {support['description']}")

    print("\n--- Recommendations ---")
    recs = get_recommendations(weak, support)
    for lo, resources in recs.items():
        print(f"  {lo}: {len(resources)} resources")

    print("\n--- Adaptive Path ---")
    path = generate_adaptive_path(results)
    for stage in path["learning_path"]:
        print(f"  Stage {stage['stage_number']}: {stage['learning_outcome']} ({stage['estimated_duration_min']} min)")

    print(f"\n--- Time Estimate ---")
    time_est = estimate_time_to_master(weak, support)
    print(f"  Total: {time_est['total_hours']} hours ({time_est['sessions_estimated']} sessions)")

    print("\n--- Full Report ---")
    report = generate_full_report("student_001", results)
    print(f"  Student: {report['student_id']}")
    print(f"  Summary: {report['summary']}")
    print(f"  Next Actions: {report['next_actions']}")
