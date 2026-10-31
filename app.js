let graphData = null;
let bundleData = window.VEPKHISTKAOSANI_BUNDLE || null;
let stanzasByNumber = {};
let chaptersByNumber = {};
let episodeSteps = [];
let chapterSteps = [];

let currentStepIndex = 0;
let activeFilterType = "all";
let currentGranularity = "episodes"; // "episodes" (26) | "chapters" (65)
let currentLang = "ka"; // "ka" | "en" on main view; "ka" | "en" | "bi" in modal
let modalLang = "ka";
let showAllCommentary = false;
let scrollObserver = null;
let currentModalStep = null;
let currentModalHighlightStanza = null;

const svg = d3.select("#stageSvg");
const defs = svg.append("defs");
const gRealms = svg.append("g").attr("class", "realms-layer");
const gEdges = svg.append("g").attr("class", "edges-layer");
const gNodes = svg.append("g").attr("class", "nodes-layer");

let width = 860;
let height = 620;

const FILTER_LABELS = {
  all: { ka: "ყველა", en: "All" },
  love: { ka: "💍 მიჯნურობა", en: "💍 Love" },
  brotherhood: { ka: "🤝 ძმობა", en: "🤝 Brotherhood" },
  feudal: { ka: "👑 მეფობა", en: "👑 Fealty" },
  service: { ka: "🛡️ მსახურება", en: "🛡️ Service" },
  letter: { ka: "💌 წერილი", en: "💌 Letter" },
  conflict: { ka: "⚔️ ბრძოლა", en: "⚔️ Conflict" },
  rescue: { ka: "🔓 დახსნა", en: "🔓 Rescue" },
  grief_support: { ka: "💧 თანაგრძნობა", en: "💧 Empathy" }
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function indexPoemBundle() {
  if (!bundleData && window.VEPKHISTKAOSANI_BUNDLE) {
    bundleData = window.VEPKHISTKAOSANI_BUNDLE;
  }
  if (!bundleData || !Array.isArray(bundleData.chapters)) return;

  bundleData.chapters.forEach((ch) => {
    chaptersByNumber[ch.chapter_number] = ch;
    (ch.stanzas || []).forEach((st) => {
      stanzasByNumber[String(st.stanza_number)] = {
        ...st,
        chapter_number: ch.chapter_number,
        chapter_title_ka: ch.chapter_title_ka,
        chapter_title_en: ch.chapter_title_en
      };
    });
  });
}

function parseStanzaRange(rangeStr) {
  if (!rangeStr) return [1, 1];
  const parts = String(rangeStr).split(/[–-]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return [parts[0] || 1, parts[0] || 1];
}

function build65ChapterSteps() {
  if (!bundleData || !Array.isArray(bundleData.chapters) || !graphData) return [];

  return bundleData.chapters.map((ch) => {
    const [stStart, stEnd] = parseStanzaRange(ch.stanza_range);
    let parentEp = graphData.steps.find(
      (ep) => Array.isArray(ep.poemChapters) && ep.poemChapters.includes(ch.chapter_number)
    );
    if (!parentEp) {
      parentEp =
        graphData.steps.find((ep) => stStart >= ep.stanzaStart && stStart <= ep.stanzaEnd) ||
        graphData.steps[0];
    }

    const firstStanza = (ch.stanzas && ch.stanzas[0]) || null;
    const verseKa = firstStanza
      ? firstStanza.georgian_raw_text.split("\n").slice(0, 2).join(" / ")
      : parentEp.verse_ka;
    const verseEn = firstStanza
      ? firstStanza.english_translation
      : parentEp.verse_en;

    return {
      id: `ch_${ch.chapter_number}`,
      chapterNumber: ch.chapter_number,
      poemChapters: [ch.chapter_number],
      stanzaStart: stStart,
      stanzaEnd: stEnd,
      mode: parentEp.mode || "present",
      title: ch.chapter_title_ka,
      title_ka: ch.chapter_title_ka,
      title_en: ch.chapter_title_en,
      narrative: parentEp.narrative_ka,
      narrative_ka: parentEp.narrative_ka,
      narrative_en: ch.chapter_expert_explanation_en || parentEp.narrative_en,
      verse: verseKa,
      verse_ka: verseKa,
      verse_en: verseEn,
      verse_stanza: stStart,
      nodeRealms: { ...parentEp.nodeRealms },
      nodeStatus: parentEp.nodeStatus ? { ...parentEp.nodeStatus } : {},
      interactions: (parentEp.interactions || []).map((inter) => ({ ...inter }))
    };
  });
}

function getActiveSteps() {
  return currentGranularity === "chapters" && chapterSteps.length > 0
    ? chapterSteps
    : episodeSteps;
}

async function initApp() {
  indexPoemBundle();

  if (window.STORY_GRAPH_BUNDLE) {
    graphData = window.STORY_GRAPH_BUNDLE;
  } else {
    const response = await fetch("data/story_graph.json");
    graphData = await response.json();
  }

  episodeSteps = graphData.steps || [];
  chapterSteps = build65ChapterSteps();

  setupArrowMarkers();
  buildScrubber();
  buildScrollCards();
  setupControls();
  updateDimensions();
  renderRealms();
  updateGraph(0);
  setupScrollObserver();
}

function setupArrowMarkers() {
  if (!graphData || !graphData.interaction_types) return;
  defs.selectAll("*").remove();

  Object.entries(graphData.interaction_types).forEach(([typeKey, meta]) => {
    defs
      .append("marker")
      .attr("id", `arrow-${typeKey}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 23)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L10,0L0,4")
      .attr("fill", meta.color || "#d4af37");
  });
}

function updateDimensions() {
  const bounds = document.getElementById("stageContainer").getBoundingClientRect();
  width = Math.max(bounds.width || 800, 360);
  height = Math.max(bounds.height || 600, 360);
  svg.attr("viewBox", `0 0 ${width} ${height}`);
}

function getRealmX(realmId) {
  const idx = graphData.realms.findIndex((r) => r.id === realmId);
  const laneWidth = width / graphData.realms.length;
  return (idx >= 0 ? idx : 0) * laneWidth + laneWidth / 2;
}

function renderRealms() {
  const laneWidth = width / graphData.realms.length;
  const lanes = gRealms.selectAll(".realm-group").data(graphData.realms, (d) => d.id);

  const enter = lanes.enter().append("g").attr("class", "realm-group");
  enter.append("rect").attr("class", "realm-lane").attr("y", 0);
  enter.append("text").attr("class", "realm-label").attr("y", 26).attr("text-anchor", "middle");

  const merged = enter.merge(lanes);
  merged
    .select("rect")
    .attr("x", (d, i) => i * laneWidth)
    .attr("width", laneWidth)
    .attr("height", height)
    .attr("fill", (d) => d.color);

  merged
    .select(".realm-label")
    .attr("x", (d, i) => i * laneWidth + laneWidth / 2)
    .text((d) => (currentLang === "en" ? d.name_en : d.name_ka));

  lanes.exit().remove();
}

function buildScrubber() {
  const scrubber = document.getElementById("timelineScrubber");
  scrubber.innerHTML = "";
  const steps = getActiveSteps();

  steps.forEach((step, idx) => {
    const dot = document.createElement("div");
    dot.className = `scrubber-dot ${step.mode === "flashback" ? "flashback" : ""} ${idx === currentStepIndex ? "active" : ""}`;
    const titleText = currentLang === "en" ? step.title_en || step.title : step.title_ka || step.title;
    dot.title = `${step.chapterNumber}. ${titleText} (${step.stanzaStart}–${step.stanzaEnd})`;
    dot.addEventListener("click", () => {
      const targetCard = document.getElementById(`card-${idx}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    scrubber.appendChild(dot);
  });
}

function buildScrollCards() {
  const scroller = document.getElementById("scroller");
  scroller.innerHTML = "";
  const steps = getActiveSteps();

  steps.forEach((step, idx) => {
    const card = document.createElement("article");
    card.className = `step-card ${step.mode === "flashback" ? "flashback-card" : ""} ${idx === currentStepIndex ? "active" : ""}`;
    card.id = `card-${idx}`;

    const isEn = currentLang === "en";
    const stepLabel =
      currentGranularity === "chapters"
        ? isEn
          ? `Chapter ${step.chapterNumber}`
          : `თავი ${step.chapterNumber}`
        : isEn
          ? `Episode ${step.chapterNumber}`
          : `ეპიზოდი ${step.chapterNumber}`;

    const stanzaLabel = isEn
      ? `St. ${step.stanzaStart}–${step.stanzaEnd}`
      : `სტრ. ${step.stanzaStart}–${step.stanzaEnd}`;

    const flashbackTag =
      step.mode === "flashback"
        ? `<span>${isEn ? "📜 Flashback" : "📜 მოგონება"}</span>`
        : "";

    const titleText = isEn ? step.title_en || step.title : step.title_ka || step.title;
    const bodyText = isEn ? step.narrative_en || step.narrative : step.narrative_ka || step.narrative;
    const verseText = isEn ? step.verse_en || step.verse : step.verse_ka || step.verse;
    const btnText = isEn
      ? `📖 Read Stanzas (${step.stanzaStart}–${step.stanzaEnd})`
      : `📖 სტროფები (${step.stanzaStart}–${step.stanzaEnd})`;

    card.innerHTML = `
      <div class="step-meta">
        <span>${escapeHtml(stepLabel)} • ${escapeHtml(stanzaLabel)}</span>
        ${flashbackTag}
      </div>
      <h2 class="step-title">${escapeHtml(titleText)}</h2>
      <p class="step-body">${escapeHtml(bodyText)}</p>
      <blockquote class="step-verse">${escapeHtml(verseText)}</blockquote>
      <button class="read-stanzas-btn" data-step="${idx}">
        ${escapeHtml(btnText)}
      </button>
    `;
    scroller.appendChild(card);
  });

  document.querySelectorAll(".read-stanzas-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.currentTarget.dataset.step, 10);
      const step = getActiveSteps()[idx];
      openStanzaModal(step, null);
    });
  });
}

