// jsc test battery for cube2.js (load cube2.js first on the jsc command line)
const C=Cube2, T=C._test;
const S=C.SOLVED;
let fails=0;
const ok=(cond,name)=>{ if(!cond){ fails++; print('FAIL: '+name); } };

// 1) move sanity: each perm is a permutation; U4=R4=F4=id; U2=UU; U'U=id
for(let m=0;m<9;m++){ const seen=new Set(T.PERMS[m]); ok(seen.size===24,'perm '+T.MOVE_NAMES[m]+' is a permutation'); }
ok(C.applyMoves(S,'U U U U')===S,'U^4 = id');
ok(C.applyMoves(S,'R R R R')===S,'R^4 = id');
ok(C.applyMoves(S,'F F F F')===S,'F^4 = id');
ok(C.applyMoves(S,'U U')===C.applyMoves(S,'U2'),'U2 = UU');
ok(C.applyMoves(S,"U U'")===S,"U U' = id");
// sexy move order 6 on corners
let s6=S; for(let i=0;i<6;i++) s6=C.applyMoves(s6,"R U R' U'");
ok(s6===S,"(R U R' U')^6 = id");

// 2) fromString/toString round-trip on random reachable states
function randScramble(n){ const mv=[]; for(let i=0;i<n;i++) mv.push(T.MOVE_NAMES[(Math.random()*9)|0]); return mv.join(' '); }
for(let t=0;t<200;t++){ const st=C.applyMoves(S,randScramble(20));
  const c=C.fromString(st); ok(c!==null,'fromString parses');
  ok(C.toString(c.cp,c.co)===st,'round-trip '+t); }

// 3) corner-move vs facelet-move consistency
for(let t=0;t<100;t++){ const st=C.applyMoves(S,randScramble(15)); const c=C.fromString(st);
  for(let m=0;m<9;m++){
    const viaFacelets=C.applyMoves(st,T.MOVE_NAMES[m]);
    const cc=T.cornerApply(c,m);
    ok(C.toString(cc.cp,cc.co)===viaFacelets,'corner-consistency t'+t+' m'+m); } }

// 4) coordinate encode/decode round-trip
for(let t=0;t<500;t++){ const pi=(Math.random()*5040)|0, oi=(Math.random()*729)|0;
  const st=T.decode(pi,oi); ok(T.encP(st)===pi&&T.encO(st)===oi,'coord round-trip'); }

// 5) solver: init timing, then solve scrambles
let t0=Date.now(); C.init(); print('init: '+(Date.now()-t0)+'ms');
ok(C.solve(S)==='','solved cube -> empty solution');
let maxLen=0;
t0=Date.now();
for(let t=0;t<300;t++){
  const st=C.applyMoves(S,randScramble(25));
  const sol=C.solve(st); ok(sol!==null,'solvable '+t);
  const n=sol?sol.split(/\s+/).filter(Boolean).length:0; if(n>maxLen)maxLen=n;
  ok(C.applyMoves(st,sol||'')===S,'solves to SOLVED '+t);
}
print('300 solves: '+(Date.now()-t0)+'ms, maxLen='+maxLen+' (God\'s number for 2x2 HTM = 11)');
ok(maxLen<=11,'optimal bound');

// 6) all valid random states (any perm, fixed DBL) are solvable — no parity constraint
for(let t=0;t<200;t++){
  const ids=[0,1,2,3,4,5,7]; // shuffle
  for(let i=ids.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [ids[i],ids[j]]=[ids[j],ids[i]]; }
  const cp=new Array(8); [0,1,2,3,4,5,7].forEach((p,k)=>cp[p]=ids[k]); cp[6]=6;
  const co=new Array(8).fill(0); let sum=0;
  for(const p of [0,1,2,3,4,5]){ co[p]=(Math.random()*3)|0; sum+=co[p]; }
  co[6]=0; co[7]=(3-(sum%3))%3;
  const st=C.toString(cp,co);
  ok(C.validate(st).ok,'random valid state validates '+t);
  const sol=C.solve(st); ok(sol!==null && C.applyMoves(st,sol)===S,'random valid state solves '+t);
}

// 7) validate rejects garbage
ok(!C.validate(S.slice(0,23)+'X').ok,'bad letter rejected');
ok(!C.validate('UUUUUUUURRRRFFFFDDDDLLLL').ok,'bad counts rejected');
{ // twist one corner in place: rotate URF's three stickers
  const a=S.split(''); const [f0,f1,f2]=T.CF[0]; const t=a[f0]; a[f0]=a[f2]; a[f2]=a[f1]; a[f1]=t;
  ok(!C.validate(a.join('')).ok,'twisted corner rejected'); }
{ // swap two stickers across corners -> impossible piece
  const a=S.split(''); const x=T.CF[0][1], y=T.CF[1][1]; const t=a[x]; a[x]=a[y]; a[y]=t;
  ok(!C.validate(a.join('')).ok,'impossible piece rejected'); }

print(fails===0 ? 'ALL PASS' : fails+' FAILURES');
