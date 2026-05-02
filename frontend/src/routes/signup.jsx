import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, AlertCircle } from "lucide-react";
const Route = createFileRoute("/signup")({
  component: SignupPage
});
function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student"
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    const result = await signup(formData.email, formData.password, formData.name, formData.role);
    setIsLoading(false);
    if (result.success) {
      router.navigate({ to: "/" });
    } else {
      setError(result.message);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background px-4">
      <div className="w-full max-w-md">
        {
    /* Logo */
  }
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold leading-tight">Adaptive<span className="text-gradient-primary">Mind</span></div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Create Account</div>
            </div>
          </Link>
        </div>

        {
    /* Card */
  }
        <div className="glass rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold mb-2">Sign Up</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Join AdaptiveMind as a {formData.role === "student" ? "student" : "teacher"}
          </p>

          {
    /* Role Selection */
  }
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
    type="button"
    onClick={() => setFormData({ ...formData, role: "student" })}
    className={`flex items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.role === "student" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
  >
              <GraduationCap className="h-5 w-5" />
              <span className="font-medium">Student</span>
            </button>
            <button
    type="button"
    onClick={() => setFormData({ ...formData, role: "teacher" })}
    className={`flex items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.role === "teacher" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
  >
              <Users className="h-5 w-5" />
              <span className="font-medium">Teacher</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {
    /* Name */
  }
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
    id="name"
    type="text"
    placeholder="John Doe"
    value={formData.name}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    className="h-12"
  />
            </div>

            {
    /* Email */
  }
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
    id="email"
    type="email"
    placeholder="john@example.com"
    value={formData.email}
    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
    className="h-12"
  />
            </div>

            {
    /* Password */
  }
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
    id="password"
    type="password"
    placeholder="••••••••"
    value={formData.password}
    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
    className="h-12"
  />
            </div>

            {
    /* Confirm Password */
  }
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
    id="confirmPassword"
    type="password"
    placeholder="••••••••"
    value={formData.confirmPassword}
    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
    className="h-12"
  />
            </div>

            {
    /* Error Message */
  }
            {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>}

            {
    /* Submit Button */
  }
            <Button
    type="submit"
    disabled={isLoading}
    className="w-full h-12 text-base font-semibold"
    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
  >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          {
    /* Login Link */
  }
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>

        {
    /* Footer */
  }
        <div className="mt-8 text-center text-xs text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link to="/" className="hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/" className="hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>;
}
export {
  Route
};
