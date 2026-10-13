import { createFileRoute } from "@tanstack/react-router";
import { Percent } from "lucide-react";
import { LessonQuestGame } from "@/components/LessonQuestGame";
import { generatePercentQuestions } from "@/lib/lessonQuestQuestions";

const Route = createFileRoute("/percent-market-dash")({
  head: () => ({
    meta: [
      { title: "Percent Market Dash — AdaptiveMind" },
      { name: "description", content: "Serve a busy market stall: convert fractions to percentages, find a percentage of an amount, and work out profit and discounts." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LessonQuestGame
      gameKey="percent_market_dash"
      badge="GAME 15 · PERCENT MARKET DASH"
      title="Percent Market Dash"
      intro="Serve a busy market stall: convert fractions to percentages, find a percentage of an amount, and work out profit and discounts."
      startTitle="10 customers waiting"
      startText="10 questions, freshly generated each time: 4 remember, 4 understand and 2 apply. You have 3 lives."
      winTitle="Market Champion!"
      loseTitle="Out of lives"
      Icon={Percent}
      background="linear-gradient(160deg, #7c2d12 0%, #b45309 55%, #f59e0b 100%)"
      rules={["Read each customer request and choose the correct answer", "Percent means out of 100: multiply a fraction by 100", "Each question shows the working after you answer"]}
      generate={generatePercentQuestions}
    />
  );
}

export { Route };
