const DOM = {
  appView: document.getElementById('appView'),
  loader: document.getElementById('loader'),
  breadcrumbs: document.getElementById('breadcrumbs'),
  searchInput: document.getElementById('searchInput'),
  themeToggle: document.getElementById('themeToggle'),
  sidebar: document.getElementById('sidebar'),
  menuToggle: document.getElementById('menuToggle'),
  closeSidebar: document.getElementById('closeSidebar'),
  navLinks: document.querySelectorAll('.nav-links li')
};

let appState = {
  data: {
    sections: [],
    allKurals: []
  },
  favorites: JSON.parse(localStorage.getItem('thirukkural_fav')) || [],
  currentView: 'sections', // sections, chapters, kurals, favorites
  currentSection: null,
  currentChapter: null
};

// --- Initialization ---
async function initApp() {
  initTheme();
  initEventListeners();
  await loadData();
}

async function loadData() {
  try {
    let detailRaw, kuralRaw;
    try {
      // Try local files first
      const [d, k] = await Promise.all([fetch('detail.json'), fetch('thirukkural.json')]);
      if (!d.ok || !k.ok) throw new Error("Local files not available");
      detailRaw = await d.json();
      kuralRaw = await k.json();
    } catch (localErr) {
      console.warn("Local fetch failed, trying remote repo...");
      // Fallback to github raw
      const [d, k] = await Promise.all([
        fetch('https://raw.githubusercontent.com/tk120404/thirukkural/master/detail.json'),
        fetch('https://raw.githubusercontent.com/tk120404/thirukkural/master/thirukkural.json')
      ]);
      detailRaw = await d.json();
      kuralRaw = await k.json();
    }

    appState.data.allKurals = kuralRaw.kural;

    // Parse sections and chapters
    const sectionsRaw = detailRaw[0].section.detail;
    appState.data.sections = sectionsRaw.map(sec => {
      let chapters = [];
      sec.chapterGroup.detail.forEach(cg => {
        if (cg.chapters && cg.chapters.detail) {
          chapters = chapters.concat(cg.chapters.detail);
        }
      });
      return {
        id: sec.number,
        name: sec.name,
        translation: sec.translation,
        chapters: chapters.map(ch => ({
          id: ch.number,
          name: ch.name,
          translation: ch.translation,
          start: ch.start,
          end: ch.end
        }))
      };
    });

    DOM.loader.classList.add('hidden');
    DOM.appView.classList.remove('hidden');
    renderSections();
  } catch (err) {
    console.error(err);
    DOM.loader.innerHTML = '<p>Error loading data. Please check your connection.</p>';
  }
}

// --- Event Listeners ---
function initEventListeners() {
  DOM.themeToggle.addEventListener('click', toggleTheme);

  DOM.menuToggle.addEventListener('click', () => {
    DOM.sidebar.classList.add('open');
  });

  DOM.closeSidebar.addEventListener('click', () => {
    DOM.sidebar.classList.remove('open');
  });

  DOM.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      DOM.navLinks.forEach(l => l.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const view = e.currentTarget.dataset.view;
      if (view === 'home') {
        renderSections();
      } else if (view === 'favorites') {
        renderFavorites();
      } else if (view === 'quiz') {
        renderQuizInit();
      }
      DOM.sidebar.classList.remove('open');
    });
  });

  DOM.searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length > 0) {
      handleSearch(term);
    } else {
      // Revert to current view state
      if (appState.currentView === 'sections') renderSections();
      else if (appState.currentView === 'chapters') renderChapters(appState.currentSection);
      else if (appState.currentView === 'kurals') renderKurals(appState.currentChapter);
      else if (appState.currentView === 'favorites') renderFavorites();
    }
  });
}

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  }
  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.body.classList.contains('dark');
  DOM.themeToggle.innerHTML = isDark
    ? '<i class="ph ph-sun"></i> <span>Light Mode</span>'
    : '<i class="ph ph-moon"></i> <span>Dark Mode</span>';
}

