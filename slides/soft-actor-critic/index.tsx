import { useSlidePageNumber, type DesignSystem, type Page, type SlideMeta, type SlideTransition } from '@open-slide/core';
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

// ---------- Ordre de passage ----------

const HUGO = 'Hugo';
const MATHIS = 'Mathis';
const QUENTIN = 'Quentin';

// ---------- Cadre commun ----------

const label: CSSProperties = { fontFamily: mono, fontSize: 24, letterSpacing: 2, textTransform: 'uppercase', color: muted };

function Footer() {
  const { current, total } = useSlidePageNumber();
  return <footer style={{ position: 'absolute', left: 140, right: 140, bottom: 44, display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 20, letterSpacing: 2, color: muted }}>
    <span>SOFT ACTOR-CRITIC</span>
    <span>{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
  </footer>;
}

function Speaker({ name }: { name: string }) {
  return <span style={{ fontFamily: mono, fontSize: 22, letterSpacing: 1, color: text, background: soft, borderRadius: 999, padding: '6px 18px' }}>🎤 {name}</span>;
}

function Frame({ kicker, speaker, title, children }: { kicker: string; speaker: string; title: ReactNode; children: ReactNode }) {
  return <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '90px 140px 120px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
      <span style={{ ...label, color: actor }}>{kicker}</span>
      <Speaker name={speaker} />
    </div>
    <h2 style={{ margin: '0 0 50px', fontFamily: 'var(--osd-font-display)', fontSize: 76, lineHeight: 1.1, letterSpacing: -2, fontWeight: 800 }}>{title}</h2>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    <Footer />
  </section>;
}

/** Bandeau final : une idée courte à retenir, en bas de page. */
function Punchline({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 38, fontWeight: 800, color, borderLeft: `8px solid ${color}`, paddingLeft: 26 }}>{children}</div>;
}

// ---------- Couverture ----------

function Turn({ n, name, topic }: { n: string; name: string; topic: string }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '50px 190px 1fr', alignItems: 'baseline', padding: '14px 0', borderTop: `2px solid ${rule}` }}>
    <span style={{ fontFamily: mono, fontSize: 26, color: muted }}>{n}</span>
    <span style={{ fontSize: 34, fontWeight: 800 }}>{name}</span>
    <span style={{ fontSize: 30, color: muted }}>{topic}</span>
  </div>;
}

const Cover: Page = () => <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '0 140px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 90, alignItems: 'center' }}>
  <div>
    <div style={{ ...label, color: actor }}>IA & apprentissage par renforcement</div>
    <h1 style={{ margin: '30px 0 26px', fontFamily: 'var(--osd-font-display)', fontSize: 'var(--osd-size-hero)', lineHeight: 0.98, letterSpacing: -5, fontWeight: 800 }}>Soft<br />Actor&#8209;Critic</h1>
    <p style={{ margin: 0, fontSize: 44, color: muted, lineHeight: 1.3 }}>Apprendre à agir,<br /><span style={{ color: entropy }}>tout en continuant d’explorer.</span></p>
    <div style={{ marginTop: 56 }}>
      <Turn n="1" name={HUGO} topic="Le problème et l’idée" />
      <Turn n="2" name={MATHIS} topic="Les réseaux et les réglages" />
      <Turn n="3" name={QUENTIN} topic="En vrai, et quand l’utiliser" />
    </div>
  </div>
  <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '48px 48px 40px' }}>
    <Curve fn={boltzmann(0.15)} overlay={qToy} w={640} h={340} color={actor} />
    <div style={{ display: 'flex', gap: 40, marginTop: 28, fontSize: 28, color: muted }}>
      <span><span style={{ color: critic, fontWeight: 800 }}>- - -</span> qualité</span>
      <span><span style={{ color: actor, fontWeight: 800 }}>▬</span> choix de l’agent</span>
    </div>
  </div>
</section>;
Cover.transition = {
  duration: 280,
  exit: { duration: 280, easing: EASE_IN, keyframes: HOLD },
  enter: { duration: 280, easing: EASE_OUT, keyframes: [{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }] },
};

// ---------- Rappel : le DQN ----------

function QHead({ y, name }: { y: number; name: string }) {
  return <g>
    <line x1={420} y1={210} x2={556} y2={y} style={{ stroke: rule, strokeWidth: 3 }} />
    <rect x={560} y={y - 26} width={170} height={52} rx={12} style={{ fill: panel, stroke: critic, strokeWidth: 3 }} />
    <text x={645} y={y + 9} textAnchor="middle" style={{ fill: critic, fontSize: 25, fontFamily: mono }}>{name}</text>
  </g>;
}

