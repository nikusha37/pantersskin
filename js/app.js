(function () {
  "use strict";

  const BUNDLE = window.VEPKHISTKAOSANI_BUNDLE || { chapters: [], locations: {}, scholarly_monograph_synthesis: {} };
  const CHAPTERS = BUNDLE.chapters || [];
  const LOCATIONS = BUNDLE.locations || {};
  const MONOGRAPH = BUNDLE.scholarly_monograph_synthesis || {};
  const METADATA = BUNDLE.metadata || {};

  let state = {
    currentChapterNumber: 1,
    actFilter: "all",
    locationFilter: null,
    viewMode: "bilingual",
    autoPlayTimer: null,
    theme: localStorage.getItem("vepkhistkaosani_theme") || "dark"
  };

  // Restore saved chapter if available
  const savedCh = parseInt(localStorage.getItem("vepkhistkaosani_chapter"), 10);
  if (savedCh && savedCh >= 1 && savedCh <= CHAPTERS.length) {
    state.currentChapterNumber = savedCh;
  }

  // DOM Elements
  const chapterListContainer = document.getElementById("chapterListContainer");
  const sidebarCountLabel = document.getElementById("sidebarCountLabel");
  const stageSvg = document.getElementById("stageSvg");
  const stageMaximKa = document.getElementById("stageMaximKa");
  const stageMaximEn = document.getElementById("stageMaximEn");
  const stageCharacters = document.getElementById("stageCharacters");
  const stageStanzaIndicator = document.getElementById("stageStanzaIndicator");
  const mapSvg = document.getElementById("mapSvg");
  const mapActiveLocationDesc = document.getElementById("mapActiveLocationDesc");
  const btnResetMapFilter = document.getElementById("btnResetMapFilter");

  const chapterActBadge = document.getElementById("chapterActBadge");
  const chapterMainTitleEn = document.getElementById("chapterMainTitleEn");
  const chapterMainTitleKa = document.getElementById("chapterMainTitleKa");
  const chapterSourceLink = document.getElementById("chapterSourceLink");
  const chapterStanzaSpan = document.getElementById("chapterStanzaSpan");
  const chapterExpertExplanation = document.getElementById("chapterExpertExplanation");
  const stanzaListContainer = document.getElementById("stanzaListContainer");

  const btnPrevChapter = document.getElementById("btnPrevChapter");
  const btnNextChapter = document.getElementById("btnNextChapter");
  const btnAutoPlay = document.getElementById("btnAutoPlay");
  const btnScholarlyGuide = document.getElementById("btnScholarlyGuide");
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  const globalSearchInput = document.getElementById("globalSearchInput");

  const infoModal = document.getElementById("infoModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const btnCloseModal = document.getElementById("btnCloseModal");

  function applyTheme() {
    if (state.theme === "manuscript") {
      document.body.classList.add("theme-manuscript");
      btnThemeToggle.textContent = "🌙 Astral Dark Mode";
    } else {
      document.body.classList.remove("theme-manuscript");
      btnThemeToggle.textContent = "📜 Manuscript Mode";
    }
    localStorage.setItem("vepkhistkaosani_theme", state.theme);
  }

  function getFilteredChapters() {
    return CHAPTERS.filter((ch) => {
      if (state.actFilter !== "all" && String(ch.act_id) !== String(state.actFilter)) {
        return false;
      }
      if (state.locationFilter && ch.location_id !== state.locationFilter) {
        return false;
      }
      return true;
    });
  }

  function getCurrentChapter() {
    return CHAPTERS.find((c) => c.chapter_number === state.currentChapterNumber) || CHAPTERS[0];
  }

  // Render Left Sidebar Chapter List
  function renderChapterList() {
    const filtered = getFilteredChapters();
    sidebarCountLabel.textContent = `Chapters (${filtered.length})`;
    chapterListContainer.innerHTML = "";

    filtered.forEach((ch) => {
      const btn = document.createElement("button");
      btn.className = "chapter-item" + (ch.chapter_number === state.currentChapterNumber ? " active" : "");
      btn.innerHTML = `
        <div class="chapter-item-top">
          <span>Chapter ${ch.chapter_number} · ${ch.location ? ch.location.name_en.split(" ")[0] : ""}</span>
          <span>St. ${ch.stanza_range}</span>
        </div>
        <div class="chapter-item-title-en">${escapeHtml(ch.chapter_title_en)}</div>
        <div class="chapter-item-title-ka">${escapeHtml(ch.chapter_title_ka)}</div>
      `;
      btn.addEventListener("click", () => {
        selectChapter(ch.chapter_number);
      });
      chapterListContainer.appendChild(btn);
    });

    const activeEl = chapterListContainer.querySelector(".chapter-item.active");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // Render Synchronized World & Quest Map (SVG)
  function renderWorldMap(ch) {
    const activeLocId = ch.location_id || "arabia";
    const fromLoc = ch.route_from ? LOCATIONS[ch.route_from] : null;
    const toLoc = ch.route_to ? LOCATIONS[ch.route_to] : null;

    // Static background trade & quest network links
    const staticEdges = [
      ["arabia", "stream"],
      ["stream", "cave"],
      ["arabia", "cave"],
      ["cave", "india"],
      ["india", "khataeti"],
      ["india", "mulghazanzar"],
      ["cave", "mulghazanzar"],
      ["mulghazanzar", "gulansharo"],
      ["gulansharo", "kadjeti"],
      ["mulghazanzar", "kadjeti"]
    ];

    let edgesSvg = staticEdges
      .map(([a, b]) => {
        const la = LOCATIONS[a];
        const lb = LOCATIONS[b];
        if (!la || !lb) return "";
        return `<line x1="${la.x}" y1="${la.y}" x2="${lb.x}" y2="${lb.y}" stroke="rgba(148,163,184,0.22)" stroke-width="2" stroke-dasharray="4 4" />`;
      })
      .join("");

    // Animated active journey path if chapter has route_from -> route_to
    let activeRouteSvg = "";
    if (fromLoc && toLoc && fromLoc.id !== toLoc.id) {
      const midX = (fromLoc.x + toLoc.x) / 2;
      const midY = Math.min(fromLoc.y, toLoc.y) - 38;
      const pathD = `M ${fromLoc.x} ${fromLoc.y} Q ${midX} ${midY} ${toLoc.x} ${toLoc.y}`;
      activeRouteSvg = `
        <path id="questRoutePath" d="${pathD}" fill="none" stroke="#f59e0b" stroke-width="4" class="anim-dash" />
        <circle r="7" fill="#fbbf24" stroke="#ef4444" stroke-width="2.5">
          <animateMotion dur="3.2s" repeatCount="indefinite" path="${pathD}" />
        </circle>
      `;
    }

    // Kingdom nodes
    let nodesSvg = Object.values(LOCATIONS)
      .map((loc) => {
        const isCurrent = loc.id === activeLocId;
        const isFiltered = state.locationFilter === loc.id;
        const outerRadius = isCurrent ? 22 : 14;
        return `
          <g class="map-node" data-loc="${loc.id}" transform="translate(${loc.x}, ${loc.y})">
            ${
              isCurrent
                ? `<circle r="30" fill="${loc.color}" opacity="0.22" class="anim-pulse" />
                   <circle r="21" fill="none" stroke="${loc.color}" stroke-width="2.5" class="anim-pulse" />`
                : ""
            }
            <circle r="${outerRadius}" fill="${loc.color}" stroke="${isCurrent || isFiltered ? "#fff" : "#0f172a"}" stroke-width="2.5" />
            <text y="${outerRadius + 16}" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700" style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${escapeHtml(loc.name_en.split(" (")[0])}</text>
            <text y="${outerRadius + 31}" text-anchor="middle" fill="#fbbf24" font-size="11" style="text-shadow: 0 2px 4px rgba(0,0,0,0.85);">${escapeHtml(loc.name_ka)}</text>
          </g>
        `;
      })
      .join("");

    mapSvg.innerHTML = `
      <defs>
        <radialGradient id="seaGrad" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9" />
        </radialGradient>
      </defs>
      <!-- Stylized Landmasses & Seas of the Rustavelian World -->
      <path d="M 40,220 Q 150,150 320,170 T 620,90 T 930,95 L 940,260 Q 760,265 560,310 T 220,390 L 40,360 Z" fill="rgba(245, 158, 11, 0.08)" stroke="rgba(245, 158, 11, 0.22)" stroke-width="1.5" />
      <path d="M 460,320 Q 650,295 940,275 L 940,440 L 430,440 Z" fill="rgba(20, 184, 166, 0.09)" stroke="rgba(20, 184, 166, 0.25)" stroke-width="1.5" />
      <text x="80" y="50" fill="rgba(248,250,252,0.35)" font-size="13" font-family="Georgia, serif" font-style="italic">THE GEOGRAPHY OF VEPKHISTKAOSANI</text>
      <text x="530" y="428" fill="rgba(56,189,248,0.45)" font-size="12" font-family="Georgia, serif" font-style="italic">KINGDOM OF THE SEAS &amp; MARITIME CROSSROADS</text>
      ${edgesSvg}
      ${activeRouteSvg}
      ${nodesSvg}
    `;

    const activeLocObj = LOCATIONS[activeLocId];
    if (activeLocObj) {
      mapActiveLocationDesc.innerHTML = `<strong>📍 ${escapeHtml(activeLocObj.name_en)} (${escapeHtml(activeLocObj.name_ka)}):</strong> ${escapeHtml(activeLocObj.desc)}`;
    }

    btnResetMapFilter.style.display = state.locationFilter ? "inline-flex" : "none";

    // Bind click events on map nodes
    mapSvg.querySelectorAll(".map-node").forEach((node) => {
      node.addEventListener("click", () => {
        const clickedLoc = node.getAttribute("data-loc");
        if (state.locationFilter === clickedLoc) {
          state.locationFilter = null;
        } else {
          state.locationFilter = clickedLoc;
          const firstMatching = CHAPTERS.find((c) => c.location_id === clickedLoc);
          if (firstMatching) {
            state.currentChapterNumber = firstMatching.chapter_number;
          }
        }
        renderAll();
      });
    });
  }

  // Render Animated Theatrical Chapter Stage (SVG Scene Generator)
  function renderStageScene(ch) {
    const st = ch.scene_type || "court";
    let sceneArt = "";

    if (st === "prologue_cosmos") {
      sceneArt = `
        <g transform="translate(320, 132)">
          <circle r="105" fill="none" stroke="rgba(245,158,11,0.22)" stroke-width="1.5" stroke-dasharray="6 4" class="anim-spin" />
          <circle r="76" fill="none" stroke="rgba(56,189,248,0.3)" stroke-width="1.5" stroke-dasharray="4 6" class="anim-spin" style="animation-direction:reverse;" />
          <circle r="48" fill="rgba(245,158,11,0.18)" class="anim-pulse" />
          <circle r="26" fill="#f59e0b" />
          <text y="6" text-anchor="middle" fill="#0f172a" font-size="18" font-weight="bold">☀</text>
          <!-- Orbiting Seven Planets -->
          <g class="anim-spin">
            <circle cx="0" cy="-76" r="6" fill="#38bdf8" />
            <circle cx="76" cy="0" r="5" fill="#ec4899" />
            <circle cx="0" cy="76" r="7" fill="#a855f7" />
            <circle cx="-76" cy="0" r="5" fill="#10b981" />
            <circle cx="74" cy="-74" r="6" fill="#f43f5e" />
            <circle cx="-74" cy="74" r="6" fill="#eab308" />
          </g>
        </g>
        <text x="320" y="25" text-anchor="middle" fill="#fbbf24" font-size="12" letter-spacing="2">COSMIC HARMONY · SHAIROBA &amp; MIJNUROBA</text>
      `;
    } else if (st === "coronation") {
      sceneArt = `
        <!-- Royal Arches of Arabia -->
        <path d="M 90,250 L 90,90 Q 160,40 230,90 L 230,250" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="2" />
        <path d="M 230,250 L 230,75 Q 320,20 410,75 L 410,250" fill="rgba(225,29,72,0.12)" stroke="#fbbf24" stroke-width="2.5" />
        <path d="M 410,250 L 410,90 Q 480,40 550,90 L 550,250" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="2" />
        <!-- Floating Golden Crown -->
        <g transform="translate(320, 115)" class="anim-float">
          <polygon points="-45,20 -35,-18 -15,5 0,-28 15,5 35,-18 45,20" fill="#fbbf24" stroke="#f59e0b" stroke-width="2" />
          <circle cx="0" cy="-28" r="5" fill="#e11d48" />
          <circle cx="-35" cy="-18" r="4" fill="#14b8a6" />
          <circle cx="35" cy="-18" r="4" fill="#14b8a6" />
        </g>
        <text x="320" y="175" text-anchor="middle" fill="#f8fafc" font-size="13" font-family="Georgia, serif">"The lion's whelps are equal, be they female or male"</text>
      `;
    } else if (st === "hunt") {
      sceneArt = `
        <!-- Rolling Plains & Archery Trajectory -->
        <path d="M 0,220 Q 180,175 350,210 T 640,195 L 640,310 L 0,310 Z" fill="rgba(16,185,129,0.16)" stroke="#10b981" stroke-width="2" />
        <path d="M 110,185 Q 320,55 520,165" fill="none" stroke="#fbbf24" stroke-width="3" class="anim-dash" />
        <g class="anim-float" transform="translate(135, 165)">
          <circle r="22" fill="#f59e0b" opacity="0.25" />
          <text x="0" y="7" text-anchor="middle" font-size="24">🏹</text>
        </g>
        <g class="anim-pulse" transform="translate(505, 160)">
          <circle r="26" fill="#10b981" opacity="0.25" />
          <text x="0" y="8" text-anchor="middle" font-size="24">🦌</text>
        </g>
        <text x="320" y="34" text-anchor="middle" fill="#34d399" font-size="12" letter-spacing="1.5">ROYAL BATTUE HUNT · 100 SCORE ARROWS</text>
      `;
    } else if (st === "stranger_stream") {
      sceneArt = `
        <!-- Weeping Knight by the Stream -->
        <path d="M 0,215 Q 200,245 420,200 T 640,225" fill="none" stroke="#38bdf8" stroke-width="14" opacity="0.45" class="anim-dash" />
        <g transform="translate(320, 125)" class="anim-float">
          <circle r="48" fill="rgba(225,29,72,0.22)" class="anim-pulse" />
          <circle r="34" fill="#1e293b" stroke="#f59e0b" stroke-width="2.5" />
          <text x="0" y="10" text-anchor="middle" font-size="28">🐆</text>
        </g>
        <text x="320" y="34" text-anchor="middle" fill="#fbbf24" font-size="12" letter-spacing="1.5">THE STRANGER KNIGHT CLAD IN THE PANTHER'S SKIN</text>
      `;
    } else if (st === "cave_brotherhood") {
      sceneArt = `
        <!-- Cliffside Cave & Sworn Brotherhood -->
        <path d="M 70,250 L 160,65 L 285,145 L 385,55 L 560,250 Z" fill="rgba(148,163,184,0.14)" stroke="rgba(245,158,11,0.4)" stroke-width="2" />
        <path d="M 255,250 Q 320,135 385,250 Z" fill="#090d16" stroke="#f59e0b" stroke-width="2" />
        <g transform="translate(275, 165)" class="anim-float">
          <circle r="22" fill="#e11d48" stroke="#fff" stroke-width="2" />
          <text y="5" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">Tariel</text>
        </g>
        <g transform="translate(365, 165)" class="anim-float" style="animation-delay:0.6s;">
          <circle r="22" fill="#f59e0b" stroke="#fff" stroke-width="2" />
          <text y="5" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="bold">Avtandil</text>
        </g>
        <line x1="297" y1="165" x2="343" y2="165" stroke="#fbbf24" stroke-width="3" class="anim-pulse" />
        <text x="320" y="34" text-anchor="middle" fill="#fbbf24" font-size="12" letter-spacing="1.5">SWORN BROTHERHOOD AT THE CLIFFSIDE CAVE</text>
      `;
    } else if (st === "lion_panther") {
      sceneArt = `
        <!-- Iconic Symbolic Episode: Slaying of the Lion and the Panther -->
        <circle cx="320" cy="135" r="78" fill="rgba(225,29,72,0.14)" class="anim-pulse" />
        <g transform="translate(235, 135)" class="anim-float">
          <circle r="34" fill="rgba(245,158,11,0.25)" stroke="#f59e0b" stroke-width="2" />
          <text y="10" text-anchor="middle" font-size="30">🦁</text>
        </g>
        <g transform="translate(405, 135)" class="anim-float" style="animation-delay:0.5s;">
          <circle r="34" fill="rgba(225,29,72,0.25)" stroke="#e11d48" stroke-width="2" />
          <text y="10" text-anchor="middle" font-size="30">🐆</text>
        </g>
        <text x="320" y="142" text-anchor="middle" font-size="26">⚔️</text>
        <text x="320" y="34" text-anchor="middle" fill="#f43f5e" font-size="12" letter-spacing="1.5">THE LION &amp; THE PANTHER · SYMBOLIC DUEL</text>
      `;
    } else if (st === "sea_voyage") {
      sceneArt = `
        <!-- Maritime Voyage & Gulansharo -->
        <path d="M 0,205 Q 160,180 320,205 T 640,200" fill="none" stroke="#14b8a6" stroke-width="5" class="anim-dash" />
        <path d="M 0,230 Q 160,250 320,225 T 640,230" fill="none" stroke="#38bdf8" stroke-width="4" class="anim-dash" />
        <g transform="translate(320, 145)" class="anim-float">
          <polygon points="-55,15 55,15 38,42 -38,42" fill="#d97706" stroke="#fbbf24" stroke-width="2" />
          <polygon points="0,-48 0,10 42,6" fill="#f8fafc" opacity="0.9" />
          <polygon points="-4,-42 -4,10 -36,8" fill="#fbbf24" opacity="0.85" />
        </g>
        <text x="320" y="34" text-anchor="middle" fill="#2dd4bf" font-size="12" letter-spacing="1.5">MARITIME CROSSROADS &amp; GULANSHARO (CITY OF ROSES)</text>
      `;
    } else if (st === "kadjeti_assault") {
      sceneArt = `
        <!-- Three-Gate Assault on the Fortress of Kadjeti -->
        <rect x="235" y="60" width="170" height="145" rx="8" fill="#1e1b4b" stroke="#f43f5e" stroke-width="2.5" />
        <!-- Three Rock-Hewn Gates -->
        <path d="M 255,205 L 255,155 Q 272,140 290,155 L 290,205 Z" fill="#f59e0b" class="anim-pulse" />
        <path d="M 302,205 L 302,150 Q 320,132 338,150 L 338,205 Z" fill="#e11d48" class="anim-pulse" />
        <path d="M 350,205 L 350,155 Q 368,140 385,155 L 385,205 Z" fill="#38bdf8" class="anim-pulse" />
        <!-- Three Converging Attack Vectors (Tariel, Avtandil, Pridon) -->
        <line x1="95" y1="230" x2="265" y2="180" stroke="#f59e0b" stroke-width="3.5" class="anim-dash" />
        <line x1="320" y1="248" x2="320" y2="185" stroke="#e11d48" stroke-width="3.5" class="anim-dash" />
        <line x1="545" y1="230" x2="375" y2="180" stroke="#38bdf8" stroke-width="3.5" class="anim-dash" />
        <text x="320" y="32" text-anchor="middle" fill="#fb7185" font-size="12" letter-spacing="1.5">STORMING THE THREE GATES OF KADJETI</text>
      `;
    } else if (st === "wedding_harmony") {
      sceneArt = `
        <!-- Royal Weddings & Triumph of Good over Evil -->
        <g transform="translate(320, 125)">
          <circle r="75" fill="rgba(245,158,11,0.16)" class="anim-pulse" />
          <circle cx="-24" cy="0" r="32" fill="none" stroke="#fbbf24" stroke-width="4" />
          <circle cx="24" cy="0" r="32" fill="none" stroke="#f43f5e" stroke-width="4" />
          <text y="-48" text-anchor="middle" font-size="24" class="anim-float">👑</text>
        </g>
        <text x="320" y="34" text-anchor="middle" fill="#fbbf24" font-size="12" letter-spacing="1.5">TRIUMPH OF GOOD OVER EVIL &amp; ROYAL HARMONY</text>
      `;
    } else {
      // Pavilion Oath / Courtly Letters / Campaign
      sceneArt = `
        <g transform="translate(320, 130)">
          <circle r="68" fill="rgba(245,158,11,0.15)" class="anim-pulse" />
          <rect x="-55" y="-38" width="110" height="76" rx="10" fill="rgba(30,41,59,0.9)" stroke="#fbbf24" stroke-width="2" class="anim-float" />
          <text y="8" text-anchor="middle" font-size="28">${st === "battle_charge" ? "⚔️" : "💌"}</text>
        </g>
        <text x="320" y="34" text-anchor="middle" fill="#fbbf24" font-size="12" letter-spacing="1.5">${
          st === "battle_charge" ? "CHIVALRIC VALOR &amp; CAMPAIGN" : "COURTLY LOVE, OATH &amp; EPISTLES"
        }</text>
      `;
    }

    stageSvg.innerHTML = `
      <!-- Decorative Starry Backdrop -->
      <circle cx="70" cy="45" r="1.5" fill="#fff" opacity="0.6" />
      <circle cx="560" cy="55" r="2" fill="#fbbf24" opacity="0.7" />
      <circle cx="140" cy="110" r="1.5" fill="#fff" opacity="0.4" />
      <circle cx="510" cy="125" r="1.5" fill="#38bdf8" opacity="0.6" />
      ${sceneArt}
    `;

    stageMaximKa.textContent = ch.key_maxim_ka || "";
    stageMaximEn.textContent = ch.key_maxim_en || "";

    stageCharacters.innerHTML = (ch.active_characters || [])
      .map((c) => `<span class="char-badge">👤 ${escapeHtml(c)}</span>`)
      .join("");

    stageStanzaIndicator.textContent = `Chapter ${ch.chapter_number} of 65 · ${ch.stanza_count} Stanzas (St. ${ch.stanza_range})`;
  }

  // Render Chapter Header, Expert Commentary, and Stanzas
  function renderChapterContent(ch) {
    chapterActBadge.textContent = `${ch.act_title} · Chapter ${ch.chapter_number}`;
    chapterMainTitleEn.textContent = `${ch.chapter_number}. ${ch.chapter_title_en}`;
    chapterMainTitleKa.textContent = ch.chapter_title_ka;
    chapterSourceLink.href = ch.chapter_source_url || "https://www.georgianencyclopedia.ge/en/form_eng/903";
    chapterStanzaSpan.textContent = `Stanzas ${ch.stanza_range} (${ch.stanza_count} quatrains)`;
    chapterExpertExplanation.textContent = ch.chapter_expert_explanation_en || "";

    renderStanzas(ch.stanzas || []);
  }

  function renderStanzas(stanzas) {
    stanzaListContainer.innerHTML = "";
    const isSingleCol = state.viewMode !== "bilingual";

    stanzas.forEach((st) => {
      const card = document.createElement("div");
      card.className = "stanza-card";
      card.id = `stanza-${st.stanza_number}`;

      const wardropLabel = st.wardrop_stanza_number
        ? `Wardrop English Stanza #${st.wardrop_stanza_number}`
        : `1966 Critical Edition Stanza (Unnumbered in 1912 Wardrop Edition)`;

      let columnsHtml = "";
      if (state.viewMode === "bilingual") {
        columnsHtml = `
          <div class="stanza-columns">
            <div class="stanza-ka-text">${escapeHtml(st.georgian_raw_text || "")}</div>
            <div class="stanza-en-text">${escapeHtml(st.english_translation || "Included in the 1966 Georgian critical edition (omitted in the 1888/1912 Wardrop base manuscript).")}</div>
          </div>
        `;
      } else if (state.viewMode === "ka") {
        columnsHtml = `
          <div class="stanza-columns single-col">
            <div class="stanza-ka-text">${escapeHtml(st.georgian_raw_text || "")}</div>
          </div>
        `;
      } else {
        columnsHtml = `
          <div class="stanza-columns single-col">
            <div class="stanza-en-text">${escapeHtml(st.english_translation || "")}</div>
          </div>
        `;
      }

      const sourcesHtml = (st.scholarly_sources || [])
        .map((s) => `<a class="source-chip" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">📚 ${escapeHtml(s.work || s.author || "Scholarly Source")}</a>`)
        .join("");

      card.innerHTML = `
        <div class="stanza-card-top">
          <span class="stanza-num-badge">Stanza ${st.stanza_number}</span>
          <span>${escapeHtml(wardropLabel)}</span>
        </div>
        ${columnsHtml}
        ${
          state.viewMode !== "ka" && st.expert_explanation_en
            ? `<div class="stanza-commentary">
                 <strong>🎓 Expert Commentary:</strong> ${escapeHtml(st.expert_explanation_en)}
                 <div class="stanza-sources">${sourcesHtml}</div>
               </div>`
            : ""
        }
      `;
      stanzaListContainer.appendChild(card);
    });
  }

  function selectChapter(chNum, scrollStanzaNum) {
    state.currentChapterNumber = chNum;
    localStorage.setItem("vepkhistkaosani_chapter", String(chNum));
    renderAll();
    if (scrollStanzaNum) {
      setTimeout(() => {
        const target = document.getElementById(`stanza-${scrollStanzaNum}`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.style.borderColor = "#f59e0b";
        }
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderAll() {
    const ch = getCurrentChapter();
    if (!ch) return;
    renderChapterList();
    renderStageScene(ch);
    renderWorldMap(ch);
    renderChapterContent(ch);
  }

  // Event Listeners
  btnPrevChapter.addEventListener("click", () => {
    if (state.currentChapterNumber > 1) {
      selectChapter(state.currentChapterNumber - 1);
    }
  });

  btnNextChapter.addEventListener("click", () => {
    if (state.currentChapterNumber < CHAPTERS.length) {
      selectChapter(state.currentChapterNumber + 1);
    } else {
      selectChapter(1);
    }
  });

  btnAutoPlay.addEventListener("click", () => {
    if (state.autoPlayTimer) {
      clearInterval(state.autoPlayTimer);
      state.autoPlayTimer = null;
      btnAutoPlay.textContent = "▶ Play Story";
      btnAutoPlay.classList.remove("active");
    } else {
      btnAutoPlay.textContent = "⏸ Pause Story";
      btnAutoPlay.classList.add("active");
      state.autoPlayTimer = setInterval(() => {
        const next = state.currentChapterNumber < CHAPTERS.length ? state.currentChapterNumber + 1 : 1;
        selectChapter(next);
      }, 4500);
    }
  });

  btnThemeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "manuscript" : "dark";
    applyTheme();
  });

  btnResetMapFilter.addEventListener("click", () => {
    state.locationFilter = null;
    renderAll();
  });

  // Act Filter Pills
  document.querySelectorAll("#actFilterBar .act-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#actFilterBar .act-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state.actFilter = pill.getAttribute("data-act");
      const filtered = getFilteredChapters();
      if (filtered.length && !filtered.some((c) => c.chapter_number === state.currentChapterNumber)) {
        state.currentChapterNumber = filtered[0].chapter_number;
      }
      renderAll();
    });
  });

  // View Mode Toggle Buttons
  document.querySelectorAll("#viewModeButtons .btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#viewModeButtons .btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.viewMode = btn.getAttribute("data-view");
      const ch = getCurrentChapter();
      if (ch) renderStanzas(ch.stanzas || []);
    });
  });

  // Scholarly Monograph Modal
  btnScholarlyGuide.addEventListener("click", () => {
    modalTitle.textContent = "📜 Official Scholarly Monograph & Edition Synthesis";
    const authorities = (METADATA.primary_scholarly_authorities || [])
      .map(
        (a) => `
        <li style="margin-bottom:0.65rem;">
          <strong>${escapeHtml(a.scholar_or_institution)}</strong> — <em>${escapeHtml(a.work)}</em>
          (<a class="source-link" href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer">Open Source ↗</a>)
        </li>`
      )
      .join("");

    const themesHtml = Object.entries(MONOGRAPH)
      .map(
        ([k, v]) => `
        <div class="expert-box" style="margin-bottom:0.85rem;">
          <div class="expert-box-label">${escapeHtml(k.replace(/_/g, " ").toUpperCase())}</div>
          <p>${escapeHtml(typeof v === "string" ? v : JSON.stringify(v))}</p>
        </div>`
      )
      .join("");

    modalBody.innerHTML = `
      <p style="margin-bottom:1rem; color:var(--text-secondary);">
        This interactive edition pairs all <strong>1,669 Georgian stanzas (6,676 lines)</strong> from the 1966 Akaki Shanidze &amp; Aleksandre Baramidze critical edition with all <strong>1,576 English stanzas</strong> of Marjory Scott Wardrop's 1912 translation and official Rustvelological commentary.
      </p>
      <h4 style="color:var(--accent-gold); margin-bottom:0.5rem;">Primary Academic Authorities</h4>
      <ul style="padding-left:1.2rem; margin-bottom:1.25rem; color:var(--text-secondary);">${authorities}</ul>
      <h4 style="color:var(--accent-gold); margin-bottom:0.5rem;">Core Philosophical &amp; Poetic Pillars</h4>
      ${themesHtml}
    `;
    infoModal.classList.add("open");
  });

  // Global Full-Poem Search
  globalSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = globalSearchInput.value.trim().toLowerCase();
      if (q.length < 2) return;
      const matches = [];
      for (const ch of CHAPTERS) {
        for (const st of ch.stanzas || []) {
          const hay = `${st.georgian_raw_text || ""} ${st.english_translation || ""} ${st.expert_explanation_en || ""}`.toLowerCase();
          if (hay.includes(q)) {
            matches.push({ ch, st });
            if (matches.length >= 40) break;
          }
        }
        if (matches.length >= 40) break;
      }

      modalTitle.textContent = `🔍 Search Results for "${globalSearchInput.value.trim()}" (${matches.length}${matches.length === 40 ? "+" : ""} matches)`;
      if (!matches.length) {
        modalBody.innerHTML = `<p style="color:var(--text-secondary);">No stanzas matched your query. Try searching in Georgian (e.g., <code>ლომისა</code>, <code>მზე</code>) or English (e.g., <code>lion</code>, <code>Plato</code>, <code>friend</code>).</p>`;
      } else {
        modalBody.innerHTML = matches
          .map(
            ({ ch, st }) => `
            <div class="stanza-card" style="margin-bottom:0.75rem; cursor:pointer;" data-goto-ch="${ch.chapter_number}" data-goto-st="${st.stanza_number}">
              <div class="stanza-card-top">
                <span class="stanza-num-badge">Chapter ${ch.chapter_number} · Stanza ${st.stanza_number}</span>
                <span>${escapeHtml(ch.chapter_title_en)}</span>
              </div>
              <div class="stanza-ka-text" style="font-size:0.9rem; margin-bottom:0.4rem;">${escapeHtml(st.georgian_raw_text || "")}</div>
              <div class="stanza-en-text" style="font-size:0.86rem;">${escapeHtml(st.english_translation || "")}</div>
            </div>`
          )
          .join("");

        modalBody.querySelectorAll("[data-goto-ch]").forEach((el) => {
          el.addEventListener("click", () => {
            const cnum = parseInt(el.getAttribute("data-goto-ch"), 10);
            const snum = parseInt(el.getAttribute("data-goto-st"), 10);
            infoModal.classList.remove("open");
            state.actFilter = "all";
            state.locationFilter = null;
            document.querySelectorAll("#actFilterBar .act-pill").forEach((p) => p.classList.toggle("active", p.getAttribute("data-act") === "all"));
            selectChapter(cnum, snum);
          });
        });
      }
      infoModal.classList.add("open");
    }
  });

  btnCloseModal.addEventListener("click", () => infoModal.classList.remove("open"));
  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) infoModal.classList.remove("open");
  });

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // Initialize
  applyTheme();
  renderAll();
})();
