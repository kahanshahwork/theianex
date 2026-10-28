/* Theianex "world": one fixed WebGL scene behind every page.
   Glossy document tiles float over a curved crosshair grid, lit by one moving blue glow.
   Every chapter decides how many tiles are seen, where they go, and how loud the grid is.
   Sections opt in with data attributes:
     data-chapter="Name"   marks a chapter (also drives the corner marker)
     data-form="none|stream|orbit|cluster|column|stack"   what the tiles do while this chapter is on screen
     data-n="5"            how many tiles are visible (the rest wait out of sight)
     data-pos="x,y"        anchor, -1..1 of the screen (cluster, column, stack)
     data-path="0..2"      route for a stream      data-r=".94"   orbit size
     data-glow="0..5"      glow preset             data-grid="0..4"   grid preset
   Pinned sections (.pin, data-pin="steps") can list one scene per step: data-scenes="a,b,c" (see SC below).
     data-doc="tech|how"   drives the live paper sheet from scroll (files fall into a core, the sheet is written, scanned, stamped)
     data-go               the gate of a "jam" scene opens as the step moves from problem to help
   The grid fades by itself wherever text or a panel is on screen, and tiles dim when they pass behind plain text.
   Source lives in src/world-src; `npm run bundle:world` writes the minified src/js/world.js that the site loads. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Group, Shape, ExtrudeGeometry, MeshPhysicalMaterial, MeshStandardMaterial,
  MeshBasicMaterial, CanvasTexture, SRGBColorSpace, PMREMGenerator, PlaneGeometry, ShaderMaterial, Color, DirectionalLight,
  HemisphereLight, Points, BufferGeometry, BufferAttribute, PointsMaterial, Vector3, Vector4, DoubleSide, ACESFilmicToneMapping, TorusGeometry,
} from 'three';


const root = document.documentElement;
const canvas = document.getElementById('world');
if (!canvas) throw new Error('no canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth < 760;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const tok = (n) => getComputedStyle(root).getPropertyValue(n).trim();
const themeOf = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

/* ---------- colours from CSS tokens ---------- */
function parseCss(v) {
  v = v.trim();
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(parseFloat); return { c: new Color(p[0] / 255, p[1] / 255, p[2] / 255), a: p[3] == null ? 1 : p[3] }; }
  return { c: new Color(v), a: 1 };
}
const triple = (v) => v.split(',').map((x) => parseFloat(x) / 255);

/* ---------- renderer, scene, camera ---------- */
let renderer;
try {
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { document.body.classList.add('no-world'); throw e; }
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new Scene();
const camera = new PerspectiveCamera(38, 1, 0.1, 80);
camera.position.set(0, 0, 9);
let W = 5.5, H = 3.1, aspect = 1.77, vw = 1, vh = 1;

/* studio environment for glossy reflections */
{
  const pm = new PMREMGenerator(renderer);
  const env = new Scene();
  const box = (w, h, x, y, z, col, i) => { const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(col).multiplyScalar(i), side: DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(14, 5, 0, 9, 0, '#ffffff', 2.2); box(5, 12, -9, 1, 2, '#9db8ff', 1.4); box(4, 10, 9, -1, 3, '#3d6bff', 1.8); box(12, 4, 0, -9, 0, '#274bd0', .9); box(10, 6, 0, 2, -9, '#ffffff', .8);
  scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
}
const key = new DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 6); scene.add(key);
scene.add(new HemisphereLight(0xcfe0ff, 0x0b1430, 0.6));


/* ---------- background glow + grid (shader) ---------- */
/* one blue family only: deep blue -> electric blue -> pale blue, swept in from an edge */
const bgMat = new ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: {
    uRes: { value: [1, 1] }, uBg: { value: new Color('#03060f') },
    uC1: { value: [.05, .22, .9] }, uC2: { value: [.14, .42, 1] }, uC3: { value: [.62, .8, 1] }, uP: { value: [.8, 1.05] }, uS: { value: 1.1 }, uA: { value: .9 },
    uD: { value: [.03, .14, .6] }, uP2: { value: [.1, .2] }, uS2: { value: .7 }, uA2: { value: .0 },
    uR: { value: Array.from({ length: 8 }, () => new Vector4(0, 0, 0, 0)) }, uTK: { value: .5 },
  },
  vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `
    uniform vec2 uRes; uniform vec3 uBg,uC1,uC2,uC3,uD; uniform vec2 uP,uP2; uniform float uS,uA,uS2,uA2,uTK; uniform vec4 uR[8];
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y;
      float d=length((uv-uP)*vec2(asp,1.))/uS; float k=1.-clamp(d,0.,1.);
      vec3 col=mix(uC1,uC2,smoothstep(.08,.65,k)); col=mix(col,uC3,pow(k,3.2));
      float m=1.; for(int i=0;i<8;i++){ vec4 r=uR[i]; if(r.z>r.x){ vec2 dd=max(max(r.xy-uv,uv-r.zw),0.); float dl=length(dd*vec2(asp,1.)); m*=1.-(1.-uTK)*(1.-smoothstep(0.,.22,dl)); } }
      float a=uA*smoothstep(0.,.3,k)*m;
      float d2=length((uv-uP2)*vec2(asp,1.))/uS2; float k2=1.-clamp(d2,0.,1.);
      vec3 base=mix(uBg,col,clamp(a,0.,1.));
      base=mix(base,uD,clamp(uA2*pow(k2,1.8),0.,1.));
      base+=(hash(gl_FragCoord.xy)-.5)/200.;
      gl_FragColor=vec4(base,1.);
    }`,
});
const bgQuad = new Mesh(new PlaneGeometry(2, 2), bgMat); bgQuad.frustumCulled = false; bgQuad.renderOrder = -20; scene.add(bgQuad);

