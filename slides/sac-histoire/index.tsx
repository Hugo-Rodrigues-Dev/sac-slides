import { useIsActivePage, useSlidePageNumber, type DesignSystem, type Page, type SlideMeta, type SlideTransition } from '@open-slide/core';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

// Deuxième version de l'exposé, racontée comme une histoire.
// Fil rouge : une voiture qui apprend à prendre un virage (inspiré de la vidéo de Y. Bouteiller).
// Mêmes couleurs que le premier deck : indigo = acteur, sarcelle = critiques, ambre = entropie et α, framboise = environnement.
export const design: DesignSystem = {
  palette: { bg: '#F3F5F7', text: '#121A22', accent: '#4A47CF' },
  fonts: {
    display: '"Avenir Next", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
    body: '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
  },
  typeScale: { hero: 150, body: 36 },
  radius: 18,
};

const text = 'var(--osd-text)';
const actor = 'var(--osd-accent)';
const actorHex = '#4A47CF';
const ink = '#121A22';
const critic = '#0A7A6A';
const entropy = '#C2620A';
const env = '#A13D60';
const muted = '#5A6672';
const rule = '#D3DAE0';
const panel = '#FFFFFF';
const soft = '#E6EAEE';
const grass = '#9CCB8A';
const tree = '#6FAE5E';
const asphalt = '#3D454C';
const mono = '"Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

const EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const HOLD: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }];
export const transition: SlideTransition = {
  duration: 260,
  exit: { duration: 260, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 260, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }] },
};

// ---------- Ordre de passage ----------

const HUGO = 'Hugo';
const MATHIS = 'Mathis';
const QUENTIN = 'Quentin';

// =====================================================================
// La piste (vue de dessus, en mètres) : une ligne droite qui monte,
// un virage en épingle, une ligne droite qui redescend.
// Une trajectoire = un écart latéral d(s) par rapport au milieu de la route,
// le long de la piste (s = distance parcourue). d < 0 : côté intérieur.
// =====================================================================

const R = 5;                       // rayon du virage (milieu de la route)
const L = 8;                       // longueur des lignes droites
const HALF = 1.5;                  // demi-largeur de la route
const CAR_HALF = 0.5;              // demi-largeur de la voiture
const S_END = 2 * L + Math.PI * R; // longueur totale
const S_OBS = L + (Math.PI * R) / 2;   // la voiture en panne : au sommet du virage
const D_OBS = -0.85;                   // … côté intérieur
const SPEED = 9;                       // m/s

function trackPoint(s: number, d: number): [number, number] {
  if (s <= L) return [R + d, s];
  if (s <= L + Math.PI * R) {
    const phi = (s - L) / R;
    return [(R + d) * Math.cos(phi), L + (R + d) * Math.sin(phi)];
  }
  return [-(R + d), L - (s - L - Math.PI * R)];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Outcome = 'ok' | 'off' | 'hit';
type Run = { pts: [number, number, number][]; outcome: Outcome; dur: number };

/** Fait rouler une voiture le long de la trajectoire d(s), jusqu'à l'arrivée, une sortie de route ou un choc. */
function drive(dOf: (s: number) => number, obstacle: boolean): Run {
  const pts: [number, number, number][] = [];
  const ds = 0.25;
  let outcome: Outcome = 'ok';
  let s = 0;
  for (; s <= S_END; s += ds) {
    const d = dOf(s);
    const [x, y] = trackPoint(s, d);
    const [nx, ny] = trackPoint(s + 0.3, dOf(s + 0.3));
    pts.push([x, y, Math.atan2(ny - y, nx - x)]);
    if (Math.abs(d) > HALF - CAR_HALF + 0.15) {
      outcome = 'off';
      const out = Math.sign(d) * 1.4;   // la voiture finit dans l'herbe
      for (let k = 1; k <= 4; k++) {
        const [ox, oy] = trackPoint(s + k * 0.3, d + (out * k) / 4);
        pts.push([ox, oy, pts[pts.length - 1][2]]);
      }
      break;
    }
    if (obstacle && Math.abs(s - S_OBS) < 1.0 && Math.abs(d - D_OBS) < 0.95) { outcome = 'hit'; break; }
  }
  return { pts, outcome, dur: Math.min(s, S_END) / SPEED + 0.15 };
}

// ---------- Hasard reproductible ----------

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-9), w = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
}

// ---------- Les conducteurs (politiques) ----------

type Driver = (rand: () => number, obstacle: boolean) => Run;

// Pas entraîné : coups de volant au hasard, il finit dans l'herbe
const untrained: Driver = (rand) => {
  const steps: number[] = [];
  let d = 0, slope = 0;
  for (let i = 0; i <= S_END / 0.25 + 4; i++) {
    slope += 0.05 * gaussian(rand);
    d += slope * 0.25;
    steps.push(d);
  }
  return drive((s) => steps[Math.min(steps.length - 1, Math.round(s / 0.25))], false);
};

// DQN : volant à 5 crans → zigzag, et de temps en temps un coup de volant au hasard (ε-greedy)
const dqn: Driver = (rand, obstacle) => {
  const phase = rand() * 4;
  const spikes = Array.from({ length: 2 }, () => ({ at: rand() < 0.15 ? 4 + rand() * (S_END - 8) : -99, dir: rand() < 0.5 ? -1 : 1 }));
  return drive((s) => {
    const p = ((s + phase) / 2.4) % 2;
    const tri = p < 1 ? p * 2 - 1 : 3 - p * 2;
    let d = 0.7 * tri;
    for (const k of spikes) d += k.dir * 1.3 * Math.exp(-((s - k.at) ** 2) / 0.8);
    return d;
  }, obstacle);
};

// Acteur déterministe : a appris UNE trajectoire, à la corde (côté intérieur)
const insideLine = (s: number) => -0.85 * smooth(L - 4, L + 0.5, s) * (1 - smooth(L + Math.PI * R - 0.5, L + Math.PI * R + 4, s));
const deterministic: Driver = (_rand, obstacle) => drive(insideLine, obstacle);

// SAC : des trajectoires variées qui restent sur la route ; face à l'obstacle, il passe de l'autre côté
function sacLine(rand: () => number, obstacle: boolean) {
  const p1 = rand() * 6.28, p2 = rand() * 6.28, a1 = 0.35 + 0.3 * rand();
  return (s: number) => {
    let d = a1 * Math.sin((2 * Math.PI * s) / 13 + p1) + 0.25 * Math.sin((2 * Math.PI * s) / 6 + p2);
    if (obstacle) {
      const w = smooth(S_OBS - 5, S_OBS - 1.5, s) * (1 - smooth(S_OBS + 1.5, S_OBS + 5, s));
      d += Math.max(0, 0.45 - d) * w;
    }
    return d;
  };
}
const sac: Driver = (rand, obstacle) => drive(sacLine(rand, obstacle), obstacle);

// ---------- Animation ----------

