(() => {
  'use strict';

  // Somente homologação/teste: consulta sob demanda e cache apenas em memória.
  const API = 'https://oss.exercisedb.dev/api/v1/exercises';
  const ALIASES = {"supino reto com barra":["barbell bench press","bench press"],"supino reto com halteres":["dumbbell bench press","dumbbell press"],"supino inclinado com barra":["incline barbell bench press","barbell incline bench press"],"supino inclinado com halteres":["incline dumbbell bench press","dumbbell incline bench press"],"chest press na maquina":["chest press machine","lever chest press","machine chest press"],"flexao de bracos":["push-up","push up"],"paralelas com enfase no peitoral":["chest dip","dips","parallel bar dip"],"crossover na polia":["cable cross-over","cable crossover","cable fly"],"crucifixo com halteres":["dumbbell fly","dumbbell flye"],"peck deck / voador":["pec deck fly","lever pec deck fly","machine fly"],"barra fixa pronada":["pull-up","wide grip pull-up","pull up"],"puxada frontal pronada":["wide grip lat pulldown","lat pulldown","cable pulldown"],"puxada frontal pegada neutra":["close grip lat pulldown","neutral grip lat pulldown","close-grip front lat pulldown"],"remada curvada com barra":["barbell bent over row","bent-over barbell row","barbell row"],"remada unilateral com halter":["one arm dumbbell row","dumbbell one arm row","single arm dumbbell row"],"remada baixa no cabo":["seated cable row","cable seated row","cable low seated row"],"remada articulada na maquina":["lever seated row","machine row","lever row"],"remada cavalinho":["t-bar row","lever t-bar row","landmine row"],"pullover na polia":["straight arm pulldown","cable straight arm pulldown","cable pullover"],"face pull":["face pull","cable face pull"],"desenvolvimento militar com barra":["barbell standing military press","barbell military press","military press"],"desenvolvimento com halteres":["dumbbell shoulder press","dumbbell seated shoulder press"],"desenvolvimento na maquina":["lever shoulder press","machine shoulder press"],"elevacao lateral com halteres":["dumbbell lateral raise","dumbbell side lateral raise","lateral raise"],"elevacao lateral na polia":["cable lateral raise","cable one arm lateral raise"],"elevacao frontal com halteres":["dumbbell front raise","front raise"],"crucifixo invertido":["reverse fly","rear delt fly","dumbbell reverse fly"],"remada alta com barra":["barbell upright row","upright row"],"rosca direta com barra":["barbell curl","standing barbell curl"],"rosca alternada com halteres":["alternate dumbbell curl","alternating dumbbell curl","dumbbell alternate biceps curl"],"rosca martelo":["hammer curl","dumbbell hammer curl"],"rosca scott":["preacher curl","barbell preacher curl","dumbbell preacher curl"],"rosca na polia baixa":["cable curl","cable standing biceps curl"],"rosca concentrada":["concentration curl","dumbbell concentration curl"],"triceps na polia com barra":["cable pushdown","triceps pushdown","cable triceps pushdown"],"triceps na polia com corda":["cable rope pushdown","rope pushdown","triceps rope pushdown"],"triceps frances com halter":["dumbbell overhead triceps extension","seated dumbbell triceps extension","overhead triceps extension"],"triceps testa com barra":["barbell lying triceps extension","lying triceps extension","skull crusher"],"supino fechado":["close grip bench press","barbell close grip bench press"],"mergulho entre bancos":["bench dip","bench dips"],"agachamento livre com barra":["barbell squat","barbell back squat","squat"],"agachamento goblet":["goblet squat","dumbbell goblet squat"],"agachamento no smith":["smith squat","smith machine squat"],"hack squat":["sled hack squat","hack squat","lever hack squat"],"leg press 45":["sled 45 degree leg press","leg press","sled leg press"],"afundo com halteres":["dumbbell lunge","dumbbell forward lunge"],"passada":["walking lunge","forward lunge","lunge"],"agachamento bulgaro":["bulgarian split squat","dumbbell bulgarian split squat"],"cadeira extensora":["lever leg extension","leg extension"],"levantamento terra romeno":["barbell romanian deadlift","romanian deadlift"],"stiff com barra":["barbell stiff leg deadlift","stiff leg deadlift","barbell straight leg deadlift"],"stiff com halteres":["dumbbell stiff leg deadlift","dumbbell romanian deadlift"],"mesa flexora":["lever lying leg curl","lying leg curl"],"cadeira flexora":["lever seated leg curl","seated leg curl"],"flexora em pe unilateral":["lever standing leg curl","standing leg curl","single leg curl"],"good morning":["barbell good morning","good morning"],"levantamento terra convencional":["barbell deadlift","deadlift"],"hip thrust com barra":["barbell hip thrust","hip thrust"],"elevacao pelvica no solo":["glute bridge","bridge"],"coice na polia":["cable kickback","cable glute kickback"],"abducao de quadril na maquina":["lever seated hip abduction","hip abduction machine","seated hip abduction"],"abducao de quadril na polia":["cable hip abduction","cable standing hip abduction"],"step-up":["step-up","dumbbell step-up","step up"],"panturrilha em pe":["standing calf raise","lever standing calf raise"],"panturrilha sentado":["seated calf raise","lever seated calf raise"],"panturrilha no leg press":["sled calf press on leg press","calf press on leg press","leg press calf raise"],"panturrilha unilateral":["one leg calf raise","single leg calf raise"],"prancha frontal":["front plank","plank"],"prancha lateral":["side plank"],"abdominal crunch":["crunch","abdominal crunch"],"abdominal infra":["reverse crunch","lying leg raise","leg raise"],"dead bug":["dead bug"],"bird dog":["bird dog"],"pallof press":["pallof press","cable pallof press"],"elevacao de joelhos na barra":["hanging knee raise","assisted hanging knee raise"],"esteira - caminhada":["walking on treadmill","treadmill walk","walking treadmill"],"esteira - corrida":["run on treadmill","treadmill running","treadmill run"],"bike ergometrica":["stationary bike","cycling stationary","exercise bike"],"eliptico":["elliptical machine walk","elliptical trainer","elliptical"],"remo ergometrico":["rowing machine","stationary rower","rowing"]};
  const cache = new Map();
  const pending = new WeakSet();

  function norm(v) {
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[°ºª]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function aliasesFor(name) {
    const key = norm(name);
    return ALIASES[key] || [];
  }

  function listFrom(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.dados)) return payload.dados;
    if (Array.isArray(payload?.exercises)) return payload.exercises;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function score(alias, item) {
    const a = norm(alias);
    const b = norm(item?.name);
    if (!a || !b || !item?.gifUrl) return -1;
    if (a === b) return 10000;
    if (b.includes(a) || a.includes(b)) return 7000 + Math.min(a.length, b.length);
    const A = new Set(a.split(' ').filter(Boolean));
    const B = new Set(b.split(' ').filter(Boolean));
    let hit = 0;
    for (const x of A) if (B.has(x)) hit++;
    const ratio = hit / Math.max(A.size, B.size, 1);
    return Math.round(ratio * 1000);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const r = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function lookup(name) {
    const key = norm(name);
    if (!aliasesFor(key).length) return null;
    if (cache.has(key)) return cache.get(key);

    const promise = (async () => {
      let best = null;
      let bestScore = -1;

      for (const alias of aliasesFor(key)) {
        const encoded = encodeURIComponent(alias);
        const urls = [
          `${API}/search?search=${encoded}`,
          `${API}/search?q=${encoded}`,
          `${API}?search=${encoded}&limit=20`
        ];

        for (const url of urls) {
          const payload = await fetchJson(url);
          const items = listFrom(payload);
          if (!items.length) continue;

          for (const item of items) {
            const s = score(alias, item);
            if (s > bestScore) {
              bestScore = s;
              best = item;
            }
          }

          if (bestScore >= 7000) break;
        }
        if (bestScore >= 7000) break;
      }

      return bestScore >= 600 ? best : null;
    })();

    cache.set(key, promise);
    return promise;
  }

  function exerciseName(img) {
    if (!(img instanceof HTMLImageElement) || img.id === 'fotoAluno') return '';

    if (img.id === 'fotoExercicio') {
      const n = document.getElementById('nomeExercicio')?.textContent || '';
      return aliasesFor(n).length ? n : '';
    }

    const alt = img.getAttribute('alt') || '';
    if (aliasesFor(alt).length) return alt;

    const scope = img.closest(
      '.ex,.item,.v4-exercise-card,.v4-exercise-item,.v4-selected-item,.v4-card,.exercicio,.card-exercicio,[data-exercicio-id],[data-id]'
    );
    const label = scope?.querySelector(
      'strong,h2,h3,.v4-exercise-name,.nome-exercicio,[data-exercicio-nome]'
    )?.textContent || '';
    return aliasesFor(label).length ? label : '';
  }

  async function animate(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fusionExerciseDbDone === '1' || pending.has(img)) return;

    const name = exerciseName(img);
    if (!name) return;

    pending.add(img);
    try {
      const match = await lookup(name);
      if (!match?.gifUrl || !document.contains(img)) return;

      img.dataset.fusionExerciseDbDone = '1';
      img.dataset.fusionExerciseDbId = match.exerciseId || '';
      img.dataset.fusionExerciseDbName = match.name || '';
      img.src = match.gifUrl;
    } finally {
      pending.delete(img);
    }
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            io.unobserve(entry.target);
            animate(entry.target);
          }
        }
      }, { rootMargin: '500px 0px' })
    : null;

  function queue(img) {
    if (!(img instanceof HTMLImageElement)) return;
    const name = exerciseName(img);
    if (!name) return;
    if (io) io.observe(img);
    else animate(img);
  }

  function scan(root = document) {
    if (root instanceof HTMLImageElement) queue(root);
    root.querySelectorAll?.('img').forEach(queue);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) scan(node);
        }
      }
      if (m.type === 'attributes' && m.target instanceof HTMLImageElement) queue(m.target);
    }
    const alunoImg = document.getElementById('fotoExercicio');
    if (alunoImg) queue(alunoImg);
  });

  function start() {
    scan();
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'alt']
    });
    console.info('[Fusion] GIFs ExerciseDB gratuitos ativados sob demanda (somente teste).');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