function computePositions(nodeRealms) {
  const groups = {};
  Object.entries(nodeRealms).forEach(([charId, realmId]) => {
    if (!groups[realmId]) groups[realmId] = [];
    groups[realmId].push(charId);
  });

  const laneWidth = width / graphData.realms.length;
  const coords = {};

  Object.entries(groups).forEach(([realmId, charIds]) => {
    const cx = getRealmX(realmId);
    const usableHeight = height - 105;
    const stepY = usableHeight / (charIds.length + 1);
    charIds.forEach((charId, i) => {
      let xOffset = 0;
      if (charIds.length >= 3) {
        xOffset = (i % 2 === 0 ? -1 : 1) * Math.min(laneWidth * 0.15, 16);
      }
      coords[charId] = {
        x: cx + xOffset,
        y: 55 + stepY * (i + 1)
      };
    });
  });
  return coords;
}

function updateGraph(stepIndex) {
  const steps = getActiveSteps();
  if (!steps.length) return;
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  currentStepIndex = safeIndex;
  const step = steps[safeIndex];

  document.getElementById("currentChapter").textContent = `${step.chapterNumber} / ${steps.length}`;

  const modeBadge = document.getElementById("modeBadge");
  if (step.mode === "flashback") {
    modeBadge.textContent = currentLang === "en" ? "📜 Flashback" : "📜 მოგონება";
    modeBadge.classList.remove("hidden");
  } else {
    modeBadge.classList.add("hidden");
  }

  document.getElementById("stageContainer").classList.toggle("flashback-stage", step.mode === "flashback");

  document.querySelectorAll(".scrubber-dot").forEach((dot, idx) => {
    dot.classList.toggle("active", idx === safeIndex);
  });

  const positions = computePositions(step.nodeRealms);
  const nodesArray = Object.keys(step.nodeRealms)
    .map((charId) => {
      const chObj = graphData.characters[charId];
      if (!chObj || !positions[charId]) return null;
      return {
        ...chObj,
        x: positions[charId].x,
        y: positions[charId].y,
        currentRealm: step.nodeRealms[charId]
      };
    })
    .filter(Boolean);

  const filteredInteractions = (step.interactions || []).filter(
    (edge) => activeFilterType === "all" || edge.type === activeFilterType
  );

  const pairCounter = {};
  const edgesArray = filteredInteractions
    .map((edge, idx) => {
      const pairKey = [edge.source, edge.target].sort().join("--");
      pairCounter[pairKey] = (pairCounter[pairKey] || 0) + 1;
      const pairIndex = pairCounter[pairKey];

      const sPos = positions[edge.source];
      const tPos = positions[edge.target];
      if (!sPos || !tPos) return null;

      const dx = tPos.x - sPos.x;
      const dy = tPos.y - sPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const bendSign = pairIndex % 2 === 1 ? 1 : -1;
      const bendMag = Math.min(48, dist * 0.22) * bendSign * Math.ceil(pairIndex / 2);

      const cx = (sPos.x + tPos.x) / 2 + nx * bendMag;
      const cy = (sPos.y + tPos.y) / 2 + ny * bendMag;
      const midX = 0.25 * sPos.x + 0.5 * cx + 0.25 * tPos.x;
      const midY = 0.25 * sPos.y + 0.5 * cy + 0.25 * tPos.y;

      return {
        ...edge,
        typeMeta: graphData.interaction_types[edge.type],
        sourcePos: sPos,
        targetPos: tPos,
        cx,
        cy,
        midX,
        midY,
        id: `${edge.source}-${edge.target}-${edge.type}-${idx}`
      };
    })
    .filter(Boolean);

  const t = d3.transition().duration(550).ease(d3.easeCubicOut);

  // Edges
  const edges = gEdges.selectAll(".edge-group").data(edgesArray, (d) => d.id);
  const edgesEnter = edges
    .enter()
    .append("g")
    .attr("class", "edge-group")
    .on("click", (event, d) => openInspector("interaction", d, step));

  edgesEnter.append("path").attr("class", "edge-line").attr("stroke-width", 2.2);
  edgesEnter.append("circle").attr("class", "emoji-badge-bg").attr("r", 13);
  edgesEnter
    .append("text")
    .attr("class", "emoji-marker")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");

  const edgesMerged = edgesEnter.merge(edges);

  edgesMerged
    .select(".edge-line")
    .transition(t)
    .attr("stroke", (d) => (d.typeMeta ? d.typeMeta.color : "#d4af37"))
    .attr("marker-end", (d) => `url(#arrow-${d.type})`)
    .attr("d", (d) => `M${d.sourcePos.x},${d.sourcePos.y} Q${d.cx},${d.cy} ${d.targetPos.x},${d.targetPos.y}`);

  edgesMerged
    .select(".emoji-badge-bg")
    .transition(t)
    .attr("cx", (d) => d.midX)
    .attr("cy", (d) => d.midY)
    .attr("stroke", (d) => (d.typeMeta ? d.typeMeta.color : "#d4af37"));

  edgesMerged
    .select(".emoji-marker")
    .text((d) => (d.typeMeta ? d.typeMeta.emoji : "🔗"))
    .transition(t)
    .attr("x", (d) => d.midX)
    .attr("y", (d) => d.midY);

  edges.exit().remove();

  // Character Nodes
  const nodes = gNodes.selectAll(".character-group").data(nodesArray, (d) => d.id);
  const nodesEnter = nodes
    .enter()
    .append("g")
    .attr("class", "character-group")
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .on("click", (event, d) => openInspector("character", d, step));

  nodesEnter
    .append("circle")
    .attr("class", "character-node")
    .attr("r", 17)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  nodesEnter.append("text").attr("class", "node-label").attr("dy", 31);

  const nodesMerged = nodesEnter.merge(nodes);
  nodesMerged.transition(t).attr("transform", (d) => `translate(${d.x},${d.y})`);
  nodesMerged.select(".character-node").attr("fill", (d) => d.color);
  nodesMerged
    .select(".node-label")
    .text((d) => (currentLang === "en" ? d.name_en || d.name : d.name_ka || d.name));

  nodes.exit().transition(t).style("opacity", 0).remove();
}

