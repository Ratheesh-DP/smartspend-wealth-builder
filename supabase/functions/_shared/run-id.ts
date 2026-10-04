const HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(HEADER)) headers.set(HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(HEADER)?.trim() || undefined;
      return response;
    },
  };
}

export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(HEADER)?.trim() || undefined;
}

export function getLovableAiGatewayResponseHeaders(upstream: Headers, init?: HeadersInit) {
  const headers = new Headers(init);
  const exposed = new Set((headers.get("Access-Control-Expose-Headers") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  upstream.forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      headers.set(name, value);
      exposed.add(name);
    }
  });
  if (exposed.size) headers.set("Access-Control-Expose-Headers", Array.from(exposed).join(", "));
  return headers;
}