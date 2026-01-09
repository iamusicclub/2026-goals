"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type GoalKey = "material" | "ego" | "running";

type DailyEntry = {
  date: string; // YYYY-MM-DD
  rating: Record<GoalKey, number>; // 1..5
  notes: Record<GoalKey, string>;
};

const GOALS: { key: GoalKey; title: string; prompt: string }[] = [
  {
    key: "material",
    title: "Less Material Focus",
    prompt:
      "Did I avoid unnecessary spending and value what I already have today?",
  },
  {
    key: "ego",
    title: "Less Ego-led",
    prompt:
      "Did I act with humility and kindness, prioritising truth over ego today?",
  },
  {
    key: "running",
    title: "Build My Running Career",
    prompt:
      "Did I take meaningful action to improve my running (training, recovery, planning) today?",
  },
];

const MANTRAS: Record<GoalKey, string[]> = {
  material: [
    "Use what you have. Want less. Live more.",
    "Pause before purchase: will this matter in a week?",
    "Gratitude beats upgrades.",
  ],
  ego: [
    "Choose curiosity over being right.",
    "Let actions speak louder than identity.",
    "Be soft in tone, firm in values.",
  ],
  running: [
    "Consistency beats intensity.",
    "Train with patience; race with courage.",
    "Small wins compound.",
  ],
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(dateISO: string) {
  return dateISO.slice(0, 7); // YYYY-MM
}

function randomMantra(key: GoalKey) {
  const arr = MANTRAS[key];
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function HomePage() {
  // Auth state
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const uid = user?.uid ?? null;

  // Simple email auth UI state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // App state
  const [date, setDate] = useState(todayISO());
  const [entry, setEntry] = useState<DailyEntry>(() => ({
    date: todayISO(),
    rating: { material: 3, ego: 3, running: 3 },
    notes: { material: "", ego: "", running: "" },
  }));

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [monthStats, setMonthStats] = useState<Record<GoalKey, number> | null>(
    null
  );

  const mantras = useMemo(
    () => ({
      material: randomMantra("material"),
      ego: randomMantra("ego"),
      running: randomMantra("running"),
    }),
    []
  );

  // ✅ Auth listener (replaces anonymous auth)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  // Load entry for selected date (if exists)
  useEffect(() => {
    if (!uid) return;

    (async () => {
      setStatus("");
      setEntry({
        date,
        rating: { material: 3, ego: 3, running: 3 },
        notes: { material: "", ego: "", running: "" },
      });

      try {
        const ref = doc(db, "users", uid, "entries", date);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setEntry({
            date,
            rating: data.rating,
            notes: data.notes,
          });
        }
      } catch (e: any) {
        console.error(e);
        setStatus(`Load error: ${String(e?.message ?? e)}`);
      }
    })();
  }, [uid, date]);

  // Load month stats
  useEffect(() => {
    if (!uid) return;

    (async () => {
      try {
        const mk = monthKey(date);
        const ref = doc(db, "users", uid, "months", mk);
        const snap = await getDoc(ref);
        if (snap.exists()) setMonthStats(snap.data() as any);
        else setMonthStats({ material: 0, ego: 0, running: 0 });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [uid, date]);

  async function recomputeMonth(uid: string, mk: string) {
    // Pull entries for the month and compute % (rating/5 average)
    const entriesRef = collection(db, "users", uid, "entries");
    const qy = query(entriesRef, orderBy("date", "asc"));
    const snaps = await getDocs(qy);

    let count = 0;
    let sum: Record<GoalKey, number> = { material: 0, ego: 0, running: 0 };

    snaps.forEach((s) => {
      const d = s.data() as any;
      const dIso = d.date as string;
      if (monthKey(dIso) !== mk) return;
      count += 1;
      sum.material += Number(d.rating?.material ?? 0);
      sum.ego += Number(d.rating?.ego ?? 0);
      sum.running += Number(d.rating?.running ?? 0);
    });

    const pct = (k: GoalKey) =>
      count === 0 ? 0 : Math.round((sum[k] / (count * 5)) * 100);

    const monthDoc = {
      material: pct("material"),
      ego: pct("ego"),
      running: pct("running"),
    };

    await setDoc(doc(db, "users", uid, "months", mk), monthDoc, { merge: true });
    setMonthStats(monthDoc);
  }

  async function save() {
    if (!uid) return;
    setSaving(true);
    setStatus("");

    try {
      const ref = doc(db, "users", uid, "entries", entry.date);
      await setDoc(
        ref,
        {
          date: entry.date,
          rating: entry.rating,
          notes: entry.notes,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await recomputeMonth(uid, monthKey(entry.date));
      setStatus("Saved ✓");
    } catch (e: any) {
      console.error(e);
      setStatus(`Save error: ${String(e?.message ?? e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignIn() {
    setStatus("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setEmail("");
      setPassword("");
      // user will populate via onAuthStateChanged
    } catch (e: any) {
      console.error(e);
      setStatus(`Sign-in error: ${String(e?.message ?? e)}`);
    }
  }

  async function handleSignUp() {
    setStatus("");
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      setEmail("");
      setPassword("");
    } catch (e: any) {
      console.error(e);
      setStatus(`Sign-up error: ${String(e?.message ?? e)}`);
    }
  }

  async function handleSignOut() {
    setStatus("");
    try {
      await signOut(auth);
      setMonthStats(null);
      setDate(todayISO());
      setEntry({
        date: todayISO(),
        rating: { material: 3, ego: 3, running: 3 },
        notes: { material: "", ego: "", running: "" },
      });
    } catch (e: any) {
      console.error(e);
      setStatus(`Sign-out error: ${String(e?.message ?? e)}`);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-2xl font-semibold">2026 Goals</h1>
        <p className="mt-2 text-sm text-zinc-600">Loading…</p>
      </main>
    );
  }

  // ✅ If not signed in, show login form
  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-50">
        <div className="mx-auto max-w-md px-5 py-10">
          <h1 className="text-3xl font-semibold tracking-tight">2026 Goals</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Sign in with the same email on every device to see the same entries.
          </p>

          <div className="mt-6 space-y-3 rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
            <div>
              <label className="text-xs text-zinc-400">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-50 ring-1 ring-zinc-800"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-50 ring-1 ring-zinc-800"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleSignIn}
                className="flex-1 rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950"
              >
                Sign in
              </button>
              <button
                onClick={handleSignUp}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-50 ring-1 ring-zinc-700"
              >
                Create account
              </button>
            </div>

            {status && <div className="text-sm text-zinc-300">{status}</div>}

            <p className="text-xs text-zinc-500">
              Tip: use a strong password; Firebase will manage sessions so you
              stay signed in.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ✅ Signed-in app
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <header className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                2026 Goals
              </h1>
              <p className="mt-2 text-zinc-300">
                Daily check-in for your three goals. Rate yesterday (or any
                day), add notes, and track monthly progress.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Signed in as: {user.email ?? "(no email)"}{" "}
                <span className="text-zinc-700">•</span> UID:{" "}
                <span className="text-zinc-600">{uid}</span>
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-50 ring-1 ring-zinc-800"
            >
              Sign out
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="text-sm text-zinc-300">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-50 ring-1 ring-zinc-800"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Tip: switch to yesterday to do the daily review.
              </p>
            </div>

            <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
              <div className="text-sm text-zinc-300">
                Month score ({monthKey(date)})
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center text-sm">
                {(["material", "ego", "running"] as GoalKey[]).map((k) => (
                  <div
                    key={k}
                    className="rounded-lg bg-zinc-950/60 px-2 py-2 ring-1 ring-zinc-800"
                  >
                    <div className="text-xs text-zinc-400">{k}</div>
                    <div className="mt-1 text-lg font-semibold">
                      {monthStats?.[k] ?? 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-5">
          {GOALS.map((g) => (
            <div
              key={g.key}
              className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{g.title}</h2>
                  <p className="mt-1 text-sm text-zinc-300">{g.prompt}</p>
                  <p className="mt-2 text-xs text-zinc-400 italic">
                    Mantra: {mantras[g.key]}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <label className="text-xs text-zinc-400">Rating (1–5)</label>
                  <select
                    value={entry.rating[g.key]}
                    onChange={(e) =>
                      setEntry((prev) => ({
                        ...prev,
                        rating: {
                          ...prev.rating,
                          [g.key]: Number(e.target.value),
                        },
                      }))
                    }
                    className="mt-1 w-24 rounded-lg bg-zinc-950 px-2 py-2 text-sm ring-1 ring-zinc-800"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs text-zinc-400">Notes</label>
                <textarea
                  value={entry.notes[g.key]}
                  onChange={(e) =>
                    setEntry((prev) => ({
                      ...prev,
                      notes: { ...prev.notes, [g.key]: e.target.value },
                    }))
                  }
                  placeholder="What happened today? What will you do tomorrow?"
                  className="mt-1 w-full rounded-xl bg-zinc-950 px-3 py-3 text-sm text-zinc-50 ring-1 ring-zinc-800 placeholder:text-zinc-600"
                  rows={3}
                />
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={save}
            disabled={saving || !uid}
            className="rounded-xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>

          <div className="text-sm text-zinc-300">{status}</div>
        </div>

        <footer className="mt-10 text-xs text-zinc-500">
          Signed in with email. Data is stored under your Firebase user ID and
          will sync across devices when you sign in with the same account.
        </footer>
      </div>
    </main>
  );
}
