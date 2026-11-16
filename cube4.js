// CUBO 4x4 engine — REAL reduction solver, self-contained.
//   stage 1: solve the six centre blocks
//   stage 2: pair the twelve edges (setup · slice · outers · slice⁻¹ sandwiches)
//   stage 3: reduce to a 3x3; parity trouble is fixed by "kick a slice & re-reduce"
// The final 3x3 is solved by the app (cubejs); this file guarantees a reduced,
// 3x3-solvable state and returns every move it made.
//
// Facelets: 96 chars, faces U(0-15) R F D L B, row-major — identical indexing to the app.
(function(){
  const FACE_ORDER=['U','R','F','D','L','B'];
  const SOLVED=FACE_ORDER.map(f=>f.repeat(16)).join('');
  const BASE={U:0,R:16,F:32,D:48,L:64,B:80};

  // ---- geometry (same trusted frame as the app / cube2) ----
  const SLOTS3={
    U:[[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
    R:[[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
    F:[[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
    D:[[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
    L:[[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
    B:[[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]] };
  const SLOTS4={};
  for(const f of FACE_ORDER){ const S=SLOTS3[f];
    const n=S[4], r=[S[1][0]-S[0][0],S[1][1]-S[0][1],S[1][2]-S[0][2]], d=[S[3][0]-S[0][0],S[3][1]-S[0][1],S[3][2]-S[0][2]];
    SLOTS4[f]=[];
    for(let row=0;row<4;row++) for(let col=0;col<4;col++)
      SLOTS4[f].push([n[0]*1.5+r[0]*(col-1.5)+d[0]*(row-1.5), n[1]*1.5+r[1]*(col-1.5)+d[1]*(row-1.5), n[2]*1.5+r[2]*(col-1.5)+d[2]*(row-1.5)]);
  }
  const NORMAL={U:[0,1,0],D:[0,-1,0],L:[-1,0,0],R:[1,0,0],F:[0,0,1],B:[0,0,-1]};
  const FACES={ U:{axis:1,layer:1,unit:-90}, D:{axis:1,layer:-1,unit:90}, L:{axis:0,layer:-1,unit:90},
                R:{axis:0,layer:1,unit:-90}, F:{axis:2,layer:1,unit:-90}, B:{axis:2,layer:-1,unit:90} };
  const faceOf=n=> n[0]>0.5?'R':n[0]<-0.5?'L':n[1]>0.5?'U':n[1]<-0.5?'D':n[2]>0.5?'F':'B';
  const half=v=>Math.round(v*2)/2;
  function rot(v,axis,deg){ const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a); const [x,y,z]=v;
    if(axis===0) return [x, half(y*c-z*s), half(y*s+z*c)];
    if(axis===1) return [half(x*c+z*s), y, half(-x*s+z*c)];
    return [half(x*c-y*s), half(x*s+y*c), z]; }
  const STK=[];
  for(const f of FACE_ORDER) SLOTS4[f].forEach(c=>STK.push({coord:c,normal:NORMAL[f]}));
  function slotIndex(face,c){ const a=SLOTS4[face];
    for(let i=0;i<16;i++) if(Math.abs(a[i][0]-c[0])<1e-6&&Math.abs(a[i][1]-c[1])<1e-6&&Math.abs(a[i][2]-c[2])<1e-6) return BASE[face]+i;
    return -1; }

  // ---- moves: t = 'o' outer | 'w' wide | 's' inner slice ----
  function buildPerm(face,t,q){
    const {axis,layer,unit}=FACES[face]; const P=new Uint8Array(96);
    STK.forEach((st,i)=>{
      const v=st.coord[axis];
      const inn = t==='o' ? Math.abs(v-1.5*layer)<0.01
               : t==='w' ? Math.sign(v)===layer
               : Math.abs(v-0.5*layer)<0.01;
      if(!inn){ P[i]=i; return; }
      let c=st.coord.slice(), n=st.normal.slice();
      for(let k=0;k<q;k++){ c=rot(c,axis,unit); n=rot(n,axis,unit); }
      P[i]=slotIndex(faceOf(n),c);
    });
    return P;
  }
  const MOVES={};
  for(const f of FACE_ORDER) for(const t of ['o','w','s']) for(const q of [1,2,3]) MOVES[f+t+q]=buildPerm(f,t,q);
  const composePerm=(P,Q)=>{ const R=new Uint8Array(96); for(let i=0;i<96;i++) R[i]=Q[P[i]]; return R; };   // apply P then Q
  const IDP=new Uint8Array(96); for(let i=0;i<96;i++) IDP[i]=i;

  // coded state helpers (colors 0..5)
  const C2I={U:0,R:1,F:2,D:3,L:4,B:5}, I2C=FACE_ORDER;
  const code=s=>{ const a=new Uint8Array(96); for(let i=0;i<96;i++) a[i]=C2I[s[i]]; return a; };
  const decode=a=>{ let s=''; for(let i=0;i<96;i++) s+=I2C[a[i]]; return s; };
  function applyInto(src,P,dst){ for(let i=0;i<96;i++) dst[P[i]]=src[i]; return dst; }
  const applyNew=(src,P)=>applyInto(src,P,new Uint8Array(96));
  function applyMoves(str,list){ let a=code(str); for(const m of list) a=applyNew(a,MOVES[m.f+m.t+m.q]); return decode(a); }
  const mvName=m=> (m.t==='w'?m.f+'w':(m.t==='s'?m.f.toLowerCase():m.f)) + (m.q===2?'2':(m.q===3?"'":''));

  // ---- piece tables (derived) ----
  const CENTERS={}; for(const f of FACE_ORDER) CENTERS[f]=[5,6,9,10].map(i=>BASE[f]+i);
  const EDGE_POS=[];
  { const seen=new Set();
    for(const f of FACE_ORDER) SLOTS4[f].forEach(c=>{
      const big=c.filter(v=>Math.abs(v)>1).length, small=c.filter(v=>Math.abs(v)===0.5).length;
      if(!(big===2&&small===1)) return;
      const key=c.join(','); if(seen.has(key)) return; seen.add(key);
      const faces=[]; for(const g of FACE_ORDER){ const i=slotIndex(g,c); if(i>=0) faces.push(i); }
      EDGE_POS.push({a:faces[0], b:faces[1], coord:c});
    }); }
  const EDGE_PAIRS=[];
  for(let i=0;i<EDGE_POS.length;i++) for(let j=i+1;j<EDGE_POS.length;j++){
    const c1=EDGE_POS[i].coord,c2=EDGE_POS[j].coord;
    let same=0,diff=0;
    for(let k=0;k<3;k++){ if(c1[k]===c2[k]) same++; else if(Math.abs(c1[k])===0.5&&Math.abs(c2[k])===0.5) diff++; }
    if(same===2&&diff===1) EDGE_PAIRS.push([i,j]);
  }
  const faceIdxOf=i=>(i/16)|0;
  // per pair, matching sticker index pairs (same face): [[A.a,B.?],[A.b,B.?]]
  const PAIR_CHECK=EDGE_PAIRS.map(([i,j])=>{
    const A=EDGE_POS[i],B=EDGE_POS[j];
    const m1=faceIdxOf(A.a)===faceIdxOf(B.a)?[ [A.a,B.a],[A.b,B.b] ]:[ [A.a,B.b],[A.b,B.a] ];
    return m1;
  });
  const cellOf=(f,row,col)=>BASE[f]+row*4+col;

  // ---- predicates on coded arrays ----
  const CENTER_LIST=[]; for(const f of FACE_ORDER) for(const i of CENTERS[f]) CENTER_LIST.push([i,C2I[f]]);
  function centersAllSolved(a){ for(const [i,c] of CENTER_LIST) if(a[i]!==c) return false; return true; }
  function paired(a,p){ const [[x1,y1],[x2,y2]]=PAIR_CHECK[p]; return a[x1]===a[y1]&&a[x2]===a[y2]; }
  function pairedCount(a){ let n=0; for(let p=0;p<12;p++) if(paired(a,p)) n++; return n; }
  function allPaired(a){ return pairedCount(a)===12; }
  function isReduced(a){ return centersAllSolved(a)&&allPaired(a); }

  // ---- IDDFS with pooled buffers ----
  const POOL=[...Array(8)].map(()=>new Uint8Array(96));
  function idSearch(a0, alphabet, goal, maxDepth){
    if(goal(a0)) return [];
    const path=[];
    function dfs(a,rem,depth,lastKey){
      if(rem===0) return goal(a);
      for(const m of alphabet){
        const key=m.f+m.t;
        if(key===lastKey) continue;
        const b=applyInto(a,m.perm,POOL[depth]);
        path[depth]=m;
        if(dfs(b,rem-1,depth+1,key)) { path.length=Math.max(path.length,depth+1); return true; }
      }
      return false;
    }
    for(let d=1;d<=maxDepth;d++){ path.length=0; if(dfs(a0,d,0,'')) return path.slice(0,d); }
    return null;
  }
  const AL=list=>list.map(([f,t,q])=>({f,t,q,perm:MOVES[f+t+q]}));
  const ALL_OUTER=[], ALL_WIDE=[];
  for(const f of FACE_ORDER) for(const q of [1,2,3]){ ALL_OUTER.push([f,'o',q]); ALL_WIDE.push([f,'w',q]); }
  const A_CENTERS=AL([...ALL_OUTER,...ALL_WIDE]);
  const A_OUTER=AL(ALL_OUTER);

  // ---- stage 1: centres (search, with restricted deep pass + outer-shuffle retries) ----
  function centersAlphabetFor(T){
    const axis=FACES[T].axis;
    const list=[[T,'o',1],[T,'o',2],[T,'o',3]];
    for(const f of FACE_ORDER){ if(FACES[f].axis!==axis) for(const q of [1,2,3]) list.push([f,'w',q]); }
    for(const f of FACE_ORDER){ if(f!==T) for(const q of [1,2,3]) list.push([f,'o',q]); }
    return AL(list);
  }
  // NOTE: stages return {arr, ok} and keep `sol` exactly in sync with `arr`, even on failure —
  // otherwise retry kicks operate on a state that no longer matches the recorded moves.
  function solveCenters(arr, sol){
    const done=[];
    for(const T of ['U','D','F','R','B','L']){
      const cells=CENTERS[T], tc=C2I[T], A2=centersAlphabetFor(T);
      const A3=AL([[T,'o',1],[T,'o',2],[T,'o',3],
        ...FACE_ORDER.filter(f=>FACES[f].axis!==FACES[T].axis).flatMap(f=>[[f,'w',1],[f,'w',2],[f,'w',3]])]);
      for(let k=0;k<4;k++){
        const need=k+1;
        const goal=a=>{ for(const g of done) for(const i of CENTERS[g]) if(a[i]!==C2I[g]) return false;
          let n=0; for(const c of cells) if(a[c]===tc) n++;
          return n>=need; };
        if(goal(arr)) continue;
        let mv=idSearch(arr,A_CENTERS,goal,4) || idSearch(arr,A2,goal,5);
        let guard=0;
        while(!mv && guard++<12){                        // shuffle with harmless outer turns, retry
          const cands=A_OUTER.filter(m=>m.f!==T&&!done.includes(m.f));
          for(let i=0;i<2;i++){ const m=cands[(Math.random()*cands.length)|0]; arr=applyNew(arr,m.perm); sol.push(m); }
          mv=idSearch(arr,A_CENTERS,goal,4) || (guard===6?idSearch(arr,A3,goal,6):null);
        }
        if(!mv) mv=idSearch(arr,A3,goal,6);              // deep last resort: stage + insert in one go
        if(!mv) return {arr, ok:false};
        for(const m of mv){ arr=applyNew(arr,m.perm); sol.push(m); }
      }
      done.push(T);
    }
    return {arr, ok:true};
  }

  // ---- stage 2: edge pairing via sandwich enumeration ----
  // op = a (outer, ≤2) · s (slice) · b (outer, ≤3) · s⁻¹ — outers never break centres/pairs,
  // and s…s⁻¹ cancels on centres, so only the goal on pairs needs checking.
  const OUTER_SEQS=[{mv:[],perm:IDP}];
  { const L1=[]; for(const m of A_OUTER){ L1.push({mv:[m],perm:m.perm}); }
    const L2=[]; for(const s1 of L1) for(const m of A_OUTER){ if(m.f===s1.mv[0].f) continue; L2.push({mv:[...s1.mv,m],perm:composePerm(s1.perm,m.perm)}); }
    const L3=[]; for(const s2 of L2) for(const m of A_OUTER){ if(m.f===s2.mv[1].f) continue; L3.push({mv:[...s2.mv,m],perm:composePerm(s2.perm,m.perm)}); }
    OUTER_SEQS.push(...L1,...L2,...L3); }                // 1+18+270+4050 = 4339
  const A_SETUP=OUTER_SEQS.slice(0,289);                 // ≤2 outer moves for the pre-setup
  const SLICES=['Us1','Us2','Us3','Ds1','Ds2','Ds3','Rs1','Rs3','Fs1','Fs3','Ls1','Ls3','Bs1','Bs3'].map(k=>{
    const f=k[0], q=+k[2];
    return {f,t:'s',q, perm:MOVES[k], inv:{f,t:'s',q:q===2?2:4-q, perm:MOVES[f+'s'+(q===2?2:4-q)]}};
  });
  const BS={};                                            // slice-key -> per-b composed (b · s⁻¹) perms
  for(const s of SLICES){ const key=s.f+s.q; BS[key]=OUTER_SEQS.map(o=>composePerm(o.perm,s.inv.perm)); }
  const scratchA=new Uint8Array(96), scratchS=new Uint8Array(96), scratchF=new Uint8Array(96), scratchG=new Uint8Array(96);
  // last-two-edges fallback: park the broken pairs at FR/FL, then allow a 5-outer-deep sandwich
  const SLOT_KEY=EDGE_PAIRS.map(([i])=>EDGE_POS[i].coord.map(v=>Math.abs(v)>1?(v>0?'+':'-'):'*').join(''));
  const FR_IDX=SLOT_KEY.indexOf('+*+'), FL_IDX=SLOT_KEY.indexOf('-*+');
  function l2eFallback(arr,sol){
    const setupGoal=a=>{ for(let p=0;p<12;p++){ if(p===FR_IDX||p===FL_IDX) continue; if(!paired(a,p)) return false; } return true; };
    const setup=idSearch(arr,A_OUTER,setupGoal,5);
    if(!setup) return {arr, ok:false};
    for(const m of setup){ arr=applyNew(arr,m.perm); sol.push(m); }
    for(const s of SLICES){
      const st2=applyNew(arr,s.perm);
      const g=a=>{ const fin=applyInto(a,s.inv.perm,scratchG); return allPaired(fin)&&centersAllSolved(fin); };
      const b=idSearch(st2,A_OUTER,g,5);
      if(b){
        const seq=[{f:s.f,t:'s',q:s.q,perm:s.perm},...b,{f:s.inv.f,t:'s',q:s.inv.q,perm:s.inv.perm}];
        for(const m of seq){ arr=applyNew(arr,m.perm); sol.push(m); }
        return {arr, ok:true};
      }
    }
    return {arr, ok:false};
  }
  function pairEdges(arr, sol){
    for(let round=0;round<12;round++){
      const base=pairedCount(arr);
      if(base===12) return {arr, ok:true};
      const donePairs=[]; for(let p=0;p<12;p++) if(paired(arr,p)) donePairs.push(p);
      const goal=a=>{ for(const p of donePairs) if(!paired(a,p)) return false;
        return pairedCount(a)>base && centersAllSolved(a); };
      let hit=null;
      for(const maxA of [19, A_SETUP.length]){          // try short setups first — 15x cheaper
        outer:
        for(let ai=0; ai<maxA; ai++){
          const a=A_SETUP[ai];
          const st1=applyInto(arr,a.perm,scratchA);
          for(const s of SLICES){
            const st2=applyInto(st1,s.perm,scratchS);
            const table=BS[s.f+s.q];
            for(let bi=0;bi<table.length;bi++){
              const fin=applyInto(st2,table[bi],scratchF);
              if(goal(fin)){ hit={a,s,b:OUTER_SEQS[bi]}; break outer; }
            }
          }
        }
        if(hit) break;
      }
      if(!hit){
        const fx=l2eFallback(arr,sol); arr=fx.arr;
        if(!fx.ok) return {arr, ok:false};
        continue;
      }
      const seq=[...hit.a.mv, {f:hit.s.f,t:'s',q:hit.s.q,perm:hit.s.perm}, ...hit.b.mv,
                 {f:hit.s.inv.f,t:'s',q:hit.s.inv.q,perm:hit.s.inv.perm}];
      for(const m of seq){ arr=applyNew(arr,m.perm); sol.push(m); }
    }
    return {arr, ok:allPaired(arr)};
  }

  // ---- stage 3: reduce + 3x3 solvability ----
  const m3=x=>x===0?0:(x===2?3:1);
  function reduceTo3(a){ let out='';
    for(const f of FACE_ORDER) for(let r=0;r<3;r++) for(let c=0;c<3;c++) out+=I2C[a[cellOf(f,m3(r),m3(c))]];
    return out; }
  const CF3=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
  const CC3=[['U','R','F'],['U','F','L'],['U','L','B'],['U','B','R'],['D','F','R'],['D','L','F'],['D','B','L'],['D','R','B']];
  const EF3=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
  const EC3=[['U','R'],['U','F'],['U','L'],['U','B'],['D','R'],['D','F'],['D','L'],['D','B'],['F','R'],['F','L'],['B','L'],['B','R']];
  function parse3(s){
    const cp=[],co=[],ep=[],eo=[];
    for(let i=0;i<8;i++){ let o; for(o=0;o<3;o++){ const ch=s[CF3[i][o]]; if(ch==='U'||ch==='D') break; }
      if(o===3) return null;
      const c1=s[CF3[i][(o+1)%3]], c2=s[CF3[i][(o+2)%3]];
      let hit=-1; for(let j=0;j<8;j++) if(c1===CC3[j][1]&&c2===CC3[j][2]) hit=j;
      if(hit<0) return null; cp.push(hit); co.push(o); }
    for(let i=0;i<12;i++){ const x=s[EF3[i][0]], y=s[EF3[i][1]]; let hit=-1,fl=0;
      for(let j=0;j<12;j++){ if(x===EC3[j][0]&&y===EC3[j][1]){hit=j;fl=0;} else if(x===EC3[j][1]&&y===EC3[j][0]){hit=j;fl=1;} }
      if(hit<0) return null; ep.push(hit); eo.push(fl); }
    return {cp,co,ep,eo};
  }
  function permPar(a){ let p=0; for(let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++) if(a[i]>a[j]) p^=1; return p; }
  function solvable3(s){
    const st=parse3(s); if(!st) return false;
    const uniq=x=>new Set(x).size===x.length;
    if(!uniq(st.cp)||!uniq(st.ep)) return false;
    if(st.co.reduce((x,y)=>x+y,0)%3) return false;
    if(st.eo.reduce((x,y)=>x+y,0)%2) return false;
    if(permPar(st.cp)!==permPar(st.ep)) return false;
    return true;
  }

  // ---- parity algorithms, VERIFIED against this very engine at load time ----
  // OLL parity must flip only edge-orientation parity; PLL parity only permutation parity —
  // both while keeping the cube fully reduced. Candidates are tried; the first that passes wins.
  const P=(f,t,q)=>({f,t,q});
  const OLL_CANDS=[
    // the standard published one: r' U2 l F2 l' F2 r2 U2 r U2 r' U2 F2 r2 F2
    [P('R','s',3),P('U','o',2),P('L','s',1),P('F','o',2),P('L','s',3),P('F','o',2),P('R','s',2),P('U','o',2),
     P('R','s',1),P('U','o',2),P('R','s',3),P('U','o',2),P('F','o',2),P('R','s',2),P('F','o',2)],
    // wide variant of the same
    [P('R','w',3),P('U','o',2),P('L','w',1),P('F','o',2),P('L','w',3),P('F','o',2),P('R','w',2),P('U','o',2),
     P('R','w',1),P('U','o',2),P('R','w',3),P('U','o',2),P('F','o',2),P('R','w',2),P('F','o',2)],
    [P('R','s',1),P('U','o',2),P('R','s',1),P('U','o',2),P('R','s',3),P('U','o',2),P('R','s',1),P('U','o',2),
     P('L','s',3),P('U','o',2),P('R','s',1),P('U','o',2),P('R','s',3),P('U','o',2),P('R','s',3),P('U','o',2),P('R','s',3)],
  ];
  const PLL_CANDS=[
    [P('R','s',2),P('U','o',2),P('R','s',2),P('U','w',2),P('R','s',2),P('U','s',2)],
    [P('R','s',2),P('U','o',2),P('R','s',2),P('U','w',2),P('R','s',2),P('U','w',2)],
    [P('R','w',2),P('U','o',2),P('R','w',2),P('U','w',2),P('R','w',2),P('U','w',2)],
  ];
  function paritySignature(seq){
    let a=code(SOLVED); for(const m of seq) a=applyNew(a,MOVES[m.f+m.t+m.q]);
    if(!isReduced(a)) return null;
    const st=parse3(reduceTo3(a)); if(!st) return null;
    if(new Set(st.cp).size!==8||new Set(st.ep).size!==12) return null;
    if(st.co.reduce((x,y)=>x+y,0)%3) return null;
    return {eo:st.eo.reduce((x,y)=>x+y,0)%2, pp:permPar(st.ep)^permPar(st.cp)};
  }
  let ALG_OLL=null, ALG_PLL=null;
  for(const cand of OLL_CANDS){ const s=paritySignature(cand); if(s&&s.eo===1&&s.pp===0){ ALG_OLL=cand; break; } }
  for(const cand of PLL_CANDS){ const s=paritySignature(cand); if(s&&s.eo===0&&s.pp===1){ ALG_PLL=cand; break; } }

  // ---- validation of hand-painted states ----
  // A 4x4 has no fixed pieces. Sticker-level reachability = counts right, pieces real,
  // corner twist ≡ 0 (mod 3). Parities are always fixable on a 4x4, so no parity checks.
  const NAME={U:'white',R:'red',F:'green',D:'yellow',L:'orange',B:'blue'};
  const C4CELL={0:0,2:3,6:12,8:15};                       // 3x3 corner cell -> 4x4 corner cell
  const CF4=CF3.map(t=>t.map(n=>((n/9)|0)*16+C4CELL[n%9]));
  const EPAIRS_STD=EC3.map(p=>p[0]<p[1]?p[0]+p[1]:p[1]+p[0]);
  function validate(str){
    if(typeof str!=='string'||str.length!==96) return {ok:false,msg:'not a full 4×4 cube yet.'};
    const cnt={}; for(const ch of str){ if(!(ch in NAME)) return {ok:false,msg:'not a full 4×4 cube yet.'}; cnt[ch]=(cnt[ch]||0)+1; }
    for(const f of FACE_ORDER) if(cnt[f]!==16) return {ok:false,msg:`${NAME[f]} is on ${cnt[f]||0} squares — each colour needs exactly 16.`};
    // centres: 4 of each colour among the 24 centre cells (centre pieces never leave the centres)
    const ccnt={}; for(const f of FACE_ORDER) for(const i of CENTERS[f]) ccnt[str[i]]=(ccnt[str[i]]||0)+1;
    for(const f of FACE_ORDER) if(ccnt[f]!==4) return {ok:false,msg:`the centre squares need exactly 4 of each colour (${NAME[f]} has ${ccnt[f]||0}).`};
    // corners: the 8 real corner pieces, each once, twist sum ≡ 0
    const cp=[],co=[];
    for(let i=0;i<8;i++){ let o; for(o=0;o<3;o++){ const ch=str[CF4[i][o]]; if(ch==='U'||ch==='D') break; }
      if(o===3) return {ok:false,msg:'a corner has no white or yellow sticker — recheck the corners.'};
      const c1=str[CF4[i][(o+1)%3]], c2=str[CF4[i][(o+2)%3]];
      let hit=-1; for(let j=0;j<8;j++) if(c1===CC3[j][1]&&c2===CC3[j][2]) hit=j;
      if(hit<0) return {ok:false,msg:'some corner squares form an impossible piece — recheck the colours.'};
      cp.push(hit); co.push(o); }
    if(new Set(cp).size!==8) return {ok:false,msg:'a corner piece appears twice — check your colours.'};
    if(co.reduce((x,y)=>x+y,0)%3) return {ok:false,msg:'a corner is twisted — this cube can’t be solved as coloured.'};
    // wings: every edge piece must be a real colour pair, each pair appearing exactly twice
    const wcnt={};
    for(const e of EDGE_POS){ const a=str[e.a], b=str[e.b];
      const key=a<b?a+b:b+a;
      if(!EPAIRS_STD.includes(key)) return {ok:false,msg:`an edge square pair (${NAME[a]}+${NAME[b]}) isn’t a real piece — recheck the edges.`};
      wcnt[key]=(wcnt[key]||0)+1; }
    for(const k of EPAIRS_STD) if(wcnt[k]!==2) return {ok:false,msg:'the edge pieces don’t add up — each colour pair exists exactly twice.'};
    return {ok:true};
  }

  // ---- full pipeline ----
  const KICKS=[[{f:'R',t:'s',q:1}],[{f:'U',t:'s',q:1}],[{f:'F',t:'s',q:1}],[{f:'R',t:'s',q:1},{f:'U',t:'s',q:1}]];
  async function solveToReduced(str, yieldFn){
    let arr=code(str); const sol=[];
    const kick=()=>{ const ks=KICKS[(Math.random()*KICKS.length)|0];
      for(const m of ks){ arr=applyNew(arr,MOVES[m.f+m.t+m.q]); sol.push({f:m.f,t:m.t,q:m.q}); } };
    for(let attempt=0;attempt<20;attempt++){
      if(yieldFn) await yieldFn('reducing · round '+(attempt+1));
      const c=solveCenters(arr,sol); arr=c.arr;
      if(!c.ok){ api._lastFail={stage:'centers',attempt}; kick(); continue; }
      const e=pairEdges(arr,sol); arr=e.arr;
      if(!e.ok){ api._lastFail={stage:'pairs',attempt}; kick(); continue; }
      // parity repair with reduction-preserving algorithms (verified at load)
      let st=parse3(reduceTo3(arr));
      if(st){
        const eoBad=st.eo.reduce((x,y)=>x+y,0)%2, ppBad=permPar(st.ep)^permPar(st.cp);
        if(eoBad&&ALG_OLL) for(const m of ALG_OLL){ arr=applyNew(arr,MOVES[m.f+m.t+m.q]); sol.push(m); }
        if(ppBad&&ALG_PLL) for(const m of ALG_PLL){ arr=applyNew(arr,MOVES[m.f+m.t+m.q]); sol.push(m); }
      }
      const red=reduceTo3(arr);
      if(solvable3(red)) return {moves:sol.map(m=>({f:m.f,t:m.t,q:m.q})), reduced:red, state:decode(arr)};
      api._lastFail={stage:'parity',attempt}; kick();
    }
    return null;
  }

  var api; api={SOLVED, BASE, applyMoves, mvName, _lastFail:null, validate,
             isReduced:s=>isReduced(code(s)), reduceTo3:s=>reduceTo3(code(s)), solvable3, solveToReduced,
             randomScramble(n){ const out=[]; const fs=FACE_ORDER;
               for(let i=0;i<n;i++){ const f=fs[(Math.random()*6)|0]; const t=Math.random()<0.4?'w':'o'; const q=1+((Math.random()*3)|0);
                 out.push({f,t,q}); } return out; },
             _test:{MOVES,EDGE_POS,EDGE_PAIRS,CENTERS,paired:(s,p)=>paired(code(s),p),centersAllSolved:s=>centersAllSolved(code(s)),
                    allPaired:s=>allPaired(code(s)),parse3,OUTER_SEQS,SLICES,
                    hasOLL:()=>!!ALG_OLL, hasPLL:()=>!!ALG_PLL}};
  if(typeof module!=='undefined'&&module!==null) module.exports=api; else this.Cube4=api;
}).call(this);
