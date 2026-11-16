// jsc battery for pyra.js (run: jsc pyra.js _testpyra.js)
const P=Pyra, T=P._test, S=P.SOLVED;
let fails=0; const ok=(c,n)=>{ if(!c){ fails++; print('FAIL: '+n); } };

// 1) structure
ok(P.CELLS.length===36,'36 stickers');
ok(P.EDGE_SLOTS.length===6,'6 edges');
for(const v of P.VNAMES){ ok(P.TIP[v].length===3,'tip '+v+' has 3 stickers');
  ok(P.AXIAL[v].length===3,'axial '+v+' has 3 stickers');
  ok(P.MOVE_CELLS[v].big.length===12,'big move '+v+' turns 12 stickers'); }

// 2) move sanity
for(const nm of P.MOVE_NAMES){ const perm=P.PERMS[nm];
  ok(new Set(perm).size===36,'perm '+nm+' is a permutation');
  ok(!perm.includes(-1),'perm '+nm+' complete'); }
for(const v of P.VNAMES){
  ok(P.applyMoves(S,`${v} ${v} ${v}`)===S,v+'^3=id');
  ok(P.applyMoves(S,`${v} ${v}'`)===S,v+" v' = id");
  const lc=v.toLowerCase();
  ok(P.applyMoves(S,`${lc} ${lc} ${lc}`)===S,lc+'^3=id');
  ok(P.applyMoves(S,v)!==P.applyMoves(S,lc),'big '+v+' differs from tip');
  ok(P.applyMoves(S,`${v} ${v}`)===P.applyMoves(S,`${v}'`),v+"2 = v'");
}

// 3) orientation trackers agree with moves
ok(T.tipOri(S,'U')===0 && T.axOri(S,'U')===0,'solved oris are 0');
{ const s=P.applyMoves(S,'U'); ok(T.axOri(s,'U')!==0,'U changes its axial ori');
  ok(T.tipOri(s,'U')!==0,'U carries its tip'); }

// 4) solver: init, then random scrambles solve exactly (tips included)
let t0=Date.now(); P.init(); print('init: '+(Date.now()-t0)+'ms');
ok(P.solve(S)==='','solved -> empty solution');
t0=Date.now(); let maxCore=0;
for(let t=0;t<300;t++){
  const st=P.applyMoves(S,P.randomScramble(15));
  const sol=P.solve(st);
  ok(sol!==null,'solvable '+t);
  if(sol===null) continue;
  const core=sol.split(/\s+/).filter(x=>x&&x[0]===x[0].toUpperCase()).length;
  if(core>maxCore) maxCore=core;
  ok(P.applyMoves(st,sol)===S,'solves exactly '+t);
}
print('300 solves: '+(Date.now()-t0)+'ms · max core length '+maxCore+" (God's number = 11)");
ok(maxCore<=11,'optimal bound');

// 5) validation
ok(P.validate(S).ok,'solved validates');
for(let t=0;t<100;t++){ const st=P.applyMoves(S,P.randomScramble(12));
  ok(P.validate(st).ok,'random reachable validates '+t); }
ok(!P.validate(S.slice(0,35)+'X').ok,'bad letter rejected');
{ const a=S.split(''); a[1]='B'; ok(!P.validate(a.join('')).ok,'bad counts rejected'); }
{ // flip one edge in place -> eo parity violated
  const e=P.EDGE_SLOTS[0]; const a=S.split('');
  const t0=a[e.cells[0]]; a[e.cells[0]]=a[e.cells[1]]; a[e.cells[1]]=t0;
  ok(!P.validate(a.join('')).ok,'flipped edge rejected'); }
{ // swap two edges -> perm parity violated
  const e0=P.EDGE_SLOTS[0], e1=P.EDGE_SLOTS[1]; const a=S.split('');
  [a[e0.cells[0]],a[e1.cells[0]]]=[a[e1.cells[0]],a[e0.cells[0]]];
  [a[e0.cells[1]],a[e1.cells[1]]]=[a[e1.cells[1]],a[e0.cells[1]]];
  const v=P.validate(a.join(''));
  ok(!v.ok,'swapped edges rejected'); }

print(fails===0?'ALL PASS':fails+' FAILURES');
