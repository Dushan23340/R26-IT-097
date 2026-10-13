import { createFileRoute } from "@tanstack/react-router";
import { Shapes } from "lucide-react";
import { LessonQuestGame } from "@/components/LessonQuestGame";
import { generateSetQuestions } from "@/lib/lessonQuestQuestions";

const Route = createFileRoute("/set-sorter-station")({
  head: () => ({
    meta: [
      { title: "Set Sorter Station — AdaptiveMind" },
      { name: "description", content: "Sort cargo at the station: count elements, spot members, and find unions and intersections of sets." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LessonQuestGame
      gameKey="set_sorter_station"
      badge="GAME 16 · SET SORTER STATION"
      title="Set Sorter Station"
      intro="Sort cargo at the station: count elements, spot members, and find unions and intersections of sets."
      startTitle="10 crates to sort"
      startText="10 questions, freshly generated each time: 4 remember, 4 understand and 2 apply. You have 3 lives."
      winTitle="Station Cleared!"
      loseTitle="Out of lives"
      Icon={Shapes}
      background="linear-gradient(160deg, #1e1b4b 0%, #4c1d95 55%, #7c3aed 100%)"
      rules={["Read each crate label and choose the correct answer", "Union is everything in either set; intersection is only what both share", "Each question shows the working after you answer"]}
      generate={generateSetQuestions}
    />
  );
}

export { Route };
