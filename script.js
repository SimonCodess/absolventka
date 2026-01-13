const API_KEY = CONFIG.API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/original";

const state = {
  view: "home",
  page: 1,
  totalPages: 1,
  isLoading: false,
  searchQuery: "",
  filters: {
    type: "all",
    genre: "all",
  },
  currentModalItem: null,
};

let genreMap = {};

const grid = document.getElementById("movie-grid");
const loader = document.getElementById("loader");
const pageTitle = document.getElementById("page-title");
const typeSelect = document.getElementById("filter-type");
const genreSelect = document.getElementById("filter-genre");
const modal = document.getElementById("modal");

const searchModal = document.getElementById("search-modal");
const modalSearchInput = document.getElementById("modal-search-input");
const closeSearchBtn = document.getElementById("close-search");
const navSearchIcon = document.getElementById("nav-search-icon");

async function init() {
  window.addEventListener("load", () => {
    const preloader = document.getElementById("preloader");
    preloader.classList.add("hidden");
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500);
  });

  await fetchGenres();

  fetchFeaturedMovie();

  handleRoute();

  window.addEventListener("popstate", handleRoute);

  document.querySelectorAll(".nav-item").forEach((el) => {
    if (el.id === "nav-search-icon") return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const view = e.currentTarget.dataset.view;
      navigateTo(view);
    });
  });

  navSearchIcon.addEventListener("click", () => {
    searchModal.classList.add("active");
    modalSearchInput.focus();
  });

  closeSearchBtn.addEventListener("click", () => {
    searchModal.classList.remove("active");
  });

  searchModal.addEventListener("click", (e) => {
    if (e.target === searchModal) {
      searchModal.classList.remove("active");
    }
  });

  let debounce;
  modalSearchInput.addEventListener("input", (e) => {});

  modalSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = e.target.value.trim();
      if (query) {
        searchModal.classList.remove("active");
        navigateTo("search", {
          q: query
        });
        modalSearchInput.value = "";
      }
    }
  });

  typeSelect.addEventListener("change", () => {
    state.filters.type = typeSelect.value;
    resetAndFetch();
  });

  genreSelect.addEventListener("change", () => {
    state.filters.genre = genreSelect.value;
    resetAndFetch();
  });

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document
    .getElementById("modal-backdrop")
    .addEventListener("click", closeModal);

  document.getElementById("btn-fav").addEventListener("click", toggleFavorite);
  document.getElementById("btn-watch").addEventListener("click", toggleWatched);
  document.getElementById("btn-save-note").addEventListener("click", saveNote);

  document
    .getElementById("nav-dice")
    .addEventListener("click", recommendRandomMovie);

  document.getElementById("close-search").addEventListener("click", () => {
    document.getElementById("search-modal").classList.remove("active");
    document.body.classList.remove("modal-open");
  });

  window.addEventListener("scroll", () => {
    if (state.view === "favorites" || state.view === "watched") return;
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 500
    ) {
      fetchData();
    }
  });
}

function navigateTo(view, params = {}) {
  let url = new URL(window.location);
  url.searchParams.delete("id");

  if (view === "home") {
    url.search = "";
  } else if (view === "search") {
    url.searchParams.set("q", params.q);
  } else if (view === "favorites") {
    url.searchParams.set("view", "favorites");
  } else if (view === "watched") {
    url.searchParams.set("view", "watched");
  }

  window.history.pushState({}, "", url);
  handleRoute();
}

