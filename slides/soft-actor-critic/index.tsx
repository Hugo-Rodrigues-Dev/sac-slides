import { Step, Steps, useSlidePageNumber, type DesignSystem, type Page, type SlideMeta, type SlideTransition } from '@open-slide/core';
import type { CSSProperties, ReactNode } from 'react';

// Fond clair pour la lisibilité au vidéoprojecteur.
// Chaque rôle garde sa couleur sur tout le deck :
// indigo = acteur / politique, sarcelle = critiques, ambre = entropie et α, framboise = environnement.
export const design: DesignSystem = {
  palette: { bg: '#F3F5F7', text: '#121A22', accent: '#4A47CF' },
  fonts: {
    display: '"Avenir Next", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
    body: '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
  },
  typeScale: { hero: 156, body: 36 },
  radius: 18,
};

const text = 'var(--osd-text)';
const actor = 'var(--osd-accent)';
const critic = '#0A7A6A';
const entropy = '#C2620A';
const env = '#A13D60';
const muted = '#5A6672';
const rule = '#D3DAE0';
const panel = '#FFFFFF';
const soft = '#E6EAEE';
const mono = '"Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

const EASE_OUT = 'cubic-bezier(0, 0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const HOLD: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }];
export const transition: SlideTransition = {
  duration: 260,
  exit: { duration: 260, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 260, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }] },
};

// ---------- Outils de dessin ----------

const gauss = (x: number, m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s * s));
// Évaluation jouet d'un critique : deux zones d'actions intéressantes, l'une un peu meilleure.
const qToy = (x: number) => 1.0 * gauss(x, 0.5, 0.13) + 0.8 * gauss(x, -0.45, 0.18) + 0.08;
// Politique « idéale » de SAC pour une température α : π(a) ∝ exp(Q(a) / α).
const boltzmann = (alpha: number) => (x: number) => Math.exp((qToy(x) - 1.1) / alpha);

/** Chemin SVG d'une courbe sur l'axe des actions [-1, 1], normalisée à la hauteur du cadre. */
function curvePath(fn: (x: number) => number, w: number, h: number, closed: boolean): string {
  const n = 160;
  const ys: number[] = [];
  let max = 0;
  for (let i = 0; i <= n; i++) {
    const v = fn(-1 + (2 * i) / n);
    ys.push(v);
    if (v > max) max = v;
  }
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const y = h - (ys[i] / max) * h * 0.9;
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return closed ? `${d}L${w},${h}L0,${h}Z` : d;
}

function Curve({ fn, w, h, color, overlay }: { fn: (x: number) => number; w: number; h: number; color: string; overlay?: (x: number) => number }) {
  return <svg width={w} height={h + 34} viewBox={`0 0 ${w} ${h + 34}`} style={{ display: 'block', overflow: 'visible' }}>
    {overlay && <path d={curvePath(overlay, w, h, false)} style={{ fill: 'none', stroke: critic, strokeWidth: 3, strokeDasharray: '10 8' }} />}
    <path d={curvePath(fn, w, h, true)} style={{ fill: color, fillOpacity: 0.16 }} />
    <path d={curvePath(fn, w, h, false)} style={{ fill: 'none', stroke: color, strokeWidth: 4, strokeLinejoin: 'round' }} />
    <line x1={0} y1={h} x2={w} y2={h} style={{ stroke: muted, strokeWidth: 2 }} />
    <text x={0} y={h + 30} style={{ fill: muted, fontSize: 22, fontFamily: mono }}>−1</text>
    <text x={w / 2} y={h + 30} textAnchor="middle" style={{ fill: muted, fontSize: 22, fontFamily: mono }}>action</text>
    <text x={w} y={h + 30} textAnchor="end" style={{ fill: muted, fontSize: 22, fontFamily: mono }}>+1</text>
  </svg>;
}

function Arrowheads() {
  return <defs>
    <marker id="ah-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: '#121A22' }} /></marker>
    <marker id="ah-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: muted }} /></marker>
    <marker id="ah-actor" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style={{ fill: actor }} /></marker>
  </defs>;
}

// ---------- Cadre commun ----------

const label: CSSProperties = { fontFamily: mono, fontSize: 24, letterSpacing: 2, textTransform: 'uppercase', color: muted };
const body: CSSProperties = { margin: 0, fontSize: 'var(--osd-size-body)', lineHeight: 1.45 };

