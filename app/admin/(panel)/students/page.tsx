import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { fmtBd } from "@/lib/time";
import { aggregate, genderLabel, statusLabel } from "@/lib/studentAgg";
import { filtersToQuery, loadAttemptRows, MAX_ROWS, parseFilters } from "@/lib/studentList";

const SHOW = 200;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const f = parseFilters(await searchParams);
  const [{ data: centerRows }, { rows, truncated }] = await Promise.all([
    db().from("centers").select("id, name").order("name"),
    loadAttemptRows(f),
  ]);
  const centers = (centerRows ?? []) as { id: string; name: string }[];

  const unique = aggregate(rows);
  const startedOnly = rows.filter((r) => r.status === "in_progress").length;
  const query = filtersToQuery(f);

  return (
    <>
      <h1>Student list</h1>
      <p className="muted">
        Every person who clicked <strong>Start Quiz</strong> appears here, whether or not they finished. Dates use Bangladesh time and are matched against when they clicked Start.
      </p>

      <form method="get" className="card">
        <div className="row">
          <div><label htmlFor="from">From date</label><input id="from" name="from" type="date" defaultValue={f.from} /></div>
          <div><label htmlFor="to">To date</label><input id="to" name="to" type="date" defaultValue={f.to} /></div>
          <div>
            <label htmlFor="center">Coaching center</label>
            <select id="center" name="center" defaultValue={f.center}>
              <option value="">All centers</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" defaultValue={f.gender}>
              <option value="">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unspecified">Not given</option>
            </select>
          </div>
          <div>
            <label htmlFor="status">Quiz status</label>
            <select id="status" name="status" defaultValue={f.status}>
              <option value="">Started or finished</option>
              <option value="started">Started only (not finished)</option>
              <option value="finished">Finished</option>
            </select>
          </div>
          <div>
            <label htmlFor="view">Show</label>
            <select id="view" name="view" defaultValue={f.view}>
              <option value="unique">Unique students (one row each)</option>
              <option value="attempts">Every Start Quiz click</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="smallbtn" type="submit">Apply filters</button>
          <a className="smallbtn" href="/admin/students">Clear</a>
          <a className="smallbtn" href={`/admin/students/export?${query}`}>Download CSV</a>
        </div>
      </form>

      {truncated && <div className="notice" role="alert">Showing the newest {MAX_ROWS.toLocaleString()} starts only. Narrow the date range to see everything.</div>}

      <div className="grid" style={{ marginBottom: 16 }}>
        {([
          ["Unique students", unique.length],
          ["Start Quiz clicks", rows.length],
          ["Started only (not finished)", startedOnly],
          ["Finished", rows.length - startedOnly],
        ] as [string, number][]).map(([label, n]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="score" style={{ fontSize: "2rem" }}>{n}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        {f.view === "unique" ? (
          <table className="t">
            <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Center (latest)</th><th>Starts</th><th>Finished</th><th>Best score</th><th>Last started</th></tr></thead>
            <tbody>
              {unique.slice(0, SHOW).map((u) => (
                <tr key={u.studentId}>
                  <td>{u.name}</td><td>{u.phone}</td><td>{genderLabel(u.gender)}</td><td>{u.center}</td>
                  <td>{u.attempts}</td><td>{u.finished}</td>
                  <td>{u.bestScore === null ? "-" : `${u.bestScore}/${u.bestTotal}`}</td>
                  <td>{fmtBd(u.lastStart)}</td>
                </tr>
              ))}
              {unique.length === 0 && <tr><td colSpan={8} className="muted">No students match these filters.</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="t">
            <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Center</th><th>Started</th><th>Status</th><th>Score</th></tr></thead>
            <tbody>
              {rows.slice(0, SHOW).map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td><td>{r.phone}</td><td>{genderLabel(r.gender)}</td><td>{r.center}</td>
                  <td>{fmtBd(r.startedAt)}</td><td>{statusLabel(r.status)}</td>
                  <td>{r.status === "in_progress" || r.score === null ? "-" : `${r.score}/${r.total}`}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="muted">No starts match these filters.</td></tr>}
            </tbody>
          </table>
        )}
        {(f.view === "unique" ? unique.length : rows.length) > SHOW && (
          <p className="muted" style={{ marginTop: 10 }}>Showing the first {SHOW}. Download the CSV for the full list.</p>
        )}
      </div>
    </>
  );
}