/** Horloge en secondes, qui ne tourne que sur la page regardée par le public. */
function useClock(active: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => { setT(Math.max(0, now - start) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

type Live = { run: Run; born: number; obstacle: boolean };

/** Lance une voiture toutes les `every` secondes et garde l'historique des résultats. */
function useRuns(t: number, driver: Driver, every: number, obstacleFrom: number, seed: number) {
  const st = useRef({ rand: seeded(seed), runs: [] as Live[], next: 0, lastT: 0 });
  const s = st.current;
  if (t < s.lastT) { s.runs = []; s.next = 0; s.rand = seeded(seed); }
  s.lastT = t;
  while (t >= s.next) {
    const obstacle = s.next >= obstacleFrom;
    s.runs.push({ run: driver(s.rand, obstacle), born: s.next, obstacle });
    s.next += every;
  }
  const done = s.runs.filter((r) => t - r.born >= r.run.dur);
  return { live: s.runs.filter((r) => t - r.born < r.run.dur + 2.5), done };
}

function stillRuns(driver: Driver, n: number, obstacle: boolean, seed: number): Live[] {
  const rand = seeded(seed);
  return Array.from({ length: n }, (_, i) => ({ run: driver(rand, obstacle), born: -1000 - i, obstacle }));
}

const rate = (runs: Live[]) => (runs.length ? Math.round((100 * runs.filter((r) => r.run.outcome === 'ok').length) / runs.length) : null);

// ---------- Dessin de la piste ----------

const WX0 = -R - 3, WX1 = R + 3, WY0 = -1.6, WY1 = L + R + 3;

function useTrackGeometry(k: number) {
  return useMemo(() => {
    const X = (x: number) => (x - WX0) * k;
    const Y = (y: number) => (WY1 - y) * k;
    const line = (d: number, s0 = -1, s1 = S_END + 1) => {
      let p = '';
      for (let s = s0; s <= s1; s += 0.4) {
        const [x, y] = trackPoint(Math.max(0, Math.min(S_END, s)), d);
        const yy = s < 0 ? y + s : s > S_END ? y - (s - S_END) : y;
        p += `${p ? 'L' : 'M'}${X(x).toFixed(1)},${Y(yy).toFixed(1)}`;
      }
      return p;
    };
    return { X, Y, line };
  }, [k]);
}

function Car({ x, y, h, color, k }: { x: number; y: number; h: number; color: string; k: number }) {
  const deg = (-h * 180) / Math.PI;
  return <g transform={`translate(${x},${y}) rotate(${deg})`}>
    <rect x={-0.95 * k} y={-0.5 * k} width={1.9 * k} height={1.0 * k} rx={0.25 * k} style={{ fill: color, stroke: '#FFFFFF', strokeWidth: 2 }} />
    <rect x={0.2 * k} y={-0.36 * k} width={0.45 * k} height={0.72 * k} rx={0.1 * k} style={{ fill: '#FFFFFF', fillOpacity: 0.75 }} />
  </g>;
}

function Track({ w, h, live, t, color, obstacle, still, trails = true, children }: {
  w: number; h: number; live: Live[]; t: number; color: string; obstacle: boolean; still?: boolean; trails?: boolean;
  children?: (g: { X: (x: number) => number; Y: (y: number) => number; line: (d: number) => string; k: number }) => ReactNode;
}) {
  const k = Math.min(w / (WX1 - WX0), h / (WY1 - WY0));
  const g = useTrackGeometry(k);
  const { X, Y, line } = g;
  const tw = (WX1 - WX0) * k, th = (WY1 - WY0) * k;
  const [ox, oy] = trackPoint(S_OBS, D_OBS);
  return <svg viewBox={`0 0 ${tw} ${th}`} width={tw} height={th} style={{ display: 'block' }}>
    <rect x={0} y={0} width={tw} height={th} rx={16} style={{ fill: grass }} />
    {[[-1.2, 4], [1.6, 6.5], [-0.5, 9.5], [1.2, 2], [-2.2, 7.4], [6.9, 14.5], [-6.9, 1.2]].map(([x, y], i) =>
      <circle key={i} cx={X(x)} cy={Y(y)} r={0.75 * k} style={{ fill: tree }} />)}
    <path d={line(0)} style={{ fill: 'none', stroke: asphalt, strokeWidth: 2 * HALF * k }} />
    <path d={line(-HALF + 0.08)} style={{ fill: 'none', stroke: '#FFFFFF', strokeWidth: 3 }} />
    <path d={line(HALF - 0.08)} style={{ fill: 'none', stroke: '#FFFFFF', strokeWidth: 3 }} />
    <path d={line(0)} style={{ fill: 'none', stroke: '#FFFFFF', strokeWidth: 2, strokeDasharray: '12 14', opacity: 0.7 }} />
    {children?.({ ...g, k })}
    {obstacle && <g transform={`translate(${X(ox)},${Y(oy)}) rotate(90)`}>
      <rect x={-0.95 * k} y={-0.5 * k} width={1.9 * k} height={1.0 * k} rx={0.25 * k} style={{ fill: '#8A949C', stroke: '#FFFFFF', strokeWidth: 2 }} />
      <text x={0} y={0.32 * k} textAnchor="middle" transform="rotate(-90)" style={{ fontSize: 0.9 * k }}>⚠️</text>
    </g>}
    {trails && live.map((r, i) => {
      const age = still ? r.run.dur : t - r.born;
      const n = Math.max(2, Math.min(r.run.pts.length, Math.round((age / r.run.dur) * r.run.pts.length)));
      const pts = r.run.pts.slice(0, n);
      const fade = still ? 0.7 : age > r.run.dur ? Math.max(0, 1 - (age - r.run.dur) / 2.5) : 1;
      const done = age >= r.run.dur;
      const c = done && r.run.outcome !== 'ok' ? env : color;
      const [lx, ly] = pts[pts.length - 1];
      return <g key={`${r.born}-${i}`} style={{ opacity: fade }}>
        <path d={pts.map(([x, y], j) => `${j ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('')} style={{ fill: 'none', stroke: c, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.85 }} />
        {done && r.run.outcome !== 'ok' && <text x={X(lx)} y={Y(ly) + 12} textAnchor="middle" style={{ fill: env, fontSize: 34, fontWeight: 800 }}>✗</text>}
      </g>;
    })}
    {!still && live.map((r, i) => {
      const age = t - r.born;
      if (age >= r.run.dur) return null;
      const idx = Math.min(r.run.pts.length - 1, Math.floor((age / r.run.dur) * r.run.pts.length));
      const [x, y, hd] = r.run.pts[idx];
      return <Car key={`car-${r.born}-${i}`} x={X(x)} y={Y(y)} h={hd} color={color} k={k} />;
    })}
  </svg>;
}

// =====================================================================
// Cadre commun
// =====================================================================

const label: CSSProperties = { fontFamily: mono, fontSize: 24, letterSpacing: 2, textTransform: 'uppercase', color: muted };

function Footer() {
  const { current, total } = useSlidePageNumber();
  return <footer style={{ position: 'absolute', left: 140, right: 140, bottom: 44, display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 20, letterSpacing: 2, color: muted }}>
    <span>SOFT ACTOR-CRITIC · LE VIRAGE</span>
    <span>{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
  </footer>;
}

function Speaker({ name }: { name: string }) {
  return <span style={{ fontFamily: mono, fontSize: 22, letterSpacing: 1, color: text, background: soft, borderRadius: 999, padding: '6px 18px' }}>🎤 {name}</span>;
}

function Frame({ kicker, speaker, title, children }: { kicker: string; speaker: string; title: ReactNode; children: ReactNode }) {
  return <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '80px 140px 112px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
      <span style={{ ...label, color: actor }}>{kicker}</span>
      <Speaker name={speaker} />
    </div>
    <h2 style={{ margin: '0 0 36px', fontFamily: 'var(--osd-font-display)', fontSize: 72, lineHeight: 1.1, letterSpacing: -2, fontWeight: 800 }}>{title}</h2>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    <Footer />
  </section>;
}

function Punchline({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 38, fontWeight: 800, color, borderLeft: `8px solid ${color}`, paddingLeft: 26 }}>{children}</div>;
}

function Bubble({ who, color, children }: { who: string; color: string; children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
    <span style={{ flex: 'none', width: 160, textAlign: 'center', fontFamily: mono, fontSize: 21, letterSpacing: 2, textTransform: 'uppercase', color: '#FFFFFF', background: color, borderRadius: 10, padding: '8px 0', marginTop: 12 }}>{who}</span>
    <div style={{ background: panel, border: `3px solid ${color}`, borderRadius: 24, borderTopLeftRadius: 4, padding: '16px 26px', fontSize: 36, fontWeight: 700, lineHeight: 1.3 }}>{children}</div>
  </div>;
}

function Stat({ value, label: l, color }: { value: string; label: string; color: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{ fontFamily: 'var(--osd-font-display)', fontSize: 58, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
    <span style={{ fontSize: 24, color: muted, marginTop: 6 }}>{l}</span>
  </div>;
}

// =====================================================================
// 1. Couverture
// =====================================================================

function Turn({ n, name, topic }: { n: string; name: string; topic: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '50px 180px 1fr', alignItems: 'baseline', padding: '12px 0', borderTop: `2px solid ${rule}` }}>
    <span style={{ fontFamily: mono, fontSize: 26, color: muted }}>{n}</span>
    <span style={{ fontSize: 34, fontWeight: 800 }}>{name}</span>
    <span style={{ fontSize: 30, color: muted }}>{topic}</span>
  </div>;
}

const Cover: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  const { live } = useRuns(t, sac, 1.3, Infinity, 5);
  return <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '0 140px', display: 'grid', gridTemplateColumns: '1fr 780px', gap: 70, alignItems: 'center' }}>
    <div>
      <div style={{ ...label, color: actor }}>IA & apprentissage par renforcement<br /><span style={{ color: '#444450' }}>Par Berkeley en 2018</span></div>
      <h1 style={{ margin: '28px 0 24px', fontFamily: 'var(--osd-font-display)', fontSize: 'var(--osd-size-hero)', lineHeight: 0.98, letterSpacing: -5, fontWeight: 800 }}>Soft<br />Actor&#8209;Critic</h1>
      <p style={{ margin: 0, fontSize: 42, color: muted, lineHeight: 1.3 }}>Apprendre à prendre un virage,<br /><span style={{ color: entropy }}>sans toujours le prendre pareil.</span></p>
      <div style={{ marginTop: 50 }}>
        <Turn n="1" name={HUGO} topic="Le problème" />
        <Turn n="2" name={MATHIS} topic="La solution SAC" />
        <Turn n="3" name={QUENTIN} topic="La preuve, et quand l’utiliser" />
      </div>
    </div>
    <Track w={780} h={850} live={active ? live : stillRuns(sac, 6, false, 5)} t={t} color={entropy} obstacle={false} still={!active} />
  </section>;
};
Cover.transition = {
  duration: 280,
  exit: { duration: 280, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 280, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }] },
};

// =====================================================================
// 2. Le défi
// =====================================================================

function Mdp({ sym, name, color, children }: { sym: string; name: string; color: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 18, alignItems: 'baseline', padding: '18px 0', borderTop: `2px solid ${rule}` }}>
    <span style={{ fontFamily: mono, fontSize: 44, fontWeight: 700, color }}>{sym}</span>
    <div><div style={{ fontSize: 34, fontWeight: 800 }}>{name}</div><div style={{ fontSize: 29, color: muted }}>{children}</div></div>
  </div>;
}

const Challenge: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  const { live } = useRuns(t, untrained, 1.1, Infinity, 3);
  return <Frame kicker="Le problème" speaker={HUGO} title="Une voiture qui n’a jamais conduit">
    <div style={{ display: 'grid', gridTemplateColumns: '620px 1fr', gap: 90, alignItems: 'start' }}>
      <Track w={620} h={680} live={active ? live : stillRuns(untrained, 6, false, 3)} t={t} color={actorHex} obstacle={false} still={!active} />
      <div style={{ paddingTop: 10 }}>
        <Mdp sym="s" name="État" color={env}>où est la voiture, sa vitesse, la distance aux bords</Mdp>
        <Mdp sym="a" name="Action" color={actor}>le volant et l’accélérateur : deux nombres réels</Mdp>
        <Mdp sym="r" name="Récompense" color={critic}>+ quand elle avance, − quand elle sort de la route</Mdp>
        <p style={{ margin: '34px 0 0', fontSize: 40, fontWeight: 800 }}>Une infinité d’actions possibles.</p>
      </div>
    </div>
  </Frame>;
};

// =====================================================================
// 3. Pourquoi le DQN coince
// =====================================================================

function SteerBar({ title, sub, discrete, color }: { title: string; sub: string; discrete: boolean; color: string }) {
  const W = 760;
  const ticks = [-30, -15, 0, 15, 30];
  const X = (a: number) => 30 + ((a + 30) / 60) * (W - 60);
  return <div>
    <div style={{ fontSize: 34, fontWeight: 800, color }}>{title}</div>
    <div style={{ fontSize: 26, color: muted, marginBottom: 4 }}>{sub}</div>
    <svg viewBox={`0 0 ${W} 110`} width={W} height={110} style={{ display: 'block' }}>
      <rect x={30} y={40} width={W - 60} height={14} rx={7} style={{ fill: discrete ? soft : color, fillOpacity: discrete ? 1 : 0.35 }} />
      {discrete && ticks.map((a) => <circle key={a} cx={X(a)} cy={47} r={16} style={{ fill: panel, stroke: color, strokeWidth: 5 }} />)}
      {!discrete && <circle cx={X(12.4)} cy={47} r={20} style={{ fill: panel, stroke: color, strokeWidth: 6 }} />}
      {!discrete && <text x={X(12.4)} y={20} textAnchor="middle" style={{ fill: color, fontSize: 26, fontFamily: mono, fontWeight: 700 }}>+12,4°</text>}
      {[-30, 0, 30].map((a) => <text key={a} x={X(a)} y={100} textAnchor="middle" style={{ fill: muted, fontSize: 24, fontFamily: mono }}>{a > 0 ? `+${a}` : a}°</text>)}
    </svg>
  </div>;
}

const DqnPage: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  const { live } = useRuns(t, dqn, 1.2, Infinity, 9);
  return <Frame kicker="Le problème · ce qu’on a vu en cours" speaker={HUGO} title="Le DQN : un volant à 5 crans">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 600px', gap: 70, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <SteerBar title="DQN" sub="une sortie par action, on prend la meilleure" discrete color={env} />
        <SteerBar title="La vraie vie" sub="n’importe quel angle" discrete={false} color={actor} />
        <div style={{ fontSize: 33, lineHeight: 1.4, marginTop: 10 }}>Plus fin : <strong>100 crans × 100 pédales</strong> = 10 000 sorties.<br />Un bras robot à 7 moteurs : <strong>100⁷</strong>.</div>
        <div style={{ fontSize: 33, lineHeight: 1.4 }}>Et ε-greedy : <strong style={{ color: env }}>un coup de volant au hasard</strong>.</div>
      </div>
      <Track w={600} h={660} live={active ? live : stillRuns(dqn, 5, false, 9)} t={t} color={muted} obstacle={false} still={!active} />
    </div>
  </Frame>;
};

// =====================================================================
// 4. Acteur-critique… et l'optimum local
// =====================================================================

const PI1 = (s: number) => 1.7 * smooth(L - 1, L + 5, s);
const PI2 = (s: number) => 0.75 * Math.sin((2 * Math.PI * s) / 9);

const LocalOptimum: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  const shown = active ? Math.min(3, Math.floor(t / 1.6) + 1) : 3;
  const runs = useMemo(() => [drive(PI1, false), drive(PI2, false), drive(insideLine, false)], []);
  const colors = [env, entropy, critic];
  return <Frame kicker="Le problème · acteur-critique" speaker={HUGO} title="Acteur-critique : l’élève et le moniteur">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 600px', gap: 70, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, paddingTop: 6 }}>
        <Bubble who="Acteur" color={actor}>« Je prends le virage comme ça ? »</Bubble>
        <Bubble who="Critique" color={critic}>« Tu peux faire mieux. »</Bubble>
        <div style={{ fontSize: 33, lineHeight: 1.4, marginTop: 10 }}>L’<strong style={{ color: actor }}>acteur</strong> tient le volant : il <strong>sort directement</strong> une action.<br />Le <strong style={{ color: critic }}>critique</strong> note : c’est la fonction Q.</div>
        <div style={{ fontSize: 33, lineHeight: 1.4 }}>π₁ → π₂ → π₃ : il progresse… puis ne change plus <strong style={{ color: env }}>jamais</strong> de trajectoire.</div>
      </div>
      <Track w={600} h={660} live={[]} t={t} color={critic} obstacle={false} trails={false}>
        {({ X, Y }) => <g>
          {runs.slice(0, shown).map((r, i) => {
            const last = r.pts[r.pts.length - 1];
            return <g key={i}>
              <path d={r.pts.map(([x, y], j) => `${j ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('')} style={{ fill: 'none', stroke: colors[i], strokeWidth: i === 2 ? 7 : 5, strokeLinecap: 'round', opacity: i === shown - 1 ? 1 : 0.5 }} />
              <g transform={`translate(${X(last[0]) + (i === 0 ? 20 : -20)},${Y(last[1])})`}>
                <rect x={-30} y={-24} width={60} height={42} rx={8} style={{ fill: panel, stroke: colors[i], strokeWidth: 3 }} />
                <text x={0} y={8} textAnchor="middle" style={{ fill: colors[i], fontSize: 26, fontWeight: 800 }}>π{['₁', '₂', '₃'][i]}</text>
              </g>
            </g>;
          })}
        </g>}
      </Track>
    </div>
    <Punchline color={env}>Optimum local : une seule trajectoire, aucun plan B</Punchline>
  </Frame>;
};

// =====================================================================
// 5. L'idée de SAC : α, entropie et sortie de l'acteur
// =====================================================================

// Chiffres MESURÉS (projet ml-rl-sac) : un SAC entraîné sur CETTE piste (même géométrie, voiture à
// 2 actions continues : volant et pédale) pour chaque valeur de α fixée à la main, 40 000 pas chacun.
// Pour chaque α : taux d'arrivée et temps au tour moyen (60 épisodes), entropie réelle (moyenne de
// −log π sur les états visités), μ et σ du volant et de la pédale à l'entrée du virage (4 000 tirages),
// et 8 trajectoires réellement conduites. Régénérer avec `uv run export-slides` dans ml-rl-sac.
type RealRun = { outcome: Outcome; dur: number; pts: [number, number, number][] };
type RealAlpha = { alpha: number; success: number; lapTime: number | null; entropy: number; steerMu: number; steerSigma: number; pedalMu: number; pedalSigma: number; trajectories: RealRun[] };
const REAL_ALPHAS: RealAlpha[] = [{"alpha":0.003,"success":100,"lapTime":5.68,"entropy":-4.42,"steerMu":0.529,"steerSigma":0.037,"pedalMu":0.505,"pedalSigma":0.02,"trajectories":[{"outcome":"ok","dur":5.6,"pts":[[5.44,0.5,1.543],[5.5,0.98,1.46],[5.57,1.65,1.467],[5.67,2.45,1.445],[5.72,3.31,1.511],[5.72,4.19,1.573],[5.66,5.09,1.634],[5.62,5.94,1.615],[5.54,6.73,1.674],[5.41,7.43,1.752],[5.22,8.14,1.841],[4.99,8.83,1.886],[4.73,9.48,1.954],[4.41,10.08,2.057],[4.02,10.67,2.157],[3.62,11.15,2.268],[3.15,11.6,2.376],[2.62,12.01,2.48],[2.15,12.32,2.563],[1.66,12.55,2.691],[1.06,12.77,2.801],[0.62,12.86,2.928],[0.0,12.93,3.041],[-0.46,12.91,-3.113],[-1.12,12.82,-3.008],[-1.66,12.68,-2.882],[-2.11,12.49,-2.743],[-2.46,12.29,-2.63],[-2.81,12.08,-2.592],[-3.16,11.81,-2.483],[-3.39,11.59,-2.398],[-3.69,11.37,-2.495],[-4.06,11.04,-2.415],[-4.35,10.73,-2.311],[-4.55,10.46,-2.233],[-4.78,10.15,-2.204],[-5.04,9.76,-2.158],[-5.26,9.36,-2.073],[-5.4,9.05,-1.988],[-5.54,8.64,-1.908],[-5.62,8.36,-1.834],[-5.7,7.78,-1.714],[-5.73,7.39,-1.648],[-5.72,6.73,-1.552],[-5.67,6.29,-1.465],[-5.54,5.61,-1.379],[-5.45,5.13,-1.378],[-5.34,4.4,-1.429],[-5.31,3.85,-1.504],[-5.32,3.08,-1.595],[-5.4,2.36,-1.675],[-5.41,1.86,-1.595],[-5.36,1.15,-1.498],[-5.39,0.59,-1.623],[-5.49,0.06,-1.752],[-5.57,-0.38,-1.764]]},{"outcome":"ok","dur":5.9,"pts":[[4.66,0.5,1.588],[4.65,1.11,1.589],[4.71,1.68,1.465],[4.74,2.25,1.511],[4.82,2.95,1.462],[4.85,3.75,1.538],[4.94,4.57,1.454],[4.98,5.45,1.533],[4.94,6.32,1.614],[4.84,7.09,1.704],[4.69,7.87,1.762],[4.49,8.55,1.858],[4.23,9.15,1.965],[3.93,9.7,2.077],[3.59,10.2,2.168],[3.21,10.63,2.29],[2.81,11.01,2.38],[2.37,11.35,2.486],[1.91,11.64,2.583],[1.41,11.87,2.711],[0.89,12.03,2.838],[0.37,12.12,2.97],[-0.14,12.14,3.107],[-0.63,12.09,-3.036],[-1.11,11.97,-2.896],[-1.6,11.77,-2.764],[-2.02,11.54,-2.631],[-2.5,11.28,-2.652],[-2.92,10.98,-2.515],[-3.17,10.76,-2.416],[-3.38,10.58,-2.445],[-3.63,10.33,-2.361],[-3.79,10.15,-2.293],[-3.92,10.01,-2.313],[-4.1,9.8,-2.28],[-4.25,9.6,-2.213],[-4.37,9.43,-2.188],[-4.5,9.24,-2.175],[-4.68,8.96,-2.15],[-4.88,8.61,-2.074],[-5.02,8.28,-1.989],[-5.16,7.89,-1.914],[-5.24,7.61,-1.845],[-5.43,7.06,-1.892],[-5.53,6.68,-1.842],[-5.59,6.4,-1.772],[-5.64,5.83,-1.653],[-5.64,5.44,-1.578],[-5.58,4.78,-1.487],[-5.55,4.34,-1.5],[-5.49,3.64,-1.48],[-5.49,3.13,-1.578],[-5.57,2.61,-1.712],[-5.63,2.17,-1.711],[-5.65,1.87,-1.643],[-5.64,1.27,-1.549],[-5.6,0.88,-1.485],[-5.49,0.22,-1.407],[-5.44,-0.26,-1.463]]},{"outcome":"ok","dur":5.9,"pts":[[4.81,0.5,1.516],[4.82,1.04,1.549],[4.9,1.69,1.454],[5.04,2.3,1.343],[5.18,3.07,1.397],[5.26,3.97,1.475],[5.28,4.85,1.554],[5.26,5.73,1.595],[5.17,6.51,1.684],[5.01,7.26,1.773],[4.84,8.01,1.8],[4.63,8.69,1.871],[4.36,9.32,1.973],[4.04,9.9,2.078],[3.66,10.43,2.187],[3.27,10.87,2.305],[2.83,11.25,2.424],[2.35,11.58,2.545],[1.84,11.84,2.669],[1.32,12.03,2.795],[0.76,12.15,2.917],[0.18,12.21,3.038],[-0.34,12.2,-3.113],[-0.88,12.11,-2.984],[-1.28,12.0,-2.863],[-1.81,11.78,-2.741],[-2.16,11.58,-2.628],[-2.63,11.37,-2.722],[-3.1,11.08,-2.594],[-3.39,10.86,-2.487],[-3.6,10.68,-2.444],[-3.77,10.52,-2.382],[-3.91,10.37,-2.334],[-4.05,10.22,-2.3],[-4.18,10.06,-2.259],[-4.33,9.87,-2.231],[-4.48,9.65,-2.181],[-4.62,9.43,-2.136],[-4.81,9.1,-2.102],[-4.99,8.74,-2.027],[-5.13,8.38,-1.947],[-5.24,8.03,-1.867],[-5.3,7.77,-1.803],[-5.44,7.22,-1.813],[-5.5,6.83,-1.731],[-5.55,6.21,-1.649],[-5.54,5.79,-1.547],[-5.46,5.12,-1.461],[-5.46,4.64,-1.56],[-5.52,4.08,-1.687],[-5.59,3.57,-1.693],[-5.6,3.23,-1.608],[-5.57,2.6,-1.523],[-5.56,2.18,-1.537],[-5.5,1.5,-1.485],[-5.51,0.99,-1.593],[-5.59,0.49,-1.73],[-5.65,0.07,-1.713],[-5.67,-0.2,-1.649]]},{"outcome":"ok","dur":5.9,"pts":[[5.34,0.5,1.609],[5.34,0.96,1.578],[5.37,1.61,1.523],[5.44,2.4,1.482],[5.58,3.29,1.414],[5.66,4.17,1.473],[5.68,5.04,1.554],[5.62,5.82,1.643],[5.5,6.55,1.734],[5.34,7.23,1.809],[5.12,7.91,1.877],[4.89,8.6,1.903],[4.63,9.23,1.959],[4.31,9.82,2.064],[3.92,10.4,2.164],[3.51,10.88,2.276],[3.06,11.3,2.389],[2.55,11.68,2.499],[2.04,11.98,2.617],[1.49,12.21,2.735],[0.91,12.39,2.849],[0.39,12.47,2.983],[-0.26,12.51,3.091],[-0.7,12.47,-3.065],[-1.27,12.36,-2.943],[-1.66,12.23,-2.824],[-2.1,12.01,-2.691],[-2.41,11.83,-2.589],[-2.81,11.62,-2.669],[-3.31,11.29,-2.552],[-3.63,11.02,-2.433],[-3.85,10.81,-2.395],[-4.05,10.6,-2.333],[-4.22,10.39,-2.269],[-4.41,10.15,-2.226],[-4.61,9.85,-2.155],[-4.79,9.53,-2.077],[-4.94,9.2,-2.013],[-5.07,8.89,-1.965],[-5.19,8.55,-1.91],[-5.28,8.24,-1.84],[-5.35,7.91,-1.785],[-5.38,7.68,-1.726],[-5.48,7.13,-1.747],[-5.52,6.76,-1.682],[-5.55,6.18,-1.61],[-5.52,5.8,-1.511],[-5.43,5.14,-1.431],[-5.4,4.66,-1.507],[-5.43,3.98,-1.611],[-5.5,3.32,-1.679],[-5.51,2.87,-1.6],[-5.47,2.17,-1.515],[-5.51,1.65,-1.633],[-5.59,1.19,-1.751],[-5.64,0.84,-1.723],[-5.67,0.6,-1.669],[-5.67,0.04,-1.576],[-5.64,-0.34,-1.506]]},{"outcome":"ok","dur":5.7,"pts":[[5.14,0.5,1.669],[5.1,0.98,1.657],[5.06,1.52,1.637],[5.07,2.06,1.549],[5.14,2.53,1.431],[5.19,3.03,1.469],[5.22,3.75,1.524],[5.33,4.59,1.441],[5.36,5.37,1.53],[5.33,6.17,1.618],[5.22,6.92,1.71],[5.06,7.63,1.798],[4.86,8.34,1.844],[4.62,9.02,1.906],[4.34,9.63,2.01],[4.0,10.18,2.117],[3.61,10.69,2.226],[3.18,11.13,2.341],[2.7,11.52,2.454],[2.18,11.86,2.566],[1.65,12.12,2.686],[1.12,12.3,2.81],[0.53,12.43,2.925],[0.03,12.47,3.066],[-0.57,12.45,-3.1],[-0.99,12.38,-2.977],[-1.53,12.22,-2.854],[-1.91,12.05,-2.735],[-2.34,11.81,-2.635],[-2.63,11.62,-2.536],[-3.01,11.4,-2.626],[-3.45,11.07,-2.5],[-3.73,10.81,-2.392],[-3.95,10.61,-2.412],[-4.25,10.3,-2.322],[-4.45,10.04,-2.231],[-4.67,9.76,-2.235],[-4.98,9.36,-2.239],[-5.25,8.95,-2.142],[-5.41,8.63,-2.041],[-5.54,8.3,-1.946],[-5.62,8.06,-1.884],[-5.7,7.68,-1.785],[-5.74,7.42,-1.728],[-5.76,6.85,-1.606],[-5.75,6.46,-1.534],[-5.66,5.82,-1.446],[-5.6,5.37,-1.427],[-5.45,4.69,-1.357],[-5.36,4.19,-1.388],[-5.3,3.46,-1.483],[-5.27,2.8,-1.523],[-5.3,1.97,-1.608],[-5.39,1.25,-1.703],[-5.42,0.76,-1.619],[-5.41,0.27,-1.552],[-5.38,-0.05,-1.482]]},{"outcome":"ok","dur":5.7,"pts":[[5.48,0.5,1.479],[5.55,0.95,1.425],[5.62,1.62,1.469],[5.66,2.36,1.51],[5.69,3.18,1.539],[5.71,4.07,1.546],[5.75,4.98,1.533],[5.72,5.82,1.605],[5.63,6.53,1.697],[5.46,7.29,1.788],[5.26,7.98,1.848],[5.03,8.68,1.896],[4.76,9.33,1.955],[4.45,9.93,2.046],[4.08,10.5,2.149],[3.66,11.03,2.252],[3.19,11.49,2.36],[2.7,11.88,2.47],[2.17,12.21,2.584],[1.64,12.46,2.702],[1.07,12.65,2.818],[0.51,12.76,2.94],[-0.12,12.82,3.051],[-0.58,12.8,-3.1],[-1.21,12.71,-2.99],[-1.68,12.57,-2.853],[-2.12,12.37,-2.723],[-2.46,12.17,-2.613],[-2.83,11.97,-2.632],[-3.24,11.66,-2.512],[-3.53,11.4,-2.405],[-3.81,11.17,-2.453],[-4.16,10.85,-2.399],[-4.42,10.56,-2.302],[-4.63,10.28,-2.217],[-4.87,9.91,-2.139],[-5.06,9.56,-2.061],[-5.25,9.13,-1.989],[-5.36,8.8,-1.913],[-5.52,8.22,-1.833],[-5.59,7.83,-1.748],[-5.64,7.33,-1.665],[-5.64,7.0,-1.58],[-5.6,6.38,-1.5],[-5.56,5.97,-1.491],[-5.45,5.3,-1.4],[-5.39,4.81,-1.451],[-5.37,4.09,-1.548],[-5.4,3.39,-1.605],[-5.43,2.87,-1.641],[-5.45,2.52,-1.606],[-5.43,1.88,-1.554],[-5.48,1.43,-1.664],[-5.57,1.01,-1.78],[-5.62,0.68,-1.75],[-5.65,0.46,-1.693],[-5.67,-0.1,-1.601]]},{"outcome":"ok","dur":5.7,"pts":[[5.15,0.5,1.566],[5.18,1.02,1.518],[5.22,1.71,1.509],[5.31,2.5,1.456],[5.44,3.39,1.428],[5.55,4.33,1.457],[5.58,5.21,1.531],[5.54,6.01,1.619],[5.44,6.76,1.706],[5.29,7.45,1.788],[5.08,8.15,1.856],[4.85,8.84,1.89],[4.6,9.46,1.962],[4.28,10.06,2.064],[3.91,10.59,2.172],[3.49,11.08,2.281],[3.05,11.49,2.398],[2.55,11.85,2.511],[2.05,12.13,2.629],[1.53,12.35,2.752],[0.93,12.52,2.864],[0.36,12.61,2.986],[-0.3,12.64,3.093],[-0.76,12.6,-3.057],[-1.34,12.48,-2.94],[-1.76,12.33,-2.81],[-2.19,12.13,-2.684],[-2.49,11.93,-2.58],[-2.88,11.73,-2.656],[-3.35,11.4,-2.535],[-3.65,11.14,-2.422],[-3.87,10.94,-2.418],[-4.17,10.66,-2.374],[-4.4,10.39,-2.28],[-4.61,10.1,-2.198],[-4.8,9.79,-2.124],[-4.98,9.43,-2.046],[-5.14,9.08,-1.991],[-5.26,8.75,-1.929],[-5.38,8.37,-1.86],[-5.44,8.09,-1.793],[-5.53,7.52,-1.719],[-5.55,7.13,-1.635],[-5.53,6.47,-1.536],[-5.52,6.02,-1.555],[-5.51,5.33,-1.55],[-5.53,4.85,-1.627],[-5.6,4.41,-1.73],[-5.65,4.06,-1.698],[-5.67,3.75,-1.639],[-5.66,3.21,-1.556],[-5.63,2.84,-1.478],[-5.52,2.21,-1.402],[-5.45,1.74,-1.427],[-5.42,1.03,-1.525],[-5.42,0.36,-1.566],[-5.48,-0.37,-1.662]]},{"outcome":"ok","dur":5.7,"pts":[[5.36,0.5,1.597],[5.37,0.97,1.55],[5.4,1.65,1.518],[5.48,2.44,1.468],[5.61,3.33,1.426],[5.7,4.22,1.468],[5.72,5.1,1.548],[5.67,5.91,1.634],[5.57,6.61,1.723],[5.4,7.32,1.8],[5.2,7.98,1.87],[4.96,8.65,1.911],[4.69,9.29,1.965],[4.39,9.88,2.046],[4.02,10.44,2.15],[3.61,10.95,2.258],[3.16,11.39,2.369],[2.66,11.77,2.481],[2.16,12.08,2.599],[1.61,12.32,2.717],[1.04,12.5,2.833],[0.43,12.63,2.946],[-0.05,12.65,3.081],[-0.67,12.62,-3.09],[-1.13,12.54,-2.956],[-1.68,12.36,-2.836],[-2.06,12.19,-2.716],[-2.46,11.96,-2.629],[-2.74,11.77,-2.533],[-3.13,11.55,-2.616],[-3.62,11.18,-2.502],[-3.93,10.88,-2.38],[-4.16,10.64,-2.327],[-4.37,10.4,-2.285],[-4.59,10.11,-2.21],[-4.77,9.81,-2.133],[-4.97,9.45,-2.077],[-5.15,9.07,-2.002],[-5.27,8.73,-1.925],[-5.39,8.33,-1.849],[-5.45,8.05,-1.778],[-5.52,7.46,-1.702],[-5.54,7.07,-1.612],[-5.51,6.41,-1.533],[-5.53,5.95,-1.594],[-5.59,5.48,-1.714],[-5.64,5.08,-1.696],[-5.66,4.8,-1.638],[-5.65,4.22,-1.548],[-5.62,3.83,-1.488],[-5.51,3.18,-1.404],[-5.45,2.72,-1.452],[-5.44,2.01,-1.551],[-5.47,1.33,-1.612],[-5.48,0.82,-1.592],[-5.43,0.18,-1.502],[-5.44,-0.3,-1.581]]}]},{"alpha":0.01,"success":100,"lapTime":4.41,"entropy":-3.38,"steerMu":0.387,"steerSigma":0.066,"pedalMu":0.487,"pedalSigma":0.049,"trajectories":[{"outcome":"ok","dur":4.5,"pts":[[5.44,0.5,1.543],[5.5,1.01,1.47],[5.53,1.73,1.518],[5.59,2.56,1.502],[5.64,3.49,1.521],[5.67,4.46,1.537],[5.63,5.47,1.606],[5.53,6.46,1.677],[5.36,7.39,1.751],[5.13,8.25,1.829],[4.84,9.07,1.91],[4.53,9.79,1.986],[4.15,10.46,2.078],[3.82,10.91,2.203],[3.4,11.37,2.315],[3.03,11.69,2.434],[2.54,12.01,2.553],[2.05,12.27,2.656],[1.5,12.48,2.776],[0.92,12.63,2.893],[0.28,12.72,3.002],[-0.33,12.73,3.117],[-0.93,12.68,-3.051],[-1.52,12.56,-2.936],[-2.12,12.36,-2.824],[-2.72,12.09,-2.718],[-3.31,11.75,-2.616],[-3.88,11.34,-2.516],[-4.41,10.87,-2.417],[-4.86,10.37,-2.312],[-5.21,9.88,-2.197],[-5.49,9.39,-2.073],[-5.7,8.85,-1.952],[-5.86,8.27,-1.835],[-5.94,7.71,-1.712],[-5.94,7.18,-1.579],[-5.88,6.6,-1.459],[-5.74,5.97,-1.35],[-5.56,5.29,-1.32],[-5.41,4.44,-1.401],[-5.32,3.48,-1.473],[-5.2,2.46,-1.45],[-5.05,1.42,-1.435],[-4.98,0.37,-1.502],[-4.92,-0.52,-1.501]]},{"outcome":"ok","dur":4.5,"pts":[[4.66,0.5,1.588],[4.7,1.13,1.504],[4.79,1.94,1.458],[4.89,2.87,1.469],[5.01,3.89,1.453],[5.07,4.96,1.519],[5.05,5.99,1.587],[4.96,6.93,1.661],[4.81,7.88,1.734],[4.6,8.74,1.809],[4.34,9.53,1.887],[4.1,10.05,2.01],[3.77,10.63,2.084],[3.49,11.0,2.206],[3.11,11.44,2.292],[2.8,11.73,2.398],[2.4,12.02,2.501],[2.04,12.24,2.6],[1.61,12.44,2.707],[1.12,12.59,2.843],[0.53,12.7,2.96],[-0.06,12.74,3.079],[-0.66,12.7,-3.087],[-1.25,12.6,-2.972],[-1.83,12.43,-2.856],[-2.39,12.2,-2.755],[-2.95,11.9,-2.643],[-3.5,11.52,-2.539],[-4.04,11.06,-2.44],[-4.54,10.55,-2.342],[-4.99,9.99,-2.245],[-5.33,9.45,-2.137],[-5.58,8.93,-2.014],[-5.76,8.39,-1.891],[-5.87,7.83,-1.769],[-5.92,7.25,-1.648],[-5.89,6.64,-1.534],[-5.8,5.97,-1.429],[-5.63,5.3,-1.329],[-5.46,4.5,-1.356],[-5.33,3.57,-1.431],[-5.19,2.57,-1.438],[-5.03,1.54,-1.41],[-4.93,0.49,-1.477],[-4.91,-0.46,-1.551]]},{"outcome":"ok","dur":4.5,"pts":[[4.81,0.5,1.516],[4.87,1.0,1.452],[4.91,1.74,1.524],[4.97,2.63,1.499],[5.04,3.62,1.499],[5.06,4.67,1.556],[5.0,5.73,1.622],[4.88,6.72,1.693],[4.69,7.69,1.762],[4.45,8.64,1.827],[4.17,9.5,1.878],[3.92,10.07,1.991],[3.57,10.67,2.092],[3.3,11.04,2.218],[2.89,11.47,2.319],[2.59,11.74,2.418],[2.17,12.04,2.525],[1.86,12.22,2.619],[1.4,12.42,2.712],[1.04,12.55,2.818],[0.51,12.65,2.947],[-0.04,12.69,3.075],[-0.62,12.66,-3.088],[-1.21,12.56,-2.972],[-1.77,12.39,-2.853],[-2.33,12.16,-2.745],[-2.87,11.87,-2.651],[-3.42,11.49,-2.546],[-3.96,11.05,-2.446],[-4.47,10.53,-2.35],[-4.93,9.96,-2.254],[-5.29,9.41,-2.147],[-5.55,8.88,-2.03],[-5.74,8.35,-1.906],[-5.85,7.81,-1.778],[-5.9,7.26,-1.652],[-5.87,6.65,-1.537],[-5.78,6.0,-1.431],[-5.61,5.3,-1.334],[-5.47,4.47,-1.404],[-5.38,3.52,-1.477],[-5.22,2.51,-1.409],[-5.05,1.46,-1.414],[-4.96,0.4,-1.48],[-4.91,-0.53,-1.524]]},{"outcome":"ok","dur":4.6,"pts":[[5.34,0.5,1.609],[5.35,0.94,1.552],[5.38,1.6,1.519],[5.38,2.43,1.573],[5.45,3.38,1.5],[5.54,4.4,1.475],[5.57,5.43,1.543],[5.53,6.34,1.619],[5.42,7.14,1.706],[5.25,7.91,1.783],[5.0,8.74,1.864],[4.7,9.49,1.95],[4.36,10.16,2.044],[4.01,10.69,2.154],[3.57,11.23,2.255],[3.23,11.57,2.368],[2.75,11.94,2.484],[2.35,12.18,2.594],[1.85,12.4,2.72],[1.29,12.58,2.838],[0.65,12.7,2.947],[0.04,12.75,3.061],[-0.58,12.73,-3.111],[-1.19,12.64,-2.996],[-1.79,12.48,-2.883],[-2.37,12.26,-2.779],[-2.95,11.97,-2.672],[-3.53,11.6,-2.569],[-4.09,11.15,-2.471],[-4.61,10.65,-2.374],[-5.01,10.16,-2.264],[-5.33,9.68,-2.144],[-5.57,9.17,-2.02],[-5.77,8.61,-1.902],[-5.9,8.02,-1.786],[-5.95,7.45,-1.663],[-5.93,6.87,-1.543],[-5.84,6.22,-1.435],[-5.69,5.6,-1.326],[-5.43,4.86,-1.237],[-5.2,3.98,-1.315],[-5.02,3.01,-1.385],[-4.9,1.99,-1.454],[-4.85,0.95,-1.521],[-4.86,0.05,-1.585],[-4.92,-0.56,-1.668]]},{"outcome":"ok","dur":4.4,"pts":[[5.14,0.5,1.669],[5.13,0.96,1.59],[5.14,1.66,1.561],[5.12,2.53,1.59],[5.16,3.5,1.532],[5.16,4.54,1.567],[5.09,5.59,1.634],[4.96,6.59,1.704],[4.77,7.55,1.77],[4.51,8.48,1.841],[4.2,9.36,1.908],[3.89,10.03,2.004],[3.56,10.58,2.112],[3.21,11.03,2.235],[2.76,11.49,2.344],[2.43,11.76,2.453],[1.98,12.06,2.554],[1.65,12.24,2.653],[1.16,12.43,2.761],[0.7,12.56,2.873],[0.12,12.65,2.992],[-0.43,12.66,3.118],[-1.0,12.6,-3.042],[-1.58,12.48,-2.925],[-2.11,12.29,-2.801],[-2.64,12.03,-2.683],[-3.18,11.68,-2.576],[-3.74,11.25,-2.477],[-4.27,10.74,-2.382],[-4.75,10.19,-2.285],[-5.16,9.61,-2.188],[-5.46,9.07,-2.074],[-5.67,8.55,-1.95],[-5.81,8.0,-1.825],[-5.88,7.45,-1.7],[-5.89,6.84,-1.585],[-5.83,6.18,-1.478],[-5.69,5.49,-1.379],[-5.51,4.75,-1.328],[-5.36,3.86,-1.405],[-5.24,2.87,-1.445],[-5.17,1.83,-1.509],[-5.04,0.83,-1.439],[-4.97,-0.21,-1.506]]},{"outcome":"ok","dur":4.6,"pts":[[5.48,0.5,1.479],[5.54,0.91,1.434],[5.6,1.51,1.475],[5.67,2.21,1.467],[5.73,3.02,1.491],[5.76,3.9,1.54],[5.77,4.87,1.558],[5.72,5.89,1.619],[5.61,6.86,1.691],[5.43,7.73,1.77],[5.22,8.55,1.824],[4.93,9.38,1.903],[4.65,9.98,2.008],[4.28,10.6,2.105],[3.97,11.01,2.216],[3.54,11.47,2.327],[3.19,11.78,2.429],[2.7,12.11,2.546],[2.28,12.35,2.627],[1.73,12.58,2.744],[1.27,12.71,2.865],[0.68,12.8,2.982],[0.1,12.83,3.103],[-0.52,12.78,-3.068],[-1.15,12.66,-2.958],[-1.76,12.48,-2.849],[-2.34,12.25,-2.765],[-2.94,11.94,-2.661],[-3.51,11.56,-2.56],[-4.07,11.11,-2.462],[-4.61,10.59,-2.369],[-5.02,10.09,-2.26],[-5.34,9.59,-2.143],[-5.58,9.09,-2.017],[-5.77,8.54,-1.895],[-5.89,7.95,-1.778],[-5.94,7.39,-1.655],[-5.92,6.81,-1.535],[-5.82,6.15,-1.429],[-5.66,5.48,-1.329],[-5.49,4.66,-1.364],[-5.36,3.72,-1.438],[-5.21,2.72,-1.423],[-5.08,1.67,-1.448],[-4.91,0.64,-1.409],[-4.81,-0.41,-1.475]]},{"outcome":"ok","dur":4.5,"pts":[[5.15,0.5,1.566],[5.2,1.05,1.486],[5.21,1.81,1.553],[5.23,2.71,1.55],[5.23,3.7,1.571],[5.2,4.75,1.597],[5.1,5.81,1.663],[4.94,6.83,1.731],[4.72,7.82,1.782],[4.46,8.76,1.845],[4.17,9.6,1.905],[3.9,10.15,2.019],[3.54,10.74,2.121],[3.26,11.1,2.228],[2.88,11.51,2.331],[2.59,11.76,2.422],[2.22,12.03,2.513],[1.86,12.24,2.619],[1.47,12.41,2.716],[0.97,12.56,2.851],[0.37,12.67,2.966],[-0.22,12.7,3.084],[-0.82,12.67,-3.082],[-1.42,12.56,-2.967],[-1.99,12.39,-2.85],[-2.56,12.15,-2.737],[-3.11,11.83,-2.627],[-3.67,11.44,-2.524],[-4.2,10.97,-2.426],[-4.7,10.45,-2.329],[-5.09,9.93,-2.22],[-5.4,9.42,-2.104],[-5.64,8.87,-1.987],[-5.81,8.31,-1.866],[-5.9,7.75,-1.743],[-5.93,7.21,-1.615],[-5.89,6.61,-1.499],[-5.77,5.95,-1.394],[-5.57,5.26,-1.297],[-5.41,4.41,-1.377],[-5.29,3.44,-1.449],[-5.16,2.41,-1.449],[-5.01,1.37,-1.43],[-4.94,0.33,-1.497],[-4.93,-0.49,-1.559]]},{"outcome":"ok","dur":4.5,"pts":[[5.36,0.5,1.597],[5.37,0.94,1.533],[5.39,1.62,1.54],[5.39,2.46,1.573],[5.46,3.41,1.499],[5.53,4.43,1.506],[5.52,5.48,1.573],[5.45,6.48,1.643],[5.32,7.33,1.724],[5.15,8.17,1.776],[4.9,9.01,1.855],[4.63,9.7,1.95],[4.3,10.32,2.049],[3.97,10.82,2.167],[3.55,11.3,2.277],[3.16,11.66,2.405],[2.7,11.98,2.528],[2.18,12.27,2.645],[1.68,12.46,2.776],[1.07,12.62,2.888],[0.46,12.7,3.002],[-0.17,12.72,3.113],[-0.77,12.67,-3.054],[-1.35,12.54,-2.936],[-1.94,12.35,-2.824],[-2.51,12.1,-2.721],[-3.07,11.77,-2.613],[-3.62,11.37,-2.511],[-4.16,10.89,-2.414],[-4.67,10.34,-2.321],[-5.08,9.79,-2.218],[-5.4,9.26,-2.104],[-5.62,8.74,-1.981],[-5.78,8.2,-1.857],[-5.88,7.64,-1.734],[-5.9,7.04,-1.617],[-5.86,6.39,-1.509],[-5.75,5.69,-1.41],[-5.57,4.99,-1.314],[-5.36,4.14,-1.334],[-5.2,3.18,-1.405],[-5.1,2.15,-1.473],[-4.96,1.14,-1.436],[-4.9,0.14,-1.506],[-4.91,-0.69,-1.589]]}]},{"alpha":0.05,"success":100,"lapTime":4.84,"entropy":-0.8,"steerMu":0.62,"steerSigma":0.158,"pedalMu":0.231,"pedalSigma":0.157,"trajectories":[{"outcome":"ok","dur":5.2,"pts":[[5.44,0.5,1.543],[5.48,0.96,1.494],[5.46,1.63,1.598],[5.51,2.38,1.505],[5.59,3.21,1.47],[5.63,3.79,1.511],[5.6,4.53,1.606],[5.64,5.38,1.524],[5.71,6.33,1.502],[5.69,7.05,1.599],[5.59,7.85,1.685],[5.47,8.53,1.751],[5.27,9.24,1.845],[5.06,9.75,1.972],[4.75,10.34,2.053],[4.47,10.73,2.178],[4.06,11.21,2.282],[3.64,11.61,2.39],[3.2,11.96,2.467],[2.79,12.22,2.575],[2.29,12.45,2.698],[1.83,12.61,2.818],[1.43,12.71,2.898],[1.01,12.76,3.01],[0.33,12.78,3.114],[-0.45,12.73,-3.08],[-1.09,12.63,-2.973],[-1.67,12.46,-2.856],[-2.26,12.21,-2.746],[-2.9,11.87,-2.65],[-3.51,11.46,-2.554],[-4.05,11.02,-2.454],[-4.55,10.52,-2.356],[-5.0,9.97,-2.257],[-5.28,9.54,-2.141],[-5.46,9.19,-2.058],[-5.64,8.77,-1.974],[-5.78,8.32,-1.865],[-5.87,7.79,-1.743],[-5.9,7.18,-1.627],[-5.87,6.56,-1.515],[-5.77,5.98,-1.402],[-5.66,5.45,-1.367],[-5.59,4.93,-1.437],[-5.57,4.3,-1.542],[-5.61,3.76,-1.642],[-5.66,3.19,-1.664],[-5.65,2.53,-1.557],[-5.57,1.82,-1.459],[-5.5,1.07,-1.468],[-5.47,0.17,-1.542],[-5.51,-0.8,-1.614]]},{"outcome":"ok","dur":5.1,"pts":[[4.66,0.5,1.588],[4.67,1.09,1.554],[4.73,1.8,1.483],[4.88,2.67,1.403],[5.06,3.55,1.365],[5.17,4.39,1.447],[5.19,5.13,1.542],[5.2,5.85,1.556],[5.14,6.73,1.636],[5.02,7.52,1.724],[4.81,8.41,1.8],[4.59,9.05,1.898],[4.28,9.76,1.987],[3.89,10.47,2.075],[3.53,10.99,2.179],[3.08,11.51,2.28],[2.72,11.83,2.414],[2.33,12.11,2.52],[1.97,12.32,2.612],[1.55,12.5,2.736],[1.2,12.62,2.819],[0.79,12.71,2.919],[0.23,12.77,3.044],[-0.34,12.75,-3.115],[-0.87,12.67,-2.988],[-1.44,12.51,-2.876],[-1.97,12.3,-2.761],[-2.51,12.02,-2.662],[-3.05,11.67,-2.56],[-3.55,11.26,-2.459],[-4.06,10.76,-2.371],[-4.53,10.22,-2.282],[-4.96,9.68,-2.242],[-5.28,9.18,-2.143],[-5.51,8.77,-2.076],[-5.67,8.39,-1.964],[-5.79,7.97,-1.848],[-5.86,7.49,-1.733],[-5.89,6.91,-1.612],[-5.84,6.34,-1.489],[-5.74,5.82,-1.381],[-5.59,5.26,-1.298],[-5.46,4.79,-1.312],[-5.36,4.24,-1.393],[-5.31,3.57,-1.498],[-5.34,2.94,-1.609],[-5.4,2.42,-1.697],[-5.51,1.87,-1.768],[-5.63,1.13,-1.721],[-5.66,0.42,-1.623],[-5.63,-0.39,-1.535]]},{"outcome":"ok","dur":4.7,"pts":[[4.81,0.5,1.516],[4.83,0.9,1.533],[4.82,1.54,1.587],[4.88,2.23,1.487],[5.02,3.05,1.402],[5.12,3.9,1.452],[5.14,4.69,1.542],[5.14,5.47,1.569],[5.07,6.35,1.648],[4.93,7.33,1.719],[4.74,8.22,1.775],[4.49,9.09,1.852],[4.22,9.76,1.95],[3.93,10.32,2.061],[3.58,10.82,2.169],[3.27,11.18,2.286],[2.87,11.53,2.417],[2.48,11.8,2.543],[2.03,12.02,2.677],[1.63,12.17,2.797],[0.98,12.33,2.902],[0.28,12.43,3.001],[-0.56,12.47,3.084],[-1.28,12.45,-3.102],[-1.83,12.35,-2.976],[-2.39,12.19,-2.856],[-2.84,12.02,-2.775],[-3.23,11.82,-2.683],[-3.59,11.61,-2.592],[-4.01,11.29,-2.5],[-4.44,10.91,-2.415],[-4.85,10.46,-2.307],[-5.22,9.95,-2.196],[-5.49,9.45,-2.072],[-5.68,8.97,-1.95],[-5.84,8.37,-1.837],[-5.93,7.78,-1.72],[-5.96,7.15,-1.609],[-5.91,6.47,-1.506],[-5.8,5.82,-1.4],[-5.63,5.18,-1.301],[-5.42,4.54,-1.267],[-5.25,3.79,-1.34],[-5.11,2.89,-1.418],[-5.03,1.89,-1.488],[-5.01,0.83,-1.553],[-5.06,-0.28,-1.617]]},{"outcome":"ok","dur":5.0,"pts":[[5.34,0.5,1.609],[5.32,0.88,1.631],[5.32,1.32,1.552],[5.41,2.01,1.451],[5.53,2.83,1.426],[5.58,3.68,1.508],[5.55,4.31,1.618],[5.55,4.77,1.57],[5.62,5.38,1.457],[5.69,6.12,1.478],[5.69,6.92,1.565],[5.63,7.79,1.645],[5.51,8.46,1.744],[5.33,9.1,1.848],[5.05,9.84,1.937],[4.79,10.32,2.065],[4.38,10.92,2.161],[4.02,11.34,2.287],[3.61,11.76,2.345],[3.15,12.13,2.462],[2.66,12.44,2.585],[2.22,12.65,2.693],[1.65,12.85,2.802],[1.24,12.95,2.891],[0.7,13.03,2.997],[0.2,13.04,3.121],[-0.44,12.99,-3.053],[-0.99,12.87,-2.928],[-1.58,12.67,-2.817],[-2.24,12.37,-2.721],[-2.9,12.0,-2.628],[-3.46,11.6,-2.526],[-3.96,11.16,-2.422],[-4.46,10.64,-2.324],[-4.89,10.07,-2.227],[-5.32,9.4,-2.138],[-5.59,8.84,-2.026],[-5.75,8.4,-1.904],[-5.85,7.9,-1.777],[-5.9,7.31,-1.658],[-5.89,6.66,-1.551],[-5.81,5.99,-1.448],[-5.66,5.38,-1.335],[-5.49,4.78,-1.296],[-5.34,4.05,-1.362],[-5.22,3.18,-1.442],[-5.17,2.21,-1.514],[-5.18,1.17,-1.582],[-5.23,0.09,-1.616],[-5.31,-1.01,-1.642]]},{"outcome":"ok","dur":4.9,"pts":[[5.14,0.5,1.669],[5.13,0.89,1.595],[5.17,1.51,1.499],[5.22,2.27,1.505],[5.2,3.04,1.596],[5.19,3.77,1.59],[5.25,4.53,1.497],[5.34,5.34,1.453],[5.38,6.13,1.528],[5.34,6.93,1.615],[5.23,7.85,1.691],[5.08,8.48,1.8],[4.89,9.05,1.896],[4.59,9.74,1.98],[4.28,10.28,2.093],[3.98,10.69,2.209],[3.62,11.08,2.305],[3.17,11.47,2.424],[2.67,11.82,2.538],[1.99,12.2,2.628],[1.41,12.46,2.733],[0.97,12.58,2.864],[0.46,12.65,3.001],[-0.22,12.68,3.105],[-0.69,12.63,-3.044],[-1.28,12.5,-2.929],[-1.88,12.3,-2.818],[-2.47,12.03,-2.71],[-3.02,11.7,-2.607],[-3.53,11.34,-2.525],[-4.07,10.88,-2.432],[-4.51,10.42,-2.345],[-4.94,9.91,-2.265],[-5.3,9.39,-2.177],[-5.52,8.98,-2.054],[-5.68,8.54,-1.928],[-5.81,8.01,-1.813],[-5.88,7.43,-1.692],[-5.89,6.83,-1.576],[-5.82,6.23,-1.46],[-5.68,5.63,-1.346],[-5.58,5.04,-1.401],[-5.5,4.41,-1.449],[-5.48,3.63,-1.538],[-5.52,2.79,-1.622],[-5.62,1.92,-1.684],[-5.7,1.05,-1.665],[-5.72,0.24,-1.589],[-5.66,-0.61,-1.507]]},{"outcome":"ok","dur":5.0,"pts":[[5.48,0.5,1.479],[5.5,0.93,1.528],[5.53,1.38,1.496],[5.51,2.03,1.603],[5.56,2.7,1.499],[5.55,3.46,1.59],[5.6,4.32,1.508],[5.73,5.28,1.436],[5.76,5.95,1.53],[5.72,6.74,1.619],[5.67,7.63,1.632],[5.57,8.25,1.729],[5.4,8.91,1.822],[5.21,9.42,1.924],[4.96,9.95,2.006],[4.62,10.51,2.112],[4.32,10.92,2.219],[3.88,11.38,2.33],[3.51,11.72,2.4],[2.99,12.1,2.508],[2.58,12.33,2.623],[2.01,12.58,2.736],[1.52,12.73,2.845],[0.85,12.86,2.948],[0.27,12.9,3.067],[-0.29,12.87,-3.09],[-0.85,12.79,-3.0],[-1.45,12.64,-2.889],[-1.99,12.43,-2.768],[-2.54,12.15,-2.666],[-3.2,11.74,-2.593],[-3.8,11.29,-2.5],[-4.36,10.79,-2.407],[-4.8,10.3,-2.301],[-5.13,9.82,-2.179],[-5.45,9.24,-2.074],[-5.66,8.75,-1.973],[-5.79,8.26,-1.835],[-5.88,7.66,-1.72],[-5.91,6.97,-1.618],[-5.88,6.28,-1.517],[-5.8,5.67,-1.441],[-5.65,5.09,-1.324],[-5.52,4.57,-1.334],[-5.38,4.01,-1.321],[-5.2,3.26,-1.328],[-5.05,2.36,-1.405],[-4.95,1.36,-1.475],[-4.92,0.29,-1.54],[-4.92,-0.82,-1.577]]},{"outcome":"ok","dur":4.9,"pts":[[5.15,0.5,1.566],[5.18,1.06,1.508],[5.23,1.72,1.501],[5.21,2.46,1.596],[5.23,3.23,1.544],[5.32,4.06,1.46],[5.44,4.87,1.435],[5.51,5.7,1.479],[5.53,6.63,1.547],[5.48,7.46,1.63],[5.37,8.28,1.715],[5.21,8.88,1.827],[4.97,9.51,1.927],[4.75,10.01,2.001],[4.47,10.48,2.102],[4.16,10.91,2.193],[3.9,11.21,2.287],[3.51,11.57,2.397],[3.21,11.81,2.466],[2.78,12.08,2.581],[2.34,12.29,2.697],[1.83,12.47,2.808],[1.23,12.6,2.923],[0.51,12.69,3.02],[-0.02,12.68,-3.132],[-0.71,12.61,-3.032],[-1.27,12.47,-2.91],[-1.84,12.27,-2.794],[-2.41,12.0,-2.699],[-3.01,11.63,-2.601],[-3.53,11.28,-2.531],[-3.98,10.9,-2.45],[-4.51,10.4,-2.382],[-4.93,9.9,-2.276],[-5.24,9.43,-2.152],[-5.47,8.97,-2.038],[-5.65,8.47,-1.913],[-5.8,7.88,-1.814],[-5.88,7.26,-1.702],[-5.9,6.58,-1.6],[-5.85,5.86,-1.503],[-5.73,5.19,-1.399],[-5.61,4.6,-1.359],[-5.47,4.02,-1.344],[-5.37,3.26,-1.436],[-5.32,2.38,-1.515],[-5.34,1.47,-1.591],[-5.43,0.56,-1.668],[-5.51,-0.36,-1.658]]},{"outcome":"ok","dur":5.0,"pts":[[5.36,0.5,1.597],[5.37,0.93,1.529],[5.33,1.58,1.637],[5.35,2.31,1.541],[5.45,3.17,1.461],[5.56,4.01,1.435],[5.6,4.83,1.521],[5.58,5.77,1.595],[5.54,6.51,1.632],[5.46,7.32,1.658],[5.33,8.1,1.747],[5.15,8.74,1.834],[4.96,9.26,1.921],[4.75,9.75,1.992],[4.41,10.32,2.097],[4.09,10.74,2.22],[3.79,11.06,2.324],[3.36,11.42,2.447],[3.01,11.66,2.547],[2.47,11.94,2.662],[1.92,12.17,2.752],[1.17,12.4,2.841],[0.63,12.5,2.947],[0.21,12.54,3.065],[-0.47,12.52,-3.115],[-1.1,12.43,-3.004],[-1.67,12.28,-2.886],[-2.22,12.06,-2.767],[-2.75,11.8,-2.673],[-3.37,11.4,-2.578],[-3.99,10.93,-2.489],[-4.46,10.49,-2.385],[-4.89,10.02,-2.312],[-5.18,9.63,-2.214],[-5.39,9.28,-2.11],[-5.6,8.84,-2.01],[-5.75,8.41,-1.911],[-5.87,7.86,-1.786],[-5.93,7.28,-1.667],[-5.92,6.62,-1.56],[-5.84,5.93,-1.46],[-5.7,5.3,-1.351],[-5.55,4.77,-1.295],[-5.45,4.3,-1.369],[-5.39,3.66,-1.465],[-5.38,2.92,-1.56],[-5.44,2.03,-1.639],[-5.55,1.07,-1.691],[-5.6,0.15,-1.623],[-5.57,-0.62,-1.532]]}]},{"alpha":0.2,"success":100,"lapTime":5.5,"entropy":0.35,"steerMu":0.45,"steerSigma":0.366,"pedalMu":0.518,"pedalSigma":0.255,"trajectories":[{"outcome":"ok","dur":5.3,"pts":[[5.44,0.5,1.543],[5.48,0.86,1.472],[5.52,1.41,1.492],[5.65,2.11,1.393],[5.7,2.76,1.491],[5.73,3.2,1.495],[5.72,3.79,1.601],[5.77,4.47,1.497],[5.77,5.29,1.57],[5.7,6.12,1.655],[5.56,6.88,1.745],[5.47,7.63,1.7],[5.29,8.43,1.786],[5.08,9.05,1.892],[4.79,9.71,1.989],[4.51,10.17,2.119],[4.1,10.7,2.223],[3.6,11.24,2.319],[3.16,11.68,2.359],[2.8,11.97,2.469],[2.33,12.25,2.597],[1.91,12.44,2.724],[1.56,12.56,2.8],[1.21,12.65,2.893],[0.62,12.73,3.01],[-0.0,12.75,3.099],[-0.58,12.71,-3.063],[-1.02,12.62,-2.943],[-1.55,12.44,-2.819],[-2.23,12.14,-2.725],[-2.86,11.79,-2.627],[-3.35,11.43,-2.514],[-3.82,11.01,-2.402],[-4.26,10.53,-2.324],[-4.55,10.16,-2.229],[-4.76,9.87,-2.207],[-5.03,9.48,-2.174],[-5.23,9.12,-2.069],[-5.41,8.69,-1.968],[-5.59,8.11,-1.881],[-5.74,7.43,-1.78],[-5.8,6.79,-1.671],[-5.82,6.13,-1.599],[-5.86,5.58,-1.637],[-5.85,4.99,-1.56],[-5.84,4.5,-1.559],[-5.79,3.92,-1.485],[-5.75,3.37,-1.485],[-5.63,2.67,-1.404],[-5.56,1.83,-1.488],[-5.41,0.91,-1.413],[-5.35,0.09,-1.497],[-5.33,-0.54,-1.538]]},{"outcome":"ok","dur":6.1,"pts":[[4.66,0.5,1.588],[4.64,1.01,1.609],[4.62,1.5,1.613],[4.66,2.21,1.515],[4.77,2.96,1.423],[4.85,3.74,1.471],[4.85,4.44,1.572],[4.91,5.02,1.461],[4.93,5.77,1.554],[4.9,6.29,1.619],[4.8,7.0,1.716],[4.72,7.58,1.711],[4.69,8.21,1.604],[4.6,8.87,1.709],[4.5,9.48,1.74],[4.32,10.11,1.847],[4.14,10.53,1.971],[3.95,10.89,2.065],[3.76,11.2,2.121],[3.52,11.51,2.221],[3.3,11.77,2.283],[3.05,12.03,2.346],[2.71,12.3,2.447],[2.36,12.54,2.563],[2.04,12.71,2.655],[1.63,12.87,2.751],[1.29,12.98,2.845],[0.91,13.05,2.947],[0.53,13.09,3.051],[0.21,13.09,-3.141],[-0.25,13.03,-3.015],[-0.76,12.9,-2.894],[-1.19,12.8,-2.913],[-1.71,12.61,-2.793],[-2.19,12.47,-2.85],[-2.76,12.22,-2.737],[-3.15,12.0,-2.616],[-3.44,11.8,-2.563],[-3.75,11.56,-2.471],[-4.02,11.31,-2.386],[-4.24,11.07,-2.318],[-4.56,10.62,-2.192],[-4.84,10.12,-2.07],[-5.13,9.51,-2.022],[-5.49,8.82,-2.055],[-5.69,8.29,-1.932],[-5.79,7.92,-1.823],[-5.84,7.61,-1.735],[-5.86,7.04,-1.612],[-5.82,6.38,-1.507],[-5.78,5.6,-1.523],[-5.78,4.92,-1.564],[-5.72,4.41,-1.458],[-5.71,3.94,-1.541],[-5.69,3.47,-1.536],[-5.7,2.82,-1.582],[-5.67,2.3,-1.51],[-5.67,1.79,-1.573],[-5.73,1.14,-1.657],[-5.76,0.41,-1.618],[-5.72,-0.21,-1.505]]},{"outcome":"ok","dur":5.6,"pts":[[4.81,0.5,1.516],[4.81,0.83,1.582],[4.73,1.43,1.698],[4.73,2.03,1.582],[4.73,2.5,1.566],[4.74,3.06,1.55],[4.78,3.63,1.493],[4.89,4.24,1.404],[4.93,4.91,1.51],[4.97,5.73,1.519],[5.08,6.58,1.437],[5.12,7.37,1.526],[5.08,8.06,1.627],[4.97,8.73,1.73],[4.82,9.42,1.795],[4.65,9.91,1.904],[4.41,10.37,2.038],[4.15,10.76,2.165],[3.83,11.13,2.285],[3.52,11.41,2.403],[3.03,11.77,2.518],[2.59,12.0,2.654],[1.94,12.28,2.733],[1.22,12.52,2.824],[0.69,12.62,2.956],[0.04,12.67,3.062],[-0.43,12.67,3.132],[-0.83,12.63,-3.045],[-1.14,12.58,-2.958],[-1.6,12.43,-2.847],[-2.13,12.24,-2.797],[-2.65,11.98,-2.678],[-3.27,11.6,-2.581],[-3.89,11.13,-2.491],[-4.37,10.67,-2.386],[-4.79,10.18,-2.277],[-5.06,9.76,-2.147],[-5.25,9.4,-2.054],[-5.48,8.81,-1.942],[-5.69,8.09,-1.849],[-5.82,7.36,-1.755],[-5.87,6.72,-1.645],[-5.84,6.15,-1.523],[-5.8,5.61,-1.486],[-5.77,5.07,-1.515],[-5.75,4.48,-1.546],[-5.77,3.95,-1.597],[-5.78,3.22,-1.595],[-5.79,2.71,-1.581],[-5.8,2.29,-1.587],[-5.78,1.93,-1.538],[-5.77,1.63,-1.54],[-5.78,1.2,-1.58],[-5.82,0.63,-1.652],[-5.81,0.03,-1.551],[-5.86,-0.71,-1.632]]},{"outcome":"ok","dur":5.5,"pts":[[5.34,0.5,1.609],[5.32,0.79,1.644],[5.3,1.06,1.621],[5.31,1.51,1.555],[5.39,2.16,1.448],[5.42,2.85,1.527],[5.38,3.42,1.642],[5.39,3.82,1.548],[5.39,4.13,1.558],[5.41,4.67,1.547],[5.4,5.41,1.577],[5.41,6.28,1.557],[5.37,7.1,1.623],[5.26,7.82,1.719],[5.1,8.67,1.762],[4.91,9.27,1.872],[4.61,10.01,1.961],[4.29,10.6,2.064],[3.98,11.08,2.143],[3.59,11.57,2.255],[3.16,11.98,2.374],[2.8,12.25,2.483],[2.29,12.56,2.599],[1.9,12.76,2.668],[1.52,12.92,2.74],[1.14,13.05,2.832],[0.67,13.14,2.94],[0.28,13.18,3.043],[-0.21,13.17,-3.118],[-0.89,13.08,-3.015],[-1.51,12.93,-2.906],[-1.97,12.76,-2.778],[-2.33,12.58,-2.673],[-2.74,12.3,-2.555],[-3.19,11.92,-2.436],[-3.76,11.39,-2.397],[-4.35,10.76,-2.316],[-4.8,10.16,-2.222],[-5.08,9.67,-2.098],[-5.33,9.12,-1.983],[-5.58,8.37,-1.894],[-5.77,7.56,-1.81],[-5.85,6.95,-1.696],[-5.87,6.26,-1.595],[-5.81,5.6,-1.489],[-5.8,5.06,-1.554],[-5.78,4.46,-1.526],[-5.73,3.99,-1.462],[-5.63,3.34,-1.418],[-5.56,2.84,-1.444],[-5.55,2.39,-1.536],[-5.59,1.72,-1.641],[-5.71,1.02,-1.739],[-5.79,0.16,-1.657],[-5.78,-0.55,-1.558]]},{"outcome":"ok","dur":6.0,"pts":[[5.14,0.5,1.669],[5.12,0.83,1.619],[5.1,1.19,1.645],[5.06,1.61,1.652],[5.03,1.97,1.648],[5.01,2.28,1.64],[5.0,2.52,1.611],[5.03,2.93,1.496],[5.08,3.41,1.472],[5.09,3.9,1.541],[5.12,4.61,1.538],[5.07,5.27,1.638],[5.03,5.84,1.64],[5.05,6.62,1.549],[5.0,7.41,1.637],[4.88,8.08,1.741],[4.76,8.69,1.771],[4.57,9.29,1.883],[4.3,9.89,1.989],[3.9,10.61,2.074],[3.53,11.19,2.133],[3.21,11.57,2.273],[2.9,11.87,2.379],[2.47,12.19,2.51],[2.15,12.37,2.616],[1.75,12.55,2.733],[1.32,12.68,2.831],[0.82,12.78,2.952],[0.39,12.81,3.065],[0.06,12.81,-3.132],[-0.52,12.73,-3.011],[-0.97,12.64,-2.944],[-1.48,12.48,-2.824],[-2.18,12.3,-2.887],[-2.72,12.08,-2.767],[-3.27,11.79,-2.655],[-3.7,11.49,-2.537],[-4.04,11.22,-2.459],[-4.31,10.95,-2.366],[-4.56,10.66,-2.279],[-4.84,10.22,-2.144],[-5.25,9.68,-2.205],[-5.48,9.25,-2.069],[-5.63,8.88,-1.962],[-5.74,8.48,-1.845],[-5.84,7.87,-1.731],[-5.89,7.12,-1.638],[-5.87,6.44,-1.541],[-5.78,5.64,-1.453],[-5.61,4.79,-1.373],[-5.41,4.16,-1.275],[-5.31,3.66,-1.357],[-5.16,3.14,-1.294],[-5.04,2.63,-1.347],[-4.95,2.12,-1.388],[-4.9,1.73,-1.464],[-4.83,1.37,-1.368],[-4.79,0.81,-1.492],[-4.76,0.38,-1.505],[-4.73,-0.07,-1.497]]},{"outcome":"ok","dur":5.7,"pts":[[5.48,0.5,1.479],[5.53,0.89,1.437],[5.58,1.23,1.448],[5.6,1.76,1.53],[5.65,2.38,1.491],[5.65,3.0,1.563],[5.73,3.71,1.469],[5.88,4.56,1.388],[5.92,5.15,1.508],[5.89,5.73,1.627],[5.91,6.4,1.545],[5.86,6.88,1.668],[5.76,7.41,1.76],[5.63,7.85,1.842],[5.52,8.24,1.862],[5.27,8.82,1.973],[5.02,9.29,2.054],[4.65,9.86,2.155],[4.32,10.4,2.121],[3.88,10.98,2.217],[3.52,11.34,2.349],[3.01,11.76,2.456],[2.5,12.09,2.569],[1.96,12.35,2.685],[1.41,12.55,2.806],[0.95,12.65,2.923],[0.51,12.72,2.979],[-0.06,12.75,3.087],[-0.49,12.73,-3.083],[-0.94,12.65,-2.971],[-1.62,12.49,-2.912],[-2.3,12.26,-2.815],[-2.94,11.97,-2.714],[-3.38,11.7,-2.584],[-3.74,11.4,-2.454],[-4.17,10.95,-2.341],[-4.61,10.46,-2.298],[-4.97,9.95,-2.184],[-5.28,9.38,-2.076],[-5.62,8.63,-1.991],[-5.8,8.04,-1.878],[-5.88,7.64,-1.764],[-5.92,7.25,-1.654],[-5.92,6.77,-1.58],[-5.89,6.32,-1.491],[-5.78,5.68,-1.402],[-5.66,5.07,-1.379],[-5.49,4.4,-1.327],[-5.34,3.86,-1.291],[-5.2,3.41,-1.276],[-5.07,3.04,-1.245],[-4.95,2.62,-1.289],[-4.87,2.23,-1.36],[-4.82,1.78,-1.465],[-4.73,1.28,-1.397],[-4.65,0.58,-1.445],[-4.61,-0.25,-1.529]]},{"outcome":"ok","dur":5.5,"pts":[[5.15,0.5,1.566],[5.15,1.07,1.57],[5.16,1.58,1.556],[5.16,2.05,1.556],[5.17,2.56,1.562],[5.21,3.04,1.493],[5.31,3.54,1.358],[5.48,4.19,1.321],[5.64,4.94,1.361],[5.72,5.65,1.46],[5.73,6.42,1.551],[5.68,7.15,1.646],[5.55,7.93,1.734],[5.42,8.64,1.752],[5.24,9.23,1.864],[5.02,9.78,1.956],[4.82,10.15,2.062],[4.52,10.58,2.187],[4.29,10.87,2.24],[3.96,11.21,2.347],[3.54,11.53,2.479],[3.04,11.84,2.584],[2.5,12.13,2.662],[1.91,12.35,2.774],[1.45,12.46,2.902],[0.86,12.53,3.02],[0.43,12.56,3.075],[-0.04,12.53,-3.076],[-0.49,12.47,-3.009],[-1.15,12.31,-2.905],[-1.59,12.18,-2.845],[-1.94,12.03,-2.753],[-2.53,11.76,-2.71],[-3.09,11.43,-2.602],[-3.6,11.04,-2.494],[-3.98,10.67,-2.376],[-4.32,10.26,-2.251],[-4.67,9.83,-2.253],[-4.95,9.4,-2.152],[-5.25,8.81,-2.047],[-5.55,8.08,-1.958],[-5.71,7.51,-1.839],[-5.77,7.09,-1.725],[-5.78,6.58,-1.59],[-5.81,5.89,-1.613],[-5.88,5.33,-1.695],[-5.89,4.83,-1.58],[-5.86,4.3,-1.527],[-5.83,3.61,-1.52],[-5.75,2.89,-1.466],[-5.67,2.34,-1.429],[-5.64,1.74,-1.522],[-5.63,1.26,-1.535],[-5.62,0.6,-1.556],[-5.57,-0.1,-1.506]]},{"outcome":"ok","dur":5.6,"pts":[[5.36,0.5,1.597],[5.37,0.9,1.532],[5.35,1.39,1.619],[5.38,1.99,1.512],[5.45,2.68,1.472],[5.56,3.26,1.392],[5.61,3.96,1.492],[5.72,4.8,1.447],[5.75,5.39,1.518],[5.74,5.96,1.574],[5.67,6.56,1.69],[5.59,7.11,1.728],[5.5,7.53,1.774],[5.43,7.92,1.756],[5.26,8.52,1.841],[5.03,9.1,1.954],[4.8,9.53,2.065],[4.47,10.0,2.166],[4.21,10.32,2.26],[3.91,10.67,2.279],[3.59,11.0,2.346],[3.12,11.47,2.358],[2.78,11.78,2.406],[2.51,11.98,2.49],[2.02,12.27,2.613],[1.59,12.46,2.727],[1.21,12.58,2.825],[0.82,12.66,2.933],[0.45,12.7,3.03],[-0.19,12.71,3.139],[-0.96,12.64,-3.054],[-1.49,12.52,-2.928],[-2.06,12.35,-2.84],[-2.48,12.17,-2.747],[-2.87,11.96,-2.64],[-3.32,11.67,-2.581],[-3.7,11.39,-2.489],[-4.12,10.97,-2.371],[-4.5,10.51,-2.254],[-4.88,9.93,-2.153],[-5.28,9.2,-2.069],[-5.56,8.54,-1.972],[-5.69,8.04,-1.835],[-5.76,7.63,-1.729],[-5.79,6.97,-1.623],[-5.76,6.31,-1.517],[-5.78,5.5,-1.604],[-5.74,4.65,-1.521],[-5.68,3.87,-1.491],[-5.61,3.33,-1.447],[-5.6,2.8,-1.554],[-5.65,2.31,-1.662],[-5.69,1.7,-1.643],[-5.78,0.98,-1.696],[-5.81,0.44,-1.622],[-5.83,-0.14,-1.602]]}]},{"alpha":1.0,"success":100,"lapTime":7.59,"entropy":0.67,"steerMu":0.465,"steerSigma":0.441,"pedalMu":0.403,"pedalSigma":0.272,"trajectories":[{"outcome":"ok","dur":7.7,"pts":[[5.44,0.5,1.543],[5.47,0.78,1.484],[5.51,1.22,1.465],[5.62,1.73,1.362],[5.69,2.22,1.441],[5.73,2.55,1.455],[5.74,3.0,1.535],[5.8,3.42,1.435],[5.84,4.07,1.509],[5.82,4.69,1.61],[5.74,5.21,1.722],[5.72,5.7,1.602],[5.71,6.3,1.595],[5.66,6.78,1.677],[5.61,7.37,1.656],[5.52,7.79,1.767],[5.35,8.34,1.869],[5.2,9.02,1.788],[5.07,9.58,1.796],[4.94,9.99,1.887],[4.73,10.44,2.008],[4.52,10.79,2.118],[4.36,11.03,2.159],[4.22,11.21,2.208],[3.9,11.57,2.295],[3.52,11.97,2.334],[3.15,12.28,2.455],[2.85,12.48,2.549],[2.5,12.66,2.658],[1.95,12.87,2.777],[1.42,13.0,2.902],[0.96,13.06,3.019],[0.47,13.06,3.14],[-0.04,13.03,-3.082],[-0.39,12.98,-2.998],[-0.63,12.95,-3.007],[-0.91,12.91,-3.026],[-1.12,12.88,-2.973],[-1.3,12.84,-2.935],[-1.53,12.79,-2.932],[-1.81,12.71,-2.864],[-2.03,12.64,-2.816],[-2.28,12.55,-2.793],[-2.53,12.45,-2.787],[-2.88,12.29,-2.709],[-3.16,12.14,-2.641],[-3.51,11.89,-2.525],[-3.81,11.63,-2.426],[-4.21,11.19,-2.307],[-4.62,10.65,-2.221],[-5.04,9.98,-2.133],[-5.31,9.42,-2.019],[-5.48,8.95,-1.918],[-5.65,8.27,-1.818],[-5.73,7.8,-1.736],[-5.81,7.28,-1.718],[-5.84,6.66,-1.628],[-5.87,6.22,-1.632],[-5.87,5.88,-1.574],[-5.87,5.5,-1.569],[-5.87,5.21,-1.562],[-5.85,4.91,-1.506],[-5.77,4.32,-1.436],[-5.71,3.84,-1.452],[-5.67,3.41,-1.473],[-5.66,3.05,-1.537],[-5.65,2.73,-1.544],[-5.65,2.42,-1.568],[-5.65,2.19,-1.594],[-5.66,1.97,-1.614],[-5.72,1.55,-1.701],[-5.77,1.21,-1.716],[-5.79,0.98,-1.657],[-5.8,0.7,-1.61],[-5.81,0.42,-1.621],[-5.82,0.16,-1.618],[-5.82,-0.29,-1.55]]},{"outcome":"ok","dur":8.0,"pts":[[4.66,0.5,1.588],[4.64,0.9,1.614],[4.62,1.23,1.643],[4.62,1.82,1.565],[4.68,2.32,1.463],[4.72,2.81,1.491],[4.72,3.2,1.565],[4.74,3.5,1.491],[4.72,4.01,1.619],[4.7,4.37,1.619],[4.65,4.93,1.668],[4.62,5.36,1.621],[4.66,5.82,1.499],[4.63,6.42,1.615],[4.67,6.98,1.492],[4.66,7.68,1.593],[4.59,8.15,1.707],[4.55,8.51,1.703],[4.52,8.78,1.679],[4.47,9.04,1.739],[4.44,9.26,1.745],[4.4,9.46,1.754],[4.33,9.73,1.809],[4.24,10.02,1.888],[4.15,10.24,1.943],[4.03,10.52,1.995],[3.91,10.73,2.054],[3.79,10.93,2.11],[3.67,11.11,2.167],[3.57,11.25,2.214],[3.41,11.43,2.278],[3.21,11.64,2.345],[3.04,11.81,2.341],[2.79,12.04,2.413],[2.57,12.25,2.385],[2.15,12.55,2.52],[1.83,12.73,2.617],[1.6,12.85,2.65],[1.34,12.97,2.716],[1.11,13.06,2.774],[0.92,13.12,2.818],[0.47,13.22,2.937],[0.13,13.26,3.025],[-0.21,13.27,3.098],[-0.55,13.29,3.075],[-0.88,13.29,-3.13],[-1.21,13.26,-3.05],[-1.57,13.19,-2.964],[-2.11,13.03,-2.84],[-2.53,12.84,-2.728],[-3.09,12.52,-2.619],[-3.52,12.21,-2.516],[-3.81,11.94,-2.405],[-4.06,11.7,-2.365],[-4.26,11.47,-2.292],[-4.55,11.05,-2.172],[-4.73,10.73,-2.076],[-4.88,10.43,-2.031],[-5.09,9.99,-2.022],[-5.3,9.48,-1.961],[-5.42,9.03,-1.838],[-5.5,8.7,-1.811],[-5.58,8.22,-1.737],[-5.66,7.69,-1.724],[-5.75,7.11,-1.721],[-5.78,6.7,-1.647],[-5.78,6.13,-1.564],[-5.81,5.6,-1.63],[-5.87,4.89,-1.649],[-5.85,4.38,-1.545],[-5.86,3.85,-1.581],[-5.88,3.31,-1.606],[-5.87,2.94,-1.541],[-5.86,2.47,-1.548],[-5.85,2.12,-1.542],[-5.87,1.62,-1.627],[-5.86,1.24,-1.533],[-5.85,0.92,-1.556],[-5.87,0.43,-1.6],[-5.83,-0.12,-1.499]]},{"outcome":"ok","dur":7.5,"pts":[[4.81,0.5,1.516],[4.81,0.73,1.563],[4.76,1.22,1.691],[4.75,1.61,1.587],[4.74,1.9,1.616],[4.71,2.19,1.651],[4.7,2.43,1.638],[4.69,2.68,1.593],[4.67,3.0,1.627],[4.69,3.56,1.539],[4.78,4.16,1.424],[4.82,4.74,1.505],[4.79,5.32,1.62],[4.69,5.93,1.732],[4.65,6.64,1.633],[4.64,7.16,1.587],[4.58,7.64,1.694],[4.51,8.02,1.76],[4.44,8.35,1.76],[4.38,8.6,1.824],[4.23,8.99,1.921],[4.1,9.28,2.0],[3.92,9.8,1.912],[3.63,10.39,2.019],[3.4,10.77,2.13],[3.07,11.18,2.252],[2.82,11.47,2.265],[2.63,11.67,2.334],[2.47,11.82,2.392],[2.25,12.0,2.454],[1.97,12.21,2.489],[1.65,12.41,2.587],[1.15,12.64,2.715],[0.56,12.83,2.827],[0.03,12.93,2.959],[-0.52,12.97,3.068],[-0.92,12.96,-3.107],[-1.2,12.93,-3.042],[-1.64,12.83,-2.923],[-2.05,12.69,-2.814],[-2.51,12.47,-2.685],[-2.92,12.19,-2.545],[-3.23,11.92,-2.437],[-3.49,11.67,-2.359],[-3.73,11.4,-2.299],[-3.97,11.09,-2.241],[-4.17,10.83,-2.22],[-4.49,10.34,-2.152],[-4.7,9.99,-2.119],[-4.85,9.74,-2.086],[-4.94,9.55,-2.03],[-5.01,9.41,-1.997],[-5.07,9.25,-1.969],[-5.18,9.0,-1.982],[-5.28,8.72,-1.917],[-5.47,8.23,-1.933],[-5.58,7.79,-1.807],[-5.65,7.45,-1.78],[-5.69,7.0,-1.661],[-5.73,6.59,-1.673],[-5.73,6.01,-1.566],[-5.71,5.29,-1.549],[-5.7,4.77,-1.542],[-5.65,4.31,-1.479],[-5.6,3.77,-1.471],[-5.5,3.31,-1.358],[-5.4,2.73,-1.4],[-5.37,2.22,-1.507],[-5.38,1.83,-1.599],[-5.4,1.53,-1.648],[-5.45,1.17,-1.705],[-5.49,0.82,-1.677],[-5.5,0.51,-1.609],[-5.51,0.27,-1.628],[-5.53,-0.25,-1.599]]},{"outcome":"ok","dur":7.3,"pts":[[5.34,0.5,1.609],[5.32,0.73,1.64],[5.31,0.91,1.627],[5.31,1.28,1.582],[5.35,1.82,1.496],[5.37,2.3,1.533],[5.35,2.64,1.621],[5.35,2.87,1.572],[5.35,3.04,1.577],[5.35,3.39,1.572],[5.35,3.97,1.558],[5.43,4.71,1.465],[5.55,5.38,1.406],[5.56,5.92,1.537],[5.66,6.66,1.444],[5.66,7.2,1.568],[5.59,7.94,1.662],[5.46,8.57,1.771],[5.36,9.09,1.77],[5.17,9.67,1.885],[4.94,10.19,1.995],[4.73,10.55,2.08],[4.41,11.05,2.146],[4.17,11.38,2.191],[3.95,11.67,2.225],[3.74,11.92,2.287],[3.46,12.19,2.355],[3.22,12.4,2.429],[2.93,12.61,2.508],[2.43,12.89,2.63],[1.95,13.11,2.728],[1.58,13.23,2.827],[1.3,13.29,2.903],[0.94,13.35,2.991],[0.53,13.37,3.098],[-0.11,13.33,-3.085],[-0.89,13.22,-2.996],[-1.46,13.06,-2.878],[-1.85,12.91,-2.778],[-2.19,12.74,-2.671],[-2.64,12.43,-2.543],[-3.11,12.03,-2.43],[-3.42,11.68,-2.303],[-3.76,11.21,-2.203],[-4.03,10.78,-2.12],[-4.25,10.46,-2.176],[-4.46,10.12,-2.112],[-4.59,9.86,-2.037],[-4.75,9.42,-1.922],[-4.87,9.08,-1.92],[-4.98,8.81,-1.932],[-5.18,8.3,-1.954],[-5.34,7.83,-1.893],[-5.51,7.14,-1.814],[-5.57,6.63,-1.685],[-5.62,6.16,-1.674],[-5.65,5.69,-1.636],[-5.68,5.31,-1.66],[-5.69,4.88,-1.604],[-5.74,4.42,-1.662],[-5.77,4.02,-1.663],[-5.77,3.63,-1.569],[-5.79,3.29,-1.615],[-5.74,2.71,-1.494],[-5.73,2.28,-1.551],[-5.72,1.78,-1.545],[-5.69,1.44,-1.489],[-5.68,1.15,-1.514],[-5.66,0.94,-1.49],[-5.64,0.7,-1.502],[-5.6,0.31,-1.451],[-5.56,0.0,-1.449],[-5.54,-0.42,-1.527]]},{"outcome":"ok","dur":8.0,"pts":[[5.14,0.5,1.669],[5.12,0.75,1.638],[5.1,1.0,1.671],[5.06,1.25,1.698],[5.03,1.47,1.721],[5.0,1.65,1.738],[4.98,1.78,1.739],[4.95,2.0,1.678],[4.93,2.2,1.671],[4.91,2.38,1.692],[4.87,2.82,1.662],[4.82,3.19,1.705],[4.79,3.49,1.682],[4.8,4.07,1.56],[4.81,4.74,1.552],[4.83,5.26,1.523],[4.9,5.73,1.432],[4.91,6.21,1.55],[4.85,6.78,1.666],[4.85,7.55,1.575],[4.86,8.23,1.56],[4.8,8.72,1.697],[4.73,9.09,1.761],[4.57,9.55,1.889],[4.44,9.86,1.984],[4.27,10.16,2.068],[4.09,10.47,2.102],[3.88,10.79,2.159],[3.69,11.04,2.228],[3.54,11.21,2.278],[3.23,11.51,2.37],[2.98,11.74,2.406],[2.71,11.95,2.479],[2.32,12.29,2.424],[1.98,12.52,2.543],[1.49,12.77,2.67],[1.09,12.93,2.767],[0.76,13.04,2.819],[0.48,13.11,2.886],[0.24,13.16,2.944],[-0.13,13.2,3.045],[-0.55,13.25,3.02],[-0.87,13.26,3.108],[-1.24,13.24,-3.096],[-1.61,13.19,-2.993],[-2.1,13.05,-2.869],[-2.6,12.88,-2.817],[-3.04,12.69,-2.716],[-3.59,12.36,-2.607],[-4.09,11.98,-2.497],[-4.44,11.64,-2.362],[-4.69,11.34,-2.269],[-4.95,10.92,-2.135],[-5.15,10.53,-2.028],[-5.31,10.1,-1.933],[-5.42,9.78,-1.91],[-5.5,9.47,-1.822],[-5.65,9.07,-1.935],[-5.74,8.76,-1.856],[-5.81,8.42,-1.764],[-5.87,7.84,-1.679],[-5.88,7.42,-1.59],[-5.82,6.89,-1.462],[-5.83,6.37,-1.574],[-5.83,5.99,-1.576],[-5.84,5.69,-1.607],[-5.84,5.47,-1.565],[-5.83,5.22,-1.563],[-5.83,5.02,-1.552],[-5.82,4.8,-1.525],[-5.77,4.28,-1.481],[-5.77,3.91,-1.553],[-5.78,3.59,-1.601],[-5.86,3.04,-1.717],[-5.87,2.51,-1.593],[-5.81,1.82,-1.492],[-5.68,1.06,-1.402],[-5.66,0.52,-1.518],[-5.64,0.11,-1.543],[-5.63,-0.19,-1.522]]},{"outcome":"ok","dur":7.6,"pts":[[5.48,0.5,1.479],[5.51,0.75,1.446],[5.54,0.94,1.444],[5.56,1.22,1.478],[5.59,1.51,1.475],[5.61,1.78,1.513],[5.64,2.14,1.471],[5.77,2.75,1.359],[5.82,3.2,1.466],[5.82,3.74,1.579],[5.88,4.28,1.45],[5.9,4.7,1.538],[5.89,5.07,1.587],[5.88,5.36,1.624],[5.87,5.59,1.615],[5.79,6.08,1.729],[5.73,6.48,1.721],[5.63,7.03,1.755],[5.59,7.5,1.638],[5.48,8.14,1.747],[5.36,8.57,1.849],[5.13,9.12,1.966],[4.9,9.65,1.979],[4.6,10.16,2.097],[4.26,10.6,2.222],[3.99,10.92,2.288],[3.77,11.18,2.253],[3.48,11.53,2.262],[3.25,11.78,2.341],[3.02,11.98,2.41],[2.57,12.37,2.424],[2.06,12.72,2.538],[1.57,12.98,2.665],[1.19,13.12,2.769],[0.84,13.22,2.871],[0.3,13.3,2.99],[-0.18,13.35,3.049],[-0.63,13.33,-3.106],[-1.08,13.28,-3.014],[-1.75,13.12,-2.912],[-2.29,12.92,-2.79],[-2.67,12.77,-2.755],[-3.06,12.55,-2.643],[-3.4,12.33,-2.573],[-3.69,12.11,-2.469],[-4.1,11.69,-2.35],[-4.42,11.27,-2.223],[-4.72,10.77,-2.102],[-4.91,10.34,-1.984],[-5.02,10.0,-1.9],[-5.09,9.75,-1.836],[-5.15,9.49,-1.819],[-5.22,9.27,-1.846],[-5.35,8.9,-1.921],[-5.46,8.42,-1.805],[-5.54,7.79,-1.695],[-5.66,7.05,-1.723],[-5.68,6.54,-1.622],[-5.68,6.17,-1.56],[-5.66,5.84,-1.498],[-5.65,5.55,-1.543],[-5.65,5.35,-1.565],[-5.64,4.89,-1.564],[-5.63,4.51,-1.53],[-5.65,4.13,-1.619],[-5.65,3.59,-1.572],[-5.69,3.06,-1.648],[-5.71,2.62,-1.62],[-5.75,2.16,-1.659],[-5.78,1.71,-1.627],[-5.79,1.38,-1.626],[-5.81,1.01,-1.603],[-5.81,0.66,-1.572],[-5.81,0.34,-1.578],[-5.8,0.06,-1.524],[-5.79,-0.17,-1.525]]},{"outcome":"ok","dur":7.9,"pts":[[5.15,0.5,1.566],[5.15,1.04,1.57],[5.14,1.44,1.583],[5.13,1.77,1.608],[5.11,2.07,1.637],[5.1,2.3,1.624],[5.1,2.52,1.566],[5.14,2.88,1.472],[5.26,3.43,1.346],[5.35,3.99,1.411],[5.46,4.62,1.401],[5.52,5.2,1.472],[5.55,5.79,1.513],[5.63,6.31,1.425],[5.67,6.75,1.483],[5.69,7.18,1.51],[5.69,7.47,1.573],[5.66,7.85,1.643],[5.64,8.11,1.656],[5.6,8.43,1.705],[5.52,8.78,1.791],[5.41,9.17,1.847],[5.28,9.58,1.875],[5.09,10.0,2.003],[4.92,10.29,2.092],[4.66,10.64,2.214],[4.46,10.9,2.221],[4.26,11.12,2.302],[4.07,11.32,2.32],[3.71,11.62,2.454],[3.45,11.83,2.464],[3.26,11.97,2.514],[2.83,12.29,2.488],[2.4,12.55,2.613],[1.92,12.75,2.749],[1.53,12.86,2.85],[1.11,12.94,2.961],[0.73,13.01,2.963],[0.39,13.04,3.035],[-0.11,13.04,3.141],[-0.74,12.98,-3.031],[-1.23,12.86,-2.916],[-1.64,12.74,-2.856],[-1.97,12.61,-2.758],[-2.43,12.38,-2.678],[-2.79,12.22,-2.721],[-3.09,12.06,-2.648],[-3.41,11.84,-2.558],[-3.85,11.47,-2.436],[-4.28,11.01,-2.325],[-4.56,10.63,-2.204],[-4.8,10.23,-2.116],[-4.96,9.93,-2.05],[-5.13,9.46,-1.932],[-5.27,8.96,-1.837],[-5.36,8.38,-1.726],[-5.43,7.73,-1.677],[-5.56,7.11,-1.78],[-5.61,6.55,-1.655],[-5.68,6.1,-1.716],[-5.73,5.58,-1.671],[-5.75,5.18,-1.623],[-5.72,4.68,-1.506],[-5.66,4.17,-1.452],[-5.59,3.67,-1.445],[-5.58,3.33,-1.524],[-5.57,3.07,-1.534],[-5.57,2.89,-1.573],[-5.57,2.76,-1.584],[-5.57,2.67,-1.598],[-5.59,2.23,-1.6],[-5.59,1.93,-1.574],[-5.6,1.66,-1.637],[-5.64,1.37,-1.695],[-5.71,1.0,-1.765],[-5.75,0.65,-1.688],[-5.78,0.41,-1.664],[-5.79,0.15,-1.618],[-5.81,-0.05,-1.655]]},{"outcome":"ok","dur":7.8,"pts":[[5.36,0.5,1.597],[5.37,0.82,1.535],[5.36,1.17,1.595],[5.37,1.56,1.541],[5.39,1.97,1.524],[5.42,2.28,1.47],[5.44,2.68,1.536],[5.52,3.24,1.423],[5.59,3.62,1.388],[5.66,4.01,1.392],[5.7,4.42,1.483],[5.72,4.76,1.494],[5.74,5.02,1.514],[5.75,5.25,1.492],[5.77,5.75,1.539],[5.74,6.24,1.631],[5.7,6.59,1.68],[5.64,7.03,1.713],[5.58,7.33,1.761],[5.52,7.71,1.726],[5.48,8.01,1.712],[5.46,8.55,1.611],[5.43,8.93,1.651],[5.39,9.19,1.71],[5.25,9.71,1.84],[5.09,10.11,1.94],[4.96,10.4,2.007],[4.82,10.65,2.073],[4.69,10.86,2.119],[4.35,11.28,2.247],[3.85,11.8,2.344],[3.46,12.13,2.442],[3.07,12.43,2.478],[2.78,12.63,2.546],[2.5,12.79,2.623],[2.12,12.99,2.657],[1.81,13.12,2.726],[1.31,13.27,2.851],[0.87,13.35,2.977],[0.36,13.36,3.116],[-0.3,13.31,-3.062],[-0.79,13.21,-2.939],[-1.15,13.1,-2.845],[-1.47,13.0,-2.833],[-1.99,12.76,-2.711],[-2.37,12.54,-2.617],[-2.9,12.2,-2.582],[-3.48,11.76,-2.486],[-3.95,11.31,-2.379],[-4.24,10.96,-2.263],[-4.47,10.64,-2.196],[-4.66,10.38,-2.199],[-4.88,10.02,-2.129],[-5.14,9.57,-2.088],[-5.32,9.2,-2.025],[-5.5,8.78,-1.958],[-5.67,8.17,-1.847],[-5.74,7.7,-1.731],[-5.77,7.34,-1.65],[-5.81,7.02,-1.687],[-5.82,6.58,-1.589],[-5.9,5.99,-1.707],[-5.92,5.57,-1.613],[-5.91,5.09,-1.556],[-5.91,4.64,-1.579],[-5.88,4.18,-1.5],[-5.86,3.85,-1.507],[-5.86,3.41,-1.568],[-5.82,3.01,-1.482],[-5.82,2.73,-1.549],[-5.82,2.4,-1.597],[-5.8,2.06,-1.512],[-5.8,1.81,-1.558],[-5.79,1.52,-1.52],[-5.78,1.29,-1.537],[-5.79,0.9,-1.596],[-5.77,0.48,-1.531],[-5.8,-0.0,-1.623]]}]}];

const fmt = (v: number, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace('.', ',');
const num = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

/** Rejoue, à tour de rôle, les trajectoires réellement conduites par la politique. */
const replay = (runs: RealRun[]): Driver => {
  let i = 0;
  return () => runs[i++ % runs.length];
};

// En mode présentation, un clic sur les bords de la slide change de page. open-slide ignore les clics
// sur les éléments marqués data-osd-interactive ou role="button" : nos contrôles utilisent l'un ou l'autre.

/** Curseur sans champ de saisie : il ne vole pas les flèches du clavier qui changent de slide. */
function Slider({ value, onChange, width, color, left, right, steps }: { value: number; onChange: (v: number) => void; width: number; color: string; left: string; right: string; steps?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const v = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(steps ? Math.round(v * (steps - 1)) / (steps - 1) : v);
  };
  return <div style={{ width }}>
    <div ref={ref} data-osd-interactive
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons) set(e.clientX); }}
      style={{ position: 'relative', height: 56, cursor: 'pointer', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 22, height: 12, borderRadius: 6, background: soft, translate: '1px 0px' }} />
      <div style={{ position: 'absolute', left: 0, width: `${value * 100}%`, top: 22, height: 12, borderRadius: 6, background: color, opacity: 0.5 }} />
      {steps && Array.from({ length: steps }, (_, i) => <div key={i} style={{ position: 'absolute', left: `calc(${(i / (steps - 1)) * 100}% - 6px)`, top: 22, width: 12, height: 12, borderRadius: '50%', background: color }} />)}
      <div style={{ position: 'absolute', left: `calc(${value * 100}% - 22px)`, top: 6, width: 44, height: 44, borderRadius: '50%', background: panel, border: `6px solid ${color}`, boxSizing: 'border-box' }} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: muted }}><span>{left}</span><span>{right}</span></div>
  </div>;
}