/* the grid is bent like the inside of a dome, thin lines with small crosses, and it hides itself under text */
const NRECT = 8; /* the same screen rectangles (text and panels) quiet both the grid and the glow */
const gridMat = new ShaderMaterial({
  transparent: true, depthWrite: false, side: DoubleSide,
  uniforms: {
    uGrid: { value: new Color('#dce8ff') }, uGridA: { value: .22 }, uCross: { value: new Color('#e6eeff') }, uCrossA: { value: .55 }, uOff: { value: 0 }, uNear: { value: 4 }, uFar: { value: 34 },
    uBend: { value: 1 }, uRes: { value: [1, 1] }, uR: { value: Array.from({ length: NRECT }, () => new Vector4(0, 0, 0, 0)) }, uRK: { value: .1 }, uQ: { value: 1 }, uQC: { value: 1 },
  },
  vertexShader: `uniform float uBend; varying vec2 vP; varying float vD;
    void main(){ vP=position.xy; vec3 p=position; p.z+=uBend*dot(p.xy,p.xy)*.0042; vec4 mv=modelViewMatrix*vec4(p,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `
    uniform vec3 uGrid,uCross; uniform float uGridA,uCrossA,uOff,uNear,uFar,uRK,uQ,uQC; uniform vec2 uRes; uniform vec4 uR[${NRECT}]; varying vec2 vP; varying float vD;
    void main(){
      vec2 p=vP+vec2(uOff,uOff*.4);
      vec2 w=fwidth(p); vec2 g=abs(fract(p-.5)-.5)/max(w,vec2(1e-4));
      float line=1.-clamp(min(g.x,g.y),0.,1.);
      vec2 q=abs(fract(p/3.-.5)-.5)*3.; vec2 aa=max(w,vec2(1e-4))*1.2;
      float cx=(1.-smoothstep(.03,.03+aa.y,q.y))*(1.-smoothstep(.3,.3+aa.x,q.x));
      float cy=(1.-smoothstep(.03,.03+aa.x,q.x))*(1.-smoothstep(.3,.3+aa.y,q.y));
      float cr=clamp(cx+cy,0.,1.);
      vec2 uv=gl_FragCoord.xy/uRes; float m=1.;
      for(int i=0;i<${NRECT};i++){ vec4 r=uR[i]; if(r.z>r.x){ vec2 dd=max(max(r.xy-uv,uv-r.zw),0.); float dl=length(dd*vec2(uRes.x/uRes.y,1.)); m*=1.-(1.-uRK)*(1.-smoothstep(0.,.11,dl)); } }
      float fade=smoothstep(uFar,uNear,vD);
      vec3 col=mix(uGrid,uCross,cr); float a=max(line*uGridA*uQ,cr*uCrossA*uQC)*fade*m;
      if(a<.004) discard; gl_FragColor=vec4(col,a);
    }`,
});
bgMat.uniforms.uR = gridMat.uniforms.uR;
const grid = new Mesh(new PlaneGeometry(90, 90, 120, 120), gridMat); grid.renderOrder = -10; scene.add(grid);


/* dust */
const dust = (() => {
  const n = 160, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = (Math.random() - .5) * 18; pos[i * 3 + 2] = -6 + Math.random() * 9; }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
  const m = new Points(g, new PointsMaterial({ size: .045, sizeAttenuation: true, transparent: true, opacity: .55, depthWrite: false, color: 0xcfdcff }));
  scene.add(m); return m;
})();

/* ---------- tile textures ---------- */
const S = 256;
function tex(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; t.offset.set(.5, .5); t.repeat.set(1, 1); return t;
}
const stroke = (x) => { x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 13; x.lineCap = 'round'; x.lineJoin = 'round'; };
const glyphs = [
  (x) => { x.beginPath(); x.moveTo(84, 60); x.lineTo(150, 60); x.lineTo(176, 86); x.lineTo(176, 196); x.lineTo(84, 196); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(104, 120); x.lineTo(156, 120); x.moveTo(104, 150); x.lineTo(156, 150); x.stroke(); },
  (x) => { x.beginPath(); x.moveTo(76, 190); x.lineTo(180, 190); x.stroke(); [[92, 150], [128, 118], [164, 78]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a, 190); x.lineTo(a, b); x.stroke(); }); },
  (x) => { x.beginPath(); x.moveTo(128, 56); x.lineTo(184, 78); x.lineTo(184, 128); x.quadraticCurveTo(184, 178, 128, 204); x.quadraticCurveTo(72, 178, 72, 128); x.lineTo(72, 78); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(104, 128); x.lineTo(122, 146); x.lineTo(154, 112); x.stroke(); },
  (x) => { x.beginPath(); x.arc(128, 128, 62, 0, 7); x.stroke(); x.beginPath(); x.moveTo(100, 130); x.lineTo(122, 152); x.lineTo(160, 108); x.stroke(); },
  (x) => { x.beginPath(); x.arc(128, 98, 28, 0, 7); x.stroke(); x.beginPath(); x.arc(128, 214, 62, Math.PI * 1.18, Math.PI * 1.82); x.stroke(); },
  (x) => { x.beginPath(); x.arc(116, 116, 46, 0, 7); x.stroke(); x.beginPath(); x.moveTo(150, 150); x.lineTo(186, 186); x.stroke(); },
  (x) => { const p = [[128, 70], [78, 170], [178, 170]]; x.beginPath(); p.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.stroke(); p.forEach(([a, b]) => { x.fillStyle = '#2459f0'; x.beginPath(); x.arc(a, b, 17, 0, 7); x.fill(); x.stroke(); }); },
  (x) => { x.beginPath(); x.roundRect(72, 82, 112, 100, 14); x.stroke(); x.beginPath(); x.moveTo(72, 112); x.lineTo(184, 112); x.moveTo(104, 66); x.lineTo(104, 92); x.moveTo(152, 66); x.lineTo(152, 92); x.stroke(); [[100, 142], [128, 142], [156, 142], [100, 166]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); }); },
  (x) => { x.beginPath(); for (let i = 0; i <= 80; i++) { const t = (i / 80) * Math.PI * 2, d = 1 + Math.sin(t) * Math.sin(t), px = 128 + 64 * Math.cos(t) / d, py = 128 + 64 * Math.sin(t) * Math.cos(t) / d * 1.3; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); },
];
const glyphTex = glyphs.map((g) => tex((x, w, h) => {
  const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#86adff'); gr.addColorStop(.42, '#3c78ff'); gr.addColorStop(1, '#1b46d8'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const hl = x.createRadialGradient(w * .2, h * .12, 4, w * .2, h * .12, w * .8); hl.addColorStop(0, 'rgba(255,255,255,.42)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = hl; x.fillRect(0, 0, w, h);
  stroke(x); g(x);
}, S, S));
const paperLine = '#c3cde6';
const sheets = [
  (x, w, h) => { x.fillStyle = '#2f6bff'; x.fillRect(28, 30, 90, 14); x.fillStyle = paperLine; for (let i = 0; i < 8; i++) x.fillRect(28, 70 + i * 26, i % 3 === 2 ? 120 : 200, 10); },
  (x, w, h) => { x.fillStyle = '#2f6bff'; x.fillRect(28, 30, 70, 14); x.fillStyle = paperLine; x.fillRect(28, 62, 200, 10); x.fillRect(28, 82, 150, 10); [[40, 70], [80, 110], [120, 90], [160, 140]].forEach(([a, b], i) => { x.fillStyle = i === 3 ? '#2f6bff' : '#9fb3e8'; x.fillRect(32 + i * 46, 270 - b, 30, b); }); },
  (x, w, h) => { x.fillStyle = '#2f6bff'; x.fillRect(28, 30, 100, 14); x.strokeStyle = paperLine; x.lineWidth = 3; for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) x.strokeRect(28 + c * 68, 70 + r * 34, 68, 34); x.fillStyle = paperLine; x.fillRect(28, 290, 140, 10); },
  (x, w, h) => { x.fillStyle = '#2f6bff'; x.fillRect(28, 30, 84, 14); for (let i = 0; i < 5; i++) { x.strokeStyle = '#2f6bff'; x.lineWidth = 4; x.strokeRect(28, 70 + i * 40, 20, 20); if (i < 3) { x.beginPath(); x.moveTo(32, 80 + i * 40); x.lineTo(38, 88 + i * 40); x.lineTo(46, 74 + i * 40); x.stroke(); } x.fillStyle = paperLine; x.fillRect(62, 76 + i * 40, 150, 10); } },
  (x, w, h) => { x.fillStyle = '#2f6bff'; x.fillRect(28, 30, 110, 14); x.fillStyle = paperLine; for (let i = 0; i < 4; i++) x.fillRect(28, 66 + i * 24, 190, 10); x.strokeStyle = '#17a673'; x.lineWidth = 6; x.beginPath(); x.arc(150, 232, 38, 0, 7); x.stroke(); x.beginPath(); x.moveTo(132, 232); x.lineTo(146, 246); x.lineTo(170, 218); x.stroke(); },
].map((d) => tex((x, w, h) => { x.fillStyle = '#f2f6ff'; x.fillRect(0, 0, w, h); d(x, w, h); }, 256, 320));

/* ---------- tiles ---------- */
function roundedShape(w, h, r) {
  const s = new Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const tileGeo = (w, h) => new ExtrudeGeometry(roundedShape(w, h, .12), { depth: .14, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 3, curveSegments: 8 });
const geoSq = tileGeo(1, 1), geoSh = tileGeo(.8, 1);
const sideBlue = new MeshStandardMaterial({ color: 0x1a3fc4, roughness: .35, metalness: .1 });
const sideWhite = new MeshStandardMaterial({ color: 0xcfd8f0, roughness: .6 });
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(7);
const N_MAX = 9;
const tiles = [];
let sheetN = 0, glyphN = 0;
for (let i = 0; i < N_MAX; i++) {
  const sheet = i % 3 === 2;
  const mat = sheet
    ? new MeshStandardMaterial({ map: sheets[sheetN++ % sheets.length], roughness: .55, metalness: 0, envMapIntensity: .55 })
    : new MeshPhysicalMaterial({ map: glyphTex[glyphN++ % glyphTex.length], roughness: .26, metalness: 0, clearcoat: 1, clearcoatRoughness: .18, envMapIntensity: 1.25 });
  mat.transparent = true;
  if (sheet) { mat.emissive = new Color(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = .72; }
  const mesh = new Mesh(sheet ? geoSh : geoSq, [mat, sheet ? sideWhite : sideBlue]);
  mesh.visible = false; scene.add(mesh);
  tiles.push({ mesh, mat, sheet, r: [rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd()], p: new Vector3(0, 0, -20), rot: new Vector3(), s: 1, rate: 2.6 + rnd() * 2.2, born: false, lift: 0, vis: 0, dim: 0, dimF: 0 });
}


/* ---------- the live document ----------
   Tile 2 is a paper sheet whose face is redrawn from scroll: lines are written, a scan line passes, flags are raised then resolved, a stamp lands. */
const DW = 320, DH = 400;
const docCv = document.createElement('canvas'); docCv.width = DW; docCv.height = DH;
const dx = docCv.getContext('2d');
const docTex = new CanvasTexture(docCv); docTex.colorSpace = SRGBColorSpace; docTex.anisotropy = 4; docTex.offset.set(.5, .5);
const DOC0 = { build: 1, scan: 0, resolve: 0, stamp: 0 };
const ROWS = [[76, .4, 1], [102, .95], [124, .82], [146, .9], [168, .5], [200, .4, 1], [226, .92], [248, .8], [270, .88], [292, .56], [324, .4, 1]];
const FLAGS = [3, 7];
let docKey = '';
function drawDoc(s) {
  const x = dx; x.clearRect(0, 0, DW, DH); x.fillStyle = '#f2f6ff'; x.fillRect(0, 0, DW, DH);
  x.fillStyle = '#2f6bff'; x.fillRect(46, 36, 104 * clamp(s.build * 14, 0, 1), 15);
  const prog = s.build * ROWS.length * 1.02;
  ROWS.forEach((r, i) => {
    const p = clamp(prog - i, 0, 1); if (p <= 0) return;
    x.fillStyle = r[2] ? '#7f9bf0' : '#c3cde6'; x.fillRect(46, r[0], 228 * r[1] * p, r[2] ? 12 : 10);
  });
  const top = 62, bot = 340;
  if (s.scan > 0 && s.scan < 1) {
    const y = top + s.scan * (bot - top), g = x.createLinearGradient(0, y - 46, 0, y);
    g.addColorStop(0, 'rgba(47,107,255,0)'); g.addColorStop(1, 'rgba(47,107,255,.32)'); x.fillStyle = g; x.fillRect(34, y - 46, 252, 46);
    x.fillStyle = '#2f6bff'; x.fillRect(34, y - 1.5, 252, 3);
  }
  FLAGS.forEach((ri) => {
    const yr = ROWS[ri][0] + 5, passed = s.scan >= 1 ? 1 : clamp((top + s.scan * (bot - top) - yr) / 22, 0, 1);
    if (passed <= 0) return;
    x.fillStyle = 'rgba(47,107,255,' + (.11 * passed * (1 - s.resolve)).toFixed(3) + ')'; x.fillRect(38, yr - 13, 244, 26);
    const rr = 9 * passed, cx = 266, ok = s.resolve;
    x.fillStyle = ok > .5 ? '#17a673' : '#2f6bff'; x.beginPath(); x.arc(cx, yr, rr, 0, 7); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
    if (ok > .5) { x.moveTo(cx - 4, yr); x.lineTo(cx - 1, yr + 3.4); x.lineTo(cx + 4.6, yr - 3.4); } else { x.moveTo(cx, yr - 4); x.lineTo(cx, yr + .6); x.moveTo(cx, yr + 3.6); x.lineTo(cx, yr + 3.7); }
    x.stroke();
  });
  if (s.stamp > 0) {
    const e = smooth(s.stamp); x.save(); x.translate(172, 356); x.rotate(-.12); x.scale(1 + (1 - e) * .35, 1 + (1 - e) * .35); x.globalAlpha = e;
    x.strokeStyle = '#17a673'; x.fillStyle = '#17a673'; x.lineWidth = 3.4; x.beginPath(); x.roundRect(-96, -22, 192, 44, 8); x.stroke();
    x.font = '700 13.5px Geist, Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('REVIEWED BY A', 8, -3); x.fillText('PARAPLANNER', 8, 14);
    x.lineWidth = 3.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-80, 0); x.lineTo(-72, 8); x.lineTo(-58, -8); x.stroke(); x.restore();
  }
  docTex.needsUpdate = true;
}
function setDoc(s) {
  const k = [s.build, s.scan, s.resolve, s.stamp].map((v) => Math.round(clamp(v, 0, 1) * 70)).join();
  if (k !== docKey) { docKey = k; drawDoc(s); }
}
tiles[2].mat.map = docTex; tiles[2].mat.emissiveMap = docTex; setDoc(DOC0);

/* a core the files fall into, and a gate they queue at */
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(150,190,255,.95)'); gr.addColorStop(.32, 'rgba(47,107,255,.5)'); gr.addColorStop(1, 'rgba(47,107,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
})();
const coreG = new Group();
const coreGlow = new Mesh(new PlaneGeometry(3.4, 3.4), new MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0 }));
const coreR1 = new Mesh(new TorusGeometry(.62, .028, 12, 80), new MeshBasicMaterial({ color: 0x9cc0ff, transparent: true, opacity: 0, depthWrite: false }));
const coreR2 = new Mesh(new TorusGeometry(.4, .02, 12, 64), new MeshBasicMaterial({ color: 0x5f95ff, transparent: true, opacity: 0, depthWrite: false }));
coreR1.rotation.x = 1.15; coreR2.rotation.x = 1.15; coreR2.rotation.y = .6;
[coreGlow, coreR1, coreR2].forEach((m) => { m.renderOrder = -4; coreG.add(m); }); coreG.visible = false; scene.add(coreG);
const gateMat = new MeshPhysicalMaterial({ color: 0x1d46d6, roughness: .24, metalness: 0, clearcoat: 1, clearcoatRoughness: .2, envMapIntensity: 1.3, transparent: true, opacity: 0 });
const slabGeo = tileGeo(.3, 2.8);
const slabA = new Mesh(slabGeo, gateMat), slabB = new Mesh(slabGeo, gateMat), gateG = new Group();
gateG.add(slabA, slabB); gateG.visible = false; scene.add(gateG);
const gateNow = { x: 0, y: 0, fa: 0, w: .3, v: 0, set: false };

/* ---------- formations: what the tiles do in each chapter ---------- */
const PATHS = [ /* stream routes: start (a pile at the back), middle, end. x,y are fractions of the screen half-size, z is depth */
  { s: [.3, .66, -3.6], m: [.66, .36, -.4], e: [1.02, -.3, 1.6] },
  { s: [.1, -.7, -3.4], m: [.6, -.1, -.2], e: [1., .56, 1.5] },
  { s: [.86, .84, -3.2], m: [.8, 0, -.3], e: [.9, -.84, -2.6] },
];
const CL = [[-1, .3, .2], [.1, -.25, .9], [1.05, .42, -.3], [-.25, .95, -.9], [.75, -.85, .4]]; /* cluster offsets */
const HIDE = (c) => ({ x: c.px * W * .5, y: c.py * H * .5, z: -6.5, rx: .2, ry: 1.3, rz: 0, s: .05, v: 0 });
const MAXN = { stream: 5, orbit: 8, cluster: 5, column: 6, stack: 8, jam: 5, doc: 9, none: 0 };
const MOBN = { stream: 3, orbit: 6, cluster: 3, column: 6, stack: 4, jam: 4, doc: 9, none: 0 };
const nOf = (c) => Math.min(c.n || { stream: 5, orbit: 6, cluster: 3, column: 6, stack: 7, jam: 5, doc: 9, none: 0 }[c.form] || 0, (small() ? MOBN : MAXN)[c.form] || 0);
let phase = 0; /* stream phase: time + scroll + the nudge a tab click gives */
const HEAP = [[0, 0, 0], [.62, .2, -.2], [-.5, .34, .15], [.18, -.52, .3], [-.3, -.3, -.3], [.8, -.34, .1]]; /* a pile of unfinished documents */
const DFILES = [0, 1, 3, 4]; /* the tiles that fall into the core */
const SK = () => (small() ? clamp(W / 3.6, .5, .9) : .82); /* global tile size factor */
/* where the document scene puts the core and the sheet (world units) */
function docGeo(c) {
  const sm = small(), sx = c.px * W, sy = c.py * H, ss = sm ? 2 : H * 1.1; /* ss: final height of the sheet in world units */
  return { sx, sy, ss, cx: sm ? sx - W * .46 : sx - W * .36, cy: sm ? sy + H * .52 : sy + H * .4 };
}
function formation(c, i, t) {
  const n = nOf(c);
  if (i >= n) return HIDE(c);
  const r = tiles[i].r, px = (small() && c.form === 'column' ? .86 : c.px) * W, py = c.py * H, ks = small() ? .55 : 1;
  switch (c.form) {
    case 'doc': {
      const D = docGeo(c), fi = DFILES.indexOf(i), o = D.ss / 3.1, inn = c.inn || 0, sh = c.sh || 0, stk = c.stk || 0;
      if (fi >= 0) { /* files drop into the core one after another */
        const u = clamp(inn * 1.5 - fi * .27, 0, 1), e = smooth(u), sx0 = D.cx + (fi - 1.5) * .78 * (small() ? .6 : 1), sy0 = H * 1.16;
        return { x: lerp(sx0, D.cx, e), y: lerp(sy0, D.cy, e), z: lerp(.6, -.2, e), rx: (r[3] - .5) * .5 + e * .5, ry: (r[4] - .5) * .8, rz: (r[5] - .5) * .6 + e * (r[4] - .5) * 3.4,
          s: lerp(1, .42, e) * (small() ? .7 : .92), v: smooth(clamp(u / .12, 0, 1)) * (1 - smooth(clamp((u - .8) / .2, 0, 1))) };
      }
      if (i === 2) { /* the sheet grows out of the core */
        const e = smooth(clamp(sh, 0, 1));
        return { x: lerp(D.cx, D.sx, e), y: lerp(D.cy, D.sy, e), z: lerp(-.3, 0, e), rx: -.04, ry: -.2 + (1 - e) * .9, rz: -.025 + (1 - e) * .5, s: Math.max(D.ss / SK() * e, .01), v: sh > .01 ? 1 : 0 };
      }
      if (i === 5 || i === 8) { /* finished sheets sit behind it in a neat stack */
        const j = i === 5 ? 1 : 2, k = smooth(clamp(stk * 2 - (j - 1), 0, 1));
        return { x: lerp(D.sx, D.sx + .36 * j * o, k), y: lerp(D.sy, D.sy - .26 * j * o, k), z: -.12 - .16 * j, rx: -.04, ry: -.2, rz: -.025 + j * .012, s: D.ss / SK() * .995, v: k > .02 ? 1 : 0 };
      }
      return HIDE(c);
    }
    case 'jam': {
      if (c.pile) { /* the heap, before any gate */
        const o = HEAP[i % HEAP.length];
        return { x: px + o[0] * ks * 1.15, y: py + o[1] * ks * 1.15, z: o[2], rx: (r[3] - .5) * .5, ry: (r[4] - .5) * .8 - .2, rz: (r[5] - .5) * 1.1, s: (.95 + r[6] * .35) * (small() ? .8 : 1), v: 1 };
      }
      const fa = c.fa || 0, fx = Math.cos(fa), fy = Math.sin(fa), qx = -fy, qy = fx, e = smooth(clamp(c.go || 0, 0, 1)), spd = (c.sp || 1) * (small() ? .75 : 1);
      const back = (.78 + i * .5 * spd + Math.sin(t * 1.3 + i * 1.9) * (c.bob == null ? .06 : c.bob)) * ks, lat = (Math.sin(i * 2.4 + 1) * .5 + (r[0] - .5) * .5) * (.5 + i * .09) * ks;
      const jx = px - fx * back + qx * lat, jy = py - fy * back + qy * lat;
      const u = (((i / n + t * .09) % 1) + 1) % 1, along = lerp(-3.4, 3.8, u) * (small() ? .7 : 1), wx = px + fx * along + qx * Math.sin(i * 1.7) * .14, wy = py + fy * along + qy * Math.sin(i * 1.7) * .14;
      const vf = smooth(clamp((u - .04) / .1, 0, 1)) * (1 - smooth(clamp((u - .85) / .14, 0, 1)));
      return { x: lerp(jx, wx, e), y: lerp(jy, wy, e), z: lerp(i * .06, 0, e), rx: lerp((r[3] - .5) * .5, -.1, e), ry: lerp((r[4] - .5) * .7, -.25, e), rz: lerp((r[5] - .5) * 1.1 + Math.sin(t * 9 + i * 3) * .03, fa * .2, e),
        s: (.84 + r[6] * .12) * (small() ? .78 : 1), v: lerp(1, vf, e) };
    }
    case 'stream': {
      const P = PATHS[c.path % PATHS.length], u = (((i / n + c.off + phase) % 1) + 1) % 1, q = 1 - u;
      const e = smooth(clamp(u * 1.25, 0, 1));
      const v = smooth(clamp((u - .03) / .09, 0, 1)) * (1 - smooth(clamp((u - .86) / .13, 0, 1)));
      return { x: (q * q * P.s[0] + 2 * q * u * P.m[0] + u * u * P.e[0]) * W, y: (q * q * P.s[1] + 2 * q * u * P.m[1] + u * u * P.e[1]) * H, z: q * q * P.s[2] + 2 * q * u * P.m[2] + u * u * P.e[2],
        rx: .2 - .3 * e, ry: lerp(1.3, -.3, e), rz: (r[5] - .5) * .25 - .1 * e, s: (.45 + 1.3 * e) * (.92 + r[6] * .16) * (small() ? .8 : 1), v };
    }
    case 'orbit': {
      const a = (i / n) * Math.PI * 2 + t * .035 + scrollY * .00028 + .6, rr = c.r || .94, dp = Math.sin(a * 2 + i * 1.7);
      return { x: Math.cos(a) * W * rr * 1.03, y: Math.sin(a) * H * rr, z: dp * .9, rx: Math.sin(a) * .45, ry: -Math.cos(a) * .6, rz: (r[5] - .5) * .5, s: ((small() ? .55 : .66) + (dp * .5 + .5) * .42 + r[6] * .1), v: 1 };
    }
    case 'cluster': {
      const o = CL[i % CL.length], k = 1.15 * ks;
      return { x: px + o[0] * k + Math.sin(t * .25 + i * 2.1) * .1 * ks, y: py + o[1] * k + Math.cos(t * .3 + i * 1.7) * .1 * ks + Math.sin(scrollY * .0011 + i) * .12, z: o[2], rx: (r[3] - .5) * .7, ry: (r[4] - .5) * 1.1 - .15, rz: (r[5] - .5) * .5, s: (.8 + r[6] * .5) * (small() ? .85 : 1), v: 1 };
    }
    case 'column': {
      const u = n > 1 ? i / (n - 1) : .5;
      return { x: px + Math.sin(u * Math.PI) * .16 * ks, y: lerp(.74, -.74, u) * H, z: 0, rx: .1, ry: -.5, rz: -.05 + (r[5] - .5) * .08, s: small() ? .8 : .95, v: 1, col: 1 };
    }
    case 'stack': {
      const sx = small() ? .45 : c.px;
      return { x: sx * W + (r[0] - .5) * .16 + i * .018, y: py + (i - n / 2) * .05, z: (i - n / 2) * .16, rx: -.32, ry: .22 + (r[4] - .5) * .1, rz: (r[5] - .5) * .1 - .06, s: (1.1 + (tiles[i].sheet ? .12 : 0)) * (small() ? .8 : 1), v: 1 };
    }
    default: return HIDE(c);
  }
}

/* ---------- presets ---------- */
/* glows: all one blue family. p = centre (0..1 of screen, can sit past the edge), s = size, a = strength. The second glow is a deep blue wash. */
const C1 = [.05, .22, .9], C2 = [.14, .42, 1], C3 = [.62, .8, 1], DB = [.03, .13, .55];
const GLOWS = [
  { p: [.94, .98], s: .6, a: 1, c: [C1, C2, C3], p2: [.05, .1], s2: .6, a2: .3 },        /* 0 from the top right */
  { p: [-.02, .04], s: .58, a: .95, c: [C1, C2, C3], p2: [.95, .9], s2: .6, a2: .25 },   /* 1 from the bottom left */
  { p: [.5, -.14], s: .62, a: .95, c: [C1, C2, C3], p2: [.1, .95], s2: .55, a2: .25 },  /* 2 from underneath */
  { p: [1.04, .42], s: .58, a: 1, c: [C1, C2, C3], p2: [0, .1], s2: .6, a2: .25 },      /* 3 from the right */
  { p: [.05, 1.04], s: .58, a: .95, c: [C1, C2, C3], p2: [.9, 0], s2: .6, a2: .28 },    /* 4 from the top left */
  { p: [.8, -.02], s: .72, a: .62, c: [C1, C2, C3], p2: [.1, .9], s2: .5, a2: .2 },     /* 5 low and calm */
];
GLOWS.forEach((g) => { g.d = DB; });
/* grids: tilt/y/rz place the plane, bend curves it, q and qc set how loud lines and crosses are */
const GRIDS = [
  { tilt: -1.12, y: -2.3, rz: -.12, off: 0, bend: 1, q: 1, qc: 1 },        /* 0 dome */
  { tilt: -1.36, y: -2.9, rz: 0, off: 5, bend: 0, q: .85, qc: .8 },        /* 1 flat floor */
  { tilt: -.6, y: -1.5, rz: .35, off: 9, bend: .5, q: .7, qc: .6 },        /* 2 leaning wall */
  { tilt: -1.0, y: -2.2, rz: .2, off: 3, bend: .6, q: .4, qc: .15 },       /* 3 quiet */
  { tilt: -1.25, y: -2.6, rz: -.6, off: 13, bend: .3, q: .8, qc: .7 },     /* 4 diagonal floor */
];

/* ---------- scenes: one per step of a pinned section ---------- */
const PI = Math.PI;
const SC = {
  /* home: Trained / Equipped / Flexible */
  who0: { form: 'stream', n: 5, path: 0, glow: 0, grid: 0 },
  who1: { form: 'cluster', n: 3, pos: [.62, 0], mp: [.5, -.5], glow: 3, grid: 1 },
  who2: { form: 'stream', n: 4, path: 2, glow: 5, grid: 4 },
  /* the ParaTech moment */
  ptx: { form: 'stream', n: 3, path: 1, glow: 5, grid: 3 },
  /* home: Faster / Smarter / More efficient. The sheet and the core come from the data-doc timeline. */
  t0: { form: 'doc', pos: [.56, -.04], mp: [0, -.66], glow: 2, grid: 3 },
  t1: { form: 'doc', pos: [.56, -.04], mp: [0, -.66], glow: 4, grid: 2 },
  t2: { form: 'doc', pos: [.56, -.04], mp: [0, -.66], glow: 5, grid: 1 },
  /* how we work: Brief / Prepare / Diligence / Deliver */
  h0: { form: 'doc', pos: [.58, -.04], mp: [0, -.66], glow: 1, grid: 2 },
  h1: { form: 'doc', pos: [.58, -.04], mp: [0, -.66], glow: 3, grid: 1 },
  h2: { form: 'doc', pos: [.58, -.04], mp: [0, -.66], glow: 0, grid: 4 },
  h3: { form: 'doc', pos: [.58, -.04], mp: [0, -.66], glow: 5, grid: 3 },
  /* why ianex: the pile, five bottlenecks (gate opens as each one is answered), then the open flow */
  y0: { form: 'jam', pile: 1, n: 5, pos: [.62, -.12], mp: [.3, -.5], glow: 3, grid: 1 },
  b0: { form: 'jam', n: 5, fa: 0, gap: .3, pos: [.62, 0], mp: [.2, -.5], glow: 3, grid: 0, gt: 1 },
  b1: { form: 'jam', n: 5, fa: -PI / 2, gap: .3, pos: [.6, -.16], mp: [.1, -.56], glow: 1, grid: 4, gt: 1, sp: .9 },
  b2: { form: 'jam', n: 5, fa: 0, gap: .34, pos: [.58, .04], mp: [.2, -.5], glow: 4, grid: 2, gt: 1, bob: .5, sp: 1.1 },
  b3: { form: 'jam', n: 5, fa: -.42, gap: .5, pos: [.64, -.04], mp: [.2, -.5], glow: 2, grid: 3, gt: 1, sp: 1.2 },
  b4: { form: 'jam', n: 5, fa: .38, gap: .28, pos: [.66, .02], mp: [.2, -.5], glow: 5, grid: 1, gt: 1 },
  c0: { form: 'jam', n: 5, fa: 0, gap: .3, go: 1, pos: [.6, 0], mp: [.2, -.5], glow: 3, grid: 4, gt: 1 },
};
/* the document timeline, in steps of scroll (f = 0..steps) */
const ramp = (f, a, b) => clamp((f - a) / (b - a), 0, 1);
const TL = {
  tech: (f) => ({ inn: ramp(f, 0, .55), sh: ramp(f, .1, .4), build: ramp(f, .25, .95), scan: ramp(f, 1.02, 1.85), resolve: ramp(f, 2, 2.4), stamp: ramp(f, 2.42, 2.8), stk: ramp(f, 2.55, 3) }),
  how: (f) => ({ inn: .55 * ramp(f, 0, .9) + .45 * ramp(f, 1, 1.3), sh: ramp(f, 1, 1.25), build: ramp(f, 1.2, 1.95), scan: ramp(f, 2.02, 2.85), resolve: ramp(f, 3, 3.35), stamp: ramp(f, 3.38, 3.7), stk: ramp(f, 3.55, 4) }),
};

/* ---------- chapters ---------- */
let chapters = [], texts = [], panels = [], pinned = [], LT = [];
const TEXT_SEL = 'main h1,main h2,main h3,main .lead,main .copy,main .kick,main .trio-btn,main .trio-p,main .hw-step,main .gs-step,main .wwu-list p,main .tech-note,main .close-cta,main .piq-line,main .ct-expect-in p,main .pin-chip,main .pin-title,main .pin-p,main .pin-type,main .pin-tab,main .lit,main .ptx-tag,main .pin-cta';
const PANEL_SEL = 'main .pin-card,main .prep-card,main .dp-a,main .dp-qb,main .pq-win,main .way,main .call,main .conv,main .disc-i,main .wd-item';
function boxes(sel, within, rel) {
  const out = [];
  (within || document).querySelectorAll(sel).forEach((el) => {
    if (el.closest('.hero')) return;
    if (!within && el.closest('.pin-stick')) return;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
    out.push(rel ? { l: r.left, r: r.right, t: r.top - rel.top, b: r.bottom - rel.top } : { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY });
  });
  return out;
}
function merge(list, gap) { /* join stacked blocks (heading, lead, copy...) into one text zone */
  let ch = true;
  while (ch) {
    ch = false;
    outer: for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b];
      if (A.l < B.r && B.l < A.r && A.t - gap < B.b && B.t - gap < A.b) { A.l = Math.min(A.l, B.l); A.r = Math.max(A.r, B.r); A.t = Math.min(A.t, B.t); A.b = Math.max(A.b, B.b); list.splice(b, 1); ch = true; break outer; }
    }
  }
  return list;
}
function mkScene(base, s) {
  const pos = small() && s.mp ? s.mp : s.pos;
  return Object.assign({}, base, s, { px: pos ? pos[0] : base.px, py: pos ? pos[1] : base.py, scenes: null });
}
function readChapters() {
  chapters = [...document.querySelectorAll('[data-chapter]')].map((el) => {
    const r = el.getBoundingClientRect(), pos = (el.getAttribute('data-pos') || '').split(',').map(parseFloat), form = el.getAttribute('data-form') || 'none';
    const base = {
      el, top: r.top + scrollY, bottom: r.bottom + scrollY, name: el.getAttribute('data-chapter'), form,
      px: isFinite(pos[0]) ? pos[0] : (form === 'stack' ? .52 : 0), py: isFinite(pos[1]) ? pos[1] : 0,
      r: parseFloat(el.getAttribute('data-r')) || 0, n: parseInt(el.getAttribute('data-n') || '0', 10), path: parseInt(el.getAttribute('data-path') || '0', 10), off: parseFloat(el.getAttribute('data-off')) || 0,
      glow: parseInt(el.getAttribute('data-glow') || '0', 10) % GLOWS.length, grid: parseInt(el.getAttribute('data-grid') || '0', 10) % GRIDS.length,
    };
    const names = (el.getAttribute('data-scenes') || '').split(',').map((k) => k.trim()).filter(Boolean);
    if (names.length) { base.scenes = names.map((k) => mkScene(base, SC[k] || {})); base.doc = el.getAttribute('data-doc') || ''; base.goSp = el.hasAttribute('data-go'); }
    return base;
  });
  texts = merge(boxes(TEXT_SEL), 56);
  panels = merge(boxes(PANEL_SEL), 12);
  /* content inside a pinned (sticky) stage moves with the stage, so it is kept relative to the stage's own top edge */
  pinned = [...document.querySelectorAll('.pin-stick')].map((el) => {
    const rel = { top: el.getBoundingClientRect().top };
    return { el, texts: merge(boxes(TEXT_SEL, el, rel), 56), panels: merge(boxes(PANEL_SEL, el, rel), 12) };
  });
}
/* the scene a pinned chapter is showing: step k of n, with the document timeline and gate opening filled in */
function eff(ch, k, f, go) {
  const o = Object.assign({}, ch.scenes[k]); o.f = f;
  if (ch.doc && TL[ch.doc]) Object.assign(o, TL[ch.doc](f));
  if (ch.goSp) o.go = go;
  return o;
}
function desc(ch) { return ch.scenes ? eff(ch, 0, 0, 0) : ch; }
function state() {
  if (!chapters.length) return { A: { form: 'none', px: 0, py: 0, r: 0, n: 0, path: 0, off: 0, glow: 0, grid: 0 }, B: null, b: 0, i: 0 };
  const y = scrollY + vh * .55; let i = 0;
  for (let k = 0; k < chapters.length; k++) if (chapters[k].top <= y) i = k;
  const ch = chapters[i], nx = chapters[i + 1] || null;
  let A = ch, B = nx ? desc(nx) : null, b = 0;
  if (nx) b = smooth(clamp(1 - (nx.top - y) / (vh * .42), 0, 1));
  if (ch.scenes) {
    const n = ch.scenes.length, span = Math.max(ch.bottom - ch.top - vh, 1), p = clamp((scrollY - ch.top) / span, 0, 1), f = p * n, k = Math.min(n - 1, Math.floor(f)), sp = f - k;
    A = eff(ch, k, f, smooth(clamp((sp - .45) / .35, 0, 1)));
    if (k < n - 1) { const sb = smooth(clamp((sp - .72) / .28, 0, 1)); if (sb > .001) { B = eff(ch, k + 1, f, 0); b = sb; } }
  }
  return { A, B, b, i };
}

/* ---------- sizing ---------- */
let dpr = 1;
function resize() {
  vw = innerWidth; vh = innerHeight; aspect = vw / vh;
  dpr = Math.min(devicePixelRatio || 1, small() ? 1.5 : 1.75);
  if (/[?&]lite\b/.test(location.search)) dpr = .5; /* for slow software rendering in test browsers */
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  H = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z; W = H * aspect;
  bgMat.uniforms.uRes.value = [vw * dpr, vh * dpr]; gridMat.uniforms.uRes.value = [vw * dpr, vh * dpr];
  readChapters();
}

/* ---------- theme ---------- */
const target = { bg: new Color(), grid: new Color(), cross: new Color(), gridA: .2, crossA: .5, g: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ga: 1, dust: new Color() };
const cur = { bg: new Color(), grid: new Color(), cross: new Color(), gridA: .2, crossA: .5, ga: 1, dust: new Color() };
let themeFirst = true;
function readTheme() {
  target.bg.copy(parseCss(tok('--bg')).c);
  const g = parseCss(tok('--w-grid')), c = parseCss(tok('--w-cross'));
  target.grid.copy(g.c); target.gridA = g.a; target.cross.copy(c.c); target.crossA = c.a;
  target.g = [triple(tok('--g1')), triple(tok('--g2')), triple(tok('--g3'))]; target.ga = parseFloat(tok('--g-a')) || 1;
  target.dust.copy(g.c);
  const light = themeOf() === 'light';
  dust.material.opacity = light ? .35 : .55;
  tiles.forEach((t) => { t.mat.envMapIntensity = t.sheet ? (light ? .35 : .55) : (light ? .9 : 1.25); });
  scene.environmentIntensity = 1;
  if (themeFirst) { cur.bg.copy(target.bg); cur.grid.copy(target.grid); cur.cross.copy(target.cross); cur.gridA = target.gridA; cur.crossA = target.crossA; cur.ga = target.ga; cur.dust.copy(target.dust); themeFirst = false; }
}
addEventListener('themechange', readTheme);

/* ---------- interaction ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / vw - .5) * 2; mouse.ty = (e.clientY / vh - .5) * 2; }, { passive: true });
const focus = { i: -1, k: 3, el: null }; let focusNew = false;
addEventListener('tx:focus', (e) => { focus.i = e.detail.index; focus.k = e.detail.k || 3; focus.el = e.detail.el || null; focusNew = true; setTimeout(readChapters, 90); });


/* ---------- loop ---------- */
const gl = { p: [.88, 1], s: 1.1, a: 1, p2: [.05, .1], s2: .7, a2: 0, d: DB };
const gr = { tilt: -1.12, y: -2.3, rz: -.12, off: 0, bend: 1, q: 1, qc: 1 };
let last = performance.now(), t = 0, lastScroll = scrollY, vel = 0, running = true, needFrame = true, boost = 0, boostAcc = 0;
const proj = new Vector3(), eul = new Vector3();
const LIFT = { orbit: 1, cluster: 1, column: 1 };
function mixArr(a, b, k) { return a.map((v, i) => lerp(v, b[i], k)); }
/* how much of a tile sits behind plain text (0..1) */
function behindText(p, s, sheet) {
  proj.copy(p).project(camera);
  const sx = (proj.x * .5 + .5) * vw, sy = (-proj.y * .5 + .5) * vh + scrollY;
  const ppu = vh / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(camera.position.z - p.z, 1));
  const hw = .55 * s * ppu * (sheet ? .85 : 1), hh = .55 * s * ppu; let a = 0;
  for (let k = 0; k < LT.length; k++) {
    const R = LT[k], ox = Math.min(sx + hw, R.r) - Math.max(sx - hw, R.l), oy = Math.min(sy + hh, R.b) - Math.max(sy - hh, R.t);
    if (ox > 0 && oy > 0) a += ox * oy;
  }
  return clamp(a / (4 * hw * hh), 0, 1);
}
/* things that are not tiles: the core (document scenes) and the gate (jam scenes) */
function extras(c) {
  const o = { core: 0, cx: 0, cy: 0, gate: 0, gx: 0, gy: 0, fa: 0, gap: .3, go: 0 };
  if (c.form === 'doc') { const D = docGeo(c); o.core = smooth(clamp((c.inn || 0) * 9, 0, 1)) * (1 - .6 * smooth(clamp((c.stk || 0) * 3, 0, 1))); o.cx = D.cx; o.cy = D.cy; }
  if (c.form === 'jam' && c.gt && !c.pile) { o.gate = 1; o.gx = c.px * W; o.gy = c.py * H; o.fa = c.fa || 0; o.gap = c.gap || .3; o.go = clamp(c.go || 0, 0, 1); }
  return o;
}
function frame(now) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, .05); last = now; if (!reduce) t += dt;
  const st = state(), A = st.A, B = st.B, b = st.b;
  vel = lerp(vel, clamp((scrollY - lastScroll) / Math.max(dt, .001) / 1800, -1, 1), 1 - Math.exp(-dt * 6)); lastScroll = scrollY;
  mouse.x = lerp(mouse.x, mouse.tx, 1 - Math.exp(-dt * 3)); mouse.y = lerp(mouse.y, mouse.ty, 1 - Math.exp(-dt * 3));
  if (focusNew) { focusNew = false; if (focus.el && A.el.contains(focus.el) && focus.i >= 0) boost = 1; }
  boost *= Math.exp(-dt * 1.6); boostAcc += boost * dt * .45; phase = t * .045 + scrollY * .00032 + boostAcc;

  /* theme colours ease */
  const ek = 1 - Math.exp(-dt * 5);
  cur.bg.lerp(target.bg, ek); cur.grid.lerp(target.grid, ek); cur.cross.lerp(target.cross, ek); cur.dust.lerp(target.dust, ek);
  cur.gridA = lerp(cur.gridA, target.gridA, ek); cur.crossA = lerp(cur.crossA, target.crossA, ek); cur.ga = lerp(cur.ga, target.ga, ek);

  /* glow */
  const GA = GLOWS[A.glow], GB = B ? GLOWS[B.glow] : GA, wob = reduce ? 0 : Math.sin(t * .25) * .02;
  const tg = { p: mixArr(GA.p, GB.p, b), s: lerp(GA.s, GB.s, b), a: lerp(GA.a, GB.a, b), p2: mixArr(GA.p2, GB.p2, b), s2: lerp(GA.s2, GB.s2, b), a2: lerp(GA.a2, GB.a2, b) };
  const ck = 1 - Math.exp(-dt * 3.2);
  gl.p = mixArr(gl.p, tg.p, ck); gl.s = lerp(gl.s, tg.s, ck); gl.a = lerp(gl.a, tg.a, ck); gl.p2 = mixArr(gl.p2, tg.p2, ck); gl.s2 = lerp(gl.s2, tg.s2, ck); gl.a2 = lerp(gl.a2, tg.a2, ck);
  const u = bgMat.uniforms, light = themeOf() === 'light';
  u.uBg.value.copy(cur.bg);
  /* day mode blends the glow toward the theme's own softer blue */
  u.uC1.value = light ? mixArr(C1, target.g[0], .5) : C1; u.uC2.value = light ? mixArr(C2, target.g[1], .5) : C2; u.uC3.value = light ? target.g[2] : C3;
  const gm = small() ? .72 : 1;
  u.uP.value = [gl.p[0] + wob, gl.p[1] + wob]; u.uS.value = gl.s * (small() ? .8 : 1); u.uA.value = gl.a * cur.ga * gm;
  u.uD.value = DB; u.uP2.value = gl.p2; u.uS2.value = gl.s2; u.uA2.value = gl.a2 * cur.ga * (light ? .5 : 1) * gm;

  /* grid: moves and bends per chapter, quiet wherever text or a panel is on screen */
  const PA = GRIDS[A.grid], PB = B ? GRIDS[B.grid] : PA, gk = 1 - Math.exp(-dt * 3), gv = (k) => lerp(PA[k], PB[k], b);
  for (const k of ['tilt', 'y', 'rz', 'bend', 'q', 'qc']) gr[k] = lerp(gr[k], gv(k), gk);
  grid.rotation.set(gr.tilt + mouse.y * .02, 0, gr.rz + mouse.x * .02); grid.position.set(0, gr.y, -2);
  const gu = gridMat.uniforms;
  gu.uOff.value = scrollY * .0016 + t * .03 + lerp(PA.off, PB.off, b);
  gu.uGrid.value.copy(cur.grid); gu.uGridA.value = cur.gridA; gu.uCross.value.copy(cur.cross); gu.uCrossA.value = cur.crossA;
  gu.uNear.value = 6; gu.uFar.value = 38; gu.uBend.value = gr.bend; gu.uQ.value = gr.q; gu.uQC.value = gr.qc; gu.uRK.value = light ? .16 : .1; bgMat.uniforms.uTK.value = light ? .62 : .5;
  {
    const vis = [];
    const add = (R) => { const t0 = Math.max(R.t - scrollY, 0), b0 = Math.min(R.b - scrollY, vh), l0 = Math.max(R.l, 0), r0 = Math.min(R.r, vw); if (b0 > t0 && r0 > l0) vis.push({ a: (b0 - t0) * (r0 - l0), x0: l0 / vw, x1: r0 / vw, y0: 1 - b0 / vh, y1: 1 - t0 / vh }); };
    texts.forEach(add); panels.forEach(add); LT = texts.slice();
    pinned.forEach((P) => { /* sticky stages: their content is measured from the stage's top edge as it is now */
      const top = P.el.getBoundingClientRect().top + scrollY;
      P.texts.forEach((R) => { const q = { l: R.l, r: R.r, t: R.t + top, b: R.b + top }; add(q); LT.push(q); });
      P.panels.forEach((R) => add({ l: R.l, r: R.r, t: R.t + top, b: R.b + top }));
    });
    vis.sort((p, q) => q.a - p.a);
    for (let k = 0; k < NRECT; k++) { const R = vis[k]; if (R) gu.uR.value[k].set(R.x0, R.y0, R.x1, R.y1); else gu.uR.value[k].set(0, 0, 0, 0); }
  }
  dust.material.color.copy(cur.dust); dust.position.y = (scrollY * .0012) % 6 * -1 + 3; dust.rotation.y = t * .01;

  /* camera */
  camera.position.x = lerp(camera.position.x, mouse.x * .35, 1 - Math.exp(-dt * 3)); camera.position.y = lerp(camera.position.y, -mouse.y * .22, 1 - Math.exp(-dt * 3));
  camera.lookAt(0, 0, 0);

  /* tiles */
  const sk = SK(), op = small() ? .8 : 1;
  const inA = !!focus.el && A.el.contains(focus.el), inB = !!B && b > .5 && !!focus.el && B.el.contains(focus.el);
  const liftOn = (inA && LIFT[A.form]) || (inB && LIFT[B.form]), colOn = (inA && A.form === 'column') || (inB && B.form === 'column');
  for (let i = 0; i < N_MAX; i++) {
    const tl = tiles[i];
    const fa = formation(A, i, t), fb = B ? formation(B, i, t) : fa;
    const g = (k) => lerp(fa[k], fb[k], b);
    let x = g('x'), y = g('y'), z = g('z'), rx = g('rx'), ry = g('ry'), rz = g('rz'), s = g('s') * sk; const v = g('v');
    if (!reduce) { y += Math.sin(t * .6 + i * 1.3) * .07; rz += Math.sin(t * .35 + i * 2) * .04; ry += vel * .35 * (i % 2 ? 1 : -1); }
    ry += mouse.x * .12; rx += mouse.y * .08;
    /* a tab or row in focus brings its tile forward */
    const grp = i % focus.k;
    const lift = liftOn && focus.i >= 0 && grp === focus.i && v > .5 ? 1 : 0;
    tl.lift = lerp(tl.lift, lift, 1 - Math.exp(-dt * 5));
    z += tl.lift * 1.9; x -= tl.lift * (colOn ? .45 : 0); s *= 1 + tl.lift * .32;
    tl.dimF = lerp(tl.dimF, colOn && focus.i >= 0 && grp !== focus.i ? 1 : 0, 1 - Math.exp(-dt * 5));
    if (!tl.born) { tl.p.set(x, y, z); tl.rot.set(rx, ry, rz); tl.s = s; tl.vis = 0; tl.born = true; }
    const k = 1 - Math.exp(-dt * tl.rate);
    if (v < .15 && tl.vis < .25 && tl.p.distanceTo(eul.set(x, y, z)) > 4.5) { tl.p.set(x, y, z); tl.rot.set(rx, ry, rz); tl.s = s; } /* wrapped round: restart unseen */
    tl.p.x = lerp(tl.p.x, x, k); tl.p.y = lerp(tl.p.y, y, k); tl.p.z = lerp(tl.p.z, z, k);
    tl.rot.x = lerp(tl.rot.x, rx, k); tl.rot.y = lerp(tl.rot.y, ry, k); tl.rot.z = lerp(tl.rot.z, rz, k); tl.s = lerp(tl.s, s, k);
    tl.vis = lerp(tl.vis, v, 1 - Math.exp(-dt * 4.5));
    /* tiles that drift behind plain text step back */
    tl.dim = lerp(tl.dim, tl.vis > .05 ? smooth(clamp((behindText(tl.p, tl.s, tl.sheet) - .06) / .35, 0, 1)) : 0, 1 - Math.exp(-dt * 4));
    const show = tl.vis > .02;
    tl.mesh.visible = show;
    if (show) {
      tl.mesh.position.copy(tl.p); tl.mesh.rotation.set(tl.rot.x, tl.rot.y, tl.rot.z);
      tl.mesh.scale.setScalar(Math.max(tl.s * (.05 + .95 * smooth(tl.vis)) * (1 - .22 * tl.dim), .001));
      tl.mat.opacity = (tl.sheet ? 1 : .92) * op * tl.vis * (1 - .84 * tl.dim) * (1 - .6 * tl.dimF);
    }
  }
  /* the live sheet: follow the document timeline of whichever scene carries one */
  const DS = A.build !== undefined ? A : (B && B.build !== undefined && b > .02 ? B : null);
  if (DS) setDoc(DS); else if (tiles[2].vis < .08) setDoc(DOC0);

  /* the core files fall into */
  {
    const exA = extras(A), exB = B ? extras(B) : exA, cv = lerp(exA.core, exB.core, b), src = exA.core >= exB.core ? exA : exB;
    coreG.visible = cv > .01;
    if (coreG.visible) {
      const pulse = 1 + (reduce ? 0 : Math.sin(t * 2.2) * .05);
      coreG.position.set(src.cx, src.cy, -.5); coreG.scale.setScalar((small() ? .8 : 1) * pulse * (.6 + .4 * cv));
      coreR1.rotation.z = t * .6; coreR2.rotation.z = -t * .8;
      coreGlow.material.opacity = cv * (light ? .55 : .85); coreR1.material.opacity = cv * .8; coreR2.material.opacity = cv * .6;
      coreR1.material.color.set(light ? 0x2f6bff : 0x9cc0ff);
    }
    /* the gate: eases between scenes, widens as a bottleneck is answered */
    const gv = lerp(exA.gate, exB.gate, b), gs = exA.gate >= exB.gate ? exA : exB, gk2 = 1 - Math.exp(-dt * 4.5);
    const wTarget = gs.gap + 2 * smooth(gs.go);
    if (gv > .01) {
      if (!gateNow.set) { gateNow.x = gs.gx; gateNow.y = gs.gy; gateNow.fa = gs.fa; gateNow.w = wTarget; gateNow.set = true; }
      gateNow.x = lerp(gateNow.x, gs.gx, gk2); gateNow.y = lerp(gateNow.y, gs.gy, gk2); gateNow.fa = lerp(gateNow.fa, gs.fa, gk2); gateNow.w = lerp(gateNow.w, wTarget, gk2);
    } else gateNow.set = false;
    gateNow.v = lerp(gateNow.v, gv, 1 - Math.exp(-dt * 5));
    gateG.visible = gateNow.v > .02;
    if (gateG.visible) {
      const sc = small() ? .7 : 1;
      gateG.position.set(gateNow.x, gateNow.y, 0); gateG.rotation.z = gateNow.fa; gateG.scale.setScalar(sc);
      const off = gateNow.w / 2 / sc + 1.4; slabA.position.set(0, off, 0); slabB.position.set(0, -off, 0);
      gateMat.opacity = gateNow.v * .92; gateMat.envMapIntensity = light ? .9 : 1.3;
    }
  }
  renderer.render(scene, camera);
  if (reduce && !needFrame) running = false;
  needFrame = false;
  if (running) requestAnimationFrame(frame);
}


/* ---------- boot ---------- */
resize(); readTheme();
addEventListener('resize', () => { resize(); kick(); });
function kick() { needFrame = true; if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
addEventListener('scroll', () => { if (reduce) kick(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else { running = true; last = performance.now(); requestAnimationFrame(frame); } });
setInterval(readChapters, 1500);
addEventListener('load', () => { readChapters(); kick(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(readChapters);
document.body.classList.add('has-world');
requestAnimationFrame(frame);
