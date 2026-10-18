/* Shared helpers: hex keys, XOR, and encrypted global-metadata.dat key detection */
(function(G){
const hex=h=>{h=h||"";const m=/^\s*["'](.*)["']\s*$/.exec(h);if(m)return new TextEncoder().encode(m[1]);
  return Uint8Array.from((h.replace(/0x/gi,"").replace(/[^0-9a-f]/gi,"").match(/../g)||[]).map(x=>parseInt(x,16)))};
const toHex=u=>Array.from(u,b=>b.toString(16).padStart(2,"0")).join(" ").toUpperCase();
function xor(u,key,limit){const o=u.slice(),n=limit>0?Math.min(limit,o.length):o.length,L=key.length;for(let i=0;i<n;i++)o[i]^=key[i%L];return o}
/* How plausible is "u XOR key" as a real global-metadata.dat? 0 = not at all, 1 = fully valid. */
function metaScore(u,key){
  const L=key.length,b=i=>u[i]^key[i%L],w=o=>(b(o)|(b(o+1)<<8)|(b(o+2)<<16)|(b(o+3)<<24))>>>0;
  if(u.length<64||w(0)!==0xFAB11BAF)return 0;
  const ver=w(4);if(ver<16||ver>40)return 0;
  const lo=w(8),ls=w(12),dO=w(16),dS=w(20);
  if(lo<24||lo+ls>u.length||dO+dS>u.length||ls%8)return 0;
  const n=Math.min(ls/8,3000);if(!n)return 1;let g=0;
  for(let i=0;i<n;i++){if(w(lo+i*8+4)+w(lo+i*8)<=dS)g++}
  return g/n}
// How much a decrypted byte looks like real metadata content (zeros and identifier text score highest)
const W=new Float32Array(256);for(let c=0;c<256;c++)W[c]=c===0?6:(c>=97&&c<=122)?3:(c>=65&&c<=90)?2.5:(c>=48&&c<=57)?2:"_.<>`-$,".includes(String.fromCharCode(c))?1.5:c===32?1:(c>32&&c<127)||c===9||c===10||c===13?0.5:0;
/* Solves the low bytes of the string-literal table (entry 0 has offset 0; each offset = previous offset + previous length).
   Needed because zero/text statistics can't pin down the low byte of 4-byte numbers when the key length is a multiple of 4. */
function refine(u,key,lo){
  const L=key.length;if(L%8&&L!==4)return null;
  const k=key.slice(),N=Math.min(400,((u.length-lo)/8)|0);if(N<16)return null;
  const cl=i=>u[lo+i*8],ci=i=>u[lo+i*8+4];
  k[(lo+4)%L]=ci(0);
  if(L===4)return k;
  const p=L/8,R=j=>(lo+4+8*j)%L,A=j=>(lo+8*j)%L;
  for(let j=0;j<p;j++){
    let found=false;
    for(let t=0;t<256&&!found;t++){
      if(j===p-1&&t>0)break;
      const k2=k.slice();if(j<p-1)k2[R(j+1)]=t;
      const P0=ci(j)^k2[R(j)],P1=ci(j+1)^k2[R((j+1)%p)];k2[A(j)]=cl(j)^((P1-P0)&255);
      let ok=true;for(let i=j;i<N-1&&ok;i+=p){if((((ci(i)^k2[R(i%p)])+(cl(i)^k2[A(i%p)])-(ci(i+1)^k2[R((i+1)%p)]))&255)!==0)ok=false}
      if(ok){ // bit 7 of the offset key and length key can swap without breaking the sums; real lengths are almost always < 128
        let big=0,tot=0;for(let i=j;i<N-1;i+=p){tot++;if((cl(i)^k2[A(j)])>=128)big++}
        if(big*2>tot){k2[A(j)]^=128;if(j<p-1)k2[R(j+1)]^=128}
        k.set(k2);found=true}}
    if(!found)return null}
  return k}
const SAN=[0xAF,0x1B,0xB1,0xFA];
/* Finds a repeating XOR key (up to 64 bytes) by assuming most data is text or zero bytes. */
function detectMetaKey(u){
  const S=Math.min(u.length,1<<20);let best=null;
  for(let L=1;L<=64;L++){
    const h=new Uint32Array(L*256);for(let i=0;i<S;i++)h[(i%L)*256+u[i]]++;
    const key=new Uint8Array(L);
    for(let r=0;r<L;r++){let bk=0,bs=-1;for(let k=0;k<256;k++){let s=0;for(let c=0;c<256;c++){const n=h[r*256+c];if(n)s+=n*W[c^k]}if(s>bs){bs=s;bk=k}}key[r]=bk}
    const fix=k=>{SAN.forEach((p,i)=>{if(i<L)k[i]=u[i]^p});return k};
    let k0=fix(key.slice()),sc=metaScore(u,k0);
    if(sc>=0.98)return{key:k0,score:sc};
    if(L%8===0||L===4){for(let lo=24;lo<=1024;lo+=4){const k=refine(u,key,lo);if(!k)continue;fix(k);const s2=metaScore(u,k);if(s2>=0.98)return{key:k,score:s2}}}
    if(!best||sc>best.score){best={key:k0,score:sc}}}
  return best&&best.score>0?best:null}
G.ZC={hex,toHex,xor,metaScore,detectMetaKey};
if(typeof module!=="undefined")module.exports=G.ZC;
})(typeof window!=="undefined"?window:globalThis);
