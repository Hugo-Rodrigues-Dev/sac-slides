import { useSlidePageNumber, type DesignSystem, type Page, type SlideMeta } from '@open-slide/core';
import type { CSSProperties, ReactNode } from 'react';

export const design: DesignSystem = {
  palette: { bg: '#10191d', text: '#edf2ed', accent: '#82e5d4' },
  fonts: {
    display: '"Segoe UI", Arial, sans-serif',
    body: '"Segoe UI", Arial, sans-serif',
  },
  typeScale: { hero: 180, body: 38 },
  radius: 0,
};

const muted = '#a8b9bd';
const warm = '#ffb484';
const rule = '#344348';
const mono = '"Cascadia Code", Consolas, monospace';
const accent = 'var(--osd-accent)';
const text = 'var(--osd-text)';
const paragraph: CSSProperties = { margin: 0, fontSize: 'var(--osd-size-body)', lineHeight: 1.45 };
const label: CSSProperties = { fontFamily: mono, fontSize: 24, letterSpacing: 2, color: muted };
const columns: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100 };

function Footer() {
  const { current, total } = useSlidePageNumber();
  return <footer style={{ position: 'absolute', left: 120, right: 120, bottom: 40, display: 'flex', justifyContent: 'space-between', ...label, fontSize: 20 }}>
    <span>SAC / CONTRÔLE CONTINU</span>
    <span style={{ color: accent }}>{String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
  </footer>;
}

function Frame({ section, title, takeaway, children }: { section: string; title?: ReactNode; takeaway?: ReactNode; children: ReactNode }) {
  return <section style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: 'var(--osd-bg)', color: text, fontFamily: 'var(--osd-font-body)', padding: '100px 120px 120px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ ...label, color: accent, textTransform: 'uppercase', marginBottom: 34 }}>{section}</div>
    {title && <h2 style={{ margin: '0 0 48px', fontFamily: 'var(--osd-font-display)', fontSize: 76, lineHeight: 1.12, letterSpacing: -2, fontWeight: 650 }}>{title}</h2>}
    <div data-sac-content style={{ flex: 1, minHeight: 0 }}>{children}</div>
    {takeaway && <p style={{ margin: '32px 0 0', paddingTop: 25, borderTop: `1px solid ${rule}`, fontSize: 30, lineHeight: 1.4, color: muted }}>{takeaway}</p>}
    <Footer />
  </section>;
}

const Cover: Page = () => <Frame section="Apprentissage par renforcement">
  <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 100, alignItems: 'center', height: '100%' }}>
    <div>
      <div aria-hidden="true" style={{ fontSize: 240, fontWeight: 700, letterSpacing: -16, lineHeight: 1 }}>SAC<span style={{ color: accent }}>.</span></div>
      <h1 style={{ fontSize: 74, fontWeight: 600, letterSpacing: -2, lineHeight: 1.15, margin: '26px 0 38px' }}>Soft Actor-Critic</h1>
      <p style={{ ...paragraph, fontSize: 47, color: muted }}>Apprendre à agir.<br />Continuer à explorer.</p>
    </div>
    <div style={{ borderLeft: `1px solid ${rule}`, paddingLeft: 75 }}>
      <p style={{ ...label, color: accent }}>L’idée centrale</p>
      <p style={{ margin: '32px 0 42px', fontSize: 66, lineHeight: 1.25 }}>Récompense<br /><span style={{ color: accent }}>+</span> diversité<br />des actions</p>
      <p style={label}>Haarnoja et al. · 2018</p>
    </div>
  </div>
</Frame>;

function Signal({ name, symbol, children }: { name: string; symbol: string; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 18, borderTop: `1px solid ${rule}`, padding: '28px 0' }}>
    <div style={{ fontSize: 36, fontWeight: 600 }}>{name} <span style={{ color: accent, fontFamily: mono }}>{symbol}</span></div>
    <p style={{ ...paragraph, fontSize: 34, color: muted }}>{children}</p>
  </div>;
}

