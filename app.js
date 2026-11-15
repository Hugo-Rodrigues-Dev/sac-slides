/* Présentation autonome : aucune dépendance, aucun appel réseau. */
const slides = [...document.querySelectorAll('.slide')];
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const counter = document.getElementById('counter');
const notes = document.getElementById('notes');
const notesToggle = document.getElementById('notes-toggle');
const speakerNotes = [
  { time: '0:35', text: 'SAC signifie Soft Actor-Critic. C’est un algorithme d’apprentissage par renforcement, proposé en 2018 par Haarnoja et ses collègues. Notre fil conducteur : comment apprendre des actions efficaces sans se fermer trop tôt à d’autres possibilités ? Il est particulièrement adapté aux commandes continues, comme celles d’un robot. Le terme « soft » renvoie à l’objectif régularisé par l’entropie.' },
  { time: '0:55', text: 'Imaginons un bras qui doit atteindre une cible. Il observe ses articulations et la cible, puis applique des couples moteurs. Ces actions sont continues : on choisit une valeur réelle, pas seulement gauche ou droite. La récompense peut pénaliser la distance à la cible et l’effort. C’est un exemple pédagogique, pas une expérience mesurée ici. Une politique est la règle de choix des actions. SAC est model-free : il n’apprend pas explicitement un modèle des transitions pour planifier.' },
  { time: '1:20', text: 'Un agent cherche normalement à maximiser les récompenses futures. SAC ajoute un terme d’entropie, qui mesure la diversité de sa distribution d’actions dans un même état. L’objectif affiché est simplifié : en réalité, on prend une espérance sur les trajectoires et on actualise les termes futurs par gamma. Si plusieurs actions sont bonnes, on préfère conserver plusieurs possibilités plutôt que se concentrer trop vite sur une seule. Alpha règle le poids de cette diversité. Cela encourage l’exploration, mais ne garantit pas de découvrir toutes les bonnes stratégies. Alpha égal à zéro supprime le bonus d’entropie.' },
  { time: '1:20', text: 'L’acteur est un réseau qui produit une distribution d’actions. Dans la version courante pour le continu, c’est une gaussienne transformée pour respecter les bornes des actions. On échantillonne une action pendant l’entraînement. Les deux critiques reçoivent chacun l’état et l’action. Ils estiment une valeur à long terme incluant les futurs bonus d’entropie. On utilise le minimum de leurs estimations pour limiter l’optimisme : par exemple, si Q1 donne 12 et Q2 donne 8, on retient 8. Cela réduit la surestimation sans garantir des valeurs exactes. Nous présentons la version moderne, qui n’utilise plus le réseau V séparé de la première formulation.' },
  { time: '1:15', text: 'L’agent agit et stocke les transitions dans un replay buffer. Il tire ensuite un lot aléatoire de transitions, y compris anciennes. C’est le sens de off-policy : on peut apprendre à partir de données produites par d’anciennes politiques. Les critiques apprennent à rapprocher leur prédiction d’une cible de Bellman, calculée avec la récompense et une estimation du futur. L’acteur apprend à choisir des actions bien évaluées tout en conservant de l’entropie. Dans la variante présentée, alpha est appris pour viser une entropie cible. Enfin, les paramètres des critiques cibles suivent lentement ceux des critiques entraînés. Le schéma représente la logique, pas un ordre universel de chaque opération interne.' },
  { time: '1:05', text: 'Les valeurs sont des exemples tirés des paramètres par défaut de Stable-Baselines3, pas un réglage optimal. Alpha et l’entropie cible contrôlent le compromis avec la diversité. Alpha automatique peut monter ou descendre : il ne suit pas forcément une diminution progressive. Gamma règle le poids du futur. Le taux d’apprentissage contrôle la vitesse des mises à jour. Le batch est le nombre de transitions par mise à jour ; le buffer est le nombre stocké. Tau contrôle le suivi des réseaux cibles : avec 0,005, on mélange 0,5 % des nouveaux paramètres et 99,5 % des anciens paramètres cibles à chaque mise à jour.' },
  { time: '1:00', text: 'Le buffer permet de tirer davantage d’apprentissage des interactions déjà collectées. L’entropie encourage l’exploration et SAC obtient de bons résultats sur de nombreuses tâches de contrôle continu. En contrepartie, plusieurs réseaux et le buffer demandent du calcul et de la mémoire. Des récompenses très rares restent difficiles : varier localement les actions ne suffit pas toujours à découvrir une réussite lointaine. PPO est on-policy et apprend principalement à partir des données récentes de sa politique de collecte. Cela ne signifie pas que SAC est toujours plus rapide en temps réel ou meilleur : la comparaison dépend de la tâche et du budget.' },
  { time: '0:55', text: 'Les auteurs ont montré des applications réelles : locomotion d’un quadrupède et manipulation robotique. Les expériences de Berkeley constituent les exemples, et les liens sont sur la slide suivante. SAC classique convient aux actions continues ; des variantes discrètes existent, mais le SAC standard de Stable-Baselines3 ne prend pas en charge les actions discrètes. Le message à retenir : l’acteur choisit, les critiques évaluent, le buffer réutilise les expériences et l’entropie encourage la diversité. L’algorithme n’assure pas à lui seul la sécurité des mouvements sur un vrai robot.' },
  { time: '0:15', text: 'Les deux articles sont les références scientifiques. Pour reprendre l’intuition, commencer par le billet des auteurs sur le blog de Berkeley. Spinning Up explique les équations et le pseudo-code ; Stable-Baselines3 sert de référence pratique. Fin de la présentation, puis questions. Durée indicative totale : 8 minutes 40.' }
];
let index = 0;

