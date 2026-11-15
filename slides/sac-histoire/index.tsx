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
    const loop = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(loop); };
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
// 5. L'idée de SAC
// =====================================================================

function SteerBell() {
  const W = 640, H = 150;
  const X = (a: number) => 20 + ((a + 30) / 60) * (W - 40);
  let d = '';
  for (let a = -30; a <= 30; a += 0.5) {
    const y = H - 30 - 100 * Math.exp(-((a - 6) ** 2) / (2 * 8 ** 2));
    d += `${d ? 'L' : 'M'}${X(a).toFixed(1)},${y.toFixed(1)}`;
  }
  return <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
    <path d={`${d}L${X(30)},${H - 30}L${X(-30)},${H - 30}Z`} style={{ fill: actorHex, fillOpacity: 0.15 }} />
    <path d={d} style={{ fill: 'none', stroke: actorHex, strokeWidth: 4 }} />
    <line x1={X(-30)} y1={H - 30} x2={X(30)} y2={H - 30} style={{ stroke: muted, strokeWidth: 2 }} />
    <line x1={X(6)} y1={H - 30} x2={X(6)} y2={18} style={{ stroke: actorHex, strokeWidth: 2, strokeDasharray: '6 6' }} />
    <text x={X(6) + 10} y={30} style={{ fill: actorHex, fontSize: 24, fontFamily: mono }}>μ</text>
    <text x={X(-30)} y={H - 4} style={{ fill: muted, fontSize: 22, fontFamily: mono }}>−30°</text>
    <text x={X(0)} y={H - 4} textAnchor="middle" style={{ fill: muted, fontSize: 22, fontFamily: mono }}>volant</text>
    <text x={X(30)} y={H - 4} textAnchor="end" style={{ fill: muted, fontSize: 22, fontFamily: mono }}>+30°</text>
  </svg>;
}

const SacIdea: Page = () => {
  const active = useIsActivePage();
  const t = useClock(active);
  const { live } = useRuns(t, sac, 0.8, Infinity, 17);
  return <Frame kicker="La solution" speaker={MATHIS} title="SAC : varier ses trajectoires est récompensé">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 600px', gap: 70, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Bubble who="Critique" color={critic}>Toujours la même ? « Bof. »</Bubble>
        <Bubble who="Critique" color={critic}>Variées et sur la route ? « Mieux ! »</Bubble>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, fontSize: 38, fontWeight: 800 }}>
          <span style={{ color: critic, border: `4px solid ${critic}`, borderRadius: 16, padding: '8px 22px', background: panel }}>Récompense</span>
          <span style={{ color: muted }}>+</span>
          <span style={{ color: entropy, border: `4px solid ${entropy}`, borderRadius: 16, padding: '8px 22px', background: panel }}>α × Entropie</span>
        </div>
        <div style={{ fontSize: 28, color: muted, marginTop: 6 }}>L’acteur sort une <strong style={{ color: actor }}>zone de braquages</strong> (μ, σ) et tire dedans :</div>
        <SteerBell />
      </div>
      <Track w={600} h={660} live={active ? live : stillRuns(sac, 8, false, 17)} t={t} color={entropy} obstacle={false} still={!active} />
    </div>
  </Frame>;
};

// =====================================================================
// 6. Comment SAC apprend
// =====================================================================

function Node({ x, y, w, h, color, title, sub }: { x: number; y: number; w: number; h: number; color: string; title: string; sub: string }) {
  return <g>
    <rect x={x} y={y} width={w} height={h} rx={20} style={{ fill: panel, stroke: color, strokeWidth: 5 }} />
    <text x={x + w / 2} y={y + h / 2 - 6} textAnchor="middle" style={{ fill: color, fontSize: 38, fontWeight: 800 }}>{title}</text>
    <text x={x + w / 2} y={y + h / 2 + 34} textAnchor="middle" style={{ fill: muted, fontSize: 26 }}>{sub}</text>
  </g>;
}

const HowItLearns: Page = () => <Frame kicker="La solution · fonctionnement" speaker={MATHIS} title="Comment SAC apprend">
  <svg viewBox="0 0 1640 520" width={1640} height={520} style={{ display: 'block' }}>
    <defs>
      <marker id="h-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: muted }} /></marker>
    </defs>
    <path d="M440,110 L600,110" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
    <text x={520} y={92} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>agit</text>
    <path d="M1000,110 L1160,110" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
    <text x={1080} y={92} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>note</text>
    <path d="M1360,200 L1360,300" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
    <text x={1380} y={258} style={{ fill: muted, fontSize: 24 }}>256 au hasard</text>
    <path d="M1160,390 L640,390" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
    <text x={900} y={372} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>« plutôt par là »</text>
    <path d="M240,300 L240,200" style={{ stroke: muted, strokeWidth: 4 }} markerEnd="url(#h-ah)" />
    <Node x={40} y={20} w={400} h={180} color={actor} title="Acteur" sub="zone de braquages (μ, σ)" />
    <Node x={600} y={20} w={400} h={180} color={env} title="Conduire" sub="+ avance, − sort de la route" />
    <Node x={1160} y={20} w={400} h={180} color={ink} title="Carnet" sub="replay buffer · 10⁶ moments" />
    <Node x={1160} y={300} w={400} h={180} color={critic} title="2 critiques" sub="on garde la note la + basse" />
    <Node x={40} y={300} w={600} h={180} color={entropy} title="α, le thermostat" sub="trop sûr de lui → α monte" />
  </svg>
  <div style={{ marginTop: 'auto', background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '22px 30px', display: 'flex', gap: 30, alignItems: 'baseline' }}>
    <span style={{ ...label, flex: 'none' }}>Cible des critiques</span>
    <span style={{ fontFamily: '"STIX Two Text", "Cambria Math", Georgia, serif', fontSize: 38, fontStyle: 'italic' }}>
      y = r + γ · ( <span style={{ color: critic }}>min(Q̄₁, Q̄₂)</span>(s′, a′) <span style={{ color: entropy }}>− α log π(a′ | s′)</span> )
    </span>
  </div>