function Footer() {
  const { current, total } = useSlidePageNumber();
  return <footer style={{ position: 'absolute', left: 140, right: 140, bottom: 44, display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 20, letterSpacing: 2, color: muted }}>
    <span>SOFT ACTOR-CRITIC</span>
    <span>{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
  </footer>;
}

function Frame({ kicker, title, children }: { kicker: string; title: ReactNode; children: ReactNode }) {
  return <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '96px 140px 120px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ ...label, color: actor, marginBottom: 26 }}>{kicker}</div>
    <h2 style={{ margin: '0 0 44px', fontFamily: 'var(--osd-font-display)', fontSize: 68, lineHeight: 1.12, letterSpacing: -1.5, fontWeight: 800 }}>{title}</h2>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    <Footer />
  </section>;
}

function Takeaway({ children }: { children: ReactNode }) {
  return <p style={{ margin: 'auto 0 0', paddingTop: 22, borderTop: `2px solid ${rule}`, fontSize: 32, lineHeight: 1.4, color: muted }}>{children}</p>;
}

// ---------- Couverture ----------

const Cover: Page = () => <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '0 140px', display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 80, alignItems: 'center' }}>
  <div>
    <div style={{ ...label, color: actor }}>Exposé · Apprentissage par renforcement</div>
    <h1 style={{ margin: '36px 0 36px', fontFamily: 'var(--osd-font-display)', fontSize: 'var(--osd-size-hero)', lineHeight: 0.98, letterSpacing: -5, fontWeight: 800 }}>Soft<br />Actor&#8209;Critic</h1>
    <p style={{ ...body, fontSize: 44, color: muted }}>Apprendre à bien agir<br /><span style={{ color: entropy }}>sans arrêter d’explorer.</span></p>
    <div style={{ display: 'flex', gap: 14, marginTop: 52 }}>
      <span style={{ ...label, fontSize: 22, color: text, border: `2px solid ${rule}`, borderRadius: 999, padding: '8px 20px' }}>Fonctionnement</span>
      <span style={{ ...label, fontSize: 22, color: text, border: `2px solid ${rule}`, borderRadius: 999, padding: '8px 20px' }}>Hyperparamètres</span>
      <span style={{ ...label, fontSize: 22, color: text, border: `2px solid ${rule}`, borderRadius: 999, padding: '8px 20px' }}>Quand l’utiliser</span>
    </div>
    <p style={{ ...label, marginTop: 30, fontSize: 22 }}>Haarnoja et al. · UC Berkeley · 2018</p>
  </div>
  <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '44px 48px 36px' }}>
    <p style={{ ...label, fontSize: 22, marginBottom: 26 }}>Ce que SAC apprend : une préférence, pas une seule réponse</p>
    <Curve fn={boltzmann(0.15)} overlay={qToy} w={640} h={300} color={actor} />
    <div style={{ display: 'flex', gap: 36, marginTop: 26, fontSize: 24, color: muted }}>
      <span><span style={{ color: critic, fontWeight: 700 }}>- - -</span> qualité estimée de chaque action</span>
      <span><span style={{ color: actor, fontWeight: 700 }}>▬</span> probabilité de la choisir</span>
    </div>
  </div>
</section>;
Cover.transition = {
  duration: 280,
  exit: { duration: 280, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 280, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }] },
};

// ---------- Rappel du cours : le DQN et ses limites ----------

function QHead({ y, name }: { y: number; name: string }) {
  return <g>
    <line x1={420} y1={210} x2={556} y2={y} style={{ stroke: rule, strokeWidth: 3 }} />
    <rect x={560} y={y - 26} width={170} height={52} rx={12} style={{ fill: panel, stroke: critic, strokeWidth: 3 }} />
    <text x={645} y={y + 9} textAnchor="middle" style={{ fill: critic, fontSize: 25, fontFamily: mono }}>{name}</text>
  </g>;
}

function Limit({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderLeft: `10px solid ${color}`, borderRadius: 'var(--osd-radius)', padding: '24px 30px' }}>
    <div style={{ fontSize: 36, fontWeight: 800, color }}>{title}</div>
    <p style={{ ...body, fontSize: 29, color: muted, marginTop: 8, lineHeight: 1.4 }}>{children}</p>
  </div>;
}

const Recall: Page = () => <Frame kicker="Rappel du cours · CM4" title="Le DQN marche bien… jusqu’à un certain point">
  <div style={{ display: 'grid', gridTemplateColumns: '840px 1fr', gap: 70, alignItems: 'center' }}>
    <svg viewBox="0 0 840 420" width={840} height={420}>
      <Arrowheads />
      <rect x={0} y={170} width={170} height={80} rx={40} style={{ fill: soft }} />
      <text x={85} y={220} textAnchor="middle" style={{ fill: '#121A22', fontSize: 30, fontWeight: 700 }}>état s</text>
      <line x1={172} y1={210} x2={236} y2={210} style={{ stroke: '#121A22', strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
      <rect x={240} y={130} width={180} height={160} rx={18} style={{ fill: panel, stroke: '#121A22', strokeWidth: 3 }} />
      <text x={330} y={205} textAnchor="middle" style={{ fill: '#121A22', fontSize: 30, fontWeight: 800 }}>réseau</text>
      <text x={330} y={242} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>de neurones</text>
      <QHead y={60} name="Q(s, ←)" />
      <QHead y={160} name="Q(s, ↑)" />
      <QHead y={260} name="Q(s, ↓)" />
      <QHead y={360} name="Q(s, →)" />
      <line x1={734} y1={210} x2={770} y2={210} style={{ stroke: '#121A22', strokeWidth: 4 }} />
      <text x={790} y={200} textAnchor="middle" transform="rotate(-90 790 210)" style={{ fill: '#121A22', fontSize: 28, fontWeight: 800 }}>argmax</text>
    </svg>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <p style={{ ...body, fontSize: 30, color: muted }}>Une sortie par action, on prend la meilleure.</p>
      <Limit color={actor} title="1. Actions continues : pas d’argmax">Angle d’un volant, force d’un moteur : une infinité d’actions, donc une infinité de sorties.</Limit>
      <Limit color={entropy} title="2. ε-greedy explore à l’aveugle">Une fois sur ε, une action totalement au hasard, même absurde.</Limit>
    </div>
  </div>
  <Takeaway>SAC garde les bonnes idées du DQN (<strong style={{ color: text }}>réseau Q, replay buffer, target network</strong>) et corrige ces deux points.</Takeaway>
</Frame>;

// ---------- L'idée : récompense + entropie ----------

function Term({ color, children, sub }: { color: string; children: ReactNode; sub: string }) {
  return <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 56, fontWeight: 800, color, padding: '14px 34px', borderRadius: 16, background: panel, border: `3px solid ${color}` }}>{children}</div>
    <div style={{ fontSize: 24, color: muted, marginTop: 12 }}>{sub}</div>
  </div>;
}
function Op({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 60, color: muted, paddingBottom: 40 }}>{children}</div>;
}

