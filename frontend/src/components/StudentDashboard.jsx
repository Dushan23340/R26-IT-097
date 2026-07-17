import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Play,
  Calendar,
  BookOpen,
  FileText,
  TrendingUp,
  TrendingDown,
  Bell,
  Video,
  Monitor,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  X,
  CheckCircle2,
  Clock,
  Target,
  Award,
  AlertCircle
} from "lucide-react";
import { EMOTIONS } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";
import EmotionDetector from "@/components/EmotionDetector";
function StudentDashboard() {
  const { user } = useAuth();
  const [emotion, setEmotion] = useState("neutral");
  const [inLiveClass, setInLiveClass] = useState(false);
  const [currentLiveClass, setCurrentLiveClass] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const mapStudentStateToUiKey = (state) => {
    const s = (state || "").toLowerCase();
    if (s.includes("engaged")) return "happy";
    if (s.includes("bored")) return "neutral";
    if (s.includes("confused")) return "confused";
    if (s.includes("frustrated")) return "angry";
    return "neutral";
  };
  const overallProgress = 72;
  const liveClasses = [
    {
      id: "1",
      subject: "Mathematics - Algebra",
      teacher: "Dr. Sarah Johnson",
      time: "Live Now",
      status: "live",
      joinUrl: "https://zoom.us/j/123456789"
    },
    {
      id: "2",
      subject: "Physics - Mechanics",
      teacher: "Prof. Michael Chen",
      time: "2:00 PM Today",
      status: "upcoming"
    },
    {
      id: "3",
      subject: "English - Grammar",
      teacher: "Ms. Emily Davis",
      time: "10:00 AM Tomorrow",
      status: "upcoming"
    }
  ];
  const quizzes = [
    {
      id: "1",
      title: "Algebra Basics",
      subject: "Mathematics",
      difficulty: "Easy",
      questions: 10,
      duration: "15 min"
    },
    {
      id: "2",
      title: "Newton's Laws",
      subject: "Physics",
      difficulty: "Medium",
      questions: 15,
      duration: "20 min"
    },
    {
      id: "3",
      title: "Advanced Calculus",
      subject: "Mathematics",
      difficulty: "Hard",
      questions: 20,
      duration: "30 min"
    }
  ];
  const recommendations = [
    {
      id: "1",
      type: "video",
      title: "Watch: Introduction to Algebra",
      description: "10 min video to strengthen your basics",
      action: "Watch Now",
      duration: "10 min"
    },
    {
      id: "2",
      type: "quiz",
      title: "Try: Quick Practice Quiz",
      description: "5 questions to test your understanding",
      action: "Start Quiz",
      duration: "5 min"
    },
    {
      id: "3",
      type: "article",
      title: "Read: Study Tips for Math",
      description: "Improve your problem-solving skills",
      action: "Read Article",
      duration: "8 min"
    },
    {
      id: "4",
      type: "quiz",
      title: "Play: Track & Field Analytics",
      description: "Solve four circle-related lane stagger questions in an Olympic-style game.",
      action: "Launch Game",
      duration: "4 min",
      to: "/track-field-analytics"
    }
  ];
  const progressData = [
    { subject: "Mathematics", score: 85, trend: "up", weak: false },
    { subject: "Physics", score: 68, trend: "stable", weak: false },
    { subject: "English", score: 72, trend: "up", weak: false },
    { subject: "Chemistry", score: 45, trend: "down", weak: true }
  ];
  const notifications = [
    {
      id: "1",
      message: "Great job on your last quiz! \u{1F389}",
      type: "success",
      time: "2 hours ago"
    },
    {
      id: "2",
      message: "You need to improve in Chemistry - try the recommended practice",
      type: "warning",
      time: "5 hours ago"
    },
    {
      id: "3",
      message: "New live class scheduled for tomorrow at 10 AM",
      type: "info",
      time: "1 day ago"
    }
  ];
  const currentEmotion = EMOTIONS[emotion];
  if (inLiveClass && currentLiveClass) {
    return <div className="min-h-screen bg-background">
        {
      /* Live Class Header */
    }
        <div className="glass border-b border-border/60 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">{currentLiveClass.subject}</h2>
              <p className="text-sm text-muted-foreground">{currentLiveClass.teacher}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                LIVE
              </div>
              <button
      onClick={() => setShowNotifications(!showNotifications)}
      className="relative p-2 rounded-full hover:bg-secondary transition-colors"
    >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && <div className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />}
              </button>
            </div>
          </div>
        </div>

        {
      /* Screen Sharing Area */
    }
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {
      /* Main Screen Share */
    }
            <div className="lg:col-span-3">
              <div className="glass rounded-2xl overflow-hidden aspect-video relative">
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-background">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Teacher's Screen</p>
                    <p className="text-sm text-muted-foreground">Screen sharing in progress...</p>
                  </div>
                </div>
                
                {
      /* Controls */
    }
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <button
      onClick={() => setIsMuted(!isMuted)}
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                  <button
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    <Video className="h-5 w-5" />
                  </button>
                  <button
      className="p-3 rounded-full glass hover:scale-105 transition-transform"
    >
                    <Maximize2 className="h-5 w-5" />
                  </button>
                  <button
      onClick={() => {
        setInLiveClass(false);
        setCurrentLiveClass(null);
      }}
      className="p-3 rounded-full bg-destructive hover:bg-destructive/90 hover:scale-105 transition-transform"
    >
                    <PhoneOff className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {
      /* Sidebar - Student Info & Emotion */
    }
            <div className="space-y-4">
              {
      /* Webcam & Emotion */
    }
              <div className="glass rounded-2xl p-4">
                <EmotionDetector
                  className="mb-3"
                  intervalMs={2500}
                  onEmotion={({ emotion: studentState }) => {
                    if (studentState === "No face detected") return;
                    setEmotion(mapStudentStateToUiKey(studentState));
                  }}
                />
                <div className="text-center">
                  <p className="text-sm font-medium mb-1">You</p>
                  <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
      style={{
        background: `${currentEmotion.color}15`,
        color: currentEmotion.color
      }}
    >
                    <span>{currentEmotion.emoji}</span>
                    <span>{currentEmotion.label}</span>
                  </div>
                </div>
              </div>

              {
      /* Quick Stats */
    }
              <div className="glass rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Attention</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Engagement</span>
                    <span className="font-medium">92%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>;
  }
  return <div className="space-y-6 stagger-children max-w-7xl mx-auto">
      {
    /* Notifications Panel */
  }
      {showNotifications && <div className="fixed top-20 right-6 z-50 w-80 glass rounded-2xl shadow-2xl border border-border/60">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-secondary rounded-full">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => <div key={notif.id} className="p-4 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors">
                <div className="flex gap-3">
                  {notif.type === "success" && <CheckCircle2 className="h-5 w-5 text-emotion-happy flex-shrink-0 mt-0.5" />}
                  {notif.type === "warning" && <AlertCircle className="h-5 w-5 text-emotion-confused flex-shrink-0 mt-0.5" />}
                  {notif.type === "info" && <Bell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                  </div>
                </div>
              </div>)}
          </div>
        </div>}

      {
    /* 1. Top Header - Simple Summary */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold mb-2">
              Welcome back, {user?.name || "Student"}! 👋
            </h1>
            <p className="text-muted-foreground mb-4">Here's your learning overview for today</p>
            
            {
    /* Progress Bar */
  }
            <div className="max-w-md">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-semibold">{overallProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div
    className="h-full rounded-full transition-all duration-500"
    style={{
      width: `${overallProgress}%`,
      background: "var(--gradient-primary)"
    }}
  />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {overallProgress >= 70 ? "\u{1F389} Doing Well!" : "\u{1F4AA} Keep Practicing!"}
              </p>
            </div>
          </div>

          {
    /* Emotion Indicator */
  }
          <div className="flex items-center gap-4">
            <div
    className="text-center px-6 py-4 rounded-xl"
    style={{ background: `${currentEmotion.color}10` }}
  >
              <div className="text-5xl mb-2">{currentEmotion.emoji}</div>
              <p className="text-sm font-medium" style={{ color: currentEmotion.color }}>
                {currentEmotion.label}
              </p>
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Live Classes
            </h2>
          </div>

          {
    /* Current Live Class */
  }
          {liveClasses.filter((c) => c.status === "live").map((cls) => <div key={cls.id} className="mb-4 p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium text-destructive">LIVE NOW</span>
                </div>
                <span className="text-xs text-muted-foreground">{cls.time}</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">{cls.subject}</h3>
              <p className="text-sm text-muted-foreground mb-4">{cls.teacher}</p>
              <button
    onClick={() => {
      setInLiveClass(true);
      setCurrentLiveClass(cls);
    }}
    className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-105"
    style={{
      background: "var(--gradient-primary)",
      color: "var(--primary-foreground)",
      boxShadow: "var(--shadow-glow)"
    }}
  >
                <Play className="h-4 w-4" />
                Join Live Class
              </button>
            </div>)}

          {
    /* Upcoming Classes */
  }
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Classes
            </h3>
            <div className="space-y-2">
              {liveClasses.filter((c) => c.status === "upcoming").map((cls) => <div key={cls.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-primary/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{cls.subject}</p>
                    <p className="text-xs text-muted-foreground">{cls.teacher}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {cls.time}
                  </div>
                </div>)}
            </div>
          </div>
        </div>

        {
    /* 3. Quick Stats & Emotion */
  }
        <div className="space-y-6">
          {
    /* Simple Emotion Status */
  }
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-4">Your Status</h3>
            <div className="text-center mb-4">
              <div className="text-6xl mb-3">{currentEmotion.emoji}</div>
              <p className="font-semibold text-lg" style={{ color: currentEmotion.color }}>
                {currentEmotion.label}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {emotion === "happy" && "You're doing great! Keep it up!"}
                {emotion === "neutral" && "Steady focus detected. Good pace!"}
                {emotion === "confused" && "Take your time. We're here to help."}
                {emotion === "angry" && "It's okay to feel stuck. Try a short break or ask for help."}
              </p>
            </div>
          </div>

          {
    /* Quick Progress */
  }
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Quizzes Completed</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg. Score</span>
                <span className="font-semibold">78%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Study Streak</span>
                <span className="font-semibold">5 days 🔥</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
    /* 4. Progress Section */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Your Progress
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {progressData.map((item) => <div
    key={item.subject}
    className={`p-4 rounded-xl border ${item.weak ? "border-destructive/30 bg-destructive/5" : "border-border/60"}`}
  >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{item.subject}</h3>
                {item.trend === "up" && <TrendingUp className="h-4 w-4 text-emotion-happy" />}
                {item.trend === "down" && <TrendingDown className="h-4 w-4 text-emotion-angry" />}
              </div>
              
              <div className="text-2xl font-bold mb-2">{item.score}%</div>
              
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${item.score}%`,
      background: item.weak ? "var(--emotion-angry)" : "var(--gradient-primary)"
    }}
  />
              </div>
              
              {item.weak && <p className="text-xs text-destructive font-medium">Needs Practice</p>}
            </div>)}
        </div>
      </div>

      {
    /* 5. Recommendations */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Recommended for You
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec) => <div key={rec.id} className="p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div
    className="h-10 w-10 rounded-lg flex items-center justify-center"
    style={{ background: "var(--gradient-primary)" }}
  >
                  {rec.type === "video" && <Play className="h-5 w-5 text-primary-foreground" />}
                  {rec.type === "quiz" && <FileText className="h-5 w-5 text-primary-foreground" />}
                  {rec.type === "article" && <BookOpen className="h-5 w-5 text-primary-foreground" />}
                </div>
                {rec.duration && <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {rec.duration}
                  </span>}
              </div>
              
              <h3 className="font-semibold mb-1">{rec.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
              
              <button className="w-full px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors">
                {rec.action}
              </button>
            </div>)}
        </div>
      </div>

      {
    /* 6. Quiz Section */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Available Quizzes
        </h2>
        
        <div className="space-y-3">
          {quizzes.map((quiz) => <div key={quiz.id} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-all">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{quiz.title}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{quiz.subject}</span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {quiz.questions} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {quiz.duration}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${quiz.difficulty === "Easy" ? "bg-emotion-happy/10 text-emotion-happy" : quiz.difficulty === "Medium" ? "bg-emotion-confused/10 text-emotion-confused" : "bg-emotion-angry/10 text-emotion-angry"}`}>
                  {quiz.difficulty}
                </span>
                <button
    className="px-5 py-2 rounded-lg text-sm font-semibold text-primary-foreground transition-all hover:scale-105"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
                  Start Quiz
                </button>
              </div>
            </div>)}
        </div>
      </div>
    </div>;
}
export {
  StudentDashboard
};
