# PDF dependency blocker verification — 31 October 2026

UI-001 release preparation replaces the vulnerable Puppeteer dependency chain with
`puppeteer-core` 25.16.0 and `@sparticuz/chromium` 153.0.0. The lockfile also updates
the compatible `follow-redirects` and `ip-address` transitive packages. The npm
production dependency audit reports zero advisories for this exact lockfile.

Puppeteer's bundled download recommendation is Chromium 156; the available
Sparticuz release is 153. These are deliberately different version numbers.
Compatibility was tested rather than inferred from equal major numbers: on the
actual cPanel Linux host, an isolated private directory installed the exact
candidate lockfile and rendered all ten existing approved document formats.
All produced valid PDFs. Windows Chrome also passed all ten formats. No approved
template, PDF layout, live application's dependencies or customer document was
changed during this check.

The hosted check copied only renderer sources and templates after verifying
source hashes (text line endings normalized to account for Windows checkout).
Evidence stays privately on the hosting account:
`/home/nysareal/crm-release-preparation/20261031-dev248/ui001-pdf-compat-HZlyuD/RESULT.json`.
The test is synthetic and does not connect to a database or providers.

The same Linux host subsequently generated a baseline/candidate comparison for
all ten formats. The synthetic bundle hash is
`67902db7667ce3831a233f4574618dcaab4dd0a4e129e1ef307e306cd3d1e1f0`.
Poppler renders and text extraction confirmed identical text and page counts
for every format. At 80 dpi, the largest changed-pixel fraction was 0.165%; the
largest average channel difference was 0.064 on a 0–255 scale. Visual inspection
found no reflow, clipping or overlap; the small differences are consistent with
browser antialiasing. Only synthetic comparison PDFs were downloaded for this
check. No customer document or database backup was downloaded.

The dependency regression test now pins this explicitly verified pair instead
of equating the recommended download revision with the supported protocol.
Every final hosted deployment must still run the ten-format smoke check with
the installed package before acceptance. A future dependency update requires
another compatibility check; passing this document's historic result is not
sufficient.
