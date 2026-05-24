// Auth has been removed — the app is fully public.
// This stub keeps existing `useAuth()` call sites working by returning a
// stable local guest identity used purely for client-side keying.

const GUEST_KEY = "smartspend_guest_id";

function getGuestId(): string {
  if (typeof window === "undefined") return "guest";
  let id = window.localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export const useAuth = () => {
  const id = getGuestId();
  return {
    user: {
      id,
      email: "guest@smartspend.local",
      user_metadata: { full_name: "Guest" },
    },
    session: null,
    loading: false,
    signUp: async () => {},
    signIn: async () => {},
    signOut: async () => {},
  };
};
