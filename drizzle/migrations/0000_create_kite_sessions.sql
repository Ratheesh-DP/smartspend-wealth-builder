CREATE TABLE public.kite_sessions (
  client_id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  access_token TEXT NOT NULL,
  user_id TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.kite_sessions TO service_role;
ALTER TABLE public.kite_sessions ENABLE ROW LEVEL SECURITY;