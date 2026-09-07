// Renders one question and reports answer changes up to Exam.jsx.
//  - mcq   -> checkboxes; answer is always an array of option strings
//  - short -> single-line text; answer is a string
//  - coding-> monospace textarea; answer is a string (manually scored)
export default function QuestionView({ index, total, question, answer, onChange }) {
  const q = question;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="text-xs uppercase tracking-wide text-foreground-muted">
        Question {index + 1} of {total} · {q.points} {q.points === 1 ? "point" : "points"}
        {q.type === "mcq" && q.multi ? " · select all that apply" : ""}
      </div>
      <p className="mt-2 whitespace-pre-wrap font-medium">{q.prompt}</p>

      {q.type === "mcq" && (
        <div className="mt-4 space-y-2">
          {(q.options || []).map((opt) => {
            const arr = Array.isArray(answer) ? answer : [];
            const checked = arr.includes(opt);
            return (
              <label key={opt} className="flex cursor-pointer items-center gap-3 rounded border border-border p-2 hover:border-primary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, opt] : arr.filter((x) => x !== opt);
                    onChange(q.multi ? next : e.target.checked ? [opt] : []);
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "short" && (
        <input
          type="text"
          value={answer ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-4 w-full rounded border border-border bg-background px-3 py-2"
          placeholder="Your answer"
        />
      )}

      {q.type === "coding" && (
        <textarea
          value={answer ?? q.starterCode ?? ""}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={14}
          className="mt-4 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
        />
      )}
    </div>
  );
}
