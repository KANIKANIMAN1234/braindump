/**
 * ガイドフロー入力（6/30 等）を YYYY-MM-DD に変換
 */
function parseDueDateInput(input) {
  if (input == null || input === "" || input === "なし") return null;

  const s = String(input).trim().replace(/まで$/u, "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const month = parseInt(slash[1], 10);
    const day = parseInt(slash[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() + 1 !== month || candidate.getDate() !== day) return null;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) year += 1;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

module.exports = { parseDueDateInput };