function handleRoute() {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const searchParam = params.get("q");
  const idParam = params.get("id");

  const heroSection = document.getElementById("hero-section");

  if (searchParam) {
    state.view = "search";
    state.searchQuery = searchParam;
    pageTitle.textContent = `Výsledky pro "${searchParam}"`;
    document.getElementById("controls-area").style.display = "flex";
    if (heroSection) heroSection.style.display = "none";
    updateNavUI("");
  } else if (viewParam === "favorites") {
    state.view = "favorites";
    pageTitle.textContent = "Můj seznam ke zhlédnutí";
    document.getElementById("controls-area").style.display = "none";
    if (heroSection) heroSection.style.display = "none";
    updateNavUI("favorites");
  } else if (viewParam === "watched") {
    state.view = "watched";
    pageTitle.textContent = "Historie (Zhlédnuto)";
    document.getElementById("controls-area").style.display = "none";
    if (heroSection) heroSection.style.display = "none";
    updateNavUI("watched");
  } else {
    state.view = "home";
    pageTitle.textContent = "Právě trendy";
    document.getElementById("controls-area").style.display = "flex";
    if (heroSection) heroSection.style.display = "block";
    updateNavUI("home");
  }

  const animatedElements = [
    grid,
    pageTitle,
    document.getElementById("controls-area"),
  ];
  animatedElements.forEach((el) => {
    if (el) {
      el.classList.remove("fade-in");
      void el.offsetWidth;
      el.classList.add("fade-in");
    }
  });

  state.page = 1;
  grid.innerHTML = "";

  if (state.view === "favorites" || state.view === "watched") {
    renderLocalList(state.view);
  } else {
    fetchData();
  }

  if (idParam) {
    openModalById(idParam);
  } else {
    closeModalUI();
  }
}

function updateNavUI(activeView) {
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  const activeEl = document.getElementById(`nav-${activeView}`);
  if (activeEl) activeEl.classList.add("active");
}

async function fetchGenres() {
  try {
    const [resM, resT] = await Promise.all([
      fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=cs`),
      fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}&language=cs`),
    ]);
    const dataM = await resM.json();
    const dataT = await resT.json();

    const allGenres = [...dataM.genres, ...dataT.genres];
    const uniqueGenres = [];
    const map = new Map();
    for (const item of allGenres) {
      if (!map.has(item.id)) {
        map.set(item.id, true);
        uniqueGenres.push(item);
        genreMap[item.id] = item.name;
      }
    }

    uniqueGenres.sort((a, b) => a.name.localeCompare(b.name));
    uniqueGenres.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      genreSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Chyba při načítání žánrů", e);
  }
}

async function fetchFeaturedMovie() {
  try {
    const res = await fetch(
      `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&language=cs`
    );
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const item = data.results[Math.floor(Math.random() * 5)];

      const heroSection = document.getElementById("hero-section");
      const heroBg = document.getElementById("hero-bg");
      const heroTitle = document.getElementById("hero-title");
      const heroDesc = document.getElementById("hero-desc");
      const heroBtn = document.getElementById("hero-btn");

      if (item.backdrop_path) {
        heroBg.src = BACKDROP_URL + item.backdrop_path;
      } else {
        heroBg.src = IMG_URL + item.poster_path;
      }

      heroTitle.textContent = item.title || item.name;
      heroDesc.textContent = item.overview;

      if (!item.media_type) item.media_type = "movie";
      heroBtn.onclick = () => openModal(item);

      if (state.view === "home") {
        heroSection.style.display = "block";
      }
    }
  } catch (e) {
    console.error("Chyba při načítání doporučeného filmu", e);
  }
}

async function recommendRandomMovie() {
  if (state.isLoading) return;
  state.isLoading = true;
  loader.style.opacity = 1;

  try {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const url = `${BASE_URL}/trending/all/week?api_key=${API_KEY}&page=${randomPage}&language=cs`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const validResults = data.results.filter(
        (item) => item.media_type !== "person"
      );
      if (validResults.length > 0) {
        const randomItem =
          validResults[Math.floor(Math.random() * validResults.length)];
        openModal(randomItem);
      }
    }
  } catch (err) {
    console.error("Náhodné doporučení selhalo", err);
  } finally {
    state.isLoading = false;
    loader.style.opacity = 0;
  }
}