const Robot: Page = () => <Frame section="01 / Le problème" title={<>Un bras robotique<br />doit atteindre une cible</>} takeaway="Une politique π transforme l’état observé en un choix d’action.">
  <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 80, alignItems: 'center' }}>
    <div>
      <Signal name="État" symbol="s">Angles, vitesses des articulations<br />et position de la cible</Signal>
      <Signal name="Action" symbol="a">Couples appliqués aux moteurs<br /><span style={{ color: accent }}>Des valeurs continues</span></Signal>
      <Signal name="Récompense" symbol="r">Se rapprocher de la cible,<br />limiter l’effort</Signal>
    </div>
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 44 }}>
      <p style={{ ...label, color: accent }}>Le défi</p>
      <p style={{ ...paragraph, fontSize: 43, marginTop: 30 }}>Répéter un mouvement<br />qui fonctionne…<br /><span style={{ color: warm }}>ou essayer mieux ?</span></p>
    </div>
  </div>
</Frame>;

const Entropy: Page = () => <Frame section="02 / L’idée de SAC" title={<>Récompense <span style={{ color: accent }}>+ entropie</span></>} takeaway={<>α règle le compromis : plus il est élevé, plus la diversité pèse dans l’objectif.</>}>
  <p style={{ ...paragraph, color: muted }}>Bien agir, tout en conservant de la diversité.</p>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 56, borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, padding: '56px 0', margin: '58px 0 54px' }}>
    <span>Récompenses futures</span><span style={{ color: muted }}>+</span><span><span style={{ color: accent }}>α</span> × Entropie</span>
  </div>
  <div style={columns}>
    <div><h3 style={{ margin: '0 0 20px', fontSize: 40 }}>Faible entropie</h3><p style={{ ...paragraph, color: muted }}>Dans un même état,<br />des actions très similaires.</p></div>
    <div><h3 style={{ margin: '0 0 20px', fontSize: 40 }}>Forte entropie</h3><p style={{ ...paragraph, color: muted }}>Dans un même état,<br />des actions plus variées.</p></div>
  </div>
</Frame>;

const Architecture: Page = () => <Frame section="03 / L’architecture" title="Un acteur, deux critiques" takeaway="L’acteur privilégie les actions bien évaluées, avec un bonus d’entropie.">
  <div style={{ display: 'grid', gridTemplateColumns: '190px 70px 1fr 70px 1.1fr', gap: 32, alignItems: 'center', margin: '35px 0 45px' }}>
    <div><p style={label}>Entrée</p><p style={{ ...paragraph, fontSize: 48, marginTop: 22 }}>État s</p></div>
    <span aria-hidden="true" style={{ fontSize: 64, color: muted }}>→</span>
    <div style={{ borderTop: `3px solid ${accent}`, paddingTop: 32 }}><p style={{ ...label, color: accent }}>Acteur π</p><p style={{ ...paragraph, fontSize: 48, margin: '22px 0' }}>Propose<br />une action a</p><p style={{ ...paragraph, fontSize: 30, color: muted }}>Politique stochastique</p></div>
    <span aria-hidden="true" style={{ fontSize: 64, color: muted }}>→</span>
    <div style={{ borderTop: `3px solid ${warm}`, paddingTop: 32 }}><p style={{ ...label, color: warm }}>Critiques Q₁ et Q₂</p><p style={{ ...paragraph, fontSize: 48, margin: '22px 0' }}>Évaluent<br />le couple (s, a)</p><p style={{ ...paragraph, fontSize: 30, color: muted }}>Valeur à long terme</p></div>
  </div>
  <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 40, display: 'flex', alignItems: 'center', gap: 70 }}>
    <span style={{ fontFamily: mono, fontSize: 48, color: warm }}>min(Q₁, Q₂)</span>
    <p style={{ ...paragraph, color: muted }}>Prendre l’estimation la plus basse<br />pour limiter la surestimation.</p>
  </div>
</Frame>;

function LearningStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <li style={{ display: 'flex', gap: 42, borderTop: `1px solid ${rule}`, padding: '16px 0' }}>
    <span style={{ ...label, fontSize: 32, color: accent }}>{number}</span>
    <div><strong style={{ fontSize: 36, fontWeight: 600 }}>{title}</strong><p style={{ ...paragraph, fontSize: 32, color: muted, marginTop: 7 }}>{children}</p></div>
  </li>;
}

