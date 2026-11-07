type ServerEvent = {
  name: string;
  properties: Record<string, string>;
};

const OPENPANEL_API = "https://api.openpanel.dev";

const OPENPANEL_CLIENT_ID = process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID ?? "";

const OPENPANEL_SECRET = process.env.OPENPANEL_CLIENT_SECRET ?? "";

const ANALYTICS_ON =
  process.env.VERCEL_ENV === "production" && OPENPANEL_CLIENT_ID !== "";

const SERVER_EVENTS_ON = ANALYTICS_ON && OPENPANEL_SECRET !== "";

const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  request.headers.get("x-real-ip") ??
  "";

const trackServer = async (
  request: Request,
  { name, properties }: ServerEvent
): Promise<void> => {
  if (!SERVER_EVENTS_ON) {
    return;
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": request.headers.get("user-agent") ?? "",
    "openpanel-client-id": OPENPANEL_CLIENT_ID,
    "openpanel-client-secret": OPENPANEL_SECRET,
  });
  const ip = clientIp(request);

  if (ip !== "") {
    headers.set("openpanel-client-ip", ip);
  }

  await fetch(`${OPENPANEL_API}/track`, {
    body: JSON.stringify({ payload: { name, properties }, type: "track" }),
    headers,
    method: "POST",
  }).catch(() => null);
};

export type { ServerEvent };
export { ANALYTICS_ON, OPENPANEL_CLIENT_ID, trackServer };
