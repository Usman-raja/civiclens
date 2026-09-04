"""Generate CivicLens project presentation PowerPoint."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

DARK_BG = RGBColor(0x0F, 0x17, 0x2A)
ACCENT = RGBColor(0x00, 0xD4, 0xFF)
ACCENT2 = RGBColor(0x22, 0xD3, 0xEE)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0x94, 0xA3, 0xB8)
GREEN = RGBColor(0x10, 0xB9, 0x81)
ORANGE = RGBColor(0xF5, 0x9E, 0x0B)
RED = RGBColor(0xEF, 0x44, 0x44)


def add_bg(slide, color=DARK_BG):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_text(slide, left, top, width, height, text, size=18, color=WHITE, bold=False, align=PP_ALIGN.LEFT):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.alignment = align
    return tf


def add_bullet_list(slide, left, top, width, height, items, size=16, color=WHITE):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(size)
        p.font.color.rgb = color
        p.space_after = Pt(8)
    return tf


def add_accent_line(slide, left, top, width):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(0.04))
    shape.fill.solid()
    shape.fill.fore_color.rgb = ACCENT
    shape.line.fill.background()


# ========== SLIDE 1: TITLE ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 2.0, 4)
add_text(slide, 1, 2.2, 11, 1.5, "CivicLens", size=54, color=ACCENT, bold=True)
add_text(slide, 1, 3.5, 11, 1, "City-Scale Video Intelligence Platform", size=28, color=WHITE)
add_text(slide, 1, 4.5, 11, 0.6, "AI-Powered Surveillance | Civic Scoring | Smart Alerts", size=18, color=GRAY)
add_text(slide, 1, 6.2, 5, 0.4, "Developed by Usman Farid", size=14, color=GRAY)
add_text(slide, 1, 6.6, 5, 0.4, "Made in Pakistan", size=14, color=GREEN)

# ========== SLIDE 2: PROBLEM & SOLUTION ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "The Problem", size=36, color=ACCENT, bold=True)
add_bullet_list(slide, 1, 1.9, 5, 3, [
    "  Manual surveillance cannot scale across hundreds of cameras",
    "  No automated civic behavior tracking or scoring",
    "  Delayed response to security threats and incidents",
    "  No centralized platform for city-wide intelligence",
], size=16, color=GRAY)

add_accent_line(slide, 7, 0.8, 2)
add_text(slide, 7, 1.0, 5.5, 0.8, "Our Solution", size=36, color=GREEN, bold=True)
add_bullet_list(slide, 7, 1.9, 5.5, 3, [
    "  AI-powered real-time video analysis across all feeds",
    "  Automated civic scoring for every registered citizen",
    "  Instant alerts for security, missing persons, crowd surges",
    "  Single command center for operators and administrators",
], size=16, color=GRAY)

add_text(slide, 1, 5.5, 11, 1.5,
    "CivicLens ingests camera feeds, runs face recognition + object detection + scene analysis,\n"
    "and turns results into actionable civic events, alerts, and citizen scores.",
    size=16, color=WHITE)

# ========== SLIDE 3: KEY FEATURES ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Key Features", size=36, color=ACCENT, bold=True)

features_left = [
    "Face Recognition -- InsightFace embeddings match citizens, watchlist, missing persons",
    "Object & Scene Detection -- YOLOv8 detects persons, vehicles, unattended bags",
    "Civic Event Generation -- Jaywalking, littering, loitering, queue discipline, proper disposal",
    "Civic Scoring -- Auto score 1-10 per citizen based on positive and negative behavior",
    "Smart Alerts -- Watchlist match, missing person, crowd surge, illegal parking, accidents",
]
features_right = [
    "24/7 Monitoring -- Daemon threads per camera, no browser required",
    "AI Zone Suggestion -- YOLO World + SegFormer auto-suggest road, crosswalk, parking zones",
    "Bulk Import -- CSV/Excel camera onboarding + ZIP face photo batch import",
    "Analytics Dashboard -- Charts, incident logs, CSV export",
    "Role-Based Access -- JWT auth with admin and operator roles",
]

add_bullet_list(slide, 0.5, 2.0, 6, 5, [f"  {f}" for f in features_left], size=14, color=WHITE)
add_bullet_list(slide, 6.8, 2.0, 6, 5, [f"  {f}" for f in features_right], size=14, color=WHITE)

# ========== SLIDE 4: ACCIDENT DETECTION ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Accident & Road Safety Detection", size=36, color=ACCENT, bold=True)
add_text(slide, 1, 2.0, 11, 0.6, "5 geometric signal patterns for comprehensive road safety monitoring:", size=18, color=GRAY)

signals = [
    ("Fallen Person", "Detects a person lying on the road surface", RED),
    ("Person Under Vehicle", "Identifies a person trapped beneath a vehicle", RED),
    ("Stopped Vehicle", "Flags vehicles stationary in travel lanes", ORANGE),
    ("Vehicle Collision", "Detects two vehicles in contact or overlapping", RED),
    ("Crashed Vehicle Pair", "Identifies post-accident vehicle configurations", ORANGE),
]

y = 3.0
for title, desc, color in signals:
    add_text(slide, 1.5, y, 3, 0.4, title, size=18, color=color, bold=True)
    add_text(slide, 5, y, 7, 0.4, desc, size=16, color=WHITE)
    y += 0.7

add_text(slide, 1, 6.5, 11, 0.5, "All detections generate instant alerts with evidence images for operator review.", size=14, color=GRAY)

# ========== SLIDE 5: TECH STACK ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Technology Stack", size=36, color=ACCENT, bold=True)

layers = [
    ("Backend", "FastAPI + SQLAlchemy + SQLite", ACCENT2),
    ("Frontend", "Next.js 16 (App Router) + React 19 + Tailwind CSS 4", ACCENT2),
    ("AI / ML", "InsightFace (buffalo_l) + YOLOv8n + YOLOv8s-worldv2 + SegFormer", GREEN),
    ("Auth", "JWT (12h expiry) + bcrypt password hashing", ACCENT2),
    ("Database", "SQLite (single-file, zero-config deployment)", ACCENT2),
    ("Runtime", "Python 3.11 + Node.js 20+", ACCENT2),
]

y = 2.2
for label, detail, color in layers:
    add_text(slide, 1, y, 2.5, 0.5, label, size=20, color=color, bold=True)
    add_text(slide, 4, y, 8, 0.5, detail, size=18, color=WHITE)
    y += 0.75

# ========== SLIDE 6: ARCHITECTURE ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "System Architecture", size=36, color=ACCENT, bold=True)

add_text(slide, 1, 2.0, 5, 0.5, "Backend Engine (8 Modules)", size=20, color=GREEN, bold=True)
add_bullet_list(slide, 1, 2.6, 5.5, 3, [
    "  face_engine -- InsightFace embeddings + cosine similarity",
    "  object_engine -- YOLOv8 detection pipeline",
    "  event_engine -- Civic event generation + scoring",
    "  stream_monitor -- 24/7 RTSP/file feed processing",
    "  scene_detector -- Scene understanding",
    "  segmentation_detector -- SegFormer zone polygons",
    "  scoring_engine -- Citizen civic score computation",
    "  security -- Auth + role-based access control",
], size=13, color=GRAY)

add_text(slide, 7, 2.0, 5, 0.5, "Frontend Pages (11 Views)", size=20, color=GREEN, bold=True)
add_bullet_list(slide, 7, 2.6, 5.5, 3, [
    "  Dashboard -- Real-time overview",
    "  Live Monitoring -- Multi-feed viewing",
    "  Camera Wall -- Control-room grid",
    "  Alerts -- Security notifications",
    "  Profiles -- Citizen registry",
    "  Watchlist -- Red-list monitoring",
    "  Missing Persons -- Search & match",
    "  Analytics -- Charts + CSV export",
    "  Cameras + Zone Editor",
    "  Reports + Settings",
], size=13, color=GRAY)

add_text(slide, 1, 6.0, 11, 0.5,
    "57 API endpoints  |  17 database tables  |  Lazy singleton AI models  |  Frame-by-frame detection pipeline",
    size=15, color=ACCENT, align=PP_ALIGN.CENTER)

# ========== SLIDE 7: UI SCREENS ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "User Interface Highlights", size=36, color=ACCENT, bold=True)

ui_items = [
    ("Intelligence-Agency HUD", "Scanlines, corner brackets, radar sweep, glow effects", ACCENT2),
    ("Responsive Layout", "Mobile to 4K LED wall -- fluid grids, auto-fill camera wall", GREEN),
    ("Large Rotating Radar", "Real-time surveillance indicator in sidebar", ACCENT2),
    ("Camera Wall", "Auto-fill grid: 1 column on phone, 10+ on LED wall", GREEN),
    ("Collapsible Sidebar", "Mobile drawer with hamburger toggle, auto-close on nav", ACCENT2),
    ("Signature Branding", "Usman Farid signature + phone in sidebar, Made in Pakistan", GREEN),
]

y = 2.2
for title, desc, color in ui_items:
    add_text(slide, 1, y, 4, 0.5, title, size=18, color=color, bold=True)
    add_text(slide, 5.5, y, 7, 0.5, desc, size=16, color=WHITE)
    y += 0.7

# ========== SLIDE 8: DEPLOYMENT ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Deployment", size=36, color=ACCENT, bold=True)

add_text(slide, 1, 2.2, 11, 0.5, "Single-Click Installer", size=24, color=GREEN, bold=True)
add_bullet_list(slide, 1, 2.9, 11, 2, [
    "  CivicLens-Setup.exe -- Professional Inno Setup installer with admin permissions",
    "  No Python or Node.js required on target machine -- all runtimes bundled",
    "  Installs to Program Files, creates Start Menu + Desktop shortcuts",
    "  One-click launch: CivicLens.exe starts backend + frontend + opens browser",
], size=16, color=WHITE)

add_text(slide, 1, 5.0, 11, 0.5, "System Requirements", size=24, color=GREEN, bold=True)
add_bullet_list(slide, 1, 5.7, 11, 1.5, [
    "  Windows 10/11 (64-bit)",
    "  Ports 3000 (frontend) and 8000 (backend) available",
    "  Secure first-run administrator bootstrap", 
], size=16, color=GRAY)

# ========== SLIDE 9: SCALABLE DEPLOYMENT ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Scalable Deployment Options", size=36, color=ACCENT, bold=True)

add_text(slide, 0.5, 2.0, 3.5, 0.5, "Single Building", size=20, color=GREEN, bold=True)
add_bullet_list(slide, 0.5, 2.6, 3.5, 2, [
    "  SQLite (zero setup)",
    "  No config needed",
    "  Up to 50 cameras",
    "  Install and run",
], size=13, color=GRAY)

add_text(slide, 4.5, 2.0, 3.5, 0.5, "City District", size=20, color=ACCENT2, bold=True)
add_bullet_list(slide, 4.5, 2.6, 3.5, 2, [
    "  PostgreSQL + Redis",
    "  MESSAGE_QUEUE in .env",
    "  50-200 cameras",
    "  Horizontal scaling",
], size=13, color=GRAY)

add_text(slide, 8.5, 2.0, 4, 0.5, "Full City", size=20, color=ORANGE, bold=True)
add_bullet_list(slide, 8.5, 2.6, 4, 2, [
    "  PostgreSQL cluster",
    "  Redis + Edge workers",
    "  200-500+ cameras",
    "  Docker + Kubernetes",
], size=13, color=GRAY)

add_text(slide, 0.5, 5.0, 12, 0.5, "Message Queue (Redis)", size=20, color=GREEN, bold=True)
add_text(slide, 0.5, 5.5, 12, 0.8,
    "Detection events published to Redis, consumed by worker nodes. "
    "Add workers to scale horizontally. Enable with one line in .env.",
    size=14, color=GRAY)

add_text(slide, 0.5, 6.3, 12, 0.5, "Edge AI Mode", size=20, color=GREEN, bold=True)
add_text(slide, 0.5, 6.8, 12, 0.5,
    "EDGE_MODE=1 in .env: 320px resolution, frame skipping, lower RAM (~500MB). Runs on Raspberry Pi or low-end servers.",
    size=14, color=GRAY)

# ========== SLIDE 10: ZERO-CODE CONFIG ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Configuration-Driven (Zero Code Changes)", size=34, color=ACCENT, bold=True)

add_text(slide, 1, 2.0, 11, 0.6,
    "Install once. Configure everything via .env file. No rebuild, no code changes.",
    size=18, color=WHITE)

configs = [
    ("DATABASE_URL", "Switch SQLite / PostgreSQL / MySQL", GREEN),
    ("MESSAGE_QUEUE", "Enable Redis for distributed processing", ACCENT2),
    ("EDGE_MODE", "Lightweight mode for edge devices", GREEN),
    ("WORKER_ONLY", "Backend-only mode for edge nodes", ACCENT2),
    ("STORAGE_RETENTION_DAYS", "Auto-cleanup old images", GREEN),
    ("SECRET_KEY", "JWT security key for production", ACCENT2),
]

y = 3.0
for key, desc, color in configs:
    add_text(slide, 1, y, 3.5, 0.4, key, size=15, color=color, bold=True)
    add_text(slide, 5, y, 7, 0.4, desc, size=15, color=WHITE)
    y += 0.55

add_text(slide, 1, 6.5, 11, 0.5,
    "Full SETUP_GUIDE.md included with step-by-step instructions for every deployment scenario.",
    size=14, color=GRAY, align=PP_ALIGN.CENTER)

# ========== SLIDE 11: FUTURE ROADMAP ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 1, 0.8, 2)
add_text(slide, 1, 1.0, 11, 0.8, "Future Roadmap", size=36, color=ACCENT, bold=True)

add_bullet_list(slide, 1, 2.2, 11, 5, [
    "  Multi-city deployment with centralized cloud backend",
    "  Integration with NADRA and traffic management systems",
    "  License plate recognition (ANPR) for vehicle tracking",
    "  Behavioral prediction using temporal pattern analysis",
    "  Mobile companion app for field officers",
    "  Multi-language support (Urdu, English, regional)",
    "  API marketplace for third-party integrations",
    "  Kubernetes auto-scaling for 1000+ cameras",
], size=18, color=WHITE)

# ========== SLIDE 10: THANK YOU ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)
add_accent_line(slide, 4.5, 2.2, 4)
add_text(slide, 1, 2.5, 11, 1.2, "Thank You", size=54, color=ACCENT, bold=True, align=PP_ALIGN.CENTER)
add_text(slide, 1, 3.8, 11, 0.8, "CivicLens -- City-Scale Video Intelligence Platform", size=22, color=WHITE, align=PP_ALIGN.CENTER)
add_text(slide, 1, 5.0, 11, 0.5, "Usman Farid", size=20, color=WHITE, align=PP_ALIGN.CENTER)
add_text(slide, 1, 6.2, 11, 0.5, "Made in Pakistan", size=18, color=GREEN, align=PP_ALIGN.CENTER)

output = r"C:\Users\farid\civiclens\CivicLens-Hackathon-Presentation.pptx"
prs.save(output)
print(f"Presentation saved: {output}")
print(f"Slides: {len(prs.slides)}")
