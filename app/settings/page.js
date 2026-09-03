"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import "../globals.css";

const MODELS = [
  { v: "gemini-2.5-flash", l: "Gemini 2.5 Flash（推奨・速い・無料枠）" },
  { v: "gemini-2.5-pro", l: "Gemini 2.5 Pro（高精度・やや遅い）" },
  { v: "gemini-2.0-flash", l: "Gemini 2.0 Flash（軽量）" },
];

export default function Settings() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  useEffect(() => {
    setKey(localStorage.getItem("keibach_gemini_key") || "");
    setModel(localStorage.getItem("keibach_gemini_model") || "gemini-2.5-flash");
  }, []);

  const save = () => {
    localStorage.setItem("keibach_gemini_key", key.trim());
    localStorage.setItem("keibach_gemini_model", model);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setTesting(true); setTestMsg(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), model, test: true }),
      });
      const d = await r.json();
      setTestMsg(d.ok ? { ok: true, t: `接続OK（${d.model}）` } : { ok: false, t: d.error || "失敗" });
    } catch (e) { setTestMsg({ ok: false, t: "通信エラー" }); }
    setTesting(false);
  };

  return (
    <div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>⚙️ 設定</h1>
        <Link href="/" style={{ fontSize: 13 }}>← 分析にもどる</Link>
      </div>
      <p className="sub">Gemini APIキーを設定すると、プロ視点の自然文分析が使えます。キーは<b>この端末のブラウザ内(localStorage)だけ</b>に保存され、サーバーには保存しません。</p>

      <h2>Gemini API キー</h2>
      <div className="panel">
        <div className="field">
          <label>API キー</label>
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder="AIza... で始まるキー" style={{ fontFamily: "monospace" }} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>モデル</label>
          <select value={model} onChange={e => setModel(e.target.value)}>
            {MODELS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={save} className="seg" style={{ padding: "10px 18px", background: "var(--mid)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {saved ? "✓ 保存しました" : "保存する"}
          </button>
          <button onClick={test} disabled={testing || !key.trim()} style={{ padding: "10px 18px", background: "var(--panel2)", color: "var(--tx)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            {testing ? "テスト中…" : "接続テスト"}
          </button>
        </div>
        {testMsg && <div className={`verdict ${testMsg.ok ? "good" : "bad"}`} style={{ marginTop: 12 }}>{testMsg.ok ? "✓ " : "⚠️ "}{testMsg.t}</div>}
      </div>

      <h2>キーの取り方（無料）</h2>
      <div className="panel">
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
          <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio（aistudio.google.com/apikey）</a>を開く</li>
          <li>Googleでログイン →「Create API key」でキーを発行</li>
          <li>発行された <code>AIza…</code> を上の欄に貼り付けて「保存」→「接続テスト」</li>
        </ol>
        <p className="small">無料枠で個人利用に十分。キーは他人に共有しないでください。</p>
      </div>

      <p className="foot">keibach — 設定はこの端末のみ有効。別端末で使うときは各端末で設定してください。</p>
    </div>
  );
}