const Learning: Page = () => <Frame section="04 / L’apprentissage" title="Agir, mémoriser, réutiliser" takeaway={<>Off-policy : les expériences des anciennes politiques servent encore à apprendre.</>}>
  <ol style={{ padding: 0, margin: 0, listStyle: 'none' }}>
    <LearningStep number="01" title="Interagir">Choisir une action et observer la transition (s, a, r, s′).</LearningStep>
    <LearningStep number="02" title="Mémoriser">Stocker l’expérience dans le replay buffer.</LearningStep>
    <LearningStep number="03" title="Apprendre sur un lot tiré au hasard">Mettre à jour les critiques, l’acteur et le coefficient α.</LearningStep>
    <LearningStep number="04" title="Faire évoluer lentement les critiques cibles">Stabiliser les valeurs utilisées pour apprendre.</LearningStep>
  </ol>
</Frame>;

const cell: CSSProperties = { padding: '10px 0', borderBottom: `1px solid ${rule}`, textAlign: 'left', fontWeight: 400 };
function Parameter({ name, role, example }: { name: string; role: string; example: string }) {
  return <tr><th scope="row" style={{ ...cell, color: text, width: 490, fontWeight: 500 }}>{name}</th><td style={{ ...cell, color: muted }}>{role}</td><td style={{ ...cell, fontFamily: mono, color: accent, paddingLeft: 40, whiteSpace: 'nowrap' }}>{example}</td></tr>;
}

const Parameters: Page = () => <Frame section="05 / Les réglages" title="Les hyperparamètres essentiels" takeaway="α automatique vise une entropie cible. Ces valeurs restent à adapter à la tâche.">
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 32 }}>
    <caption style={{ textAlign: 'left', color: muted, fontSize: 25, paddingBottom: 24 }}>Exemples : valeurs par défaut de Stable-Baselines3</caption>
    <thead><tr><th scope="col" style={{ ...cell, ...label, color: accent }}>PARAMÈTRE</th><th scope="col" style={{ ...cell, ...label, color: accent }}>RÔLE</th><th scope="col" style={{ ...cell, ...label, color: accent, paddingLeft: 40 }}>EXEMPLE</th></tr></thead>
    <tbody>
      <Parameter name="α et entropie cible" role="Poids de la diversité et cible d’ajustement" example="Auto" />
      <Parameter name="γ — actualisation" role="Importance des récompenses futures" example="0,99" />
      <Parameter name="Taux d’apprentissage" role="Amplitude des mises à jour" example="3 × 10⁻⁴" />
      <Parameter name="Taille du lot" role="Expériences par mise à jour" example="256" />
      <Parameter name="Capacité du buffer" role="Expériences conservées" example="10⁶" />
      <Parameter name="τ — mise à jour cible" role="Évolution des critiques cibles" example="0,005" />
    </tbody>
  </table>
</Frame>;

const item: CSSProperties = { fontSize: 35, lineHeight: 1.4, margin: '24px 0' };
const Tradeoffs: Page = () => <Frame section="06 / Le compromis pratique" title="Pourquoi choisir SAC ?" takeaway="SAC reste sensible à la tâche et aux réglages : il n’est pas systématiquement le meilleur.">
  <div style={columns}>
    <div><h3 style={{ margin: '0 0 25px', fontSize: 42, color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 26 }}>Avantages</h3><ul style={{ paddingLeft: 30 }}><li style={item}>Réutilise les expériences collectées</li><li style={item}>Encourage l’exploration via l’entropie</li><li style={item}>De bons résultats en contrôle continu</li></ul></div>
    <div><h3 style={{ margin: '0 0 25px', fontSize: 42, color: warm, borderBottom: `2px solid ${warm}`, paddingBottom: 26 }}>Limites</h3><ul style={{ paddingLeft: 30 }}><li style={item}>Plusieurs réseaux à entraîner</li><li style={item}>Coût en mémoire et en calcul</li><li style={item}>Récompenses rares : difficulté persistante</li></ul></div>
  </div>
  <p style={{ ...paragraph, fontSize: 35, color: muted, marginTop: 55 }}>Face à une méthode on-policy comme PPO,<br /><span style={{ color: text }}>le buffer permet de réutiliser les données.</span></p>
</Frame>;

