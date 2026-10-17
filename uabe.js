/* UABEA-style Unity asset editor (runs fully in the browser) */
(function(G){
const CN={};"1:GameObject,4:Transform,20:Camera,21:Material,23:MeshRenderer,28:Texture2D,33:MeshFilter,43:Mesh,48:Shader,49:TextAsset,54:Rigidbody,65:BoxCollider,74:AnimationClip,82:AudioSource,83:AudioClip,90:Avatar,95:Animator,108:Light,114:MonoBehaviour,115:MonoScript,128:Font,137:SkinnedMeshRenderer,198:ParticleSystem,213:Sprite,223:Canvas,224:RectTransform,1001:PrefabInstance".split(",").forEach(x=>{const[a,b]=x.split(":");CN[a]=b});
const NAMED=new Set([21,28,43,49,74,83,90,115,128,213]);
const dec=new TextDecoder(),enc=new TextEncoder();

/* ---- decompression ---- */
function lz4(src,n){const o=new Uint8Array(n);let s=0,d=0;
  while(s<src.length){const t=src[s++];let l=t>>4;if(l===15){let b;do{b=src[s++];l+=b}while(b===255)}
    for(let i=0;i<l;i++)o[d++]=src[s++];
    if(s>=src.length||d>=n)break;
    const off=src[s]|(src[s+1]<<8);s+=2;let m=t&15;if(m===15){let b;do{b=src[s++];m+=b}while(b===255)}
    m+=4;if(!off||off>d)throw Error("LZ4 data is corrupt");let p=d-off;for(let i=0;i<m&&d<n;i++)o[d++]=o[p++]}
  return o}
function lzma(src,n){
  const q=src[0],lc=q%9,lp=((q/9)|0)%5,pb=(((q/9)|0)/5)|0,out=new Uint8Array(n);
  let ip=6,rng=4294967295,code=0;for(let i=0;i<4;i++)code=((code*256)+src[ip++])>>>0;
  const mk=k=>new Uint16Array(k).fill(1024);
  const nrm=()=>{if(rng<16777216){rng=(rng*256)>>>0;code=((code*256)+src[ip++])>>>0}};
  const bit=(p,i)=>{const b=(rng>>>11)*p[i];if(code<b){rng=b;p[i]+=(2048-p[i])>>5;nrm();return 0}rng-=b;code-=b;p[i]-=p[i]>>5;nrm();return 1};
  const tree=(p,o,k)=>{let m=1;for(let i=0;i<k;i++)m=(m<<1)|bit(p,o+m);return m-(1<<k)};
  const rtree=(p,o,k)=>{let m=1,s=0;for(let i=0;i<k;i++){const b=bit(p,o+m);m=(m<<1)|b;s|=b<<i}return s};
  const direct=k=>{let r=0;for(let i=0;i<k;i++){rng>>>=1;let b=0;if(code>=rng){code-=rng;b=1}r=r*2+b;nrm()}return r};
  const mkLen=()=>({c:mk(2),lo:mk(128),mi:mk(128),hi:mk(256)});
  const len=(L,ps)=>!bit(L.c,0)?tree(L.lo,ps<<3,3):!bit(L.c,1)?8+tree(L.mi,ps<<3,3):16+tree(L.hi,0,8);
  const isM=mk(192),isR=mk(12),g0=mk(12),g1=mk(12),g2=mk(12),r0l=mk(192),pSlot=mk(256),pSpec=mk(115),aln=mk(16),lit=mk(0x300<<(lc+lp)),LL=mkLen(),RL=mkLen();
  let st=0,r0=0,r1=0,r2=0,r3=0,pos=0;const pm=(1<<pb)-1,lm=(1<<lp)-1;
  while(pos<n){
    const ps=pos&pm;
    if(!bit(isM,(st<<4)+ps)){
      const pv=pos?out[pos-1]:0,lo=0x300*(((pos&lm)<<lc)+(pv>>(8-lc)));let sy=1;
      if(st>=7){let mb=out[pos-r0-1];do{const x=(mb>>7)&1;mb<<=1;const b=bit(lit,lo+((1+x)<<8)+sy);sy=(sy<<1)|b;if(x!==b)break}while(sy<256)}
      while(sy<256)sy=(sy<<1)|bit(lit,lo+sy);
      out[pos++]=sy;st=st<4?0:st<10?st-3:st-6;continue}
    let l;
    if(bit(isR,st)){
      if(!bit(g0,st)){if(!bit(r0l,(st<<4)+ps)){st=st<7?9:11;out[pos]=out[pos-r0-1];pos++;continue}}
      else{let d;if(!bit(g1,st))d=r1;else{if(!bit(g2,st))d=r2;else{d=r3;r3=r2}r2=r1}r1=r0;r0=d}
      l=len(RL,ps);st=st<7?8:11;
    }else{
      r3=r2;r2=r1;r1=r0;l=len(LL,ps);st=st<7?7:10;
      const sl=tree(pSlot,(l<4?l:3)<<6,6);
      if(sl<4)r0=sl;else{const k=(sl>>1)-1;let d=(2|(sl&1))*(2**k);
        if(sl<14)d+=rtree(pSpec,d-sl,k);else{d+=direct(k-4)*16;d+=rtree(aln,0,4)}
        r0=d;if(r0===4294967295)break}
    }
    l+=2;if(r0>=pos)throw Error("LZMA data is corrupt");
    for(let i=0;i<l&&pos<n;i++){out[pos]=out[pos-r0-1];pos++}
  }
  return out}
function inflate(c,src,n){if(c===0)return src;if(c===1)return lzma(src,n);if(c===2||c===3)return lz4(src,n);throw Error("Unsupported compression type "+c)}

/* ---- reader ---- */
class R{constructor(b,le){this.u=b;this.v=new DataView(b.buffer,b.byteOffset,b.byteLength);this.p=0;this.le=!!le}
  u8(){return this.u[this.p++]}
  u16(){const x=this.v.getUint16(this.p,this.le);this.p+=2;return x}
  i32(){const x=this.v.getInt32(this.p,this.le);this.p+=4;return x}
  u32(){const x=this.v.getUint32(this.p,this.le);this.p+=4;return x}
  i64(){const x=Number(this.v.getBigInt64(this.p,this.le));this.p+=8;return x}
  big(){const x=this.v.getBigInt64(this.p,this.le);this.p+=8;return x}
  cs(){const s=this.p;while(this.u[this.p])this.p++;const t=dec.decode(this.u.subarray(s,this.p));this.p++;return t}
  al(n){this.p=Math.ceil(this.p/n)*n}}

/* ---- serialized file ---- */
function parseSF(u){
  const r=new R(u,false);r.u32();r.u32();const ver=r.u32();let dataOff=r.u32();
  if(ver<15)throw Error("Serialized file version "+ver+" (Unity older than 5.5) isn't supported");
  const endian=r.u8();r.p+=3;
  if(ver>=22){r.u32();r.i64();dataOff=r.i64();r.i64()}
  r.le=endian===0;
  const uv=r.cs(),plat=r.i32(),tt=!!r.u8(),tc=r.i32(),types=[];
  for(let i=0;i<tc;i++){
    const cid=r.i32();r.p++;r.p+=2;
    if(cid===114)r.p+=16;r.p+=16;
    if(tt){const n=r.i32(),sb=r.i32();r.p+=n*(ver>=19?32:24)+sb;if(ver>=21){const c=r.i32();r.p+=4*c}}
    types.push(cid)}
  const oc=r.i32(),objs=[];
  for(let i=0;i<oc;i++){
    r.al(4);const pid=r.big(),sp=r.p,st=ver>=22?r.i64():r.u32(),zp=sp+(ver>=22?8:4),sz=r.u32(),tid=r.i32();
    const cid=ver<16?r.u16():types[tid];
    if(ver<17)r.p+=2;if(ver===15||ver===16)r.p+=1;
    objs.push({pid,sp,zp,off:dataOff+st,sz,cid,type:CN[cid]||("Class "+cid),name:""})}
  for(const o of objs){
    try{const p=o.off+(o.cid===114?28:0);
      if((NAMED.has(o.cid)||o.cid===114)&&p+4<=o.off+o.sz){r.p=p;const l=r.u32();if(l<512&&p+4+l<=o.off+o.sz)o.name=dec.decode(u.subarray(p+4,p+4+l))}}catch(e){}}
  return {ver,le:r.le,dataOff,uv,plat,tt,objs,raw:u,head:u.subarray(0,dataOff)}}
function buildSF(sf,edits){
  const head=sf.head.slice(),dv=new DataView(head.buffer),parts=[];let pos=0;
  for(const o of sf.objs){
    const d=edits.get(String(o.pid))||sf.raw.subarray(o.off,o.off+o.sz),pad=(8-pos%8)%8;pos+=pad;
    if(sf.ver>=22)dv.setBigInt64(o.sp,BigInt(pos),sf.le);else dv.setUint32(o.sp,pos,sf.le);
    dv.setUint32(o.zp,d.length,sf.le);parts.push([pos,d]);pos+=d.length}
  const total=sf.dataOff+pos;
  if(sf.ver>=22)dv.setBigInt64(24,BigInt(total),false);else dv.setUint32(4,total,false);
  const out=new Uint8Array(total);out.set(head);for(const[p,d]of parts)out.set(d,sf.dataOff+p);return out}

/* ---- text assets ---- */
function tp(sf,d){const v=new DataView(d.buffer,d.byteOffset,d.byteLength),nl=v.getUint32(0,sf.le),a=(4+nl+3)&~3,l=v.getUint32(a,sf.le),s=a+4,e=s+l;
  if(e>d.length)throw Error("Not a standard TextAsset");return{pre:d.subarray(0,a),s,e,end:(e+3)&~3}}
function textGet(sf,d){const t=tp(sf,d);return new TextDecoder("utf-8",{fatal:true}).decode(d.subarray(t.s,t.e))}
function textSet(sf,d,str){const t=tp(sf,d),b=enc.encode(str),pad=(4-b.length%4)%4,tail=d.subarray(t.end),o=new Uint8Array(t.pre.length+4+b.length+pad+tail.length);
  o.set(t.pre);new DataView(o.buffer).setUint32(t.pre.length,b.length,sf.le);o.set(b,t.pre.length+4);o.set(tail,t.pre.length+4+b.length+pad);return o}

/* ---- bundle ---- */
function readBundle(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf),r=new R(u,false);
  if(r.cs()!=="UnityFS"){const sf=parseSF(u);return{kind:"serialized",files:[{path:"serialized file",flags:4,data:u,sf}]}}
  const ver=r.u32(),uv=r.cs(),rev=r.cs();r.i64();const cs=r.u32(),us=r.u32(),fl=r.u32();
  if(ver>=7)r.al(16);else if(uv.startsWith("2019.4")){const pad=(16-r.p%16)%16;if(u.subarray(r.p,r.p+pad).every(x=>!x))r.p+=pad}
  let bi;if(fl&0x80)bi=u.subarray(u.length-cs);else{bi=u.subarray(r.p,r.p+cs);r.p+=cs}
  bi=inflate(fl&63,bi,us);if((fl&0x200)&&!(fl&0x80))r.al(16);
  const b=new R(bi,false);b.p=16;const bc=b.i32(),blocks=[];let tot=0;
  for(let i=0;i<bc;i++){const a=b.u32(),c=b.u32(),f=b.u16();blocks.push({u:a,c,f});tot+=a}
  const nc=b.i32(),nodes=[];for(let i=0;i<nc;i++)nodes.push({off:b.i64(),size:b.i64(),flags:b.u32(),path:b.cs()});
  const data=new Uint8Array(tot);let sp=r.p,dp=0;
  for(const k of blocks){data.set(inflate(k.f&63,u.subarray(sp,sp+k.c),k.u),dp);dp+=k.u;sp+=k.c}
  const files=nodes.map(n=>{const d=data.subarray(n.off,n.off+n.size);let sf=null,err="";
    if(n.flags&4){try{sf=parseSF(d)}catch(e){err=e.message}}return{path:n.path,flags:n.flags,data:d,sf,err}});
  return{kind:"bundle",ver,uv,rev,files}}
function writeBundle(B,edits){
  const outs=B.files.map((f,fi)=>{if(!f.sf)return f.data;const m=new Map();
    for(const[k,v]of edits){const i=k.indexOf(":");if(+k.slice(0,i)===fi)m.set(k.slice(i+1),v)}
    return(m.size||B.kind==="serialized")?buildSF(f.sf,m):f.data});
  if(B.kind==="serialized")return outs[0];
  let off=0;const nodes=B.files.map((f,i)=>{const o=off;off+=outs[i].length;return{off:o,size:outs[i].length,flags:f.flags,path:f.path}});
  const w=[],p32=x=>w.push((x>>>24)&255,(x>>>16)&255,(x>>>8)&255,x&255),p64=x=>{p32(Math.floor(x/4294967296));p32(x>>>0)},ps=s=>{w.push(...enc.encode(s),0)};
  for(let i=0;i<16;i++)w.push(0);p32(1);p32(off);p32(off);w.push(0,0);p32(nodes.length);
  nodes.forEach(n=>{p64(n.off);p64(n.size);p32(n.flags);ps(n.path)});
  const bi=Uint8Array.from(w);
  const hdr=t=>{w.length=0;ps("UnityFS");p32(B.ver);ps(B.uv);ps(B.rev);p64(t);p32(bi.length);p32(bi.length);p32(0x40);while(B.ver>=7&&w.length%16)w.push(0);return Uint8Array.from(w)};
  let h=hdr(0);const total=h.length+bi.length+off;h=hdr(total);
  const out=new Uint8Array(total);out.set(h);out.set(bi,h.length);let p=h.length+bi.length;outs.forEach(o=>{out.set(o,p);p+=o.length});return out}

if(typeof module!=="undefined")module.exports={readBundle,writeBundle,parseSF,buildSF,lz4,lzma,textGet,textSet};

/* ---- UI ---- */
let B=null,ed=new Map(),uq="",up=0,txA=null;const PG=100;
const dl=(data,name)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"application/octet-stream"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
const assets=()=>{const A=[];B.files.forEach((f,fi)=>f.sf&&f.sf.objs.forEach(o=>A.push({fi,o,k:fi+":"+o.pid})));return A};
const bytes=a=>ed.get(a.k)||B.files[a.fi].sf.raw.subarray(a.o.off,a.o.off+a.o.sz);
G.renderUabe=function(){
  $("#app").innerHTML=`<h1>UABEA Editor</h1><p class="lead" style="font-size:1.05rem">Open a Unity asset bundle (.unity3d, .bundle, .assetbundle) or .assets file. Browse assets, export or replace them, edit TextAssets, then download the modified bundle. Everything stays in your browser.</p><div class="bar" style="margin:20px 0"><input type="file" id="uf"><button class="btn" id="usave" disabled>Download Modified Bundle</button></div><div id="ubody"></div>`;
  $("#uf").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    try{toast("Reading file...");B=readBundle(await f.arrayBuffer());B.name=f.name;ed.clear();uq="";up=0;$("#usave").disabled=false;ubody()}
    catch(x){B=null;$("#usave").disabled=true;$("#ubody").innerHTML=`<div class="empty">${esc(x.message)}</div>`}};
  $("#usave").onclick=()=>{if(!B)return;try{dl(writeBundle(B,ed),"modified_"+B.name);toast("Downloading modified bundle")}catch(x){toast("Save failed: "+x.message)}};
  $("#txok").onclick=()=>{if(!txA)return;try{const f=B.files[txA.fi];ed.set(txA.k,textSet(f.sf,bytes(txA),$("#txa").value));closeAll();ubody();toast("Text applied")}catch(x){toast(x.message)}};
  if(B){$("#usave").disabled=false;ubody()}
};
function ubody(){
  const A=assets(),q=uq.toLowerCase(),L=A.filter(a=>!q||(a.o.name+" "+a.o.type+" "+a.o.pid).toLowerCase().includes(q));
  const pages=Math.max(1,Math.ceil(L.length/PG));up=Math.min(up,pages-1);
  const errs=B.files.filter(f=>f.err).map(f=>f.path+": "+f.err);
  $("#ubody").innerHTML=`<p class="count" style="margin:0 0 10px">${B.kind==="bundle"?"UnityFS, Unity "+esc(B.uv):"Serialized file"} · ${B.files.length} file(s) · ${A.length} assets · ${ed.size} changed</p>${errs.length?`<div class="empty" style="margin:10px 0;padding:18px;font-size:1rem">${esc(errs.join("; "))}</div>`:""}<div class="count" style="margin:6px 0 14px">Files (click to export): ${B.files.map((f,i)=>`<a href="#" data-a="f" data-i="${i}" style="color:var(--acc)">${esc(f.path)}</a>`).join(" · ")}</div><div class="bar"><input id="uqi" placeholder="Search name, type or path ID..." value="${esc(uq)}"><button class="btn" id="upv">Prev</button><span class="count">Page ${up+1} / ${pages}</span><button class="btn" id="unx">Next</button></div><div style="margin-top:14px">${L.slice(up*PG,up*PG+PG).map(a=>`<div class="arow ${ed.has(a.k)?"ch":""}"><b>${esc(a.o.name||"(no name)")}</b><span>${esc(a.o.type)}</span><span>${a.o.pid}</span><span>${bytes(a).length.toLocaleString()} B</span><span><button class="btn sm" data-a="x" data-k="${a.k}">Export</button> <button class="btn sm" data-a="i" data-k="${a.k}">Import</button>${a.o.cid===49?` <button class="btn sm" data-a="t" data-k="${a.k}">Edit text</button>`:""}${ed.has(a.k)?` <button class="btn sm" data-a="u" data-k="${a.k}">Undo</button>`:""}</span></div>`).join("")}</div>`;
  const qi=$("#uqi");qi.oninput=()=>{uq=qi.value;up=0;const c=qi.selectionStart;ubody();const n=$("#uqi");n.focus();n.setSelectionRange(c,c)};
  $("#upv").onclick=()=>{if(up>0){up--;ubody()}};$("#unx").onclick=()=>{if(up<pages-1){up++;ubody()}};
  $("#ubody").onclick=e=>{const t=e.target.closest("[data-a]");if(!t)return;e.preventDefault();const a=t.dataset.a;
    if(a==="f"){const f=B.files[+t.dataset.i];return dl(f.data,f.path.split("/").pop())}
    const A2=assets().find(x=>x.k===t.dataset.k);if(!A2)return;
    if(a==="x")dl(bytes(A2),(A2.o.name||A2.o.pid)+"."+A2.o.type+".dat");
    else if(a==="u"){ed.delete(A2.k);ubody()}
    else if(a==="i"){const inp=document.createElement("input");inp.type="file";inp.onchange=async()=>{if(inp.files[0]){ed.set(A2.k,new Uint8Array(await inp.files[0].arrayBuffer()));ubody();toast("Replacement staged. Download to apply.")}};inp.click()}
    else if(a==="t"){try{$("#txa").value=textGet(B.files[A2.fi].sf,bytes(A2));$("#txt").textContent="Edit "+(A2.o.name||"TextAsset");txA=A2;open("#txov")}catch(x){toast("This TextAsset isn't plain UTF-8 text. Use Export / Import instead.")}}};
}
})(typeof window!=="undefined"?window:globalThis);
