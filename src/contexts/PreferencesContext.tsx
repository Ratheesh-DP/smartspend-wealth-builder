import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Role = "viewer" | "admin";

interface PreferencesValue {
  role: Role;
  setRole: (r: Role) => void;
  privacyMode: boolean;
  togglePrivacy: () => void;
  isAdmin: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

const ROLE_KEY = "smartspend_role";
const PRIVACY_KEY = "smartspend_privacy";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return "admin";
    return (localStorage.getItem(ROLE_KEY) as Role) || "admin";
  });
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PRIVACY_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(ROLE_KEY, role);
  }, [role]);
  useEffect(() => {
    localStorage.setItem(PRIVACY_KEY, privacyMode ? "1" : "0");
  }, [privacyMode]);

  return (
    <PreferencesContext.Provider
      value={{
        role,
        setRole: setRoleState,
        privacyMode,
        togglePrivacy: () => setPrivacyMode((p) => !p),
        isAdmin: role === "admin",
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

/** Formats a numeric ₹ amount, returning a masked string when privacy mode is on. */
export function useFormatAmount() {
  const { privacyMode } = usePreferences();
  return (value: number, opts?: { signed?: boolean }) => {
    if (privacyMode) return "₹ ••••••";
    const abs = Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = opts?.signed && value > 0 ? "+" : "";
    return `${sign}₹${abs}`;
  };
}