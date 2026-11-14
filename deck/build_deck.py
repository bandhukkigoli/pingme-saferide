# Fills the VentureX R3 slide template with PingME SafeRide content.
# Run:  python deck/build_deck.py "<template.pptx>" "<output.pptx>" "<phone-images folder>"
# Edit the TEAM block below to change the cover details, then run again.
import sys, copy
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

TEAM = {
    "problem": "Build the Super App (PingME)",
    "team": "Hakuna Matata",
    "leader": "Bhagyadutta Panigrahi",
    "institution": "Punjab Engineering College",
    "theme": "Smart Mobility & Child Safety",
}
HEADER_BOX = TEAM["team"] if not TEAM["team"].startswith("‹") else "PingME SafeRide"

SRC, OUT, IMG = sys.argv[1], sys.argv[2], sys.argv[3]
MINT, ORANGE, WHITE = RGBColor(0x67, 0xD1, 0xA9), RGBColor(0xF5, 0xA6, 0x23), RGBColor(0xFF, 0xFF, 0xFF)
CARD, LINE, MUTED, RED = RGBColor(0x2B, 0x2B, 0x2B), RGBColor(0x44, 0x44, 0x44), RGBColor(0xC9, 0xC9, 0xC9), RGBColor(0xF0, 0x6A, 0x5F)
HEAD, BODY = "Poppins Bold", "Arial"

prs = Presentation(SRC)
S = prs.slides

def set_runs(shape, text):
    """Replace a template text box's words but keep its look (first run's format)."""
    tf = shape.text_frame
    r0 = tf.paragraphs[0].runs[0]
    r0.text = text
    for r in tf.paragraphs[0].runs[1:]: r._r.getparent().remove(r._r)
    for p in tf.paragraphs[1:]: p._p.getparent().remove(p._p)

def find(slide, text):
    for sh in slide.shapes:
        for s in ([sh] + list(getattr(sh, "shapes", []))):
            if s.has_text_frame and text in s.text_frame.text: return s
            for t in getattr(s, "shapes", []):
                if t.has_text_frame and text in t.text_frame.text: return t

