from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "change-requests" / "NYSA-CRM-20261101-WA-001" / "NYSA-CRM-20261101-WA-001-Stage-B-Decision-Addendum.docx"

NAVY = "14252E"
GOLD = "9A7129"
PALE = "F4F1EA"
ALT = "F7F9FA"
BORDER = "D9D9D9"
BLACK = RGBColor(0, 0, 0)
MUTED = RGBColor(83, 96, 107)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=100, bottom=90, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = borders.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "4")
        node.set(qn("w:color"), BORDER)


def set_column_widths(table, widths):
    table.autofit = False
    grid = table._tbl.tblGrid
    for grid_col, width in zip(grid.gridCol_lst, widths):
        grid_col.set(qn("w:w"), str(int(width.twips)))
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(int(width.twips)))
            tc_w.set(qn("w:type"), "dxa")


def remove_paragraph_border(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    border = p_pr.find(qn("w:pBdr"))
    if border is not None:
        p_pr.remove(border)


def set_font(run, size=8.4, bold=False, color=BLACK, name="Aptos"):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def set_para(paragraph, before=0, after=0, line=1.0, align=None, keep=False):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    fmt.keep_with_next = keep
    if align is not None:
        paragraph.alignment = align


def clear_para(paragraph):
    for run in list(paragraph.runs):
        paragraph._element.remove(run._element)


def add_text(cell, text, *, bold=False, size=8.2, color=BLACK, align=WD_ALIGN_PARAGRAPH.LEFT):
    paragraph = cell.paragraphs[0]
    clear_para(paragraph)
    set_para(paragraph, after=0, line=1.0, align=align)
    run = paragraph.add_run(text)
    set_font(run, size=size, bold=bold, color=color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def style_header_row(row, labels, widths=None):
    for index, (cell, label) in enumerate(zip(row.cells, labels)):
        add_text(cell, label, bold=True, size=7.8, color=RGBColor(255, 255, 255))
        set_cell_shading(cell, NAVY)
        if widths:
            cell.width = widths[index]


def body_row(row, values, shade=None, widths=None, bold_columns=()):
    for index, (cell, value) in enumerate(zip(row.cells, values)):
        add_text(cell, value, bold=index in bold_columns, size=7.7)
        if shade:
            set_cell_shading(cell, shade)
        if widths:
            cell.width = widths[index]


def heading(doc, text):
    p = doc.add_paragraph(style="Heading 2")
    set_para(p, before=3, after=2, line=1.0, keep=True)
    r = p.add_run(text)
    set_font(r, size=10.2, bold=True)
    return p


doc = Document()
section = doc.sections[0]
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width = Cm(29.7)
section.page_height = Cm(21.0)
section.top_margin = Cm(0.75)
section.bottom_margin = Cm(0.65)
section.left_margin = Cm(0.9)
section.right_margin = Cm(0.9)

styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"]._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
styles["Normal"]._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
styles["Normal"].font.size = Pt(8.4)
styles["Title"].font.color.rgb = BLACK
styles["Heading 2"].font.color.rgb = BLACK
title_style_pr = styles["Title"].element.get_or_add_pPr()
title_style_border = title_style_pr.find(qn("w:pBdr"))
if title_style_border is not None:
    title_style_pr.remove(title_style_border)

title = doc.add_paragraph(style="Title")
set_para(title, after=0, line=1.0)
remove_paragraph_border(title)
run = title.add_run("NYSA CORE WhatsApp Stage B Decision Addendum")
set_font(run, size=20, bold=True)

meta = doc.add_paragraph()
set_para(meta, after=3, line=1.0)
for text, bold, color in [
    ("NYSA CRM 20261101 WA 001 Addendum 1", True, RGBColor(154, 113, 41)),
    ("   |   Issued 1 November 2026   |   Stage B working baseline", False, MUTED),
]:
    r = meta.add_run(text)
    set_font(r, size=8.2, bold=bold, color=color)

intro = doc.add_paragraph()
set_para(intro, after=2, line=1.04)
lead = intro.add_run("Decision. ")
set_font(lead, size=8.6, bold=True)
rest = intro.add_run(
    "Close Stage A fail-safe and begin only the decision-independent Stage B build in CRM Test: recipient import and deduplication, reusable segments, 360dialog template catalogue sync, and Agent draft with Manager or Director approval. Provider sending remains disabled. Production, the website, REM and +971 56 819 8022 remain unchanged."
)
set_font(rest, size=8.6)

heading(doc, "Decisions D01 to D08")
decisions = [
    ("D01", "Independent review", "Two-person review where available; otherwise Director self-approval with full audit."),
    ("D02", "Capacity", "Import up to 5,000 rows; dispatch must never exceed the current Meta tier."),
    ("D03", "Hours frequency spend", "09:00-20:00 recipient local time, Dubai fallback; one marketing message per person per 7 days; AED cap remains open."),
    ("D04", "Follow-ups", "Two unattended follow-ups at 24 and 72 hours, only after consent and activation approval."),
    ("D05", "AI", "Handover after 10 AI replies; languages and AI provider/data terms remain open for Stage C."),
    ("D06", "Operations", "15-minute office-hours handover; operating owner, team and escalation Manager must be named."),
    ("D07", "Retention", "Raw imports 30 days; conversations and audit 12 months; suppression retained under control."),
    ("D08", "Appointments freshness", "No calendar in v1; 5-minute template freshness; catalogue and pricing owners must be named."),
]
table = doc.add_table(rows=1, cols=3)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
widths = [Cm(1.25), Cm(4.0), Cm(21.8)]
set_column_widths(table, widths)
style_header_row(table.rows[0], ["ID", "Topic", "Approved position or open detail"], widths)
for i, row in enumerate(decisions):
    body_row(table.add_row(), row, shade=ALT if i % 2 else None, widths=widths, bold_columns=(0, 1))
set_table_borders(table)

bottom = doc.add_table(rows=1, cols=2)
bottom.alignment = WD_TABLE_ALIGNMENT.CENTER
bottom.autofit = False
bottom.columns[0].width = Cm(13.35)
bottom.columns[1].width = Cm(13.7)
set_table_borders(bottom)
for cell in bottom.rows[0].cells:
    set_cell_margins(cell, top=80, bottom=80, start=110, end=110)

left, right = bottom.rows[0].cells
left.width = Cm(13.35)
right.width = Cm(13.7)

p = left.paragraphs[0]
clear_para(p)
set_para(p, after=1, keep=True)
r = p.add_run("Stage B dated plan")
set_font(r, size=10.2, bold=True)
plan = [
    ("2-6 Nov", "Foundation", "Schema, validation, duplicate decisions and draft-only controls."),
    ("9-13 Nov", "Import and segments", "Synthetic import, exclusions, saved audiences and audit evidence."),
    ("16-20 Nov", "Templates and approval", "360dialog catalogue sync, freshness state and approval workflow."),
    ("23-27 Nov", "Live canary and acceptance", "Only if the staging number, opt-in and sending limits are approved."),
]
pt = left.add_table(rows=1, cols=3)
pt.autofit = False
pw = [Cm(2.2), Cm(3.25), Cm(7.35)]
set_column_widths(pt, pw)
style_header_row(pt.rows[0], ["Date", "Milestone", "Acceptance outcome"], pw)
for i, row in enumerate(plan):
    body_row(pt.add_row(), row, shade=ALT if i % 2 else None, widths=pw, bold_columns=(0, 1))
set_table_borders(pt)

p = right.paragraphs[0]
clear_para(p)
set_para(p, after=1, keep=True)
r = p.add_run("Inputs required from NYSA")
set_font(r, size=10.2, bold=True)
inputs = [
    ("By 6 Nov", "Staging SIM and number", "Dedicated 360dialog number; do not move the REM number."),
    ("By 10 Nov", "Initial templates", "NYSA names, languages, use cases and sample wording for Meta approval."),
    ("By 13 Nov", "Scope and consent", "Inbound channels in Stage B and accepted opt-in sources/evidence."),
    ("By 13 Nov", "Limits", "AED cap, campaign size at live Meta tier, sending hours and frequency."),
    ("By 20 Nov", "Stage C choices", "Languages and AI provider/data-processing terms; not needed for the draft-only foundation."),
]
it = right.add_table(rows=1, cols=3)
it.autofit = False
iw = [Cm(2.2), Cm(3.4), Cm(7.55)]
set_column_widths(it, iw)
style_header_row(it.rows[0], ["Due", "Decision or asset", "What NYSA provides"], iw)
for i, row in enumerate(inputs):
    body_row(it.add_row(), row, shade=ALT if i % 2 else None, widths=iw, bold_columns=(0, 1))
set_table_borders(it)

footer = section.footer.paragraphs[0]
set_para(footer, before=0, after=0, align=WD_ALIGN_PARAGRAPH.RIGHT)
fr = footer.add_run("CRM Test only   |   Sending disabled   |   Approval required before any live canary")
set_font(fr, size=7.2, color=MUTED)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
