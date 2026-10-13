import { createFileRoute } from "@tanstack/react-router";
import { Binary } from "lucide-react";
import { LessonQuestGame } from "@/components/LessonQuestGame";
import { generateBinaryQuestions } from "@/lib/lessonQuestQuestions";

const Route = createFileRoute("/binary-code-breaker")({
  head: () => ({
    meta: [
      { title: "Binary Code Breaker — AdaptiveMind" },
      { name: "description", content: "Crack the vault's binary locks: place values, binary to decimal, decimal to binary and binary addition." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LessonQuestGame
      gameKey="binary_code_breaker"
      badge="GAME 14 · BINARY CODE BREAKER"
      title="Binary Code Breaker"
      intro="Crack the vault's binary locks: place values, binary to decimal, decimal to binary and binary addition."
      startTitle="10 locks to crack"
      startText="10 questions, freshly generated each time: 4 remember, 4 understand and 2 apply. You have 3 lives."
      winTitle="Vault Cracked!"
      loseTitle="Out of lives"
      Icon={Binary}
      background="linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0e7490 100%)"
      rules={["Read each lock and choose the correct value", "Place values double from right to left: 1, 2, 4, 8, 16...", "Each question shows the working after you answer"]}
      generate={generateBinaryQuestions}
    />
  );
}

export { Route };