function indexFromHash() {
  const match = /^#slide-(\d+)$/.exec(location.hash);
  return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
}
function render() {
  slides.forEach((slide, position) => {
    const active = position === index;
    slide.classList.toggle('active', active);
    slide.inert = !active;
    slide.setAttribute('aria-hidden', String(!active));
  });
  previous.disabled = index === 0;
  next.disabled = index === slides.length - 1;
  counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  document.getElementById('progress-fill').style.width = `${((index + 1) / slides.length) * 100}%`;
  document.getElementById('notes-title').textContent = `${index + 1}. ${slides[index].dataset.title} · ${speakerNotes[index].time}`;
  document.getElementById('notes-content').textContent = speakerNotes[index].text;
  document.title = `${slides[index].dataset.title} — SAC`;
}
function goTo(position) {
  index = Math.max(0, Math.min(slides.length - 1, position));
  if (location.hash !== `#slide-${index + 1}`) location.hash = `slide-${index + 1}`;
  render();
}
function resize() {
  const scale = Math.min(window.innerWidth / 1280, Math.max(1, window.innerHeight - 70) / 720);
  document.documentElement.style.setProperty('--deck-scale', scale);
}
function toggleNotes(force) {
  const show = force ?? notes.hidden;
  notes.hidden = !show;
  notesToggle.setAttribute('aria-expanded', String(show));
  notesToggle.setAttribute('aria-label', show ? 'Masquer les notes orales' : 'Afficher les notes orales');
  if (!show && notes.contains(document.activeElement)) notesToggle.focus();
}
async function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* Le navigateur peut refuser le plein écran ; la présentation reste utilisable. */ }
}
previous.addEventListener('click', () => goTo(index - 1));
next.addEventListener('click', () => goTo(index + 1));
notesToggle.addEventListener('click', () => toggleNotes());
document.getElementById('notes-close').addEventListener('click', () => toggleNotes(false));
document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
document.getElementById('fullscreen').hidden = !document.fullscreenEnabled;
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
    if (event.key === ' ' && event.target.closest('button, a')) return;
    event.preventDefault(); goTo(index + 1);
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault(); goTo(index - 1);
  } else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
  else if (event.key === 'End') { event.preventDefault(); goTo(slides.length - 1); }
  else if (event.key.toLowerCase() === 'n') toggleNotes();
  else if (event.key.toLowerCase() === 'f') toggleFullscreen();
  else if (event.key === 'Escape') toggleNotes(false);
});
window.addEventListener('hashchange', () => { index = indexFromHash(); render(); });
window.addEventListener('resize', resize);
// Rendre toutes les slides accessibles à l'impression, y compris dans l'arbre d'accessibilité.
window.addEventListener('beforeprint', () => slides.forEach(slide => { slide.inert = false; slide.removeAttribute('aria-hidden'); }));
window.addEventListener('afterprint', render);
resize();
index = indexFromHash();
render();