</Frame>;

// =====================================================================
// 7. Les réglages
// =====================================================================

function Knob({ value, name, role, fresh }: { value: string; name: string; role: string; fresh?: boolean }) {
  return <div style={{ background: panel, border: `2px solid ${fresh ? entropy : rule}`, borderRadius: 'var(--osd-radius)', padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
    {fresh && <span style={{ position: 'absolute', top: 20, right: 24, fontFamily: mono, fontSize: 20, letterSpacing: 2, color: '#FFFFFF', background: entropy, borderRadius: 999, padding: '4px 14px' }}>NOUVEAU</span>}
    <span style={{ fontFamily: mono, fontSize: 58, fontWeight: 700, color: fresh ? entropy : actor, lineHeight: 1.1 }}>{value}</span>
    <span style={{ fontSize: 33, fontWeight: 800 }}>{name}</span>
    <span style={{ fontSize: 27, color: muted }}>{role}</span>
  </div>;
}

const Settings: Page = () => <Frame kicker="Hyperparamètres" speaker={MATHIS} title="Six réglages, valeurs par défaut">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
    <Knob value="0,99" name="γ · actualisation" role="poids des récompenses futures" />
    <Knob value="3·10⁻⁴" name="Taux d’apprentissage" role="taille des pas de correction" />
    <Knob value="10⁶" name="Replay buffer" role="taille du carnet de conduite" />
    <Knob value="256" name="Batch" role="moments révisés à chaque pas" />
    <Knob value="0,005" name="τ · réseaux cibles" role="ils suivent les critiques à 0,5 %" />
    <Knob value="−2" name="Entropie cible" role="−(nb d’actions) : volant + pédale" fresh />
  </div>
  <Punchline color={entropy}>α s’ajuste seul pour tenir l’entropie cible</Punchline>
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
      <button onClick={onReplay} style={{ marginLeft: 'auto', font: 'inherit', fontSize: 24, color: ink, border: `2px solid ${rule}`, background: panel, borderRadius: 12, padding: '8px 18px', cursor: 'pointer' }}>↺ Rejouer</button>
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
// Hugo : pages 1 à 4 (~3 min) · Mathis : pages 5 à 7 (~2 min 45) · Quentin : pages 8 à 10 (~2 min 45).
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
  `MATHIS · ≈ 1:00
L'idée de SAC, c'est de changer ce que le moniteur récompense. Si l'élève prend toujours exactement la même trajectoire, le moniteur dit « bof ». S'il prend des trajectoires variées tout en restant sur la route, il dit « mieux ».
Concrètement, l'objectif devient la récompense plus α fois l'entropie. L'entropie mesure à quel point l'agent varie ses actions.
Du coup, l'acteur ne sort plus un seul angle de volant, mais une zone : une gaussienne, avec une moyenne μ et un écart-type σ. À chaque instant, il tire son coup de volant dans cette zone.
C'est ce qu'on voit à droite : des trajectoires toutes différentes, mais qui restent sur la route. Il explore autour de ce qui marche, pas n'importe où comme ε-greedy.`,
  `MATHIS · ≈ 1:00
Comment ça apprend concrètement ? C'est une boucle.
L'acteur conduit. Tout ce qui se passe est noté dans un carnet, le replay buffer, qui garde jusqu'à un million de moments. Comme dans le DQN, on y pioche 256 moments au hasard pour apprendre : chaque essai sert plusieurs fois, c'est ce qu'on appelle off-policy.
Avec ces moments, on entraîne deux critiques, deux moniteurs. On garde toujours la note la plus basse : un critique se trompe parfois vers le haut, et l'acteur foncerait sur ces erreurs.
La cible des critiques, en bas, c'est l'équation de Bellman du cours : récompense plus γ fois la valeur de la suite. Deux différences : le min des deux critiques, et le bonus d'entropie, moins α log π.
Enfin, α est un thermostat : si l'acteur devient trop sûr de lui, α monte et l'oblige à varier ; s'il s'éparpille, α baisse.`,
  `MATHIS · ≈ 0:45
Côté hyperparamètres, on garde presque toujours les valeurs de l'article, et elles marchent bien.
γ à 0,99 : le poids du futur, comme en Q-learning. Un taux d'apprentissage de 3 fois 10 puissance moins 4. Un replay buffer d'un million de moments et des batchs de 256.
τ à 0,005 : les réseaux cibles suivent les critiques doucement, au lieu d'être recopiés tous les C pas comme dans le DQN.
Le seul vraiment nouveau, c'est l'entropie cible : par défaut, moins le nombre de dimensions de l'action. Ici, le volant et la pédale, donc moins 2. α s'ajuste tout seul pour tenir cette cible. Dans la première version de SAC, α était fixé à la main et c'était très sensible : c'est pour ça qu'on l'apprend maintenant.
Quentin va vous montrer ce que ça change en pratique.`,
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
