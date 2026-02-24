import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TrendingUp, Wallet, BarChart3 } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Welcome back!");
      } else {
        await signUp(email, password, fullName);
        toast.success("Account created! Check your email to verify.");
      }
      navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="relative z-10 max-w-md text-center space-y-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight">
              Smart<span className="text-primary">Spend</span>
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Your AI-powered personal finance & investment co-pilot
          </p>
          <div className="grid gap-4 mt-8">
            <div className="flex items-center gap-4 glass rounded-xl p-4">
              <TrendingUp className="w-8 h-8 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-medium">Smart Insights</p>
                <p className="text-sm text-muted-foreground">AI-driven spending analysis & alerts</p>
              </div>
            </div>
            <div className="flex items-center gap-4 glass rounded-xl p-4">
              <BarChart3 className="w-8 h-8 text-accent shrink-0" />
              <div className="text-left">
                <p className="font-medium">Investment Advisor</p>
                <p className="text-sm text-muted-foreground">Tailored portfolio for Indian markets</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-md glass border-border/50">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2 lg:hidden">
              <Wallet className="w-6 h-6 text-primary" />
              <span className="text-xl font-display font-bold">Smart<span className="text-primary">Spend</span></span>
            </div>
            <CardTitle className="text-2xl font-display">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to your account" : "Start your financial journey"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Manish Ahuja"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