async function fetchData() {
  if (state.isLoading) return;
  state.isLoading = true;
  loader.style.opacity = 1;

  let url;

  if (state.view === "search") {
    url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(
      state.searchQuery
    )}&page=${state.page}&language=cs`;
  } else {
    if (state.filters.type !== "all" || state.filters.genre !== "all") {
      const type = state.filters.type === "all" ? "movie" : state.filters.type;
      url = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&page=${state.page}&sort_by=popularity.desc&language=cs`;

      if (state.filters.genre !== "all") {
        url += `&with_genres=${state.filters.genre}`;
      }
    } else {
      url = `${BASE_URL}/trending/all/week?api_key=${API_KEY}&page=${state.page}&language=cs`;
    }
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    state.totalPages = data.total_pages;

    if (data.results.length === 0 && state.page === 1) {
      grid.innerHTML =
        '<div class="empty-state">Nebyly nalezeny žádné výsledky.</div>';
    }

    data.results.forEach((item) => {
      if (item.media_type === "person") return;

      if (state.filters.type !== "all") {
        if (state.filters.type === "movie" && item.media_type === "tv") return;
        if (state.filters.type === "tv" && item.media_type === "movie") return;
      }
      if (state.view === "search" && state.filters.genre !== "all") {
        if (
          !item.genre_ids ||
          !item.genre_ids.includes(parseInt(state.filters.genre))
        )
          return;
      }

      const card = createCard(item);
      grid.appendChild(card);
    });

    state.page++;
  } catch (err) {
    console.error(err);
  } finally {
    state.isLoading = false;
    loader.style.opacity = 0;
  }
}

function resetAndFetch() {
  state.page = 1;
  grid.innerHTML = "";
  fetchData();
}

function createCard(item) {
  const el = document.createElement("div");
  el.className = "movie-card";

  const title = item.title || item.name;
  const date = item.release_date || item.first_air_date || "";
  const year = date ? date.split("-")[0] : "";
  const type = item.media_type === "tv" ? "TV Seriál" : "Film";
  const imgPath = item.poster_path ? IMG_URL + item.poster_path : null;

  if (!imgPath) return el;

  el.innerHTML = `
          <div class="poster-wrapper">
              <img src="${imgPath}" class="poster-img" loading="lazy" onload="this.classList.add('loaded')">
          </div>
          <div class="card-meta">
              <div class="card-title">${title}</div>
              <div class="card-info">
                  <span>${year}</span>
                  <span>${type}</span>
              </div>
          </div>
      `;

  el.addEventListener("click", () => {
    const u = new URL(window.location);
    u.searchParams.set("id", item.id);
    window.history.pushState({}, "", u);
    openModal(item);
  });

  return el;
}

function renderLocalList(key) {
  loader.style.opacity = 0;
  const list = getLocalData(key);
  const ids = Object.keys(list);

  if (ids.length === 0) {
    const listName =
      key === "favorites" ? "seznam oblíbených" : "seznam zhlédnutých";
    grid.innerHTML = `<div class="empty-state">Váš ${listName} je prázdný. Jděte objevovat!</div>`;
    return;
  }

  ids.forEach((id) => {
    const item = list[id];
    const card = createCard(item);
    grid.appendChild(card);
  });
}

async function openModalById(id) {
  try {
    let res = await fetch(
      `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=cs`
    );
    if (!res.ok) {
      res = await fetch(`${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=cs`);
    }
    if (res.ok) {
      const item = await res.json();
      if (!item.media_type) item.media_type = item.title ? "movie" : "tv";
      openModal(item);
    }
  } catch (e) {
    console.error(e);
  }
}

async function openModal(item) {
  state.currentModalItem = item;

  document.getElementById("modal-title").textContent = item.title || item.name;
  document.getElementById("modal-overview").textContent =
    item.overview || "Popis není k dispozici.";
  document.getElementById("modal-year").textContent = (
    item.release_date ||
    item.first_air_date ||
    ""
  ).split("-")[0];
  document.getElementById("modal-rating").textContent = `★ ${
    item.vote_average ? item.vote_average.toFixed(1) : "NR"
  }`;

  const backdrop = item.backdrop_path
    ? BACKDROP_URL + item.backdrop_path
    : item.poster_path
    ? IMG_URL + item.poster_path
    : "";
  document.getElementById("modal-backdrop-img").src = backdrop;

  const type = item.media_type === "tv" || !item.title ? "tv" : "movie";
  document.getElementById("modal-type-badge").textContent =
    type === "tv" ? "SERIÁL" : "FILM";

  updateModalButtons(item.id);
  const notes = getLocalData("notes");
  document.getElementById("user-note").value = notes[item.id] || "";

  modal.classList.add("active");
  document.body.classList.add("modal-open");

  fetchDetails(item.id, type);
}

