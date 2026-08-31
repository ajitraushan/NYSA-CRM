from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "NYSA_UAT065_Expected_HNW_Offer_Layout_Dummy.pdf"
LOGO = ROOT / "public" / "brand" / "nysa" / "raster" / "nysa-horizontal-dark@3x.png"
HERO = ROOT / "public" / "brand" / "dubai-skyline-auth-golden-hour-palms.png"

PAGE_W, PAGE_H = A4
NAVY = HexColor("#102840")
NAVY_2 = HexColor("#1B3B58")
GOLD = HexColor("#B48A42")
GOLD_LIGHT = HexColor("#D8BB7A")
CREAM = HexColor("#F6F2E9")
PALE = HexColor("#EEF1F2")
INK = HexColor("#20272C")
MUTED = HexColor("#68747A")
LINE = HexColor("#D8D5CD")
GREEN = HexColor("#2D6A55")

MARGIN = 42
CONTENT_W = PAGE_W - 2 * MARGIN


def cover_image(c, path, x, y, width, height):
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    clipping = c.beginPath()
    clipping.rect(x, y, width, height)
    c.clipPath(clipping, stroke=0, fill=0)
    c.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh, mask="auto")
    c.restoreState()


def wrapped_lines(text, font, size, max_width):
    words = str(text).split()
    lines, current = [], ""
    for word in words:
        test = word if not current else f"{current} {word}"
        if stringWidth(test, font, size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(c, text, x, y, width, size=9.2, leading=13, font="Helvetica", color=INK, max_lines=None):
    lines = wrapped_lines(text, font, size, width)
    if max_lines:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c, text, x, y, color=GOLD):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x, y, text.upper())


def page_header(c, page_no, title):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 72, PAGE_W, 72, stroke=0, fill=1)
    c.drawImage(str(LOGO), MARGIN, PAGE_H - 58, width=142, height=32, preserveAspectRatio=True, mask="auto")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 35, title.upper())
    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 49, f"NYSA-OFR-DEMO-0001 | REVISION 1 | PAGE {page_no} OF 3")


def footer(c, page_no):
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(MARGIN, 34, PAGE_W - MARGIN, 34)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawString(MARGIN, 21, "DUMMY DATA - LAYOUT SPECIMEN - NOT FOR TRANSACTION USE")
    c.drawRightString(PAGE_W - MARGIN, 21, f"Private and confidential | Page {page_no} of 3")


def section_title(c, text, y):
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(MARGIN, y, text)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.2)
    c.line(MARGIN, y - 8, PAGE_W - MARGIN, y - 8)
    return y - 28


def fact_cell(c, x, y, width, title, value, height=48, value_size=9):
    c.setFillColor(CREAM)
    c.roundRect(x, y - height, width, height, 4, stroke=0, fill=1)
    label(c, title, x + 11, y - 15)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", value_size)
    lines = wrapped_lines(value, "Helvetica-Bold", value_size, width - 22)[:2]
    ty = y - 31
    for line in lines:
        c.drawString(x + 11, ty, line)
        ty -= 11


def page_one(c):
    page_header(c, 1, "Private Offer to Purchase")

    cover_image(c, HERO, 0, PAGE_H - 350, PAGE_W, 278)
    c.setFillColor(NAVY_2)
    c.rect(0, PAGE_H - 350, PAGE_W, 112, stroke=0, fill=1)
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN, PAGE_H - 267, "PRIVATE AND CONFIDENTIAL")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(MARGIN, PAGE_H - 299, "PRIVATE OFFER TO PURCHASE")
    c.setFont("Helvetica", 13)
    c.drawString(MARGIN, PAGE_H - 322, "Marina Crest Residence | Private brokerage communication")
    c.setFillColor(white)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 339, "Illustrative dummy property image used for layout demonstration")

    y = PAGE_H - 382
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, y, "Dear Sir / Madam,")
    y -= 25
    intro = (
        "NYSA Realty is pleased to confirm its agreement to broker the proposed purchase of Marina Crest Residence "
        "and to facilitate the transaction between the buyer and seller on the terms set out below. The transaction "
        "remains subject to agreement between those parties and execution of the required MOU and transaction documents."
    )
    y = paragraph(c, intro, MARGIN, y, CONTENT_W, size=10.4, leading=15, max_lines=4)

    y -= 14
    left_w = 310
    c.setFillColor(NAVY)
    c.roundRect(MARGIN, y - 88, left_w, 88, 6, stroke=0, fill=1)
    label(c, "Offer amount", MARGIN + 16, y - 20, GOLD_LIGHT)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGIN + 16, y - 49, "AED 8,750,000")
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN + 16, y - 70, "Eight million seven hundred fifty thousand dirhams")

    right_x = MARGIN + left_w + 12
    c.setFillColor(CREAM)
    c.roundRect(right_x, y - 88, CONTENT_W - left_w - 12, 88, 6, stroke=0, fill=1)
    label(c, "Valid until", right_x + 14, y - 20)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(right_x + 14, y - 43, "29 Aug 2026")
    c.setFont("Helvetica", 8)
    c.drawString(right_x + 14, y - 61, "6:00 PM Dubai time")
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(right_x + 14, y - 77, "OPEN FOR CONSIDERATION")

    y -= 116
    c.setFillColor(PALE)
    c.roundRect(MARGIN, y - 66, CONTENT_W, 66, 5, stroke=0, fill=1)
    label(c, "Purpose of this document", MARGIN + 13, y - 17, NAVY)
    paragraph(
        c,
        "This private brokerage communication records proposed commercial terms for consideration by the relevant transaction parties. It is not an MOU, reservation or binding transaction agreement.",
        MARGIN + 13,
        y - 37,
        CONTENT_W - 26,
        size=8.7,
        leading=12,
        max_lines=2,
    )
    footer(c, 1)
    c.showPage()


