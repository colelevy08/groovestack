// Data export utilities.
// Provides CSV export for collections, listening history, and transactions.

/**
 * Escape a value for safe inclusion in a CSV cell.
 * Wraps in double quotes and escapes internal quotes per RFC 4180.
 *
 * @param {*} value - The value to escape.
 * @returns {string}
 */
function escapeCSV(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 *
 * @param {Object[]} data     - Array of plain objects to export.
 * @param {string}   filename - Desired filename (should end in .csv).
 */
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => escapeCSV(row[h])).join(",")
  );
  const csv = [headers.map(escapeCSV).join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export a user's record collection as a CSV file.
 * Extracts common fields: title, artist, year, genre, condition, and notes.
 *
 * @param {Object[]} records - Array of record objects from the collection.
 */
export function exportCollection(records) {
  if (!records || records.length === 0) return;

  const data = records.map(r => ({
    Title: r.title || "",
    Artist: r.artist || "",
    Year: r.year || "",
    Genre: r.genre || "",
    Condition: r.condition || "",
    Notes: r.notes || "",
  }));

  exportToCSV(data, `groovestack-collection-${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export listening history / sessions as a CSV file.
 *
 * @param {Object[]} sessions - Array of listening session objects.
 */
export function exportListeningHistory(sessions) {
  if (!sessions || sessions.length === 0) return;

  const data = sessions.map(s => ({
    Date: s.date || s.timestamp || "",
    Title: s.title || "",
    Artist: s.artist || "",
    Duration: s.duration || "",
    Source: s.source || "",
  }));

  exportToCSV(data, `groovestack-listening-${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export transaction history (purchases and offers) as a CSV file.
 *
 * @param {Object[]} purchases - Array of purchase records.
 * @param {Object[]} offers    - Array of offer records.
 */
export function exportTransactions(purchases, offers) {
  const rows = [];

  if (purchases) {
    purchases.forEach(p => {
      rows.push({
        Type: "Purchase",
        Date: p.date || p.timestamp || "",
        Title: p.title || "",
        Artist: p.artist || "",
        Amount: p.amount || p.price || "",
        Seller: p.seller || "",
        Status: p.status || "completed",
      });
    });
  }

  if (offers) {
    offers.forEach(o => {
      rows.push({
        Type: "Offer",
        Date: o.date || o.timestamp || "",
        Title: o.title || "",
        Artist: o.artist || "",
        Amount: o.amount || o.price || "",
        Seller: o.seller || o.buyer || "",
        Status: o.status || "",
      });
    });
  }

  if (rows.length === 0) return;

  exportToCSV(rows, `groovestack-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
}
