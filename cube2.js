// CUBO 2x2 engine — self-contained pocket-cube model + OPTIMAL solver (BFS over all
// 3,674,160 states; solutions use U/R/F only, ≤11 moves). No dependencies.
//
// Facelets: 24 chars, faces U(0-3) R(4-7) F(8-11) D(12-15) L(16-19) B(20-23), row-major.
// Corners (cubejs order): URF0 UFL1 ULB2 UBR3 DFR4 DLF5 DBL6 DRB7 — DBL is the FIXED
// reference corner (U/R/F moves never touch it), so its 3 stickers define the frame.
(function(){
  const SOLVED='UUUURRRRFFFFDDDDLLLLBBBB';

  // ---- geometry: same face conventions as the app / cubejs (proven for 3x3) ----
  const FACE_ORDER=['U','R','F','D','L','B'];
  const FACES={ U:{axis:1,layer:1,unit:-90}, D:{axis:1,layer:-1,unit:90}, L:{axis:0,layer:-1,unit:90},
                R:{axis:0,layer:1,unit:-90}, F:{axis:2,layer:1,unit:-90}, B:{axis:2,layer:-1,unit:90} };
  const SLOTS3={ // 3x3 slot coords (the app's verified table)
    U:[[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
    R:[[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
    F:[[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
    D:[[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
    L:[[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
    B:[[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]] };
  const CORNER_CELLS=[0,2,6,8];                 // 3x3 face cells that survive on a 2x2
  const SLOTS2={};                              // 2x2 slot coords (±0.5)
  for(const f of FACE_ORDER) SLOTS2[f]=CORNER_CELLS.map(c=>SLOTS3[f][c].map(v=>v*0.5));
  const NORMAL={U:[0,1,0],D:[0,-1,0],L:[-1,0,0],R:[1,0,0],F:[0,0,1],B:[0,0,-1]};
  const faceOf=n=> n[0]>0.5?'R':n[0]<-0.5?'L':n[1]>0.5?'U':n[1]<-0.5?'D':n[2]>0.5?'F':'B';
  const BASE={U:0,R:4,F:8,D:12,L:16,B:20};
  function rot(v,axis,deg){ const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    const [x,y,z]=v, R=t=>Math.round(t*2)/2;   // snap to the 0.5 grid
    if(axis===0) return [x, R(y*c - z*s), R(y*s + z*c)];
    if(axis===1) return [R(x*c + z*s), y, R(-x*s + z*c)];
    return [R(x*c - y*s), R(x*s + y*c), z]; }

  // sticker list: index = BASE[f]+slot
  const STK=[];
  for(const f of FACE_ORDER) SLOTS2[f].forEach((c,s)=>STK.push({coord:c,normal:NORMAL[f]}));
  function slotIndex(face,coord){ const a=SLOTS2[face];
    for(let i=0;i<4;i++) if(Math.abs(a[i][0]-coord[0])<1e-6&&Math.abs(a[i][1]-coord[1])<1e-6&&Math.abs(a[i][2]-coord[2])<1e-6) return BASE[face]+i;
    return -1; }

  // ---- the 9 moves as facelet permutations: newStr[P[i]] = oldStr[i] ----
  const MOVE_NAMES=['U','U2',"U'",'R','R2',"R'",'F','F2',"F'"];
  const PERMS=MOVE_NAMES.map(nm=>{
    const face=nm[0], q=nm[1]==='2'?2:(nm[1]==="'"?3:1);
    const {axis,layer,unit}=FACES[face];
    const P=new Array(24);
    STK.forEach((st,i)=>{
      if(Math.sign(st.coord[axis])!==layer){ P[i]=i; return; }
      let c=st.coord.slice(), n=st.normal.slice();
      for(let k=0;k<q;k++){ c=rot(c,axis,unit); n=rot(n,axis,unit); }
      P[i]=slotIndex(faceOf(n), c);
    });
    return P;
  });
  const INV=[2,1,0,5,4,3,8,7,6];                // inverse move index
  function applyPerm(str,P){ const out=new Array(24); for(let i=0;i<24;i++) out[P[i]]=str[i]; return out.join(''); }
  function applyMoves(str,names){ for(const nm of String(names).trim().split(/\s+/).filter(Boolean)){
      const m=MOVE_NAMES.indexOf(nm); if(m<0) throw new Error('bad 2x2 move '+nm); str=applyPerm(str,PERMS[m]); }
    return str; }

  // ---- cubie model: cornerFacelet mapped down from cubejs's 3x3 table ----
  const CF3=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
  const cellMap={0:0,2:1,6:2,8:3};
  const CF=CF3.map(t=>t.map(n=>((n/9)|0)*4+cellMap[n%9]));
  const CC=[['U','R','F'],['U','F','L'],['U','L','B'],['U','B','R'],['D','F','R'],['D','L','F'],['D','B','L'],['D','R','B']];

  function fromString(str){                     // -> {cp,co} or null
    const cp=new Array(8).fill(-1), co=new Array(8).fill(-1);
    for(let i=0;i<8;i++){
      let o; for(o=0;o<3;o++){ const ch=str[CF[i][o]]; if(ch==='U'||ch==='D') break; }
      if(o===3) return null;
      const c1=str[CF[i][(o+1)%3]], c2=str[CF[i][(o+2)%3]];
      for(let j=0;j<8;j++) if(c1===CC[j][1]&&c2===CC[j][2]){ cp[i]=j; co[i]=o; break; }
      if(cp[i]<0) return null;
    }
    return {cp,co};
  }
  function toString(cp,co){ const a=new Array(24);
    for(let i=0;i<8;i++) for(let n=0;n<3;n++) a[CF[i][(n+co[i])%3]]=CC[cp[i]][n];
    return a.join(''); }

  // corner-level move tables, DERIVED from the facelet perms via a labelled cube
  // (labels encode cubie id + sticker index, so from/twist fall out mechanically)
  const CMOVES=PERMS.map(P=>{
    const lab=new Array(24);
    for(let i=0;i<8;i++) for(let n=0;n<3;n++) lab[CF[i][n]]=i*3+n;
    const moved=new Array(24); for(let i=0;i<24;i++) moved[P[i]]=lab[i];
    const from=new Array(8), twist=new Array(8);
    for(let p=0;p<8;p++){
      for(let o=0;o<3;o++){ const v=moved[CF[p][o]]; if(v%3===0){ from[p]=(v/3)|0; twist[p]=o; break; } }
    }
    return {from,twist};
  });
  function cornerApply(st,m){ const {from,twist}=CMOVES[m];
    const cp=new Array(8), co=new Array(8);
    for(let p=0;p<8;p++){ cp[p]=st.cp[from[p]]; co[p]=(st.co[from[p]]+twist[p])%3; }
    return {cp,co}; }

  // ---- coordinates (DBL fixed): perm of 7 movable corners × ori of 6 ----
  const POS=[0,1,2,3,4,5,7];                    // movable positions
  const mapId=id=>id===7?6:id;                  // cubie ids {0..5,7} -> 0..6
  const unmapId=v=>v===6?7:v;
  function encP(st){ const p=POS.map(q=>mapId(st.cp[q])); let r=0;
    for(let i=0;i<6;i++){ let c=0; for(let j=i+1;j<7;j++) if(p[j]<p[i]) c++; r=r*(7-i)+c; } return r; }
  function encO(st){ let r=0; for(let i=5;i>=0;i--) r=r*3+st.co[i]; return r; }
  const FACT=[720,120,24,6,2,1];
  function decode(pi,oi){ // -> {cp,co}
    const lehmer=new Array(7).fill(0);
    for(let i=0;i<6;i++){ lehmer[i]=(pi/FACT[i])|0; pi%=FACT[i]; }
    const pool=[0,1,2,3,4,5,6], p=new Array(7);
    for(let i=0;i<7;i++) p[i]=pool.splice(lehmer[i]||0,1)[0];
    const cp=new Array(8), co=new Array(8);
    for(let k=0;k<7;k++) cp[POS[k]]=unmapId(p[k]);
    cp[6]=6;
    let s=0; for(let i=0;i<6;i++){ co[i]=oi%3; oi=(oi/3)|0; s+=co[i]; }
    co[6]=0; co[7]=(3-(s%3))%3;
    return {cp,co}; }

  // ---- BFS tables ----
  const NP=5040, NO=729, NSTATES=NP*NO;
  let permMove=null, oriMove=null, moveTo=null, ready=false;
  function init(){
    if(ready) return;
    permMove=new Int32Array(NP*9); oriMove=new Int32Array(NO*9);
    for(let pi=0;pi<NP;pi++){ const st=decode(pi,0);
      for(let m=0;m<9;m++) permMove[pi*9+m]=encP(cornerApply(st,m)); }
    for(let oi=0;oi<NO;oi++){ const st=decode(0,oi);
      for(let m=0;m<9;m++) oriMove[oi*9+m]=encO(cornerApply(st,m)); }
    moveTo=new Uint8Array(NSTATES).fill(255);
    const queue=new Int32Array(NSTATES); let head=0, tail=0;
    moveTo[0]=254; queue[tail++]=0;
    while(head<tail){ const idx=queue[head++]; const pi=(idx/NO)|0, oi=idx%NO;
      for(let m=0;m<9;m++){ const n=permMove[pi*9+m]*NO+oriMove[oi*9+m];
        if(moveTo[n]===255){ moveTo[n]=m; queue[tail++]=n; } } }
    ready=true;
  }

  function solve(str){                           // -> "R U' F2 ..." | '' if solved | null if unsolvable
    init();
    const st=fromString(str); if(!st) return null;
    if(st.cp[6]!==6||st.co[6]!==0) return null;  // fixed corner must be home
    let pi=encP(st), oi=encO(st), idx=pi*NO+oi;
    if(moveTo[idx]===255) return null;
    const sol=[];
    while(idx!==0){ const m=moveTo[idx]; const inv=INV[m];
      sol.push(MOVE_NAMES[inv]);
      pi=(idx/NO)|0; oi=idx%NO;
      idx=permMove[pi*9+inv]*NO+oriMove[oi*9+inv];
      if(sol.length>14) return null;             // paranoia guard; optimum is ≤11
    }
    return sol.join(' ');
  }

  function validate(str){
    if(typeof str!=='string'||str.length!==24) return {ok:false,msg:'not a full 2×2 cube yet.'};
    const cnt={}; for(const ch of str) cnt[ch]=(cnt[ch]||0)+1;
    const NAME={U:'white',R:'red',F:'green',D:'yellow',L:'orange',B:'blue'};
    for(const f of FACE_ORDER) if(cnt[f]!==4) return {ok:false,msg:`${NAME[f]} is on ${cnt[f]||0} squares — each colour needs exactly 4.`};
    const st=fromString(str);
    if(!st) return {ok:false,msg:'some squares form an impossible piece — recheck the colours.'};
    const seen=new Array(8).fill(false);
    for(const v of st.cp){ if(seen[v]) return {ok:false,msg:'a piece appears twice — check your colours.'}; seen[v]=true; }
    if(st.cp[6]!==6||st.co[6]!==0) return {ok:false,msg:'the fixed corner is wrong — the 3 locked squares set the cube’s frame.'};
    if(st.co.reduce((a,b)=>a+b,0)%3!==0) return {ok:false,msg:'a corner is twisted — this cube can’t be solved as coloured.'};
    return {ok:true};
  }

  const api={SOLVED, init, solve, validate, applyMoves, fromString, toString,
             isReady:()=>ready, _test:{PERMS,MOVE_NAMES,INV,CF,CC,cornerApply,encP,encO,decode}};
  if(typeof module!=='undefined'&&module!==null) module.exports=api; else this.Cube2=api;
}).call(this);
