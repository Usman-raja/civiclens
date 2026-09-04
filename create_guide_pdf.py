"""Generate a professional PDF of the CivicLens SETUP_GUIDE.md."""

import re
from fpdf import FPDF

class GuidePDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(100, 110, 125)
            self.cell(0, 8, "CivicLens - Setup & Deployment Guide", align="C")
            self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 110, 125)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, text, level=1):
        text = sanitize(text)
        if level == 1:
            self.set_font("Helvetica", "B", 20)
            self.set_text_color(0, 180, 220)
            self.ln(4)
            self.cell(0, 12, text)
            self.ln(10)
            self.set_draw_color(0, 180, 220)
            self.set_line_width(0.5)
            self.line(self.l_margin, self.get_y(), self.l_margin + 80, self.get_y())
            self.ln(6)
        elif level == 2:
            self.set_font("Helvetica", "B", 15)
            self.set_text_color(16, 185, 129)
            self.ln(3)
            self.cell(0, 10, text)
            self.ln(8)
        elif level == 3:
            self.set_font("Helvetica", "B", 12)
            self.set_text_color(15, 23, 42)
            self.cell(0, 8, text)
            self.ln(6)

    def body_text(self, text):
        text = sanitize(text)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(51, 65, 85)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bold_text(self, text):
        text = sanitize(text)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(15, 23, 42)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def code_block(self, code):
        code = sanitize(code)
        self.set_fill_color(20, 30, 50)
        self.set_text_color(160, 220, 255)
        self.set_font("Courier", "", 8)
        x = self.get_x()
        y = self.get_y()
        lines = code.strip().split("\n")
        height = len(lines) * 5 + 6
        if y + height > 270:
            self.add_page()
            y = self.get_y()
        self.rect(self.l_margin, y, self.w - self.l_margin - self.r_margin, height, "F")
        self.set_xy(self.l_margin + 3, y + 3)
        for line in lines:
            self.cell(0, 5, line)
            self.ln(5)
            self.set_x(self.l_margin + 3)
        self.ln(4)

    def bullet(self, text):
        text = sanitize(text)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(51, 65, 85)
        x = self.get_x()
        self.set_x(x + 5)
        self.cell(4, 6, "-")
        self.multi_cell(0, 6, text.strip())
        self.ln(1)

    def table_row(self, cells, is_header=False):
        cells = [sanitize(c) for c in cells]
        col_widths = [55, 60, 65]
        if is_header:
            self.set_font("Helvetica", "B", 9)
            self.set_fill_color(0, 60, 80)
            self.set_text_color(255, 255, 255)
        else:
            self.set_font("Helvetica", "", 9)
            self.set_fill_color(25, 35, 55)
            self.set_text_color(200, 200, 200)
        for i, cell in enumerate(cells):
            w = col_widths[i] if i < len(col_widths) else 50
            self.cell(w, 7, cell.strip(), border=1, fill=True)
        self.ln(7)


def sanitize(text):
    replacements = {
        "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2022": "*", "\u2026": "...",
        "\u2192": "->", "\u2190": "<-", "\u2191": "^", "\u2193": "v",
        "\u00d7": "x", "\u00b7": "*", "\u2264": "<=", "\u2713": "v",
        "\u2500": "-", "\u2502": "|", "\u250c": "+", "\u2510": "+",
        "\u2514": "+", "\u2518": "+", "\u252c": "+", "\u2534": "+",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def parse_and_render(pdf, md_path):
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_code = False
    code_buf = []

    for line in lines:
        raw = line.rstrip("\n")

        if raw.startswith("```"):
            if in_code:
                pdf.code_block("\n".join(code_buf))
                code_buf = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_buf.append(raw)
            continue

        if raw.startswith("# "):
            pdf.section_title(raw[2:].strip(), level=1)
        elif raw.startswith("## "):
            text = raw[3:].strip()
            if pdf.page_no() > 1 or pdf.get_y() > 100:
                pdf.add_page()
            pdf.section_title(text, level=2)
        elif raw.startswith("### "):
            pdf.section_title(raw[4:].strip(), level=3)
        elif raw.startswith("**") and raw.endswith("**"):
            pdf.bold_text(raw.strip("*"))
        elif raw.startswith("| "):
            cells = [c.strip() for c in raw.split("|")[1:-1]]
            if cells and not all(set(c) <= set("-: ") for c in cells):
                is_header = any("Variable" in c or "Scenario" in c or "Setting" in c or "Factor" in c or "Layer" in c for c in cells)
                pdf.table_row(cells, is_header=is_header)
        elif raw.startswith("- ") or raw.startswith("  - "):
            pdf.bullet(raw.strip().lstrip("- "))
        elif raw.startswith("> "):
            pdf.set_font("Helvetica", "I", 10)
            pdf.set_text_color(100, 110, 125)
            pdf.multi_cell(0, 6, raw[2:].strip())
            pdf.ln(2)
        elif raw.strip() == "---":
            pdf.ln(3)
        elif raw.strip():
            clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', raw.strip())
            clean = clean.replace("**", "")
            if clean:
                pdf.body_text(clean)


def main():
    pdf = GuidePDF()
    pdf.alias_nb_pages()

    # Cover page
    pdf.add_page()
    pdf.set_fill_color(15, 23, 42)
    pdf.rect(0, 0, 210, 297, "F")

    pdf.ln(60)
    pdf.set_font("Helvetica", "B", 36)
    pdf.set_text_color(0, 212, 255)
    pdf.cell(0, 15, "CivicLens", align="C")
    pdf.ln(18)

    pdf.set_font("Helvetica", "", 18)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "Setup & Deployment Guide", align="C")
    pdf.ln(12)

    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, "City-Scale Video Intelligence Platform", align="C")
    pdf.ln(20)

    pdf.set_draw_color(0, 212, 255)
    pdf.set_line_width(0.5)
    cx = pdf.w / 2
    pdf.line(cx - 40, pdf.get_y(), cx + 40, pdf.get_y())
    pdf.ln(20)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(200, 200, 200)
    items = [
        "SQLite / PostgreSQL / MySQL",
        "Redis Message Queue",
        "Edge AI Mode",
        "Docker Deployment",
        "Multi-Server Architecture",
        "Security Hardening",
    ]
    for item in items:
        pdf.cell(0, 8, f"  {item}", align="C")
        pdf.ln(8)

    pdf.ln(20)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 8, "Version 1.0 | September 2026", align="C")
    pdf.ln(8)
    pdf.cell(0, 8, "Usman Farid | Made in Pakistan", align="C")

    # Content pages
    pdf.add_page()
    parse_and_render(pdf, r"C:\Users\farid\civiclens\SETUP_GUIDE.md")

    output = r"C:\Users\farid\civiclens\CivicLens-Setup-Guide.pdf"
    pdf.output(output)
    print(f"PDF saved: {output}")
    print(f"Pages: {pdf.page_no()}")


if __name__ == "__main__":
    main()
