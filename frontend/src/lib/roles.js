// Where each role lands after signing in, and the copy the sign-in and
// sign-up screens show for it. The account service accepts exactly these two
// roles at sign-up (backend/models/userRepository.js validateSignupFields).
export const ROLES = {
  student: {
    key: "student",
    label: "Student",
    home: "/",
    tagline: "Learn with quizzes and support that adapt to you",
    headline: ["Learning that notices", "how you feel"],
    points: [
      ["A quiz made only for you", "12 fresh questions each time, across Remember, Understand and Apply."],
      ["Help that fits the moment", "Videos and short notes chosen from your results and how the lesson felt."],
      ["Your privacy comes first", "Your webcam is read only during live classes. No face images are stored."],
    ],
  },
  teacher: {
    key: "teacher",
    label: "Teacher",
    home: "/teacher",
    tagline: "Run live classes and see how your class feels",
    headline: ["See your whole class", "at a glance"],
    points: [
      ["Live class emotion view", "Know when boredom or confusion lasts, not just when it flickers."],
      ["Games that re-engage", "Lesson-aligned games you can assign to the class in one click."],
      ["You stay in control", "Every statistical insight waits for your approval before a student sees it."],
    ],
  },
};

export function homeFor(role) {
  if (role === "admin") return "/admin";
  return ROLES[role]?.home || "/";
}
