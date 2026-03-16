#!/usr/bin/env python3
"""Generate TTH Discography Web App Changelog PDF - v2.6.3 to v2.7.0
Brand standards: Dark purple #140038 cover, white interior pages, Poppins only."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Register Poppins - required by brand standards
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_SEMI = "Helvetica-Bold"
try:
    font_paths = [
        os.path.expanduser("~/Library/Fonts"),
        "/Library/Fonts",
        "/System/Library/Fonts",
    ]
    for fp in font_paths:
        reg = os.path.join(fp, "Poppins-Regular.ttf")
        bold = os.path.join(fp, "Poppins-Bold.ttf")
        semi = os.path.join(fp, "Poppins-SemiBold.ttf")
        medium = os.path.join(fp, "Poppins-Medium.ttf")
        if os.path.exists(reg) and os.path.exists(bold):
            pdfmetrics.registerFont(TTFont("Poppins", reg))
            pdfmetrics.registerFont(TTFont("Poppins-Bold", bold))
            if os.path.exists(semi):
                pdfmetrics.registerFont(TTFont("Poppins-SemiBold", semi))
            else:
                pdfmetrics.registerFont(TTFont("Poppins-SemiBold", bold))
            if os.path.exists(medium):
                pdfmetrics.registerFont(TTFont("Poppins-Medium", medium))
            else:
                pdfmetrics.registerFont(TTFont("Poppins-Medium", reg))
            FONT_REGULAR = "Poppins"
            FONT_BOLD = "Poppins-Bold"
            FONT_SEMI = "Poppins-SemiBold"
            break
except Exception:
    pass

# Brand colors
DARK_PURPLE = HexColor("#140038")
TEXT_DARK = HexColor("#1a1a1a")
TEXT_BODY = HexColor("#333333")
TEXT_MUTED = HexColor("#666666")
TEXT_WHITE = HexColor("#ffffff")
ACCENT_PURPLE = HexColor("#2d0066")
RULE_COLOR = HexColor("#cccccc")
LIGHT_PURPLE = HexColor("#f0ecf5")

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "TTH Discography Web App - Changelog v2.6.3 to v2.7.0.pdf")

# --- Styles (white page context) ---
styles = {
    # Cover page styles
    "cover_title": ParagraphStyle(
        "cover_title", fontName=FONT_BOLD, fontSize=30, leading=36,
        textColor=TEXT_WHITE, alignment=TA_CENTER,
    ),
    "cover_subtitle": ParagraphStyle(
        "cover_subtitle", fontName=FONT_SEMI, fontSize=16, leading=22,
        textColor=HexColor("#c8a84e"), alignment=TA_CENTER,
    ),
    "cover_meta": ParagraphStyle(
        "cover_meta", fontName=FONT_REGULAR, fontSize=11, leading=16,
        textColor=HexColor("#b0a0c8"), alignment=TA_CENTER,
    ),
    # Interior page styles
    "version_major": ParagraphStyle(
        "version_major", fontName=FONT_BOLD, fontSize=22, leading=28,
        textColor=DARK_PURPLE, spaceAfter=2,
    ),
    "version_tagline": ParagraphStyle(
        "version_tagline", fontName=FONT_SEMI, fontSize=12, leading=16,
        textColor=ACCENT_PURPLE, spaceAfter=14,
    ),
    "section_header": ParagraphStyle(
        "section_header", fontName=FONT_BOLD, fontSize=12, leading=17,
        textColor=DARK_PURPLE, spaceBefore=16, spaceAfter=6,
    ),
    "bullet": ParagraphStyle(
        "bullet", fontName=FONT_REGULAR, fontSize=10, leading=15,
        textColor=TEXT_BODY, leftIndent=18, spaceAfter=4,
        bulletIndent=6, bulletFontName=FONT_REGULAR, bulletFontSize=10,
        bulletColor=DARK_PURPLE,
    ),
    "sub_bullet": ParagraphStyle(
        "sub_bullet", fontName=FONT_REGULAR, fontSize=9.5, leading=14,
        textColor=TEXT_MUTED, leftIndent=36, spaceAfter=3,
        bulletIndent=24, bulletFontName=FONT_REGULAR, bulletFontSize=9.5,
        bulletColor=TEXT_MUTED,
    ),
    "version_minor": ParagraphStyle(
        "version_minor", fontName=FONT_BOLD, fontSize=16, leading=22,
        textColor=DARK_PURPLE, spaceAfter=2,
    ),
    "minor_tagline": ParagraphStyle(
        "minor_tagline", fontName=FONT_SEMI, fontSize=10, leading=14,
        textColor=ACCENT_PURPLE, spaceAfter=10,
    ),
}


def draw_cover(canvas, doc):
    """Dark purple cover page."""
    canvas.saveState()
    canvas.setFillColor(DARK_PURPLE)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.restoreState()


def draw_interior(canvas, doc):
    """White interior pages with subtle footer."""
    canvas.saveState()
    # White background (default, but explicit)
    canvas.setFillColor(white)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    # Thin purple accent line at top
    canvas.setStrokeColor(DARK_PURPLE)
    canvas.setLineWidth(2)
    canvas.line(0.75 * inch, letter[1] - 0.5 * inch, letter[0] - 0.75 * inch, letter[1] - 0.5 * inch)
    # Footer
    canvas.setFont(FONT_REGULAR, 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(
        letter[0] / 2, 0.45 * inch,
        "TTH Podcast Series  -  Discography Web App  -  Changelog v2.6.3 to v2.7.0"
    )
    # Page number
    canvas.drawRightString(
        letter[0] - 0.75 * inch, 0.45 * inch,
        f"{doc.page}"
    )
    canvas.restoreState()


def hr():
    return HRFlowable(width="100%", thickness=0.5, color=RULE_COLOR, spaceAfter=12, spaceBefore=8)


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
    )

    story = []

    # ===== COVER PAGE (Dark Purple #140038) =====
    story.append(Spacer(1, 2.4 * inch))
    story.append(Paragraph("TTH Discography Web App", styles["cover_title"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Changelog", styles["cover_title"]))
    story.append(Spacer(1, 30))
    story.append(Paragraph("v2.6.3  to  v2.7.0", styles["cover_subtitle"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph("March 15, 2026", styles["cover_meta"]))
    story.append(Spacer(1, 50))
    story.append(Paragraph("TTH Podcast Series  -  Complete Discography v6.0", styles["cover_meta"]))
    story.append(PageBreak())

    # ===== v2.7.0 (White interior) =====
    story.append(Paragraph("v2.7.0", styles["version_major"]))
    story.append(Paragraph("Solo Records &amp; Side Projects - New Sections + Full Cover Art", styles["version_tagline"]))
    story.append(hr())

    # New Content
    story.append(Paragraph("New Content", styles["section_header"]))
    story.append(Paragraph(
        "Added <b>Solo Records</b> section featuring 15 releases spanning all five members of The Tragically Hip:",
        styles["bullet"], bulletText="\u2022"
    ))
    for line in [
        "<b>Gord Downie</b> (9 albums): Coke Machine Glow (2001), Battle of the Nudes (2003), The Grand Bounce (2010), And the Conquering Sun (2014), Secret Path (2016), Introduce Yerself (2017), Away Is Mine (2020), Lustre Parfait (2023), Live at 6 O'Clock (2026)",
        "<b>Paul Langlois</b> (3 albums): Fix This Head (2010), Not Guilty (2013), Smooth Rock Falls (2026)",
        "<b>Gord Sinclair</b> (2 albums): Taxi Dancers (2020), In Continental Drift (2023)",
        "<b>Johnny Fay</b> (1 EP): Mercury Sea (2025)",
    ]:
        story.append(Paragraph(line, styles["sub_bullet"], bulletText="-"))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Added <b>Side Projects</b> section featuring 4 releases:",
        styles["bullet"], bulletText="\u2022"
    ))
    for line in [
        "<b>Stripper's Union / Rob Baker</b> (3 albums): Stripper's Union Local 518 (2006), The Deuce (2011), The Undertaking (2021)",
        "<b>Paul Langlois Band</b> (1 album): Guess What (2023)",
    ]:
        story.append(Paragraph(line, styles["sub_bullet"], bulletText="-"))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Each entry includes year, label, producer (where known), artist credit, and a custom description",
        styles["bullet"], bulletText="\u2022"
    ))
    story.append(Paragraph(
        "Solo and Side Project sections accessible via new nav tabs alongside existing categories",
        styles["bullet"], bulletText="\u2022"
    ))

    # Cover Art
    story.append(Paragraph("Cover Art", styles["section_header"]))
    story.append(Paragraph(
        "Added actual album cover art for 18 of 19 solo and side project entries, replacing gradient placeholders:",
        styles["bullet"], bulletText="\u2022"
    ))
    story.append(Paragraph(
        "Coke Machine Glow, Battle of the Nudes, The Grand Bounce, And the Conquering Sun, Secret Path, "
        "Introduce Yerself, Away Is Mine, Lustre Parfait, Live at 6 O'Clock, Fix This Head, Not Guilty, "
        "Taxi Dancers, Smooth Rock Falls, Mercury Sea, Local 518, The Deuce, The Undertaking, Guess What",
        styles["sub_bullet"], bulletText="-"
    ))
    story.append(Paragraph(
        "In Continental Drift retains gradient fallback (cover art pending)",
        styles["bullet"], bulletText="\u2022"
    ))
    story.append(Paragraph(
        "All images stored in assets/solo-projects/",
        styles["bullet"], bulletText="\u2022"
    ))

    # Data Source
    story.append(Paragraph("Data Source", styles["section_header"]))
    story.append(Paragraph(
        "Discography dataset updated to match TTH Podcast Series Complete Discography v6.0 (appendix: Solo Records &amp; Side Projects)",
        styles["bullet"], bulletText="\u2022"
    ))

    # File Structure
    story.append(Paragraph("File Structure", styles["section_header"]))
    story.append(Paragraph(
        "New folder: assets/solo-projects/ containing 18 cover art images",
        styles["bullet"], bulletText="\u2022"
    ))
    story.append(Paragraph(
        "Reorganized existing cover art into subfolders: studio-albums, live-albums, compilations, box-sets, eps, video-albums",
        styles["bullet"], bulletText="\u2022"
    ))

    story.append(hr())
    story.append(Spacer(1, 8))

    # ===== v2.6.3 =====
    story.append(Paragraph("v2.6.3", styles["version_minor"]))
    story.append(Paragraph("UI Polish", styles["minor_tagline"]))
    story.append(Paragraph(
        "Album vote breakdown now alternates gold and red text for voted songs, improving readability across cards",
        styles["bullet"], bulletText="\u2022"
    ))
    story.append(Paragraph(
        "Progress bars in the breakdown section restored to solid gold",
        styles["bullet"], bulletText="\u2022"
    ))

    story.append(hr())
    story.append(Spacer(1, 6))

    # ===== v2.6.2 =====
    story.append(Paragraph("v2.6.2", styles["version_minor"]))
    story.append(Paragraph("Data Accuracy &amp; Badge Colors", styles["minor_tagline"]))
    for item in [
        'Fixed "Buy at TheHip.com" button to link to thehip.com/pages/listen',
        "Track ranking badges now use two colors: gold for the Top 40 (#1-40) and red for #41-169",
        "Fixed Music @ Work chart position to #1 (was incorrectly unmarked)",
        "Fixed In Violet Light chart position to #2 (was incorrectly marked #1)",
        "Updated Canadian #1 albums count from 8 to 9",
        "Corrected Up to Here tracklist - removed EP tracks (Highway Girl, I'm a Werewolf Baby), added missing album tracks (Another Midnight, Opiated)",
        'Fixed #47 from "Dusk" to "Thugs"',
        'Fixed "Honey Please" spelling to "Honey, Please"',
        'Fixed Live at the Roxy track name to "I\'ll Believe in You"',
    ]:
        story.append(Paragraph(item, styles["bullet"], bulletText="\u2022"))

    story.append(hr())
    story.append(Spacer(1, 6))

    # ===== v2.6.1 =====
    story.append(Paragraph("v2.6.1", styles["version_minor"]))
    story.append(Paragraph("TTH Top 40 Expansion &amp; TheHip.com", styles["minor_tagline"]))
    for item in [
        "Added all 169 voted songs from the fan countdown (previously only Top 40)",
        "Ranking badges now appear on every voted track across all album pages",
        'Added collapsible "The Full 169" section showing songs #41-169 with point totals',
        "Added Album Vote Breakdown - visual cards showing which albums had the most voted songs, with voted/unvoted track lists and percentage bars",
        'Added "Buy at TheHip.com" pill button on every album modal, linking out in a new tab',
        'Apple Music "Open in Apple Music" buttons added to album modals and Random Hip Song results',
    ]:
        story.append(Paragraph(item, styles["bullet"], bulletText="\u2022"))

    story.append(hr())
    story.append(Spacer(1, 6))

    # ===== v2.6.0 =====
    story.append(Paragraph("v2.6.0", styles["version_minor"]))
    story.append(Paragraph("Apple Music, Spotify Fixes &amp; Deployment", styles["minor_tagline"]))
    for item in [
        "Deployed app to GitHub Pages at tthpodcastseries.github.io for permanent HTTPS hosting",
        "Added GitHub Actions workflow for automatic deployment on push",
        "Added Apple Music link buttons on album modals (pink pill, opens Apple Music)",
        "Added Apple Music link on Random Hip Song results",
        "Fixed Spotify OAuth - redirect URI updated from localhost to GitHub Pages URL",
        "Fixed Spotify auth persistence - switched from sessionStorage to localStorage so login survives page reloads",
        'Added "Requires Spotify Premium" note under the Connect Spotify button',
        "Removed red single indicator dots from track listings (cleaner look)",
        "Updated version to v5.6 in footer",
    ]:
        story.append(Paragraph(item, styles["bullet"], bulletText="\u2022"))

    # Build
    doc.build(story, onFirstPage=draw_cover, onLaterPages=draw_interior)
    print(f"PDF saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_pdf()
