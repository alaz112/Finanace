"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ─── Tipler ─────────────────────────────────────────────────────────────── */
interface ColMeta { name: string; type: string }
interface TableMeta { name: string; rows: number; columns: ColMeta[] }

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
}

interface Cell {
  id: string;
  sql: string;
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  rowFilter: string;
  sortCol: string | null;
  sortDir: "asc" | "desc";
}

/* ─── Başlangıç hücreleri ────────────────────────────────────────────────── */
const STARTER_CELLS: Omit<Cell, "result" | "error" | "loading" | "rowFilter" | "sortCol" | "sortDir">[] = [
  { id: "c1", sql: "SELECT * FROM price_cache ORDER BY fetched_at DESC" },
  { id: "c2", sql: "SELECT symbol, price, datetime(recorded_at, 'unixepoch') AS tarih\nFROM price_history\nORDER BY recorded_at DESC\nLIMIT 100" },
  { id: "c3", sql: "SELECT symbol, interval,\n       datetime(fetched_at, 'unixepoch') AS guncelleme,\n       length(data_json) AS boyut_byte\nFROM history_cache\nORDER BY fetched_at DESC" },
];

function makeCell(sql = ""): Cell {
  return {
    id: Math.random().toString(36).slice(2),
    sql,
    result: null,
    error: null,
    loading: false,
    rowFilter: "",
    sortCol: null,
    sortDir: "asc",
  };
}

function initCells(): Cell[] {
  return STARTER_CELLS.map((s) => ({ ...s, result: null, error: null, loading: false, rowFilter: "", sortCol: null, sortDir: "asc" }));
}

/* ─── Yardımcı ───────────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  INTEGER: "#FF9F0A", REAL: "#30D158", TEXT: "#64D2FF", BLOB: "#FF453A",
};
function colTypeColor(t: string) {
  for (const k of Object.keys(TYPE_COLOR)) if (t.toUpperCase().includes(k)) return TYPE_COLOR[k];
  return "#AEAEB2";
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return v.toLocaleString("tr-TR");
  return String(v);
}

/* ─── Bileşenler ─────────────────────────────────────────────────────────── */

