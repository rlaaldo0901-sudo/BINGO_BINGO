import React, { useEffect, useMemo, useState } from "react";

/* ===== Types ===== */
type Cats = Record<string, string[]>;
interface Config {
  cats: Cats;
  ord?: string[];
  size: number;
  lines: number;
  error?: string;
}

/* ===== Utils ===== */
const S = (v: any) => String(v ?? "");
const isArr = (v: any): v is any[] => Array.isArray(v);
function getParams() {
  return new URLSearchParams(window.location.search);
}
function normalizeWords(raw: any): string[] {
  if (!isArr(raw)) return [];
  return raw
    .map(S)
    .map((s) => s.trim())
    .filter(Boolean);
}
function normalizeConfig(json: any): Config {
  const cats: Cats = {};
  const rawCats = json?.cats && typeof json.cats === "object" ? json.cats : {};
  for (const k of Object.keys(rawCats)) cats[S(k)] = normalizeWords(rawCats[k]);
  const ord = isArr(json?.ord) ? normalizeWords(json.ord) : Object.keys(cats);
  const size = Number(json?.size) || 4;
  const lines = Number(json?.lines) || 3;
  return { cats, ord, size, lines };
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function generateCard(wordsInput: any, size = 4): string[][] {
  const words = normalizeWords(wordsInput);
  const need = size * size;
  if (words.length < need)
    throw new Error(
      `단어 풀이 부족합니다. (필요: ${need}, 제공: ${words.length})`
    );
  const picks = shuffle(words).slice(0, need);
  const g: string[][] = [];
  let k = 0;
  for (let r = 0; r < size; r++) {
    const row: string[] = [];
    for (let c = 0; c < size; c++) row.push(S(picks[k++]));
    g.push(row);
  }
  return g;
}
function countCompletedLines(m: boolean[][], size = 4) {
  let L = 0;
  for (let r = 0; r < size; r++) if (m[r].every(Boolean)) L++;
  for (let c = 0; c < size; c++) {
    let ok = true;
    for (let r = 0; r < size; r++) if (!m[r][c]) ok = false;
    if (ok) L++;
  }
  let d1 = true,
    d2 = true;
  for (let i = 0; i < size; i++) {
    if (!m[i][i]) d1 = false;
    if (!m[i][size - 1 - i]) d2 = false;
  }
  if (d1) L++;
  if (d2) L++;
  return L;
}

/* ===== Card ===== */
function Card({ grid }: { grid: string[][] }) {
  const size = grid.length;
  const [marked, setMarked] = useState<boolean[][]>(
    grid.map((r) => r.map(() => false))
  );
  useEffect(() => setMarked(grid.map((r) => r.map(() => false))), [grid]);
  const lines = useMemo(
    () => countCompletedLines(marked, size),
    [marked, size]
  );
  const bingo = lines >= 3;

  const toggle = (r: number, c: number) =>
    setMarked((cur) =>
      cur.map((row, ri) => row.map((m, ci) => (ri === r && ci === c ? !m : m)))
    );

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size},1fr)`,
          gap: 6,
        }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => toggle(r, c)}
              style={{
                aspectRatio: "1/1",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: 8,
                background: marked[r][c] ? "#dcfce7" : "#fff",
                textDecoration: marked[r][c] ? "line-through" : "none",
              }}
            >
              {cell}
            </button>
          ))
        )}
      </div>
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            fontWeight: 600,
            background: bingo ? "#10b981" : "#e2e8f0",
            color: bingo ? "#fff" : "#334155",
          }}
        >
          {bingo ? `BINGO! (${lines}줄)` : `완성 줄: ${lines} / 3`}
        </span>
      </div>
    </div>
  );
}

/* ===== PlayerPage (hooks fixed) ===== */
function PlayerPage() {
  const src = getParams().get("src");

  const [data, setData] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("");
  const [grid, setGrid] = useState<string[][] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!src) {
        setErr("URL에 src 파라미터가 없습니다.");
        return;
      }
      try {
        const bust = `${src}${src.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
        const res = await fetch(bust, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const cfg = normalizeConfig(json);
        if (!Object.keys(cfg.cats).length)
          throw new Error("cats 안에 카테고리가 없습니다.");
        if (alive) setData(cfg);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    if (!data) {
      setCat("");
      setGrid(null);
      return;
    }
    if (cat && !(data.cats as Cats)[cat]) {
      setCat("");
      setGrid(null);
    }
  }, [data, cat]);

  const cats: Cats = (data?.cats as Cats) || {};
  const ord: string[] = useMemo(() => {
    const names = data?.ord && data.ord.length ? data.ord : Object.keys(cats);
    return names.filter((n) => !!cats[n]);
  }, [data, cats]);

  const pick = (name: string) => {
    const n = String(name);
    setCat(n);
    try {
      setGrid(generateCard(cats[n]));
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  };

  if (err)
    return <div style={{ padding: 16, color: "#b91c1c" }}>에러: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>불러오는 중…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      {!cat ? (
        <>
          <h1 style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>
            달빛캠프 · 카테고리 선택
          </h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            {ord.map((name) => {
              const count = Array.isArray(cats[name]) ? cats[name].length : 0;
              return (
                <button
                  key={name}
                  onClick={() => pick(name)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    단어 {count}개
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontWeight: 700 }}>{cat} BINGO</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
                onClick={() => setGrid(generateCard(cats[cat]))}
              >
                새 카드
              </button>
              <button
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
                onClick={() => setCat("")}
              >
                카테고리 변경
              </button>
            </div>
          </div>
          <div style={{ maxWidth: 480 }}>
            {grid ? (
              <Card grid={grid} />
            ) : (
              <div style={{ fontSize: 14, color: "#64748b" }}>
                카드를 생성하세요.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== EditorPage ===== */
function EditorPage() {
  const ORIGIN = window.location.origin;
  const playerLink = `${ORIGIN}/?view=player&src=${encodeURIComponent(
    `${ORIGIN}/bingo.json`
  )}`;
  const editorLink = `${ORIGIN}/`;

  return (
    <div style={{ minHeight: "100vh", padding: 16 }}>
      <h1>배포용 링크 (고정)</h1>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          참여자 바로가기 링크
        </div>
        <div style={{ marginTop: 4 }}>
          <input
            readOnly
            value={playerLink}
            style={{ width: "100%", fontSize: 12 }}
          />
        </div>
        <div style={{ marginTop: 6 }}>
          <a href={playerLink} target="_blank" rel="noreferrer">
            새 창에서 열기
          </a>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>편집자 링크</div>
        <input
          readOnly
          value={editorLink}
          style={{ width: "100%", fontSize: 12 }}
        />
      </div>

      <h2 style={{ marginTop: 24 }}>달빛캠프 · 빙고 편집자 페이지</h2>
      <p style={{ color: "#64748b" }}>
        <code>public/bingo.json</code> 파일을 수정해 단어를 관리하세요. 같은
        QR/링크로 참가자 화면이 자동 반영됩니다.
      </p>
    </div>
  );
}

/* ===== App (default export only) ===== */
export default function App() {
  const view = getParams().get("view");
  return view === "player" ? <PlayerPage /> : <EditorPage />;
}
