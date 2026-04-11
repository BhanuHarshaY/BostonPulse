/**
 * Server-side data fetchers for live Boston context.
 *
 * These run directly in the Next.js API route before calling the agent,
 * so the agent receives pre-fetched data as context in its instructions
 * rather than needing to call external function tools over the network.
 */

export interface BostonLiveData {
  mbta: string;
  weather: string;
  events: string;
}

export async function fetchMBTAAlerts(): Promise<string> {
  try {
    const res = await fetch(
      "https://api-v3.mbta.com/alerts?filter[activity]=BOARD&filter[lifecycle]=NEW,ONGOING,ONGOING_UPCOMING&sort=severity",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return `MBTA API error: ${res.status}`;
    const data = await res.json();
    const alerts = (data.data ?? [])
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => {
        const attr = a.attributes ?? {};
        return `[${attr.effect ?? "ALERT"}] ${attr.header ?? ""}${attr.description ? " — " + (attr.description as string).slice(0, 150) : ""}`;
      });
    if (alerts.length === 0) return "No active MBTA alerts.";
    return alerts.join("\n");
  } catch (err) {
    return `MBTA fetch failed: ${err instanceof Error ? err.message : err}`;
  }
}

export async function fetchBostonWeather(): Promise<string> {
  try {
    const key = process.env.OPENWEATHERMAP_API_KEY;
    if (!key) return "Weather unavailable (OPENWEATHERMAP_API_KEY not set).";
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Boston,MA,US&appid=${key}&units=imperial`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return `Weather API error: ${res.status}`;
    const d = await res.json();
    const rain = d.rain ? ", rain expected" : "";
    return `${Math.round(d.main.temp)}°F, feels like ${Math.round(d.main.feels_like)}°F, ${d.weather[0].description}, humidity ${d.main.humidity}%, wind ${Math.round(d.wind.speed)} mph${rain}.`;
  } catch (err) {
    return `Weather fetch failed: ${err instanceof Error ? err.message : err}`;
  }
}

export async function fetchCityEvents(): Promise<string> {
  try {
    const clientId = process.env.SEATGEEK_CLIENT_ID;
    if (!clientId) return "City events unavailable (SEATGEEK_CLIENT_ID not set).";
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(
      `https://api.seatgeek.com/2/events?venue.city=boston&datetime_local.gte=${today}T00:00:00&datetime_local.lte=${today}T23:59:59&per_page=8&sort=score.desc&client_id=${clientId}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return `SeatGeek API error: ${res.status}`;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (data.events ?? []).map((e: any) =>
      `${e.title} @ ${e.venue?.name ?? "TBD"} at ${e.datetime_local?.slice(11, 16) ?? "TBD"}`,
    );
    if (events.length === 0) return "No events found in Boston today.";
    return events.join("\n");
  } catch (err) {
    return `Events fetch failed: ${err instanceof Error ? err.message : err}`;
  }
}

export async function fetchAllBostonData(): Promise<BostonLiveData> {
  const [mbta, weather, events] = await Promise.all([
    fetchMBTAAlerts(),
    fetchBostonWeather(),
    fetchCityEvents(),
  ]);
  return { mbta, weather, events };
}