function Problem({ color, n, children }: { color: string; n: string; children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
    <span style={{ width: 64, height: 64, borderRadius: '50%', background: color, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, flex: 'none' }}>{n}</span>
    <span style={{ fontSize: 40, fontWeight: 700 }}>{children}</span>
  </div>;
}

const Recall: Page = () => <Frame kicker="Rappel du cours" speaker={HUGO} title="Le DQN… et ses deux limites">
  <div style={{ display: 'grid', gridTemplateColumns: '840px 1fr', gap: 80, alignItems: 'center' }}>
    <svg viewBox="0 0 840 420" width={840} height={420}>
      <Arrowheads />
      <rect x={0} y={170} width={170} height={80} rx={40} style={{ fill: soft }} />
      <text x={85} y={220} textAnchor="middle" style={{ fill: '#121A22', fontSize: 30, fontWeight: 700 }}>état s</text>
      <line x1={172} y1={210} x2={236} y2={210} style={{ stroke: '#121A22', strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
      <rect x={240} y={130} width={180} height={160} rx={18} style={{ fill: panel, stroke: '#121A22', strokeWidth: 3 }} />
      <text x={330} y={220} textAnchor="middle" style={{ fill: '#121A22', fontSize: 32, fontWeight: 800 }}>réseau</text>
      <QHead y={60} name="Q(s, ←)" />
      <QHead y={160} name="Q(s, ↑)" />
      <QHead y={260} name="Q(s, ↓)" />
      <QHead y={360} name="Q(s, →)" />
      <line x1={734} y1={210} x2={770} y2={210} style={{ stroke: '#121A22', strokeWidth: 4 }} />
      <text x={790} y={200} textAnchor="middle" transform="rotate(-90 790 210)" style={{ fill: '#121A22', fontSize: 28, fontWeight: 800 }}>argmax</text>
    </svg>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
      <Problem color={actor} n="1">Actions continues ?<br /><span style={{ color: muted, fontWeight: 500 }}>∞ actions → ∞ sorties</span></Problem>
      <Problem color={entropy} n="2">ε-greedy<br /><span style={{ color: muted, fontWeight: 500 }}>explore au hasard</span></Problem>
    </div>
  </div>
  <Punchline color={actor}>SAC garde : réseau Q · replay buffer · target network</Punchline>
</Frame>;

// ---------- L'idée ----------

function Term({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ fontSize: 64, fontWeight: 800, color, padding: '14px 40px', borderRadius: 18, background: panel, border: `4px solid ${color}` }}>{children}</div>;
}
function Op({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 64, color: muted }}>{children}</div>;
}

const Idea: Page = () => <Frame kicker="Fonctionnement" speaker={HUGO} title="L’idée : un bonus pour explorer">
  <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
    <Term color={critic}>Récompense</Term>
    <Op>+</Op>
    <Term color={entropy}>α × Entropie</Term>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 110, marginTop: 64 }}>
    <div>
      <p style={{ margin: '0 0 18px', fontSize: 36, fontWeight: 800, color: muted }}>Entropie faible</p>
      <Curve fn={(x) => gauss(x, 0.5, 0.05)} w={700} h={200} color={muted} />
    </div>
    <div>
      <p style={{ margin: '0 0 18px', fontSize: 36, fontWeight: 800, color: actor }}>Entropie forte</p>
      <Curve fn={boltzmann(0.4)} w={700} h={200} color={actor} />
    </div>
  </div>
</Frame>;

// ---------- α ----------

function AlphaPanel({ name, alpha, color, verdict }: { name: string; alpha: number; color: string; verdict: string }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '28px 28px 30px' }}>
    <div style={{ fontSize: 34, fontWeight: 800, color, marginBottom: 20 }}>{name}</div>
    <Curve fn={boltzmann(alpha)} overlay={qToy} w={452} h={220} color={color} />
    <div style={{ fontSize: 30, fontWeight: 800, marginTop: 20 }}>{verdict}</div>
  </div>;
}

const Thermostat: Page = () => <Frame kicker="Fonctionnement" speaker={HUGO} title="α : le dosage">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
    <AlphaPanel name="α faible" alpha={0.012} color={muted} verdict="Toujours la même action" />
    <AlphaPanel name="α bien dosé" alpha={0.15} color={actor} verdict="Explore les bonnes actions" />
    <AlphaPanel name="α fort" alpha={3} color={entropy} verdict="Presque au hasard" />
  </div>
  <Punchline color={entropy}>En pratique, α est appris automatiquement</Punchline>