def page_two(c):
    page_header(c, 2, "Property and Offer Summary")
    y = PAGE_H - 104
    y = section_title(c, "Property profile", y)

    image_h = 186
    cover_image(c, HERO, MARGIN, y - image_h, CONTENT_W, image_h)
    c.setFillColor(HexColor("#102840B8"))
    c.rect(MARGIN, y - image_h, CONTENT_W, 37, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN + 14, y - image_h + 20, "Marina Crest Residence")
    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - MARGIN - 12, y - image_h + 20, "INVENTORY NYSA-INV-DEMO-0241")

    y -= image_h + 18
    gap = 8
    cell_w = (CONTENT_W - gap * 3) / 4
    facts = [
        ("Community", "Dubai Marina"),
        ("Building / project", "Marina Crest"),
        ("Property type", "Apartment"),
        ("Market stage", "Ready"),
        ("Bedrooms", "3"),
        ("Bathrooms", "4"),
        ("Built-up area", "2,450 sq ft"),
        ("Availability", "Confirmed 22 Aug 2026"),
    ]
    for idx, (title, value) in enumerate(facts):
        col = idx % 4
        row = idx // 4
        fact_cell(c, MARGIN + col * (cell_w + gap), y - row * 56, cell_w, title, value, height=48, value_size=8.2)

    y -= 128
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN, y, "Property overview")
    y -= 18
    overview = (
        "A spacious three-bedroom residence with marina and skyline views, generous reception areas, private balcony, "
        "four bathrooms and two allocated parking spaces. The information shown here is dummy content demonstrating "
        "how verified Inventory facts would be presented in a premium client document."
    )
    y = paragraph(c, overview, MARGIN, y, CONTENT_W, size=9.2, leading=13, max_lines=5)

    y -= 14
    y = section_title(c, "Property highlights", y)
    highlight_w = (CONTENT_W - 24) / 4
    highlights = [
        ("Outlook", "Marina and skyline views"),
        ("Outdoor space", "Private balcony"),
        ("Parking", "Two allocated spaces"),
        ("Amenities", "Pool, gym and concierge"),
    ]
    for idx, (title, value) in enumerate(highlights):
        fact_cell(c, MARGIN + idx * (highlight_w + 8), y, highlight_w, title, value, height=60, value_size=8.2)

    y -= 82
    c.setFillColor(PALE)
    c.roundRect(MARGIN, y - 60, CONTENT_W, 60, 5, stroke=0, fill=1)
    label(c, "NYSA brokerage contact", MARGIN + 13, y - 17, NAVY)
    paragraph(
        c,
        "Maya Rahman | Senior Property Advisor | NYSA Realty | Dummy advisor details for layout demonstration",
        MARGIN + 13,
        y - 35,
        CONTENT_W - 26,
        size=8.6,
        leading=12,
        max_lines=2,
    )
    footer(c, 2)
    c.showPage()


def bullet(c, text, x, y, width):
    c.setFillColor(GOLD)
    c.circle(x + 3, y + 3, 2, stroke=0, fill=1)
    return paragraph(c, text, x + 14, y, width - 14, size=8.8, leading=12, max_lines=3) - 5


