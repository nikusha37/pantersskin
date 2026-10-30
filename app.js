let graphData = null;
let bundleData = window.VEPKHISTKAOSANI_BUNDLE || null;
let stanzasByNumber = {};
let chaptersByNumber = {};
let episodeSteps = [];
let chapterSteps = [];

let currentStepIndex = 0;
let activeFilterType = "all";
let currentGranularity = "episodes"; // "episodes" (26) | "chapters" (65)
let currentLang = "bi"; // "bi" | "ka" | "en"
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
    // Find matching episode in story_graph.json by poemChapters or stanza overlap
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
      title_ka: `თავი ${ch.chapter_number}: ${ch.chapter_title_ka}`,
      title_en: `Chapter ${ch.chapter_number}: ${ch.chapter_title_en}`,
      narrative: ch.chapter_expert_explanation_en || parentEp.narrative_ka,
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
      .attr("refX", 24)
      .attr("refY", 0)
      .attr("markerWidth", 5.5)
      .attr("markerHeight", 5.5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L10,0L0,4")
      .attr("fill", meta.color || "#d4af37");
  });
}

function updateDimensions() {
  const bounds = document.getElementById("stageContainer").getBoundingClientRect();
  width = Math.max(bounds.width || 800, 360);
  height = Math.max((bounds.height || 600) - 32, 360);
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
  enter.append("text").attr("class", "realm-label-ka").attr("y", 24).attr("text-anchor", "middle");
  enter.append("text").attr("class", "realm-label-en").attr("y", 40).attr("text-anchor", "middle");

  const merged = enter.merge(lanes);
  merged
    .select("rect")
    .attr("x", (d, i) => i * laneWidth)
    .attr("width", laneWidth)
    .attr("height", height)
    .attr("fill", (d) => d.color);

  merged
    .select(".realm-label-ka")
    .attr("x", (d, i) => i * laneWidth + laneWidth / 2)
    .text((d) => (currentLang === "en" ? d.name_en : d.name_ka));

  merged
    .select(".realm-label-en")
    .attr("x", (d, i) => i * laneWidth + laneWidth / 2)
    .text((d) => (currentLang === "bi" ? d.name_en : ""));

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
    dot.title = `${step.chapterNumber}. ${titleText} (სტრ. / St. ${step.stanzaStart}–${step.stanzaEnd})`;
    dot.addEventListener("click", () => {
      const targetCard = document.getElementById(`card-${idx}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    scrubber.appendChild(dot);
  });
}

function formatTextByLang(kaText, enText) {
  if (currentLang === "ka") return { primary: kaText || enText, secondary: "" };
  if (currentLang === "en") return { primary: enText || kaText, secondary: "" };
  return { primary: kaText || "", secondary: enText || "" };
}

function buildScrollCards() {
  const scroller = document.getElementById("scroller");
  scroller.innerHTML = "";
  const steps = getActiveSteps();

  steps.forEach((step, idx) => {
    const card = document.createElement("article");
    card.className = `step-card ${step.mode === "flashback" ? "flashback-card" : ""} ${idx === currentStepIndex ? "active" : ""}`;
    card.id = `card-${idx}`;

    const labelPrefix =
      currentGranularity === "chapters"
        ? currentLang === "en"
          ? `Chapter ${step.chapterNumber} / 65`
          : `თავი ${step.chapterNumber} / 65`
        : currentLang === "en"
          ? `Episode ${step.chapterNumber} / ${steps.length}`
          : `ეპიზოდი ${step.chapterNumber} / ${steps.length}`;

    const stanzaLabel =
      currentLang === "en"
        ? `Stanzas ${step.stanzaStart}–${step.stanzaEnd}`
        : `სტროფები ${step.stanzaStart}–${step.stanzaEnd}`;

    const modeLabel =
      step.mode === "flashback"
        ? currentLang === "en"
          ? "📜 Flashback"
          : "📜 რეტროსპექტივა"
        : currentLang === "en"
          ? "⏱️ Present Timeline"
          : "⏱️ აწმყო";

    const titles = formatTextByLang(step.title_ka || step.title, step.title_en || step.title);
    const bodies = formatTextByLang(step.narrative_ka || step.narrative, step.narrative_en || step.narrative);
    const verses = formatTextByLang(step.verse_ka || step.verse, step.verse_en || "");

    const edgePillsHtml = (step.interactions || [])
      .map((edge, eIdx) => {
        const meta = graphData.interaction_types[edge.type] || { emoji: "🔗" };
        const src = graphData.characters[edge.source];
        const tgt = graphData.characters[edge.target];
        const srcName = currentLang === "en" ? src?.name_en || src?.name : src?.name_ka || src?.name;
        const tgtName = currentLang === "en" ? tgt?.name_en || tgt?.name : tgt?.name_ka || tgt?.name;
        const refBadge = edge.stanza_ref ? ` (#${edge.stanza_ref})` : "";
        return `<button class="mini-edge-pill" data-step="${idx}" data-edge="${eIdx}">
          ${meta.emoji} ${escapeHtml(srcName)} ➔ ${escapeHtml(tgtName)}${refBadge}
        </button>`;
      })
      .join("");

    const readBtnLabel =
      currentLang === "en"
        ? `📖 Read Stanzas (${step.stanzaStart}–${step.stanzaEnd})`
        : `📖 წაიკითხე სტროფები (${step.stanzaStart}–${step.stanzaEnd})`;

    card.innerHTML = `
      <div class="step-meta">
        <span>${escapeHtml(labelPrefix)} • ${escapeHtml(stanzaLabel)}</span>
        <span>${escapeHtml(modeLabel)}</span>
      </div>
      <h2 class="step-title">${escapeHtml(titles.primary)}</h2>
      ${titles.secondary ? `<div class="step-title-en">${escapeHtml(titles.secondary)}</div>` : ""}
      <p class="step-body">${escapeHtml(bodies.primary)}</p>
      ${bodies.secondary ? `<p class="step-body-en">${escapeHtml(bodies.secondary)}</p>` : ""}
      <blockquote class="step-verse">
        ${escapeHtml(verses.primary)}
        ${verses.secondary ? `<span class="step-verse-en">${escapeHtml(verses.secondary)}</span>` : ""}
      </blockquote>
      <div class="step-interactions-mini">${edgePillsHtml}</div>
      <div class="step-actions">
        <button class="read-stanzas-btn" data-step="${idx}">
          ${escapeHtml(readBtnLabel)}
        </button>
      </div>
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

  document.querySelectorAll(".mini-edge-pill").forEach((pill) => {
    pill.addEventListener("click", (e) => {
      const sIdx = parseInt(e.currentTarget.dataset.step, 10);
      const eIdx = parseInt(e.currentTarget.dataset.edge, 10);
      const step = getActiveSteps()[sIdx];
      const edge = step.interactions[eIdx];
      if (edge) {
        openInspector(
          "interaction",
          {
            ...edge,
            typeMeta: graphData.interaction_types[edge.type]
          },
          step
        );
      }
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
    const usableHeight = height - 115;
    const stepY = usableHeight / (charIds.length + 1);
    charIds.forEach((charId, i) => {
      // Stagger x slightly when multiple nodes share a column so vertical edges remain clear
      let xOffset = 0;
      if (charIds.length >= 3) {
        xOffset = (i % 2 === 0 ? -1 : 1) * Math.min(laneWidth * 0.16, 18);
      }
      coords[charId] = {
        x: cx + xOffset,
        y: 65 + stepY * (i + 1)
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

  // Update Header & Scrubber
  const prefix = currentGranularity === "chapters" ? (currentLang === "en" ? "Ch." : "თავი") : (currentLang === "en" ? "Ep." : "ეპიზოდი");
  document.getElementById("currentChapter").textContent =
    `${prefix} ${step.chapterNumber} / ${steps.length} • ${step.stanzaStart}–${step.stanzaEnd}`;

  const modeBadge = document.getElementById("modeBadge");
  if (step.mode === "flashback") {
    modeBadge.textContent = currentLang === "en" ? "📜 Flashback" : "📜 მოგონება (Flashback)";
  } else {
    modeBadge.textContent = currentLang === "en" ? "⏱️ Present Timeline" : "⏱️ აწმყო ხაზი";
  }
  modeBadge.classList.toggle("flashback", step.mode === "flashback");

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
        currentRealm: step.nodeRealms[charId],
        statusObj: step.nodeStatus ? step.nodeStatus[charId] : null
      };
    })
    .filter(Boolean);

  const filteredInteractions = (step.interactions || []).filter(
    (edge) => activeFilterType === "all" || edge.type === activeFilterType
  );

  // Track pair counts to curve parallel edges cleanly
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
      // Normal vector for Bezier control point
      const nx = -dy / dist;
      const ny = dx / dist;
      const bendSign = pairIndex % 2 === 1 ? 1 : -1;
      const bendMag = Math.min(52, dist * 0.24) * bendSign * Math.ceil(pairIndex / 2);

      const cx = (sPos.x + tPos.x) / 2 + nx * bendMag;
      const cy = (sPos.y + tPos.y) / 2 + ny * bendMag;
      // Midpoint on quadratic Bezier at t = 0.5
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

  const t = d3.transition().duration(600).ease(d3.easeCubicOut);

  // Render Edges
  const edges = gEdges.selectAll(".edge-group").data(edgesArray, (d) => d.id);
  const edgesEnter = edges
    .enter()
    .append("g")
    .attr("class", "edge-group")
    .on("click", (event, d) => openInspector("interaction", d, step));

  edgesEnter
    .append("path")
    .attr("class", "edge-line")
    .attr("stroke-width", 2.4);

  edgesEnter
    .append("circle")
    .attr("class", "emoji-badge-bg")
    .attr("r", 14);

  edgesEnter
    .append("text")
    .attr("class", "emoji-marker")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");

  edgesEnter
    .append("text")
    .attr("class", "edge-ref-label")
    .attr("text-anchor", "middle");

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

  edgesMerged
    .select(".edge-ref-label")
    .text((d) => (d.stanza_ref ? `#${d.stanza_ref}` : ""))
    .transition(t)
    .attr("x", (d) => d.midX)
    .attr("y", (d) => d.midY + 23);

  edges.exit().remove();

  // Render Character Nodes
  const nodes = gNodes.selectAll(".character-group").data(nodesArray, (d) => d.id);
  const nodesEnter = nodes
    .enter()
    .append("g")
    .attr("class", "character-group")
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .on("click", (event, d) => openInspector("character", d, step));

  nodesEnter
    .append("circle")
    .attr("class", "character-glow")
    .attr("r", 24)
    .attr("fill", (d) => d.color)
    .attr("opacity", 0.18);

  nodesEnter
    .append("circle")
    .attr("class", "character-node")
    .attr("r", 18)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  nodesEnter
    .append("text")
    .attr("class", "node-label")
    .attr("dy", 32);

  nodesEnter
    .append("text")
    .attr("class", "node-sublabel")
    .attr("dy", 44);

  const nodesMerged = nodesEnter.merge(nodes);
  nodesMerged.transition(t).attr("transform", (d) => `translate(${d.x},${d.y})`);
  nodesMerged.select(".character-glow").attr("fill", (d) => d.color);
  nodesMerged.select(".character-node").attr("fill", (d) => d.color);
  nodesMerged
    .select(".node-label")
    .text((d) => (currentLang === "en" ? d.name_en || d.name : d.name_ka || d.name));
  nodesMerged
    .select(".node-sublabel")
    .text((d) => (currentLang === "bi" ? d.name_en || "" : ""));

  nodes.exit().transition(t).style("opacity", 0).remove();
}

function openInspector(kind, data, step) {
  const inspector = document.getElementById("inspector");
  const titleEl = document.getElementById("inspectorTitle");
  const bodyEl = document.getElementById("inspectorBody");
  inspector.classList.add("open");

  if (kind === "character") {
    const realm = graphData.realms.find((r) => r.id === data.currentRealm);
    const activeLinks = (step.interactions || []).filter(
      (e) => e.source === data.id || e.target === data.id
    );

    const charName =
      currentLang === "en"
        ? data.name_en || data.name
        : currentLang === "ka"
          ? data.name_ka || data.name
          : `${data.name_ka || data.name} • ${data.name_en || ""}`;

    const charTitle =
      currentLang === "en"
        ? data.title_en || data.title
        : currentLang === "ka"
          ? data.title_ka || data.title
          : `${data.title_ka || data.title} / ${data.title_en || ""}`;

    const realmName = realm
      ? currentLang === "en"
        ? realm.name_en
        : currentLang === "ka"
          ? realm.name_ka
          : `${realm.name_ka} (${realm.name_en})`
      : data.currentRealm;

    const statusObj = step.nodeStatus && step.nodeStatus[data.id];
    const statusHtml = statusObj
      ? `<div class="inspector-status-box">
           <strong>📍 სტატუსი ამ ეპიზოდში / Current Status:</strong><br/>
           ${escapeHtml(currentLang === "en" ? statusObj.en : statusObj.ka)}
           ${currentLang === "bi" && statusObj.en ? `<div style="color:#9aa1b8; font-size:0.76rem; margin-top:3px;">${escapeHtml(statusObj.en)}</div>` : ""}
         </div>`
      : "";

    titleEl.textContent = charName;
    bodyEl.innerHTML = `
      <div class="inspector-badge-row">
        <span class="inspector-pill">👑 ${escapeHtml(charTitle)}</span>
        <span class="inspector-pill">🗺️ ${escapeHtml(realmName)}</span>
      </div>
      ${statusHtml}
      <p style="font-size:0.82rem; font-weight:600; color:var(--accent-gold);">
        🔗 აქტიური კავშირები ამ სცენაში / Active Bonds (${activeLinks.length}):
      </p>
      <ul class="inspector-conn-list">
        ${activeLinks
          .map((l, idx) => {
            const otherId = l.source === data.id ? l.target : l.source;
            const other = graphData.characters[otherId];
            const otherName = currentLang === "en" ? other?.name_en || other?.name : other?.name_ka || other?.name;
            const emoji = graphData.interaction_types[l.type]?.emoji || "🔗";
            const lbl = currentLang === "en" ? l.label_en || l.label : l.label_ka || l.label;
            const stRef = l.stanza_ref ? ` • სტრ. #${l.stanza_ref}` : "";
            return `<li class="inspector-conn-item" data-conn-idx="${idx}">
              <strong>${emoji} ${escapeHtml(otherName)}</strong>: ${escapeHtml(lbl)}${escapeHtml(stRef)}
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
    const typeName = data.typeMeta
      ? currentLang === "en"
        ? data.typeMeta.label_en
        : currentLang === "ka"
          ? data.typeMeta.label_ka
          : `${data.typeMeta.label_ka} / ${data.typeMeta.label_en}`
      : data.type;

    const bondTitle =
      currentLang === "en"
        ? data.label_en || data.label
        : currentLang === "ka"
          ? data.label_ka || data.label
          : `${data.label_ka || data.label} • ${data.label_en || ""}`;

    const srcName = currentLang === "en" ? src?.name_en || src?.name : src?.name_ka || src?.name;
    const tgtName = currentLang === "en" ? tgt?.name_en || tgt?.name : tgt?.name_ka || tgt?.name;

    const detailKa = data.detail_ka || data.detail || "";
    const detailEn = data.detail_en || "";

    // Look up full stanza in bundle if stanza_ref exists
    const fullStanza = data.stanza_ref ? stanzasByNumber[String(data.stanza_ref)] : null;
    const quoteKa = fullStanza ? fullStanza.georgian_raw_text : data.quote_ka || data.quote || "";
    const quoteEn = fullStanza ? fullStanza.english_translation : data.quote_en || "";
    const commentaryEn = fullStanza ? fullStanza.expert_explanation_en : "";

    titleEl.textContent = `${emoji} ${bondTitle}`;
    bodyEl.innerHTML = `
      <div class="inspector-badge-row">
        <span class="inspector-pill">${emoji} ${escapeHtml(typeName)}</span>
        <span class="inspector-pill">👤 ${escapeHtml(srcName)} ➔ ${escapeHtml(tgtName)}</span>
        ${data.stanza_ref ? `<span class="inspector-pill">📖 სტროფი / Stanza #${data.stanza_ref}</span>` : ""}
      </div>
      <p style="font-size:0.84rem; line-height:1.55;">
        ${escapeHtml(currentLang === "en" ? detailEn || detailKa : detailKa)}
      </p>
      ${
        currentLang === "bi" && detailEn
          ? `<p style="font-size:0.79rem; color:#9aa1b8; margin-top:4px; line-height:1.5;">${escapeHtml(detailEn)}</p>`
          : ""
      }
      <div class="inspector-verse-box">
        ${currentLang !== "en" ? `<div>${escapeHtml(quoteKa)}</div>` : ""}
        ${
          currentLang !== "ka" && quoteEn
            ? `<div style="margin-top:${currentLang === "bi" ? "8px" : "0"}; color:#c5cde0; font-size:0.8rem;">${escapeHtml(quoteEn)}</div>`
            : ""
        }
      </div>
      ${
        commentaryEn && currentLang !== "ka"
          ? `<div class="inspector-commentary-box">
               <strong>🎓 Scholarly Commentary (Stanza #${data.stanza_ref}):</strong><br/>
               ${escapeHtml(commentaryEn)}
             </div>`
          : ""
      }
      <div style="margin-top:12px;">
        <button class="read-stanzas-btn" id="inspectorOpenStanzaBtn" style="width:100%;">
          📖 ${
            data.stanza_ref
              ? `გახსენი სტროფი #${data.stanza_ref} სრულ ტექსტში / Read Stanza #${data.stanza_ref} in Context`
              : `წაიკითხე ეპიზოდის სტროფები (${step.stanzaStart}–${step.stanzaEnd})`
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

  const stepTitleKa = step.title_ka || step.title;
  const stepTitleEn = step.title_en || "";
  title.textContent = `${stepTitleKa} (სტროფები / Stanzas ${step.stanzaStart}–${step.stanzaEnd})`;
  subtitle.textContent = stepTitleEn;

  // Gather chapters covered by this step
  const coveredChapters = [];
  if (Array.isArray(step.poemChapters) && step.poemChapters.length) {
    step.poemChapters.forEach((chNum) => {
      if (chaptersByNumber[chNum]) coveredChapters.push(chaptersByNumber[chNum]);
    });
  }

  if (coveredChapters.length > 0) {
    metaBox.style.display = "block";
    metaBox.innerHTML = coveredChapters
      .map(
        (ch) => `
        <div style="margin-bottom:6px;">
          <strong style="color:var(--accent-gold);">თავი ${ch.chapter_number}: ${escapeHtml(ch.chapter_title_ka)} / ${escapeHtml(ch.chapter_title_en)} (St. ${ch.stanza_range})</strong>
          ${
            ch.chapter_source_url
              ? ` — <a class="source-chip" href="${escapeHtml(ch.chapter_source_url)}" target="_blank" rel="noopener noreferrer">წყარო / Source ↗</a>`
              : ""
          }
          <div style="font-size:0.78rem; color:#b8c0d4; margin-top:3px;">${escapeHtml(ch.chapter_expert_explanation_en || "")}</div>
        </div>`
      )
      .join("");
  } else {
    metaBox.style.display = "none";
  }

  body.innerHTML = "";
  const foundStanzas = [];
  for (let s = step.stanzaStart; s <= step.stanzaEnd; s++) {
    if (stanzasByNumber[String(s)]) {
      foundStanzas.push(stanzasByNumber[String(s)]);
    }
  }

  const isSingleCol = currentLang !== "bi";

  if (foundStanzas.length > 0) {
    foundStanzas.forEach((st) => {
      const div = document.createElement("div");
      const isHighlighted = Number(highlightStanzaNum) === Number(st.stanza_number);
      div.className = `stanza-item ${isHighlighted ? "highlighted-stanza" : ""}`;
      div.id = `modal-stanza-${st.stanza_number}`;

      const wardropBadge = st.wardrop_stanza_number
        ? `Wardrop EN #${st.wardrop_stanza_number}`
        : `1966 Critical Edition`;

      let linesHtml = "";
      if (currentLang === "bi") {
        linesHtml = `
          <div class="stanza-grid">
            <div class="stanza-lines-ka">${escapeHtml(st.georgian_raw_text)}</div>
            <div class="stanza-lines-en">${escapeHtml(st.english_translation || "")}</div>
          </div>
        `;
      } else if (currentLang === "ka") {
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
          let host = "Scholarly Source";
          try {
            host = new URL(url).hostname.replace("www.", "");
          } catch (e) {}
          return `<a class="source-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">📚 ${escapeHtml(host)} ↗</a>`;
        })
        .join("");

      div.innerHTML = `
        <div class="stanza-top-row">
          <span>სტროფი / Stanza #${st.stanza_number} ${st.chapter_number ? `• თავი / Ch. ${st.chapter_number}` : ""}</span>
          <span>${escapeHtml(wardropBadge)}</span>
        </div>
        ${linesHtml}
        ${
          st.expert_explanation_en && currentLang !== "ka"
            ? `<div class="stanza-commentary">
                 <strong>🎓 Expert Commentary:</strong> ${escapeHtml(st.expert_explanation_en)}
                 ${sourcesHtml ? `<div class="source-links-row">${sourcesHtml}</div>` : ""}
               </div>`
            : ""
        }
      `;
      body.appendChild(div);
    });
  } else {
    body.innerHTML = `
      <div class="stanza-item">
        <div class="stanza-top-row"><span>საკვანძო სტროფი (${step.stanzaStart}–${step.stanzaEnd})</span></div>
        <div class="stanza-lines-ka">${escapeHtml(step.verse_ka || step.verse)}</div>
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
    }, 60);
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
      <li style="margin-bottom:8px;">
        <a class="source-chip" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
          🔗 ${escapeHtml(s.title)} ↗
        </a>
      </li>`
    )
    .join("");

  const authoritiesHtml = (meta.scholarly_authorities_cited || [])
    .map((a) => `<li style="margin-bottom:5px; color:#d5d9e6;">${escapeHtml(a)}</li>`)
    .join("");

  const monoSectionsHtml = Object.entries(mono)
    .map(
      ([key, val]) => `
      <div class="stanza-item">
        <div class="stanza-top-row">
          <span>${escapeHtml(key.replace(/_/g, " ").toUpperCase())}</span>
        </div>
        <p style="font-size:0.86rem; line-height:1.62; color:#dce1f0;">${escapeHtml(val)}</p>
      </div>`
    )
    .join("");

  body.innerHTML = `
    <div class="stanza-item">
      <div class="stanza-top-row">
        <span>${escapeHtml(meta.title_ka || "ვეფხისტყაოსანი")} — ${escapeHtml(meta.title_en || "")}</span>
        <span>${escapeHtml(meta.composition_period || "")}</span>
      </div>
      <p style="font-size:0.85rem; line-height:1.6; color:#d5d9e6; margin-bottom:10px;">
        ${escapeHtml(meta.dataset_description || "")}
      </p>
      <div class="inspector-badge-row">
        <span class="inspector-pill">📚 65 თავი / Chapters</span>
        <span class="inspector-pill">🇬🇪 1,669 ქართული სტროფი (6,676 ტაეპი)</span>
        <span class="inspector-pill">🇬🇧 1,576 ინგლისური სტროფი (Wardrop 1912)</span>
      </div>
    </div>
    ${monoSectionsHtml}
    <div class="stanza-item">
      <div class="stanza-top-row"><span>სამეცნიერო ავტორიტეტები / Scholarly Authorities Cited</span></div>
      <ul style="padding-left:18px; font-size:0.83rem; line-height:1.55;">${authoritiesHtml}</ul>
    </div>
    <div class="stanza-item">
      <div class="stanza-top-row"><span>დადასტურებული აკადემიური წყაროები / Verified Academic Sources</span></div>
      <ul style="list-style:none;">${sourcesHtml}</ul>
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

  // Check if user typed a stanza number (e.g. "302" or "#302")
  const numMatch = q.match(/^#?(\d+)$/);
  if (numMatch) {
    const stNum = parseInt(numMatch[1], 10);
    if (stanzasByNumber[String(stNum)]) {
      const st = stanzasByNumber[String(stNum)];
      const matchingStepIdx = steps.findIndex(
        (s) => stNum >= s.stanzaStart && stNum <= s.stanzaEnd
      );
      results.push({
        type: "stanza",
        stanzaNum: stNum,
        stepIndex: matchingStepIdx >= 0 ? matchingStepIdx : 0,
        title: `სტროფი / Stanza #${stNum} (თავი ${st.chapter_number})`,
        sub: st.georgian_raw_text.replace(/\n/g, " / ")
      });
    }
  }

  // Search steps & stanzas by text
  const qLower = q.toLowerCase();
  steps.forEach((step, idx) => {
    const hay = `${step.title_ka || ""} ${step.title_en || ""} ${step.narrative_ka || ""} ${step.narrative_en || ""}`.toLowerCase();
    if (hay.includes(qLower) && results.length < 8) {
      results.push({
        type: "step",
        stepIndex: idx,
        title: `${step.chapterNumber}. ${step.title_ka || step.title} (St. ${step.stanzaStart}–${step.stanzaEnd})`,
        sub: step.title_en || step.narrative_ka
      });
    }
  });

  if (q.length >= 2 && results.length < 12) {
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
          title: `სტროფი / Stanza #${s} • თავი ${st.chapter_number}`,
          sub: `${st.georgian_raw_text.split("\n")[0]} — ${st.english_translation || ""}`
        });
        if (results.length >= 12) break;
      }
    }
  }

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="search-item"><div class="search-item-sub">არაფერი მოიძებნა / No matching stanza or chapter found</div></div>`;
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

function syncLangButtons() {
  document.querySelectorAll("#langToggle .seg-btn, #modalLangToggle .seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
  });
}

function setupControls() {
  // Interaction Type Filter Chips
  document.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      activeFilterType = e.currentTarget.dataset.type;
      updateGraph(currentStepIndex);
    });
  });

  // Granularity Toggle (26 Episodes vs 65 Chapters)
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

  // Language Toggle (KA+EN / KA / EN)
  document.querySelectorAll("#langToggle .seg-btn, #modalLangToggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentLang = e.currentTarget.getAttribute("data-lang");
      syncLangButtons();
      renderRealms();
      buildScrubber();
      buildScrollCards();
      updateGraph(currentStepIndex);
      setupScrollObserver();
      if (currentModalStep && !document.getElementById("stanzaModal").classList.contains("hidden")) {
        openStanzaModal(currentModalStep, currentModalHighlightStanza);
      }
    });
  });

  // Search Input
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

  // Close & Modal Buttons
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
    { threshold: 0.52 }
  );

  document.querySelectorAll(".step-card").forEach((card) => scrollObserver.observe(card));
}

window.addEventListener("resize", () => {
  updateDimensions();
  renderRealms();
  updateGraph(currentStepIndex);
});

initApp();