async function fetchDetails(id, type) {
  document.getElementById("modal-cast").innerHTML = "Načítání...";
  document.getElementById("modal-runtime").textContent = "";

  try {
    const url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits&language=cs`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.runtime)
      document.getElementById(
        "modal-runtime"
      ).textContent = `${data.runtime} min`;
    else if (data.episode_run_time && data.episode_run_time.length > 0)
      document.getElementById(
        "modal-runtime"
      ).textContent = `${data.episode_run_time[0]} min`;

    const cast = data.credits.cast.slice(0, 8);
    const castContainer = document.getElementById("modal-cast");
    castContainer.innerHTML = "";

    if (cast.length === 0)
      castContainer.innerHTML = "Žádné informace o obsazení.";

    cast.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "cast-chip";
      chip.textContent = c.name;
      castContainer.appendChild(chip);
    });
  } catch (e) {
    console.error("Chyba při načítání podrobností", e);
  }
}

function closeModal() {
  closeModalUI();
  const u = new URL(window.location);
  u.searchParams.delete("id");
  window.history.pushState({}, "", u);
}

function closeModalUI() {
  modal.classList.remove("active");
  document.body.classList.remove("modal-open");
  state.currentModalItem = null;
}

function getLocalData(key) {
  const data = localStorage.getItem(`movieApp_${key}`);
  return data ? JSON.parse(data) : {};
}

function saveLocalData(key, data) {
  localStorage.setItem(`movieApp_${key}`, JSON.stringify(data));
}

function toggleFavorite() {
  if (!state.currentModalItem) return;
  const list = getLocalData("favorites");
  const id = state.currentModalItem.id;

  if (list[id]) {
    delete list[id];
  } else {
    list[id] = normalizeItem(state.currentModalItem);
  }
  saveLocalData("favorites", list);
  updateModalButtons(id);

  if (state.view === "favorites") renderLocalList("favorites");
}

function toggleWatched() {
  if (!state.currentModalItem) return;
  const list = getLocalData("watched");
  const id = state.currentModalItem.id;

  if (list[id]) {
    delete list[id];
  } else {
    list[id] = normalizeItem(state.currentModalItem);
  }
  saveLocalData("watched", list);
  updateModalButtons(id);

  if (state.view === "watched") renderLocalList("watched");
}

function saveNote() {
  if (!state.currentModalItem) return;
  const id = state.currentModalItem.id;
  const text = document.getElementById("user-note").value;

  const notes = getLocalData("notes");
  if (text.trim() === "") delete notes[id];
  else notes[id] = text;

  saveLocalData("notes", notes);
  alert("Poznámka uložena!");
}

function updateModalButtons(id) {
  const favs = getLocalData("favorites");
  const watched = getLocalData("watched");

  const btnFav = document.getElementById("btn-fav");
  const btnWatch = document.getElementById("btn-watch");

  if (favs[id]) {
    btnFav.classList.add("active-love");
    btnFav.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> Uloženo`;
  } else {
    btnFav.classList.remove("active-love");
    btnFav.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg> Oblíbené`;
  }

  if (watched[id]) {
    btnWatch.classList.add("active-watch");
    btnWatch.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> Viděno`;
  } else {
    btnWatch.classList.remove("active-watch");
    btnWatch.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> Viděno`;
  }
}

function normalizeItem(item) {
  return {
    id: item.id,
    title: item.title || item.name,
    poster_path: item.poster_path,
    release_date: item.release_date || item.first_air_date,
    vote_average: item.vote_average,
    media_type: item.media_type || (item.title ? "movie" : "tv"),
  };
}

init();