const Idea: Page = () => <Frame kicker="Fonctionnement · L’idée" title="Récompenser aussi la curiosité">
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
    <Term color={text} sub="ce que l’agent cherche à maximiser">Objectif</Term>
    <Op>=</Op>
    <Term color={critic} sub="bien faire la tâche">Récompense</Term>
    <Op>+</Op>
    <Term color={entropy} sub="le dosage">α</Term>
    <Op>×</Op>
    <Term color={entropy} sub="garder des options ouvertes">Entropie</Term>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, marginTop: 50 }}>
    <div>
      <Curve fn={(x) => gauss(x, 0.5, 0.05)} w={720} h={140} color={muted} />
      <p style={{ ...body, fontSize: 31, marginTop: 14 }}><strong>Entropie faible</strong> : l’agent refait toujours exactement le même geste.</p>
    </div>
    <div>
      <Curve fn={boltzmann(0.4)} w={720} h={140} color={actor} />
      <p style={{ ...body, fontSize: 31, marginTop: 14 }}><strong style={{ color: actor }}>Entropie forte</strong> : il garde plusieurs bonnes options et varie.</p>
    </div>
  </div>
  <Takeaway>L’entropie <strong style={{ color: text }}>remplace ε-greedy</strong>. Attention : ce α n’est pas le taux d’apprentissage α du Q-learning.</Takeaway>
</Frame>;

// ---------- α, le thermostat ----------

function AlphaPanel({ name, alpha, color, children }: { name: string; alpha: number; color: string; children: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '24px 28px 26px' }}>
    <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 16 }}>{name}</div>
    <Curve fn={boltzmann(alpha)} overlay={qToy} w={452} h={180} color={color} />
    <p style={{ ...body, fontSize: 28, color: muted, marginTop: 14 }}>{children}</p>
  </div>;
}

const Thermostat: Page = () => <Frame kicker="Fonctionnement · Le dosage" title="α, le thermostat de la curiosité">
  <div style={{ display: 'flex', gap: 40, fontSize: 26, color: muted, marginTop: -16, marginBottom: 28 }}>
    <span><span style={{ color: critic, fontWeight: 700 }}>- - -</span> qualité estimée de chaque action</span>
    <span><span style={{ color: actor, fontWeight: 700 }}>▬</span> probabilité que l’agent la choisisse</span>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 34 }}>
    <AlphaPanel name="α trop faible" alpha={0.012} color={muted}>Tout sur une seule action. <br />Se fige trop tôt.</AlphaPanel>
    <AlphaPanel name="α bien dosé" alpha={0.15} color={actor}>Explore les deux bonnes zones, <br />évite les mauvaises.</AlphaPanel>
    <AlphaPanel name="α trop fort" alpha={3} color={entropy}>Presque au hasard. <br />Gaspille ses essais.</AlphaPanel>
  </div>
  <Takeaway>En pratique, <strong style={{ color: entropy }}>α se règle tout seul</strong> : il monte si l’agent devient trop rigide, il baisse s’il s’éparpille.</Takeaway>
</Frame>;

// ---------- Un acteur, deux critiques ----------

