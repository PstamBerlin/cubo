// CUBO pyramid engine — Pyraminx-style tetrahedron, self-contained.
// OPTIMAL solver: BFS over every reachable core state (≤11 moves), tips fixed after.
//
// Geometry: regular tetrahedron, vertices U R L B (U shown on top by the app).
// Faces are named by colour letter and sit OPPOSITE a vertex:
//   Y (yellow, bottom)  opposite U
//   G (green, front)    opposite B
//   R (red, left)       opposite R-vertex? no — see FACES below; all derived, nothing hand-mapped.
// Facelets: 36 chars, faces in order Y G R B, 9 cells each (row-major from the face's apex:
//   row0: [0]  ·  row1: [1,2,3]  ·  row2: [4,5,6,7,8]  — cells 1↔3 tips of that row etc).
// Moves: vertex turns U L R B (two layers, ±120°) and tip turns u l r b. q=1 is clockwise
// looking AT that vertex from outside; q=2 means counter-clockwise (there is no 180°).
(function(){
  // ---- vertices & faces ----
  const VNAMES=['U','R','L','B'];
  const VERT={ U:[1,1,1], R:[1,-1,-1], L:[-1,1,-1], B:[-1,-1,1] };
  // face = the three vertices it touches (i.e. all but its opposite); colour letters:
  const FACES=[ {c:'Y', opp:'U'}, {c:'G', opp:'B'}, {c:'R', opp:'L'}, {c:'B', opp:'R'} ];
  for(const f of FACES) f.verts=VNAMES.filter(v=>v!==f.opp);
  const COLORS=FACES.map(f=>f.c);
  const SOLVED=FACES.map(f=>f.c.repeat(9)).join('');

  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm=a=>{const l=Math.hypot(a[0],a[1],a[2]);return mul(a,1/l);};
  function rotAbout(p,axis,ang){                 // Rodrigues
    const k=norm(axis), c=Math.cos(ang), s=Math.sin(ang);
    const kxp=[k[1]*p[2]-k[2]*p[1], k[2]*p[0]-k[0]*p[2], k[0]*p[1]-k[1]*p[0]];
    return add(add(mul(p,c),mul(kxp,s)), mul(k,dot(k,p)*(1-c)));
  }

  // ---- sticker cells: subdivide each face into 9 triangles ----
  // lattice P(i,j)=c0+(i/3)(c1-c0)+(j/3)(c2-c0); ups (i,j) i+j≤2, downs (i,j) i+j≤1
  // visual rows from apex c0: row r contains ups with i+j=r and downs with i+j=r-1
  const CELLS=[];                                 // {face,idx,centroid,isUp,tri:[p,p,p]}
  FACES.forEach((f,fi)=>{
    const [c0n,c1n,c2n]=f.verts, c0=VERT[c0n], c1=VERT[c1n], c2=VERT[c2n];
    const P=(i,j)=>add(add(mul(c0,(3-i-j)/3),mul(c1,i/3)),mul(c2,j/3));
    const cells=[];
    const up=(i,j)=>({tri:[P(i,j),P(i+1,j),P(i,j+1)],isUp:true,i,j});
    const dn=(i,j)=>({tri:[P(i+1,j),P(i,j+1),P(i+1,j+1)],isUp:false,i,j});
    // row-major: r0: up(0,0) · r1: up(1,0),dn(0,0),up(0,1) · r2: up(2,0),dn(1,0),up(1,1),dn(0,1),up(0,2)
    cells.push(up(0,0), up(1,0),dn(0,0),up(0,1), up(2,0),dn(1,0),up(1,1),dn(0,1),up(0,2));
    cells.forEach((c,k)=>{
      const cen=mul(add(add(c.tri[0],c.tri[1]),c.tri[2]),1/3);
      CELLS.push({face:fi, idx:k, centroid:cen, isUp:c.isUp, i:c.i, j:c.j, tri:c.tri});
    });
  });
  const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<1e-6;
  function cellAt(p){ for(let k=0;k<36;k++) if(near(CELLS[k].centroid,p)) return k; return -1; }

  // ---- piece classification (derived from the lattice) ----
  // corner cells of a face: idx 0, 4, 8 (apex c0, corner c1, corner c2) -> tip stickers
  // down cells (idx 2,5,7) -> axial stickers; remaining ups (1,3,6) -> edge stickers
  const vertOfCorner=(cell)=>{ const f=FACES[cell.face];
    if(cell.idx===0) return f.verts[0]; if(cell.idx===4) return f.verts[1]; return f.verts[2]; };
  const TIP={}, AXIAL={};                         // vertex -> [3 cell indexes]
  for(const v of VNAMES){ TIP[v]=[]; AXIAL[v]=[]; }
  CELLS.forEach((c,k)=>{
    if(c.idx===0||c.idx===4||c.idx===8) TIP[vertOfCorner(c)].push(k);
    else if(!c.isUp){                             // axial: nearest vertex of its face
      const f=FACES[c.face]; let best=null,bd=1e9;
      for(const vn of f.verts){ const d=Math.hypot(...sub(c.centroid,VERT[vn])); if(d<bd){bd=d;best=vn;} }
      AXIAL[best].push(k);
    }
  });
  // edges: 6 vertex-pairs; each has 2 stickers (the mid up-cells on the two shared faces)
  const EDGE_SLOTS=[];                            // {verts:[a,b], cells:[k1,k2]}
  for(let a=0;a<4;a++) for(let b=a+1;b<4;b++){
    const va=VNAMES[a], vb=VNAMES[b], cells=[];
    CELLS.forEach((c,k)=>{
      if(c.idx!==1&&c.idx!==3&&c.idx!==6) return;
      const f=FACES[c.face];
      // this up-cell lies on the side of the face between two of its corners:
      const side= c.idx===1?[f.verts[0],f.verts[1]] : c.idx===3?[f.verts[0],f.verts[2]] : [f.verts[1],f.verts[2]];
      if(side.includes(va)&&side.includes(vb)) cells.push(k);
    });
    if(cells.length===2) EDGE_SLOTS.push({verts:[va,vb], cells});
  }

  // ---- moves as facelet permutations, derived by rotating centroids ----
  // big move: everything except the far layer = stickers of tip+axial+edges at that vertex.
  const MOVE_CELLS={};                            // vertex -> {big:[cells], tip:[cells]}
  for(const v of VNAMES){
    const edgeCells=EDGE_SLOTS.filter(e=>e.verts.includes(v)).flatMap(e=>e.cells);
    MOVE_CELLS[v]={ tip:TIP[v].slice(), big:[...TIP[v],...AXIAL[v],...edgeCells] };
  }
  const MOVE_NAMES=[]; const PERMS={};
  function buildPerm(v,tipOnly,q){
    const ang=-q*2*Math.PI/3;                     // q=1 cw seen from the vertex
    const set=new Set(tipOnly?MOVE_CELLS[v].tip:MOVE_CELLS[v].big);
    const P=new Array(36);
    for(let k=0;k<36;k++){
      if(!set.has(k)){ P[k]=k; continue; }
      const t=cellAt(rotAbout(CELLS[k].centroid,VERT[v],ang));
      P[k]=t;
    }
    return P;
  }
  for(const v of VNAMES) for(const tip of [false,true]) for(const q of [1,2]){
    const nm=(tip?v.toLowerCase():v)+(q===2?"'":'');
    MOVE_NAMES.push(nm); PERMS[nm]=buildPerm(v,tip,q);
  }
  function applyPerm(s,P){ const o=new Array(36); for(let i=0;i<36;i++) o[P[i]]=s[i]; return o.join(''); }
  function applyMoves(str,names){ for(const nm of String(names).trim().split(/\s+/).filter(Boolean)){
    if(!PERMS[nm]) throw new Error('bad pyramid move '+nm); str=applyPerm(str,PERMS[nm]); } return str; }

  // ---- cubie-level state (for coordinates): derived from labelled facelets ----
  // edge piece id = its colour pair in SOLVED; orientation = which cell shows which colour.
  const SLOT_SOLVED=EDGE_SLOTS.map(e=>e.cells.map(k=>SOLVED[k]).join(''));   // e.g. 'YG'
  const PAIR_ID={}; SLOT_SOLVED.forEach((p,i)=>{ PAIR_ID[p]=i; PAIR_ID[p[1]+p[0]]=i; });
  function edgeState(str){ const ep=[],eo=[];
    for(let s=0;s<6;s++){ const [k1,k2]=EDGE_SLOTS[s].cells; const pair=str[k1]+str[k2];
      const id=PAIR_ID[pair]; if(id===undefined) return null;
      ep.push(id); eo.push(pair===SLOT_SOLVED[id]?0:1); }
    return {ep,eo}; }
  // orientation tables built by simulation: rotate solved with V, record axial/tip cell colours
  const AX_LOOK={}, TIP_LOOK={};
  for(const v of VNAMES){
    AX_LOOK[v]=[]; TIP_LOOK[v]=[];
    let s=SOLVED;
    for(let o=0;o<3;o++){ AX_LOOK[v].push(AXIAL[v].map(k=>s[k]).join(''));
      TIP_LOOK[v].push(TIP[v].map(k=>s[k]).join(''));
      s=applyPerm(s,PERMS[v]); }
  }
  function axOri(str,v){ const cur=AXIAL[v].map(k=>str[k]).join(''); return AX_LOOK[v].indexOf(cur); }
  function tipOri(str,v){ const cur=TIP[v].map(k=>str[k]).join(''); return TIP_LOOK[v].indexOf(cur); }

  // ---- coordinates & optimal BFS ----
  const FACT6=[120,24,6,2,1,1];
  function encPerm(p){ let r=0; for(let i=0;i<5;i++){ let c=0; for(let j=i+1;j<6;j++) if(p[j]<p[i]) c++; r+=c*FACT6[i]; } return r; }
  function encEo(eo){ let r=0; for(let i=0;i<6;i++) r=r*2+eo[i]; return r; }
  function encAx(ax){ let r=0; for(let i=0;i<4;i++) r=r*3+ax[i]; return r; }
  const NSTATES=720*64*81;                        // naive & roomy: only reachable get visited
  function stateIndex(str){
    const es=edgeState(str); if(!es) return -1;
    const ax=VNAMES.map(v=>axOri(str,v)); if(ax.includes(-1)) return -1;
    return (encPerm(es.ep)*64+encEo(es.eo))*81+encAx(ax);
  }
  const BIG=['U',"U'",'L',"L'",'R',"R'",'B',"B'"];
  const INVN=n=>n.endsWith("'")?n.slice(0,1):n+"'";
  let moveTo=null, ready=false;
  function bfsStep(q,h,limit){
    for(; h<q.length && h<limit; h++){
      const s=q[h];
      for(let m=0;m<8;m++){
        const ns=applyPerm(s,PERMS[BIG[m]]);
        const idx=stateIndex(ns);
        if(moveTo[idx]===255){ moveTo[idx]=m; q.push(ns); }
      }
    }
    return h;
  }
  function init(){                                 // synchronous (jsc / fallback)
    if(ready) return;
    moveTo=new Uint8Array(NSTATES).fill(255);
    const q=[SOLVED]; moveTo[stateIndex(SOLVED)]=254;
    bfsStep(q,0,Infinity);
    ready=true;
  }
  async function initAsync(yieldFn){               // chunked, so a browser tab stays alive
    if(ready) return;
    moveTo=new Uint8Array(NSTATES).fill(255);
    const q=[SOLVED]; moveTo[stateIndex(SOLVED)]=254;
    let h=0;
    while(h<q.length){
      h=bfsStep(q,h,h+60000);
      if(yieldFn) await yieldFn(`mapping the pyramid · ${Math.round(100*h/933120)}%`);
    }
    ready=true;
  }
  function solveCore(str){                        // -> array of big-move names (optimal), or null
    init();
    // tips don't matter for the core: normalise them to match their axials? Not needed —
    // stateIndex ignores tip cells entirely.
    let idx=stateIndex(str); if(idx<0||moveTo[idx]===255) return null;
    const sol=[]; let s=str;
    let guard=0;
    while(moveTo[stateIndex(s)]!==254){
      const m=moveTo[stateIndex(s)];
      const inv=INVN(BIG[m]);
      sol.push(inv); s=applyPerm(s,PERMS[inv]);
      if(++guard>14) return null;
    }
    return {moves:sol, state:s};
  }
  function solve(str){                            // full solution incl tips -> "U L' r ..." | null
    const core=solveCore(str); if(!core) return null;
    const sol=core.moves.slice(); let s=core.state;
    for(const v of VNAMES){ const o=tipOri(s,v);
      if(o===1){ const nm=v.toLowerCase()+"'"; sol.push(nm); s=applyPerm(s,PERMS[nm]); }
      else if(o===2){ const nm=v.toLowerCase(); sol.push(nm); s=applyPerm(s,PERMS[nm]); } }
    return s===SOLVED? sol.join(' ') : null;
  }

  // ---- validation of painted states ----
  const CNAME={Y:'yellow',G:'green',R:'red',B:'blue'};
  function validate(str){
    if(typeof str!=='string'||str.length!==36) return {ok:false,msg:'not a full pyramid yet.'};
    const cnt={}; for(const ch of str){ if(!(ch in CNAME)) return {ok:false,msg:'not a full pyramid yet.'}; cnt[ch]=(cnt[ch]||0)+1; }
    for(const c of COLORS) if(cnt[c]!==9) return {ok:false,msg:`${CNAME[c]} is on ${cnt[c]||0} triangles — each colour needs exactly 9.`};
    for(const v of VNAMES){ if(tipOri(str,v)<0) return {ok:false,msg:'a tip has impossible colours — recheck the small corner triangles.'};
      if(axOri(str,v)<0) return {ok:false,msg:'a centre piece has impossible colours — recheck the middle triangles.'}; }
    const es=edgeState(str);
    if(!es) return {ok:false,msg:'an edge piece has impossible colours — recheck the side triangles.'};
    if(new Set(es.ep).size!==6) return {ok:false,msg:'an edge piece appears twice — check your colours.'};
    let par=0; for(let i=0;i<6;i++) for(let j=i+1;j<6;j++) if(es.ep[i]>es.ep[j]) par^=1;
    if(par) return {ok:false,msg:'two edges are swapped — this pyramid can’t be solved as coloured.'};
    if(es.eo.reduce((a,b)=>a+b,0)%2) return {ok:false,msg:'an edge is flipped — this pyramid can’t be solved as coloured.'};
    return {ok:true};
  }

  function randomScramble(n){
    const names=[...BIG]; const out=[]; let prev='';
    for(let i=0;i<n;i++){ let nm; do{ nm=names[(Math.random()*8)|0]; }while(nm[0]===prev); prev=nm[0]; out.push(nm); }
    for(const v of VNAMES){ const r=(Math.random()*3)|0;
      if(r===1) out.push(v.toLowerCase()); else if(r===2) out.push(v.toLowerCase()+"'"); }
    return out.join(' ');
  }

  const api={SOLVED, COLORS, CELLS, TIP, AXIAL, EDGE_SLOTS, VERT, VNAMES, FACES,
             MOVE_CELLS, PERMS, MOVE_NAMES, applyMoves, solve, validate, init, initAsync, isReady:()=>ready,
             randomScramble,
             _test:{stateIndex, edgeState, axOri, tipOri, solveCore, cellAt}};
  if(typeof module!=='undefined'&&module!==null) module.exports=api; else this.Pyra=api;
}).call(this);
