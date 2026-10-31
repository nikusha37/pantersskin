#!/usr/bin/env python3
"""
Builds a complete Stanza-Level (1–1,669) Dynamic Network Graph dataset
(`data/story_graph.json` and `data/story-graph-bundle.js`) from the 65 local
bilingual chapter files (`data/chapters/chapter-01.json` .. `chapter-65.json`).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_DIR = ROOT / "data" / "chapters"
STORY_GRAPH_JSON = ROOT / "data" / "story_graph.json"
STORY_GRAPH_BUNDLE = ROOT / "data" / "story-graph-bundle.js"

REALMS = [
    {"id": "arabia", "name_ka": "არაბეთი", "name_en": "Arabia", "color": "#e07a5f"},
    {"id": "wilderness", "name_ka": "უდაბნო / ქვაბი", "name_en": "Wilderness & Cave", "color": "#81b29a"},
    {"id": "india", "name_ka": "ინდოეთი", "name_en": "India", "color": "#f2cc8f"},
    {"id": "khataveti", "name_ka": "ხატაეთი", "name_en": "Khataeti", "color": "#e5989b"},
    {"id": "mulgazanzar", "name_ka": "მულღაზანზარი", "name_en": "Mulghazanzar", "color": "#56b6c2"},
    {"id": "gulansharo", "name_ka": "გულანშარო", "name_en": "Gulansharo", "color": "#3d5a80"},
    {"id": "kajeti", "name_ka": "ქაჯეთი", "name_en": "Kadjeti", "color": "#9b5de5"},
]

INTERACTION_TYPES = {
    "love": {"emoji": "💍", "label_ka": "მიჯნურობა", "label_en": "Courtly Love", "color": "#ff6b8b"},
    "brotherhood": {"emoji": "🤝", "label_ka": "დაძმობილება", "label_en": "Sworn Brotherhood", "color": "#ffd166"},
    "feudal": {"emoji": "👑", "label_ka": "მეფობა / ყმობა", "label_en": "Fealty & Kingship", "color": "#f4a261"},
    "service": {"emoji": "🛡️", "label_ka": "ერთგულება / მსახურება", "label_en": "Loyal Service", "color": "#81b29a"},
    "letter": {"emoji": "💌", "label_ka": "ეპისტოლე / წერილი", "label_en": "Epistle / Letter", "color": "#a8dadc"},
    "conflict": {"emoji": "⚔️", "label_ka": "ბრძოლა / რისხვა", "label_en": "Combat & Conflict", "color": "#e63946"},
    "rescue": {"emoji": "🔓", "label_ka": "დახსნა / შეფარება", "label_en": "Alliance & Rescue", "color": "#06d6a0"},
    "grief_support": {"emoji": "💧", "label_ka": "თანაგრძნობა / გლოვა", "label_en": "Shared Mourning", "color": "#64dfdf"},
}

CHARACTERS = {
    "rustaveli": {"id": "rustaveli", "name": "შოთა რუსთაველი", "name_ka": "შოთა რუსთაველი", "name_en": "Shota Rustaveli", "title": "პოეტი / მთხრობელი", "title_ka": "პოეტი, თამარ მეფის მეხოტბე", "title_en": "Court Poet & Narrator", "base_realm": "arabia", "color": "#d4af37"},
    "rostevan": {"id": "rostevan", "name": "როსტევანი", "name_ka": "როსტევანი", "name_en": "King Rostevan", "title": "არაბეთის მეფე", "title_ka": "არაბეთის მეფე", "title_en": "King of the Arabians", "base_realm": "arabia", "color": "#d19a66"},
    "tinatin": {"id": "tinatin", "name": "თინათინი", "name_ka": "თინათინი", "name_en": "Queen Tinatin", "title": "არაბეთის ხელმწიფე", "title_ka": "არაბეთის გვირგვინოსანი ხელმწიფე", "title_en": "Crowned Sovereign of Arabia", "base_realm": "arabia", "color": "#e5c07b"},
    "avtandil": {"id": "avtandil", "name": "ავთანდილი", "name_ka": "ავთანდილი", "name_en": "Avtandil", "title": "არაბეთის სპასპეტი", "title_ka": "არაბეთის სპასპეტი", "title_en": "Commander-in-Chief of Arabia", "base_realm": "arabia", "color": "#61afef"},
    "shermadin": {"id": "shermadin", "name": "შერმადინი", "name_ka": "შერმადინი", "name_en": "Shermadin", "title": "ავთანდილის ერთგული ყმა", "title_ka": "ავთანდილის ერთგული მოურავი", "title_en": "Avtandil's Loyal Retainer", "base_realm": "arabia", "color": "#7ec8e3"},
    "sograt": {"id": "sograt", "name": "სოგრატი", "name_ka": "სოგრატი", "name_en": "Vizier Sograt", "title": "არაბეთის ვეზირი", "title_ka": "არაბეთის უხუცესი ვეზირი", "title_en": "Chief Vizier of Arabia", "base_realm": "arabia", "color": "#a3b18a"},
    "tariel": {"id": "tariel", "name": "ტარიელი", "name_ka": "ტარიელი", "name_en": "Tariel", "title": "ინდოეთის ამირბარი", "title_ka": "ინდოეთის ამირბარი", "title_en": "Amirbar of India", "base_realm": "india", "color": "#e06c75"},
    "asmat": {"id": "asmat", "name": "ასმათი", "name_ka": "ასმათი", "name_en": "Asmat", "title": "ნესტანისა და ტარიელის მესაიდუმლე", "title_ka": "ნესტანისა და ტარიელის მესაიდუმლე", "title_en": "Confidante of Nestan & Tariel", "base_realm": "wilderness", "color": "#98c379"},
    "parsadan": {"id": "parsadan", "name": "ფარსადანი", "name_ka": "ფარსადანი", "name_en": "King Parsadan", "title": "ინდოეთის მეფე", "title_ka": "ინდოეთის შვიდი სამეფოს მეფე", "title_en": "High King of India", "base_realm": "india", "color": "#e76f51"},
    "saridan": {"id": "saridan", "name": "სარიდანი", "name_ka": "სარიდანი", "name_en": "King Saridan", "title": "ტარიელის მამა", "title_ka": "ტარიელის მამა, მეშვიდე სამეფოს მეფე", "title_en": "Father of Tariel", "base_realm": "india", "color": "#c9ada7"},
    "nestan": {"id": "nestan", "name": "ნესტან-დარეჯანი", "name_ka": "ნესტან-დარეჯანი", "name_en": "Nestan-Darejan", "title": "ინდოეთის მეფის ასული", "title_ka": "ინდოეთის ტახტის მემკვიდრე", "title_en": "Princess of India", "base_realm": "india", "color": "#c678dd"},
    "davari": {"id": "davari", "name": "დავარი", "name_ka": "დავარი", "name_en": "Princess Davar", "title": "ფარსადანის და", "title_ka": "მეფე ფარსადანის და, ნესტანის აღმზრდელი", "title_en": "Sister of Parsadan, Tutor of Nestan", "base_realm": "india", "color": "#b56576"},
    "khvarazmsha": {"id": "khvarazmsha", "name": "ხვარაზმშას ძე", "name_ka": "ხვარაზმშას ძე", "name_en": "Prince of Khwarazm", "title": "ნესტანის საქმრო", "title_ka": "მოწვეული სასიძო", "title_en": "Foreign Suitor", "base_realm": "india", "color": "#6d597a"},
    "ramaz": {"id": "ramaz", "name": "რამაზ მეფე", "name_ka": "რამაზ მეფე", "name_en": "King Ramaz", "title": "ხატაეთის მეფე", "title_ka": "ხატაეთის მბრძანებელი", "title_en": "King of Khataeti", "base_realm": "khataveti", "color": "#e5989b"},
    "pridon": {"id": "pridon", "name": "ნურადინ-ფრიდონი", "name_ka": "ნურადინ-ფრიდონი", "name_en": "Nuradin Pridon", "title": "მულღაზანზარის მეფე", "title_ka": "მულღაზანზარის მეფე", "title_en": "King of Mulghazanzar", "base_realm": "mulgazanzar", "color": "#56b6c2"},
    "usen": {"id": "usen", "name": "უსენი", "name_ka": "უსენი", "name_en": "Usen", "title": "ვაჭართუხუცესი", "title_ka": "გულანშაროს ვაჭართუხუცესი", "title_en": "Chief of Merchants in Gulansharo", "base_realm": "gulansharo", "color": "#457b9d"},
    "fatman": {"id": "fatman", "name": "ფატმან ხათუნი", "name_ka": "ფატმან ხათუნი", "name_en": "Patman Khatun", "title": "ნესტანის შემფარებელი", "title_ka": "უსენის მეუღლე, ნესტანის მხსნელი", "title_en": "Lady of Gulansharo, Protector of Nestan", "base_realm": "gulansharo", "color": "#f4a261"},
    "chashnagiri": {"id": "chashnagiri", "name": "ჭაშნაგირი", "name_ka": "ჭაშნაგირი", "name_en": "The Chashnagir", "title": "კარისკაცი", "title_ka": "მელიქ-სურხავის კარისკაცი", "title_en": "Royal Chamberlain in Gulansharo", "base_realm": "gulansharo", "color": "#8d99ae"},
    "surkhavi": {"id": "surkhavi", "name": "მელიქ-სურხავი", "name_ka": "მელიქ-სურხავი", "name_en": "King Melik-Surkhav", "title": "ზღვათა სამეფოს მეფე", "title_ka": "ზღვათა სამეფოს ხელმწიფე", "title_en": "King of the Realm of the Seas", "base_realm": "gulansharo", "color": "#577590"},
    "dulardukht": {"id": "dulardukht", "name": "დულარდუხტი", "name_ka": "დულარდუხტი", "name_en": "Queen Dulardukht", "title": "ქაჯეთის მბრძანებელი", "title_ka": "ქაჯეთის ციხის მბრძანებელი", "title_en": "Ruler of Kadjeti", "base_realm": "kajeti", "color": "#9b5de5"},
    "rosan": {"id": "rosan", "name": "როსანი", "name_ka": "როსანი", "name_en": "Prince Rosan", "title": "დულარდუხტის ძმისწული", "title_ka": "ქაჯეთის უფლისწული", "title_en": "Nephew of Dulardukht", "base_realm": "kajeti", "color": "#7209b7"},
}

CHAR_PATTERNS = {
    "rustaveli": re.compile(r"რუსთველ|მელექსე|შაირ|თამარ|Rust’haveli|Rustaveli|T’hamara|minstrel|poet", re.I),
    "rostevan": re.compile(r"როსტევან|როსტან|არაბთა მეფ|Rostevan|Rostan", re.I),
    "tinatin": re.compile(r"თინათინ|T’hinat’hin|Tinatin", re.I),
    "avtandil": re.compile(r"ავთანდილ|სპასპეტ|Avt’handil|Avtandil", re.I),
    "shermadin": re.compile(r"შერმადინ|Shermadin", re.I),
    "sograt": re.compile(r"სოგრატ|ვეზირ|Sograt|vizier", re.I),
    "tariel": re.compile(r"ტარიელ|ამირბარ|უცხო მოყმ|ვეფხისტყაოს|ვეფხის|T’hariel|Tariel|Amirbar|stranger knight", re.I),
    "asmat": re.compile(r"ასმათ|Asmat", re.I),
    "parsadan": re.compile(r"ფარსადან|ინდოთ მეფ|P’harsadan|Parsadan", re.I),
    "saridan": re.compile(r"სარიდან|Saridan", re.I),
    "nestan": re.compile(r"ნესტან|დარეჯან|Nestan|Darejan", re.I),
    "davari": re.compile(r"დავარ|Davar", re.I),
    "khvarazmsha": re.compile(r"ხვარაზმშა|სასიძო|Khwarazm", re.I),
    "ramaz": re.compile(r"რამაზ|ხატაელ|ხატაეთ|Ramaz|Khatav", re.I),
    "pridon": re.compile(r"ფრიდონ|ნურადინ|მულღაზანზარ|P’hridon|Pridon|Nuradin", re.I),
    "usen": re.compile(r"უსენ|Usen", re.I),
    "fatman": re.compile(r"ფატმან|ხათუნ|P’hatman|Patman", re.I),
    "chashnagiri": re.compile(r"ჭაშნაგირ|Chashnagir", re.I),
    "surkhavi": re.compile(r"სურხავ|მელიქ|Surkhav|Melik", re.I),
    "dulardukht": re.compile(r"დულარდუხტ|ქაჯეთ|ქაჯნ|Dulardukht|Kadjeti|Kadj", re.I),
    "rosan": re.compile(r"როსან|Rosan", re.I),
}

TYPE_PATTERNS = [
    ("letter", re.compile(r"წიგნ|უსტარ|ანდერძ|მონაწერ|დაწერ|კალამ|მელან|letter|epistle|testament|wrote|written", re.I)),
    ("conflict", re.compile(r"ომ|ბრძოლ|ხმალ|ლახვარ|ისარ|შუბ|დახოც|მოკლ|სისხლ|შეებნ|რისხვ|მეკობრ|დალეწ|შემუსრ|battle|sword|slew|slain|struck|smote|war|fight|wrath|pirate|kill", re.I)),
    ("rescue", re.compile(r"დახსნ|გამოხსნ|იხსნ|შეიფარ|გააპარ|გათავისუფლ|save|rescue|deliver|free|shelter|escape", re.I)),
    ("brotherhood", re.compile(r"ძმობ|ძმად|შეჰფიც|ძმან|მოყვარ|მოყვრის|თანადგომ|sworn brother|brotherhood|comrade|friend", re.I)),
    ("grief_support", re.compile(r"ცრემლ|ტირ|მტირალ|გლოვ|ვაჰ|სულთქმ|ჭმუნვ|ნუგეშ|შეებრალ|დაბნდ|tear|weep|weeping|mourn|alas|grief|sorrow|pity|soothe|faint", re.I)),
    ("love", re.compile(r"მიჯნურ|ტრფობ|საყვარელ|აკოც|ვარდ|მზე|გულ|შეყრ|ქორწილ|სძალ|სიძე|რიდე|love|beloved|kiss|rose|heart|wed|bride|veil", re.I)),
    ("feudal", re.compile(r"მეფ|ხელმწიფ|ტახტ|გვირგვინ|სკიპტრ|სამეფო|ამირბარ|თაყვან|ბრძან|საჭურჭლ|king|queen|throne|crown|monarch|sovereign|homage", re.I)),
    ("service", re.compile(r"მსახურ|ყმა|ერთგულ|მონა|მოურავ|მესაიდუმლ|serve|service|vassal|retainer|faithful|obey", re.I)),
]

TYPE_ACTION_LABELS = {
    "love": ("მიჯნურობა და ტრფობა", "Courtly Love & Devotion"),
    "brotherhood": ("ძმადნაფიცობა და თანადგომა", "Sworn Brotherhood & Solidarity"),
    "feudal": ("მეფური ბრძანება და ყმობა", "Royal Authority & Fealty"),
    "service": ("ერთგული სამსახური", "Loyal Service & Counsel"),
    "letter": ("ეპისტოლე / წერილი", "Epistle & Message"),
    "conflict": ("დაპირისპირება და ბრძოლა", "Combat & Confrontation"),
    "rescue": ("დახსნა და მფარველობა", "Rescue & Protection"),
    "grief_support": ("თანაგრძნობა და გლოვა", "Shared Grief & Consolation"),
}

def get_chapter_context(ch_num, st_num):
    """Returns (mode, nodeRealms, focal_pair, secondary_edges) for a given chapter and stanza."""
    mode = "flashback" if (10 <= ch_num <= 28 or ch_num == 47) else "present"

    if ch_num == 1:
        return mode, {"rustaveli": "arabia", "tinatin": "arabia", "avtandil": "arabia", "tariel": "wilderness", "nestan": "india"}, ("rustaveli", "tariel", "grief_support"), [("avtandil", "tinatin", "love"), ("tariel", "nestan", "love")]
    if ch_num == 2:
        return mode, {"rostevan": "arabia", "tinatin": "arabia", "avtandil": "arabia", "sograt": "arabia"}, ("rostevan", "tinatin", "feudal"), [("sograt", "rostevan", "service"), ("avtandil", "tinatin", "love")]
    if ch_num == 3:
        return mode, {"rostevan": "arabia", "avtandil": "arabia", "shermadin": "arabia"}, ("rostevan", "avtandil", "feudal"), [("shermadin", "avtandil", "service")]
    if ch_num == 4:
        t_realm = "wilderness" if st_num >= 102 else "arabia"
        return mode, {"rostevan": "arabia", "avtandil": "arabia", "tariel": t_realm, "tinatin": "arabia"}, ("rostevan", "tariel", "conflict") if st_num < 105 else ("tinatin", "rostevan", "grief_support"), [("avtandil", "rostevan", "service")]
    if ch_num == 5:
        if st_num >= 149:
            return mode, {"tinatin": "arabia", "avtandil": "arabia", "shermadin": "arabia"}, ("avtandil", "shermadin", "service"), [("tinatin", "avtandil", "love")]
        return mode, {"tinatin": "arabia", "avtandil": "arabia", "rostevan": "arabia"}, ("tinatin", "avtandil", "love"), [("avtandil", "tinatin", "service")]
    if ch_num == 6:
        return mode, {"avtandil": "arabia", "shermadin": "arabia", "tinatin": "arabia"}, ("avtandil", "shermadin", "letter"), [("avtandil", "tinatin", "love")]
    if ch_num == 7:
        av_realm = "wilderness" if st_num >= 180 else "arabia"
        return mode, {"avtandil": av_realm, "tinatin": "arabia", "tariel": "wilderness", "asmat": "wilderness"}, ("avtandil", "tinatin", "love") if st_num < 195 else ("avtandil", "tariel", "brotherhood"), [("asmat", "tariel", "service")]
    if ch_num == 8:
        return mode, {"avtandil": "wilderness", "asmat": "wilderness", "tariel": "wilderness", "tinatin": "arabia"}, ("avtandil", "asmat", "service"), [("asmat", "tariel", "service")]
    if ch_num == 9:
        return mode, {"avtandil": "wilderness", "tariel": "wilderness", "asmat": "wilderness"}, ("avtandil", "tariel", "brotherhood"), [("asmat", "tariel", "grief_support")]
    if ch_num == 10:
        return mode, {"parsadan": "india", "saridan": "india", "tariel": "india", "nestan": "india", "davari": "india"}, ("parsadan", "tariel", "feudal"), [("saridan", "parsadan", "feudal"), ("davari", "nestan", "service")]
    if ch_num == 11:
        return mode, {"tariel": "india", "nestan": "india", "asmat": "india", "parsadan": "india"}, ("tariel", "nestan", "love"), [("asmat", "tariel", "grief_support")]
    if ch_num in (12, 13):
        return mode, {"nestan": "india", "tariel": "india", "asmat": "india"}, ("nestan", "tariel", "letter") if ch_num == 12 else ("tariel", "nestan", "letter"), [("asmat", "nestan", "service")]
    if ch_num in (14, 15):
        return mode, {"tariel": "india", "nestan": "india", "asmat": "india", "parsadan": "india", "ramaz": "khataveti"}, ("tariel", "ramaz", "conflict") if ch_num == 14 else ("nestan", "tariel", "love"), [("asmat", "tariel", "service")]
    if ch_num in (16, 17, 18, 19):
        return mode, {"tariel": "khataveti", "ramaz": "khataveti", "nestan": "india", "parsadan": "india"}, ("tariel", "ramaz", "conflict"), [("nestan", "tariel", "love")]
    if ch_num in (20, 21):
        return mode, {"tariel": "india", "nestan": "india", "parsadan": "india", "ramaz": "india", "asmat": "india"}, ("nestan", "tariel", "letter") if ch_num == 21 else ("parsadan", "tariel", "feudal"), [("tariel", "nestan", "love")]
    if ch_num == 22:
        return mode, {"parsadan": "india", "nestan": "india", "tariel": "india", "khvarazmsha": "india"}, ("parsadan", "nestan", "feudal"), [("tariel", "nestan", "love")]
    if ch_num == 23:
        return mode, {"nestan": "india", "tariel": "india", "asmat": "india", "parsadan": "india"}, ("nestan", "tariel", "love"), [("asmat", "nestan", "service")]
    if ch_num == 24:
        return mode, {"tariel": "india", "khvarazmsha": "india", "parsadan": "india", "nestan": "india"}, ("tariel", "khvarazmsha", "conflict"), [("tariel", "parsadan", "conflict")]
    if ch_num == 25:
        n_realm = "gulansharo" if st_num >= 595 else "india"
        return mode, {"davari": "india", "nestan": n_realm, "asmat": "india", "tariel": "india", "parsadan": "india"}, ("davari", "nestan", "conflict") if st_num < 598 else ("asmat", "tariel", "grief_support"), [("tariel", "nestan", "love")]
    if ch_num in (26, 27):
        return mode, {"tariel": "mulgazanzar", "pridon": "mulgazanzar", "asmat": "mulgazanzar", "nestan": "gulansharo"}, ("tariel", "pridon", "brotherhood"), [("asmat", "tariel", "service")]
    if ch_num == 28:
        return mode, {"tariel": "wilderness", "asmat": "wilderness", "avtandil": "wilderness"}, ("avtandil", "tariel", "brotherhood"), [("asmat", "tariel", "service")]
    if ch_num in (29, 30):
        return mode, {"avtandil": "arabia", "tinatin": "arabia", "rostevan": "arabia", "shermadin": "arabia", "tariel": "wilderness"}, ("avtandil", "tinatin", "love"), [("avtandil", "rostevan", "feudal"), ("shermadin", "avtandil", "service")]
    if ch_num == 31:
        return mode, {"avtandil": "arabia", "sograt": "arabia", "rostevan": "arabia"}, ("sograt", "rostevan", "feudal"), [("avtandil", "sograt", "service")]
    if ch_num in (32, 33, 34):
        return mode, {"avtandil": "arabia", "shermadin": "arabia", "rostevan": "arabia", "tinatin": "arabia"}, ("avtandil", "rostevan", "letter") if ch_num == 32 else ("avtandil", "shermadin", "service"), [("avtandil", "tinatin", "love")]
    if ch_num == 35:
        return mode, {"rostevan": "arabia", "shermadin": "arabia", "tinatin": "arabia", "avtandil": "wilderness"}, ("rostevan", "avtandil", "grief_support"), [("shermadin", "rostevan", "service")]
    if ch_num in (36, 37, 38):
        return mode, {"avtandil": "wilderness", "tariel": "wilderness", "asmat": "wilderness"}, ("avtandil", "tariel", "brotherhood"), [("avtandil", "asmat", "grief_support")]
    if ch_num in (39, 40, 41):
        return mode, {"avtandil": "mulgazanzar", "pridon": "mulgazanzar", "tariel": "wilderness"}, ("avtandil", "pridon", "brotherhood"), [("avtandil", "tariel", "brotherhood")]
    if ch_num in (42, 43):
        return mode, {"avtandil": "gulansharo", "fatman": "gulansharo", "usen": "gulansharo"}, ("fatman", "avtandil", "service"), [("usen", "fatman", "feudal")]
    if ch_num in (44, 45, 46):
        return mode, {"avtandil": "gulansharo", "fatman": "gulansharo", "chashnagiri": "gulansharo"}, ("avtandil", "chashnagiri", "conflict") if ch_num == 45 else ("fatman", "avtandil", "letter" if ch_num == 44 else "rescue"), []
    if ch_num == 47:
        n_realm = "kajeti" if st_num >= 1215 else "gulansharo"
        if st_num < 1190:
            return mode, {"fatman": "gulansharo", "nestan": n_realm, "usen": "gulansharo", "surkhavi": "gulansharo"}, ("fatman", "nestan", "rescue"), [("usen", "surkhavi", "feudal")]
        return mode, {"fatman": "gulansharo", "nestan": "kajeti", "dulardukht": "kajeti", "rosan": "kajeti"}, ("dulardukht", "nestan", "conflict"), [("fatman", "nestan", "rescue")]
    if ch_num in (48, 49, 50, 51):
        return mode, {"avtandil": "gulansharo", "fatman": "gulansharo", "nestan": "kajeti", "tariel": "wilderness"}, ("nestan", "tariel", "letter") if ch_num == 50 else ("nestan", "fatman", "letter"), [("avtandil", "fatman", "rescue")]
    if ch_num == 52:
        return mode, {"avtandil": "mulgazanzar", "pridon": "mulgazanzar", "fatman": "gulansharo", "tariel": "wilderness"}, ("avtandil", "tariel", "letter"), [("avtandil", "pridon", "brotherhood")]
    if ch_num in (53, 54):
        return mode, {"avtandil": "wilderness", "tariel": "wilderness", "asmat": "wilderness", "nestan": "kajeti"}, ("avtandil", "tariel", "brotherhood"), [("nestan", "tariel", "letter")]
    if ch_num in (55, 56):
        return mode, {"tariel": "kajeti", "avtandil": "kajeti", "pridon": "kajeti", "nestan": "kajeti", "dulardukht": "kajeti"}, ("tariel", "avtandil", "brotherhood"), [("pridon", "tariel", "brotherhood")]
    if ch_num == 57:
        return mode, {"tariel": "kajeti", "avtandil": "kajeti", "pridon": "kajeti", "nestan": "kajeti", "dulardukht": "kajeti"}, ("tariel", "nestan", "love") if st_num >= 1425 else ("tariel", "dulardukht", "conflict"), [("avtandil", "nestan", "rescue"), ("pridon", "tariel", "brotherhood")]
    if ch_num in (58, 59, 60):
        r_hero = "gulansharo" if ch_num == 58 else ("mulgazanzar" if ch_num == 59 else "wilderness")
        return mode, {"tariel": r_hero, "nestan": r_hero, "avtandil": r_hero, "pridon": "mulgazanzar", "fatman": "gulansharo", "surkhavi": "gulansharo", "asmat": "wilderness"}, ("nestan", "fatman", "rescue") if ch_num == 58 else ("pridon", "tariel", "brotherhood"), [("tariel", "nestan", "love")]
    if ch_num in (61, 62, 63):
        return mode, {"rostevan": "arabia", "tinatin": "arabia", "avtandil": "arabia", "tariel": "arabia", "nestan": "arabia", "pridon": "arabia", "asmat": "arabia"}, ("avtandil", "tinatin", "love"), [("tariel", "rostevan", "feudal"), ("tariel", "avtandil", "brotherhood")]
    # ch 64, 65
    return mode, {"tariel": "india", "nestan": "india", "asmat": "india", "avtandil": "arabia", "tinatin": "arabia", "pridon": "mulgazanzar", "rustaveli": "arabia"}, ("tariel", "nestan", "feudal") if ch_num == 64 else ("rustaveli", "tariel", "grief_support"), [("tariel", "asmat", "feudal"), ("tariel", "avtandil", "brotherhood")]

def detect_stanza_characters(text_ka, text_en, base_realms):
    combined = f"{text_ka or ''}\n{text_en or ''}"
    found = []
    for cid, pat in CHAR_PATTERNS.items():
        if pat.search(combined):
            found.append(cid)
    # Prioritize characters already in base_realms, but also allow newly mentioned ones
    ordered = [c for c in found if c in base_realms] + [c for c in found if c not in base_realms]
    return ordered

def detect_stanza_type(text_ka, text_en, default_type):
    combined = f"{text_ka or ''}\n{text_en or ''}"
    for t_key, pat in TYPE_PATTERNS:
        if pat.search(combined):
            return t_key
    return default_type

def build_stanza_graph():
    stanza_steps = []
    chapter_steps = []

    for ch_file in sorted(CHAPTERS_DIR.glob("chapter-*.json")):
        with open(ch_file, "r", encoding="utf-8") as f:
            ch = json.load(f)

        ch_num = ch["chapter_number"]
        ch_title_ka = ch["chapter_title_ka"]
        ch_title_en = ch["chapter_title_en"]
        stanzas = ch.get("stanzas", [])

        for st in stanzas:
            s_num = st["stanza_number"]
            raw_ka = st.get("georgian_raw_text") or ""
            raw_en = st.get("english_translation") or ""
            comm_en = st.get("expert_explanation_en") or ""

            mode, base_realms, focal_default, secondary_list = get_chapter_context(ch_num, s_num)
            node_realms = dict(base_realms)

            mentioned = detect_stanza_characters(raw_ka, raw_en, node_realms)
            for m_char in mentioned[:2]:
                if m_char not in node_realms:
                    node_realms[m_char] = CHARACTERS[m_char]["base_realm"]

            # Determine primary interaction for this exact stanza
            def_src, def_tgt, def_type = focal_default
            st_type = detect_stanza_type(raw_ka, raw_en, def_type)

            if len(mentioned) >= 2:
                src, tgt = mentioned[0], mentioned[1]
            elif len(mentioned) == 1:
                src = mentioned[0]
                tgt = def_tgt if src != def_tgt else def_src
            else:
                src, tgt = def_src, def_tgt

            if src not in node_realms:
                node_realms[src] = CHARACTERS[src]["base_realm"]
            if tgt not in node_realms:
                node_realms[tgt] = CHARACTERS[tgt]["base_realm"]

            lbl_ka, lbl_en = TYPE_ACTION_LABELS.get(st_type, ("ურთიერთობა", "Interaction"))
            first_line_ka = raw_ka.split("\n")[0] if raw_ka else ch_title_ka

            interactions = [
                {
                    "source": src,
                    "target": tgt,
                    "type": st_type,
                    "label": lbl_ka,
                    "label_ka": f"{lbl_ka} (სტრ. #{s_num})",
                    "label_en": f"{lbl_en} (Stanza #{s_num})",
                    "detail": first_line_ka,
                    "detail_ka": f"თავი {ch_num} — {ch_title_ka}",
                    "detail_en": comm_en[:220] + ("..." if len(comm_en) > 220 else "") if comm_en else ch_title_en,
                    "quote": raw_ka,
                    "quote_ka": raw_ka,
                    "quote_en": raw_en,
                    "stanza_ref": s_num,
                    "primary": True,
                }
            ]

            for s_src, s_tgt, s_type in secondary_list:
                if {s_src, s_tgt} != {src, tgt} and s_src in node_realms and s_tgt in node_realms:
                    s_lbl_ka, s_lbl_en = TYPE_ACTION_LABELS.get(s_type, ("კავშირი", "Bond"))
                    interactions.append({
                        "source": s_src,
                        "target": s_tgt,
                        "type": s_type,
                        "label": s_lbl_ka,
                        "label_ka": s_lbl_ka,
                        "label_en": s_lbl_en,
                        "detail": ch_title_ka,
                        "detail_ka": ch_title_ka,
                        "detail_en": ch_title_en,
                        "quote": first_line_ka,
                        "quote_ka": first_line_ka,
                        "quote_en": raw_en,
                        "stanza_ref": s_num,
                        "primary": False,
                    })

            active_chars = [src, tgt] + [c for c in mentioned if c not in (src, tgt)]
            node_status = {}
            for c_id in node_realms:
                if c_id == src:
                    node_status[c_id] = {
                        "ka": f"მოქმედი პირი სტროფში #{s_num} ({lbl_ka})",
                        "en": f"Focal actor in Stanza #{s_num} ({lbl_en})",
                    }
                elif c_id == tgt:
                    node_status[c_id] = {
                        "ka": f"ადრესატი / მონაწილე სტროფში #{s_num}",
                        "en": f"Addressee / participant in Stanza #{s_num}",
                    }
                else:
                    node_status[c_id] = {
                        "ka": f"მონაწილეობს თავში {ch_num} ({ch_title_ka})",
                        "en": f"Present in Chapter {ch_num} ({ch_title_en})",
                    }

            stanza_steps.append({
                "id": f"st_{s_num}",
                "stanzaNumber": s_num,
                "wardropNumber": st.get("wardrop_stanza_number"),
                "chapterNumber": ch_num,
                "stanzaStart": s_num,
                "stanzaEnd": s_num,
                "mode": mode,
                "title_ka": f"სტროფი #{s_num}",
                "title_en": f"Stanza #{s_num}",
                "chapter_title_ka": ch_title_ka,
                "chapter_title_en": ch_title_en,
                "verse_ka": raw_ka,
                "verse_en": raw_en,
                "commentary_en": comm_en,
                "sources": st.get("scholarly_sources", []),
                "activeChars": active_chars[:3],
                "nodeRealms": node_realms,
                "nodeStatus": node_status,
                "interactions": interactions,
            })

        # Also record chapter-level step from the chapter's first/representative stanza
        if stanzas:
            rep = stanza_steps[-len(stanzas)]
            chapter_steps.append({
                "id": f"ch_{ch_num}",
                "chapterNumber": ch_num,
                "poemChapters": [ch_num],
                "stanzaStart": stanzas[0]["stanza_number"],
                "stanzaEnd": stanzas[-1]["stanza_number"],
                "mode": rep["mode"],
                "title": ch_title_ka,
                "title_ka": f"თავი {ch_num}: {ch_title_ka}",
                "title_en": f"Chapter {ch_num}: {ch_title_en}",
                "narrative": ch.get("chapter_expert_explanation_en", ""),
                "narrative_ka": ch_title_ka,
                "narrative_en": ch.get("chapter_expert_explanation_en", ""),
                "verse": stanzas[0].get("georgian_raw_text", ""),
                "verse_ka": stanzas[0].get("georgian_raw_text", ""),
                "verse_en": stanzas[0].get("english_translation", ""),
                "nodeRealms": rep["nodeRealms"],
                "nodeStatus": rep["nodeStatus"],
                "interactions": rep["interactions"],
            })

    graph_out = {
        "granularity": "stanza",
        "total_stanzas": len(stanza_steps),
        "total_chapters": len(chapter_steps),
        "realms": REALMS,
        "interaction_types": INTERACTION_TYPES,
        "characters": CHARACTERS,
        "stanza_steps": stanza_steps,
        "chapter_steps": chapter_steps,
        "steps": chapter_steps,
    }

    with open(STORY_GRAPH_JSON, "w", encoding="utf-8") as f:
        json.dump(graph_out, f, ensure_ascii=False, separators=(",", ":"))

    with open(STORY_GRAPH_BUNDLE, "w", encoding="utf-8") as f:
        f.write("window.STORY_GRAPH_BUNDLE = ")
        json.dump(graph_out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"Generated stanza-level story_graph.json with {len(stanza_steps)} stanzas and {len(chapter_steps)} chapters.")

if __name__ == "__main__":
    build_stanza_graph()
