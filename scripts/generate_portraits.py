#!/usr/bin/env python3
"""
Generates 21 richly detailed, shaded medieval Georgian illuminated manuscript
character portraits and converts them into high-resolution `.png` files in
`assets/characters/<id>.png` (plus a `slice_portrait_sheet.py` helper to slice
4x2 AI portrait grids directly into `assets/characters/<id>.png`).
"""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAR_DIR = ROOT / "assets" / "characters"
CHAR_DIR.mkdir(parents=True, exist_ok=True)

PORTRAIT_SPECS = {
    "rustaveli": {
        "bg1": "#2b2110", "bg2": "#0b0804", "ring": "#d4af37",
        "skin": "#e8c39e", "skin_shadow": "#b5835a", "hair": "#2a1b10", "beard": "short_dark",
        "headgear": "georgian_velvet_hat", "headgear_color": "#8b1e24",
        "garment": "#6b1d2f", "garment_trim": "#d4af37", "acc": "quill", "halo": True
    },
    "rostevan": {
        "bg1": "#2d1f14", "bg2": "#0e0906", "ring": "#d19a66",
        "skin": "#e5be98", "skin_shadow": "#b08259", "hair": "#e2e2e2", "beard": "long_white",
        "headgear": "crown_gold", "headgear_color": "#f4c430",
        "garment": "#8c2d19", "garment_trim": "#f4c430", "acc": "scepter", "halo": False
    },
    "tinatin": {
        "bg1": "#332814", "bg2": "#120d06", "ring": "#e5c07b",
        "skin": "#f5d6b8", "skin_shadow": "#c99b74", "hair": "#24160c", "beard": "none_female",
        "headgear": "queen_crown", "headgear_color": "#ffd700",
        "garment": "#1d4e89", "garment_trim": "#ffd700", "acc": "sun_halo", "halo": True
    },
    "avtandil": {
        "bg1": "#102238", "bg2": "#060d17", "ring": "#61afef",
        "skin": "#eac49e", "skin_shadow": "#b5855b", "hair": "#331d10", "beard": "trimmed_knight",
        "headgear": "spaspet_helm", "headgear_color": "#e0bd6b",
        "garment": "#b8860b", "garment_trim": "#fff3b0", "acc": "spear_shield", "halo": True
    },
    "shermadin": {
        "bg1": "#122634", "bg2": "#071017", "ring": "#7ec8e3",
        "skin": "#e2bc96", "skin_shadow": "#ad8057", "hair": "#26170d", "beard": "short_dark",
        "headgear": "spaspet_helm", "headgear_color": "#90b4ce",
        "garment": "#234e70", "garment_trim": "#7ec8e3", "acc": "shield", "halo": False
    },
    "sograt": {
        "bg1": "#1e261a", "bg2": "#0a0e08", "ring": "#a3b18a",
        "skin": "#dfc1a2", "skin_shadow": "#a88463", "hair": "#d0d0d0", "beard": "long_white",
        "headgear": "vizier_turban", "headgear_color": "#588157",
        "garment": "#344e41", "garment_trim": "#d4af37", "acc": "scroll", "halo": False
    },
    "tariel": {
        "bg1": "#38141a", "bg2": "#120507", "ring": "#e06c75",
        "skin": "#e6bf98", "skin_shadow": "#ad7d52", "hair": "#17100c", "beard": "trimmed_knight",
        "headgear": "panther_band", "headgear_color": "#d4af37",
        "garment": "panther_skin", "garment_trim": "#d4af37", "acc": "panther_collar", "halo": True
    },
    "asmat": {
        "bg1": "#182b18", "bg2": "#081008", "ring": "#98c379",
        "skin": "#f0ceb0", "skin_shadow": "#c29572", "hair": "#2b1a10", "beard": "none_female",
        "headgear": "maiden_veil", "headgear_color": "#709775",
        "garment": "#386641", "garment_trim": "#d4af37", "acc": "letter_scroll", "halo": False
    },
    "parsadan": {
        "bg1": "#361a12", "bg2": "#120805", "ring": "#e76f51",
        "skin": "#d9ae84", "skin_shadow": "#a37449", "hair": "#303030", "beard": "full_imperial",
        "headgear": "crown_gold", "headgear_color": "#f4a261",
        "garment": "#7c2d12", "garment_trim": "#f4c430", "acc": "scepter", "halo": False
    },
    "saridan": {
        "bg1": "#2a211f", "bg2": "#0e0a09", "ring": "#c9ada7",
        "skin": "#deb58d", "skin_shadow": "#a67951", "hair": "#3d2c1e", "beard": "trimmed_knight",
        "headgear": "crown_gold", "headgear_color": "#d4af37",
        "garment": "#5c3c36", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
    "nestan": {
        "bg1": "#2e1638", "bg2": "#0f0614", "ring": "#c678dd",
        "skin": "#f7dac0", "skin_shadow": "#c99c78", "hair": "#160d14", "beard": "none_female",
        "headgear": "princess_veil_crown", "headgear_color": "#ffd166",
        "garment": "#7209b7", "garment_trim": "#ffd166", "acc": "sun_halo", "halo": True
    },
    "davari": {
        "bg1": "#2e151d", "bg2": "#11070a", "ring": "#b56576",
        "skin": "#e5c1a8", "skin_shadow": "#b08468", "hair": "#24131b", "beard": "none_female",
        "headgear": "dark_veil", "headgear_color": "#6d2e46",
        "garment": "#4a192c", "garment_trim": "#b56576", "acc": "none", "halo": False
    },
    "khvarazmsha": {
        "bg1": "#221a29", "bg2": "#0b080f", "ring": "#6d597a",
        "skin": "#e0b890", "skin_shadow": "#a87c54", "hair": "#201510", "beard": "short_dark",
        "headgear": "prince_plume", "headgear_color": "#b5838d",
        "garment": "#4a3b5c", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
    "ramaz": {
        "bg1": "#331c1e", "bg2": "#130809", "ring": "#e5989b",
        "skin": "#e2ba91", "skin_shadow": "#ab7e54", "hair": "#241610", "beard": "full_imperial",
        "headgear": "khataeti_helm", "headgear_color": "#e5989b",
        "garment": "#802f37", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
    "pridon": {
        "bg1": "#112a30", "bg2": "#051013", "ring": "#56b6c2",
        "skin": "#e8c29b", "skin_shadow": "#b08459", "hair": "#1f130c", "beard": "trimmed_knight",
        "headgear": "spaspet_helm", "headgear_color": "#90e0ef",
        "garment": "#16697a", "garment_trim": "#d4af37", "acc": "spear_shield", "halo": True
    },
    "usen": {
        "bg1": "#142430", "bg2": "#060d12", "ring": "#457b9d",
        "skin": "#e0b994", "skin_shadow": "#a87e58", "hair": "#33251a", "beard": "full_imperial",
        "headgear": "vizier_turban", "headgear_color": "#457b9d",
        "garment": "#1d3557", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
    "fatman": {
        "bg1": "#332112", "bg2": "#120b05", "ring": "#f4a261",
        "skin": "#f3d1b0", "skin_shadow": "#c4966c", "hair": "#26150c", "beard": "none_female",
        "headgear": "queen_crown", "headgear_color": "#f4a261",
        "garment": "#b55d27", "garment_trim": "#ffd166", "acc": "pearls", "halo": False
    },
    "chashnagiri": {
        "bg1": "#1f2229", "bg2": "#0a0c0f", "ring": "#8d99ae",
        "skin": "#d9b38c", "skin_shadow": "#a37b52", "hair": "#1a1614", "beard": "short_dark",
        "headgear": "knight_circlet", "headgear_color": "#8d99ae",
        "garment": "#3d405b", "garment_trim": "#8d99ae", "acc": "none", "halo": False
    },
    "surkhavi": {
        "bg1": "#18222b", "bg2": "#080c10", "ring": "#577590",
        "skin": "#deb68f", "skin_shadow": "#a67b53", "hair": "#9e9e9e", "beard": "long_white",
        "headgear": "crown_gold", "headgear_color": "#90be6d",
        "garment": "#274c77", "garment_trim": "#d4af37", "acc": "scepter", "halo": False
    },
    "dulardukht": {
        "bg1": "#261438", "bg2": "#0d0614", "ring": "#9b5de5",
        "skin": "#ead0e8", "skin_shadow": "#b894b5", "hair": "#150a1e", "beard": "none_female",
        "headgear": "kajeti_crown", "headgear_color": "#f72585",
        "garment": "#560bad", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
    "rosan": {
        "bg1": "#200b33", "bg2": "#0a0312", "ring": "#7209b7",
        "skin": "#e2c2dc", "skin_shadow": "#ae88a7", "hair": "#1e0d29", "beard": "none",
        "headgear": "prince_plume", "headgear_color": "#9b5de5",
        "garment": "#3c096c", "garment_trim": "#d4af37", "acc": "none", "halo": False
    },
}

def render_illuminated_svg(char_id, spec):
    bg1 = spec["bg1"]
    bg2 = spec["bg2"]
    ring = spec["ring"]
    skin = spec["skin"]
    skin_sh = spec["skin_shadow"]
    hair = spec["hair"]
    garment = spec["garment"]
    trim = spec["garment_trim"]
    hg_col = spec["headgear_color"]
    is_female = spec["beard"] == "none_female"

    # Ornate gold-leaf ray halo
    halo_svg = ""
    if spec.get("halo"):
        rays = "".join(
            f'<line x1="120" y1="104" x2="{120 + 82 * __import__("math").cos(a * 0.2618):.1f}" y2="{104 + 82 * __import__("math").sin(a * 0.2618):.1f}" stroke="#ffd166" stroke-width="1.2" opacity="0.32"/>'
            for a in range(24)
        )
        halo_svg = f'''
        <circle cx="120" cy="104" r="78" fill="url(#halo-grad-{char_id})"/>
        {rays}
        <circle cx="120" cy="104" r="74" fill="none" stroke="#ffd166" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.75"/>
        '''

    # Detailed medieval garment / armor / panther skin
    if garment == "panther_skin":
        cloak_svg = f'''
        <path d="M36,232 C42,165 76,148 120,148 C164,148 198,165 204,232 Z" fill="url(#garment-{char_id})" stroke="#5c3811" stroke-width="2.5"/>
        <path d="M58,158 C78,185 95,205 120,232 C145,205 162,185 182,158" fill="#4a5568" stroke="#d4af37" stroke-width="2.5"/>
        <!-- Panther spots rosettes -->
        <g fill="#231206" opacity="0.88">
          <circle cx="64" cy="190" r="6"/><circle cx="72" cy="186" r="4"/><circle cx="82" cy="176" r="5.5"/>
          <circle cx="56" cy="212" r="6.5"/><circle cx="78" cy="208" r="5.5"/><circle cx="94" cy="218" r="5"/>
          <circle cx="158" cy="176" r="5.5"/><circle cx="174" cy="190" r="6"/><circle cx="164" cy="210" r="5.5"/>
          <circle cx="184" cy="214" r="6"/><circle cx="146" cy="218" r="5"/>
        </g>
        <!-- Embossed armor breastplate -->
        <path d="M88,154 L120,192 L152,154" fill="none" stroke="#d4af37" stroke-width="4"/>
        '''
    else:
        cloak_svg = f'''
        <path d="M36,232 C42,165 76,148 120,148 C164,148 198,165 204,232 Z" fill="url(#garment-{char_id})" stroke="{trim}" stroke-width="2.8"/>
        <path d="M62,158 C80,196 100,214 120,232 C140,214 160,196 178,158" fill="none" stroke="{trim}" stroke-width="2.2" stroke-dasharray="5 3" opacity="0.85"/>
        <path d="M86,152 L120,190 L154,152" fill="none" stroke="{trim}" stroke-width="4.5"/>
        <circle cx="120" cy="188" r="6" fill="#e63946" stroke="#ffd166" stroke-width="1.8"/>
        '''

    # Flowing hair & veil
    if is_female:
        hair_back = f'''
        <path d="M64,76 C46,120 48,184 62,224 L88,224 C82,176 82,130 84,96 Z" fill="#f4efe6" stroke="{trim}" stroke-width="1.8" opacity="0.92"/>
        <path d="M176,76 C194,120 192,184 178,224 L152,224 C158,176 158,130 156,96 Z" fill="#f4efe6" stroke="{trim}" stroke-width="1.8" opacity="0.92"/>
        <path d="M72,88 C64,132 66,184 78,216 C88,190 86,144 86,112 Z" fill="{hair}"/>
        <path d="M168,88 C176,132 174,184 162,216 C152,190 154,144 154,112 Z" fill="{hair}"/>
        '''
    else:
        hair_back = f'''
        <path d="M72,88 C62,120 64,152 76,164 C84,144 82,116 82,96 Z" fill="{hair}"/>
        <path d="M168,88 C178,120 176,152 164,164 C156,144 158,116 158,96 Z" fill="{hair}"/>
        '''

    # Shaded Neck & Sculpted Face
    head_svg = f'''
    <rect x="104" y="130" width="32" height="30" rx="10" fill="url(#skin-grad-{char_id})" stroke="#3a2312" stroke-width="1.2"/>
    <ellipse cx="120" cy="102" rx="35" ry="42" fill="url(#skin-grad-{char_id})" stroke="#2b180a" stroke-width="1.6"/>
    <!-- Cheek & temple chiaroscuro shading -->
    <path d="M88,96 C88,122 102,138 120,142 C106,134 96,116 96,94 Z" fill="{skin_sh}" opacity="0.45"/>
    <path d="M152,96 C152,122 138,138 120,142 C134,134 144,116 144,94 Z" fill="{skin_sh}" opacity="0.35"/>
    '''

    # Detailed Georgian miniature eyes, irises, nose bridge, and lips
    face_svg = f'''
    <!-- Arched Brows -->
    <path d="M94,89 Q105,82 115,89" fill="none" stroke="#1b0f07" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M125,89 Q135,82 146,89" fill="none" stroke="#1b0f07" stroke-width="3.2" stroke-linecap="round"/>
    <!-- Almond Eyes -->
    <path d="M96,97 Q105,91 114,97 Q105,102 96,97 Z" fill="#fdfaf6" stroke="#1b0f07" stroke-width="1.6"/>
    <path d="M126,97 Q135,91 144,97 Q135,102 126,97 Z" fill="#fdfaf6" stroke="#1b0f07" stroke-width="1.6"/>
    <circle cx="105" cy="96.5" r="3.8" fill="#2b190e"/>
    <circle cx="135" cy="96.5" r="3.8" fill="#2b190e"/>
    <circle cx="106.2" cy="95.3" r="1.2" fill="#ffffff"/>
    <circle cx="136.2" cy="95.3" r="1.2" fill="#ffffff"/>
    <!-- Sculpted Nose -->
    <path d="M120,90 L118,112 Q120,115 124,113" fill="none" stroke="#6e4223" stroke-width="2.2" stroke-linecap="round"/>
    <!-- Lips -->
    <path d="M109,124 Q120,121 131,124 Q120,130 109,124 Z" fill="#a8383b" stroke="#5e1b1d" stroke-width="1"/>
    '''

    # Beard rendering
    beard_type = spec["beard"]
    beard_svg = ""
    if beard_type == "long_white":
        beard_svg = f'''
        <path d="M86,110 C86,146 102,178 120,184 C138,178 154,146 154,110 C145,126 132,130 120,130 C108,130 95,126 86,110 Z" fill="url(#white-beard-{char_id})" stroke="#9e9e9e" stroke-width="1.4"/>
        <path d="M102,120 Q120,115 138,120" fill="none" stroke="#b8b8b8" stroke-width="3.8" stroke-linecap="round"/>
        '''
    elif beard_type == "full_imperial":
        beard_svg = f'''
        <path d="M86,108 C87,140 102,162 120,165 C138,162 153,140 154,108 C145,124 132,128 120,128 C108,128 95,124 86,108 Z" fill="{hair}" stroke="#120a06" stroke-width="1.2"/>
        <path d="M104,119 Q120,114 136,119" fill="none" stroke="{hair}" stroke-width="3.5" stroke-linecap="round"/>
        '''
    elif beard_type in ("trimmed_knight", "short_dark"):
        beard_svg = f'''
        <path d="M88,110 C90,134 104,147 120,149 C136,147 150,134 152,110 C143,124 132,128 120,128 C108,128 97,124 88,110 Z" fill="{hair}" opacity="0.94"/>
        <path d="M105,119 Q120,115 135,119" fill="none" stroke="{hair}" stroke-width="3.2" stroke-linecap="round"/>
        '''

    # Ornate Crowns, Helmets, Hats
    hg = spec["headgear"]
    if hg in ("crown_gold", "queen_crown", "princess_veil_crown", "kajeti_crown"):
        crown_svg = f'''
        <path d="M80,76 L86,42 L103,60 L120,34 L137,60 L154,42 L160,76 Z" fill="url(#gold-grad-{char_id})" stroke="#fff3b0" stroke-width="1.6"/>
        <rect x="80" y="70" width="80" height="10" rx="4" fill="url(#gold-grad-{char_id})" stroke="#7c5810" stroke-width="1.2"/>
        <circle cx="120" cy="48" r="4.5" fill="#e63946" stroke="#fff" stroke-width="1"/>
        <circle cx="98" cy="58" r="3.5" fill="#56b6c2" stroke="#fff" stroke-width="0.8"/>
        <circle cx="142" cy="58" r="3.5" fill="#56b6c2" stroke="#fff" stroke-width="0.8"/>
        <circle cx="120" cy="75" r="3" fill="#06d6a0"/>
        '''
    elif hg in ("spaspet_helm", "khataeti_helm"):
        crown_svg = f'''
        <path d="M82,80 C82,46 102,32 120,22 C138,32 158,46 158,80 Z" fill="url(#gold-grad-{char_id})" stroke="#fff3b0" stroke-width="1.8"/>
        <path d="M80,78 Q120,68 160,78" fill="none" stroke="#7c5810" stroke-width="3"/>
        <!-- Nasal guard -->
        <line x1="120" y1="22" x2="120" y2="92" stroke="#ffd166" stroke-width="3.6" stroke-linecap="round"/>
        <circle cx="104" cy="58" r="3" fill="#e63946"/>
        <circle cx="136" cy="58" r="3" fill="#e63946"/>
        '''
    elif hg == "panther_band":
        crown_svg = f'''
        <path d="M82,78 C84,54 100,44 120,44 C140,44 156,54 158,78 C144,68 96,68 82,78 Z" fill="{hair}"/>
        <path d="M82,74 Q120,60 158,74 L156,64 Q120,50 84,64 Z" fill="url(#gold-grad-{char_id})" stroke="#fff3b0" stroke-width="1.4"/>
        <circle cx="120" cy="62" r="4" fill="#e63946" stroke="#fff" stroke-width="1"/>
        '''
    elif hg == "georgian_velvet_hat":
        crown_svg = f'''
        <path d="M78,78 C78,46 98,38 120,38 C142,38 162,46 162,78 Z" fill="{hg_col}" stroke="#d4af37" stroke-width="1.8"/>
        <path d="M74,78 Q120,66 166,78 L162,86 Q120,76 78,86 Z" fill="#2a1b10" stroke="#d4af37" stroke-width="1.5"/>
        '''
    else:
        crown_svg = f'''
        <ellipse cx="120" cy="64" rx="42" ry="20" fill="{hg_col}" stroke="#d4af37" stroke-width="1.8"/>
        <path d="M84,64 Q120,44 156,64" fill="none" stroke="#d4af37" stroke-width="2"/>
        <circle cx="120" cy="58" r="4.5" fill="#ffd166" stroke="#e63946" stroke-width="1.2"/>
        '''

    acc_svg = ""
    if spec.get("acc") == "quill":
        acc_svg = '<path d="M150,210 L188,142 C178,142 164,156 154,180 Z" fill="#f8f9fa" stroke="#d4af37" stroke-width="1.8"/>'
    elif spec.get("acc") == "pearls":
        acc_svg = '<path d="M92,154 Q120,176 148,154" fill="none" stroke="#ffffff" stroke-width="5" stroke-dasharray="2 7" stroke-linecap="round"/>'

    # Outer illuminated manuscript medallion border with 16 gold-leaf studs
    studs = "".join(
        f'<circle cx="{120 + 111 * __import__("math").cos(a * 0.3927):.1f}" cy="{120 + 111 * __import__("math").sin(a * 0.3927):.1f}" r="2.6" fill="#ffd166"/>'
        for a in range(16)
    )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="512" height="512">
  <defs>
    <radialGradient id="bg-{char_id}" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="{bg1}"/>
      <stop offset="100%" stop-color="{bg2}"/>
    </radialGradient>
    <radialGradient id="halo-grad-{char_id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd166" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffd166" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold-grad-{char_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff3b0"/>
      <stop offset="50%" stop-color="#d4af37"/>
      <stop offset="100%" stop-color="#8a6508"/>
    </linearGradient>
    <linearGradient id="skin-grad-{char_id}" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="{skin}"/>
      <stop offset="100%" stop-color="{skin_sh}"/>
    </linearGradient>
    <linearGradient id="garment-{char_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{ '#e09f3e' if garment == 'panther_skin' else garment }"/>
      <stop offset="100%" stop-color="#140c08"/>
    </linearGradient>
    <linearGradient id="white-beard-{char_id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f5f5f5"/>
      <stop offset="100%" stop-color="#9e9e9e"/>
    </linearGradient>
    <clipPath id="clip-{char_id}">
      <circle cx="120" cy="120" r="105"/>
    </clipPath>
  </defs>
  <circle cx="120" cy="120" r="116" fill="url(#gold-grad-{char_id})" stroke="#3d2b05" stroke-width="2"/>
  <circle cx="120" cy="120" r="106" fill="url(#bg-{char_id})" stroke="{ring}" stroke-width="3"/>
  {studs}
  <g clip-path="url(#clip-{char_id})">
    {halo_svg}
    {hair_back}
    {cloak_svg}
    {head_svg}
    {face_svg}
    {beard_svg}
    {crown_svg}
    {acc_svg}
  </g>
  <circle cx="120" cy="120" r="105" fill="none" stroke="url(#gold-grad-{char_id})" stroke-width="3.5"/>
</svg>'''

def main():
    for cid, spec in PORTRAIT_SPECS.items():
        svg_file = CHAR_DIR / f"{cid}.svg"
        png_file = CHAR_DIR / f"{cid}.png"
        svg_text = render_illuminated_svg(cid, spec)
        svg_file.write_text(svg_text, encoding="utf-8")

    # Convert all 21 SVGs to 512x512 PNGs using macOS qlmanage
    with tempfile.TemporaryDirectory() as tmpdir:
        svg_paths = [str(CHAR_DIR / f"{cid}.svg") for cid in PORTRAIT_SPECS]
        subprocess.run(
            ["qlmanage", "-t", "-s", "512", "-o", tmpdir] + svg_paths,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        for cid in PORTRAIT_SPECS:
            generated_thumb = Path(tmpdir) / f"{cid}.svg.png"
            target_png = CHAR_DIR / f"{cid}.png"
            if generated_thumb.exists():
                target_png.write_bytes(generated_thumb.read_bytes())

    # Update story_graph.json and story-graph-bundle.js to point to .png portraits
    graph_path = ROOT / "data" / "story_graph.json"
    bundle_path = ROOT / "data" / "story-graph-bundle.js"
    with open(graph_path, "r", encoding="utf-8") as f:
        g = json.load(f)

    for cid, cobj in g.get("characters", {}).items():
        cobj["avatar"] = f"assets/characters/{cid}.png"

    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))

    with open(bundle_path, "w", encoding="utf-8") as f:
        f.write("window.STORY_GRAPH_BUNDLE = ")
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    png_count = len(list(CHAR_DIR.glob("*.png")))
    print(f"Rendered {png_count} high-res .png portraits in {CHAR_DIR} and updated story_graph.json.")

if __name__ == "__main__":
    main()
