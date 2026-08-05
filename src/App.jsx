import React, { useEffect, useState } from "react";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import "./App.css";

const FEEDS = {
  talous: "https://yle.fi/rss/t/18-204933/fi",
  tuoreimmat: "https://yle.fi/rss/uutiset/tuoreimmat",
  luetuimmat: "https://yle.fi/rss/uutiset/luetuimmat",
  pääuutiset: "https://yle.fi/rss/uutiset/paauutiset",
};

const MAX_REFRESHES = 5;
const REFRESH_INTERVAL = 60 * 1000;

export default function App() {
  const [articles, setArticles] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState("talous");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchNews = async (feedKey) => {
    setLoading(true);
    setError(null);

    const now = Date.now();
    const refreshCountKey = `refreshCount_${feedKey}`;
    const refreshTimeKey = `refreshTime_${feedKey}`;

    let refreshCount = parseInt(localStorage.getItem(refreshCountKey)) || 0;
    let lastRefreshTime = parseInt(localStorage.getItem(refreshTimeKey)) || 0;

    if (now - lastRefreshTime > REFRESH_INTERVAL) {
      refreshCount = 0;
    }

    if (refreshCount >= MAX_REFRESHES) {
      setError("Liian monta päivitystä, yritä minuutin kuluttua.");
      setLoading(false);
      return;
    }

    localStorage.setItem(refreshCountKey, refreshCount + 1);
    localStorage.setItem(refreshTimeKey, now);

    try {
      const url = `/api/rss?url=${encodeURIComponent(FEEDS[feedKey])}`;
      const res = await axios.get(url);

      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });

      const jsonObj = parser.parse(res.data);
      const channel = jsonObj?.rss?.channel || jsonObj?.channel;
      let items = channel?.item ?? [];

      if (!Array.isArray(items)) {
        items = items ? [items] : [];
      }

      setArticles(items);
      localStorage.setItem(`articles_${feedKey}`, JSON.stringify(items));

      const time = new Date().toISOString();
      localStorage.setItem(`lastUpdated_${feedKey}`, time);

      setLastUpdated(new Date().toLocaleTimeString("fi-FI"));
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setError("Uutisten haku epäonnistui");

      const saved = localStorage.getItem(`articles_${feedKey}`);
      if (saved) {
        setArticles(JSON.parse(saved));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(`articles_${selectedFeed}`);
    const time = localStorage.getItem(`lastUpdated_${selectedFeed}`);

    if (saved) {
      setArticles(JSON.parse(saved));
      if (time) {
        setLastUpdated(new Date(time).toLocaleTimeString("fi-FI"));
      }
      setLoading(false);
    } else {
      fetchNews(selectedFeed);
    }
  }, [selectedFeed]);

  return (
    <div className="min-h-screen py-10 px-4 body">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-xl">
        <h1 className="text-4xl font-bold text-center mb-6">Ylen uutiset</h1>

        {/* FEED BUTTONS */}
        <div className="flex gap-3 justify-center mb-6 flex-wrap">
          {Object.keys(FEEDS).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedFeed(key)}
              className={`px-4 py-2 rounded-full ${
                selectedFeed === key ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {/* REFRESH */}
        <div className="flex justify-between mb-4">
          <button
            onClick={() => fetchNews(selectedFeed)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Päivitä
          </button>

          {lastUpdated && <span>Viimeksi: {lastUpdated}</span>}
        </div>

        {/* CONTENT */}
        {loading ? (
          <p>Ladataan...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <ul className="space-y-5">
            {articles.map((item, i) => (
              <li key={i} className="p-4 border rounded">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-bold"
                >
                  {item.title}
                </a>
                <p className="text-sm mt-2">{item.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
