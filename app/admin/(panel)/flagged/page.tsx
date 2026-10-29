import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

// Keep the existing official name; just clear the flag.
async function markReviewed(formData: FormData) {
  "use server";
  await requireAdmin();
  await db().from("students").update({ name_conflict: false }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/flagged");
}

// Admin decided another typed name is the right one.
async function useName(formData: FormData) {
  "use server";
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db().from("students").update({ name, name_conflict: false }).eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/flagged");
}

type Student = { id: string; name: string; phone: string };

export default async function FlaggedPage() {
  await requireAdmin();
  const { data } = await db().from("students").select("id, name, phone")
    .eq("name_conflict", true).order("created_at", { ascending: false }).limit(200);
  const students = (data ?? []) as Student[];

  const namesByStudent = new Map<string, Map<string, number>>();
  if (students.length > 0) {
    const { data: att } = await db().from("attempts").select("student_id, submitted_name")
      .in("student_id", students.map((s) => s.id));
    for (const a of (att ?? []) as { student_id: string; submitted_name: string }[]) {
      const m = namesByStudent.get(a.student_id) ?? new Map<string, number>();
      m.set(a.submitted_name, (m.get(a.submitted_name) ?? 0) + 1);
      namesByStudent.set(a.student_id, m);
    }
  }

  return (
    <>
      <h1>Name conflicts</h1>
      <p className="muted">
        A phone number was used with a different name than the one first recorded. Phone numbers are not identity proof, so the original name is kept until you decide.
      </p>
      {students.length === 0 && <div className="card">Nothing to review.</div>}
      {students.map((s) => {
        const names = [...(namesByStudent.get(s.id) ?? new Map<string, number>()).entries()];
        return (
          <div className="card" key={s.id}>
            <div><strong>{s.phone}</strong> — recorded as <strong>{s.name}</strong></div>
            <table className="t" style={{ marginTop: 10 }}>
              <thead><tr><th>Name typed</th><th>Attempts</th><th></th></tr></thead>
              <tbody>
                {names.map(([n, c]) => (
                  <tr key={n}>
                    <td>{n}</td>
                    <td>{c}</td>
                    <td>
                      {n !== s.name && (
                        <form action={useName}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="name" value={n} />
                          <button className="smallbtn" type="submit">Make official</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={markReviewed} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={s.id} />
              <button className="smallbtn" type="submit">Keep original and dismiss</button>
            </form>
          </div>
        );
      })}
    </>
  );
}
