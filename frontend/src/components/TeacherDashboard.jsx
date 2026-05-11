import { useState, useEffect } from "react";
import {
  Monitor,
  Users,
  Bell,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  FileText,
  MessageSquare,
  Calendar,
  Plus,
  Link,
  Play,
  PhoneOff,
  Eye,
  Target,
  Award,
  Clock,
  Zap
} from "lucide-react";
import { Link as RouterLink } from "@tanstack/react-router";
import { EMOTIONS } from "@/lib/emotions";
import { useAuth } from "@/lib/auth";
function TeacherDashboard() {
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [studentsJoined, setStudentsJoined] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const [emotionDistribution, setEmotionDistribution] = useState({
    happy: 35,
    neutral: 25,
    confused: 20,
    bored: 12,
    frustrated: 8
  });
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setEmotionDistribution({
        happy: Math.floor(30 + Math.random() * 15),
        neutral: Math.floor(20 + Math.random() * 10),
        confused: Math.floor(15 + Math.random() * 10),
        bored: Math.floor(10 + Math.random() * 8),
        frustrated: Math.floor(5 + Math.random() * 5)
      });
      setStudentsJoined(18 + Math.floor(Math.random() * 6));
    }, 5e3);
    return () => clearInterval(interval);
  }, [isLive]);
  const students = [
    { id: "STU_001", name: "Aisha K.", emotion: "happy", status: "active", score: 85 },
    { id: "STU_002", name: "Ben R.", emotion: "confused", status: "active", score: 62 },
    { id: "STU_003", name: "Chen W.", emotion: "happy", status: "active", score: 90 },
    { id: "STU_004", name: "Diya P.", emotion: "neutral", status: "active", score: 75 },
    { id: "STU_005", name: "Eli M.", emotion: "bored", status: "inactive", score: 55 },
    { id: "STU_006", name: "Fatima A.", emotion: "happy", status: "active", score: 88 },
    { id: "STU_007", name: "Gabe S.", emotion: "confused", status: "active", score: 60 },
    { id: "STU_008", name: "Hana L.", emotion: "neutral", status: "active", score: 72 },
    { id: "STU_009", name: "Ivan O.", emotion: "happy", status: "active", score: 82 },
    { id: "STU_010", name: "Jules N.", emotion: "frustrated", status: "inactive", score: 48 },
    { id: "STU_011", name: "Kavi T.", emotion: "happy", status: "active", score: 87 },
    { id: "STU_012", name: "Lina B.", emotion: "neutral", status: "active", score: 70 }
  ];
  const alerts = [
    {
      id: "1",
      message: "High confusion detected (20%) - Consider explaining again",
      type: "warning",
      time: "2 min ago"
    },
    {
      id: "2",
      message: "3 students showing frustration - May need individual help",
      type: "danger",
      time: "5 min ago"
    },
    {
      id: "3",
      message: "Engagement dropped - Start a quick activity",
      type: "warning",
      time: "10 min ago"
    }
  ];
  const smartSuggestions = [
    {
      id: "1",
      message: "20% of students are confused - Explain the concept again with examples",
      action: "Show Recap Material",
      icon: "alert"
    },
    {
      id: "2",
      message: "Engagement is dropping - Start an interactive quiz to re-engage",
      action: "Launch Quick Quiz",
      icon: "game"
    },
    {
      id: "3",
      message: "Most students are doing well - Introduce advanced challenge",
      action: "Add Challenge Question",
      icon: "lightbulb"
    }
  ];
  const upcomingClasses = [
    {
      id: "1",
      subject: "Physics - Mechanics",
      time: "2:00 PM Today",
      students: 24,
      link: "abc-123-xyz"
    },
    {
      id: "2",
      subject: "Math - Calculus",
      time: "10:00 AM Tomorrow",
      students: 28,
      link: "def-456-uvw"
    }
  ];
  const classStats = {
    averageScore: 74,
    weakTopics: ["Quadratic Equations", "Newton's Third Law", "Chemical Bonding"],
    overallProgress: 68
  };
  const handleStartClass = () => {
    setIsLive(true);
    setStudentsJoined(18);
  };
  const handleEndClass = () => {
    setIsLive(false);
    setIsSharingScreen(false);
    setStudentsJoined(0);
  };
  const handleShareScreen = () => {
    setIsSharingScreen(!isSharingScreen);
  };
  return <div className="space-y-6 stagger-children max-w-7xl mx-auto">
      {
    /* Alerts Panel */
  }
      {showAlerts && <div className="fixed top-20 right-6 z-50 w-96 glass rounded-2xl shadow-2xl border border-border/60">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Real-Time Alerts
            </h3>
            <button
    onClick={() => setShowAlerts(false)}
    className="p-1 hover:bg-secondary rounded-full"
  >
              ×
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.map((alert) => <div key={alert.id} className="p-4 border-b border-border/40 last:border-b-0">
                <div className="flex gap-3">
                  {alert.type === "danger" && <AlertTriangle className="h-5 w-5 text-emotion-angry flex-shrink-0 mt-0.5" />}
                  {alert.type === "warning" && <AlertTriangle className="h-5 w-5 text-emotion-confused flex-shrink-0 mt-0.5" />}
                  {alert.type === "info" && <Bell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              </div>)}
          </div>
        </div>}

      {
    /* 1. Live Class Control Panel */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold mb-2">
              Teacher Dashboard 👨‍🏫
            </h1>
            <p className="text-muted-foreground mb-4">
              {isLive ? "Live class in progress" : "Ready to start your next class"}
            </p>

            {
    /* Class Status */
  }
            <div className="flex items-center gap-4 mb-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isLive ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                <div className={`h-2 w-2 rounded-full ${isLive ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`} />
                {isLive ? "LIVE" : "Not Started"}
              </div>
              {isLive && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{studentsJoined} students joined</span>
                </div>}
            </div>

            {
    /* Control Buttons */
  }
            <div className="flex flex-wrap gap-3">
              {!isLive ? <button
    onClick={handleStartClass}
    className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-105"
    style={{
      background: "var(--gradient-primary)",
      color: "var(--primary-foreground)",
      boxShadow: "var(--shadow-glow)"
    }}
  >
                  <Play className="h-4 w-4" />
                  Start Class
                </button> : <>
                  <button
    onClick={handleShareScreen}
    className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all hover:scale-105 ${isSharingScreen ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}`}
  >
                    <Monitor className="h-4 w-4" />
                    {isSharingScreen ? "Sharing Screen" : "Share Screen"}
                  </button>
                  <button
    onClick={handleEndClass}
    className="px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
  >
                    <PhoneOff className="h-4 w-4" />
                    End Class
                  </button>
                </>}
            </div>
          </div>

          {
    /* Notifications Bell */
  }
          <button
    onClick={() => setShowAlerts(!showAlerts)}
    className="relative p-3 rounded-full glass hover:scale-105 transition-transform"
  >
            <Bell className="h-6 w-6" />
            {alerts.length > 0 && <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-destructive border-2 border-background" />}
          </button>
        </div>
      </div>

      {
    /* 2. Real-Time Emotion Summary */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Class Emotion Overview
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(emotionDistribution).map(([emotion, percentage]) => {
    const emotionKey = emotion;
    const e = EMOTIONS[emotionKey];
    return <div
      key={emotion}
      className="p-4 rounded-xl border border-border/60 text-center"
      style={{ background: `${e.color}08` }}
    >
                <div className="text-4xl mb-2">{e.emoji}</div>
                <p className="text-sm font-semibold mb-1">{e.label}</p>
                <p className="text-2xl font-bold" style={{ color: e.color }}>
                  {percentage}%
                </p>
              </div>;
  })}
        </div>
      </div>

      {
    /* 3. Class Performance Overview */
  }
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4" />
            Average Score
          </h3>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2 text-gradient-primary">
              {classStats.averageScore}%
            </div>
            <p className="text-sm text-muted-foreground">Class average this session</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Overall Progress
          </h3>
          <div className="text-center mb-3">
            <div className="text-5xl font-bold mb-2">{classStats.overallProgress}%</div>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${classStats.overallProgress}%`,
      background: "var(--gradient-primary)"
    }}
  />
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Weak Topics
          </h3>
          <div className="space-y-2">
            {classStats.weakTopics.map((topic, index) => <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <span>{topic}</span>
              </div>)}
          </div>
        </div>
      </div>

      {
    /* 4. Student List */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Students ({students.length})
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-emotion-happy" />
            <span>{students.filter((s) => s.status === "active").length} Active</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {students.map((student) => {
    const e = EMOTIONS[student.emotion];
    return <div
      key={student.id}
      className={`p-3 rounded-xl border transition-all hover:scale-105 ${student.status === "inactive" ? "opacity-50" : ""}`}
      style={{
        borderColor: `${e.color}30`,
        background: `${e.color}08`
      }}
    >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl">{e.emoji}</div>
                  <div className={`h-2 w-2 rounded-full ${student.status === "active" ? "bg-emotion-happy" : "bg-muted-foreground"}`} />
                </div>
                <p className="text-sm font-medium truncate mb-1">{student.name}</p>
                <p className="text-xs" style={{ color: e.color }}>{e.label}</p>
                <RouterLink
                  to="/teacher/analytics/$studentId"
                  params={{ studentId: student.id }}
                  className="mt-2 block w-full text-center px-2 py-1.5 rounded-lg text-[11px] font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                >
                  View Analytics
                </RouterLink>
              </div>;
  })}
        </div>
      </div>

      {
    /* 5. Smart Suggestions Panel */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber" />
          AI Suggestions
        </h2>
        
        <div className="space-y-3">
          {smartSuggestions.map((suggestion) => <div
    key={suggestion.id}
    className="flex items-start gap-4 p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-colors"
  >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                {suggestion.icon === "alert" && <AlertTriangle className="h-5 w-5 text-destructive" />}
                {suggestion.icon === "lightbulb" && <CheckCircle2 className="h-5 w-5 text-emotion-happy" />}
                {suggestion.icon === "game" && <FileText className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-sm mb-2">{suggestion.message}</p>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors">
                  {suggestion.action}
                </button>
              </div>
            </div>)}
        </div>
      </div>

      {
    /* 6. Quick Actions */
  }
      <div className="glass rounded-2xl p-6">
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <FileText className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Start Quiz</h3>
            <p className="text-sm text-muted-foreground">Launch a quick quiz for the class</p>
          </button>
          
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <Calendar className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Assign Activity</h3>
            <p className="text-sm text-muted-foreground">Give students a practice task</p>
          </button>
          
          <button className="p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
            <MessageSquare className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Send Message</h3>
            <p className="text-sm text-muted-foreground">Broadcast message to all students</p>
          </button>
        </div>
      </div>

      {
    /* 7. Class Management */
  }
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Class Management
          </h2>
          <button
    className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground flex items-center gap-2 transition-all hover:scale-105"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
            <Plus className="h-4 w-4" />
            Create New Class
          </button>
        </div>
        
        <div className="space-y-3">
          {upcomingClasses.map((cls) => <div key={cls.id} className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/40 transition-colors">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{cls.subject}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {cls.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {cls.students} students
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-mono">
                  <Link className="h-3 w-3" />
                  {cls.link}
                </div>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary/10 transition-colors">
                  Share Link
                </button>
              </div>
            </div>)}
        </div>
      </div>
    </div>;
}
export {
  TeacherDashboard
};
