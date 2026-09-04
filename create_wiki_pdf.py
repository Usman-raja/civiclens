"""Convert REPO_WIKI.md to a PDF for hackathon submission attachments.

Hand-rolled line-based renderer (not full markdown->HTML) so it never trips
over fpdf2's limited HTML parser -- just needs to look decent, not be a
pixel-perfect markdown renderer.
"""
import re
from fpdf import FPDF

FONT_DIR = "C:/Windows/Fonts"

with open("REPO_WIKI.md", "r", encoding="utf-8") as f:
    text = f.read()

_REPLACEMENTS = {
    "—": "-", "–": "-", "‘": "'", "’": "'",
    "“": '"', "”": '"', "…": "...", "→": "->",
    "•": "-", "×": "x",
    "├": "|", "└": "`", "─": "-", "│": "|",
    "→": "->", "✓": "v", "✗": "x",
}
for src, dst in _REPLACEMENTS.items():
    text = text.replace(src, dst)

lines = text.splitlines()


def clean_inline(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    return text


pdf = FPDF(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_font("Arial", "", f"{FONT_DIR}/arial.ttf")
pdf.add_font("Arial", "B", f"{FONT_DIR}/arialbd.ttf")
pdf.add_font("Mono", "", f"{FONT_DIR}/consola.ttf")
pdf.add_page()

in_code_block = False
table_buffer = []


def flush_table():
    global table_buffer
    rows = [r for r in table_buffer if not re.match(r"^\|?\s*:?-+:?\s*\|", r)]
    table_buffer = []
    if not rows:
        return
    parsed = [
        [c.strip() for c in r.strip().strip("|").split("|")]
        for r in rows
    ]
    pdf.set_x(pdf.l_margin)
    for row in parsed:
        cells = [clean_inline(c) for c in row if c.strip()]
        pdf.set_font("Arial", "B", 10)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5.5, "  |  ".join(cells) if len(cells) > 1 else cells[0] if cells else "")
    pdf.ln(2)


for raw in lines:
    line = raw.rstrip()

    if line.strip().startswith("```"):
        in_code_block = not in_code_block
        continue
    if in_code_block:
        pdf.set_font("Mono", "", 8)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 4, line)
        continue

    if line.strip().startswith("|"):
        table_buffer.append(line)
        continue
    elif table_buffer:
        flush_table()

    if not line.strip():
        pdf.ln(2)
        continue

    pdf.set_x(pdf.l_margin)

    if line.startswith("# "):
        pdf.set_font("Arial", "B", 20)
        pdf.ln(4)
        pdf.multi_cell(0, 9, clean_inline(line[2:]))
        pdf.ln(1)
    elif line.startswith("## "):
        pdf.set_font("Arial", "B", 15)
        pdf.ln(3)
        pdf.multi_cell(0, 8, clean_inline(line[3:]))
        pdf.ln(1)
    elif line.startswith("### "):
        pdf.set_font("Arial", "B", 12)
        pdf.ln(2)
        pdf.multi_cell(0, 7, clean_inline(line[4:]))
    elif line.strip() == "---":
        pdf.ln(2)
        y = pdf.get_y()
        pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
        pdf.ln(3)
    elif re.match(r"^\s*[-*]\s+", line):
        content = re.sub(r"^\s*[-*]\s+", "", line)
        pdf.set_font("Arial", "", 10)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5.5, f"- {clean_inline(content)}")
    elif re.match(r"^\s*\d+\.\s+", line):
        content = re.sub(r"^\s*\d+\.\s+", "", line)
        pdf.set_font("Arial", "", 10)
        pdf.multi_cell(0, 5.5, clean_inline(content))
    else:
        pdf.set_font("Arial", "", 10)
        pdf.multi_cell(0, 5.5, clean_inline(line))

if table_buffer:
    flush_table()

output = "CivicLens-Repo-Wiki.pdf"
pdf.output(output)
print(f"Saved: {output}")