const Applications: Page = () => <Frame section="07 / Les applications" title={<>Le contrôle continu,<br /><span style={{ color: accent }}>notamment en robotique</span></>}>
  <div style={{ display: 'flex', gap: 170, margin: '36px 0 45px' }}>
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 35 }}><p style={label}>Manipulation</p><p style={{ ...paragraph, fontSize: 47, marginTop: 22 }}>Commander<br />un bras robotique</p></div>
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 35 }}><p style={label}>Locomotion</p><p style={{ ...paragraph, fontSize: 47, marginTop: 22 }}>Faire marcher<br />un quadrupède</p></div>
  </div>
  <p style={{ ...paragraph, color: muted, fontSize: 30 }}>Version classique : actions continues. Des variantes existent pour le discret.</p>
  <blockquote style={{ margin: '55px 0 0', paddingTop: 38, borderTop: `1px solid ${rule}`, fontSize: 43, lineHeight: 1.5, color: accent }}>Un acteur choisit, deux critiques évaluent.<br />La mémoire réutilise, l’entropie encourage l’exploration.</blockquote>
</Frame>;

function Source({ title, description, href }: { title: string; description: string; href: string }) {
  return <li style={{ borderTop: `1px solid ${rule}`, padding: '13px 0', listStyle: 'none' }}><a href={href} target="_blank" rel="noopener noreferrer" style={{ color: text, textDecoration: 'none' }}><strong style={{ display: 'block', fontSize: 36, fontWeight: 500 }}>{title} <span style={{ color: accent }}>↗</span></strong><span style={{ display: 'block', fontSize: 29, color: muted, marginTop: 7 }}>{description}</span></a></li>;
}

const Sources: Page = () => <Frame section="Pour approfondir" title="Sources & questions">
  <ol style={{ margin: 0, padding: 0 }}>
    <Source title="Haarnoja et al. · ICML 2018" description="Soft Actor-Critic — l’article fondateur" href="https://proceedings.mlr.press/v80/haarnoja18b.html" />
    <Source title="Haarnoja et al. · 2018 / 2019" description="Algorithms and Applications — notamment l’ajustement de α" href="https://arxiv.org/abs/1812.05905" />
    <Source title="OpenAI · Spinning Up" description="Équations, architecture et pseudo-code" href="https://spinningup.openai.com/en/latest/algorithms/sac.html" />
    <Source title="Berkeley · BAIR" description="Explications des auteurs et exemples de robots réels" href="https://bair.berkeley.edu/blog/2018/12/14/sac/" />
    <Source title="Stable-Baselines3" description="Implémentation et hyperparamètres" href="https://stable-baselines3.readthedocs.io/en/master/modules/sac.html" />
  </ol>
</Frame>;

export const meta: SlideMeta = {
  title: 'Soft Actor-Critic · Robotique',
  createdAt: '2026-11-15T14:38:19.067Z',
};