function openInspector(kind, data, step) {
  const inspector = document.getElementById("inspector");
  const titleEl = document.getElementById("inspectorTitle");
  const bodyEl = document.getElementById("inspectorBody");
  inspector.classList.add("open");
  const isEn = currentLang === "en";

  if (kind === "character") {
    const realm = graphData.realms.find((r) => r.id === data.currentRealm);
    const activeLinks = (step.interactions || []).filter(
      (e) => e.source === data.id || e.target === data.id
    );

    const charName = isEn ? data.name_en || data.name : data.name_ka || data.name;
    const charTitle = isEn ? data.title_en || data.title : data.title_ka || data.title;
    const realmName = realm ? (isEn ? realm.name_en : realm.name_ka) : data.currentRealm;
    const statusObj = step.nodeStatus && step.nodeStatus[data.id];

    titleEl.textContent = charName;
    bodyEl.innerHTML = `
      <div class="inspector-sub">${escapeHtml(charTitle)} • 📍 ${escapeHtml(realmName)}</div>
      ${
        statusObj
          ? `<div class="inspector-status-box">${escapeHtml(isEn ? statusObj.en : statusObj.ka)}</div>`
          : ""
      }
      <div style="font-size:0.76rem; color:var(--text-muted); margin-bottom:4px;">
        ${isEn ? `Active Bonds (${activeLinks.length})` : `მიმდინარე კავშირები (${activeLinks.length})`}
      </div>
      <ul class="inspector-conn-list">
        ${activeLinks
          .map((l, idx) => {
            const otherId = l.source === data.id ? l.target : l.source;
            const other = graphData.characters[otherId];
            const otherName = isEn ? other?.name_en || other?.name : other?.name_ka || other?.name;
            const emoji = graphData.interaction_types[l.type]?.emoji || "🔗";
            const lbl = isEn ? l.label_en || l.label : l.label_ka || l.label;
            return `<li class="inspector-conn-item" data-conn-idx="${idx}">
              <strong>${emoji} ${escapeHtml(otherName)}</strong> — ${escapeHtml(lbl)}
            </li>`;
          })
          .join("")}
      </ul>
    `;

    bodyEl.querySelectorAll(".inspector-conn-item").forEach((item) => {
      item.addEventListener("click", () => {
        const cIdx = parseInt(item.getAttribute("data-conn-idx"), 10);
        const link = activeLinks[cIdx];
        if (link) {
          openInspector(
            "interaction",
            { ...link, typeMeta: graphData.interaction_types[link.type] },
            step
          );
        }
      });
    });
  } else {
    const src = graphData.characters[data.source];
    const tgt = graphData.characters[data.target];
    const emoji = data.typeMeta ? data.typeMeta.emoji : "🔗";
    const bondTitle = isEn ? data.label_en || data.label : data.label_ka || data.label;
    const srcName = isEn ? src?.name_en || src?.name : src?.name_ka || src?.name;
    const tgtName = isEn ? tgt?.name_en || tgt?.name : tgt?.name_ka || tgt?.name;
    const detailText = isEn ? data.detail_en || data.detail : data.detail_ka || data.detail;

    const fullStanza = data.stanza_ref ? stanzasByNumber[String(data.stanza_ref)] : null;
    const quoteText = isEn
      ? fullStanza?.english_translation || data.quote_en || data.quote
      : fullStanza?.georgian_raw_text || data.quote_ka || data.quote;

    titleEl.textContent = `${emoji} ${bondTitle}`;
    bodyEl.innerHTML = `
      <div class="inspector-sub">
        ${escapeHtml(srcName)} ➔ ${escapeHtml(tgtName)}
        ${data.stanza_ref ? ` • ${isEn ? "Stanza" : "სტროფი"} #${data.stanza_ref}` : ""}
      </div>
      <p style="font-size:0.83rem; line-height:1.55; color:#dce1f0;">${escapeHtml(detailText)}</p>
      <div class="inspector-verse-box">${escapeHtml(quoteText)}</div>
      <div style="margin-top:12px;">
        <button class="read-stanzas-btn" id="inspectorOpenStanzaBtn" style="width:100%;">
          📖 ${
            data.stanza_ref
              ? isEn
                ? `Open Stanza #${data.stanza_ref} in Reader`
                : `სტროფი #${data.stanza_ref} სრულ ტექსტში`
              : isEn
                ? `Read Stanzas (${step.stanzaStart}–${step.stanzaEnd})`
                : `სტროფები (${step.stanzaStart}–${step.stanzaEnd})`
          }
        </button>
      </div>
    `;

    const openBtn = document.getElementById("inspectorOpenStanzaBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        openStanzaModal(step, data.stanza_ref || null);
      });
    }
  }
}

function openStanzaModal(step, highlightStanzaNum) {
  currentModalStep = step;
  currentModalHighlightStanza = highlightStanzaNum;

  const modal = document.getElementById("stanzaModal");
  const title = document.getElementById("modalTitle");
  const subtitle = document.getElementById("modalSubtitle");
  const metaBox = document.getElementById("modalChapterMeta");
  const body = document.getElementById("modalStanzasBody");

  const isEn = currentLang === "en";
  title.textContent = isEn ? step.title_en || step.title : step.title_ka || step.title;
  subtitle.textContent = isEn
    ? `Stanzas ${step.stanzaStart}–${step.stanzaEnd}`
    : `სტროფები ${step.stanzaStart}–${step.stanzaEnd}`;

  const coveredChapters = [];
  if (Array.isArray(step.poemChapters)) {
    step.poemChapters.forEach((chNum) => {
      if (chaptersByNumber[chNum]) coveredChapters.push(chaptersByNumber[chNum]);
    });
  }

  if (showAllCommentary && coveredChapters.length > 0) {
    metaBox.classList.remove("hidden");
    metaBox.innerHTML = coveredChapters
      .map(
        (ch) => `
        <div style="margin-bottom:4px;">
          <strong style="color:var(--accent-gold);">${escapeHtml(ch.chapter_title_ka)} / ${escapeHtml(ch.chapter_title_en)}</strong>:
          ${escapeHtml(ch.chapter_expert_explanation_en || "")}
        </div>`
      )
      .join("");
  } else {
    metaBox.classList.add("hidden");
  }

  body.innerHTML = "";
  const foundStanzas = [];
  for (let s = step.stanzaStart; s <= step.stanzaEnd; s++) {
    if (stanzasByNumber[String(s)]) {
      foundStanzas.push(stanzasByNumber[String(s)]);
    }
  }

  if (foundStanzas.length > 0) {
    foundStanzas.forEach((st) => {
      const div = document.createElement("div");
      const isHighlighted = Number(highlightStanzaNum) === Number(st.stanza_number);
      div.className = `stanza-item ${isHighlighted ? "highlighted-stanza" : ""}`;
      div.id = `modal-stanza-${st.stanza_number}`;

      let linesHtml = "";
      if (modalLang === "bi") {
        linesHtml = `
          <div class="stanza-grid">
            <div class="stanza-lines-ka">${escapeHtml(st.georgian_raw_text)}</div>
            <div class="stanza-lines-en">${escapeHtml(st.english_translation || "")}</div>
          </div>
        `;
      } else if (modalLang === "ka") {
        linesHtml = `
          <div class="stanza-grid single-col">
            <div class="stanza-lines-ka">${escapeHtml(st.georgian_raw_text)}</div>
          </div>
        `;
      } else {
        linesHtml = `
          <div class="stanza-grid single-col">
            <div class="stanza-lines-en">${escapeHtml(st.english_translation || "")}</div>
          </div>
        `;
      }

      const sourcesHtml = (st.scholarly_sources || [])
        .map((s) => {
          const url = typeof s === "string" ? s : s.url;
          let host = "Source";
          try {
            host = new URL(url).hostname.replace("www.", "");
          } catch (e) {}
          return `<a class="source-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">📚 ${escapeHtml(host)} ↗</a>`;
        })
        .join("");

      const commentaryHtml = st.expert_explanation_en
        ? `<details class="stanza-commentary-details" ${showAllCommentary ? "open" : ""}>
             <summary>🎓 ${isEn ? "Scholarly Commentary" : "სამეცნიერო კომენტარი"}</summary>
             <div class="commentary-text">
               ${escapeHtml(st.expert_explanation_en)}
               ${sourcesHtml ? `<div class="source-links-row">${sourcesHtml}</div>` : ""}
             </div>
           </details>`
        : "";

      div.innerHTML = `
        <div class="stanza-top-row">
          <span>#${st.stanza_number}</span>
          <span>${st.wardrop_stanza_number ? `Wardrop #${st.wardrop_stanza_number}` : ""}</span>
        </div>
        ${linesHtml}
        ${commentaryHtml}
      `;
      body.appendChild(div);
    });
  } else {
    body.innerHTML = `
      <div class="stanza-item">
        <div class="stanza-top-row"><span>#${step.stanzaStart}–${step.stanzaEnd}</span></div>
        <div class="stanza-lines-ka">${escapeHtml(isEn ? step.verse_en || step.verse : step.verse_ka || step.verse)}</div>
      </div>
    `;
  }

  modal.classList.remove("hidden");

  if (highlightStanzaNum) {
    setTimeout(() => {
      const targetEl = document.getElementById(`modal-stanza-${highlightStanzaNum}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  } else {
    body.scrollTop = 0;
  }
}