def text(slide, x, y, w, h, parts, size=18, color=WHITE, font=BODY, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, space=6, bullet=False):
    """parts: list of paragraphs; each paragraph is a str or a list of (text, {bold,color,size,font})."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, para in enumerate(parts):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.space_after = Pt(space)
        if bullet: add_bullet(p)
        for t, o in ([(para, {})] if isinstance(para, str) else para):
            r = p.add_run(); r.text = t
            r.font.size = Pt(o.get("size", size)); r.font.bold = o.get("bold", False)
            r.font.color.rgb = o.get("color", color); r.font.name = o.get("font", font)
    return tb

def add_bullet(p):
    """Real PowerPoint bullet (a mint dot) with a hanging indent."""
    from pptx.oxml.ns import qn
    pPr = p._p.get_or_add_pPr(); pPr.set("marL", str(Inches(0.3))); pPr.set("indent", str(-Inches(0.3)))
    clr = pPr.makeelement(qn("a:buClr"), {}); c = clr.makeelement(qn("a:srgbClr"), {"val": "67D1A9"}); clr.append(c)
    ch = pPr.makeelement(qn("a:buChar"), {"char": "•"}); pPr.append(clr); pPr.append(ch)

def card(slide, x, y, w, h, fill=CARD, line=LINE):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.adjustments[0] = 0.08
    s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None: s.line.fill.background()
    else: s.line.color.rgb = line; s.line.width = Pt(1.25)
    s.shadow.inherit = False
    return s

def badge(slide, x, y, d, label, fill=MINT, color=RGBColor(0x14, 0x14, 0x14), size=20):
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    c.fill.solid(); c.fill.fore_color.rgb = fill; c.line.fill.background(); c.shadow.inherit = False
    tf = c.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = label; r.font.size = Pt(size); r.font.bold = True; r.font.name = HEAD; r.font.color.rgb = color

def phone(slide, name, x, y, h):
    from PIL import Image
    w, hh = Image.open(f"{IMG}/{name}").size
    slide.shapes.add_picture(f"{IMG}/{name}", Inches(x), Inches(y), height=Inches(h))
    return h * w / hh

def caption(slide, x, y, w, t):
    text(slide, x, y, w, 0.4, [t], size=13, color=MUTED, align=PP_ALIGN.CENTER)

def info_card(slide, x, y, w, h, title, lines, tcolor=MINT, size=17):
    card(slide, x, y, w, h)
    text(slide, x + 0.35, y + 0.28, w - 0.7, 0.5, [title], size=20, font=HEAD, color=tcolor)
    text(slide, x + 0.35, y + 0.9, w - 0.7, h - 1.05, lines, size=size, space=9, bullet=True)

# Header box on slides 2-6 ("YOUR TEAM NAME/LOGO")
for sl in list(S)[1:]:
    b = find(sl, "YOUR TEAM NAME")
    if b: set_runs(b, HEADER_BOX)

# ---------- Slide 1: cover ----------
s1 = S[0]
box = find(s1, "PROBLEM STATEMENT")
tf = box.text_frame
proto = copy.deepcopy(tf.paragraphs[0]._p)
for p in list(tf.paragraphs): p._p.getparent().remove(p._p)
rows = [("PROBLEM STATEMENT TITLE : ", TEAM["problem"]), ("TEAM NAME : ", TEAM["team"]),
        ("TEAM LEADER’S NAME : ", TEAM["leader"]), ("INSTITUTION/ORGANISATION : ", TEAM["institution"]),
        ("THEME : ", TEAM["theme"])]
for label, value in rows:
    p = copy.deepcopy(proto); tf._txBody.append(p)
    from pptx.text.text import _Paragraph
    para = _Paragraph(p, tf)
    r = para.runs[0]; r.text = label; r.font.size = Pt(26)
    v = copy.deepcopy(r._r); p.append(v)
    from pptx.text.text import _Run
    vr = _Run(v, para); vr.text = value; vr.font.color.rgb = RGBColor(0x0B, 0x3D, 0x2E)
    para.line_spacing = Pt(58)

# ---------- Slide 2: idea ----------
s2 = S[1]
set_runs(find(s2, "IDEA TITLE"), "PINGME SAFERIDE")
text(s2, 1.2, 3.15, 17.6, 0.6, ["Live school-bus tracking that tells parents exactly when to act, and never loses a child"],
     size=22, color=MINT, align=PP_ALIGN.CENTER, font=HEAD)
info_card(s2, 1.5, 3.95, 6.7, 2.6, "The problem", [
    "Parents wait at the stop not knowing if the bus is 2 or 20 minutes away.",
    "Nobody knows instantly if a child missed the bus, got off at the wrong stop or was left on board.",
    "Schools track buses on paper and phone calls."], tcolor=RED, size=16)
info_card(s2, 1.5, 6.8, 6.7, 2.6, "Our idea", [
    "One live system for parents, bus attendant, school desk and class teacher.",
    "Only the bus is located. A tag on each child's bag is scanned on and off the bus.",
    "Parents get a full-screen “Head to the stop now” alarm."], size=16)
xs = 8.85
for name, cap in [("04-parent-pass-map-eta.png", "Parent: live bus, stop and ETA"),
                  ("06-parent-ALARM-bus-is-near.png", "Alarm rings until the parent answers"),
                  ("10-parent-RED-not-scanned-off.png", "Instant alert: child not scanned off")]:
    w = phone(s2, name, xs, 3.95, 5.0); caption(s2, xs - 0.25, 9.1, w + 0.5, cap); xs += w + 0.35

# ---------- Slide 3: technical approach ----------
s3 = S[2]
flow = [("Bus", "Phone on the bus (GPS); demo uses a simulated bus on real roads"),
        ("Server", "Next.js API on Vercel, Singapore region"),
        ("Database", "Neon Postgres, Singapore: trips, scans, alerts"),
        ("Screens", "Parent, attendant, school desk, teacher: refresh every 1.5 s")]
x = 1.2; bw = 3.95; gap = 0.6
for i, (t, d) in enumerate(flow):
    card(s3, x, 3.6, bw, 2.0, fill=RGBColor(0x1F, 0x3B, 0x33), line=MINT)
    text(s3, x + 0.3, 3.8, bw - 0.6, 0.5, [t], size=21, font=HEAD, color=MINT)
    text(s3, x + 0.3, 4.4, bw - 0.6, 1.1, [d], size=15)
    if i < 3:
        a = s3.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + bw + 0.1), Inches(4.4), Inches(gap - 0.2), Inches(0.4))
        a.fill.solid(); a.fill.fore_color.rgb = ORANGE; a.line.fill.background(); a.shadow.inherit = False
    x += bw + gap
techs = [("1", "Bus position from the clock", "No background server needed: every refresh works out where the bus is from the time, then catches up."),
         ("2", "Each alert sent exactly once", "A step counter and unique keys stop many phones from creating the same alert twice."),
         ("3", "No alert skipped", "Each refresh checks all the time since the last one, so a fast bus can't jump past “bus is near”."),
         ("4", "Every child counted", "Bag-tag scans on and off. A missing child blocks the trip until found.")]
x = 1.2; cw = 4.18
for n, t, d in techs:
    card(s3, x, 6.0, cw, 2.65)
    badge(s3, x + 0.3, 6.3, 0.6, n)
    text(s3, x + 1.1, 6.32, cw - 1.3, 0.8, [t], size=17, font=HEAD, color=WHITE)
    text(s3, x + 0.3, 7.2, cw - 0.6, 1.4, [d], size=16, color=RGBColor(0xE2, 0xE2, 0xE2))
    x += cw + 0.29
text(s3, 2.4, 9.0, 15.2, 0.9, [[("Stack: ", {"bold": True, "color": ORANGE}),
     ("Next.js + TypeScript · Neon Postgres · Leaflet + OpenStreetMap · OSRM road routes · Capacitor Android app · automated tests", {})]],
     size=15, align=PP_ALIGN.CENTER)

# ---------- Slide 4: feasibility & viability ----------
s4 = S[3]
stats = [("LIVE", "deployed and working today", MINT), ("~30 ms", "server work per refresh", MINT),
         ("4 MB", "Android app, runs on budget phones", ORANGE), ("₹0", "new hardware for parents", ORANGE)]
x = 1.2; sw = 4.18
for big, small, col in stats:
    card(s4, x, 3.55, sw, 2.0)
    text(s4, x, 3.75, sw, 0.9, [big], size=44, font=HEAD, color=col, align=PP_ALIGN.CENTER)
    text(s4, x + 0.25, 4.8, sw - 0.5, 0.6, [small], size=15, color=MUTED, align=PP_ALIGN.CENTER)
    x += sw + 0.29
info_card(s4, 1.2, 5.85, 5.55, 3.1, "Feasible now", [
    "Fully built: 5 roles, alerts, scans, stop-change approvals, route editor.",
    "Tested end to end on the live site and on a real Android phone.",
    "Uses what schools have: a phone on the bus and printed tags."], size=16)
info_card(s4, 7.2, 5.85, 5.55, 3.1, "Viable as a business", [
    "Proposed: school pays a small fee per bus per month; parents use it free.",
    "Cheap to run: cloud hosting scales with use.",
    "Grows into the PingME super app: fees, notices, attendance."], tcolor=ORANGE, size=16)
info_card(s4, 13.2, 5.85, 5.55, 3.1, "Risks we handle", [
    "Weak network: retries and an offline screen.",
    "Privacy: only the bus is tracked; numbers masked.",
    "Lost or new tag: register it from the app in seconds."], tcolor=RED, size=16)

# ---------- Slide 5: impact & benefits ----------
s5 = S[4]
text(s5, 1.2, 3.2, 17.6, 0.7, [[("No child left on a bus: ", {"color": ORANGE, "font": HEAD}),
     ("the trip can't close until every child is scanned off.", {"font": HEAD})]], size=24, align=PP_ALIGN.CENTER)
groups = [("P", "Parents", ["Leave home at the right minute, not 20 minutes early.",
                            "Instant alert if the child missed the bus or didn't get off.", "Works in Hindi and English."]),
          ("S", "School desk", ["Every bus and child on one live screen.",
                                "Only problems shown first: who needs attention now.", "Approve stop changes, edit routes."]),
          ("A", "Bus attendant", ["One tap or scan per child.", "App says who is missing before the trip ends.",
                                  "Clear steps when something is wrong."]),
          ("T", "Teachers", ["See who boarded the bus but isn't in class.", "Mismatches go to the school desk at once."])]
x = 1.2; gw = 4.18
for i, (b, t, ls) in enumerate(groups):
    card(s5, x, 4.25, gw, 3.65)
    badge(s5, x + 0.3, 4.55, 0.7, b, fill=MINT if i % 2 == 0 else ORANGE)
    text(s5, x + 1.2, 4.66, gw - 1.4, 0.6, [t], size=21, font=HEAD, color=WHITE)
    text(s5, x + 0.3, 5.5, gw - 0.6, 2.3, ls, size=16, space=8, bullet=True)
    x += gw + 0.29
card(s5, 2.4, 8.2, 15.2, 1.4, fill=RGBColor(0x1F, 0x3B, 0x33), line=MINT)
text(s5, 2.75, 8.2, 14.5, 1.4, [[("Safety and privacy by design: ", {"bold": True, "color": MINT}),
     ("parents' and children's locations are never tracked or stored, phone numbers are always masked, and families need nothing but a phone.", {})]],
     size=17, anchor=MSO_ANCHOR.MIDDLE)

# ---------- Slide 6: research & references ----------
s6 = S[5]
info_card(s6, 1.2, 3.55, 8.6, 5.4, "Our own research and testing", [
    "Compared 4 stop orders on real Chandigarh roads (OSRM): best is 13.8 km instead of 16.1 km.",
    "Measured speed: moving the server from the US to Singapore cut server time per refresh from ~300 ms to ~30 ms.",
    "Tested the Android app on a real phone (Android 15) over USB: alarm, vibration and background notification.",
    "Tested on a weak mobile network: requests now time out after 6 s and retry.",
    "Automated tests run every scenario (missed bus, wrong stop, child left on bus) on the live site."], size=17)
info_card(s6, 10.2, 3.55, 8.6, 5.4, "References", [
    "OpenStreetMap contributors: map data (openstreetmap.org)",
    "OSRM: Open Source Routing Machine (project-osrm.org)",
    "Leaflet: interactive maps (leafletjs.com)",
    "Next.js documentation (nextjs.org/docs)",
    "Neon serverless Postgres (neon.tech/docs)",
    "Capacitor: Local Notifications (capacitorjs.com/docs)",
    "Android: notification channels (developer.android.com)",
    [("Live demo: ", {"bold": True, "color": ORANGE}), ("pingme-saferide.vercel.app", {})]], size=17)

prs.save(OUT)
print("saved", OUT)