function Bell({ title, unit, mu, sigma, color, range }: { title: string; unit: (v: number) => string; mu: number; sigma: number; color: string; range: [number, number] }) {
  const W = 440, H = 150, base = H - 32;
  const X = (a: number) => 14 + ((a - range[0]) / (range[1] - range[0])) * (W - 28);
  const peak = Math.min(1, 0.1 / sigma);   // plus σ est petit, plus le pic est haut et étroit
  let d = '';
  for (let i = 0; i <= 200; i++) {
    const a = range[0] + (i / 200) * (range[1] - range[0]);
    const y = base - (base - 18) * peak * Math.exp(-((a - mu) ** 2) / (2 * sigma * sigma));
    d += `${d ? 'L' : 'M'}${X(a).toFixed(1)},${y.toFixed(1)}`;
  }
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 28, fontWeight: 800 }}>{title}</span>
      <span style={{ fontFamily: mono, fontSize: 23, color }}>μ = {unit(mu)} · σ = {unit(sigma).replace('+', '')}</span>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <path d={`${d}L${X(range[1])},${base}L${X(range[0])},${base}Z`} style={{ fill: color, fillOpacity: 0.15 }} />
      <path d={d} style={{ fill: 'none', stroke: color, strokeWidth: 4 }} />
      <line x1={X(mu)} y1={base} x2={X(mu)} y2={8} style={{ stroke: color, strokeWidth: 2.5, strokeDasharray: '6 6' }} />
      <text x={X(mu) + 8} y={22} style={{ fill: color, fontSize: 22, fontFamily: mono, fontWeight: 700 }}>μ</text>
      <line x1={X(range[0])} y1={base} x2={X(range[1])} y2={base} style={{ stroke: muted, strokeWidth: 2 }} />
      <text x={X(range[0])} y={H - 4} style={{ fill: muted, fontSize: 21, fontFamily: mono }}>{unit(range[0])}</text>
      <text x={X(range[1])} y={H - 4} textAnchor="end" style={{ fill: muted, fontSize: 21, fontFamily: mono }}>{unit(range[1])}</text>
    </svg>
  </div>;
}