function openMonographModal() {
  const modal = document.getElementById("monographModal");
  const body = document.getElementById("monographBody");

  const meta = (bundleData && bundleData.metadata) || {};
  const mono = (bundleData && bundleData.scholarly_monograph_synthesis) || {};

  const sourcesHtml = (meta.verified_sources || [])
    .map(
      (s) => `
      <li style="margin-bottom:6px;">
        <a class="source-chip" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
          🔗 ${escapeHtml(s.title)} ↗
        </a>
      </li>`
    )
    .join("");

  const monoSectionsHtml = Object.entries(mono)
    .map(
      ([key, val]) => `
      <div class="stanza-item">
        <div class="stanza-top-row">
          <span>${escapeHtml(key.replace(/_/g, " ").toUpperCase())}</span>
        </div>
        <p style="font-size:0.84rem; line-height:1.6; color:#dce1f0;">${escapeHtml(val)}</p>
      </div>`
    )
    .join("");

  body.innerHTML = `
    <div class="stanza-item">
      <div class="stanza-top-row">
        <span>${escapeHtml(meta.title_ka || "ვეფხისტყაოსანი")} — ${escapeHtml(meta.title_en || "The Knight in the Panther's Skin")}</span>
        <span>${escapeHtml(meta.composition_period || "c. 1189–1207")}</span>
      </div>
      <p style="font-size:0.84rem; line-height:1.58; color:#cfd5e6;">
        ${escapeHtml(meta.dataset_description || "Complete 65-chapter, 1,669-stanza critical edition paired with Marjory Scott Wardrop's English translation and academic commentary.")}
      </p>
    </div>
    ${monoSectionsHtml}
    <div class="stanza-item">
      <div class="stanza-top-row"><span>აკადემიური წყაროები / Verified Academic Sources</span></div>
      <ul style="list-style:none; margin-top:6px;">${sourcesHtml}</ul>
    </div>
  `;

  modal.classList.remove("hidden");
}

