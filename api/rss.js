import axios from "axios";

// yksinkertainen in-memory cache (Vercelissä toimii instanssikohtaisesti)
const cache = new Map();

const CACHE_TTL = 60 * 1000; // 1 minuutti

// Sallitut lähteet (turvallisuustarkistus, estää rajapinnan väärinkäytön)
const ALLOWED_DOMAINS = ["yle.fi"];

export default async function handler(req, res) {
  // Sallitaan CORS, jotta frontend voi kutsua tätä rajapintaa ongelmitta
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url" });
  }

  // Estetään SSRF-riskit ja varmistetaan, että osoite on sallitusta lähteestä (Yle)
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    // Tarkistetaan, että osoite kuuluu sallittuun verkkotunnukseen
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`),
    );

    if (!isAllowed) {
      return res.status(403).json({ error: "Domain not allowed" });
    }
  } catch (e) {
    return res.status(400).json({ error: "Malformed URL" });
  }

  const cached = cache.get(url);
  const now = Date.now();

  // ✅ palauta cache jos voimassa
  if (cached && now - cached.time < CACHE_TTL) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).send(cached.data);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      timeout: 8000,
      responseType: "text", // Varmistetaan, että haetaan raakamuotoisena tekstinä/xml:nä
    });

    const responseData = String(response.data);

    // tallenna cacheen
    cache.set(url, {
      data: responseData,
      time: now,
    });

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("X-Cache", "MISS");

    return res.status(200).send(responseData);
  } catch (err) {
    console.error(
      "RSS fetch error details:",
      err.response?.data || err.message,
    );
    return res
      .status(500)
      .json({ error: "RSS fetch failed", details: err.message });
  }
}
