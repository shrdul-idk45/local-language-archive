// frontend/src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api";
import WavePlayer from "./components/WavePlayer";
import { Star, Share2, Bookmark, MapPin } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function App() {
  const navigate = useNavigate();

  // core data
  const [entries, setEntries] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);

  // form state
  const [language, setLanguage] = useState("Hindi");
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("general");
  const [regionName, setRegionName] = useState("");
  const [regionLat, setRegionLat] = useState("");
  const [regionLng, setRegionLng] = useState("");

  // filters
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");

  // misc state
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wordOfDay, setWordOfDay] = useState(null);

  // recording
  const fileRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const [recordedBlob, setRecordedBlob] = useState(null);

  // comments
  const [commentsByEntry, setCommentsByEntry] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  // UI
  const [uiLang, setUiLang] = useState(localStorage.getItem("uiLang") || "en");
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  const UI = {
    en: {
      add: "Add",
      update: "Update",
      login: "Login",
      logout: "Logout",
      register: "Register",
      dark: "Dark",
      light: "Light",
      save: "Save",
      saved: "Saved",
    },
    hi: {
      add: "जोड़ें",
      update: "अपडेट",
      login: "लॉगिन",
      logout: "लॉगआउट",
      register: "रजिस्टर",
      dark: "डार्क",
      light: "लाइट",
      save: "सेव",
      saved: "सेव्ड",
    },
  };

  function t(k) {
    return (UI[uiLang] && UI[uiLang][k]) || UI.en[k] || k;
  }

  // persist UI language
  useEffect(() => {
    localStorage.setItem("uiLang", uiLang);
  }, [uiLang]);

  // dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // initial load
  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    await Promise.all([
      fetchEntries(),
      fetchWordOfDay(),
      fetchFavorites(),
      fetchRecent(),
    ]);
  }

  async function fetchEntries() {
    try {
      setLoading(true);
      const res = await api.get("/entries", {
        params: {
          q: query || undefined,
          category: filterCategory || undefined,
          language: filterLanguage || undefined,
        },
      });
      setEntries(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  async function fetchWordOfDay() {
    try {
      const r = await api.get("/word-of-day");
      if (r.data.ok) setWordOfDay(r.data.entry);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchFavorites() {
    try {
      const r = await api.get("/me/favorites");
      setFavorites(r.data);
    } catch (e) {
      // ignore 401 if not logged in
    }
  }

  async function fetchRecent() {
    try {
      const r = await api.get("/me/recent");
      setRecent(r.data);
    } catch (e) {
      // ignore if not logged in / not available
    }
  }

  function resetForm() {
    setLanguage("Hindi");
    setWord("");
    setMeaning("");
    setExample("");
    setTags("");
    setCategory("general");
    setRegionName("");
    setRegionLat("");
    setRegionLng("");
    setEditingId(null);
    setRecordedBlob(null);
    if (fileRef.current) fileRef.current.value = null;
  }

  // recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      let chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
    } catch (err) {
      console.error(err);
      toast.error("Microphone access denied or not available");
    }
  }

  function stopRecording() {
    if (mediaRef.current) mediaRef.current.stop();
    setRecording(false);
  }

  // create/update entry
  async function handleSubmit(e) {
    e && e.preventDefault();
    if (!word.trim()) return toast.error("Please enter a word");

    const fd = new FormData();
    fd.append("language", language);
    fd.append("word", word);
    fd.append("meaning", meaning);
    fd.append("example", example);
    fd.append(
      "tags",
      JSON.stringify(
        tags.split(",").map((t) => t.trim()).filter(Boolean)
      )
    );
    fd.append("category", category || "general");
    fd.append("region_name", regionName || "");
    fd.append("region_lat", regionLat || "");
    fd.append("region_lng", regionLng || "");

    if (fileRef.current?.files?.[0]) fd.append("audio", fileRef.current.files[0]);
    else if (recordedBlob) fd.append("audio", recordedBlob, "recording.webm");

    try {
      setLoading(true);
      if (editingId) {
        const res = await api.put(`/entries/${editingId}`, fd);
        setEntries((prev) =>
          prev.map((it) => (it.id === res.data.id ? res.data : it))
        );
        toast.success("Updated entry");
      } else {
        const res = await api.post("/entries", fd);
        setEntries((prev) => [res.data, ...prev]);
        toast.success("Added entry");
      }
      resetForm();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        if (confirm("You must be logged in to add/edit entries. Go to login?"))
          navigate("/login");
      } else {
        toast.error(err?.response?.data?.error || "Save failed");
      }
    } finally {
      setLoading(false);
    }
  }

function handleEdit(e) {
  setEditingId(e.id);
  setLanguage(e.language || "");
  setWord(e.word || "");
  setMeaning(e.meaning || "");
  setExample(e.example || "");

  // tags might be an array OR a JSON string -> normalize
  let tagArray = [];
  try {
    if (Array.isArray(e.tags)) {
      tagArray = e.tags;
    } else if (typeof e.tags === "string" && e.tags.trim()) {
      tagArray = JSON.parse(e.tags);
    }
  } catch {
    tagArray = [];
  }
  setTags(tagArray.join(", "));

  setCategory(e.category || "general");
  setRegionName(e.region_name || "");
  setRegionLat(e.region_lat || "");
  setRegionLng(e.region_lng || "");
  window.scrollTo({ top: 0, behavior: "smooth" });
}


  async function handleDelete(id) {
    if (!confirm("Delete this entry?")) return;
    try {
      await api.delete(`/entries/${id}`);
      setEntries((prev) => prev.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  }

  // votes
  async function upvote(id) {
    try {
      const r = await api.post(`/entries/${id}/upvote`);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, votes: r.data.votes } : e))
      );
      toast.success("Voted");
    } catch (err) {
      if (err?.response?.status === 401) {
        if (confirm("Login to vote?")) navigate("/login");
      } else toast.error("Vote failed");
    }
  }

  async function unupvote(id) {
    try {
      const r = await api.post(`/entries/${id}/unupvote`);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, votes: r.data.votes } : e))
      );
      toast("Removed vote");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove vote");
    }
  }

  // rating
  async function rate(id, n) {
    try {
      const r = await api.post(`/entries/${id}/rate`, { rating: n });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, avg_rating: r.data.avg } : e
        )
      );
      toast.success("Thanks for rating");
    } catch (err) {
      if (err?.response?.status === 401) {
        if (confirm("Login to rate?")) navigate("/login");
      } else toast.error("Rating failed");
    }
  }

  // AI enrich meaning+example
  async function aiEnrich() {
    if (!word.trim()) return toast.error("Enter a word first");
    try {
      setLoading(true);
      const res = await api.post("/ai/enrich", { language, word });
      if (res.data.meaning && !meaning) setMeaning(res.data.meaning);
      if (res.data.example && !example) setExample(res.data.example);
      toast.success("AI suggestions added");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "AI failed");
    } finally {
      setLoading(false);
    }
  }

  // AI sample sentences
  async function generateSentences(entryId) {
    try {
      const r = await api.post(`/entries/${entryId}/generate-sentences`);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, sample_sentences: JSON.stringify(r.data.sentences) }
            : e
        )
      );
      toast.success("Generated sample sentences");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "AI generation failed");
    }
  }

  // share link
  function copyShare(entry) {
    const url = `${window.location.origin}/public/${entry.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  // export CSV
  function exportCSV() {
    window.open(`${API_BASE}/export/csv`, "_blank");
  }

  // favorites
  function isFavorite(id) {
    return favorites.some((f) => f.id === id);
  }

  async function toggleFavorite(id, isFav) {
    try {
      if (isFav) {
        await api.post(`/entries/${id}/unfavorite`);
      } else {
        await api.post(`/entries/${id}/favorite`);
      }
      await fetchFavorites();
      toast.success(isFav ? "Removed from saved" : "Saved");
    } catch (err) {
      console.error(err);
      toast.error("Favorite failed");
    }
  }

  // comments
  async function loadComments(entryId) {
    try {
      const r = await api.get(`/entries/${entryId}/comments`);
      setCommentsByEntry((prev) => ({ ...prev, [entryId]: r.data }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load comments");
    }
  }

  async function addComment(entryId) {
    const text = commentDrafts[entryId];
    if (!text?.trim()) return;
    try {
      const r = await api.post(`/entries/${entryId}/comments`, { text });
      setCommentsByEntry((prev) => ({
        ...prev,
        [entryId]: [...(prev[entryId] || []), r.data],
      }));
      setCommentDrafts((prev) => ({ ...prev, [entryId]: "" }));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Comment failed");
    }
  }

  async function upvoteComment(id, entryId) {
    try {
      const r = await api.post(`/comments/${id}/upvote`);
      setCommentsByEntry((prev) => ({
        ...prev,
        [entryId]: (prev[entryId] || []).map((c) =>
          c.id === id ? { ...c, upvotes: r.data.upvotes } : c
        ),
      }));
    } catch (err) {
      console.error(err);
      toast.error("Comment upvote failed");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    toast("Logged out");
    navigate("/login");
  }

  const languages = [
    "Hindi",
    "Marathi",
    "Tamil",
    "Bengali",
    "Kannada",
    "English",
    "Other",
  ];

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-right" />
      <div className="app-inner">
        {/* Banner with title */}
        <div className="relative overflow-hidden rounded-2xl mb-8">
          <div className="h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 rounded-2xl shadow-2xl"></div>
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background:
                "linear-gradient(rgba(0,0,0,0.08), rgba(255,255,255,0.02))",
            }}
          />
          <div className="absolute inset-0 flex items-center">
            <div className="banner-inner">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
                Local Language Archive
              </h1>
              <p className="mt-2 text-sm text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
                Collect, listen and share local words — crowd-sourced and
                AI-assisted
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="flex items-center gap-4 mb-6 header-card">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Dashboard
            </h2>
            <p className="text-xs text-gray-500">
              Add entries, vote, save favourites & explore.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={uiLang}
              onChange={(e) => setUiLang(e.target.value)}
              className="border p-1 rounded text-xs select-hover"
            >
              <option value="en">English UI</option>
              <option value="hi">हिंदी UI</option>
            </select>
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="btn-ghost text-xs px-3 py-1"
            >
              {darkMode ? t("light") : t("dark")}
            </button>
            <Link to="/register" className="btn-ghost text-xs px-3 py-1">
              {t("register")}
            </Link>
            <Link to="/login" className="btn-ghost text-xs px-3 py-1">
              {t("login")}
            </Link>
            <button
              onClick={logout}
              className="btn-ghost text-xs px-3 py-1"
            >
              {t("logout")}
            </button>
          </div>
        </header>

        {/* Word of day */}
        {wordOfDay && (
          <div className="entry-card mb-4">
            <strong className="text-sm text-gray-100/90">
              Word of the day:
            </strong>
            <span className="ml-2 text-lg font-semibold">
              {wordOfDay.word}
            </span>{" "}
            — <span className="text-sm">{wordOfDay.meaning}</span>
          </div>
        )}

        {/* Form card */}
        <form onSubmit={handleSubmit} className="form-card mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white/90">
                {editingId ? "Edit word" : "Add word"}
              </h2>
              <p className="text-xs text-gray-300">
                Fill details, optionally add audio & region.
              </p>
            </div>
            <div className="space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="btn-ghost text-xs px-3 py-1"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-200 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full select-hover"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-200 mb-1">
                Word
              </label>
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Enter word"
                className="w-full input-hover"
              />
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-200">
                  Meaning
                </label>
                <button
                  type="button"
                  onClick={aiEnrich}
                  className="btn-ghost text-[11px] px-2 py-1"
                >
                  Use AI to suggest meaning & example
                </button>
              </div>
              <textarea
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                rows={2}
                className="w-full input-hover"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm text-gray-200 mb-1">
                Example
              </label>
              <input
                value={example}
                onChange={(e) => setExample(e.target.value)}
                className="w-full input-hover"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-200 mb-1">
                Tags (comma separated)
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full input-hover"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-200 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full select-hover"
              >
                <option value="general">General</option>
                <option value="slang">Slang</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            {/* region / dialect */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-200 mb-1">
                  Region / Dialect name
                </label>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-300" />
                  <input
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    placeholder="e.g. Pune, Vidarbha, Chennai..."
                    className="w-full input-hover"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-200 mb-1">
                  Latitude (optional)
                </label>
                <input
                  value={regionLat}
                  onChange={(e) => setRegionLat(e.target.value)}
                  placeholder="e.g. 18.5204"
                  className="w-full input-hover"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-200 mb-1">
                  Longitude (optional)
                </label>
                <input
                  value={regionLng}
                  onChange={(e) => setRegionLng(e.target.value)}
                  placeholder="e.g. 73.8567"
                  className="w-full input-hover"
                />
              </div>
            </div>

            {/* audio + actions */}
            <div className="md:col-span-3 flex flex-wrap items-center gap-3 mt-2">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                id="audioFile"
              />
              <label
                htmlFor="audioFile"
                className="btn-ghost text-xs px-3 py-2 cursor-pointer"
              >
                Upload audio
              </label>

              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className="btn-ghost text-xs px-3 py-2"
              >
                {recording ? "Stop recording" : "Record"}
              </button>
              {recordedBlob && (
                <audio
                  controls
                  src={URL.createObjectURL(recordedBlob)}
                  className="h-8"
                />
              )}

              <div className="ml-auto flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-sm"
                >
                  {editingId ? t("update") : t("add")}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-ghost text-sm px-3 py-2"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Filters + actions */}
        <section className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded border p-2 w-52 input-hover"
          />
          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="rounded border p-2 select-hover"
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded border p-2 select-hover"
          >
            <option value="">All categories</option>
            <option value="general">General</option>
            <option value="slang">Slang</option>
            <option value="formal">Formal</option>
          </select>
          <button onClick={fetchEntries} className="btn-ghost px-3 py-2">
            Search
          </button>
          <button onClick={exportCSV} className="btn-ghost px-3 py-2">
            Export CSV
          </button>
          <div className="ml-auto text-xs text-gray-200">
            Entries: <strong>{entries.length}</strong>
          </div>
        </section>

        {/* Recent + favorites badges */}
        <section className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-200">
          <div>
            <h3 className="mb-1 font-semibold text-white/80">
              Recently viewed
            </h3>
            <div className="flex flex-wrap gap-2">
              {recent.length === 0 && (
                <span className="text-gray-400">None yet</span>
              )}
              {recent.map((e) => (
                <span key={e.id} className="tag">
                  {e.word} ({e.language})
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-white/80">
              Saved words
            </h3>
            <div className="flex flex-wrap gap-2">
              {favorites.length === 0 && (
                <span className="text-gray-400">No favourites yet</span>
              )}
              {favorites.map((e) => (
                <span key={e.id} className="tag">
                  {e.word}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Entries list */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center text-gray-300 p-6">
              Loading entries...
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="text-center text-gray-300 p-6">
              No entries found
            </div>
          )}

          {entries.map((e) => (
            <div
              key={e.id}
              className="entry-card flex flex-col md:flex-row gap-4"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    {e.word}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-200">
                    {e.language}
                  </span>
                  <span className="tag">{e.category}</span>
                  {e.region_name && (
                    <span className="tag flex items-center gap-1">
                      <MapPin size={12} /> {e.region_name}
                    </span>
                  )}
                  <div className="ml-auto text-xs text-gray-400">
                    {e.votes || 0} votes
                    {e.avg_rating ? ` · ${e.avg_rating.toFixed(1)}★` : ""}
                  </div>
                </div>
                <p className="mt-2 text-gray-200">{e.meaning}</p>
                {e.example && (
                  <p className="mt-1 italic text-gray-300">{e.example}</p>
                )}

                {/* normalize sample sentences + tags per entry */}
{(() => {
  let sampleSentences = [];
  let tagArray = [];

  // sample_sentences might be array or JSON string
  try {
    if (Array.isArray(e.sample_sentences)) {
      sampleSentences = e.sample_sentences;
    } else if (
      typeof e.sample_sentences === "string" &&
      e.sample_sentences.trim()
    ) {
      sampleSentences = JSON.parse(e.sample_sentences);
    }
  } catch {
    sampleSentences = [];
  }

  // tags might be array or JSON string
  try {
    if (Array.isArray(e.tags)) {
      tagArray = e.tags;
    } else if (typeof e.tags === "string" && e.tags.trim()) {
      tagArray = JSON.parse(e.tags);
    }
  } catch {
    tagArray = [];
  }

  return (
    <>
      {sampleSentences.length > 0 && (
        <div className="mt-2 text-xs text-gray-200">
          <strong>Sample sentences:</strong>
          {sampleSentences.map((s, i) => (
            <p key={i} className="mt-1 italic">
              • {s}
            </p>
          ))}
        </div>
      )}

      {tagArray.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tagArray.map((t, i) => (
            <span key={i} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );
})()}


                {e.audio_filename && (
                  <div className="mt-3">
                    <WavePlayer
                      src={`${API_BASE}/uploads/${e.audio_filename}`}
                    />
                  </div>
                )}

                {/* comments */}
                <div className="mt-3 border-t border-white/10 pt-3 text-sm text-gray-100/90">
                  <button
                    type="button"
                    onClick={() => loadComments(e.id)}
                    className="btn-ghost text-xs mb-2 px-2 py-1"
                  >
                    View comments
                  </button>

                  {(commentsByEntry[e.id] || []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between mb-1"
                    >
                      <div className="mr-2">
                        <span className="text-[11px] text-gray-300">
                          {c.author_email || "user"}
                        </span>
                        <p>{c.text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => upvoteComment(c.id, e.id)}
                        className="btn-ghost text-[11px] px-2 py-1"
                      >
                        ▲ {c.upvotes}
                      </button>
                    </div>
                  ))}

                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 input-hover text-xs"
                      placeholder="Add a comment..."
                      value={commentDrafts[e.id] || ""}
                      onChange={(ev) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [e.id]: ev.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => addComment(e.id)}
                      className="btn-primary text-xs"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>

              {/* actions column */}
              <div className="flex flex-col gap-2 items-end w-40">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(e)}
                    className="btn-ghost text-xs px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="btn-ghost text-xs px-2 py-1 text-red-400"
                  >
                    Delete
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => upvote(e.id)}
                    className="btn-ghost text-xs px-3 py-1 flex items-center gap-1"
                  >
                    <Star size={13} /> {e.votes || 0}
                  </button>
                  <button
                    onClick={() => unupvote(e.id)}
                    className="btn-ghost text-[11px] px-2 py-1"
                  >
                    remove
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => rate(e.id, n)}
                      className="btn-ghost text-[11px] px-2 py-1"
                    >
                      {n}★
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => generateSentences(e.id)}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  AI sentences
                </button>

                <button
                  onClick={() => copyShare(e)}
                  className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                >
                  <Share2 size={13} /> Share
                </button>

                <button
                  onClick={() => toggleFavorite(e.id, isFavorite(e.id))}
                  className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
                >
                  <Bookmark
                    size={13}
                    className={isFavorite(e.id) ? "text-pink-400" : ""}
                  />
                  {isFavorite(e.id) ? t("saved") : t("save")}
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-8 text-[11px] text-gray-300">
          Tip: You must be logged in to add/edit/delete, vote, rate, comment,
          save favourites, or use AI generation.
        </footer>
      </div>
    </div>
  );
}