function handleSearchInput(query) {
  const dropdown = document.getElementById("searchDropdown");
  const q = String(query || "").trim();
  if (!q) {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    return;
  }

  const results = [];
  const steps = getActiveSteps();
  const isEn = currentLang === "en";

  const numMatch = q.match(/^#?(\d+)$/);
  if (numMatch) {
    const stNum = parseInt(numMatch[1], 10);
    const matchingStepIdx = steps.findIndex((s) => stNum >= s.stanzaStart && stNum <= s.stanzaEnd);
    if (stanzasByNumber[String(stNum)]) {
      const st = stanzasByNumber[String(stNum)];
      results.push({
        type: "stanza",
        stanzaNum: stNum,
        stepIndex: matchingStepIdx >= 0 ? matchingStepIdx : 0,
        title: `${isEn ? "Stanza" : "სტროფი"} #${stNum}`,
        sub: isEn ? st.english_translation : st.georgian_raw_text.replace(/\n/g, " / ")
      });
    } else if (matchingStepIdx >= 0) {
      const s = steps[matchingStepIdx];
      results.push({
        type: "step",
        stepIndex: matchingStepIdx,
        title: `${s.chapterNumber}. ${isEn ? s.title_en : s.title_ka} (#${stNum})`,
        sub: isEn ? s.narrative_en : s.narrative_ka
      });
    }
  }

  const qLower = q.toLowerCase();
  steps.forEach((step, idx) => {
    const hay = `${step.title_ka || ""} ${step.title_en || ""} ${step.narrative_ka || ""} ${step.narrative_en || ""}`.toLowerCase();
    if (hay.includes(qLower) && results.length < 7) {
      results.push({
        type: "step",
        stepIndex: idx,
        title: `${step.chapterNumber}. ${isEn ? step.title_en || step.title : step.title_ka || step.title}`,
        sub: `${step.stanzaStart}–${step.stanzaEnd}`
      });
    }
  });

  if (q.length >= 2 && results.length < 10) {
    for (let s = 1; s <= 1669; s++) {
      const st = stanzasByNumber[String(s)];
      if (!st) continue;
      if (
        (st.georgian_raw_text && st.georgian_raw_text.toLowerCase().includes(qLower)) ||
        (st.english_translation && st.english_translation.toLowerCase().includes(qLower))
      ) {
        const matchingStepIdx = steps.findIndex(
          (step) => s >= step.stanzaStart && s <= step.stanzaEnd
        );
        results.push({
          type: "stanza",
          stanzaNum: s,
          stepIndex: matchingStepIdx >= 0 ? matchingStepIdx : 0,
          title: `${isEn ? "Stanza" : "სტროფი"} #${s}`,
          sub: isEn ? st.english_translation : st.georgian_raw_text.split("\n")[0]
        });
        if (results.length >= 10) break;
      }
    }
  }

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="search-item"><div class="search-item-sub">${isEn ? "No matches found" : "არაფერი მოიძებნა"}</div></div>`;
    dropdown.classList.remove("hidden");
    return;
  }

  dropdown.innerHTML = results
    .map(
      (r, i) => `
      <div class="search-item" data-res-idx="${i}">
        <div class="search-item-title">${escapeHtml(r.title)}</div>
        <div class="search-item-sub">${escapeHtml(r.sub)}</div>
      </div>`
    )
    .join("");
  dropdown.classList.remove("hidden");

  dropdown.querySelectorAll(".search-item").forEach((el) => {
    el.addEventListener("click", () => {
      const r = results[parseInt(el.getAttribute("data-res-idx"), 10)];
      dropdown.classList.add("hidden");
      if (!r) return;
      const card = document.getElementById(`card-${r.stepIndex}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      updateGraph(r.stepIndex);
      if (r.type === "stanza" && r.stanzaNum) {
        openStanzaModal(steps[r.stepIndex], r.stanzaNum);
      }
    });
  });
}

