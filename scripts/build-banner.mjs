import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const duration = 20;
const anim = (attr, values, times, extra = '') => `<animate attributeName="${attr}" values="${values.join(';')}" keyTimes="${times.join(';')}" dur="${duration}s" repeatCount="indefinite" ${extra}/>`;
// Timed actions, in seconds. Walking follows a platform; jumping clears its edge.
// The bridge latches after the middle coin is collected, before either operator leaves.
const tracks = {};
function track(id, x, y) {
  const list = [];
  tracks[id] = {start: [x,y], list};
  return {
    move(start, end, nx, ny=y, height=0) {
      list.push({start,end,x,y,nx,ny,height}); x=nx; y=ny; return this;
    }
  };
}
function stairs(builder, start) {
  return builder.move(start,start+.5,260,199,50)
    .move(start+.6,start+1.1,300,159,50)
    .move(start+1.2,start+1.7,340,119,50);
}
const blue = track('blue',196,239).move(.6,.8,212);
stairs(blue,.9).move(2.7,3.2,396).move(3.25,3.95,496)
  .move(4.12,5.55,796,119,78)
  .move(10.65,11.2,836).move(11.3,11.8,884,159,23)
  .move(11.9,12.4,924,199,23).move(12.5,13,956)
  .move(13.1,13.6,1004,239,23).move(13.7,14.4,1076);
const red = track('red',156,239).move(1.6,2.2,212);
stairs(red,2.3).move(4.1,5.25,496)
  .move(11.4,12.2,556,160,38).move(12.3,14.0,736)
  .move(14.1,14.8,796,119,54).move(14.9,15.5,836)
  .move(15.6,16.1,884,159,23).move(16.2,16.7,924,199,23)
  .move(16.8,17.2,956).move(17.3,17.8,1004,239,23)
  .move(17.85,18.05,996);
const green = track('green',116,239).move(3.1,4.1,212);
stairs(green,4.2).move(6.0,7.1,456)
  .move(8.3,9.1,556,160,65).move(9.2,10.1,636)
  .move(10.2,11.0,716).move(11.1,11.8,796,119,54)
  .move(11.9,12.35,836).move(12.45,12.95,884,159,23)
  .move(13.05,13.55,924,199,23).move(13.65,14.05,956)
  .move(14.15,14.65,1004,239,23).move(14.75,15.2,1036);
// Keep the trailing edge above each descending step until the whole body clears it.
for (const {list} of Object.values(tracks)) for(const a of list)
  if(a.height===23) a.height=34;
const smooth = p => p*p*p*(p*(p*6-15)+10);
const round = n => Math.round(n*100)/100;
function pose(id, t) {
  const {start,list} = tracks[id];
  let [x,y] = start, sx=1,sy=1, tilt=0;
  const active = list.find(a=>t>=a.start && t<=a.end);
  for(const a of list) if(t>a.end) {x=a.nx; y=a.ny;}
  if(active) {
    const a=active, p=(t-a.start)/(a.end-a.start);
    const progress = a.height>70 ? (1-Math.cos(Math.PI*p))/2 : smooth(p);
    x=a.x+(a.nx-a.x)*progress;
    y=a.y+(a.ny-a.y)*p;
    if(a.height) {
      y-=4*a.height*p*(1-p);
      const stretch=Math.sin(Math.PI*p)*.065;
      sx=1-stretch; sy=1+stretch;
      tilt=-7*Math.sin(Math.PI*2*p);
    } else {
      y=a.y-1.6*Math.sin(Math.PI*p)**2*Math.abs(Math.sin(t*19));
      tilt=3.2*Math.sin(t*19)*Math.sin(Math.PI*p);
    }
  }
  // Anticipation and landing deformation pivot around the feet, keeping ground contact.
  for(const a of list.filter(a=>a.height)) {
    if(t>=a.start-.12 && t<a.start) {
      const k=Math.sin(Math.PI*(t-a.start+.12)/.12);
      sx=1+.12*k; sy=1-.12*k;
    }
    if(t>a.end && t<a.end+.13) {
      const k=Math.sin(Math.PI*(t-a.end)/.13);
      sx=1+.14*k; sy=1-.14*k; tilt=0;
    }
  }
  return {x,y,sx,sy,tilt};
}
const ground = [[20,240,260],[240,280,220],[280,320,180],[320,520,140],
  [520,540,180],[740,760,180],[760,860,140],[860,900,180],[900,980,220],[980,1180,260]];
const ceilings = [[20,100,140],[100,140,100],[140,180,60],[340,420,60],
  [860,940,60],[940,980,100],[980,1020,60]];