function RealTrack({ idx, active }: { idx: number; active: boolean }) {
  const t = useClock(active);
  const driver = useMemo(() => replay(REAL_ALPHAS[idx].trajectories), [idx]);
  const { live } = useRuns(t, driver, 0.9, Infinity, 40);
  return <Track w={560} h={660} live={active ? live : REAL_ALPHAS[idx].trajectories.slice(0, 6).map((run, i) => ({ run, born: -1000 - i, obstacle: false }))} t={t} color={entropy} obstacle={false} still={!active} />;
}

const SacIdea: Page = () => {
  const active = useIsActivePage();
  const last = REAL_ALPHAS.length - 1;
  const [idx, setIdx] = useState(2);
  const A = REAL_ALPHAS[idx];
  const verdict = A.entropy < -3 ? 'Conduit presque toujours pareil' : A.entropy > 0 ? 'Zigzague et perd du temps' : 'Varie, et va vite';
  const vColor = A.entropy < -3 ? muted : A.entropy > 0 ? env : critic;
  return <Frame kicker="La solution" speaker={MATHIS} title="SAC : varier ses trajectoires est récompensé">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 560px', gap: 60, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Bubble who="Critique" color={critic}>Toujours la même trajectoire ? « Bof. »</Bubble>
        <Bubble who="Critique" color={critic}>Variées et sur la route ? « Mieux ! »</Bubble>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 800, marginTop: 4 }}>
          <span style={{ color: critic, border: `4px solid ${critic}`, borderRadius: 16, padding: '6px 22px', background: panel }}>Récompense</span>
          <span style={{ color: muted }}>+</span>
          <span style={{ color: entropy, border: `4px solid ${entropy}`, borderRadius: 16, padding: '6px 22px', background: panel }}>α × Entropie</span>
        </div>
        <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '14px 24px 6px' }}>
          <div style={{ ...label, fontSize: 21, marginBottom: 4 }}>À l’entrée du virage, l’acteur sort deux zones</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
            <Bell title="Volant" unit={(v) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 30)}°`} mu={A.steerMu} sigma={A.steerSigma} color={actorHex} range={[-1, 1]} />
            <Bell title="Pédale" unit={(v) => `${Math.abs(v).toFixed(2).replace('.', ',')}`} mu={A.pedalMu} sigma={A.pedalSigma} color={actorHex} range={[0, 1]} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: entropy, width: 190 }}>α = {A.alpha < 0.1 ? num(A.alpha, 3) : num(A.alpha, A.alpha < 1 ? 1 : 0)}</div>
          <Slider value={idx / last} onChange={(v) => setIdx(Math.round(v * last))} steps={REAL_ALPHAS.length} width={500} color={entropy} left="α petit" right="α grand" />
        </div>
        <div style={{ fontSize: 28 }}><strong>Entropie {fmt(A.entropy)}</strong> · <strong>tour en {A.lapTime === null ? '—' : num(A.lapTime)} s</strong> · <strong style={{ color: vColor }}>{verdict}</strong></div>
      </div>
      <RealTrack key={idx} idx={idx} active={active} />
    </div>
  </Frame>;
};

// =====================================================================
// 6. Comment SAC apprend (avec les vraies courbes d'un entraînement)
// =====================================================================

// Courbes MESURÉES : notre SAC (α appris) entraîné sur CETTE piste, 40 000 pas, échantillonnées tous les 1 000 pas.
const RUN_STEPS = 40_000;
const RUN_SUCCESS = [0, 0, 0, 0, 0, 0, 0, 16, 46, 76, 98, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 96, 94, 94, 96, 98, 98, 90, 86, 88, 96, 100, 100, 100, 100];
const RUN_ALPHA = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7544, 0.5755, 0.4418, 0.3313, 0.2523, 0.1891, 0.1418, 0.1067, 0.0806, 0.0621, 0.0486, 0.0389, 0.0322, 0.0279, 0.0238, 0.0217, 0.02, 0.0232, 0.0226, 0.0178, 0.0184, 0.0194, 0.0194, 0.0199, 0.0197, 0.0194, 0.0196, 0.0212, 0.0196, 0.0188, 0.0223, 0.023, 0.0232, 0.0254, 0.0241];
const RUN_ENTROPY: (number | null)[] = [null, null, null, null, null, null, 0.88, 0.45, 0.38, -0.13, 0.15, 0.15, -0.19, -0.32, -0.78, -0.66, -0.95, -1.16, -1.67, -1.49, -1.89, -1.8, -2.49, -2.16, -2.16, -2.35, -2.28, -2.26, -1.89, -2.0, -1.84, -2.1, -2.28, -2.04, -1.9, -1.65, -2.04, -1.87, -2.22, -2.31, -2.14];
const RANDOM_STEPS = 5_000;

function at(series: (number | null)[], u: number): number | null {
  const x = u * (series.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = series[i], b = series[Math.min(i + 1, series.length - 1)];
  if (a === null || b === null) return a ?? b;
  return a + (b - a) * f;
}

function MiniChart({ title, series, u, color, lo, hi, log, ticks, fmtTick, target }: {
  title: string; series: (number | null)[]; u: number; color: string; lo: number; hi: number; log?: boolean;
  ticks: number[]; fmtTick: (v: number) => string; target?: { v: number; label: string };
}) {
  const W = 504, H = 190, pad = { l: 64, r: 14, t: 14, b: 30 };
  const X = (x: number) => pad.l + x * (W - pad.l - pad.r);
  const T = (v: number) => (log ? Math.log10(v) : v);
  const Y = (v: number) => H - pad.b - ((T(v) - T(lo)) / (T(hi) - T(lo))) * (H - pad.t - pad.b);
  let d = '';
  const n = series.length - 1;
  for (let i = 0; i <= n; i++) {
    if (i / n > u) break;
    const v = series[i];
    if (v === null) continue;
    d += `${d ? 'L' : 'M'}${X(i / n).toFixed(1)},${Y(v).toFixed(1)}`;
  }
  const cur = at(series, u);
  return <div>
    <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{title} <span style={{ fontFamily: mono, color }}>{cur === null ? '—' : fmtTick(cur)}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', background: '#F7F9FA', borderRadius: 12 }}>
      {ticks.map((v) => <g key={v}>
        <line x1={pad.l} y1={Y(v)} x2={W - pad.r} y2={Y(v)} style={{ stroke: soft, strokeWidth: 2 }} />
        <text x={pad.l - 8} y={Y(v) + 7} textAnchor="end" style={{ fill: muted, fontSize: 19, fontFamily: mono }}>{fmtTick(v)}</text>
      </g>)}
      {target && <g>
        <line x1={pad.l} y1={Y(target.v)} x2={W - pad.r} y2={Y(target.v)} style={{ stroke: entropy, strokeWidth: 2, strokeDasharray: '7 6' }} />
        <text x={W - pad.r - 4} y={Y(target.v) - 8} textAnchor="end" style={{ fill: entropy, fontSize: 19, fontFamily: mono }}>{target.label}</text>
      </g>}
      <rect x={X(0)} y={pad.t} width={X(RANDOM_STEPS / RUN_STEPS) - X(0)} height={H - pad.t - pad.b} style={{ fill: muted, fillOpacity: 0.08 }} />
      <path d={d} style={{ fill: 'none', stroke: color, strokeWidth: 4, strokeLinejoin: 'round' }} />
      {cur !== null && <circle cx={X(u)} cy={Y(cur)} r={8} style={{ fill: color, stroke: panel, strokeWidth: 3 }} />}
      <text x={X(0)} y={H - 6} style={{ fill: muted, fontSize: 19, fontFamily: mono }}>0</text>
      <text x={X(1)} y={H - 6} textAnchor="end" style={{ fill: muted, fontSize: 19, fontFamily: mono }}>40 000 pas</text>
    </svg>
  </div>;
}

function LoopNode({ x, y, w, h, color, title, lines }: { x: number; y: number; w: number; h: number; color: string; title: string; lines: string[] }) {
  return <g>
    <rect x={x} y={y} width={w} height={h} rx={20} style={{ fill: panel, stroke: color, strokeWidth: 5 }} />
    <text x={x + w / 2} y={y + 56} textAnchor="middle" style={{ fill: color, fontSize: 32, fontWeight: 800 }}>{title}</text>
    {lines.map((l, i) => <text key={i} x={x + w / 2} y={y + 100 + i * 36} textAnchor="middle" style={{ fill: ink, fontSize: 25, fontFamily: mono }}>{l}</text>)}
  </g>;
}

// Le jeton qui fait le tour de la boucle : acteur → piste → carnet → critiques → retour à l'acteur
const LOOP_PATH: [number, number][] = [[320, 140], [466, 140], [766, 140], [912, 140], [1212, 140], [1358, 140], [1498, 140], [1498, 300], [160, 300], [160, 240]];
function alongPath(pts: [number, number][], u: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = u * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const f = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

const HowItLearns: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  // Bouton ▶ : l'entraînement se rejoue en 20 s, puis s'arrête sur le résultat
  const [run, setRun] = useState<{ from: number; at: number; playing: boolean }>({ from: 0, at: 0, playing: false });
  const live = run.playing ? Math.min(1, run.from + (t - run.at) / 20) : run.from;
  const u = active ? live : 1;
  const done = live >= 1;
  const toggle = () => setRun(done ? { from: 0, at: t, playing: true } : run.playing ? { from: live, at: t, playing: false } : { from: live, at: t, playing: true });
  const step = Math.round(u * RUN_STEPS);
  const alpha = at(RUN_ALPHA, u) ?? 1;
  const ent = at(RUN_ENTROPY, u);
  const [tx, ty] = alongPath(LOOP_PATH, active ? (t % 2.4) / 2.4 : 0.15);
  const phase = step < RANDOM_STEPS ? 'Actions au hasard pour remplir le carnet'
    : step < 20_000 ? 'α chute : l’acteur arrête de conduire au hasard'
      : 'L’entropie tient la cible −2, la réussite monte';
  const n = (v: number) => v.toLocaleString('fr-FR');
  return <Frame kicker="La solution · fonctionnement" speaker={MATHIS} title="Comment SAC apprend">
    <svg viewBox="0 0 1640 330" width={1640} height={330} style={{ display: 'block' }}>
      <defs>
        <marker id="h-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: muted }} /></marker>
      </defs>
      <path d="M320,140 L462,140" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
      <text x={391} y={122} textAnchor="middle" style={{ fill: ink, fontSize: 28, fontFamily: mono, fontWeight: 700 }}>a</text>
      <path d="M766,140 L908,140" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
      <text x={837} y={122} textAnchor="middle" style={{ fill: ink, fontSize: 24, fontFamily: mono, fontWeight: 700 }}>s,a,r,s′</text>
      <path d="M1212,140 L1354,140" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
      <text x={1283} y={122} textAnchor="middle" style={{ fill: ink, fontSize: 24, fontFamily: mono, fontWeight: 700 }}>256</text>
      <path d="M1498,240 L1498,300 L160,300 L160,244" style={{ fill: 'none', stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
      <text x={1180} y={290} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>« plutôt par là » (gradient)</text>
      <LoopNode x={0} y={40} w={320} h={200} color={actor} title="Acteur π" lines={['volant : μ, σ', 'pédale : μ, σ']} />
      <LoopNode x={466} y={40} w={300} h={200} color={env} title="Environnement" lines={['la piste', 'renvoie r et s′']} />
      <LoopNode x={912} y={40} w={300} h={200} color={ink} title="Replay buffer" lines={['capacité : 10⁶', `rempli : ${n(Math.min(step, 1_000_000))}`]} />
      <LoopNode x={1358} y={40} w={282} h={200} color={critic} title="2 critiques" lines={['Q₁, Q₂', 'note = min']} />
      <g>
        <rect x={430} y={276} width={430} height={48} rx={24} style={{ fill: entropy }} />
        <text x={645} y={309} textAnchor="middle" style={{ fill: '#FFFFFF', fontSize: 26, fontWeight: 800, fontFamily: mono }}>α = {alpha.toFixed(3).replace('.', ',')}</text>
      </g>
      <circle cx={tx} cy={ty} r={13} style={{ fill: entropy, stroke: panel, strokeWidth: 4 }} />
    </svg>
    <div style={{ marginTop: 18, background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '18px 28px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div role="button" tabIndex={0} aria-label={done ? 'Rejouer' : run.playing ? 'Pause' : 'Lancer'} onClick={toggle}
          style={{ flex: 'none', width: 56, height: 56, borderRadius: '50%', background: actorHex, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 24, cursor: 'pointer' }}>
          {done ? '↺' : run.playing ? '❚❚' : '▶'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 28, fontWeight: 800 }}>Exemple d’entraînement <span style={{ fontFamily: mono, color: actor, fontWeight: 700 }}>· {n(step)} pas</span></span>
          {step > 0 && <span style={{ fontSize: 24, color: muted }}>{phase}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
        <MiniChart title="Réussite" series={RUN_SUCCESS} u={u} color={critic} lo={0} hi={100} ticks={[0, 50, 100]} fmtTick={(v) => `${Math.round(v)} %`} />
        <MiniChart title="α" series={RUN_ALPHA} u={u} color={entropy} lo={0.01} hi={1.2} log ticks={[0.01, 0.1, 1]} fmtTick={(v) => v.toFixed(v < 0.1 ? 2 : 1).replace('.', ',')} />
        <MiniChart title="Entropie" series={RUN_ENTROPY} u={u} color={actorHex} lo={-3} hi={2} ticks={[-3, -2, 0, 2]} fmtTick={(v) => fmt(v)} target={{ v: -2, label: 'cible' }} />
      </div>
      <div style={{ fontSize: 20, color: muted, fontFamily: mono }}>Mesuré sur notre propre SAC, entraîné sur cette piste avec la voiture (volant + pédale).</div>
    </div>
  </Frame>;
};

// =====================================================================
// 7. Les réglages
// =====================================================================

function Knob({ value, name, role, effect, fresh }: { value: string; name: string; role: string; effect: string; fresh?: boolean }) {
  return <div style={{ background: panel, border: `2px solid ${fresh ? entropy : rule}`, borderRadius: 'var(--osd-radius)', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
    {fresh && <span style={{ position: 'absolute', top: 20, right: 24, fontFamily: mono, fontSize: 20, letterSpacing: 2, color: '#FFFFFF', background: entropy, borderRadius: 999, padding: '4px 14px' }}>NOUVEAU</span>}
    <span style={{ fontFamily: mono, fontSize: 54, fontWeight: 700, color: fresh ? entropy : actor, lineHeight: 1.1 }}>{value}</span>
    <span style={{ fontSize: 32, fontWeight: 800 }}>{name}</span>
    <span style={{ fontSize: 26, color: muted }}>{role}</span>
    <span style={{ fontSize: 24, color: ink, marginTop: 8, paddingTop: 10, borderTop: `2px solid ${soft}` }}>↑ {effect}</span>
  </div>;
}

const Settings: Page = () => <Frame kicker="Hyperparamètres" speaker={MATHIS} title="Six réglages, valeurs par défaut">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
    <Knob value="0,99" name="γ · actualisation" role="poids des récompenses futures" effect="vise plus loin, apprend plus lentement" />
    <Knob value="3·10⁻⁴" name="Taux d’apprentissage" role="taille des pas de gradient" effect="plus rapide, mais instable" />
    <Knob value="10⁶" name="Replay buffer" role="moments gardés en mémoire" effect="données plus variées, plus de mémoire" />
    <Knob value="256" name="Batch" role="moments révisés à chaque pas" effect="gradient plus stable, plus de calcul" />
    <Knob value="0,005" name="τ · réseaux cibles" role="vitesse de suivi des critiques" effect="cibles qui bougent vite, moins stable" />
    <Knob value="−2" name="Entropie cible" role="−(nb d’actions) : volant + pédale" effect="plus d’exploration (α suit seul)" fresh />
  </div>
  <Punchline color={actor}>Les valeurs de l’article marchent dans la plupart des cas</Punchline>
</Frame>;

// =====================================================================
// 8. La démo : une voiture en panne dans le virage
// =====================================================================

const OBSTACLE_AT = 8;   // secondes avant l'apparition de la voiture en panne

function Lane({ name, color, driver, seed, t, active }: { name: string; color: string; driver: Driver; seed: number; t: number; active: boolean }) {
  const { live, done } = useRuns(t, driver, 1.25, OBSTACLE_AT, seed);
  const before = rate(done.filter((r) => !r.obstacle));
  const after = rate(done.filter((r) => r.obstacle));
  const obstacle = !active || t >= OBSTACLE_AT;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
    <div style={{ fontSize: 34, fontWeight: 800, color }}>{name}</div>
    <Track w={500} h={440} live={active ? live : stillRuns(driver, 4, true, seed)} t={t} color={color} obstacle={obstacle} still={!active} />
    <div style={{ display: 'flex', gap: 44 }}>
      <Stat value={active && before !== null ? `${before} %` : '–'} label="arrivées, route libre" color={ink} />
      <Stat value={active && after !== null ? `${after} %` : '–'} label="avec la panne" color={color} />
    </div>
  </div>;
}

function DemoLanes({ active, onReplay }: { active: boolean; onReplay: () => void }) {
  const t = useClock(active);
  const obstacle = !active || t >= OBSTACLE_AT;
  return <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: -10, marginBottom: 20 }}>
      <span style={{ fontSize: 30, fontWeight: 800, color: obstacle ? env : muted }}>{obstacle ? '⚠️ Une voiture en panne à la corde du virage' : `Route libre… une voiture tombe en panne dans ${Math.max(0, Math.ceil(OBSTACLE_AT - t))} s`}</span>
      <div role="button" tabIndex={0} onClick={onReplay} style={{ marginLeft: 'auto', font: 'inherit', fontSize: 24, color: ink, border: `2px solid ${rule}`, background: panel, borderRadius: 12, padding: '8px 18px', cursor: 'pointer' }}>↺ Rejouer</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 50 }}>
      <Lane name="DQN (5 crans)" color={muted} driver={dqn} seed={21} t={t} active={active} />
      <Lane name="Acteur déterministe" color={env} driver={deterministic} seed={22} t={t} active={active} />
      <Lane name="SAC" color={actorHex} driver={sac} seed={23} t={t} active={active} />
    </div>
  </>;
}

const Demo: Page = () => {
  const active = useIsActivePage();
  const [epoch, setEpoch] = useState(0);
  return <Frame kicker="La preuve · démo" speaker={QUENTIN} title="Imprévu : une voiture en panne dans le virage">
    <DemoLanes key={epoch} active={active} onReplay={() => setEpoch((e) => e + 1)} />
  </Frame>;
};

// =====================================================================
// 9. Dans la vraie vie
// =====================================================================

function Quadruped() {
  return <g>
    <path d="M-62,-6 L-80,26 L-64,58 M62,-6 L84,26 L70,58" style={{ fill: 'none', stroke: ink, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M-30,-6 L-14,26 L-30,58 M30,-6 L12,26 L30,58" style={{ fill: 'none', stroke: muted, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <rect x={-90} y={-34} width={180} height={36} rx={12} style={{ fill: actorHex }} />
  </g>;
}

function RealCard({ value, color, title, detail, children }: { value: string; color: string; title: string; detail: string; children: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderTop: `10px solid ${color}`, borderRadius: 'var(--osd-radius)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontFamily: 'var(--osd-font-display)', fontSize: 110, fontWeight: 800, lineHeight: 1, color, letterSpacing: -4 }}>{value}</span>
    <span style={{ fontSize: 38, fontWeight: 800 }}>{title}</span>
    <span style={{ fontSize: 28, color: muted }}>{detail}</span>
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `2px solid ${soft}` }}>{children}</div>
  </div>;
}

const RealLife: Page = () => <Frame kicker="La preuve · Berkeley & Google, 2018" speaker={QUENTIN} title="Pareil sur un vrai robot : Minitaur">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 40 }}>
    <RealCard value="2 h" color={actor} title="Apprendre à marcher" detail="sur le vrai robot, sol plat">
      <svg viewBox="0 0 740 190" width={740} height={190}>
        <line x1={20} y1={170} x2={720} y2={170} style={{ stroke: ink, strokeWidth: 4 }} />
        <g transform="translate(380,118) scale(0.88)"><Quadruped /></g>
      </svg>
    </RealCard>
    <RealCard value="+0 h" color={entropy} title="Pente et obstacles" detail="jamais vus, sans réentraînement">
      <svg viewBox="0 0 740 190" width={740} height={190}>
        <path d="M20,182 L720,88" style={{ stroke: ink, strokeWidth: 4 }} />
        <rect x={520} y={92} width={40} height={28} rx={4} transform="rotate(-7.6 540 115)" style={{ fill: muted }} />
        <rect x={140} y={146} width={34} height={24} rx={4} transform="rotate(-7.6 157 166)" style={{ fill: muted }} />
        <g transform="translate(350,86) rotate(-7.6) scale(0.88)"><Quadruped /></g>
      </svg>
    </RealCard>
  </div>
  <Punchline color={entropy}>Comme la voiture : avoir appris plusieurs façons de faire le sauve</Punchline>
</Frame>;

// =====================================================================
// 10. Quand l'utiliser · à retenir
// =====================================================================

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', alignItems: 'baseline', fontSize: 33, fontWeight: 600, lineHeight: 1.3 }}>
    <span style={{ fontWeight: 800, fontSize: 38, color: ok ? critic : env }}>{ok ? '✓' : '✗'}</span>
    <span>{children}</span>
  </div>;
}

function Recap({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 26, alignItems: 'center' }}>
    <div style={{ background: color, borderRadius: 7, height: 56 }} />
    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.25 }}>{children}</div>
  </div>;
}

const WhenAndRecap: Page = () => <Frame kicker="Quand l’utiliser · à retenir" speaker={QUENTIN} title="SAC, c’est pour qui ?">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 90 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Check ok>Actions continues : robot, voiture, énergie</Check>
      <Check ok>Chaque essai coûte cher : il réutilise tout</Check>
      <Check ok>Le monde peut changer : il reste robuste</Check>
      <div style={{ height: 6 }} />
      <Check ok={false}>Peu d’actions discrètes : un DQN suffit</Check>
      <Check ok={false}>Simulateur ultra rapide : PPO va plus vite</Check>
      <Check ok={false}>Vrai robot : explorer peut casser du matériel</Check>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <Recap color={actor}>Un acteur qui propose une zone d’actions</Recap>
      <Recap color={critic}>Deux critiques, on garde la note la plus basse</Recap>
      <Recap color={entropy}>Un bonus d’entropie pour garder plusieurs solutions</Recap>
    </div>
  </div>
  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 60, paddingTop: 26, borderTop: `2px solid ${rule}` }}>
    <div style={{ fontSize: 21, color: muted, lineHeight: 1.6, fontFamily: mono }}>
      Haarnoja et al., ICML 2018 · bair.berkeley.edu/blog/2018/12/14/sac<br />
      Vidéo d’inspiration : Y. Bouteiller, « SAC: a beginner-friendly introduction »
    </div>
    <div style={{ fontFamily: 'var(--osd-font-display)', fontSize: 76, fontWeight: 800, color: actor, lineHeight: 1, whiteSpace: 'nowrap' }}>Questions ?</div>
  </div>
</Frame>;

export const meta: SlideMeta = {
  title: 'Soft Actor-Critic · le virage',
  createdAt: '2026-11-15T18:45:33.827Z',
};

// Notes orales, une par page. Total visé : environ 8 min 30.
// Hugo : pages 1 à 4 (~3 min) · Mathis : pages 5 à 7 (~3 min 15) · Quentin : pages 8 à 10 (~2 min 45).
export const notes: (string | undefined)[] = [
  `Pour présenter Soft Actor-Critic, ou SAC, on va prendre un exemple : une voiture qui apprend à prendre un virage.