def page_three(c):
    page_header(c, 3, "Terms, Response and Disclaimers")
    y = PAGE_H - 104
    y = section_title(c, "Terms and conditions", y)

    terms = [
        "Offer price: AED 8,750,000, subject to written acceptance within the stated validity period.",
        "Deposit: AED 875,000, payable through the agreed governed booking and reservation process after acceptance.",
        "Completion timing: Target transfer within 30 calendar days of executed documentation, subject to required approvals.",
        "Property condition: Subject to satisfactory review of title, authority, material property records and agreed inclusions.",
        "Included items: Built-in appliances, fitted wardrobes and fixtures specifically confirmed in the final agreement.",
    ]
    for item in terms:
        y = bullet(c, item, MARGIN, y, CONTENT_W)

    y -= 8
    y = section_title(c, "Response and next steps", y)
    steps = [
        ("1", "Review", "Review the property particulars, commercial terms and stated conditions."),
        ("2", "Respond", "Accept, reject or issue a counteroffer before the validity deadline."),
        ("3", "Record", "NYSA records the exact response and preserves the complete negotiation chain."),
        ("4", "Proceed", "Acceptance moves to the governed booking, reservation and documentation process."),
    ]
    gap = 8
    step_w = (CONTENT_W - gap * 3) / 4
    for idx, (number, title, detail) in enumerate(steps):
        x = MARGIN + idx * (step_w + gap)
        c.setFillColor(CREAM)
        c.roundRect(x, y - 92, step_w, 92, 5, stroke=0, fill=1)
        c.setFillColor(GOLD)
        c.circle(x + 17, y - 18, 10, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + 17, y - 21, number)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 32, y - 21, title)
        paragraph(c, detail, x + 10, y - 42, step_w - 20, size=7.2, leading=10, max_lines=5)

    y -= 116
    y = section_title(c, "Offer validity and non-binding status", y)
    c.setFillColor(CREAM)
    c.roundRect(MARGIN, y - 91, CONTENT_W, 91, 6, stroke=0, fill=1)
    label(c, "Valid until 29 Aug 2026 at 6:00 PM Dubai time", MARGIN + 13, y - 17, NAVY)
    paragraph(
        c,
        "The recipient may accept, reject or issue a counteroffer before the deadline. Unless withdrawn earlier in writing, this offer automatically expires at the stated time.",
        MARGIN + 13,
        y - 35,
        CONTENT_W - 26,
        size=8.2,
        leading=11,
        max_lines=2,
    )
    paragraph(
        c,
        "No MOU or other binding agreement has been executed. Until the required MOU or contract is signed and the governed transaction conditions are completed, this document is for consideration only, does not reserve the property and does not create an obligation to complete. Either party may withdraw, subject to applicable law and any separately executed terms.",
        MARGIN + 13,
        y - 61,
        CONTENT_W - 26,
        size=7.7,
        leading=10,
        max_lines=3,
    )

    y -= 113
    y = section_title(c, "Important notices", y)
    c.setFillColor(PALE)
    c.roundRect(MARGIN, y - 130, CONTENT_W, 130, 6, stroke=0, fill=1)
    notices = [
        "Private and confidential. This document is intended only for the recipient and the transaction parties identified in the CRM record.",
        "NYSA Realty acts as the brokerage facilitator and is not the buyer, seller, landlord or tenant. The relevant transaction parties must agree the commercial terms.",
        "Property particulars, availability and information supplied by third parties must be reconfirmed before commitment. Images in this specimen are illustrative dummy content.",
        "NYSA Realty does not provide legal, tax, valuation or financial advice through this document. Independent professional advice should be obtained where appropriate.",
    ]
    ny = y - 20
    for item in notices:
        ny = bullet(c, item, MARGIN + 12, ny, CONTENT_W - 24)

    y -= 151
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, y, "Revision control")
    y -= 18
    c.setFillColor(CREAM)
    c.roundRect(MARGIN, y - 58, CONTENT_W, 58, 5, stroke=0, fill=1)
    label(c, "Document record", MARGIN + 12, y - 16)
    paragraph(
        c,
        "Offer reference: NYSA-OFR-DEMO-0001 | Revision: 1 | Prepared: 22 Aug 2026, Dubai | Inventory snapshot: DEMO-SNAPSHOT-01 | Status: Layout specimen",
        MARGIN + 12,
        y - 34,
        CONTENT_W - 24,
        size=8,
        leading=11,
        max_lines=2,
    )
    footer(c, 3)
    c.showPage()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("NYSA UAT-065 Expected HNW Offer Layout - Dummy Data")
    c.setAuthor("NYSA CORE UAT documentation")
    c.setSubject("Design specimen only; dummy data; not for transaction use")
    page_one(c)
    page_two(c)
    page_three(c)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