// Sample the rendered curves, not just endpoints, to detect body and map collisions.
for (let t=0;t<=duration;t+=1/120) {
  const entries=Object.keys(tracks).map(id=>({id,...pose(id,t)}));
  for (const p of entries) {
    for(const [left,right,top] of ground) if(p.x+16>left && p.x-16<right && p.y+16>top+.5)
      throw new Error(`Terrain intersection at ${t.toFixed(3)}s: ${p.id}, x=${p.x.toFixed(1)}`);
    for(const [left,right,bottom] of ceilings) if(p.x+16>left && p.x-16<right && p.y-16<bottom)
      throw new Error(`Ceiling intersection at ${t.toFixed(3)}s: ${p.id}`);
  }
  for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
    const a=entries[i],b=entries[j];
    if(Math.abs(a.x-b.x)<32 && Math.abs(a.y-b.y)<32)
      throw new Error(`Robots overlap at ${t.toFixed(3)}s: ${a.id}, ${b.id}`);
  }
}
const frames=Array.from({length:duration*40+1},(_,i)=>i/40);
// Keep exact normalized sample times; coarse rounding can create duplicate keyTimes.
const keyTimes=frames.map(t=>(t/duration).toFixed(5)).join(';');
const colors={blue:'#38a9ef',red:'#f45b69',green:'#62c972'};
const robot=(id)=>{
  const p=frames.map(t=>pose(id,t));
  const transform=(type,values)=>`<animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" keyTimes="${keyTimes}" dur="20s" repeatCount="indefinite"/>`;
  return `<g>${transform('translate',p.map(f=>`${round(f.x)} ${round(f.y)}`))}
    <g transform="translate(0 15)"><g>${transform('rotate',p.map(f=>round(f.tilt)))}<g>${transform('scale',p.map(f=>`${round(f.sx)} ${round(f.sy)}`))}<g transform="translate(0 -15)" stroke="${colors[id]}" stroke-width="3.5" fill="white">
    <rect x="-15" y="-15" width="30" height="30" rx="8"/>
    <g fill="${colors[id]}" stroke="none"><ellipse cx="-5.5" cy="-2" rx="2.4" ry="5"><animate attributeName="ry" values="5;5;.6;5;5" keyTimes="0;.45;.48;.51;1" dur="${id==='blue'?3.7:id==='red'?4.3:3.1}s" repeatCount="indefinite"/></ellipse><ellipse cx="5.5" cy="-2" rx="2.4" ry="5"><animate attributeName="ry" values="5;5;.6;5;5" keyTimes="0;.45;.48;.51;1" dur="${id==='blue'?3.7:id==='red'?4.3:3.1}s" repeatCount="indefinite"/></ellipse></g>
    <path d="M-4 7Q0 10 4 7" fill="none" stroke-width="1.8" stroke-linecap="round"/></g></g></g></g></g>`;
};
const coin=(x,y,time)=>`<g transform="translate(${x} ${y})">${anim('opacity',[1,1,0,0],[0,time,time+.012,1])}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="1.4s" repeatCount="indefinite"/><rect x="-9" y="-11" width="18" height="22" rx="4" fill="#ffe791" stroke="#f6c746" stroke-width="3"/><path d="M0-5v10" stroke="#fff9d9" stroke-width="3" stroke-linecap="round"/></g></g>`;
// A faint expanding puff gives takeoff and touchdown a readable contact beat.
const dust=Object.entries(tracks).flatMap(([id,{list}])=>list.filter(a=>a.height).flatMap(a=>[
  [a.start,a.x,a.y],[a.end,a.nx,a.ny]
].map(([t,x,y])=>`<ellipse cx="${x}" cy="${y+17}" rx="4" ry="2" fill="none" stroke="${colors[id]}" stroke-width="1.4" opacity="0">${anim('opacity',[0,0,.34,0,0],[0,t/20,(t+.025)/20,(t+.25)/20,1])}${anim('rx',[4,4,17,17],[0,t/20,(t+.25)/20,1])}</ellipse>`))).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320" role="img" aria-labelledby="title desc">
<title id="title">A little teamwork goes a long way</title><desc id="desc">Three colorful square robots collect coins, cooperate on two bridge switches, cross a river, and celebrate a flying matcha cake. Scripted illustration, not a trained policy rollout.</desc>
<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dce5ee" stroke-width=".7"/></pattern><pattern id="stone" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9L9 0" stroke="#c8d0d8" stroke-width=".7"/></pattern></defs>
<rect width="1200" height="320" fill="#fff"/><rect x="20" y="20" width="1160" height="280" fill="url(#grid)"/>
<g fill="#f1f4f6" stroke="#b9c4ce" stroke-width="1.3"><path d="M20 20H180V60H140V100H100V140H20Z"/><path d="M340 20H420V60H340Z"/><path d="M860 20H1020V60H980V100H940V60H860Z"/></g>
<g fill="url(#stone)"><path d="M20 20H180V60H140V100H100V140H20Z"/><path d="M340 20H420V60H340Z"/><path d="M860 20H1020V60H980V100H940V60H860Z"/></g>
<path d="M20 260H240V220H280V180H320V140H520V180H540V300H20Z" fill="#95756a"/>
<path d="M740 300V180H760V140H860V180H900V220H980V260H1180V300Z" fill="#95756a"/>
<g fill="none" stroke="#70d584" stroke-width="9" stroke-linejoin="round"><path d="M20 260H240V220H280V180H320V140H520V180H540"/><path d="M740 180H760V140H860V180H900V220H980V260H1180"/></g>
<path d="M540 282Q565 275 590 282T640 282T690 282T740 282V300H540Z" fill="#d5f1fd"/>
<path d="M550 289h24m15 5h23m18-6h24m17 6h22m18-5h19" stroke="#74c7ed" stroke-width="2" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="0" to="20" dur="2s" repeatCount="indefinite"/></path>
<path d="M524 160Q640 201 756 160" fill="none" stroke="#c7b4aa" stroke-width="3" stroke-dasharray="6 8">${anim('opacity',[.9,.9,0,0],[0,.29,.33,1])}</path>
<g>${anim('opacity',[0,0,1,1],[0,.29,.33,1])}<path d="M520 185H760" stroke="#866557" stroke-width="7"/>
${Array.from({length:12},(_,i)=>`<rect x="${522+i*20}" y="177" width="17" height="8" rx="2" fill="#c2a184"/>`).join('')}
<path d="M523 156H757M523 156V184M757 156V184" stroke="#b49a87" stroke-width="2" fill="none"/></g>
<g><rect x="480" y="135" width="32" height="5" rx="2" fill="#f45b69"/><rect x="780" y="135" width="32" height="5" rx="2" fill="#38a9ef"/>
<circle cx="496" cy="150" r="3" fill="#e5e7eb">${anim('fill',['#e5e7eb','#e5e7eb','#62c972','#62c972'],[0,.262,.268,1])}</circle><circle cx="796" cy="150" r="3" fill="#e5e7eb">${anim('fill',['#e5e7eb','#e5e7eb','#62c972','#62c972'],[0,.277,.283,1])}</circle></g>
<g fill="none" stroke="#94d5a1" stroke-width="2" stroke-dasharray="2 6">${anim('opacity',[0,0,.8,.8,0,0],[0,.28,.30,.34,.36,1])}<path d="M496 150Q640 115 796 150"/></g>
<g transform="translate(636 195)">${anim('opacity',[0,0,1,1],[0,.505,.52,1])}<rect x="-7" y="0" width="14" height="11" rx="2" fill="#70b987"/><path d="M-4 0V-4a4 4 0 0 1 8 0V0" fill="none" stroke="#70b987" stroke-width="2"/></g>
${coin(396,109,.16)}${coin(636,143,.505)}${coin(836,109,.56)}${coin(956,189,.65)}
<g>${anim('opacity',[1,1,0,0],[0,.965,.985,1])}${dust}${robot('blue')}${robot('red')}${robot('green')}</g>
<g transform="translate(1110 240)"><g>${anim('opacity',[1,1,1,0,0],[0,.91,.965,.99,1])}<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -105;0 -150;0 -150" keyTimes="0;.91;.96;.99;1" calcMode="spline" keySplines=".4 0 .6 1;.25 .1 .4 1;.4 0 .7 1;0 0 1 1" dur="20s" repeatCount="indefinite"/>
<ellipse cy="17" rx="23" ry="5" fill="#e5e7eb"/><rect x="-19" y="-6" width="38" height="22" rx="4" fill="#badb8c" stroke="#7eaa50" stroke-width="2"/><path d="M-20-5Q-14-14-7-7Q0-16 7-7Q14-14 20-5V0H-20Z" fill="white" stroke="#bec9b5" stroke-width="1.5"/><g fill="#7eaa50"><circle cx="-6" cy="-7" r="1.6"/><circle cy="-9" r="1.6"/><circle cx="6" cy="-7" r="1.6"/></g>
<g stroke="#efc654" stroke-width="2" stroke-linecap="round">${anim('opacity',[0,0,1,1,0],[0,.84,.87,.93,1])}<path d="M-32-8h-8m12-14-5-6M31-8h8m-12-14 5-6M0-25v-9"/></g></g></g>
<rect x="20" y="20" width="1160" height="280" rx="5" fill="white" opacity="0">${anim('opacity',[1,0,0,1],[0,.025,.98,1])}</rect>
</svg>`;
mkdirSync(root+'assets',{recursive:true});
writeFileSync(root+'assets/marl-team-loop.svg',svg);
console.log('Generated 20-second banner; sampled robot separation check passed.');