</Frame>;

// ---------- Un acteur, deux critiques ----------

const Architecture: Page = () => <Frame kicker="Fonctionnement" speaker={MATHIS} title="1 acteur, 2 critiques">
  <svg viewBox="0 0 1640 470" width={1640} height={470} style={{ display: 'block' }}>
    <Arrowheads />
    <line x1={170} y1={215} x2={246} y2={215} style={{ stroke: '#121A22', strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    <line x1={590} y1={215} x2={690} y2={215} style={{ stroke: actor, strokeWidth: 4 }} />
    <text x={640} y={196} textAnchor="middle" style={{ fill: actor, fontSize: 28, fontWeight: 700 }}>action</text>
    <line x1={690} y1={215} x2={756} y2={88} style={{ stroke: actor, strokeWidth: 4 }} markerEnd="url(#ah-actor)" />
    <line x1={690} y1={215} x2={756} y2={298} style={{ stroke: actor, strokeWidth: 4 }} markerEnd="url(#ah-actor)" />
    <line x1={1090} y1={88} x2={1206} y2={180} style={{ stroke: critic, strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    <line x1={1090} y1={298} x2={1206} y2={252} style={{ stroke: critic, strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    <path d="M1320,310 L1320,430 L420,430 L420,310" style={{ fill: 'none', stroke: muted, strokeWidth: 3, strokeDasharray: '10 8' }} markerEnd="url(#ah-muted)" />
    <text x={870} y={418} textAnchor="middle" style={{ fill: muted, fontSize: 28 }}>l’acteur s’améliore</text>

    <rect x={0} y={170} width={170} height={90} rx={45} style={{ fill: soft }} />
    <text x={85} y={226} textAnchor="middle" style={{ fill: '#121A22', fontSize: 32, fontWeight: 700 }}>état s</text>

    <rect x={250} y={135} width={340} height={160} rx={20} style={{ fill: panel, stroke: actor, strokeWidth: 5 }} />
    <text x={420} y={208} textAnchor="middle" style={{ fill: actor, fontSize: 46, fontWeight: 800 }}>Acteur</text>
    <text x={420} y={254} textAnchor="middle" style={{ fill: muted, fontSize: 30 }}>choisit l’action</text>

    <rect x={760} y={15} width={330} height={145} rx={20} style={{ fill: panel, stroke: critic, strokeWidth: 4 }} />
    <text x={850} y={104} textAnchor="middle" style={{ fill: critic, fontSize: 34, fontWeight: 800 }}>Critique 1</text>
    <text x={1030} y={108} textAnchor="middle" style={{ fill: '#121A22', fontSize: 56, fontWeight: 800 }}>12</text>

    <rect x={760} y={225} width={330} height={145} rx={20} style={{ fill: panel, stroke: critic, strokeWidth: 4 }} />
    <text x={850} y={314} textAnchor="middle" style={{ fill: critic, fontSize: 34, fontWeight: 800 }}>Critique 2</text>
    <text x={1030} y={318} textAnchor="middle" style={{ fill: '#121A22', fontSize: 56, fontWeight: 800 }}>8</text>

    <rect x={1210} y={120} width={220} height={190} rx={20} style={{ fill: critic }} />
    <text x={1320} y={198} textAnchor="middle" style={{ fill: '#FFFFFF', fontSize: 40, fontWeight: 800, fontFamily: mono }}>min</text>
    <text x={1320} y={268} textAnchor="middle" style={{ fill: '#FFFFFF', fontSize: 64, fontWeight: 800 }}>8</text>
  </svg>
  <Punchline color={critic}>On garde la note la plus basse</Punchline>
</Frame>;

// ---------- La boucle ----------

function LoopCard({ n, title, icon, hint }: { n: string; title: string; icon: ReactNode; hint: string }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderRadius: 'var(--osd-radius)', padding: '30px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <svg width={72} height={72} viewBox="0 0 64 64">{icon}</svg>
      <span style={{ fontFamily: mono, fontSize: 28, color: muted }}>{n}</span>
    </div>
    <div style={{ fontSize: 42, fontWeight: 800 }}>{title}</div>
    <div style={{ fontSize: 30, color: muted }}>{hint}</div>
  </div>;
}
function Chevron() {
  return <div style={{ alignSelf: 'center', fontSize: 54, color: muted }}>→</div>;
}

const Loop: Page = () => <Frame kicker="Fonctionnement" speaker={MATHIS} title="La boucle d’entraînement">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 1fr 56px 1fr 56px 1fr', gap: 8 }}>
    <LoopCard n="1" title="Agir" hint="un peu au hasard" icon={<><circle cx={22} cy={32} r={12} style={{ fill: actor }} /><path d="M38,32 L58,32 M50,24 L58,32 L50,40" style={{ fill: 'none', stroke: actor, strokeWidth: 5 }} /></>} />
    <Chevron />
    <LoopCard n="2" title="Mémoriser" hint="replay buffer" icon={<><rect x={10} y={10} width={44} height={12} rx={3} style={{ fill: env }} /><rect x={10} y={26} width={44} height={12} rx={3} style={{ fill: env, fillOpacity: 0.7 }} /><rect x={10} y={42} width={44} height={12} rx={3} style={{ fill: env, fillOpacity: 0.4 }} /></>} />
    <Chevron />
    <LoopCard n="3" title="Réviser" hint="256 souvenirs" icon={<><rect x={8} y={14} width={22} height={22} rx={4} style={{ fill: critic }} /><rect x={34} y={28} width={22} height={22} rx={4} style={{ fill: critic, fillOpacity: 0.6 }} /><circle cx={19} cy={25} r={3} style={{ fill: '#FFFFFF' }} /><circle cx={45} cy={39} r={3} style={{ fill: '#FFFFFF' }} /></>} />
    <Chevron />
    <LoopCard n="4" title="Corriger" hint="acteur, critiques, α" icon={<path d="M8,52 L26,34 L38,42 L56,14 M44,14 L56,14 L56,26" style={{ fill: 'none', stroke: entropy, strokeWidth: 5, strokeLinejoin: 'round' }} />} />
  </div>
  <svg viewBox="0 0 1640 80" width={1640} height={80} style={{ display: 'block', marginTop: 10 }}>
    <Arrowheads />
    <path d="M1460,4 L1460,44 L180,44 L180,10" style={{ fill: 'none', stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
    <text x={820} y={76} textAnchor="middle" style={{ fill: muted, fontSize: 28 }}>× des centaines de milliers</text>
  </svg>
  <Punchline color={env}>Off-policy : chaque essai sert plusieurs fois</Punchline>
</Frame>;

// ---------- Hyperparamètres ----------

function Knob({ value, name, role, fresh }: { value: string; name: string; role: string; fresh?: boolean }) {
  return <div style={{ background: panel, border: `2px solid ${fresh ? entropy : rule}`, borderRadius: 'var(--osd-radius)', padding: '26px 32px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
    {fresh && <span style={{ position: 'absolute', top: 22, right: 26, fontFamily: mono, fontSize: 20, letterSpacing: 2, color: '#FFFFFF', background: entropy, borderRadius: 999, padding: '4px 14px' }}>NOUVEAU</span>}
    <span style={{ fontFamily: mono, fontSize: 60, fontWeight: 700, color: fresh ? entropy : actor, lineHeight: 1.1 }}>{value}</span>
    <span style={{ fontSize: 34, fontWeight: 800 }}>{name}</span>
    <span style={{ fontSize: 28, color: muted }}>{role}</span>
  </div>;
}

const Hyper: Page = () => <Frame kicker="Hyperparamètres" speaker={MATHIS} title="6 réglages">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
    <Knob value="0,99" name="γ · actualisation" role="poids du futur" />
    <Knob value="3·10⁻⁴" name="Taux d’apprentissage" role="vitesse d’apprentissage" />
    <Knob value="10⁶" name="Replay buffer" role="taille de la mémoire" />
    <Knob value="256" name="Batch" role="souvenirs par pas" />
    <Knob value="0,005" name="τ · réseaux cibles" role="vitesse de suivi" />
    <Knob value="auto" name="α · température" role="poids de l’entropie" fresh />
  </div>
  <Punchline color={actor}>Les valeurs par défaut suffisent pour commencer</Punchline>
</Frame>;

// ---------- Minitaur ----------

function Quadruped({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <g transform={`translate(${x},${y}) rotate(${angle})`}>
    <path d="M-62,-6 L-80,26 L-64,58" style={{ fill: 'none', stroke: '#121A22', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M-30,-6 L-14,26 L-30,58" style={{ fill: 'none', stroke: muted, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M30,-6 L12,26 L30,58" style={{ fill: 'none', stroke: muted, strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d="M62,-6 L84,26 L70,58" style={{ fill: 'none', stroke: '#121A22', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <rect x={-90} y={-34} width={180} height={36} rx={12} style={{ fill: actor }} />
  </g>;
}

function FlatSketch() {
  return <svg viewBox="0 0 700 200" width={700} height={200}>
    <line x1={20} y1={176} x2={680} y2={176} style={{ stroke: '#121A22', strokeWidth: 4 }} />
    <path d="M150,110 L250,110 M170,134 L240,134" style={{ stroke: actor, strokeWidth: 5, strokeLinecap: 'round', strokeOpacity: 0.35 }} />
    <g transform="translate(380,124) scale(0.88)"><Quadruped x={0} y={0} angle={0} /></g>
  </svg>;
}

function SlopeSketch() {
  return <svg viewBox="0 0 700 200" width={700} height={200}>
    <path d="M20,190 L680,100" style={{ stroke: '#121A22', strokeWidth: 4 }} />
    <rect x={500} y={102} width={40} height={28} rx={4} transform="rotate(-7.8 520 125)" style={{ fill: muted }} />
    <rect x={130} y={153} width={34} height={24} rx={4} transform="rotate(-7.8 147 174)" style={{ fill: muted }} />
    <g transform="translate(340,94) rotate(-7.8) scale(0.88)"><Quadruped x={0} y={0} angle={0} /></g>
  </svg>;
}

const Minitaur: Page = () => <Frame kicker="Cas réel · Berkeley & Google, 2018" speaker={QUENTIN} title="Minitaur apprend à marcher">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 40 }}>
    <Result value="2 h" color={actor} title="Apprendre à marcher" detail="sur le vrai robot, sol plat" sketch={<FlatSketch />} />
    <Result value="+0 h" color={entropy} title="Pente et obstacles" detail="jamais vus, sans réentraînement" sketch={<SlopeSketch />} />
  </div>
</Frame>;

// ---------- Autres robots ----------

const ink = '#121A22';

function WalkSketch() {
  return <svg viewBox="0 0 448 200" width={448} height={200}>
    <line x1={10} y1={176} x2={438} y2={176} style={{ stroke: ink, strokeWidth: 4 }} />
    <path d="M40,120 L110,120 M40,140 L90,140" style={{ stroke: actor, strokeWidth: 5, strokeLinecap: 'round', strokeOpacity: 0.35 }} />
    <g transform="translate(250,124) scale(0.88)"><Quadruped x={0} y={0} angle={0} /></g>
  </svg>;
}

function Brick({ x, y, color }: { x: number; y: number; color: string }) {
  return <g>
    <rect x={x + 8} y={y - 6} width={12} height={7} rx={2} style={{ fill: color }} />
    <rect x={x + 40} y={y - 6} width={12} height={7} rx={2} style={{ fill: color }} />
    <rect x={x} y={y} width={60} height={22} rx={3} style={{ fill: color }} />
  </g>;
}

function StackSketch() {
  return <svg viewBox="0 0 448 200" width={448} height={200}>
    <line x1={10} y1={190} x2={438} y2={190} style={{ stroke: ink, strokeWidth: 4 }} />
    <rect x={60} y={160} width={80} height={30} rx={6} style={{ fill: muted }} />
    <path d="M100,160 L170,60 L290,70" style={{ fill: 'none', stroke: ink, strokeWidth: 14, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <circle cx={100} cy={160} r={10} style={{ fill: panel, stroke: ink, strokeWidth: 4 }} />
    <circle cx={170} cy={60} r={10} style={{ fill: panel, stroke: ink, strokeWidth: 4 }} />
    <path d="M290,70 L290,88 M268,88 L312,88 M268,88 L268,108 M312,88 L312,108" style={{ fill: 'none', stroke: ink, strokeWidth: 6, strokeLinecap: 'round' }} />
    <Brick x={260} y={110} color={critic} />
    <Brick x={260} y={146} color={entropy} />
    <Brick x={260} y={168} color={actor} />
  </svg>;
}

function ValveSketch() {
  return <svg viewBox="0 0 448 200" width={448} height={200}>
    <Arrowheads />
    {/* caméra et champ de vision */}
    <polygon points="78,104 196,62 196,170 78,130" style={{ fill: muted, fillOpacity: 0.12 }} />
    <rect x={14} y={96} width={64} height={42} rx={8} style={{ fill: muted }} />
    <rect x={30} y={88} width={20} height={10} rx={3} style={{ fill: muted }} />
    <circle cx={46} cy={117} r={12} style={{ fill: panel }} />
    {/* vanne vue de dessus : volant à trois branches */}
    <circle cx={280} cy={115} r={56} style={{ fill: soft }} />
    <circle cx={280} cy={115} r={44} style={{ fill: 'none', stroke: entropy, strokeWidth: 8 }} />
    <path d="M280,115 L280,71 M280,115 L242,137 M280,115 L318,137" style={{ stroke: entropy, strokeWidth: 7, strokeLinecap: 'round' }} />
    <circle cx={280} cy={115} r={10} style={{ fill: entropy }} />
    {/* sens de rotation */}
    <path d="M344,138 A68,68 0 0 1 216,138" style={{ fill: 'none', stroke: ink, strokeWidth: 4 }} markerEnd="url(#ah-ink)" />
    {/* main : paume et trois doigts posés sur le volant */}
    <rect x={226} y={0} width={108} height={20} rx={9} style={{ fill: ink }} />
    <path d="M242,18 L238,46 L252,72 M280,18 L280,64 M318,18 L322,46 L308,72" style={{ fill: 'none', stroke: ink, strokeWidth: 11, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
  </svg>;
}

function Result({ value, color, title, detail, sketch }: { value: string; color: string; title: string; detail: string; sketch: ReactNode }) {
  return <div style={{ background: panel, border: `2px solid ${rule}`, borderTop: `10px solid ${color}`, borderRadius: 'var(--osd-radius)', padding: '32px 36px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <span style={{ fontFamily: 'var(--osd-font-display)', fontSize: 120, fontWeight: 800, lineHeight: 1, color, letterSpacing: -4 }}>{value}</span>
    <span style={{ fontSize: 40, fontWeight: 800 }}>{title}</span>
    <span style={{ fontSize: 30, color: muted }}>{detail}</span>
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: `2px solid ${soft}` }}>{sketch}</div>
  </div>;
}

const Results: Page = () => <Frame kicker="Cas réels" speaker={QUENTIN} title="D’autres robots, en quelques heures">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
    <Result value="2 h" color={actor} title="Marcher" detail="robot à 4 pattes" sketch={<WalkSketch />} />
    <Result value="2 h" color={critic} title="Empiler des Lego" detail="bras à 7 articulations" sketch={<StackSketch />} />
    <Result value="20 h" color={entropy} title="Tourner une vanne" detail="main robot + caméra" sketch={<ValveSketch />} />
  </div>
</Frame>;

// ---------- Quand l'utiliser ----------

function Algo({ x, y, name, strong }: { x: number; y: number; name: string; strong?: boolean }) {
  return <g>
    <rect x={x - 140} y={y - 42} width={280} height={84} rx={18} style={{ fill: strong ? actor : panel, stroke: strong ? actor : rule, strokeWidth: 3 }} />
    <text x={x} y={y + 13} textAnchor="middle" style={{ fill: strong ? '#FFFFFF' : '#121A22', fontSize: 38, fontWeight: 800 }}>{name}</text>
  </g>;
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', alignItems: 'baseline', fontSize: 36, fontWeight: 600 }}>
    <span style={{ fontWeight: 800, fontSize: 40, color: ok ? critic : env }}>{ok ? '✓' : '✗'}</span>
    <span>{children}</span>
  </div>;
}

const WhenToUse: Page = () => <Frame kicker="Quand l’utiliser" speaker={QUENTIN} title="Quand choisir SAC ?">
  <div style={{ display: 'grid', gridTemplateColumns: '860px 1fr', gap: 80, alignItems: 'center' }}>
    <svg viewBox="0 0 1000 600" width={860} height={516}>
      <Arrowheads />
      <line x1={110} y1={540} x2={980} y2={540} style={{ stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
      <line x1={110} y1={540} x2={110} y2={20} style={{ stroke: muted, strokeWidth: 3 }} markerEnd="url(#ah-muted)" />
      <text x={320} y={588} textAnchor="middle" style={{ fill: muted, fontSize: 30 }}>discret</text>
      <text x={760} y={588} textAnchor="middle" style={{ fill: muted, fontSize: 30 }}>continu</text>
      <text x={76} y={160} textAnchor="middle" transform="rotate(-90 76 160)" style={{ fill: muted, fontSize: 30 }}>réutilise</text>
      <text x={76} y={420} textAnchor="middle" transform="rotate(-90 76 420)" style={{ fill: muted, fontSize: 30 }}>jette</text>
      <line x1={540} y1={30} x2={540} y2={530} style={{ stroke: rule, strokeWidth: 2, strokeDasharray: '8 8' }} />
      <line x1={120} y1={300} x2={970} y2={300} style={{ stroke: rule, strokeWidth: 2, strokeDasharray: '8 8' }} />
      <Algo x={320} y={160} name="DQN" />
      <Algo x={540} y={425} name="PPO" />
      <Algo x={770} y={95} name="TD3" />
      <Algo x={770} y={215} name="SAC" strong />
    </svg>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <Check ok>Actions continues</Check>
      <Check ok>Essais coûteux</Check>
      <Check ok>Besoin de robustesse</Check>
      <div style={{ height: 10 }} />
      <Check ok={false}>Peu d’actions → DQN</Check>
      <Check ok={false}>Simulation massive → PPO</Check>
    </div>
  </div>
</Frame>;

// ---------- À retenir ----------

function Recap({ color, children }: { color: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 34, alignItems: 'center' }}>
    <div style={{ background: color, borderRadius: 9, height: 70 }} />
    <div style={{ fontSize: 50, fontWeight: 800 }}>{children}</div>
  </div>;
}

const Takeaways: Page = () => <Frame kicker="À retenir" speaker={QUENTIN} title="SAC en 3 idées">
  <div style={{ display: 'flex', flexDirection: 'column', gap: 46 }}>
    <Recap color={actor}>Un acteur qui choisit, deux critiques qui notent</Recap>
    <Recap color={env}>Un replay buffer pour réutiliser les essais</Recap>
    <Recap color={entropy}>Un bonus d’entropie pour explorer</Recap>
  </div>
  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 60, paddingTop: 30, borderTop: `2px solid ${rule}` }}>
    <div style={{ fontSize: 22, color: muted, lineHeight: 1.6, fontFamily: mono }}>
      Haarnoja et al., ICML 2018 · arxiv.org/abs/1812.05905<br />
      bair.berkeley.edu/blog/2018/12/14/sac · spinningup.openai.com
    </div>
    <div style={{ fontFamily: 'var(--osd-font-display)', fontSize: 80, fontWeight: 800, color: actor, lineHeight: 1 }}>Questions ?</div>
  </div>
</Frame>;

export const meta: SlideMeta = {
  title: 'Soft Actor-Critic',
  createdAt: '2026-11-15T14:38:19.067Z',
};

// Notes orales, une par page. Total visé : environ 7 min 30.
// Hugo : pages 1 à 4 (~2 min 30) · Mathis : pages 5 à 7 (~2 min 30) · Quentin : pages 8 à 11 (~2 min 30).
export const notes: (string | undefined)[] = [
  `On vous présente SAC, Soft Actor-Critic. C'est un algorithme d’apprentissage par renforcement sorti en 2018, à Berkeley.
Son idée centrale, c’est d’apprendre à agir efficacement tout en continuant à explorer.
Je vais présenter le problème et l’idée générale. Mathis expliquera comment c'est construit et comment on le règle et Quentin finira avec des exemples réels et quand l'utiliser.
Le dessin à droite, on y revient tout de suite.`,
  `Pour comprendre SAC, on part d’un algorithme appelé DQN.
On lui donne la situation actuelle, par exemple la position d’un personnage dans un jeu. Son réseau attribue une note à chaque action possible : gauche, haut, bas ou droite. Cette note estime ce que l’action peut rapporter à long terme. On choisit généralement celle qui a la meilleure note.
Mais cette approche présente deux limites.
Premièrement, pour commander un moteur, l’action peut prendre une infinité de valeurs. On ne peut donc plus prévoir une sortie du réseau pour chaque action.
Deuxièmement, pour explorer, DQN choisit parfois une action au hasard, sans tenir compte de sa note.
SAC répond à ces difficultés : il est adapté aux actions continues et apprend une façon de varier ses choix.`,
  `L'idée de SAC : en plus de la récompense, on donne un bonus à l'agent quand il garde plusieurs options ouvertes. Ce bonus, c'est l'entropie.
À gauche, entropie faible : l'agent fait toujours exactement la même action.
À droite, entropie forte : il hésite entre plusieurs actions, et surtout entre les bonnes.
Ça remplace ε-greedy : l'agent explore autour des bonnes actions au lieu de tirer n'importe quoi.
Petite précision : ce α alpha représente le poids du bonus.`,
  `α règle le dosage. Les pointillés, c'est la qualité de chaque action ; la courbe pleine, ce que l'agent choisit.
α trop faible : il met tout sur une seule action, il est figé.
α bien dosé : il explore les deux bonnes zones.
α trop fort : il joue presque au hasard.
Et dans SAC, on n'a pas à le choisir : α est appris pendant l'entraînement, comme les poids des réseaux. Je laisse Mathis vous montrer comment c'est construit.`,
  `MATHIS · ≈ 0:55
SAC, c'est un acteur et deux critiques, trois réseaux de neurones.
L'acteur reçoit l'état et sort directement une action, même continue. Ça règle le premier problème du DQN.
Les critiques, ce sont des réseaux Q comme dans le DQN : ils prennent l'état et l'action, et donnent une note. Ici le premier dit 12, le second dit 8.
On garde le minimum, 8. Un réseau Q a tendance à surestimer certaines actions, et l'acteur irait justement vers ces erreurs. Avec deux réseaux, on prend la note la plus basse pour limiter ce problème.
Ensuite l'acteur se corrige pour aller vers les actions bien notées, en gardant son bonus d'entropie.`,
  `MATHIS · ≈ 0:50
L'entraînement, c'est une boucle en quatre temps.
Un, l'agent agit, avec un peu de hasard.
Deux, il stocke ce qui s'est passé dans le replay buffer, comme pour le DQN.
Trois, il tire 256 souvenirs au hasard, récents ou anciens.
Quatre, il corrige l'acteur, les critiques et α. Et on recommence des centaines de milliers de fois.
Comme on réapprend sur de vieilles expériences, SAC est off-policy : chaque essai sert plusieurs fois. C'est très utile quand un essai coûte cher, par exemple sur un vrai robot.`,
  `MATHIS · ≈ 0:50
Côté hyperparamètres, il y en a six, et on en connaît déjà cinq.
γ, le facteur d'actualisation, à 0,99, comme en Q-learning.
Le taux d'apprentissage des réseaux, 3 fois 10 puissance moins 4.
Un replay buffer d'un million d'expériences, et des batchs de 256.
τ, c'est la vitesse à laquelle les réseaux cibles suivent : dans le DQN on les recopie tous les C pas, dans SAC on les fait glisser un tout petit peu à chaque pas.
Le seul nouveau, c'est α, et il est automatique.
Ces valeurs par défaut marchent bien sur la plupart des problèmes. Quentin va vous montrer ce que ça donne en vrai.`,
  `QUENTIN · ≈ 0:40
Un exemple réel, publié par Berkeley et Google en 2018 : Minitaur, un petit robot à quatre pattes.
Avec SAC, il a appris à marcher en à peu près deux heures, directement sur le vrai robot, pas en simulation.
Il a été entraîné seulement sur sol plat. Et ensuite, il arrive à marcher sur des pentes et à passer des obstacles qu'il n'a jamais vus.
D'après les auteurs, c'est grâce à l'entropie : il a appris plusieurs façons de bouger, donc il s'adapte mieux.`,
  `QUENTIN · ≈ 0:30
Dans le même travail, deux autres robots.
Un bras à sept articulations qui apprend à empiler des Lego en deux heures.
Et une main robot qui apprend à tourner une vanne en vingt heures, en ne voyant que l'image d'une caméra.
Plus largement, SAC est beaucoup utilisé dès que les actions sont continues : robotique, énergie, conduite en simulation.`,
  `QUENTIN · ≈ 0:45
Alors, quand choisir SAC ?
Sur le schéma : en horizontal, actions discrètes ou continues ; en vertical, est-ce que l'algo réutilise ses données.
Le DQN du cours, c'est le discret. PPO jette ses données après chaque mise à jour. TD3 est proche de SAC, mais il faut régler son exploration à la main.
Donc SAC est recommandé quand les actions sont continues, quand chaque essai coûte cher, et quand on veut un comportement robuste.
Par contre, avec peu d'actions discrètes, un DQN suffit. Et si on a un simulateur très rapide qu'on peut lancer des milliers de fois en parallèle, PPO va souvent plus vite.`,
  `QUENTIN · ≈ 0:25
Pour résumer : un acteur qui choisit l'action et deux critiques qui la notent, en gardant la note la plus basse. Un replay buffer pour réutiliser les anciens essais. Et un bonus d'entropie pour explorer, avec α appris automatiquement.
Les sources sont en bas. Merci, vous avez des questions ?`,
];

export default [Cover, Recall, Idea, Thermostat, Architecture, Loop, Hyper, Minitaur, Results, WhenToUse, Takeaways] satisfies Page[];
