from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path(r"C:\Users\ajitr\OneDrive\Desktop\nysa-pocket-ledger\canonical-worktree\outputs\NYSA_CORE_UAT062_Single_Source_Business_Classification_Remediation_Spec.docx")

NAVY = "17365D"
BLUE = "2E74B5"
DARK_BLUE = "1F4D78"
INK = "202124"
MUTED = "5F6368"
LIGHT = "F2F4F7"
PALE_BLUE = "E8EEF5"
PALE_GOLD = "FFF4D6"
PALE_RED = "FDECEC"
PALE_GREEN = "EAF4EC"
WHITE = "FFFFFF"
BORDER = "CBD2D9"


def set_font(run, size=11, bold=False, italic=False, color=INK, name="Calibri"):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rpr.rFonts.set(qn("w:ascii"), name)
    rpr.rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    return run


def shade(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = tcpr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tcpr.append(shd)
    shd.set(qn("w:fill"), fill)


def cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tcpr = cell._tc.get_or_add_tcPr()
    tc_mar = tcpr.find(qn("w:tcMar"))
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tcpr.append(tc_mar)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def table_geometry(table, widths, indent=120):
    total = sum(widths)
    table.autofit = False
    tblpr = table._tbl.tblPr
    tblw = tblpr.find(qn("w:tblW"))
    if tblw is None:
        tblw = OxmlElement("w:tblW")
        tblpr.append(tblw)
    tblw.set(qn("w:w"), str(total))
    tblw.set(qn("w:type"), "dxa")
    tblind = tblpr.find(qn("w:tblInd"))
    if tblind is None:
        tblind = OxmlElement("w:tblInd")
        tblpr.append(tblind)
    tblind.set(qn("w:w"), str(indent))
    tblind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        trpr = row._tr.get_or_add_trPr()
        if trpr.find(qn("w:cantSplit")) is None:
            cant_split = OxmlElement("w:cantSplit")
            cant_split.set(qn("w:val"), "true")
            trpr.append(cant_split)
        for index, cell in enumerate(row.cells):
            width = widths[index]
            tcpr = cell._tc.get_or_add_tcPr()
            tcw = tcpr.find(qn("w:tcW"))
            if tcw is None:
                tcw = OxmlElement("w:tcW")
                tcpr.append(tcw)
            tcw.set(qn("w:w"), str(width))
            tcw.set(qn("w:type"), "dxa")
            cell.width = Inches(width / 1440)
            cell_margins(cell)


def repeat_header(row):
    trpr = row._tr.get_or_add_trPr()
    if trpr.find(qn("w:tblHeader")) is None:
        node = OxmlElement("w:tblHeader")
        node.set(qn("w:val"), "true")
        trpr.append(node)


def add_page_field(paragraph):
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    paragraph._p.append(field)


def add_label(doc, label, value, after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.1
    set_font(p.add_run(label + ": "), bold=True, color=NAVY)
    set_font(p.add_run(value))
    return p


def add_callout(doc, title, text, fill=PALE_GOLD):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table_geometry(table, [9360])
    cell = table.cell(0, 0)
    shade(cell, fill)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.1
    set_font(p.add_run(title + "\n"), bold=True, color=NAVY)
    set_font(p.add_run(text))
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(1)


def add_bullet(doc, text, bold_lead=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_lead and text.startswith(bold_lead):
        set_font(p.add_run(bold_lead), bold=True, color=NAVY)
        set_font(p.add_run(text[len(bold_lead):]))
    else:
        set_font(p.add_run(text))
    return p


def add_matrix(doc, headers, rows, widths, font_size=9.0):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.style = "Table Grid"
    for index, header in enumerate(headers):
        shade(table.rows[0].cells[index], NAVY)
        p = table.rows[0].cells[index].paragraphs[0]
        set_font(p.add_run(header), size=9.2, bold=True, color=WHITE)
    repeat_header(table.rows[0])
    for row_index, row in enumerate(rows):
        cells = table.add_row().cells
        if row_index % 2:
            for cell in cells:
                shade(cell, LIGHT)
        for index, value in enumerate(row):
            cells[index].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            p = cells[index].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            set_font(p.add_run(value), size=font_size)
    table_geometry(table, widths)
    return table


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.header_distance = Inches(0.492)
section.footer_distance = Inches(0.492)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Calibri"
normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
normal.font.size = Pt(11)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.1

for name, size, color, before, after in (
    ("Heading 1", 16, BLUE, 16, 8),
    ("Heading 2", 13, BLUE, 12, 6),
    ("Heading 3", 12, DARK_BLUE, 8, 4),
):
    style = styles[name]
    style.font.name = "Calibri"
    style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.keep_with_next = True

list_style = styles["List Bullet"]
list_style.font.name = "Calibri"
list_style.font.size = Pt(11)
list_style.paragraph_format.left_indent = Inches(0.5)
list_style.paragraph_format.first_line_indent = Inches(-0.25)
list_style.paragraph_format.space_after = Pt(8)
list_style.paragraph_format.line_spacing = 1.167

header = section.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.LEFT
set_font(header.add_run("NYSA CORE | UAT-062 Remediation Specification"), size=9, bold=True, color=MUTED)
footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
set_font(footer.add_run("Owner-approved direction | Draft for implementation | "), size=9, color=MUTED)
add_page_field(footer)

# memo_masthead pattern using the standard_business_brief preset.
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(8)
p.paragraph_format.space_after = Pt(4)
set_font(p.add_run("REMEDIATION SPECIFICATION"), size=22, bold=True, color=NAVY)
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(16)
set_font(p.add_run("UAT-062: Single-Source Business Classification"), size=14, color=MUTED)
add_label(doc, "System", "NYSA CORE CRM Test")
add_label(doc, "Deployment baseline", "2.1.0-dev.158")
add_label(doc, "Verified package SHA-256", "5b6a50ec7bbc13fb7583c9247187fd1fdd09c29870525e508fbeaf8bb98bb8ce")
add_label(doc, "Prepared", "22 August 2026")
add_label(doc, "Status", "OWNER DIRECTION RECORDED; IMPLEMENTATION AND CRM TEST RETEST NOT STARTED")

add_callout(
    doc,
    "Approved direction",
    "All impacted screens, services, validations, integrations, database constraints, reports and downstream translations must refer to one versioned canonical classification catalogue. No duplicated dropdown list, code constant, route-local array, AI enum or database value list may remain an alternative source of truth.",
    PALE_GREEN,
)
add_callout(
    doc,
    "Control boundary",
    "This specification records the required correction. It does not authorize a deployment or data migration and does not mark UAT-062 fixed or passed. Market-stage and property-segment value sets, catalogue-maintenance authority and historical-report restatement remain explicit owner/governance decisions.",
    PALE_GOLD,
)

doc.add_heading("1. Purpose", level=1)
doc.add_paragraph(
    "The purpose of this specification is to eliminate the multiple competing meanings and sources currently attached to Business type, Business line and Transaction type. It defines one canonical source, the required downstream mappings, the complete impact boundary and the evidence needed before the correction may be accepted."
)

doc.add_heading("2. Confirmed dev.158 footprint", level=1)
add_label(doc, "Search result", "157 relevant code/schema lines across 28 runtime or migration files")
add_label(doc, "Functional scope", "13 business functions")
add_label(doc, "Exact-list duplication", "11 independent copies or constraints of Sale, Rental, Off-plan and Commercial")
add_label(doc, "Additional vocabularies", "Website AI subset; Offer types; Deal types; document-compliance families")
doc.add_paragraph(
    "This is a confirmed architectural spread, not a confirmed RCA for every individual UAT symptom. Each affected path must still be tested after implementation."
)

doc.add_heading("3. Current sources that must be retired or converted", level=1)
source_rows = [
    ("Browser", "BUSINESS_TYPES", "Sale/Rental/Off-plan/Commercial", "Delete as a value authority; populate controls from catalogue API."),
    ("Server CRM domain", "BUSINESS_TYPES", "Same four values", "Replace validation with canonical catalogue/version lookup."),
    ("Lead schema", "leads.business_type CHECK", "Same four values", "Migrate to canonical objective/dimension references; preserve legacy value."),
    ("Route-local validation", "Inline arrays", "Same four values", "Remove; call shared validation service."),
    ("Structured Requirement", "lead_requirements.business_line", "Unrestricted nonblank text", "Persist canonical codes/version; prohibit invented free text."),
    ("Routing", "routing_rules.business_type", "Text plus separate validation", "Reference versioned classification/routing dimensions."),
    ("Qualification", "qualification_models.business_line", "Text/null plus API validation", "Scope models using canonical dimension/value IDs."),
    ("Opportunity", "transaction_type", "Separate four-value constant and CHECK", "Use derived transaction mapping from canonical objective."),
    ("Inventory", "transaction_types[]", "Separate constant and array CHECK", "Use canonical offering/authority values and mappings."),
    ("AI schema", "businessLine enum", "Hard-coded four-value enum", "Generate schema from active catalogue version."),
    ("Website AI routing", "Determined result", "Sale or Off-plan only", "Return proposed canonical dimensions with governed review."),
    ("Offer", "offer_type", "purchase/rental/off_plan/commercial", "Retain only as an explicit mapped downstream vocabulary."),
    ("Deal", "deal_type", "sale/rental/off_plan/commercial_sale/commercial_rental", "Retain only as an explicit mapped downstream vocabulary."),
    ("Compliance", "transaction family", "sale/lease", "Resolve only through a versioned Deal-to-family mapping."),
]
add_matrix(doc, ("Layer", "Current source", "Current values/behaviour", "Required treatment"), source_rows, [1300, 2250, 2450, 3360], 8.6)

doc.add_heading("4. Target single-source architecture", level=1)
add_callout(
    doc,
    "Canonical rule",
    "A code or permitted combination is valid only when it exists in the effective canonical catalogue version. Browser controls and external schemas are projections of that source; they are never independent definitions.",
    PALE_BLUE,
)

for label, text in (
    ("Catalogue version", "Immutable version identifier, status, approved/effective dates and superseded version."),
    ("Dimension", "Stable dimension code, such as customer objective, derived transaction, market stage and property segment."),
    ("Value", "Stable immutable code, versioned label/help text, active/retired status, sort order and applicability."),
    ("Combination", "Explicitly allowed, disallowed or review-required combinations with a reason code."),
    ("Mapping", "Versioned conversion from canonical dimensions to routing, Opportunity, Inventory, Offer, Deal, compliance and external integration codes."),
    ("Evidence", "Catalogue version, mapping code and decision reason stored with every derived or overridden result."),
):
    add_label(doc, label, text)

doc.add_heading("4.1 Authoritative data flow", level=2)
flow = (
    "Approved catalogue version -> catalogue read API -> Lead/Requirement controls -> shared server validation -> "
    "canonical IDs/codes persisted with version -> explicit downstream mapping -> routing/matching/Opportunity/Offer/Deal/reporting evidence"
)
add_callout(doc, "Required flow", flow, PALE_BLUE)

doc.add_heading("4.2 Failure behaviour", level=2)
for text in (
    "Unknown, retired or unmapped values must be rejected with a business-readable reason.",
    "Ambiguous legacy records must enter a governed exception queue; the system must not guess.",
    "An unavailable catalogue service must fail closed for writes and may use a version-pinned cache for reads only when integrity is proven.",
    "A mapping change creates a new catalogue/mapping version; it must not mutate historical transaction evidence.",
):
    add_bullet(doc, text)

doc.add_heading("5. Canonical classification structure", level=1)
classification_rows = [
    ("Customer objective", "Owner confirmed", "Buy a property; Sell my property; Rent a property; Rent out my property; Not yet confirmed", "Lead form branch, Customer role preparation and qualification context"),
    ("Derived transaction", "Owner confirmed", "Sale from Buy/Sell; Rental from Rent/Rent out; none while unconfirmed", "Routing/transaction compatibility; not a manually entered Lead field"),
    ("Market stage", "Pending value-set confirmation", "No values assumed by this specification", "Buy/Rent preference; for Sell/Rent out obtain from linked Inventory"),
    ("Property segment", "Pending value-set confirmation", "No values assumed by this specification", "Buy/Rent preference; for Sell/Rent out obtain from linked Inventory"),
    ("Representation", "Existing governed field", "Buyer/Tenant; Seller/Landlord; Dual", "Opportunity authority and disclosure; remains separate from classification"),
]
add_matrix(doc, ("Dimension", "Decision status", "Permitted values", "Use"), classification_rows, [1550, 1800, 2850, 3160], 8.8)

doc.add_heading("6. Complete impacted-function remediation matrix", level=1)
impact_rows = [
    ("Lead capture", "Mixed mandatory field and three independent constraints", "Render canonical objective/stage/segment controls; persist catalogue version and legacy evidence", "Create Buyer, Seller, Tenant and Landlord Leads; reject retired/unknown codes"),
    ("Lead routing", "Matches source + mixed type + area", "Use approved canonical routing dimensions and versioned mappings", "Specific and fallback rules produce documented destinations for every approved combination"),
    ("Website intake", "Four-value payload; AI determines only Sale/Off-plan", "Version payload; validate declared dimensions; send AI proposals through governed review", "All supported objectives continue correctly; ambiguous input queues for review"),
    ("Customer roles", "Rental -> tenant; most others -> buyer/investor", "Derive role from explicit objective; do not infer seller/landlord from segment/stage", "Seller and landlord roles are created only from explicit objective"),
    ("Qualification", "Original Lead type selects questionnaire", "Select objective-specific/current-confirmed model through catalogue scope", "Buyer and Seller use separate approved questionnaires; prior contact prerequisite is enforced"),
    ("Structured Requirements", "Same UI list but separately stored free text", "Consume canonical catalogue; branch Buyer/Tenant search versus Seller/Landlord Inventory facts", "No free text; new version records source, catalogue version and confirmation"),
    ("Inventory", "Separate multi-select four-value array", "Reference canonical offering/authority codes and explicit transaction mapping", "Inventory remains selectable across valid stage/segment combinations"),
    ("Matching", "Exact mixed-string mismatch can hard-exclude", "Hard-gate only approved operational incompatibilities; use stage/segment as approved ranking or gates", "Above-budget and near-fit properties are not excluded by classification confusion"),
    ("Opportunity", "Separate four-value transaction field", "Default from canonical derived transaction; override only by approved governed rule", "Requirement, representation and Inventory remain reconciled with visible reason"),
    ("Offer", "Separate purchase/rental/off_plan/commercial type", "Generate through versioned canonical-to-Offer mapping", "Every canonical combination maps once or visibly requires review"),
    ("Deal", "Commercial split occurs only at Deal stage", "Generate through versioned Offer/canonical-to-Deal mapping", "Correct parties, approvals, closure and Inventory outcome for commercial sale/rental"),
    ("Documents/proposals/AI", "Requirement business line drives content and AI enum", "Use canonical fields and mapping version; generate AI schema from catalogue", "Correct seller/buyer content; no stale hard-coded enum survives"),
    ("Dashboards/reporting", "Lead type used as mutually exclusive business line", "Report objective, derived transaction, market stage and segment independently", "Combination totals reconcile; legacy and current classification are distinguishable"),
]
add_matrix(doc, ("Function", "Current dependency", "Required correction", "Minimum acceptance evidence"), impact_rows, [1350, 2400, 2950, 2660], 8.25)

doc.add_heading("7. Data migration and compatibility", level=1)
for label, text in (
    ("Preserve", "Original Lead, Requirement, Inventory and Opportunity values, their source record and timestamps remain immutable audit evidence."),
    ("Auto-map", "Only values whose objective and other dimensions are unambiguous from authoritative evidence may be mapped automatically."),
    ("Review queue", "Legacy Off-plan, Commercial, contradictions and missing source evidence require governed review; no silent default."),
    ("Historical Offers/Deals", "Do not rewrite accepted/terminal evidence. Associate legacy mappings separately when required for reporting."),
    ("Reporting", "Do not restate historical dashboards unless the owner separately approves the restatement basis and effective period."),
    ("Rollback", "Catalogue and mappings are versioned; rollback selects the prior approved version without deleting the rejected version or migrated evidence."),
):
    add_label(doc, label, text)

doc.add_heading("8. API, UI and validation contract", level=1)
api_rows = [
    ("Read catalogue", "Returns version, dimensions, active values, labels, combinations and mappings permitted for the caller/context."),
    ("Write business record", "Requires canonical codes/IDs and expected catalogue version; server revalidates and rejects stale/retired values."),
    ("Render dropdown", "UI displays labels returned by API; no embedded business list or fallback value array."),
    ("AI schema", "Generated from a pinned catalogue version; response records that version and remains a suggestion pending human review."),
    ("External intake", "Contract carries schema/catalogue version; compatibility adapter translates only documented legacy values."),
    ("Audit", "Stores actor, source, canonical values, catalogue version, mapping reason and override evidence without private content."),
]
add_matrix(doc, ("Contract", "Required behaviour"), api_rows, [2200, 7160], 9.5)

doc.add_heading("9. Automated and human acceptance gates", level=1)
doc.add_heading("9.1 Structural regression gates", level=2)
for text in (
    "A repository test fails when a production path introduces another hard-coded classification list.",
    "Browser, API, AI schema, database validation and integrations return/use the same catalogue version.",
    "Every mapping is total for approved combinations or returns an explicit review-required code.",
    "Retired values cannot be selected for new records but remain readable on historical records.",
):
    add_bullet(doc, text)

doc.add_heading("9.2 End-to-end business scenarios", level=2)
scenario_rows = [
    ("Buy", "Ready", "Residential", "Buyer qualification -> search requirements -> ranked Inventory -> Sale Opportunity"),
    ("Buy", "Off-plan", "Residential", "Buyer qualification -> off-plan preference -> mapped Inventory -> Sale/Off-plan downstream mapping"),
    ("Sell", "Inventory-derived", "Residential", "Seller qualification -> linked Inventory facts -> seller authority -> Sale Opportunity"),
    ("Rent", "Ready", "Residential", "Tenant qualification -> search requirements -> Rental Opportunity"),
    ("Rent out", "Inventory-derived", "Residential", "Landlord qualification -> linked Inventory -> landlord authority -> Rental Opportunity"),
    ("Buy/Sell", "Ready or off-plan", "Commercial", "Commercial combination retains sale/rental direction and obtains correct Deal approval"),
    ("Ambiguous legacy", "Off-plan/Commercial", "Unknown", "Migration creates review item and preserves original values; no guessed conversion"),
]
add_matrix(doc, ("Objective", "Stage", "Segment", "Required proof"), scenario_rows, [1200, 1450, 1450, 5260], 8.9)

doc.add_heading("9.3 Human CRM Test closure", level=2)
for text in (
    "The user confirms every affected control reads the same approved labels and combinations.",
    "Seller/Landlord qualification differs from Buyer/Tenant qualification and cannot precede recorded Customer contact.",
    "Structured Requirements branch correctly and do not request buyer-search fields for Seller/Landlord Inventory.",
    "Matching explains ranking and operational blocks separately; no valid Inventory is excluded by the retired mixed taxonomy.",
    "Reports reconcile the independent dimensions and identify legacy classification separately.",
):
    add_bullet(doc, text)

doc.add_heading("10. Implementation sequence and control points", level=1)
sequence = [
    ("1", "Owner decisions", "Confirm remaining value sets, maintenance authority and historical-report policy."),
    ("2", "Canonical catalogue", "Implement versioned source, approval lifecycle, read API and shared validation."),
    ("3", "Persistence/migration", "Add canonical references/version fields; preserve legacy fields; populate exception queue."),
    ("4", "Consumer conversion", "Convert all 13 functions and remove 11 duplicated exact-list definitions."),
    ("5", "Compatibility", "Add explicit mappings for Offer, Deal, compliance and supported external contracts."),
    ("6", "Automated gates", "Run unit, contract, migration, database and complete regression suites."),
    ("7", "CRM Test UAT", "Deploy only through approval; perform one complete human round and record each result."),
]
add_matrix(doc, ("Step", "Workstream", "Exit condition"), sequence, [800, 2300, 6260], 9.3)

doc.add_heading("11. Open owner/governance decisions", level=1)
open_rows = [
    ("Market-stage value set", "Pending", "No value set inferred in this specification."),
    ("Property-segment value set", "Pending", "No value set inferred in this specification."),
    ("Catalogue maintenance authority", "Pending", "Choose governed Administrator lifecycle or controlled migration/release ownership."),
    ("Historical dashboard restatement", "Pending", "Choose no restatement or approve an explicit basis/effective period."),
    ("Operational hard-gate list", "Pending", "Confirm which incompatibilities block versus affect ranking/explanation only."),
]
add_matrix(doc, ("Decision", "Status", "Control"), open_rows, [2600, 1200, 5560], 9.4)

doc.add_heading("12. Documentation and status record", level=1)
add_label(doc, "UAT item", "UAT-062")
add_label(doc, "Issue status", "Confirmed data-model and terminology defect")
add_label(doc, "Owner direction", "Single canonical source required across all impacted places")
add_label(doc, "Implementation status", "Not started")
add_label(doc, "Deployment status", "No correction deployed; CRM Test remains on 2.1.0-dev.158")
add_label(doc, "Retest status", "Pending corrected-model implementation and user-observed CRM Test result")

doc.add_heading("Appendix A. Exact dev.158 file impact inventory", level=1)
files = [
    ("UI", "public/app.js; public/dashboard-ui.js"),
    ("Core/domain", "src/crm-domain.js; src/opportunity-domain.js; src/offer-domain.js; src/deal-domain.js; src/document-compliance-domain.js"),
    ("AI/matching", "src/ai-service.js; src/ai-domain.js; src/admin-governance.js; src/inventory-eligibility-domain.js; src/governed-matching-domain.js; src/requirement-confirmation-domain.js"),
    ("Intelligence/reporting", "src/customer-intelligence-domain.js; src/dashboard-domain.js; src/proposal-pdf.js"),
    ("Services/routes", "src/website-ai-routing.js; src/routing-service.js; src/routes/ai.js; src/routes/crm.js; src/routes/files-proposals.js; src/routes/lead-operations.js; src/routes/governed-matching.js; src/routes/dashboards.js; src/routes/qualification-finance.js; src/routes/website-intake.js"),
    ("Schema/migrations", "src/migrations/005_lead_operations.sql; 006_qualification_and_finance.sql; 008_dashboards_reporting.sql; 010_role_dashboard_rebuild.sql; 077_release3b_requirement_confirmation.sql; 092_release3b_matching_completion.sql; plus Lead, Opportunity, Offer and Deal value constraints in their foundation migrations"),
]
add_matrix(doc, ("Category", "Confirmed impacted files"), files, [2100, 7260], 9.0)

doc.add_heading("Appendix B. Evidence control", level=1)
doc.add_paragraph(
    "The impact audit was performed against the extracted deterministic dev.158 package. Documentation and tests outside the runtime package were excluded from the 28-file count. No credentials, sessions, private Customer/contact information or external service was accessed. Property Finder remains excluded and disabled."
)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.core_properties.title = "NYSA CORE UAT-062 Single-Source Business Classification Remediation Specification"
doc.core_properties.subject = "Owner-confirmed remediation scope for centralized business classification"
doc.core_properties.author = ""
doc.core_properties.last_modified_by = ""
doc.core_properties.keywords = "NYSA CORE, UAT-062, classification, single source, remediation"
doc.save(OUT)
print(f"created {OUT}")
