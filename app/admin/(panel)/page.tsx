import { db } from "@/lib/supabase";

export default async function Overview() {
  const s = db();
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = s.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count: c } = await q;
    return c ?? 0;
  };
  const [students, attempts, entries, questions, centers, flagged] = await Promise.all([
    count("students"),
    count("attempts"),
    count("entries"),
    count("questions", (q) => q.eq("active", true)),
    count("centers", (q) => q.eq("active", true)),
    count("students", (q) => q.eq("name_conflict", true)),
  ]);

  const stats: [string, number][] = [
    ["Students", students],
    ["Quiz attempts", attempts],
    ["Eligible entries", entries],
    ["Active questions", questions],
    ["Active centers", centers],
    ["Name conflicts to review", flagged],
  ];

  return (
    <>
      <h1>Overview</h1>
      <div className="grid">
        {stats.map(([label, n]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="score" style={{ fontSize: "2rem" }}>{n}</div>
          </div>
        ))}
      </div>
    </>
  );
}
