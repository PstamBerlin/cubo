// jsc battery for cube4.js (run: jsc cube4.js _test4.js)
const C=Cube4, T=C._test, S=C.SOLVED;
let fails=0; const ok=(c,n)=>{ if(!c){ fails++; print('FAIL: '+n); } };

// 1) every move is a permutation; X^4=id for all flavours
for(const k in T.MOVES){ ok(new Set(T.MOVES[k]).size===96,'perm '+k); }
for(const f of ['U','R','F','D','L','B']) for(const t of ['o','w','s']){
  const m={f,t,q:1};
  ok(C.applyMoves(S,[m,m,m,m])===S, f+t+'^4=id');
}
ok(C.applyMoves(S,[{f:'U',t:'o',q:1},{f:'U',t:'o',q:1}])===C.applyMoves(S,[{f:'U',t:'o',q:2}]),'U2=UU');
// wide = outer ∘ slice (same side)
ok(C.applyMoves(S,[{f:'R',t:'w',q:1}])===C.applyMoves(S,[{f:'R',t:'o',q:1},{f:'R',t:'s',q:1}]),'Rw = R r');

// 2) structure tables
ok(T.EDGE_POS.length===24,'24 edge pieces');
ok(T.EDGE_PAIRS.length===12,'12 edge pairs');
ok(T.centersAllSolved(S),'solved centres');
ok(T.allPaired(S),'solved edges paired');
ok(C.solvable3(C.reduceTo3(S)),'solved reduces to solvable 3x3');

// 2b) parity algorithms self-validated at load
ok(T.hasOLL(),'OLL parity alg verified');
ok(T.hasPLL(),'PLL parity alg verified');

// 2c) painted-state validation
ok(C.validate(S).ok,'solved validates');
for(let t=0;t<50;t++){ const st=C.applyMoves(S,C.randomScramble(25));
  ok(C.validate(st).ok,'random reachable validates '+t); }
ok(!C.validate(S.slice(0,95)+'X').ok,'bad letter rejected');
{ const a=S.split(''); a[5]='R';                        // centre counts broken (also colour counts)
  ok(!C.validate(a.join('')).ok,'broken centre counts rejected'); }
{ // twist one corner in place (URF corner: U0? use CF4 of corner 0)
  const scr=C.applyMoves(S,C.randomScramble(20)); const a=scr.split('');
  const CF4_0=[15, 16+3, 32+0];                          // U(3,3), R(0,3)->? — use engine table instead
}
{ // twist corner 0 via the engine's own table
  const idx=(()=>{ const C4CELL={0:0,2:3,6:12,8:15}; return [[8,9,20]].map(t=>t.map(n=>((n/9)|0)*16+C4CELL[n%9]))[0]; })();
  const a=S.split(''); const t0=a[idx[0]]; a[idx[0]]=a[idx[2]]; a[idx[2]]=a[idx[1]]; a[idx[1]]=t0;
  ok(!C.validate(a.join('')).ok,'twisted corner rejected'); }
{ // swap two wing stickers across different pairs -> impossible pair
  const a=S.split(''); const e0=T.EDGE_POS[0], e5=T.EDGE_POS[5];
  const t0=a[e0.a]; a[e0.a]=a[e5.a]; a[e5.a]=t0;
  const v=C.validate(a.join(''));
  ok(!v.ok || a.join('')===S,'bad wing rejected'); }

// 3) full pipeline over random scrambles (solveToReduced is async now)
(async()=>{
  let t0=Date.now(), total=0, maxLen=0, done=0, N=12;
  for(let t=0;t<N;t++){
    const scr=C.randomScramble(30);
    const st=C.applyMoves(S,scr);
    const r=await C.solveToReduced(st);
    ok(r!==null,'reduces '+t+(r?'':' (last fail: '+JSON.stringify(C._lastFail)+')')); if(!r) continue;
    ok(C.isReduced(r.state),'is reduced '+t);
    ok(C.solvable3(r.reduced),'3x3 solvable '+t);
    ok(C.applyMoves(st,r.moves)===r.state,'moves replay to reduced state '+t);
    total+=r.moves.length; if(r.moves.length>maxLen)maxLen=r.moves.length; done++;
  }
  print(done+'/'+N+' reduced · avg '+(total/Math.max(1,done)).toFixed(1)+' moves · max '+maxLen+' · '+(Date.now()-t0)+'ms total');
  print(fails===0?'ALL PASS':fails+' FAILURES');
})();