// Notes indexées sur les neuf pages ; affichées par la vue présentateur native.
export const notes: (string | undefined)[] = [
  "Durée indicative : 0:35\n\nSAC signifie Soft Actor-Critic. C’est un algorithme d’apprentissage par renforcement, proposé en 2018 par Haarnoja et ses collègues. Notre fil conducteur : comment apprendre des actions efficaces sans se fermer trop tôt à d’autres possibilités ? Il est particulièrement adapté aux commandes continues, comme celles d’un robot. Le terme « soft » renvoie à l’objectif régularisé par l’entropie.\n\nSource : https://proceedings.mlr.press/v80/haarnoja18b.html",
  "Durée indicative : 0:55\n\nImaginons un bras qui doit atteindre une cible. Il observe ses articulations et la cible, puis applique des couples moteurs. Ces actions sont continues : on choisit une valeur réelle, pas seulement gauche ou droite. La récompense peut pénaliser la distance à la cible et l’effort. C’est un exemple pédagogique, pas une expérience mesurée ici. Une politique est la règle de choix des actions. SAC est model-free : il n’apprend pas explicitement un modèle des transitions pour planifier.\n\nSource : https://bair.berkeley.edu/blog/2018/12/14/sac/",
  "Durée indicative : 1:20\n\nUn agent cherche normalement à maximiser les récompenses futures. SAC ajoute un terme d’entropie, qui mesure la diversité de sa distribution d’actions dans un même état. L’objectif affiché est simplifié : en réalité, on prend une espérance sur les trajectoires et on actualise les termes futurs par gamma. Si plusieurs actions sont bonnes, on préfère conserver plusieurs possibilités plutôt que se concentrer trop vite sur une seule. Alpha règle le poids de cette diversité. Cela encourage l’exploration, mais ne garantit pas de découvrir toutes les bonnes stratégies. Alpha égal à zéro supprime le bonus d’entropie.\n\nSource : https://spinningup.openai.com/en/latest/algorithms/sac.html",
  "Durée indicative : 1:20\n\nL’acteur est un réseau qui produit une distribution d’actions. Dans la version courante pour le continu, c’est une gaussienne transformée pour respecter les bornes des actions. On échantillonne une action pendant l’entraînement. Les deux critiques reçoivent chacun l’état et l’action. Ils estiment une valeur à long terme incluant les futurs bonus d’entropie. On utilise le minimum de leurs estimations pour limiter l’optimisme : par exemple, si Q1 donne 12 et Q2 donne 8, on retient 8. Cela réduit la surestimation sans garantir des valeurs exactes. Nous présentons la version moderne, qui n’utilise plus le réseau V séparé de la première formulation.\n\nSource : https://spinningup.openai.com/en/latest/algorithms/sac.html",
  "Durée indicative : 1:15\n\nL’agent agit et stocke les transitions dans un replay buffer. Il tire ensuite un lot aléatoire de transitions, y compris anciennes. C’est le sens de off-policy : on peut apprendre à partir de données produites par d’anciennes politiques. Les critiques apprennent à rapprocher leur prédiction d’une cible de Bellman, calculée avec la récompense et une estimation du futur. L’acteur apprend à choisir des actions bien évaluées tout en conservant de l’entropie. Dans la variante présentée, alpha est appris pour viser une entropie cible. Enfin, les paramètres des critiques cibles suivent lentement ceux des critiques entraînés. Le schéma représente la logique, pas un ordre universel de chaque opération interne.\n\nSource : https://arxiv.org/abs/1812.05905",
  "Durée indicative : 1:05\n\nLes valeurs sont des exemples tirés des paramètres par défaut de Stable-Baselines3, pas un réglage optimal. Alpha et l’entropie cible contrôlent le compromis avec la diversité. Alpha automatique peut monter ou descendre : il ne suit pas forcément une diminution progressive. Gamma règle le poids du futur. Le taux d’apprentissage contrôle la vitesse des mises à jour. Le batch est le nombre de transitions par mise à jour ; le buffer est le nombre stocké. Tau contrôle le suivi des réseaux cibles : avec 0,005, on mélange 0,5 % des nouveaux paramètres et 99,5 % des anciens paramètres cibles à chaque mise à jour.\n\nSource : https://stable-baselines3.readthedocs.io/en/master/modules/sac.html",
  "Durée indicative : 1:00\n\nLe buffer permet de tirer davantage d’apprentissage des interactions déjà collectées. L’entropie encourage l’exploration et SAC obtient de bons résultats sur de nombreuses tâches de contrôle continu. En contrepartie, plusieurs réseaux et le buffer demandent du calcul et de la mémoire. Des récompenses très rares restent difficiles : varier localement les actions ne suffit pas toujours à découvrir une réussite lointaine. PPO est on-policy et apprend principalement à partir des données récentes de sa politique de collecte. Cela ne signifie pas que SAC est toujours plus rapide en temps réel ou meilleur : la comparaison dépend de la tâche et du budget.\n\nSource : https://arxiv.org/abs/1812.05905",
  "Durée indicative : 0:55\n\nLes auteurs ont montré des applications réelles : locomotion d’un quadrupède et manipulation robotique. Les expériences de Berkeley constituent les exemples, et les liens sont sur la slide suivante. SAC classique convient aux actions continues ; des variantes discrètes existent, mais le SAC standard de Stable-Baselines3 ne prend pas en charge les actions discrètes. Le message à retenir : l’acteur choisit, les critiques évaluent, le buffer réutilise les expériences et l’entropie encourage la diversité. L’algorithme n’assure pas à lui seul la sécurité des mouvements sur un vrai robot.\n\nSource : https://bair.berkeley.edu/blog/2018/12/14/sac/",
  "Durée indicative : 0:15\n\nLes deux articles sont les références scientifiques. Pour reprendre l’intuition, commencer par le billet des auteurs sur le blog de Berkeley. Spinning Up explique les équations et le pseudo-code ; Stable-Baselines3 sert de référence pratique. Fin de la présentation, puis questions. Durée indicative totale : 8 minutes 40.\n\nSource : https://github.com/Hugo-Rodrigues-Dev/sac-slides/blob/main/docs/sources.md"
];

export default [Cover, Robot, Entropy, Architecture, Learning, Parameters, Tradeoffs, Applications, Sources] satisfies Page[];
