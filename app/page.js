"use client";
import { useEffect, useMemo, useState } from "react";
import "./globals.css";

const C = { year:0, place:1, field:2, surf:3, dist:4, hcap:5, fil:6, loc:7,
  favo:8, winp:9, placed:10, tan:11, uma:12, wide:13, s3f:14, s3t:15 };

const median = a => { if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y);
  const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const mean = a => a.length? a.reduce((x,y)=>x+y,0)/a.length : 0;
const comb2 = n => n*(n-1)/2;

function BetChips({ set, toggle, axis }) {
  return (
    <div className="chips">
      {Array.from({length:12},(_,i)=>i+1).map(p=>(
        <span key={p}
          className={"chip"+(p===axis?" axis":set.has(p)?" on":"")}
          onClick={()=>toggle(p)}>{p}</span>
      ))}
    </div>
  );
}

export default function Page() {
  const [data,setData]=useState(null);
  const [axis,setAxis]=useState(4);
  const [cover,setCover]=useState(new Set([1,2,3,5,6,7,8]));
  const [minField,setMinField]=useState(14);
  const [kongsen,setKongsen]=useState(true);
  const [cond,setCond]=useState({hcap:true,fil:true,dirt:true,local:true});
  const [period,setPeriod]=useState("all");

  useEffect(()=>{ fetch("/races.json").then(r=>r.json()).then(setData); },[]);

  const rows = data?.rows || [];

  const q1 = useMemo(()=>{
    if(!rows.length) return [];
    const defs=[["単勝",C.tan],["馬連",C.uma],["ワイド(最小)",C.wide],["3連複",C.s3f],["3連単",C.s3t]];
    return defs.map(([ja,idx])=>{
      const v=rows.map(r=>r[idx]).filter(x=>x!=null);
      const man=v.filter(x=>x>=10000).length;
      return {ja,n:v.length,man:v.length?man/v.length*100:0,med:median(v),avg:mean(v)};
    });
  },[rows]);

  const q2 = useMemo(()=>{
    if(!rows.length) return [];
    const cats=[
      ["ハンデ戦",r=>r[C.hcap]===1],
      ["定量・別定",r=>r[C.hcap]!==1],
      ["牝馬限定",r=>r[C.fil]===1],
      ["ダート",r=>r[C.surf]===1],
      ["芝",r=>r[C.surf]===0],
      ["ローカル小回り",r=>r[C.loc]===1],
      ["16頭以上",r=>r[C.field]>=16],
      ["混戦(1人気≥5倍)",r=>r[C.favo]!=null&&r[C.favo]>=5],
      ["全体",()=>true],
    ];
    return cats.map(([name,f])=>{
      const v=rows.filter(f).map(r=>r[C.s3f]).filter(x=>x!=null);
      const man=v.filter(x=>x>=10000).length;
      return {name,n:v.length,med:median(v),man:v.length?man/v.length*100:0};
    });
  },[rows]);

  const bt = useMemo(()=>{
    if(!rows.length) return null;
    const inPeriod = r => period==="all" || (period==="train"?r[C.year]<=2021:r[C.year]>=2022);
    const qualifies = r => {
      if(!inPeriod(r)) return false;
      if(r[C.field]==null || r[C.field] < minField) return false;
      if(kongsen && !(r[C.favo]!=null && r[C.favo]>=5)) return false;
      const conds=[];
      if(cond.hcap) conds.push(r[C.hcap]===1);
      if(cond.fil) conds.push(r[C.fil]===1);
      if(cond.dirt) conds.push(r[C.surf]===1);
      if(cond.local) conds.push(r[C.loc]===1);
      if(conds.length===0) return true;      // 条件無指定なら通す
      return conds.some(Boolean);            // OR
    };
    const q = rows.filter(r=>qualifies(r) && r[C.s3f]!=null && Array.isArray(r[C.placed]) && r[C.placed].length===3);
    const n=q.length;
    const points=comb2(cover.size); const stake=points*100;
    if(!n || !points) return {n,points,stake,roi:0,hit:0,man:0,maxStreak:0,lo:0,hi:0,ret:0,cost:0};
    const results=[]; let ret=0,hit=0,man=0,streak=0,maxStreak=0;
    for(const r of q){
      const p=r[C.placed];
      const h = p.includes(axis) && p.filter(x=>x!==axis).every(x=>cover.has(x));
      const gain=h?r[C.s3f]:0; ret+=gain; results.push(gain);
      if(h){hit++; if(r[C.s3f]>=10000)man++; streak=0;} else {streak++; if(streak>maxStreak)maxStreak=streak;}
    }
    const cost=n*stake, roi=ret/cost*100;
    // bootstrap CI
    const B=1000, boot=[];
    for(let b=0;b<B;b++){ let s=0; for(let i=0;i<n;i++) s+=results[(Math.random()*n)|0]; boot.push(s/cost*100); }
    boot.sort((a,b)=>a-b);
    return {n,points,stake,roi,hit,man,maxStreak,ret,cost,
      lo:boot[Math.floor(0.025*B)],hi:boot[Math.floor(0.975*B)]};
  },[rows,axis,cover,minField,kongsen,cond,period]);

  const toggleCover=p=>{ if(p===axis) return; const s=new Set(cover); s.has(p)?s.delete(p):s.add(p); setCover(s); };
  const roiClass = r => r>=100?"good":r>=75?"warn":"bad";

  if(!data) return <div className="wrap"><div className="loading">データ読込中… (約2.4MB)</div></div>;

  return (
    <div className="wrap">
      <h1>🏇 keibach — 競馬データ分析</h1>
      <p className="sub">JRA公式PDFから自作パースした <b>{data.n.toLocaleString()}レース</b>（2017–2026）。月額課金ゼロ・自前DB。</p>

      <h2>バックテスト・プレイグラウンド（3連複フォーメーション）</h2>
      <div className="panel">
        <div className="ctrls">
          <div className="field">
            <label>軸の人気</label>
            <select value={axis} onChange={e=>{const a=+e.target.value; setAxis(a); const s=new Set(cover); s.delete(a); setCover(s);}}>
              {Array.from({length:12},(_,i)=>i+1).map(p=><option key={p} value={p}>{p}番人気</option>)}
            </select>
          </div>
          <div className="field">
            <label>最小頭数</label>
            <input type="number" value={minField} min={1} max={18} onChange={e=>setMinField(+e.target.value)} style={{width:80}}/>
          </div>
          <div className="field">
            <label>期間</label>
            <select value={period} onChange={e=>setPeriod(e.target.value)}>
              <option value="all">全期間 2017-2026</option>
              <option value="train">学習 2017-2021</option>
              <option value="test">検証 2022-2026</option>
            </select>
          </div>
        </div>

        <div className="field" style={{marginTop:14}}>
          <label>相手の人気（黄=軸 / 緑=相手。クリックで切替）</label>
          <BetChips set={cover} toggle={toggleCover} axis={axis}/>
        </div>

        <div className="field" style={{marginTop:14}}>
          <label>レース条件フィルタ</label>
          <div className="toggles">
            <span className={"chip"+(kongsen?" on":"")} onClick={()=>setKongsen(!kongsen)}>混戦(1人気≥5倍)</span>
            <span className={"chip"+(cond.hcap?" on":"")} onClick={()=>setCond({...cond,hcap:!cond.hcap})}>ハンデ戦</span>
            <span className={"chip"+(cond.fil?" on":"")} onClick={()=>setCond({...cond,fil:!cond.fil})}>牝馬限定</span>
            <span className={"chip"+(cond.dirt?" on":"")} onClick={()=>setCond({...cond,dirt:!cond.dirt})}>ダート</span>
            <span className={"chip"+(cond.local?" on":"")} onClick={()=>setCond({...cond,local:!cond.local})}>ローカル小回り</span>
          </div>
          <p className="note">条件はOR（どれか該当で対象）。全部OFFなら頭数・混戦のみで絞り込み。</p>
        </div>

        {bt && (
          <>
            <div className="kpis">
              <div className="kpi"><div className={"n "+roiClass(bt.roi)}>{bt.roi.toFixed(1)}%</div><div className="l">回収率（分岐100%）</div></div>
              <div className="kpi"><div className="n">{bt.n.toLocaleString()}</div><div className="l">対象レース</div></div>
              <div className="kpi"><div className="n">{bt.n?(bt.hit/bt.n*100).toFixed(1):0}%</div><div className="l">的中率 ({bt.hit})</div></div>
              <div className="kpi"><div className="n">{bt.man}</div><div className="l">万馬券的中</div></div>
              <div className="kpi"><div className="n">{bt.points}点</div><div className="l">{bt.stake.toLocaleString()}円/R</div></div>
              <div className="kpi"><div className="n">{bt.maxStreak}</div><div className="l">最大連敗</div></div>
            </div>
            <div className="bar"><i style={{width:Math.min(100,bt.roi)+"%"}}/></div>
            <p className="note">
              95%信頼区間: <b className={roiClass(bt.lo)}>{bt.lo.toFixed(0)}%</b> 〜 <b className={roiClass(bt.hi)}>{bt.hi.toFixed(0)}%</b>
              ／ 投資 {bt.cost.toLocaleString()}円 → 払戻 {bt.ret.toLocaleString()}円
              {bt.lo<100 && <span className="bad"> ／ ⚠️ CI下限が100%未満＝優位は統計的に未確認</span>}
            </p>
          </>
        )}
      </div>

      <h2>Q1. 券種別 万馬券率（配当≥1万円・実データ）</h2>
      <div className="panel">
        <table><thead><tr><th>券種</th><th>n</th><th>万馬券率</th><th>中央値</th><th>平均</th></tr></thead>
          <tbody>{q1.map(r=>(<tr key={r.ja}><td>{r.ja}</td><td>{r.n.toLocaleString()}</td>
            <td>{r.man.toFixed(1)}%</td><td>{Math.round(r.med).toLocaleString()}円</td><td>{Math.round(r.avg).toLocaleString()}円</td></tr>))}</tbody>
        </table>
      </div>

      <h2>Q2. 荒れやすい条件（3連複・中央値）</h2>
      <div className="panel">
        <table><thead><tr><th>条件</th><th>n</th><th>3連複中央値</th><th>万馬券率</th></tr></thead>
          <tbody>{q2.map(r=>(<tr key={r.name}><td>{r.name}</td><td>{r.n.toLocaleString()}</td>
            <td>{Math.round(r.med).toLocaleString()}円</td><td>{r.man.toFixed(1)}%</td></tr>))}</tbody>
        </table>
        <p className="note">「荒れる＝配当が高い」は事実だが、<b>荒れる≠儲かる</b>。高配当はオッズに織り込み済みで、狙っても控除率ぶん−EVになりやすい（上のバックテストで検証可能）。</p>
      </div>

      <p className="note" style={{marginTop:24}}>
        データ出典: JRA公式「年度別成績表」PDF（2017–2026）を自作パース。射幸性を煽る意図はなく、余剰資金前提の統計検証用。
        単発の的中で手法を評価せず、回収率と信頼区間で判断すること。
      </p>
    </div>
  );
}