L’objectif est de réussir le virage, tout en continuant à essayer différentes façons de le prendre.
Je vais commencer par expliquer le problème. Mathis présentera ensuite la solution SAC, puis Quentin terminera avec une illustration et des applications réelles.`,
  `Au départ, notre voiture ne sait pas conduire. Elle tourne le volant un peu au hasard, et elle finit dans l'herbe.
Pour apprendre, elle reçoit trois types d’informations.
L’état décrit la situation actuelle : sa position, sa vitesse et sa distance aux bords de la route.
L’action correspond à ce qu’elle commande : l’angle du volant et l’appui sur l’accélérateur.
Enfin, la récompense lui indique si elle progresse : positive lorsqu’elle avance, négative lorsqu’elle sort de la route.
Le point important, c’est que le volant et l’accélérateur peuvent prendre des valeurs continues. Il existe donc une infinité de combinaisons possibles.`,
  `Avec DQN, le réseau attribue une note à chaque action d’une liste prédéfinie. Cette note estime ce que l’action peut rapporter à long terme. Il choisit généralement celle qui a la meilleure note.
Dans notre exemple, on limite donc le volant à cinq positions. Mais si la bonne commande est de tourner de 12,4 degrés, elle n’est pas disponible exactement. Cela peut rendre la conduite moins précise, comme l’illustre la voiture à droite.
On pourrait ajouter davantage de positions. Mais avec cent positions de volant et cent positions d’accélérateur, on obtient déjà dix mille combinaisons à évaluer.
Avec sept moteurs ayant chacun cent commandes possibles, on arrive à cent puissance sept : le nombre de combinaisons devient énorme.
Enfin, DQN explore généralement avec epsilon-greedy : de temps en temps, il choisit une action au hasard, sans favoriser celles qu’il estime intéressantes.`,
  `La solution classique, c'est l'acteur-critique. C'est comme à l'auto-école.
