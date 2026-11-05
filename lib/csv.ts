// Minimal CSV parser (RFC 4180 style: quotes, escaped quotes, newlines inside quotes).
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ParsedQuestion = { text: string; options: string[]; correct_index: number };

// Expected header: question,option_a,option_b,option_c,option_d[,option_e,option_f],correct
// "correct" is a letter (A-F) or a 1-based number (1-6).
export function parseQuestions(csv: string): { valid: ParsedQuestion[]; errors: string[] } {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  const valid: ParsedQuestion[] = [];
  if (rows.length < 2) return { valid, errors: ["The file needs a header row and at least one question."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const qCol = header.indexOf("question");
  const cCol = header.indexOf("correct");
  const optCols = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"]
    .map((n) => header.indexOf(n));
  if (qCol < 0 || cCol < 0 || optCols[0] < 0 || optCols[1] < 0) {
    return { valid, errors: ["Header must include: question, option_a, option_b, correct (option_c to option_f are optional)."] };
  }

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const row = rows[r];
    const text = (row[qCol] ?? "").trim();
    const options = optCols
      .filter((c) => c >= 0)
      .map((c) => (row[c] ?? "").trim())
      .filter((o) => o !== "");
    const rawCorrect = (row[cCol] ?? "").trim().toUpperCase();

    let idx = -1;
    if (/^[A-F]$/.test(rawCorrect)) idx = rawCorrect.charCodeAt(0) - 65;
    else if (/^[1-6]$/.test(rawCorrect)) idx = Number(rawCorrect) - 1;

    if (!text) { errors.push(`Row ${line}: question is empty.`); continue; }
    if (options.length < 2) { errors.push(`Row ${line}: needs at least two options.`); continue; }
    if (idx < 0 || idx >= options.length) { errors.push(`Row ${line}: "correct" must be a letter or number matching one of the options.`); continue; }
    valid.push({ text, options, correct_index: idx });
  }
  return { valid, errors };
}

// Quotes a value for CSV and defuses spreadsheet formulas (=, +, -, @ at the start of a cell).
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
