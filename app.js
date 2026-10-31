let graphData = null;
let bundleData = window.VEPKHISTKAOSANI_BUNDLE || null;
let stanzaSteps = [];
let chapterSteps = [];

let currentStepIndex = 0;
let activeFilterType = "all";
let currentGranularity = "stanzas"; // "stanzas" (1669) | "chapters" (65)
let currentLang = "ka"; // "ka" | "en" | "bi"
let scrollObserver = null;

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

function getActiveSteps() {
  return currentGranularity === "chapters" ? chapterSteps : stanzaSteps;
}

async function initApp() {
  if (!bundleData && window.VEPKHISTKAOSANI_BUNDLE) {
    bundleData = window.VEPKHISTKAOSANI_BUNDLE;
  }

  if (window.STORY_GRAPH_BUNDLE) {
    graphData = window.STORY_GRAPH_BUNDLE;
  } else {
    const response = await fetch("data/story_graph.json");
    graphData = await response.json();
  }

  stanzaSteps = graphData.stanza_steps || graphData.steps || [];
  chapterSteps = graphData.chapter_steps || graphData.steps || [];

  setupArrowMarkers();
  populateChapterDropdown();
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

function populateChapterDropdown() {
  const select = document.getElementById("chapterSelect");
  if (!select) return;
  const isEn = currentLang === "en";

  select.innerHTML = chapterSteps
    .map((ch) => {
      const lbl = isEn
        ? `Ch. ${ch.chapterNumber}: ${ch.title_en.replace(/^Chapter \d+:\s*/, "")} (${ch.stanzaStart}–${ch.stanzaEnd})`
        : `თავი ${ch.chapterNumber}: ${ch.title} (${ch.stanzaStart}–${ch.stanzaEnd})`;
      return `<option value="${ch.chapterNumber}">${escapeHtml(lbl)}</option>`;
    })
    .join("");
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

function buildScrollCards() {
  const scroller = document.getElementById("scroller");
  const steps = getActiveSteps();
  const isEn = currentLang === "en";
  const isBi = currentLang === "bi";

  const slider = document.getElementById("stanzaSlider");
  if (slider) {
    slider.max = String(Math.max(0, steps.length - 1));
    slider.value = String(currentStepIndex);
  }

  const htmlChunks = [];
  let lastChapterNum = null;

  steps.forEach((step, idx) => {
    if (currentGranularity === "stanzas" && step.chapterNumber !== lastChapterNum) {
      lastChapterNum = step.chapterNumber;
      const chHeading = isEn
        ? `Chapter ${step.chapterNumber}: ${step.chapter_title_en || ""}`
        : `თავი ${step.chapterNumber}: ${step.chapter_title_ka || ""}`;
      htmlChunks.push(
        `<div class="chapter-divider" id="ch-div-${step.chapterNumber}">${escapeHtml(chHeading)}</div>`
      );
    }

    const primaryEdge = (step.interactions && step.interactions[0]) || null;
    const typeMeta = primaryEdge ? graphData.interaction_types[primaryEdge.type] : null;
    const srcChar = primaryEdge ? graphData.characters[primaryEdge.source] : null;
    const tgtChar = primaryEdge ? graphData.characters[primaryEdge.target] : null;

    const srcName = srcChar ? (isEn ? srcChar.name_en : srcChar.name_ka) : "";
    const tgtName = tgtChar ? (isEn ? tgtChar.name_en : tgtChar.name_ka) : "";
    const bondSummary =
      primaryEdge && typeMeta
        ? `${typeMeta.emoji} ${srcName} ➔ ${tgtName}`
        : "";

    const metaLeft =
      currentGranularity === "stanzas"
        ? isEn
          ? `Stanza #${step.stanzaNumber}`
          : `სტროფი #${step.stanzaNumber}`
        : isEn
          ? `Chapter ${step.chapterNumber} (St. ${step.stanzaStart}–${step.stanzaEnd})`
          : `თავი ${step.chapterNumber} (სტრ. ${step.stanzaStart}–${step.stanzaEnd})`;

    const verseKa = step.verse_ka || step.verse || "";
    const verseEn = step.verse_en || "";

    let verseBlock = "";
    if (isBi) {
      verseBlock = `
        <div class="step-verse-ka">${escapeHtml(verseKa)}</div>
        ${verseEn ? `<div class="step-verse-en">${escapeHtml(verseEn)}</div>` : ""}
      `;
    } else if (isEn) {
      verseBlock = `<div class="step-verse-ka">${escapeHtml(verseEn || verseKa)}</div>`;
    } else {
      verseBlock = `<div class="step-verse-ka">${escapeHtml(verseKa)}</div>`;
    }

    const commText = step.commentary_en || (currentGranularity === "chapters" ? step.narrative_en : "");
    const sourcesHtml = (step.sources || [])
      .map((s) => {
        const url = typeof s === "string" ? s : s.url;
        let host = "Source";
        try {
          host = new URL(url).hostname.replace("www.", "");
        } catch (e) {}
        return `<a class="source-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">📚 ${escapeHtml(host)} ↗</a>`;
      })
      .join("");

    const commentaryBlock = commText
      ? `<details class="stanza-commentary-details">
           <summary>🎓 ${isEn ? "Commentary" : "კომენტარი"}</summary>
           <div class="commentary-text">
             ${escapeHtml(commText)}
             ${sourcesHtml ? `<div class="source-links-row">${sourcesHtml}</div>` : ""}
           </div>
         </details>`
      : "";

    const chapterTitleBlock =
      currentGranularity === "chapters"
        ? `<h2 style="font-size:1rem; margin-bottom:8px; color:#fff;">${escapeHtml(
            isEn ? step.title_en : step.title_ka
          )}</h2>`
        : "";

    htmlChunks.push(`
      <article class="step-card ${step.mode === "flashback" ? "flashback-card" : ""} ${
      idx === currentStepIndex ? "active" : ""
    }" id="card-${idx}" data-idx="${idx}">
        <div class="step-meta">
          <span>${escapeHtml(metaLeft)}</span>
          ${bondSummary ? `<span class="step-bond-pill">${escapeHtml(bondSummary)}</span>` : ""}
        </div>
        ${chapterTitleBlock}
        ${verseBlock}
        ${commentaryBlock}
      </article>
    `);
  });

  scroller.innerHTML = htmlChunks.join("");

  scroller.querySelectorAll(".step-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("details") || e.target.closest("a")) return;
      const idx = parseInt(card.getAttribute("data-idx"), 10);
      if (!isNaN(idx)) {
        activateStep(idx, false);
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

function activateStep(stepIndex, scrollIntoView = true) {
  const steps = getActiveSteps();
  if (!steps.length) return;
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));

  const prevCard = document.getElementById(`card-${currentStepIndex}`);
  if (prevCard) prevCard.classList.remove("active");

  currentStepIndex = safeIndex;
  const nextCard = document.getElementById(`card-${safeIndex}`);
  if (nextCard) {
    nextCard.classList.add("active");
    if (scrollIntoView) {
      nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  updateGraph(safeIndex);
}

function updateGraph(stepIndex) {
  const steps = getActiveSteps();
  if (!steps.length) return;
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  currentStepIndex = safeIndex;
  const step = steps[safeIndex];
  const isEn = currentLang === "en";

  const badgeEl = document.getElementById("currentChapter");
  if (currentGranularity === "stanzas") {
    badgeEl.textContent = isEn
      ? `St. ${step.stanzaNumber} / ${steps.length}`
      : `სტრ. ${step.stanzaNumber} / ${steps.length}`;
  } else {
    badgeEl.textContent = isEn
      ? `Ch. ${step.chapterNumber} / ${steps.length}`
      : `თავი ${step.chapterNumber} / ${steps.length}`;
  }

  const slider = document.getElementById("stanzaSlider");
  if (slider && Number(slider.value) !== safeIndex) {
    slider.value = String(safeIndex);
  }

  const chSelect = document.getElementById("chapterSelect");
  if (chSelect && step.chapterNumber && String(chSelect.value) !== String(step.chapterNumber)) {
    chSelect.value = String(step.chapterNumber);
  }

  const modeBadge = document.getElementById("modeBadge");
  if (step.mode === "flashback") {
    modeBadge.textContent = isEn ? "📜 Flashback" : "📜 მოგონება";
    modeBadge.classList.remove("hidden");
  } else {
    modeBadge.classList.add("hidden");
  }

  document.getElementById("stageContainer").classList.toggle("flashback-stage", step.mode === "flashback");

  const positions = computePositions(step.nodeRealms);
  const focalSet = new Set(step.activeChars || []);

  const nodesArray = Object.keys(step.nodeRealms)
    .map((charId) => {
      const chObj = graphData.characters[charId];
      if (!chObj || !positions[charId]) return null;
      return {
        ...chObj,
        x: positions[charId].x,
        y: positions[charId].y,
        currentRealm: step.nodeRealms[charId],
        isFocal: focalSet.has(charId)
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

  const t = d3.transition().duration(380).ease(d3.easeCubicOut);

  // Edges
  const edges = gEdges.selectAll(".edge-group").data(edgesArray, (d) => d.id);
  const edgesEnter = edges
    .enter()
    .append("g")
    .attr("class", (d) => `edge-group ${d.primary ? "primary-edge" : ""}`)
    .on("click", (event, d) => openInspector("interaction", d, step));

  edgesEnter.append("path").attr("class", "edge-line").attr("stroke-width", 2.2);
  edgesEnter.append("circle").attr("class", "emoji-badge-bg").attr("r", 13);
  edgesEnter
    .append("text")
    .attr("class", "emoji-marker")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");

  const edgesMerged = edgesEnter.merge(edges);
  edgesMerged.attr("class", (d) => `edge-group ${d.primary ? "primary-edge" : ""}`);

  edgesMerged
    .select(".edge-line")
    .transition(t)
    .attr("stroke", (d) => (d.typeMeta ? d.typeMeta.color : "#d4af37"))
    .attr("stroke-dasharray", (d) => (d.primary === false ? "4 3" : null))
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
    .attr("class", (d) => `character-group ${d.isFocal ? "is-focal" : ""}`)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .on("click", (event, d) => openInspector("character", d, step));

  nodesEnter.append("circle").attr("class", "character-active-ring").attr("r", 23);

  nodesEnter
    .append("circle")
    .attr("class", "character-node")
    .attr("r", 17)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  nodesEnter.append("text").attr("class", "node-label").attr("dy", 31);

  const nodesMerged = nodesEnter.merge(nodes);
  nodesMerged.attr("class", (d) => `character-group ${d.isFocal ? "is-focal" : ""}`);
  nodesMerged.transition(t).attr("transform", (d) => `translate(${d.x},${d.y})`);
  nodesMerged.select(".character-node").attr("fill", (d) => d.color);
  nodesMerged
    .select(".node-label")
    .text((d) => (isEn ? d.name_en || d.name : d.name_ka || d.name));

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
    const quoteText = isEn ? data.quote_en || data.quote : data.quote_ka || data.quote;

    titleEl.textContent = `${emoji} ${bondTitle}`;
    bodyEl.innerHTML = `
      <div class="inspector-sub">
        ${escapeHtml(srcName)} ➔ ${escapeHtml(tgtName)}
        ${data.stanza_ref ? ` • ${isEn ? "Stanza" : "სტროფი"} #${data.stanza_ref}` : ""}
      </div>
      <p style="font-size:0.82rem; line-height:1.5; color:#dce1f0;">${escapeHtml(detailText)}</p>
      <div class="inspector-verse-box">${escapeHtml(quoteText)}</div>
    `;
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
        <span>${escapeHtml(meta.title_ka || "ვეფხისტყაოსანი")} — ${escapeHtml(
    meta.title_en || "The Knight in the Panther's Skin"
  )}</span>
        <span>${escapeHtml(meta.composition_period || "c. 1189–1207")}</span>
      </div>
      <p style="font-size:0.84rem; line-height:1.58; color:#cfd5e6;">
        ${escapeHtml(
          meta.dataset_description ||
            "Complete 65-chapter, 1,669-stanza critical edition paired with Marjory Scott Wardrop's English translation and academic commentary."
        )}
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
    const idx = steps.findIndex((s) =>
      currentGranularity === "stanzas"
        ? s.stanzaNumber === stNum
        : stNum >= s.stanzaStart && stNum <= s.stanzaEnd
    );
    if (idx >= 0) {
      const s = steps[idx];
      results.push({
        stepIndex: idx,
        title: `${isEn ? "Stanza" : "სტროფი"} #${stNum} (${isEn ? "Ch." : "თავი"} ${s.chapterNumber})`,
        sub: isEn ? s.verse_en || s.verse_ka : (s.verse_ka || "").replace(/\n/g, " / ")
      });
    }
  }

  const qLower = q.toLowerCase();
  if (q.length >= 2) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const hay = `${s.verse_ka || ""} ${s.verse_en || ""} ${s.chapter_title_ka || ""} ${
        s.chapter_title_en || ""
      }`.toLowerCase();
      if (hay.includes(qLower)) {
        results.push({
          stepIndex: i,
          title:
            currentGranularity === "stanzas"
              ? `${isEn ? "Stanza" : "სტროფი"} #${s.stanzaNumber} • ${isEn ? "Ch." : "თავი"} ${s.chapterNumber}`
              : `${isEn ? "Ch." : "თავი"} ${s.chapterNumber}: ${isEn ? s.title_en : s.title_ka}`,
          sub: isEn ? s.verse_en || s.verse_ka : (s.verse_ka || "").split("\n")[0]
        });
        if (results.length >= 10) break;
      }
    }
  }

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="search-item"><div class="search-item-sub">${
      isEn ? "No matches found" : "არაფერი მოიძებნა"
    }</div></div>`;
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
      activateStep(r.stepIndex, true);
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

  const stBtn = document.querySelector("#granularityToggle [data-granularity='stanzas']");
  const chBtn = document.querySelector("#granularityToggle [data-granularity='chapters']");
  if (stBtn) stBtn.textContent = isEn ? "1669 Stanzas" : "1669 სტროფი";
  if (chBtn) chBtn.textContent = isEn ? "65 Chapters" : "65 თავი";

  const searchInput = document.getElementById("globalSearchInput");
  if (searchInput) {
    searchInput.placeholder = isEn ? "🔍 Stanza # or word..." : "🔍 სტროფი # ან სიტყვა...";
  }
  populateChapterDropdown();
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
      updateUITextByLang();
      renderRealms();
      buildScrollCards();
      updateGraph(currentStepIndex);
      setupScrollObserver();
      document.getElementById("inspector").classList.remove("open");
    });
  });

  // Chapter Dropdown Jump
  const chSelect = document.getElementById("chapterSelect");
  if (chSelect) {
    chSelect.addEventListener("change", (e) => {
      const chNum = parseInt(e.target.value, 10);
      const steps = getActiveSteps();
      const targetIdx = steps.findIndex((s) => s.chapterNumber === chNum);
      if (targetIdx >= 0) {
        activateStep(targetIdx, true);
      }
    });
  }

  // Stanza Range Slider & Step Buttons
  const slider = document.getElementById("stanzaSlider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      const idx = parseInt(e.target.value, 10);
      if (!isNaN(idx)) {
        activateStep(idx, true);
      }
    });
  }

  document.getElementById("prevStepBtn").addEventListener("click", () => {
    if (currentStepIndex > 0) {
      activateStep(currentStepIndex - 1, true);
    }
  });

  document.getElementById("nextStepBtn").addEventListener("click", () => {
    const steps = getActiveSteps();
    if (currentStepIndex < steps.length - 1) {
      activateStep(currentStepIndex + 1, true);
    }
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

  document.getElementById("closeInspectorBtn").addEventListener("click", () => {
    document.getElementById("inspector").classList.remove("open");
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
          const idx = parseInt(entry.target.getAttribute("data-idx"), 10);
          if (!isNaN(idx) && idx !== currentStepIndex) {
            const prevCard = document.getElementById(`card-${currentStepIndex}`);
            if (prevCard) prevCard.classList.remove("active");
            currentStepIndex = idx;
            entry.target.classList.add("active");
            updateGraph(idx);
          }
        }
      });
    },
    { rootMargin: "-35% 0px -45% 0px", threshold: 0.1 }
  );

  document.querySelectorAll(".step-card").forEach((card) => scrollObserver.observe(card));
}

window.addEventListener("resize", () => {
  updateDimensions();
  renderRealms();
  updateGraph(currentStepIndex);
});

initApp();
