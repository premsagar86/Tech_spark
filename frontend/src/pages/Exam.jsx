import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { createProctor } from "../proctor/proctorClient.js";
import ExtensionGate from "../exam/ExtensionGate.jsx";
import ConsentScreen from "../exam/ConsentScreen.jsx";
import StrikeBanner from "../exam/StrikeBanner.jsx";
import FullscreenOverlay from "../exam/FullscreenOverlay.jsx";
import QuestionView from "../exam/QuestionView.jsx";
import SubmittedScreen from "../exam/SubmittedScreen.jsx";

const EXTENSION_URL = import.meta.env.VITE_PROCTOR_EXTENSION_URL || "";
const AUTOSAVE_MS = 10000;

// Phases: loading -> error | closed | done | gate -> consent -> ready -> running -> submitting
export default function Exam() {
  const { slug } = useParams();

  const [phase, setPhase] = useState("loading");
  const [meta, setMeta] = useState(null);
  const [message, setMessage] = useState("");
  const [handshake, setHandshake] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [strikes, setStrikes] = useState({ count: 0, limit: 3, lastKind: null });
  const [fullscreenOk, setFullscreenOk] = useState(true);
  const [result, setResult] = useState(null);

  const proctorRef = useRef(null);
  const attemptIdRef = useRef(null);
  const answersRef = useRef(answers);
  const dirtyRef = useRef(new Set());
  const submittingRef = useRef(false);
  answersRef.current = answers;

  // ---- load exam meta ---------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getExam(slug);
        if (!alive) return;
        setMeta(data.exam);

        if (data.attempt && ["submitted", "auto_submitted", "expired"].includes(data.attempt.status)) {
          setResult({ status: data.attempt.status });
          setPhase("done");
          return;
        }
        if (data.window === "not_open") {
          setMessage("This exam has not opened yet.");
          setPhase("closed");
          return;
        }
        if (data.window === "closed") {
          setMessage("This exam is closed.");
          setPhase("closed");
          return;
        }

        proctorRef.current = createProctor({
          examSlug: data.exam.slug,
          strikeLimit: data.exam.strikeLimit,
          requireExtension: data.exam.requireExtension,
          requireCamera: data.exam.requireCamera,
        });
        setStrikes((s) => ({ ...s, limit: data.exam.strikeLimit }));

        wireProctorEvents(proctorRef.current);

        if (data.exam.requireExtension) {
          setPhase("gate");
          await doHandshake();
        } else {
          proctorRef.current.handshake().then(setHandshake).catch(() => {});
          setPhase("consent");
        }
      } catch (err) {
        if (!alive) return;
        setMessage(err.message || "Could not load the exam.");
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
      proctorRef.current?.disarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ---- proctor event wiring -------------------------------------------
  function wireProctorEvents(p) {
    p.on("strike", ({ count, limit, kind }) => {
      setStrikes({ count, limit, lastKind: kind !== "server" ? kind : null });
    });
    p.on("autosubmit", () => {
      submit(true);
    });
    p.on("handshake", (hs) => setHandshake(hs));
  }

  async function doHandshake() {
    const hs = await proctorRef.current.handshake();
    setHandshake(hs);
    if (hs.connected || !meta?.requireExtension) {
      setPhase((cur) => (cur === "gate" ? "consent" : cur));
    }
    return hs;
  }

  // ---- start ---------------------------------------------------------
  async function startExam() {
    setMessage("");
    try {
      const proof = handshake?.proof || null;
      const data = await api.startExam(slug, { extProof: proof });

      attemptIdRef.current = data.attemptId;
      proctorRef.current.configure({
        attemptId: data.attemptId,
        signingKey: data.signingKey,
        ingestPath: data.ingestPath,
      });

      setQuestions(data.questions);
      setDeadline(Date.now() + (data.remainingMs ?? data.durationMinutes * 60000));
      setStrikes({ count: data.strikes || 0, limit: data.strikeLimit, lastKind: null });

      // Resume: pull any previously saved answers.
      try {
        const st = await api.getExamAttempt(data.attemptId);
        const restored = {};
        for (const a of st.answers || []) restored[a.questionId] = a.answer;
        setAnswers(restored);
      } catch {
        /* fresh attempt */
      }

      await proctorRef.current.arm({ fullscreenTarget: document.documentElement });
      setPhase("running");
    } catch (err) {
      if (/already used your attempt/i.test(err.message)) {
        setResult({ status: "submitted" });
        setPhase("done");
        return;
      }
      if (/extension/i.test(err.message)) {
        setMessage(err.message);
        setPhase("gate");
        await doHandshake();
        return;
      }
      setMessage(err.message || "Could not start the exam.");
    }
  }

  // ---- timer -------------------------------------------------------
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const ms = Math.max(0, deadline - Date.now());
      setRemaining(ms);
      if (ms === 0) submit(false);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline]);

  // ---- fullscreen watch ------------------------------------------
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setFullscreenOk(proctorRef.current?.isFullscreen() ?? true);
    }, 800);
    return () => clearInterval(id);
  }, [phase]);

  // ---- autosave --------------------------------------------------
  const flushAnswers = useCallback(async () => {
    const id = attemptIdRef.current;
    if (!id || dirtyRef.current.size === 0) return;
    const batch = [...dirtyRef.current].map((qid) => ({ questionId: Number(qid), answer: answersRef.current[qid] ?? null }));
    dirtyRef.current.clear();
    try {
      await api.saveExamAnswers(id, batch);
    } catch (err) {
      // Put them back to retry on the next tick; if the attempt is over the
      // 409 will be handled by submit().
      batch.forEach((b) => dirtyRef.current.add(b.questionId));
      if (/is (submitted|auto_submitted|expired)/i.test(err.message) || /Time is up/i.test(err.message)) {
        submit(false);
      }
    }
    // `submit` only touches refs + stable setters, so a first-render capture is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(flushAnswers, AUTOSAVE_MS);
    const onHide = () => flushAnswers();
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase, flushAnswers]);

  function setAnswer(qid, value) {
    setAnswers((a) => ({ ...a, [qid]: value }));
    dirtyRef.current.add(qid);
  }

  // ---- submit --------------------------------------------------
  async function submit(auto) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    try {
      await flushAnswers();
    } catch {
      /* ignore */
    }
    proctorRef.current?.disarm();
    try {
      const res = await api.submitExamAttempt(attemptIdRef.current);
      setResult({ ...res, status: auto ? "auto_submitted" : res.status });
    } catch (err) {
      setResult({ status: auto ? "auto_submitted" : "submitted", error: err.message });
    }
    setPhase("done");
  }

  const mmss = useMemo(() => {
    const s = Math.ceil(remaining / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [remaining]);

  // ---- render -----------------------------------------------------
  if (phase === "loading") return <Centered>Loading…</Centered>;
  if (phase === "error") return <Centered><p className="text-red-400">{message}</p></Centered>;
  if (phase === "closed") return <Centered>{message}</Centered>;
  if (phase === "done") return <SubmittedScreen result={result} />;

  if (phase === "gate") {
    return (
      <div>
        {message && <p className="mx-auto max-w-lg px-6 pt-6 text-center text-sm text-red-400">{message}</p>}
        <ExtensionGate state={handshake} onRecheck={doHandshake} extensionUrl={EXTENSION_URL} />
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <ConsentScreen
        exam={meta}
        onAgree={() => setPhase("ready")}
        onCancel={() => (window.location.href = "/")}
      />
    );
  }

  if (phase === "ready") {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-3xl">{meta.title}</h1>
        <p className="mt-3 text-foreground-muted">
          Clicking start will enter fullscreen{meta.requireCamera ? ", turn on your camera," : ""} and begin the
          {" "}{meta.durationMinutes}-minute timer. Do not leave this tab.
        </p>
        {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
        <button
          onClick={startExam}
          className="mt-8 rounded-full bg-primary px-10 py-3 font-semibold text-background hover:bg-primary-light"
        >
          Start exam
        </button>
      </div>
    );
  }

  const submitting = phase === "submitting";

  return (
    <div className="min-h-screen bg-background">
      <StrikeBanner strikes={strikes.count} limit={strikes.limit} lastKind={strikes.lastKind} />
      {!fullscreenOk && !submitting && (
        <FullscreenOverlay onReturn={() => proctorRef.current?.requestFullscreen(document.documentElement)} />
      )}

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">{meta.title}</h1>
          <div className={`rounded-full px-4 py-1 font-mono text-lg ${remaining < 60000 ? "bg-red-600 text-white" : "bg-raised"}`}>
            {mmss}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrent(i)}
              className={`h-8 w-8 rounded text-sm ${
                i === current ? "bg-primary text-background" : answers[q.id] != null && String(answers[q.id]).length ? "bg-raised" : "border border-border"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {questions[current] && (
            <QuestionView
              index={current}
              total={questions.length}
              question={questions[current]}
              answer={answers[questions[current].id]}
              onChange={(v) => setAnswer(questions[current].id, v)}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="rounded-full border border-border px-6 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => submit(false)}
              disabled={submitting}
              className="rounded-full bg-primary px-8 py-2 font-semibold text-background hover:bg-primary-light disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit test"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div className="mx-auto max-w-lg px-6 py-24 text-center">{children}</div>;
}