function updateUITextByLang() {
  const isEn = currentLang === "en";
  document.querySelectorAll("#typeFilters .filter-chip").forEach((btn) => {
    const t = btn.getAttribute("data-type");
    if (FILTER_LABELS[t]) {
      btn.textContent = isEn ? FILTER_LABELS[t].en : FILTER_LABELS[t].ka;
    }
  });

  const epBtn = document.querySelector("#granularityToggle [data-granularity='episodes']");
  const chBtn = document.querySelector("#granularityToggle [data-granularity='chapters']");
  if (epBtn) epBtn.textContent = isEn ? "26 Episodes" : "26 ეპიზოდი";
  if (chBtn) chBtn.textContent = isEn ? "65 Chapters" : "65 თავი";

  const searchInput = document.getElementById("globalSearchInput");
  if (searchInput) {
    searchInput.placeholder = isEn ? "🔍 Stanza # or search..." : "🔍 სტროფი # ან ძებნა...";
  }
}

function setupControls() {
  document.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      activeFilterType = e.currentTarget.dataset.type;
      updateGraph(currentStepIndex);
    });
  });

  document.querySelectorAll("#granularityToggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#granularityToggle .seg-btn").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      currentGranularity = e.currentTarget.getAttribute("data-granularity");
      currentStepIndex = 0;
      buildScrubber();
      buildScrollCards();
      updateGraph(0);
      setupScrollObserver();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("#langToggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#langToggle .seg-btn").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      currentLang = e.currentTarget.getAttribute("data-lang");
      modalLang = currentLang;
      document.querySelectorAll("#modalLangToggle .seg-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-lang") === modalLang);
      });
      updateUITextByLang();
      renderRealms();
      buildScrubber();
      buildScrollCards();
      updateGraph(currentStepIndex);
      setupScrollObserver();
      document.getElementById("inspector").classList.remove("open");
    });
  });

  document.querySelectorAll("#modalLangToggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#modalLangToggle .seg-btn").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      modalLang = e.currentTarget.getAttribute("data-lang");
      if (currentModalStep) {
        openStanzaModal(currentModalStep, currentModalHighlightStanza);
      }
    });
  });

  const commBtn = document.getElementById("toggleCommentaryBtn");
  if (commBtn) {
    commBtn.addEventListener("click", () => {
      showAllCommentary = !showAllCommentary;
      commBtn.classList.toggle("active", showAllCommentary);
      if (currentModalStep) {
        openStanzaModal(currentModalStep, currentModalHighlightStanza);
      }
    });
  }

  const searchInput = document.getElementById("globalSearchInput");
  searchInput.addEventListener("input", (e) => handleSearchInput(e.target.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const firstItem = document.querySelector("#searchDropdown .search-item[data-res-idx='0']");
      if (firstItem) firstItem.click();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      document.getElementById("searchDropdown").classList.add("hidden");
    }
  });

  document.getElementById("closeInspectorBtn").addEventListener("click", () => {
    document.getElementById("inspector").classList.remove("open");
  });

  document.getElementById("closeModalBtn").addEventListener("click", () => {
    document.getElementById("stanzaModal").classList.add("hidden");
  });

  document.getElementById("openMonographBtn").addEventListener("click", () => {
    openMonographModal();
  });

  document.getElementById("closeMonographBtn").addEventListener("click", () => {
    document.getElementById("monographModal").classList.add("hidden");
  });
}

function setupScrollObserver() {
  if (scrollObserver) {
    scrollObserver.disconnect();
  }
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.id.replace("card-", ""), 10);
          if (!isNaN(idx) && idx !== currentStepIndex) {
            currentStepIndex = idx;
            document.querySelectorAll(".step-card").forEach((c, i) => {
              c.classList.toggle("active", i === idx);
            });
            updateGraph(idx);
          }
        }
      });
    },
    { threshold: 0.55 }
  );

  document.querySelectorAll(".step-card").forEach((card) => scrollObserver.observe(card));
}

window.addEventListener("resize", () => {
  updateDimensions();
  renderRealms();
  updateGraph(currentStepIndex);
});

initApp();
