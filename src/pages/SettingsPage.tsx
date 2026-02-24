import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsPage = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Settings</h1>
      <Card className="glass border-border/30 max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-display">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-sm font-medium">{user?.user_metadata?.full_name || "Not set"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
