import { Bell, Plus, Eye, EyeOff, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopBarProps {
  onAddTransaction?: () => void;
}

export function TopBar({ onAddTransaction }: TopBarProps) {
  const { user } = useAuth();
  const { role, setRole, privacyMode, togglePrivacy, isAdmin } = usePreferences();
  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 glass">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button size="sm" onClick={onAddTransaction} className="gap-1.5 glow-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Transaction</span>
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRole(role === "admin" ? "viewer" : "admin")}
              className="gap-1.5 h-9"
            >
              {isAdmin ? <ShieldCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}
              <span className="hidden md:inline text-xs capitalize">{role}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle role (RBAC simulation)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={togglePrivacy} aria-label="Toggle privacy mode">
              {privacyMode ? <EyeOff className="w-4 h-4 text-warning" /> : <Eye className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{privacyMode ? "Show amounts" : "Hide amounts (Privacy)"}</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
        </Button>
        <Avatar className="h-8 w-8 border border-border">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
