"use client";
import { useEffect, useMemo, useState } from "react";
import "./globals.css";

// races.json cols: year,place,field,surf(0芝1ダ),dist,hcap,fil,loc,favo,winp,placed[],tan,uma,wide,s3f,s3t
const I = { year:0, place:1, field:2, surf:3, dist:4, hcap:5, fil:6, loc:7,
  favo:8, winp:9, placed:10, tan:11, uma:12, wide:13, s3f:14, s3t:15 };

const MODES = [
  { key:"gachi", emo:"🎯", nm:"ガチンコ", ds:"とにかく当てる。本命寄りで的中率重視", axes:[1,2,3], coverMax:6, obj:"hit" },
  { key:"mid",   emo:"⚖️", nm:"中配当",   ds:"そこそこ当ててそこそこ配当。バランス", axes:[3,4,5], coverMax:8, obj:"roi" },
  { key:"high",  emo:"💰", nm:"高配当",   ds:"万馬券ゾーン狙い。中穴を軸に", axes:[4,5,6], coverMax:10, obj:"man" },
  { key:"oana",  emo:"🌋", nm:"大穴",     ds:"一発逆転。人気薄を軸に爆発狙い", axes:[6,7,8], coverMax:12, obj:"payout" },
];

const median = a => { if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const C2 = n => n*(n-1)/2;
const favoBucket = o => o==null?-1 : o<2?0 : o<3.5?1 : o<5?2 : 3;

function evalCfg(cohort, axis, coverSet){
  const n=cohort.length; const points=C2(coverSet.size); const stake=points*100;
  if(!n || !points) return {axis,coverSet,points,stake,n,hits:0,roi:0,hitRate:0,medPay:0,manRate:0};
  let hits=0, ret=0, man=0; const pays=[];
  for(const r of cohort){
    const p=r[I.placed];
    if(!Array.isArray(p)||p.length!==3||r[I.s3f]==null) continue;
    const h = p.includes(axis) && p.every(x=> x===axis || coverSet.has(x));
    if(h){ hits++; ret+=r[I.s3f]; pays.push(r[I.s3f]); if(r[I.s3f]>=10000) man++; }
  }
  return {axis,coverSet,points,stake,n,hits,ret,
    roi:ret/(n*stake)*100, hitRate:hits/n*100, medPay:median(pays), manRate:man/n*100};
}

function bestForMode(cohort, mode, field){
  let best=null;
  for(const axis of mode.axes){
    if(axis>field) continue;
    const cap=Math.min(mode.coverMax, field);
    const cover=new Set(); for(let k=1;k<=cap;k++) if(k!==axis) cover.add(k);
    if(cover.size<2) continue;
    const s=evalCfg(cohort, axis, cover);
    const score = mode.obj==="hit"?s.hitRate : mode.obj==="roi"?s.roi
      : mode.obj==="man"?s.manRate*1000+s.roi : s.medPay*10+s.manRate; // payout寄り
    if(!best || score>best._score){ best={...s,_score:score,cap}; }
  }
  return best;
}

export default function Page(){
  const [data,setData]=useState(null);
  const [mode,setMode]=useState("high");
  const [field,setField]=useState(16);
  const [surf,setSurf]=useState(1);
  const [dist,setDist]=useState(1800);
  const [hcap,setHcap]=useState(false);
  const [favo,setFavo]=useState(3.0);

  useEffect(()=>{ fetch("/races.json").then(r=>r.json()).then(setData); },[]);
  const rows = data?.rows || [];

  const cohort = useMemo(()=>{
    if(!rows.length) return [];
    const fb=favoBucket(favo);
    const pick=(dTol,fTol)=> rows.filter(r=>
      r[I.surf]===surf &&
      r[I.field]!=null && Math.abs(r[I.field]-field)<=fTol &&
      r[I.dist]!=null && Math.abs(r[I.dist]-dist)<=dTol &&
      r[I.hcap]===(hcap?1:0) &&
      (fb<0 || favoBucket(r[I.favo])===fb)
    );
    let c=pick(400,2);
    if(c.length<60) c=pick(600,3);
    if(c.length<40) c=pick(1000,4);
    return c;
  },[rows,surf,field,dist,hcap,favo]);

  const results = useMemo(()=>{
    if(!cohort.length) return {};
    const o={}; for(const m of MODES) o[m.key]=bestForMode(cohort,m,field); return o;
  },[cohort,field]);

  const m = MODES.find(x=>x.key===mode);
  const R = results[mode];

  const evClass = roi => roi>=100?"good":roi>=80?"warn":"bad";
  const verdict = R => {
    if(!R) return {c:"bad",t:"似たレースが不足。条件を変えてください。"};
    if(R.roi>=100) return {c:"good",t:`実測ではプラス（回収率${R.roi.toFixed(0)}%）。ただし似たレース${R.n}件・的中${R.hits}回と少なければ偶然の可能性。過信しない。`};
    if(R.roi>=80) return {c:"warn",t:`ほぼトントン〜やや負け（回収率${R.roi.toFixed(0)}%）。控除率ぶんの不利が残る。`};
    return {c:"bad",t:`理論上は負け越し（回収率${R.roi.toFixed(0)}%＝控除ぶん不利）。当てにいくより「当たれば大きい」を楽しむ買い方。`};
  };

  const tryParse = txt => {
    const mf=txt.match(/(\d{1,2})\s*頭/); if(mf) setField(Math.min(18,Math.max(5,+mf[1])));
    if(/ダート|ダ\b|[（(]ダ/.test(txt)) setSurf(1); else if(/芝/.test(txt)) setSurf(0);
    const md=txt.match(/(\d{3,4})\s*m/i); if(md) setDist(+md[1]);
    if(/ハンデ/.test(txt)) setHcap(true);
    const mo=txt.match(/1番人気[^0-9]{0,6}(\d+\.\d)/); if(mo) setFavo(+mo[1]);
  };

  if(!data) return <div className="wrap"><div className="loading">データ読込中… 🏇<br/>（10年3.3万レース / 約2.4MB）</div></div>;

  return (
    <div className="wrap">
      <h1>🏇 keibach</h1>
      <p className="sub">検討レースの条件を入れて、モードを選ぶと「どう買うか＋正直な期待値」を10年33,283レースの実測から出します。</p>

      <h2>① モードを選ぶ</h2>
      <div className="modes">
        {MODES.map(x=>(
          <div key={x.key} className={`mode ${x.key}${mode===x.key?" sel":""}`} onClick={()=>setMode(x.key)}>
            <div className="emo">{x.emo}</div>
            <div className="nm">{x.nm}モード</div>
            <div className="ds">{x.ds}</div>
          </div>
        ))}
      </div>

      <h2>② 検討レースの条件</h2>
      <div className="panel">
        <div className="grid">
          <div className="field"><label>頭数</label>
            <input type="number" value={field} min={5} max={18} onChange={e=>setField(+e.target.value)}/></div>
          <div className="field"><label>コース</label>
            <div className="seg">
              <span className={surf===0?"on":""} onClick={()=>setSurf(0)}>芝</span>
              <span className={surf===1?"on":""} onClick={()=>setSurf(1)}>ダート</span>
            </div></div>
          <div className="field"><label>距離(m)</label>
            <input type="number" value={dist} min={800} max={3600} step={100} onChange={e=>setDist(+e.target.value)}/></div>
          <div className="field"><label>1番人気オッズ（混戦度）</label>
            <input type="number" value={favo} min={1} max={20} step={0.1} onChange={e=>setFavo(+e.target.value)}/></div>
          <div className="field"><label>ハンデ戦？</label>
            <div className="seg">
              <span className={!hcap?"on":""} onClick={()=>setHcap(false)}>いいえ</span>
              <span className={hcap?"on":""} onClick={()=>setHcap(true)}>ハンデ</span>
            </div></div>
        </div>
        <details>
          <summary>レース情報を貼り付けて自動入力（β・簡易）</summary>
          <textarea className="paste" placeholder="競馬新聞やレースページのテキストを貼り付け（頭数・芝ダ・距離・1番人気オッズを拾います）"
            onChange={e=>tryParse(e.target.value)}/>
          <p className="small">※ 写真・スクショ・URL読み取りはGemini連携（Phase 2）で追加予定。今はテキスト貼り付けのみ。</p>
        </details>
      </div>

      <h2>③ {m.emo} {m.nm}モードの推奨</h2>
      {R && R.n ? (()=>{ const v=verdict(R); return (
        <div className={`result ${mode}`}>
          <div className="head">似たレース {R.n}件（{surf===0?"芝":"ダ"}{dist}m・{field}頭前後・{hcap?"ハンデ":"定量"}・1人気{favo}倍帯）から算出</div>
          <div className="reco">{R.axis}番人気を軸に、3連複フォーメーション<br/>
            <span style={{fontSize:14,fontWeight:600,color:"var(--mut)"}}>相手＝1〜{R.cap}番人気（{R.points}点 / {R.stake.toLocaleString()}円）</span></div>
          <div className="kpis">
            <div className="kpi"><div className={`n ev ${evClass(R.roi)}`}>{R.roi.toFixed(0)}%</div><div className="l">期待値(実測回収率)</div></div>
            <div className="kpi"><div className="n">{R.hitRate.toFixed(0)}%</div><div className="l">的中率</div></div>
            <div className="kpi"><div className="n">{R.medPay?Math.round(R.medPay).toLocaleString():"—"}</div><div className="l">当たれば中央値</div></div>
            <div className="kpi"><div className="n">{R.manRate.toFixed(0)}%</div><div className="l">万馬券率</div></div>
          </div>
          <div className={`verdict ${v.c}`}>{v.t}</div>
          <p className="small">※ 期待値は「この買い方を似たレースで繰り返したときの実測回収率」。100%未満＝理論上マイナス。単発の勝ち負けでなく回収率で見る前提。</p>
        </div>
      ); })() : <div className="panel"><p className="small">条件に合う似たレースが不足しています。頭数・距離・オッズを調整してください。</p></div>}

      <h2>④ 4モード比較（同じレース条件で）</h2>
      <div className="panel">
        <table>
          <thead><tr><th>モード</th><th>軸</th><th>相手</th><th>期待値</th><th>的中率</th><th>当たれば中央</th></tr></thead>
          <tbody>{MODES.map(x=>{ const r=results[x.key]; return (
            <tr key={x.key} style={{opacity:x.key===mode?1:.7}}>
              <td>{x.emo}{x.nm}</td>
              <td>{r?`${r.axis}人気`:"—"}</td>
              <td>{r?`〜${r.cap}`:"—"}</td>
              <td className={r?`ev ${evClass(r.roi)}`:""}>{r?`${r.roi.toFixed(0)}%`:"—"}</td>
              <td>{r?`${r.hitRate.toFixed(0)}%`:"—"}</td>
              <td>{r&&r.medPay?Math.round(r.medPay).toLocaleString():"—"}</td>
            </tr>); })}</tbody>
        </table>
      </div>

      <p className="foot">
        データ: JRA公式「年度別成績表」PDF 2017–2026 を自作パースした {data.n.toLocaleString()}レース。
        射幸性を煽る意図はなく、余剰資金前提の統計検証用。期待値100%未満の買い方は理論上マイナスであることを理解して利用してください。
      </p>
    </div>
  );
}
