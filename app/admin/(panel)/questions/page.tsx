import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { parseQuestions } from "@/lib/csv";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PAGE_SIZE = 100;

async function uploadQuestions(formData: FormData) {
  "use server";
  await requireAdmin();
  const back = (m: string) => redirect("/admin/questions?msg=" + encodeURIComponent(m));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back("Choose a CSV file first.");
  if ((file as File).size > MAX_FILE_BYTES) back("File is too large (2 MB limit).");

  const { valid, errors } = parseQuestions(await (file as File).text());
  // All-or-nothing: if any row is bad, import nothing so the admin can fix the file once.
  if (errors.length > 0) {
    back(`Nothing imported. ${errors.length} problem(s): ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? " …" : ""}`);
  }
  if (valid.length === 0) back("No questions found in the file.");

  for (let i = 0; i < valid.length; i += 500) {
    const { error } = await db().from("questions").insert(valid.slice(i, i + 500));
    if (error) back(`Import stopped part-way (${i} saved). Please check the file and try again.`);
  }
  revalidatePath("/admin/questions");
  back(`Imported ${valid.length} question(s).`);
}

async function addQuestion(formData: FormData) {
  "use server";
  await requireAdmin();
  const back = (m: string) => redirect("/admin/questions?msg=" + encodeURIComponent(m));
  const text = String(formData.get("text") ?? "").trim();
  const options = ["a", "b", "c", "d"].map((k) => String(formData.get("opt_" + k) ?? "").trim());
  const correct = Number(formData.get("correct"));
  if (!text) back("Enter the question.");
  if (options.some((o) => !o)) back("Fill in all four options.");
  if (![0, 1, 2, 3].includes(correct)) back("Choose the correct option.");
  const { error } = await db().from("questions").insert({ text, options, correct_index: correct });
  if (error) back("Could not add the question.");
  revalidatePath("/admin/questions");
  back("Question added.");
}

// Questions are deactivated, never deleted: attempts keep references to them for scoring and history.
async function toggleQuestion(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await db().from("questions").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/questions");
}

type Row = { id: string; text: string; options: string[]; correct_index: number; active: boolean };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ msg?: string; page?: string }> }) {
  await requireAdmin();
  const { msg, page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const from = (p - 1) * PAGE_SIZE;

  const { data, count } = await db().from("questions")
    .select("id, text, options, correct_index, active", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;

  return (
    <>
      <h1>Question bank</h1>
      {msg && <div className="notice" role="status">{msg}</div>}

      <div className="card">
        <h2>Upload CSV</h2>
        <form action={uploadQuestions}>
          <input type="file" name="file" accept=".csv,text/csv" required />
          <button className="smallbtn" type="submit" style={{ marginTop: 10 }}>Import questions</button>
        </form>
        <p className="muted" style={{ marginTop: 10 }}>
          Columns: question, option_a, option_b, option_c, option_d, correct (A to D, or 1 to 4). Save as CSV UTF-8 so Bangla text is kept.{" "}
          <a href="/question-template.csv" download>Download template</a>
        </p>
      </div>

      <div className="card">
        <h2>Add one question</h2>
        <form action={addQuestion}>
          <label htmlFor="text">Question</label>
          <textarea id="text" name="text" rows={2} required />
          <div className="row" style={{ marginTop: 10 }}>
            {["a", "b", "c", "d"].map((k) => (
              <div key={k}><label htmlFor={"opt_" + k}>Option {k.toUpperCase()}</label><input id={"opt_" + k} name={"opt_" + k} type="text" required /></div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="correct">Correct answer</label>
              <select id="correct" name="correct" defaultValue="0">
                <option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option>
              </select>
            </div>
            <div style={{ flex: "0 0 auto" }}><button className="smallbtn" type="submit">Add question</button></div>
          </div>
        </form>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h2>{total} question(s)</h2>
        <table className="t">
          <thead><tr><th>Question</th><th>Options (correct in bold)</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td>{q.text}</td>
                <td>
                  {q.options.map((o, i) => (
                    <div key={i} style={{ fontWeight: i === q.correct_index ? 700 : 400 }}>
                      {String.fromCharCode(65 + i)}. {o}
                    </div>
                  ))}
                </td>
                <td>{q.active ? "In use" : "Off"}</td>
                <td>
                  <form action={toggleQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="active" value={String(q.active)} />
                    <button className="smallbtn" type="submit">{q.active ? "Turn off" : "Turn on"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          {p > 1 && <a href={`/admin/questions?page=${p - 1}`}>Newer</a>}
          {from + PAGE_SIZE < total && <a href={`/admin/questions?page=${p + 1}`}>Older</a>}
        </div>
      </div>
    </>
  );
}
