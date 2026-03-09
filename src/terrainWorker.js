// ══════════════════════════════════════════════════════
// TERRAIN WEB WORKER — offloads buildTerrain to background thread
// Supports tiled rendering: specify wx0/wy0/wx1/wy1 for region
// Biome-tinted terrain with latitude-based color variation
// ══════════════════════════════════════════════════════

// Noise (duplicated from main — workers can't share module scope)
const _h=(x,y,s=42)=>{const n=Math.sin(x*127.1+y*311.7+s*74.3)*43758.5453;return n-Math.floor(n);};
const _lp=(a,b,t)=>a+(b-a)*t; const _sc=t=>t*t*(3-2*t);
const _n=(x,y,s=42)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=_sc(x-ix),fy=_sc(y-iy);return _lp(_lp(_h(ix,iy,s),_h(ix+1,iy,s),fx),_lp(_h(ix,iy+1,s),_h(ix+1,iy+1,s),fx),fy);};
const fbm=(x,y,o=6,s=42)=>{let v=0,a=0.5,f=1,m=0;for(let i=0;i<o;i++){v+=_n(x*f,y*f,s+i*67)*a;m+=a;a*=0.5;f*=2.1;}return v/m;};
function pip(poly,px,py){let t=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))t=!t;}return t;}

// Biome-aware elevation color — tints based on latitude (wy 0-10000)
function elevCol(e,night,wy){
  // latitude factor: 0=north(tundra) → 1=south(volcanic)
  const lat=Math.max(0,Math.min(1,wy/10000));
  if(night){
    // Night: subtle biome tint
    const base=[[4,12,4],[8,18,8],[14,26,10],[22,34,14],[38,38,18],[55,46,24],[72,58,32],[90,72,46],[110,92,64],[135,118,90],[158,148,128],[185,180,170]];
    const[r,g,b]=base[Math.min(11,Math.floor(e*12))];
    // Tundra=blue, Taiga=dark green, Temperate=green, Tropical=lush, Swamp=murky, Volcanic=red
    if(lat<0.15)return[r-2,g,b+8]; // tundra blue tint
    if(lat<0.30)return[r-2,g+4,b]; // taiga darker green
    if(lat<0.55)return[r,g+2,b]; // temperate
    if(lat<0.75)return[r-4,g+6,b-2]; // tropical lush
    if(lat<0.90)return[r+2,g+2,b-3]; // swamp murky
    return[r+8,g-2,b-4]; // volcanic red tint
  }
  // Day: biome-specific color palettes
  if(lat<0.15){
    // Tundra: icy blue-grey
    const c=[[120,140,160],[130,148,168],[145,160,175],[160,172,185],[175,182,190],[188,192,198],[200,205,212],[210,215,222],[220,225,230],[230,232,236],[238,240,242],[245,248,250]];
    return c[Math.min(11,Math.floor(e*12))];
  }
  if(lat<0.30){
    // Taiga: dark conifer green
    const c=[[28,48,28],[38,65,35],[52,82,45],[68,98,55],[85,108,60],[100,115,68],[118,125,78],[135,138,92],[155,155,112],[175,172,138],[195,190,168],[218,215,200]];
    return c[Math.min(11,Math.floor(e*12))];
  }
  if(lat<0.55){
    // Temperate: rich green-brown
    const c=[[40,62,32],[58,88,45],[78,112,58],[95,132,72],[120,142,78],[148,145,82],[168,155,92],[178,162,108],[192,178,135],[208,198,168],[224,218,200],[240,238,228]];
    return c[Math.min(11,Math.floor(e*12))];
  }
  if(lat<0.75){
    // Tropical: lush vivid green
    const c=[[30,72,28],[42,95,38],[58,118,48],[72,138,58],[88,148,62],[105,152,68],[125,155,78],[142,158,92],[165,168,115],[188,185,148],[210,205,180],[235,232,218]];
    return c[Math.min(11,Math.floor(e*12))];
  }
  if(lat<0.90){
    // Swamp: murky yellow-green
    const c=[[42,52,28],[55,68,35],[72,82,42],[88,95,52],[105,105,58],[118,112,62],[132,122,72],[148,135,88],[168,152,108],[188,172,135],[208,195,168],[230,222,202]];
    return c[Math.min(11,Math.floor(e*12))];
  }
  // Volcanic: reddish-brown
  const c=[[68,38,22],[88,48,28],[108,58,32],[128,68,38],[148,78,42],[165,88,48],[178,98,58],[188,112,72],[200,132,95],[215,158,125],[228,185,160],[242,215,198]];
  return c[Math.min(11,Math.floor(e*12))];
}

self.onmessage=function(ev){
  const {id, night, continent, lakes=[], lake, islands, wx0=0, wy0=0, wx1=10000, wy1=10000, size=600}=ev.data;
  const allLakes=lakes.length?lakes:(lake?[lake]:[]);
  const S=size;
  const buf=new ArrayBuffer(S*S*4);
  const data=new Uint8ClampedArray(buf);
  const ww=wx1-wx0, wh=wy1-wy0;
  // Use more octaves for higher-res tiles (more detail visible)
  const octaves=ww<3000?6:5;
  for(let py=0;py<S;py++)for(let px=0;px<S;px++){
    const wx=wx0+(px/S)*ww, wy=wy0+(py/S)*wh, idx=(py*S+px)*4;
    // Lakes: deeper blue with slight depth variation
    if(allLakes.some(lk=>pip(lk,wx,wy))){
      const ldepth=fbm(wx/3000,wy/3000,3,77)*0.3;
      const lc=night?[8+ldepth*8|0,18+ldepth*12|0,38+ldepth*20|0]:[48+ldepth*30|0,100+ldepth*25|0,155+ldepth*20|0];
      data[idx]=lc[0];data[idx+1]=lc[1];data[idx+2]=lc[2];data[idx+3]=255;continue;
    }
    const onI=islands.some(isl=>pip(isl,wx,wy));
    if(!pip(continent,wx,wy)&&!onI){data[idx+3]=0;continue;}
    const nx=wx/2600,ny=wy/2600,elev=fbm(nx,ny,octaves,42);
    const dd=0.0025,gx=(fbm(nx+dd,ny,octaves,42)-elev)/dd,gy=(fbm(nx,ny+dd,octaves,42)-elev)/dd;
    const shade=Math.max(0.18,Math.min(1.45,0.88-gx*2.2-gy*1.8));
    // Add micro-detail noise for texture
    const micro=0.92+fbm(wx/400,wy/400,3,99)*0.16;
    const[r,g,b]=elevCol(elev,night,wy);
    data[idx]=Math.min(255,(r*shade*micro)|0);data[idx+1]=Math.min(255,(g*shade*micro)|0);data[idx+2]=Math.min(255,(b*shade*micro)|0);data[idx+3]=255;
  }
  // Transfer the buffer (zero-copy)
  self.postMessage({id, buf, night, wx0, wy0, wx1, wy1, size:S}, [buf]);
};