function TableSidebar({
  tables, loading, onInsert,
}: {
  tables: TableMeta[];
  loading: boolean;
  onInsert: (sql: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setOpen((p) => ({ ...p, [name]: !p[name] }));

  return (
    <aside
      className="w-60 shrink-0 flex flex-col gap-1 overflow-y-auto py-3 px-2"
      style={{ background: "#1C1C1E", borderRight: "0.5px solid rgba(255,255,255,0.07)", minHeight: 0 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: "#636366" }}>
        Tablolar
      </p>
      {loading && <p className="text-[12px] px-2" style={{ color: "#636366" }}>Yükleniyor…</p>}
      {tables.map((t) => (
        <div key={t.name}>
          <button
            onClick={() => toggle(t.name)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-left transition-all hover:bg-white/5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5856D6" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            <span className="flex-1 text-[12.5px] font-medium truncate" style={{ color: "#E5E5EA" }}>{t.name}</span>
            <span className="text-[10px] shrink-0" style={{ color: "#636366" }}>{t.rows.toLocaleString()}</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: open[t.name] ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            >
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          {open[t.name] && (
            <div className="ml-4 mb-1 mt-0.5 space-y-0.5">
              {t.columns.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colTypeColor(c.type) }} />
                  <span className="text-[11.5px] truncate" style={{ color: "#AEAEB2" }}>{c.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "#48484A" }}>{c.type}</span>
                </div>
              ))}
              <button
                onClick={() => onInsert(`SELECT * FROM ${t.name} LIMIT 100`)}
                className="ml-2 mt-1 text-[10.5px] px-2 py-0.5 rounded-md transition-all hover:bg-white/10"
                style={{ color: "#5856D6" }}
              >
                SELECT * …
              </button>
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}

function ResultTable({ result, rowFilter, sortCol, sortDir, onSort, onFilterChange }: {
  result: QueryResult;
  rowFilter: string;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  onFilterChange: (v: string) => void;
}) {
  const filtered = result.rows.filter((row) => {
    if (!rowFilter) return true;
    const q = rowFilter.toLowerCase();
    return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q));
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? "";
        const bv = b[sortCol] ?? "";
        const cmp = String(av).localeCompare(String(bv), "tr", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  return (
    <div className="flex flex-col gap-2">
      {/* Arama + sayaç */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] flex-1 max-w-xs"
          style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={rowFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Satırlarda ara…"
            className="bg-transparent outline-none text-[12px] w-full"
            style={{ color: "#E5E5EA" }}
          />
        </div>
        <span className="text-[11px]" style={{ color: "#636366" }}>
          {sorted.length} / {result.count} satır
        </span>
      </div>

      {/* Tablo */}
      <div className="overflow-auto rounded-[10px]" style={{ maxHeight: "380px", border: "0.5px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full text-[12px] border-collapse" style={{ minWidth: "100%" }}>
          <thead>
            <tr style={{ background: "#2C2C2E", position: "sticky", top: 0, zIndex: 1 }}>
              {result.columns.map((col) => (
                <th
                  key={col}
                  onClick={() => onSort(col)}
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{ color: "#AEAEB2", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortCol === col ? (
                      <span style={{ color: "#5856D6" }}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    ) : (
                      <span style={{ color: "#3A3A3C" }}>↕</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "#1C1C1E" : "#222222" }}
                className="hover:bg-white/5 transition-colors"
              >
                {result.columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 whitespace-nowrap"
                    style={{
                      color: row[col] === null ? "#48484A" : "#E5E5EA",
                      fontStyle: row[col] === null ? "italic" : "normal",
                      borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                      maxWidth: "260px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={String(row[col] ?? "NULL")}
                  >
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-3 py-6 text-center" style={{ color: "#48484A" }}>
                  Sonuç yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotebookCell({
  cell, index, onRun, onSqlChange, onDelete, onSortChange, onFilterChange, onDuplicate,
}: {
  cell: Cell;
  index: number;
  onRun: (id: string) => void;
  onSqlChange: (id: string, sql: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSortChange: (id: string, col: string) => void;
  onFilterChange: (id: string, v: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(72, ta.scrollHeight) + "px";
  }, [cell.sql]);

  // Cmd/Ctrl + Enter → run
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun(cell.id);
    }
  };

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ border: "0.5px solid rgba(255,255,255,0.08)", background: "#141414" }}
    >
      {/* Hücre başlığı */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "#1C1C1E", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "#2C2C2E", color: "#5856D6" }}
        >
          [{index + 1}]
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#48484A" }}>SQL</span>
        <div className="flex-1" />
        {/* Kontroller */}
        <button
          onClick={() => onDuplicate(cell.id)}
          title="Kopyala"
          className="p-1 rounded-md transition-all hover:bg-white/10"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button
          onClick={() => onDelete(cell.id)}
          title="Sil"
          className="p-1 rounded-md transition-all hover:bg-red-500/20"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#636366" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <button
          onClick={() => onRun(cell.id)}
          disabled={cell.loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded-[7px] text-[11px] font-semibold transition-all"
          style={{
            background: cell.loading ? "#2C2C2E" : "#5856D6",
            color: cell.loading ? "#636366" : "#FFFFFF",
          }}
        >
          {cell.loading ? (
            <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
          )}
          {cell.loading ? "Çalışıyor" : "Çalıştır"}
        </button>
      </div>

      {/* SQL editörü */}
      <div style={{ background: "#0D0D0D", position: "relative" }}>
        <textarea
          ref={textareaRef}
          value={cell.sql}
          onChange={(e) => onSqlChange(cell.id, e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="SELECT * FROM price_cache"
          className="w-full px-4 py-3 outline-none resize-none text-[13px] leading-relaxed"
          style={{
            fontFamily: "'SF Mono', 'Fira Code', 'Menlo', monospace",
            color: "#E5E5EA",
            background: "transparent",
            minHeight: "72px",
          }}
        />
        <span
          className="absolute bottom-2 right-3 text-[10px] select-none"
          style={{ color: "#3A3A3C" }}
        >
          ⌘↵ çalıştır
        </span>
      </div>

      {/* Hata */}
      {cell.error && (
        <div
          className="px-4 py-3 text-[12px] font-mono"
          style={{ background: "#1A0000", color: "#FF453A", borderTop: "0.5px solid rgba(255,69,58,0.2)" }}
        >
          ⚠️ {cell.error}
        </div>
      )}

      {/* Sonuç */}
      {cell.result && !cell.error && (
        <div
          className="px-4 py-3"
          style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
        >
          <ResultTable
            result={cell.result}
            rowFilter={cell.rowFilter}
            sortCol={cell.sortCol}
            sortDir={cell.sortDir}
            onSort={(col) => onSortChange(cell.id, col)}
            onFilterChange={(v) => onFilterChange(cell.id, v)}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Ana Sayfa ─────────────────────────────────────────────────────────── */

export default function DatabasePage() {
  const router = useRouter();
  const [cells, setCells] = useState<Cell[]>(initCells);
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("auth") !== "1") {
      router.replace("/login");
      return;
    }
    fetch("/api/db/tables")
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .catch(() => {})
      .finally(() => setTablesLoading(false));
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("auth");
    router.replace("/login");
  }

  const runCell = useCallback(async (id: string) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;

    setCells((prev) => prev.map((c) => c.id === id ? { ...c, loading: true, error: null, result: null } : c));

    try {
      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: cell.sql }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Hata");
      setCells((prev) => prev.map((c) => c.id === id ? { ...c, loading: false, result: data } : c));
    } catch (e: any) {
      setCells((prev) => prev.map((c) => c.id === id ? { ...c, loading: false, error: e.message } : c));
    }
  }, [cells]);

  const updateSql = (id: string, sql: string) =>
    setCells((prev) => prev.map((c) => c.id === id ? { ...c, sql } : c));

  const deleteCell = (id: string) =>
    setCells((prev) => prev.filter((c) => c.id !== id));

  const duplicateCell = (id: string) => {
    const cell = cells.find((c) => c.id === id);
    if (!cell) return;
    const newCell = makeCell(cell.sql);
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, newCell);
      return next;
    });
  };

  const handleSort = (id: string, col: string) =>
    setCells((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      if (c.sortCol === col) return { ...c, sortDir: c.sortDir === "asc" ? "desc" : "asc" };
      return { ...c, sortCol: col, sortDir: "asc" };
    }));

  const handleFilter = (id: string, v: string) =>
    setCells((prev) => prev.map((c) => c.id === id ? { ...c, rowFilter: v } : c));

  const insertFromSidebar = (sql: string) =>
    setCells((prev) => [...prev, makeCell(sql)]);

  const runAll = async () => {
    for (const cell of cells) await runCell(cell.id);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0A0A0A" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-5 h-13"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-4">
          <img src="/kurtlogo.png" alt="Logo" className="h-10 w-auto" />
          <div className="flex items-center gap-1 text-[13px]">
            <Link href="/dashboard" className="px-2 py-1 rounded-md transition-all hover:bg-white/5" style={{ color: "#636366" }}>Portföy</Link>
            <span style={{ color: "#3A3A3C" }}>/</span>
            <span className="px-2 py-1 font-semibold" style={{ color: "#E5E5EA" }}>Veritabanı</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all hover:bg-white/10"
            style={{ color: "#30D158", border: "0.5px solid rgba(48,209,88,0.3)" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Tümünü Çalıştır
          </button>
          <button
            onClick={handleLogout}
            className="text-[12px] px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: "#636366" }}
          >
            Çıkış
          </button>
        </div>
      </nav>

      {/* Ana alan */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 52px)" }}>
        {/* Sol: Tablo explorer */}
        <TableSidebar tables={tables} loading={tablesLoading} onInsert={insertFromSidebar} />

        {/* Sağ: Notebook */}
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Başlık */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[20px] font-bold" style={{ color: "#E5E5EA" }}>Veritabanı Notebook</h1>
              <p className="text-[12px] mt-0.5" style={{ color: "#636366" }}>
                SQL yaz → ⌘↵ çalıştır → tablo ara, sırala. Sadece SELECT sorguları.
              </p>
            </div>
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "rgba(88,86,214,0.15)", color: "#5856D6", border: "0.5px solid rgba(88,86,214,0.3)" }}
            >
              SQLite · Railway
            </span>
          </div>

          {/* Hücreler */}
          {cells.map((cell, i) => (
            <NotebookCell
              key={cell.id}
              cell={cell}
              index={i}
              onRun={runCell}
              onSqlChange={updateSql}
              onDelete={deleteCell}
              onDuplicate={duplicateCell}
              onSortChange={handleSort}
              onFilterChange={handleFilter}
            />
          ))}

          {/* Yeni hücre ekle */}
          <button
            onClick={() => setCells((prev) => [...prev, makeCell()])}
            className="w-full py-3 rounded-[14px] text-[13px] font-medium flex items-center justify-center gap-2 transition-all hover:bg-white/5"
            style={{ border: "0.5px dashed rgba(255,255,255,0.1)", color: "#48484A" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Yeni Hücre Ekle
          </button>

          <div className="h-10" />
        </main>
      </div>
    </div>
  );
}