L'acteur, c'est l'élève qui tient le volant : un réseau de neurones qui sort directement l'angle du volant.
Le critique, c'est le moniteur : un autre réseau qui note ce que fait l'élève. C'est notre fonction Q.
L'élève progresse : π1 sort de la route, π2 est mieux, π3 prend le virage à la corde. Et là, il ne change plus jamais de trajectoire. C'est un optimum local : il ne connaît qu'une seule façon de prendre le virage. C'est ce que font certains algos.
Le jour où quelque chose change sur la route, il n'a pas de plan B. Mathis va vous montrer comment SAC règle ça.`,
  `MATHIS · ≈ 1:05
Hugo vient de montrer le problème : l'acteur ne connaît qu'une seule trajectoire. SAC change ce que le moniteur récompense. Toujours la même trajectoire ? « Bof. » Des trajectoires variées qui restent sur la route ? « Mieux ! »
Concrètement, l'agent maximise la récompense, plus α fois l'entropie. L'entropie mesure à quel point ses actions sont variées.
Pour pouvoir varier, l'acteur ne sort plus une action précise mais deux zones, deux courbes en cloche : une pour le volant, une pour la pédale. Chacune a une moyenne μ, l'action visée, et un écart-type σ, la marge de variation. À chaque instant, il tire son action dedans. Plus σ est grand, plus l'entropie est forte. Résultat, à droite : des trajectoires différentes, qui restent sur la route.
α dose cette variété. Tous les chiffres de cette slide sont réels : on a entraîné notre voiture sur cette piste cinq fois, avec cinq valeurs de α fixées à la main. [Glisser tout à gauche] Avec α = 0,003, le volant ne varie que de 1 degré : la voiture conduit presque toujours pareil, et elle met 5,7 secondes. [Glisser tout à droite] Avec α = 1, le volant varie de 13 degrés : elle zigzague et met 7,6 secondes. [Revenir au milieu] Entre les deux, elle est la plus rapide, autour de 4,5 secondes.
Dans le vrai SAC, on ne choisit pas α à la main : on fixe une entropie cible, −2, et α s'ajuste tout seul. Sur notre entraînement, il finit à 0,024, justement dans la zone la plus rapide. On le voit sur la slide suivante.
(Si on vous pose la question : il n'y a qu'un entraînement par valeur de α, donc l'ordre exact entre les valeurs du milieu peut varier d'un essai à l'autre. Toutes les voitures finissent le virage : cette piste est assez simple, ce qui change, c'est surtout la vitesse.)`,
  `MATHIS · ≈ 1:10
Comment ça apprend ? C'est une boucle, le petit point orange en fait le tour.
L'acteur choisit une action. L'environnement, la piste, renvoie une récompense et le nouvel état. On range tout ça dans le replay buffer, qui a une capacité d'un million de moments ; sur ce petit entraînement, il n'en contient que 40 000 à la fin. Comme pour le DQN, on y tire 256 moments au hasard : chaque essai sert plusieurs fois, c'est ce qu'on appelle off-policy.
Les deux critiques notent ces moments, et on garde toujours la note la plus basse, pour que l'acteur ne fonce pas sur une erreur trop optimiste. Puis l'acteur se corrige dans la direction que lui indiquent les critiques.
En bas, ce sont les vraies courbes de notre SAC, entraîné sur cette même piste avec la voiture. [Cliquer sur ▶] Les 5 000 premiers pas, elle agit au hasard pour remplir le carnet. Ensuite α chute de 1 à environ 0,02 : l'acteur arrête de conduire au hasard. L'entropie descend et se stabilise autour de la cible −2. Et dès 10 000 pas, la voiture arrive au bout presque à chaque fois.`,
  `MATHIS · ≈ 1:00
Côté hyperparamètres, on garde presque toujours les valeurs de l'article : elles marchent sur la plupart des problèmes. Sous chaque réglage, la flèche indique ce qui se passe si on l'augmente.
γ, le facteur d'actualisation, à 0,99 : c'est le même que dans le Q-learning du cours. Il dit combien les récompenses futures comptent. Proche de 1, l'agent pense à long terme, mais apprend plus lentement.
Le taux d'apprentissage, 3 fois 10 puissance moins 4 : la taille des pas de gradient pour les réseaux. Trop grand, l'apprentissage devient instable ; trop petit, il est très lent.
Le replay buffer garde un million de moments, et à chaque pas on en révise un batch de 256. Plus de mémoire donne des données plus variées ; un plus gros batch donne un gradient plus stable, mais coûte plus de calcul.
τ, à 0,005, concerne les réseaux cibles. Les critiques apprennent à viser une cible qu'ils calculent avec des critiques : si on utilisait ceux qu'on est en train d'entraîner, la cible bougerait à chaque pas. On utilise donc des copies lentes, qu'on rapproche de 0,5 % des vrais critiques à chaque pas. Le DQN du cours fait la même chose, mais en recopiant d'un coup tous les C pas.
Enfin, le seul vraiment nouveau : l'entropie cible, qui vaut moins le nombre d'actions, ici −2 pour le volant et la pédale. α s'ajuste tout seul pour la tenir. Dans la première version de SAC, α était fixé à la main et c'était très sensible : c'est pour ça qu'on l'apprend maintenant.
Quentin va vous montrer ce que tout ça change en pratique.`,
  `QUENTIN · ≈ 1:00
Petite démo. Trois voitures font le virage en boucle : à gauche le DQN avec son volant à 5 crans, au milieu l'acteur déterministe qui a appris une seule trajectoire, à droite SAC. En dessous, le pourcentage de voitures qui arrivent au bout.
Pour l'instant, la route est libre : tout le monde arrive au bout, même si le DQN zigzague avec son volant à 5 crans.
Et là, une voiture tombe en panne à la corde du virage. L'acteur déterministe ne connaît que cette trajectoire : il la percute à chaque fois. Le DQN, avec ses zigzags, ne sait pas l'éviter finement non plus. SAC, lui, connaît d'autres trajectoires : il passe à côté.
C'est tout l'intérêt de l'entropie : garder plusieurs solutions sous le coude.
(La démo est une simulation illustrative : les trois comportements sont programmés pour montrer ce que fait typiquement chaque méthode, pas entraînés en direct.)`,
  `QUENTIN · ≈ 0:45
Ce n'est pas qu'une histoire de simulation. Berkeley et Google ont entraîné un robot à quatre pattes, Minitaur, avec SAC. Il a appris à marcher en deux heures, directement sur le vrai robot.
Il n'a été entraîné que sur sol plat. Pourtant, il marche ensuite sur des pentes et passe des obstacles qu'il n'a jamais vus, sans réentraînement. Les auteurs l'expliquent par l'entropie : comme notre voiture, il a appris plusieurs façons de faire.`,
  `QUENTIN · ≈ 0:45
Alors, quand utiliser SAC ? Quand les actions sont continues, comme un robot, une voiture ou une installation d'énergie. Quand chaque essai coûte cher, parce qu'il réutilise ses données. Et quand le monde peut changer.
Par contre, avec quelques actions discrètes, un DQN suffit. Avec un simulateur très rapide qu'on lance en parallèle, PPO va souvent plus vite. Et sur un vrai robot, explorer veut dire tester des gestes risqués : il faut des garde-fous.
À retenir : un acteur qui propose une zone d'actions, deux critiques dont on garde la note la plus basse, et un bonus d'entropie qui garde plusieurs solutions.
Merci, vous avez des questions ?`,
];

export default [Cover, Challenge, DqnPage, LocalOptimum, SacIdea, HowItLearns, Settings, Demo, RealLife, WhenAndRecap] satisfies Page[];
