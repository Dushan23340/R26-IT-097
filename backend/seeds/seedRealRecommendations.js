import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test";
const DB_NAME = process.env.MONGODB_DB_NAME || "test";

// Real recommendations data: keyed by "unit|bloomLevel|emotion"
// Performance level notation: weak = 0/3 or 1/3 (fail), average = 2/3
const realRecommendationsData = [
  // ==================== Unit 1: Number Patterns ====================
  {
    unit: "Number Patterns",
    bloomLevel: "Remembering",
    emotion: "Confused",
    performanceLevel: "weak",
    resources: [
      {
        type: "reading",
        title: "Step-by-step Memory Aids & Simple Notes",
        url: "https://www.scribd.com/document/700389502/4-Mathematics-Gr-9-T1-W8-9-Lesson-Plan",
        duration_min: 15,
        notes: "Very simple notes with step-by-step memory aids to help you understand number patterns from the basics.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Number Patterns",
    bloomLevel: "Understanding",
    emotion: "Confused",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Step-by-step Concept Breakdown",
        url: "https://www.youtube.com/watch?v=XYNP2IRf8aA&t=12s",
        duration_min: 10,
        notes: "Take it step by step. This video breaks down understanding concepts clearly.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Number Patterns",
    bloomLevel: "Remembering",
    emotion: "Bored",
    performanceLevel: "average",
    resources: [
      {
        type: "video",
        title: "Interactive Sequence Game Video",
        url: "https://www.youtube.com/watch?v=Qzlc7iZR6rc&t=74s",
        duration_min: 8,
        notes: "Ready for a challenge? This interactive video explores sequences in an engaging way.",
        difficulty: "medium",
      },
    ],
  },
  {
    unit: "Number Patterns",
    bloomLevel: "Understanding",
    emotion: "Normal",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Animated Explanation Videos",
        url: "https://youtu.be/vV7C7bXm4VI?si=L3CW5fJR9tZyg1R9",
        duration_min: 12,
        notes: "Clear animated explanations to help you understand this concept better.",
        difficulty: "easy",
      },
      {
        type: "reading",
        title: "Visual Examples PDF",
        url: "https://www.scribd.com/document/676797796/GRADE-9-NUMBER-PATTERNS-12-14-APRIL-2023",
        duration_min: 18,
        notes: "Visual examples with detailed explanations for Number Patterns.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Number Patterns",
    bloomLevel: "Applying",
    emotion: "Happy",
    performanceLevel: "average",
    resources: [
      {
        type: "interactive",
        title: "Challenging Sequence Problems",
        url: "https://lk.edugain.com/8-31-5604-5605/math/Sri-Lanka-School-Math/Grade-9/Rational-and-Irrational-Numbers",
        duration_min: 20,
        notes: "You're doing great! Here are challenging sequence problems to explore even deeper.",
        difficulty: "hard",
      },
    ],
  },
  {
    unit: "Number Patterns",
    bloomLevel: "Analyzing",
    emotion: "Bored",
    performanceLevel: "average",
    resources: [
      {
        type: "interactive",
        title: "Advanced Pattern Analysis Tasks",
        url: "https://www.mathplayground.com/algebraic_reasoning.html?utm_source=chatgpt.com",
        duration_min: 25,
        notes: "Ready for a challenge? Advanced pattern analysis to keep you engaged.",
        difficulty: "hard",
      },
    ],
  },
  // ==================== Unit 2: Fractions ====================
  {
    unit: "Fractions",
    bloomLevel: "Remembering",
    emotion: "Normal",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Easy Fraction Revision Video",
        url: "https://www.youtube.com/watch?v=IAa5_qwUC48&t=4s",
        duration_min: 10,
        notes: "Here's a clear resource to help you revise fraction basics.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Fractions",
    bloomLevel: "Remembering",
    emotion: "Confused",
    performanceLevel: "average",
    resources: [
      {
        type: "reading",
        title: "Visual Summaries for Fractions",
        url: "https://www.mathsisfun.com/fractions.html?utm_source=chatgpt.com",
        duration_min: 12,
        notes: "Visual summaries to help you understand fractions step by step.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Fractions",
    bloomLevel: "Understanding",
    emotion: "Frustrated",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Step-by-step Fraction Tutorials",
        url: "https://www.youtube.com/watch?v=5hG8e9jGeaA&t=4s",
        duration_min: 14,
        notes: "Don't worry, this is broken down into simple steps. You can do this!",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Fractions",
    bloomLevel: "Applying",
    emotion: "Normal",
    performanceLevel: "average",
    resources: [
      {
        type: "reading",
        title: "Fraction Worksheets + Worked Examples",
        url: "https://www.scribd.com/document/621276782/Worksheet-3-Common-fractions-grade-9-maths",
        duration_min: 20,
        notes: "Comprehensive worksheets with worked examples to practice fraction applications.",
        difficulty: "medium",
      },
    ],
  },
  // ==================== Unit 3: Percentages ====================
  {
    unit: "Percentages",
    bloomLevel: "Remembering",
    emotion: "Normal",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Percentage Formula Recall Videos",
        url: "https://www.youtube.com/watch?v=RUAJEdIsdps&t=11s",
        duration_min: 8,
        notes: "Clear videos to help you recall percentage formulas.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Percentages",
    bloomLevel: "Understanding",
    emotion: "Confused",
    performanceLevel: "weak",
    resources: [
      {
        type: "reading",
        title: "Simple Visual Explanation of Percentages",
        url: "https://www.mathsisfun.com/percentage.html",
        duration_min: 12,
        notes: "Take it step by step with visual explanations.",
        difficulty: "easy",
      },
    ],
  },
  {
    unit: "Percentages",
    bloomLevel: "Applying",
    emotion: "Normal",
    performanceLevel: "average",
    resources: [
      {
        type: "reading",
        title: "Percentage Worksheets + Shopping Discount Problems",
        url: "https://www.youtube.com/watch?v=RUAJEdIsdps&t=11s",
        duration_min: 18,
        notes: "Practical worksheets with real-world shopping discount problems.",
        difficulty: "medium",
      },
    ],
  },
  {
    unit: "Percentages",
    bloomLevel: "Evaluating",
    emotion: "Frustrated",
    performanceLevel: "weak",
    resources: [
      {
        type: "video",
        title: "Solving Percentage Word Problems",
        url: "https://www.youtube.com/watch?v=PaXQ2QiCFn8&t=3s",
        duration_min: 15,
        notes: "Don't worry, let's solve percentage word problems step by step.",
        difficulty: "medium",
      },
    ],
  },
  {
    unit: "Percentages",
    bloomLevel: "Creating",
    emotion: "Bored",
    performanceLevel: "average",
    resources: [
      {
        type: "reading",
        title: "Percentage Problems Revision",
        url: "https://www.scribd.com/document/626092423/revision-percentage",
        duration_min: 20,
        notes: "Ready for a challenge? Advanced percentage problems to master the concept.",
        difficulty: "hard",
      },
    ],
  },
];

async function seedRealRecommendations() {
  try {
    console.log("🌱 Connecting to MongoDB...");
    const connectOptions = {};
    if (!MONGODB_URI.includes("/test")) {
      connectOptions.dbName = DB_NAME;
    }
    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const recommendationsCollection = db.collection("recommendations");

    console.log("📚 Updating recommendations with real data...");
    let updatedCount = 0;

    // Process each real recommendation entry
    for (const rec of realRecommendationsData) {
      const { unit, bloomLevel, emotion, performanceLevel, resources } = rec;

      // Generate resource IDs
      const updatedResources = resources.map((resource, idx) => ({
        id: `${unit.replace(/\s+/g, "-").toLowerCase()}-${bloomLevel.toLowerCase()}-${emotion.toLowerCase()}-${idx + 1}`,
        ...resource,
      }));

      // Query to find existing recommendation
      const filter = {
        unit,
        bloomLevel,
        emotion,
        $or: [
          { performanceLevel },
          { performanceLevel: { $exists: false } },
        ],
      };

      // Update or create the recommendation. This overwrites any older dummy
      // document with the same unit/bloomLevel/emotion so real_data takes precedence.
      const result = await recommendationsCollection.updateMany(
        filter,
        {
          $set: {
            unit,
            bloomLevel,
            emotion,
            performanceLevel,
            resources: updatedResources,
            updatedAt: new Date(),
            source: "real_data",
          },
        },
        { upsert: true }
      );

      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        updatedCount++;
        console.log(`✅ Seeded: ${unit} → ${bloomLevel} (${performanceLevel}) → ${emotion}`);
      }
    }

    console.log(`\n✨ Successfully seeded ${updatedCount} real recommendation entries!`);
    console.log("\n📊 Summary:");
    console.log("   - Number Patterns: 6 combinations");
    console.log("   - Fractions: 4 combinations");
    console.log("   - Percentages: 5 combinations");
    console.log("   - Total: 15 real recommendation entries");
    console.log("\n💡 Note: Existing dummy data for other unit/bloomLevel/emotion/performanceLevel combinations is preserved.\n");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB\n");
  } catch (error) {
    console.error("❌ Error seeding real recommendations:", error);
    process.exit(1);
  }
}

seedRealRecommendations();
