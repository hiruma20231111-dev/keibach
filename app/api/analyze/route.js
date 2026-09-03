// Gemini プロ分析 API（サーバー側でGeminiを呼ぶ。キーはリクエストで受け取る＝Vercelに保存しない）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== プロ・アナリストのシステムプロンプト（データの使い方をここに集約）=====
const SYSTEM_PROMPT = `あなたは日本中央競馬(JRA)の一流のプロ・ハンデキャッパー兼データアナリストです。
与えられた「レース条件」「出馬表・馬情報」「DB実測統計(10年33,283レース)」をもとに、
利用者が選んだ【モード】に沿って、買い目を"徹底的に"洗い出してください。素人向けではなくプロの精度で。

# 絶対厳守のルール
1. **数字の捏造禁止**: DB実測統計(期待値=回収率/的中率/配当中央値など)は、与えられた数値だけを根拠に語る。与えられていない数字は「データなし」と明言し、推定なら「推測」と必ず明示する。
2. **正直な期待値**: 期待値(回収率)が100%未満なら「理論上はマイナス(控除率ぶん不利)」とはっきり言う。「必勝」「絶対」「鉄板」などの断定や射幸性を煽る表現は禁止。あくまで余剰資金前提の検証。
3. **プロの多角的分析**: 馬情報があれば、脚質(逃げ/先行/差し/追込)・枠順・想定ペースと隊列・展開利/不利・距離/コース適性・クラス格・斤量・血統・前走内容と着差・臨戦過程(休み明け/連闘/乗替)・馬体重傾向 を横断的に評価し、"なぜその馬か"の根拠を必ず示す。データが無い観点は無理に断定しない。
4. **モード定義に忠実に**:
   - 🎯ガチンコ=的中率最優先(本命〜上位人気で堅く)
   - ⚖️中配当=的中と配当のバランス(中位人気軸)
   - 💰高配当=万馬券ゾーン狙い(中穴軸)
   - 🌋大穴=一発逆転(人気薄軸・低的中/超高配当を許容)
5. **DB統計との整合**: 推奨買い目は、与えられたモード別DB実測(推奨軸人気・期待値・的中率)と矛盾しないように。乖離させる場合は理由を述べる。

# 出力フォーマット(見出しつき・簡潔かつ具体的に)
## 🏇 レース展開の見立て
(想定ペース・隊列・展開利になる脚質/枠。馬情報が無ければその旨)
## 🎯 注目馬(軸候補)と根拠
(1〜3頭。人気/オッズと、上記の分析根拠。確度も併記)
## 💴 推奨買い目【選択モード】
(券種・軸・相手・点数・想定投資額を具体的に。DB実測の軸人気帯と整合)
## 📊 DB実測との整合(期待値の正直な評価)
(与えられた期待値/的中率/配当中央値を引用し、100%未満なら理論上マイナスと明言)
## ⚠️ リスク・不確実性
(この予想の弱点、データ不足、荒れ/堅の振れ、見送り推奨ならそれも)

冗長にしすぎず、プロが実戦で使える密度で。`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "リクエスト不正" }, 400); }
  const { key, model = "gemini-2.5-flash", mode, race, dbStats, horsesText, test } = body || {};
  if (!key) return json({ error: "APIキーが未設定です。設定ページでGeminiキーを入れてください。" }, 400);

  // 接続テスト（軽量）
  if (test) {
    const u = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "接続テスト。『OK』とだけ返答して。" }] }], generationConfig: { maxOutputTokens: 10 } }) });
      const d = await r.json();
      if (!r.ok) return json({ ok: false, error: d?.error?.message || `エラー(${r.status})` });
      return json({ ok: true, model });
    } catch (e) { return json({ ok: false, error: "通信エラー: " + (e?.message || e) }); }
  }

  const userContent = buildUserContent({ mode, race, dbStats, horsesText });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) {
      const msg = d?.error?.message || `Gemini APIエラー (${r.status})`;
      return json({ error: msg }, 200);
    }
    const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    if (!text) return json({ error: "回答が空でした。モデルやキーを確認してください。" }, 200);
    return json({ text });
  } catch (e) {
    return json({ error: "通信エラー: " + (e?.message || e) }, 200);
  }
}

function buildUserContent({ mode, race, dbStats, horsesText }) {
  const lines = [];
  lines.push(`【選択モード】${mode}`);
  lines.push("");
  lines.push("【レース条件】");
  lines.push(`- ${race?.surfLabel || "?"} ${race?.dist || "?"}m / ${race?.field || "?"}頭 / ${race?.hcap ? "ハンデ戦" : "定量・別定"}`);
  lines.push(`- 1番人気オッズ(混戦度): ${race?.favo ?? "?"}倍`);
  if (race?.name) lines.push(`- レース名/クラス: ${race.name}`);
  lines.push("");
  lines.push("【DB実測統計｜似たレース条件での各モード最良の3連複フォーメーション】");
  lines.push(`(似たレース ${dbStats?.cohortN ?? "?"} 件から算出。期待値=繰り返したときの実測回収率。100%未満は理論上マイナス)`);
  if (Array.isArray(dbStats?.modes)) {
    for (const m of dbStats.modes) {
      lines.push(`- ${m.label}: 軸${m.axis}番人気 × 相手〜${m.cap}番人気(${m.points}点) / 期待値${m.roi}% / 的中率${m.hitRate}% / 当たれば中央値${m.medPay}円 / 万馬券率${m.manRate}%`);
    }
  }
  lines.push("");
  lines.push("【出馬表・馬情報(利用者入力。空欄なら展開・データ中心で)】");
  lines.push(horsesText && horsesText.trim() ? horsesText.trim() : "(入力なし)");
  lines.push("");
  lines.push("上記をもとに、指定フォーマットでプロの分析と、選択モードに沿った買い目を出してください。");
  return lines.join("\n");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