const Architecture: Page = () => <Frame kicker="Fonctionnement · Les réseaux" title="Un acteur qui joue, deux critiques qui notent">
  <svg viewBox="0 0 1640 430" width={1640} height={430} style={{ display: 'block' }}>
    <Arrowheads />
    {/* flux principal */}
    <line x1={170} y1={215} x2={246} y2={215} style={{ stroke: '#121A22', strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    <line x1={590} y1={215} x2={690} y2={215} style={{ stroke: actor, strokeWidth: 4 }} />
    <text x={640} y={196} textAnchor="middle" style={{ fill: actor, fontSize: 24, fontWeight: 700 }}>action a</text>
    <line x1={690} y1={215} x2={756} y2={88} style={{ stroke: actor, strokeWidth: 4 }} markerEnd="url(#ah-actor)" />
    <line x1={690} y1={215} x2={756} y2={298} style={{ stroke: actor, strokeWidth: 4 }} markerEnd="url(#ah-actor)" />
    <line x1={1090} y1={88} x2={1206} y2={180} style={{ stroke: critic, strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    <line x1={1090} y1={298} x2={1206} y2={252} style={{ stroke: critic, strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    {/* retour vers l'acteur */}
    <path d="M1320,310 L1320,412 L420,412 L420,310" style={{ fill: 'none', stroke: muted, strokeWidth: 3, strokeDasharray: '10 8' }} markerEnd="url(#ah-muted)" />
    <text x={1300} y={400} textAnchor="end" style={{ fill: muted, fontSize: 24 }}>l’acteur s’ajuste vers les actions bien notées (+ bonus d’entropie)</text>

    <rect x={0} y={170} width={170} height={90} rx={45} style={{ fill: soft }} />
    <text x={85} y={226} textAnchor="middle" style={{ fill: '#121A22', fontSize: 32, fontWeight: 700 }}>État s</text>

    <rect x={250} y={125} width={340} height={180} rx={20} style={{ fill: panel, stroke: actor, strokeWidth: 5 }} />
    <text x={420} y={198} textAnchor="middle" style={{ fill: actor, fontSize: 44, fontWeight: 800 }}>Acteur</text>
    <text x={420} y={240} textAnchor="middle" style={{ fill: muted, fontSize: 26 }}>le joueur</text>
    <text x={420} y={274} textAnchor="middle" style={{ fill: muted, fontSize: 26 }}>propose une action</text>

    <rect x={760} y={15} width={330} height={145} rx={20} style={{ fill: panel, stroke: critic, strokeWidth: 4 }} />
    <text x={925} y={74} textAnchor="middle" style={{ fill: critic, fontSize: 36, fontWeight: 800 }}>Critique 1</text>
    <text x={925} y={122} textAnchor="middle" style={{ fill: '#121A22', fontSize: 30, fontFamily: mono }}>« ça vaut 12 »</text>

    <rect x={760} y={225} width={330} height={145} rx={20} style={{ fill: panel, stroke: critic, strokeWidth: 4 }} />
    <text x={925} y={284} textAnchor="middle" style={{ fill: critic, fontSize: 36, fontWeight: 800 }}>Critique 2</text>
    <text x={925} y={332} textAnchor="middle" style={{ fill: '#121A22', fontSize: 30, fontFamily: mono }}>« ça vaut 8 »</text>

    <rect x={1210} y={120} width={220} height={190} rx={20} style={{ fill: critic }} />
    <text x={1320} y={196} textAnchor="middle" style={{ fill: '#FFFFFF', fontSize: 44, fontWeight: 800, fontFamily: mono }}>min</text>
    <text x={1320} y={256} textAnchor="middle" style={{ fill: '#FFFFFF', fontSize: 30 }}>on retient 8</text>
  </svg>
  <Takeaway>Deux avis indépendants, <strong style={{ color: text }}>on écoute le plus prudent</strong> : l’acteur ne se laisse pas piéger par une note trop optimiste.</Takeaway>
</Frame>;

// ---------- La boucle d'apprentissage ----------

function LoopCard({ n, title, icon, children }: { n: string; title: string; icon: ReactNode; children: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '26px 28px', height: 330, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <svg width={64} height={64} viewBox="0 0 64 64">{icon}</svg>
      <span style={{ fontFamily: mono, fontSize: 26, color: muted }}>{n}</span>
    </div>
    <div style={{ fontSize: 38, fontWeight: 800 }}>{title}</div>
    <p style={{ ...body, fontSize: 28, color: muted, lineHeight: 1.35 }}>{children}</p>
  </div>;
}
function Chevron() {
  return <div style={{ alignSelf: 'center', fontSize: 50, color: muted }}>→</div>;
}

const Loop: Page = () => <Frame kicker="Fonctionnement · L’entraînement" title="Agir, mémoriser, réviser, s’améliorer">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 1fr 50px 1fr 50px 1fr', gap: 10 }}>
    <LoopCard n="1" title="Agir" icon={<><circle cx={22} cy={32} r={12} style={{ fill: actor }} /><path d="M38,32 L58,32 M50,24 L58,32 L50,40" style={{ fill: 'none', stroke: actor, strokeWidth: 5 }} /></>}>Tenter une action, avec une part de hasard.</LoopCard>
    <Chevron />
    <LoopCard n="2" title="Mémoriser" icon={<><rect x={10} y={10} width={44} height={12} rx={3} style={{ fill: env }} /><rect x={10} y={26} width={44} height={12} rx={3} style={{ fill: env, fillOpacity: 0.7 }} /><rect x={10} y={42} width={44} height={12} rx={3} style={{ fill: env, fillOpacity: 0.4 }} /></>}>Ranger l’expérience dans le replay buffer.</LoopCard>
    <Chevron />
    <LoopCard n="3" title="Réviser" icon={<><rect x={8} y={14} width={22} height={22} rx={4} style={{ fill: critic }} /><rect x={34} y={28} width={22} height={22} rx={4} style={{ fill: critic, fillOpacity: 0.6 }} /><circle cx={19} cy={25} r={3} style={{ fill: '#FFFFFF' }} /><circle cx={45} cy={39} r={3} style={{ fill: '#FFFFFF' }} /></>}>Tirer 256 souvenirs au hasard, anciens compris.</LoopCard>
    <Chevron />
    <LoopCard n="4" title="S’améliorer" icon={<path d="M8,52 L26,34 L38,42 L56,14 M44,14 L56,14 L56,26" style={{ fill: 'none', stroke: entropy, strokeWidth: 5, strokeLinejoin: 'round' }} />}>Corriger critiques, acteur, α et cibles.</LoopCard>
  </div>
  <svg viewBox="0 0 1640 70" width={1640} height={70} style={{ display: 'block', marginTop: 8 }}>
    <Arrowheads />
    <path d="M1460,4 L1460,40 L180,40 L180,10" style={{ fill: 'none', stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
    <text x={820} y={68} textAnchor="middle" style={{ fill: muted, fontSize: 24 }}>et on recommence, des centaines de milliers de fois</text>
  </svg>
  <Takeaway><strong style={{ color: env }}>Off-policy</strong> : chaque expérience sert plusieurs fois, comme revoir d’anciens matchs pour progresser.</Takeaway>
</Frame>;

// ---------- Hyperparamètres ----------

const cell: CSSProperties = { padding: '15px 0', borderBottom: `2px solid ${rule}`, textAlign: 'left', verticalAlign: 'baseline' };
function Param({ name, role, value, link }: { name: ReactNode; role: string; value: string; link: string }) {
  return <tr>
    <th scope="row" style={{ ...cell, fontSize: 31, fontWeight: 800, width: 470 }}>{name}</th>
    <td style={{ ...cell, fontSize: 29, color: muted, width: 480 }}>{role}</td>
    <td style={{ ...cell, fontSize: 31, fontFamily: mono, color: actor, fontWeight: 700, width: 250 }}>{value}</td>
    <td style={{ ...cell, fontSize: 26, color: muted }}>{link}</td>
  </tr>;
}

const Hyper: Page = () => <Frame kicker="Hyperparamètres" title="Six réglages, presque tous connus">
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead><tr>
      <th scope="col" style={{ ...cell, ...label, fontSize: 21 }}>Réglage</th>
      <th scope="col" style={{ ...cell, ...label, fontSize: 21 }}>À quoi il sert</th>
      <th scope="col" style={{ ...cell, ...label, fontSize: 21 }}>Par défaut</th>
      <th scope="col" style={{ ...cell, ...label, fontSize: 21 }}>Déjà vu en cours ?</th>
    </tr></thead>
    <tbody>
      <Param name={<>γ <span style={{ fontWeight: 500, color: muted }}>actualisation</span></>} role="Poids des récompenses futures" value="0,99" link="Oui, comme en Q-learning" />
      <Param name="Taux d’apprentissage" role="Taille des pas de correction" value="3 × 10⁻⁴" link="Oui, pour tout réseau" />
      <Param name="Taille du replay buffer" role="Expériences gardées en mémoire" value="1 000 000" link="Oui, experience replay" />
      <Param name="Taille du batch" role="Souvenirs révisés à chaque pas" value="256" link="Oui, mini-batch" />
      <Param name={<>τ <span style={{ fontWeight: 500, color: muted }}>réseaux cibles</span></>} role="Vitesse de suivi des cibles" value="0,005" link="Target network, mis à jour en douceur" />
      <Param name={<span style={{ color: entropy }}>α et entropie cible</span>} role="Dosage de la curiosité" value="automatique" link="Nouveau : remplace ε" />
    </tbody>
  </table>
  <Takeaway>Ces valeurs (article de 2018, Stable-Baselines3) fonctionnent sur la plupart des tâches : <strong style={{ color: text }}>on part d’elles</strong>, on ajuste rarement.</Takeaway>
</Frame>;

// ---------- Exemple réel : Minitaur ----------

function Quadruped({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <g transform={`translate(${x},${y}) rotate(${angle})`}>
    <path d="M-62,-6 L-80,26 L-64,58" style={{ fill: 'none', stroke: '#121A22', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M-30,-6 L-14,26 L-30,58" style={{ fill: 'none', stroke: muted, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M30,-6 L12,26 L30,58" style={{ fill: 'none', stroke: muted, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M62,-6 L84,26 L70,58" style={{ fill: 'none', stroke: '#121A22', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <rect x={-90} y={-34} width={180} height={36} rx={12} style={{ fill: actor }} />
  </g>;
}

const Minitaur: Page = () => <Frame kicker="Cas d’usage · Google & UC Berkeley, 2018" title="Un robot à quatre pattes apprend à marcher">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 860px', gap: 80, flex: 1, alignItems: 'start' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
        <span style={{ fontFamily: 'var(--osd-font-display)', fontSize: 170, fontWeight: 800, lineHeight: 1, color: actor, letterSpacing: -6 }}>2 h</span>
        <span style={{ fontSize: 32, color: muted, lineHeight: 1.3 }}>d’entraînement<br />sur le vrai robot</span>
      </div>
      <ul style={{ margin: '44px 0 0', padding: 0, listStyle: 'none', fontSize: 33, lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <li>Robot <strong>Minitaur</strong> : 8 moteurs, actions continues</li>
        <li>Entraîné uniquement <strong>sur sol plat</strong></li>
        <li>Marche ensuite sur <strong style={{ color: entropy }}>pentes et obstacles jamais vus</strong></li>
      </ul>
    </div>
    <svg viewBox="0 0 860 600" width={860} height={600}>
      <rect x={0} y={0} width={860} height={280} rx={18} style={{ fill: panel, stroke: rule, strokeWidth: 2 }} />
      <text x={28} y={46} style={{ fill: muted, fontSize: 24, fontFamily: mono, letterSpacing: 2 }}>ENTRAÎNEMENT</text>
      <line x1={40} y1={236} x2={820} y2={236} style={{ stroke: '#121A22', strokeWidth: 4 }} />
      <Quadruped x={430} y={178} angle={0} />
      <rect x={0} y={310} width={860} height={290} rx={18} style={{ fill: panel, stroke: entropy, strokeWidth: 3 }} />
      <text x={28} y={356} style={{ fill: entropy, fontSize: 24, fontFamily: mono, letterSpacing: 2 }}>TEST : TERRAIN INCONNU</text>
      <path d="M40,570 L820,450" style={{ stroke: '#121A22', strokeWidth: 4 }} />
      <rect x={612} y={458} width={42} height={30} rx={4} transform="rotate(-8.7 633 483)" style={{ fill: muted }} />
      <rect x={140} y={528} width={34} height={26} rx={4} transform="rotate(-8.7 157 554)" style={{ fill: muted }} />
      <Quadruped x={400} y={457} angle={-8.7} />
    </svg>
  </div>
  <Takeaway>Les auteurs attribuent cette robustesse au <strong style={{ color: entropy }}>bonus d’entropie</strong> : le robot a appris plusieurs façons de bouger.</Takeaway>
</Frame>;

// ---------- Autres résultats ----------

function Result({ value, color, title, children }: { value: string; color: string; title: string; children: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderTop: `8px solid ${color}`, borderRadius: 'var(--osd-radius)', padding: '30px 34px', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <span style={{ fontFamily: 'var(--osd-font-display)', fontSize: 104, fontWeight: 800, lineHeight: 1, color, letterSpacing: -3 }}>{value}</span>
    <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>{title}</span>
    <span style={{ fontSize: 27, color: muted, lineHeight: 1.4 }}>{children}</span>
  </div>;
}

const Results: Page = () => <Frame kicker="Cas d’usage · Autres robots réels" title="Des robots qui apprennent en quelques heures">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
    <Result value="2 h" color={actor} title="Marcher">Minitaur, quadrupède à 8 moteurs, directement sur le vrai robot.</Result>
    <Result value="2 h" color={critic} title="Empiler des Lego">Bras Sawyer à 7 articulations, commandé en couple moteur.</Result>
    <Result value="20 h" color={entropy} title="Tourner une vanne">Main à 3 doigts, à partir des seules images d’une caméra.</Result>
  </div>
  <Takeaway>Ailleurs, SAC sert de référence pour tout <strong style={{ color: text }}>contrôle continu</strong> : énergie (chauffage, batteries), conduite en simulation, jeux physiques.</Takeaway>
</Frame>;

// ---------- Quand l'utiliser ----------

function Algo({ x, y, name, note, strong }: { x: number; y: number; name: string; note: string; strong?: boolean }) {
  return <g>
    <rect x={x - 150} y={y - 50} width={300} height={100} rx={18} style={{ fill: strong ? actor : panel, stroke: strong ? actor : rule, strokeWidth: 3 }} />
    <text x={x} y={y - 6} textAnchor="middle" style={{ fill: strong ? '#FFFFFF' : '#121A22', fontSize: 34, fontWeight: 800 }}>{name}</text>
    <text x={x} y={y + 30} textAnchor="middle" style={{ fill: strong ? '#FFFFFF' : muted, fontSize: 22 }}>{note}</text>
  </g>;
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: 14, alignItems: 'baseline', fontSize: 30, lineHeight: 1.35 }}>
    <span style={{ fontWeight: 800, fontSize: 34, color: ok ? critic : env }}>{ok ? '✓' : '✗'}</span>
    <span>{children}</span>
  </div>;
}

const WhenToUse: Page = () => <Frame kicker="Quand l’utiliser" title="SAC est recommandé quand…">
  <div style={{ display: 'grid', gridTemplateColumns: '860px 1fr', gap: 70, alignItems: 'start' }}>
    <svg viewBox="0 0 1000 600" width={860} height={516}>
      <Arrowheads />
      <line x1={110} y1={540} x2={980} y2={540} style={{ stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
      <line x1={110} y1={540} x2={110} y2={20} style={{ stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
      <text x={320} y={588} textAnchor="middle" style={{ fill: muted, fontSize: 26 }}>actions discrètes</text>
      <text x={760} y={588} textAnchor="middle" style={{ fill: muted, fontSize: 26 }}>actions continues</text>
      <text x={78} y={150} textAnchor="middle" transform="rotate(-90 78 150)" style={{ fill: muted, fontSize: 26 }}>réutilise ses données</text>
      <text x={78} y={420} textAnchor="middle" transform="rotate(-90 78 420)" style={{ fill: muted, fontSize: 26 }}>jette ses données</text>
      <line x1={540} y1={30} x2={540} y2={530} style={{ stroke: rule, strokeWidth: 2, strokeDasharray: '8 8' }} />
      <line x1={120} y1={300} x2={970} y2={300} style={{ stroke: rule, strokeWidth: 2, strokeDasharray: '8 8' }} />
      <Algo x={320} y={160} name="DQN" note="vu en cours, choix finis" />
      <Algo x={540} y={425} name="PPO" note="discret ou continu" />
      <Algo x={770} y={95} name="DDPG · TD3" note="exploration à régler" />
      <Algo x={770} y={222} name="SAC" note="explore par lui-même" strong />
    </svg>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Check ok>Les actions sont <strong>continues</strong> : robot, véhicule, énergie</Check>
      <Check ok>Chaque essai <strong>coûte cher</strong> : vrai robot, simulation lente</Check>
      <Check ok>On veut un comportement <strong>robuste</strong></Check>
      <div style={{ height: 8 }} />
      <Check ok={false}>Peu d’actions discrètes : <strong>DQN</strong> suffit</Check>
      <Check ok={false}>Simulateur rapide et parallèle : <strong>PPO</strong> va plus vite</Check>
      <Check ok={false}>Récompense très rare : il faut d’autres astuces</Check>
    </div>
  </div>
</Frame>;

// ---------- À retenir ----------

function Recap({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 30, alignItems: 'stretch' }}>
    <div style={{ background: color, borderRadius: 9 }} />
    <div><div style={{ fontSize: 42, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 30, color: muted, lineHeight: 1.4 }}>{children}</div></div>
  </div>;
}

const Takeaways: Page = () => <Frame kicker="À retenir" title="SAC en trois phrases">
  <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
    <Recap color={actor} title="Un acteur propose, deux critiques notent">On garde la note la plus prudente pour ne pas se surestimer.</Recap>
    <Recap color={env} title="Une mémoire qui réutilise chaque expérience">Off-policy : peu d’essais réels, idéal quand ils coûtent cher.</Recap>
    <Recap color={entropy} title="Un bonus de curiosité, dosé automatiquement">L’entropie garde plusieurs options ouvertes : exploration et robustesse.</Recap>
  </div>
  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 60, paddingTop: 30, borderTop: `2px solid ${rule}` }}>
    <div style={{ fontSize: 22, color: muted, lineHeight: 1.6, fontFamily: mono }}>
      Haarnoja et al., ICML 2018 · arxiv.org/abs/1812.05905<br />
      bair.berkeley.edu/blog/2018/12/14/sac · spinningup.openai.com
    </div>
    <div style={{ fontFamily: 'var(--osd-font-display)', fontSize: 72, fontWeight: 800, color: actor, lineHeight: 1 }}>Questions ?</div>
  </div>
</Frame>;

export const meta: SlideMeta = {
  title: 'Soft Actor-Critic',
  createdAt: '2026-11-15T14:38:19.067Z',
};

// Notes orales, alignées sur les 11 pages. Durée totale visée : environ 7 min 30 (consigne : 7 min, 10 max).
export const notes: (string | undefined)[] = [
  `≈ 0:25
Bonjour. On présente SAC, pour Soft Actor-Critic, publié en 2018 par Tuomas Haarnoja et l’équipe de Berkeley.
On va suivre les trois points demandés : comment il fonctionne, ses hyperparamètres, et quand il est recommandé.
Le dessin à droite résume l’idée : en pointillés, ce que l’agent pense de chaque action ; en violet, la probabilité qu’il la choisisse. Il ne choisit pas une seule action, il garde une préférence.`,

  `≈ 0:50
Point de départ : le DQN qu’on a vu en cours. On passe l’état dans un réseau de neurones, qui sort une Q-valeur par action, et on prend l’argmax.
Ça marche très bien pour Atari, avec 18 actions. Mais deux choses coincent.
Un : les actions continues. Tourner un volant de 12,4 degrés, régler la force d’un moteur : il y a une infinité d’actions, on ne peut pas avoir une sortie par action, donc pas d’argmax.
Deux : l’exploration ε-greedy. Une fois sur ε, on tire une action complètement au hasard, même absurde.
SAC garde les bonnes idées du DQN, le réseau Q, le replay buffer et le target network, et corrige ces deux points.`,

  `≈ 0:50
L’idée centrale. Le DQN maximise seulement la récompense. SAC maximise la récompense plus alpha fois l’entropie.
L’entropie mesure à quel point l’agent garde plusieurs options ouvertes. À gauche, entropie faible : il refait toujours exactement le même geste. À droite, entropie forte : il garde plusieurs bonnes options et varie.
C’est ce bonus qui remplace ε-greedy : l’exploration n’est plus un hasard aveugle, elle porte surtout sur les actions presque aussi bonnes que la meilleure.
Attention au piège de notation : ce alpha n’a rien à voir avec le alpha, taux d’apprentissage, du Q-learning du cours.`,

  `≈ 0:35
Alpha est le dosage. Même évaluation en pointillés, trois valeurs d’alpha.
Trop faible : tout sur une seule action, l’agent se fige trop tôt. Bien dosé : il explore les deux bonnes zones et évite les mauvaises. Trop fort : il agit presque au hasard.
Dans la version moderne de SAC, alpha s’ajuste tout seul, comme un thermostat : il monte si l’agent devient trop rigide, il baisse s’il s’éparpille.`,

  `≈ 0:55
Les réseaux. Le nom le dit : un acteur et des critiques.
L’acteur, c’est le joueur : il reçoit l’état et propose directement une action continue. C’est ce qui règle le problème de l’argmax.
Les critiques, ce sont deux réseaux Q, comme dans le DQN, mais ils prennent l’état et l’action en entrée et donnent une note. Ici, le premier dit 12, le second dit 8.
On retient le minimum. Pourquoi ? Un réseau Q se trompe parfois vers le haut, et l’acteur serait attiré précisément par ces erreurs optimistes. En écoutant le plus prudent, on évite ce piège.
Ensuite l’acteur s’ajuste vers les actions bien notées, toujours avec son bonus d’entropie.`,

  `≈ 0:50
L’entraînement tourne en boucle, en quatre temps.
Un : l’acteur agit, avec sa part de hasard. Deux : l’expérience va dans le replay buffer, comme pour le DQN. Trois : on tire 256 souvenirs au hasard, récents ou anciens. Quatre : critiques, acteur et alpha se corrigent, et les réseaux cibles suivent doucement.
SAC est off-policy, comme le Q-learning : il apprend aussi à partir de vieilles expériences. Chaque essai sert plusieurs fois, c’est précieux quand un essai coûte cher, par exemple sur un vrai robot.`,

  `≈ 0:50
Deuxième partie, les hyperparamètres. Bonne nouvelle : presque tous sont déjà connus.
Gamma, le facteur d’actualisation, comme en Q-learning : 0,99. Le taux d’apprentissage des réseaux : 3 fois 10 puissance moins 4. La taille du replay buffer, un million, et la taille du batch, 256.
Tau règle les réseaux cibles. Dans le DQN, on recopie le target network tous les C pas. Dans SAC, on le fait glisser doucement à chaque pas : 0,5 % des nouveaux poids à chaque fois.
Le seul vraiment nouveau, c’est alpha et l’entropie cible, réglés automatiquement. En pratique, ces valeurs par défaut marchent sur la plupart des tâches, on part d’elles.`,

  `≈ 0:40
Troisième partie, les cas d’usage, avec un exemple réel publié par Google et Berkeley.
Minitaur est un petit robot à quatre pattes, huit moteurs. Avec SAC, il a appris à marcher en environ deux heures, directement sur le vrai robot.
Le plus intéressant : il n’a été entraîné que sur sol plat, et il marche ensuite sur des pentes et franchit des obstacles qu’il n’a jamais vus. Les auteurs l’expliquent par le bonus d’entropie : il a appris plusieurs façons de bouger.`,

  `≈ 0:30
Deux autres robots du même travail. Un bras Sawyer qui apprend à empiler des Lego en deux heures. Et une main à trois doigts qui apprend à tourner une vanne à partir des seules images d’une caméra, en vingt heures.
Plus largement, SAC est une référence pour le contrôle continu : énergie, conduite en simulation, jeux physiques.`,

  `≈ 0:45
Alors, quand recommander SAC ? Sur ce schéma, deux axes : le type d’action, et le fait de réutiliser ou non ses données.
Le DQN du cours ne gère que le discret. PPO gère les deux mais jette ses données après chaque mise à jour. DDPG et TD3 sont proches de SAC mais leur exploration est à régler à la main.
SAC est recommandé quand les actions sont continues, quand chaque essai coûte cher, et quand on veut un comportement robuste.
En revanche, pour quelques actions discrètes, un DQN suffit ; avec un simulateur très rapide et parallélisable, PPO va souvent plus vite ; et si la récompense est très rare, l’entropie ne suffit pas à la trouver.`,

  `≈ 0:25
Pour retenir SAC en trois phrases. Un acteur propose, deux critiques notent, et on garde la note la plus prudente. Une mémoire réutilise chaque expérience. Et un bonus de curiosité, dosé automatiquement, garde plusieurs options ouvertes.
Les sources sont en bas. Merci, avez-vous des questions ?`,
];

export default [Cover, Recall, Idea, Thermostat, Architecture, Loop, Hyper, Minitaur, Results, WhenToUse, Takeaways] satisfies Page[];