// --- Rendering Functions ---
function updateBreadcrumbs(path) {
  let html = `<span class="crumb ${path.length === 1 ? 'active' : ''}" onclick="renderSections()">Home</span>`;

  if (path.length > 1) {
    html += ` <i class="ph ph-caret-right"></i> <span class="crumb ${path.length === 2 ? 'active' : ''}" onclick="renderChapters(appState.currentSection)">${path[1].name}</span>`;
  }
  if (path.length > 2) {
    html += ` <i class="ph ph-caret-right"></i> <span class="crumb active">${path[2].name}</span>`;
  }

  DOM.breadcrumbs.innerHTML = html;
}

function setActiveNav(view) {
  DOM.navLinks.forEach(l => {
    if (l.dataset.view === view) l.classList.add('active');
    else l.classList.remove('active');
  });
}

function renderSections() {
  appState.currentView = 'sections';
  appState.currentSection = null;
  appState.currentChapter = null;
  updateBreadcrumbs([{ name: 'Home' }]);
  setActiveNav('home');
  DOM.searchInput.value = '';

  let html = `<div class="grid-sections animate-fade-in">`;
  appState.data.sections.forEach(sec => {
    html += `
      <div class="card section-card" onclick="renderChapters(appState.data.sections.find(s => s.id === ${sec.id}))">
        <h2>${sec.name}</h2>
        <p>${sec.translation}</p>
        <span class="chapter-count">${sec.chapters.length} Chapters</span>
      </div>
    `;
  });
  html += `</div>`;
  DOM.appView.innerHTML = html;
}

window.renderSections = renderSections;

function renderChapters(section) {
  appState.currentView = 'chapters';
  appState.currentSection = section;
  appState.currentChapter = null;
  updateBreadcrumbs([{ name: 'Home' }, { name: section.name }]);

  let html = `
    <div class="animate-fade-in">
      <h2 style="margin-bottom: 24px; color: var(--primary-color); font-family: var(--font-ta);">${section.name} <span style="color: var(--text-muted); font-size: 1rem; font-family: var(--font-en);">(${section.translation})</span></h2>
      <div class="grid-chapters">
  `;

  section.chapters.forEach(ch => {
    html += `
      <div class="card chapter-card" onclick="renderKurals(appState.currentSection.chapters.find(c => c.id === ${ch.id}))">
        <div class="chapter-number">${ch.id}</div>
        <div class="chapter-info">
          <h3>${ch.name}</h3>
          <p>${ch.translation}</p>
        </div>
      </div>
    `;
  });
  html += `</div></div>`;
  DOM.appView.innerHTML = html;
}

window.renderChapters = renderChapters;

function renderKurals(chapter) {
  appState.currentView = 'kurals';
  appState.currentChapter = chapter;
  updateBreadcrumbs([{ name: 'Home' }, { name: appState.currentSection.name }, { name: chapter.name }]);

  const kurals = appState.data.allKurals.filter(k => k.Number >= chapter.start && k.Number <= chapter.end);

  renderKuralList(kurals, `
    <h2 style="margin-bottom: 24px; color: var(--primary-color); font-family: var(--font-ta); text-align: center;">
      ${chapter.name} 
      <span style="display: block; color: var(--text-muted); font-size: 1rem; font-family: var(--font-en); margin-top: 4px;">
        ${chapter.translation}
      </span>
    </h2>
  `);
}

window.renderKurals = renderKurals;

