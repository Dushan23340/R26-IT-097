import { createFileRoute } from "@tanstack/react-router";
import { Target, Trophy, Circle, Sparkles } from "lucide-react";

const Route = createFileRoute("/track-field-analytics")({
  head: () => ({
    meta: [
      { title: "Track & Field Analytics — AdaptiveMind" },
      { name: "description", content: "Interactive circle geometry challenge for track and field lane stagger practice." },
      { property: "og:title", content: "Track & Field Analytics — AdaptiveMind" },
      { property: "og:description", content: "Interactive lane-stagger practice game for students." }
    ]
  }),
  component: TrackFieldAnalyticsPage
});

function TrackFieldAnalyticsPage() {
  const challenges = [
    {
      title: "Lane 1 stagger",
      prompt: "If the inner radius is 36m and the outer radius is 44m, which lane has the larger curve?",
      answer: "Lane 8"
    },
    {
      title: "Circle geometry",
      prompt: "A runner moves around a circular track; what stays constant if speed is steady?",
      answer: "Angular speed"
    }
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="glass rounded-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Interactive Practice
            </div>
            <h1 className="font-display text-3xl font-bold">Track & Field Analytics Challenge</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Tackle quick circle-based lane stagger problems and build confidence before your next class.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 text-center">
            <div className="text-3xl font-bold text-primary">4</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Questions</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-3xl p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Practice Questions
          </div>
          <div className="space-y-4">
            {challenges.map((challenge, index) => (
              <div key={challenge.title} className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">{challenge.title}</h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Q{index + 1}
                  </span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{challenge.prompt}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Circle className="h-4 w-4" />
                  Sample answer: {challenge.answer}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-primary" />
            Why it helps
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Strengthens geometry reasoning for athletics-based examples.</li>
            <li>• Builds confidence with lane-stagger and circle questions.</li>
            <li>• Gives you instant feedback to support your next lesson.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export { Route };