function renderFavorites() {
  appState.currentView = 'favorites';
  updateBreadcrumbs([{ name: 'Home' }]);
  setActiveNav('favorites');
  DOM.breadcrumbs.innerHTML = `<span class="crumb active">Favorites</span>`;

  if (appState.favorites.length === 0) {
    DOM.appView.innerHTML = `
      <div class="empty-state animate-fade-in">
        <i class="ph ph-heart-break"></i>
        <h3>No Favorites Yet</h3>
        <p>Save your favorite kurals by clicking the heart icon on them.</p>
        <button onclick="renderSections()" style="margin-top: 16px; padding: 10px 20px; border-radius: 20px; background: var(--primary-color); color: white; border: none; cursor: pointer;">Explore Kurals</button>
      </div>
    `;
    return;
  }

  const favKurals = appState.data.allKurals.filter(k => appState.favorites.includes(k.Number));
  renderKuralList(favKurals, `<h2 style="margin-bottom: 24px; color: var(--primary-color);">Your Favorites</h2>`);
}

window.renderFavorites = renderFavorites;

function renderKuralList(kurals, headerHtml = '') {
  let html = `<div class="grid-kurals animate-fade-in">`;
  if (headerHtml) html += headerHtml;

  kurals.forEach(k => {
    const isFav = appState.favorites.includes(k.Number);
    html += `
      <div class="card kural-card">
        <div class="kural-header">
          <span class="kural-id">Kural ${k.Number}</span>
          <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${k.Number}, this)" aria-label="Favorite">
            <i class="ph ${isFav ? 'ph-heart-fill' : 'ph-heart'}"></i>
          </button>
        </div>
        
        <div class="kural-text">
          ${k.Line1}<br>${k.Line2}
        </div>
        
        <div class="meaning-section">
          <div class="meaning-box tamil">
            <h4>பொருள் (Tamil Meaning)</h4>
            <p>${k.mv}</p>
          </div>
          <div class="meaning-box english">
            <h4>English Meaning</h4>
            <p>${k.Translation}</p>
            <p style="margin-top: 8px; font-size: 0.9em; color: var(--text-muted);">${k.explanation}</p>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  DOM.appView.innerHTML = html;
}

// --- Actions ---
window.toggleFavorite = function (kuralNum, btn) {
  const index = appState.favorites.indexOf(kuralNum);
  if (index > -1) {
    appState.favorites.splice(index, 1);
    btn.classList.remove('active');
    btn.innerHTML = '<i class="ph ph-heart"></i>';
  } else {
    appState.favorites.push(kuralNum);
    btn.classList.add('active');
    btn.innerHTML = '<i class="ph ph-heart-fill"></i>';
  }

  localStorage.setItem('thirukkural_fav', JSON.stringify(appState.favorites));

  // If we are currently in favorites view, and removed a fav, re-render
  if (appState.currentView === 'favorites') {
    renderFavorites();
  }
}

// --- Search ---
function handleSearch(term) {
  const isNumber = !isNaN(term);

  if (isNumber) {
    const num = parseInt(term);
    const result = appState.data.allKurals.filter(k => k.Number === num);
    if (result.length) {
      renderKuralList(result, `<h3>Search Result for Kural ${num}</h3>`);
    } else {
      showEmptySearch();
    }
  } else {
    // Search text
    const results = appState.data.allKurals.filter(k =>
      k.Line1.includes(term) ||
      k.Line2.includes(term) ||
      k.Translation.toLowerCase().includes(term) ||
      k.mv.includes(term)
    ).slice(0, 50); // limit to 50

    if (results.length) {
      renderKuralList(results, `<h3 style="margin-bottom: 20px;">Search Results for "${term}" (${results.length})</h3>`);
    } else {
      showEmptySearch();
    }
  }
}

function showEmptySearch() {
  DOM.appView.innerHTML = `
    <div class="empty-state">
      <i class="ph ph-magnifying-glass"></i>
      <h3>No results found</h3>
      <p>Try searching with a different keyword or Kural number.</p>
    </div>
  `;
}

// --- Quiz Logic ---
let quizState = {
  questions: [],
  currentIdx: 0,
  score: 0,
  answered: false
};

function renderQuizInit() {
  appState.currentView = 'quiz';
  updateBreadcrumbs([{ name: 'Home' }]);
  setActiveNav('quiz');
  DOM.breadcrumbs.innerHTML = `<span class="crumb active">வினாடி வினா (Quiz)</span>`;

  DOM.appView.innerHTML = `
    <div class="quiz-container animate-fade-in">
      <div class="quiz-header">
        <h2>உங்கள் அறிவை சோதிக்கவும்</h2>
        <p>திருக்குறள் மற்றும் அதன் பொருளைப் பற்றி 5 கேள்விகளைக் கொண்ட சிறிய தேர்வில் பங்கேற்கவும்.</p>
        <button class="btn-primary" onclick="startQuiz()" style="margin-top: 24px; font-size: 1.1rem; padding: 14px 32px;">வினாடி வினா தொடங்கு</button>
      </div>
    </div>
  `;
}
window.renderQuizInit = renderQuizInit;

function startQuiz() {
  quizState.questions = generateQuestions(5);
  quizState.currentIdx = 0;
  quizState.score = 0;
  quizState.answered = false;
  renderQuizQuestion();
}
window.startQuiz = startQuiz;

function generateQuestions(num) {
  const q = [];
  const totalKurals = appState.data.allKurals.length;
  for (let i = 0; i < num; i++) {
    const randomKural = appState.data.allKurals[Math.floor(Math.random() * totalKurals)];
    const type = Math.random() > 0.5 ? 'meaning' : 'fill';

    if (type === 'meaning') {
      let options = [randomKural.mv];
      while (options.length < 4) {
        let rOpt = appState.data.allKurals[Math.floor(Math.random() * totalKurals)].mv;
        if (!options.includes(rOpt)) options.push(rOpt);
      }
      options.sort(() => Math.random() - 0.5);

      q.push({
        type: 'meaning',
        kural: randomKural,
        question: `குறள் ${randomKural.Number}-க்கான சரியான பொருள் என்ன?`,
        text: `${randomKural.Line1}<br>${randomKural.Line2}`,
        options: options,
        answerIndex: options.indexOf(randomKural.mv)
      });
    } else {
      const words = randomKural.Line1.split(' ').concat(randomKural.Line2.split(' ')).filter(w => w.trim() !== '');
      const missingIdx = Math.floor(Math.random() * words.length);
      const missingWord = words[missingIdx];

      let textHTML = '';
      let wIdx = 0;
      randomKural.Line1.split(' ').forEach(w => {
        if (w.trim() !== '') { textHTML += (wIdx === missingIdx ? '____ ' : w + ' '); wIdx++; }
      });
      textHTML += '<br>';
      randomKural.Line2.split(' ').forEach(w => {
        if (w.trim() !== '') { textHTML += (wIdx === missingIdx ? '____ ' : w + ' '); wIdx++; }
      });

      let options = [missingWord];
      while (options.length < 4) {
        let rk = appState.data.allKurals[Math.floor(Math.random() * totalKurals)];
        let rWords = rk.Line1.split(' ').concat(rk.Line2.split(' ')).filter(w => w.trim() !== '');
        let rOpt = rWords[Math.floor(Math.random() * rWords.length)];
        if (!options.includes(rOpt)) options.push(rOpt);
      }
      options.sort(() => Math.random() - 0.5);

      q.push({
        type: 'fill',
        kural: randomKural,
        question: `குறள் ${randomKural.Number}-ல் விடுபட்ட சொல்லை நிரப்புக:`,
        text: textHTML,
        options: options,
        answerIndex: options.indexOf(missingWord)
      });
    }
  }
  return q;
}

function renderQuizQuestion() {
  if (quizState.currentIdx >= quizState.questions.length) {
    renderQuizResult();
    return;
  }

  quizState.answered = false;
  const q = quizState.questions[quizState.currentIdx];

  let optionsHtml = '';
  q.options.forEach((opt, idx) => {
    optionsHtml += `<button class="quiz-option" id="q-opt-${idx}" onclick="checkAnswer(${idx})">${opt}</button>`;
  });

  DOM.appView.innerHTML = `
    <div class="quiz-container animate-fade-in">
      <div class="quiz-header" style="margin-bottom: 16px;">
        <h2>கேள்வி ${quizState.currentIdx + 1} / ${quizState.questions.length}</h2>
        <p>மதிப்பெண்: ${quizState.score}</p>
      </div>
      
      <div class="quiz-card">
        <span class="quiz-question-type">${q.type === 'meaning' ? 'பொருள் அறிதல்' : 'கோடிட்ட இடத்தை நிரப்புக'}</span>
        <div class="quiz-question">${q.question}</div>
        <div class="kural-text" style="color: var(--primary-color); margin-bottom: 32px;">
          ${q.text}
        </div>
        
        <div class="quiz-options">
          ${optionsHtml}
        </div>
        
        <div id="quiz-feedback" class="quiz-feedback"></div>
        
        <div class="quiz-actions">
          <button id="next-btn" class="btn-primary" onclick="nextQuestion()" disabled>அடுத்த கேள்வி <i class="ph ph-arrow-right"></i></button>
        </div>
      </div>
    </div>
  `;
}
window.renderQuizQuestion = renderQuizQuestion;

function checkAnswer(idx) {
  if (quizState.answered) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.currentIdx];
  const isCorrect = (idx === q.answerIndex);

  const selectedBtn = document.getElementById(`q-opt-${idx}`);
  const correctBtn = document.getElementById(`q-opt-${q.answerIndex}`);

  if (isCorrect) {
    quizState.score++;
    selectedBtn.classList.add('correct');
  } else {
    selectedBtn.classList.add('wrong');
    correctBtn.classList.add('correct');
  }

  const feedback = document.getElementById('quiz-feedback');
  feedback.classList.add(isCorrect ? 'success' : 'error');
  feedback.innerHTML = isCorrect ?
    '<strong><i class="ph ph-check-circle"></i> சரியான விடை!</strong> நன்று.' :
    `<strong><i class="ph ph-x-circle"></i> தவறான விடை.</strong> சரியான விடை முன்னிலைப்படுத்தப்பட்டுள்ளது.`;

  document.getElementById('next-btn').disabled = false;
}
window.checkAnswer = checkAnswer;

function nextQuestion() {
  quizState.currentIdx++;
  renderQuizQuestion();
}
window.nextQuestion = nextQuestion;

function renderQuizResult() {
  const total = quizState.questions.length;
  const percentage = Math.round((quizState.score / total) * 100);

  let msg = '';
  if (percentage === 100) msg = 'அற்புதம்! நீங்கள் திருக்குறளில் சிறந்தவர்.';
  else if (percentage >= 60) msg = 'நன்று! திருக்குறளை நன்கு அறிவீர்கள்.';
  else msg = 'நல்ல முயற்சி! தொடர்ந்து படித்து அறிவை வளர்க்கவும்.';

  DOM.appView.innerHTML = `
    <div class="quiz-container animate-fade-in" style="text-align: center; margin-top: 40px;">
      <i class="ph ph-trophy" style="font-size: 5rem; color: #f59e0b; margin-bottom: 24px;"></i>
      <h2 style="font-size: 2.5rem; margin-bottom: 16px; color: var(--primary-color);">வினாடி வினா நிறைவடைந்தது!</h2>
      <p style="font-size: 1.5rem; margin-bottom: 8px;">உங்கள் மதிப்பெண்: <strong>${quizState.score} / ${total}</strong> (${percentage}%)</p>
      <p style="color: var(--text-muted); margin-bottom: 32px;">${msg}</p>
      
      <button class="btn-primary" onclick="startQuiz()" style="margin-right: 16px;">மீண்டும் முயற்சிக்கவும்</button>
      <button class="btn-primary" style="background: var(--surface-color); color: var(--text-main); border: 1px solid var(--border-color);" onclick="renderSections()">முகப்பிற்கு செல்</button>
    </div>
  `;
}
window.renderQuizResult = renderQuizResult;

// Start
initApp();