import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'TTH Discography Web App - Changelog v2.7-v2.7.3.pdf')

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    leftMargin=0.9*inch,
    rightMargin=0.9*inch,
    topMargin=0.8*inch,
    bottomMargin=0.7*inch,
)

# Colors
dark = HexColor("#1a1a2e")
mid = HexColor("#16213e")
accent = HexColor("#e94560")
muted = HexColor("#666666")
body_color = HexColor("#2d2d2d")
light_bg = HexColor("#f0f0f5")

# Styles
title_style = ParagraphStyle(
    "Title", fontName="Helvetica-Bold", fontSize=22, textColor=dark,
    spaceAfter=4, alignment=TA_LEFT, leading=26
)
subtitle_style = ParagraphStyle(
    "Subtitle", fontName="Helvetica", fontSize=10, textColor=muted,
    spaceAfter=20, alignment=TA_LEFT
)
version_style = ParagraphStyle(
    "Version", fontName="Helvetica-Bold", fontSize=14, textColor=accent,
    spaceBefore=24, spaceAfter=2, leading=18
)
version_sub = ParagraphStyle(
    "VersionSub", fontName="Helvetica-Oblique", fontSize=9, textColor=muted,
    spaceAfter=12
)
section_style = ParagraphStyle(
    "Section", fontName="Helvetica-Bold", fontSize=10.5, textColor=mid,
    spaceBefore=14, spaceAfter=6, leading=14
)
bullet_style = ParagraphStyle(
    "Bullet", fontName="Helvetica", fontSize=9, textColor=body_color,
    leftIndent=16, bulletIndent=6, spaceAfter=3, leading=13,
    bulletFontName="Helvetica", bulletFontSize=9
)
sub_bullet_style = ParagraphStyle(
    "SubBullet", fontName="Helvetica", fontSize=8.5, textColor=HexColor("#555555"),
    leftIndent=32, bulletIndent=22, spaceAfter=2, leading=12,
    bulletFontName="Helvetica", bulletFontSize=8.5
)

story = []

# Title
story.append(Paragraph("TTH Discography Web App", title_style))
story.append(Paragraph("Changelog  -  v2.7 through v2.7.3", subtitle_style))
story.append(HRFlowable(width="100%", thickness=1.5, color=accent, spaceAfter=16))

# --- v2.7 ---
story.append(Paragraph("v2.7 - UI/UX Audit", version_style))
story.append(Paragraph("March 15, 2026  -  36 findings fixed (5 Critical, 10 Major, 14 Minor, 7 Polish)", version_sub))

sections_27 = [
    ("Batch 1 - Foundation", [
        "Switched from system font stack to Poppins across all weights (400-900)",
        "Corrected background color to brand-compliant #0e0b16",
        "Improved muted text contrast (#999 to #aaa)",
        "Added defer to Spotify SDK script to prevent render blocking",
        "Replaced all hardcoded #FF2600 with var(--red) CSS variable",
    ]),
    ("Batch 2 - Header & Brand Identity", [
        "Redesigned header with brand dark purple #140038 base and red gradient accent",
        "Added aria-hidden to decorative maple leaf emoji",
        "Cleaned up footer with TTH Podcast Series branding",
        "Added font preload for Poppins to reduce layout shift",
    ]),
    ("Batch 3 - Data Integrity", [
        "Replaced all user-facing em dashes with hyphens (30+ locations)",
        "Converted placeholder em dashes in data fields to empty strings with updated conditionals",
        "Removed duplicate 'You're Everywhere' entry in Beyond Top 40",
    ]),
    ("Batch 4 - Accessibility & Semantics", [
        "Changed modal title from div to semantic h2",
        "Added aria-controls to all category tab buttons",
        "Added aria-live regions for screen reader announcements",
        "Added focus trap in modal for keyboard navigation",
        "Improved album card semantics with proper button roles",
    ]),
    ("Batch 5 - Rendering, Layout & Inline Styles", [
        "Created SVG sprite for Spotify icon, replacing 3 inline duplicates",
        "Improved alt text to include 'album cover' suffix",
        "Added proper title quoting: single quotes for songs, double for albums",
        "Replaced inline event handlers with CSS classes for stream links",
        "Added mobile breakpoint, text-shadow overlays, modal max-width",
        "Added result count labels and empty state fallback",
    ]),
    ("Batch 6 - Polish & Visual Refinements", [
        "Simplified card hover animation to scale(1.02) only",
        "Increased 'Details' hint visibility",
        "Replaced text chevron with SVG icon on Beyond toggle",
        "Added data-type border accents per album type (Studio, Live, Compilation, EP, Soundtrack)",
        "Replaced emoji badges with inline SVGs (Canadian flag, Juno star)",
        "Added visible Spotify error state for auth failures",
        "Fixed singular/plural count labels",
    ]),
]

for sec_title, items in sections_27:
    story.append(Paragraph(sec_title, section_style))
    for item in items:
        story.append(Paragraph(item, bullet_style, bulletText="\u2022"))

story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#dddddd"), spaceAfter=4))

# --- v2.7.1 ---
story.append(Paragraph("v2.7.1 - Complete Discography v6.0 + Solo Projects", version_style))
story.append(Paragraph("March 16, 2026", version_sub))

sections_271 = [
    ("Album Images", [
        "Replaced all placeholder art with actual cover images across 6 categories (35 albums)",
        "Organized assets into subfolders: studio, live, compilations, box-sets, eps, video, solo-projects",
    ]),
    ("Streaming Services Overhaul", [
        "Removed Spotify logo and Connect button from home screen",
        "Removed Spotify hover overlay from album cards",
        "Added Tidal and YouTube Music to all streaming link locations",
        "Album card click opens detail modal with streaming service picker",
        "Spotify uses search fallback URL when no direct track URL is mapped",
    ]),
    ("Solo Projects (New Section)", [
        "Added Solo Projects category with landing page, band photo hero, and 5 member buttons",
        "Built individual member discography pages with back navigation:",
    ]),
    (None, [
        "Gord Downie: 9 albums (2001-2026)",
        "Rob Baker / Stripper's Union: 3 albums (2006-2021)",
        "Paul Langlois: 4 albums (2010-2026)",
        "Gord Sinclair: 2 albums (2020-2023)",
        "Johnny Fay: 1 EP (2025)",
    ]),
    ("v6.0 Data Alignment", [
        "Updated live album titles to v6.0 format with city/year",
        "Road Apples Box Set year corrected: 2019 to 2021",
        "We Are the Same chart corrected: 9th to 8th Canadian #1",
        "Up to Here chart updated to include 2019 reissue #1",
        "Updated Spotify URL keys to match renamed vault album titles",
        "Footer data source updated from v5.6 to v6.0",
    ]),
]

for sec_title, items in sections_271:
    if sec_title:
        story.append(Paragraph(sec_title, section_style))
    for item in items:
        if sec_title is None:
            story.append(Paragraph(item, sub_bullet_style, bulletText="-"))
        else:
            story.append(Paragraph(item, bullet_style, bulletText="\u2022"))

story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#dddddd"), spaceAfter=4))

# --- v2.7.2 ---
story.append(Paragraph("v2.7.2 - Brand Polish + Navigation", version_style))
story.append(Paragraph("March 16, 2026", version_sub))

sections_272 = [
    ("Header", [
        "Added 'COMPLETE DISCOGRAPHY' sub-header below main title (35% smaller)",
        "Removed 'DISCOGRAPHY' section heading from all screens",
    ]),
    ("Background", [
        "Changed entire app background to brand dark purple #140038",
        "Updated all component backgrounds to purple-tinted variants",
        "Eliminated all black/grey backgrounds that clashed with purple brand",
    ]),
    ("Data", [
        "Removed 'That Night in Toronto' from Live albums (appears only under Video)",
        "Renumbered live albums 01-08, updated count stat",
    ]),
    ("Footer", [
        "Added 'Email jD' mailto link (jd@tthpods.com)",
        "Added 'Sign up For Yer Letter' newsletter button linking to Mailchimp",
    ]),
]

for sec_title, items in sections_272:
    story.append(Paragraph(sec_title, section_style))
    for item in items:
        story.append(Paragraph(item, bullet_style, bulletText="\u2022"))

story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#dddddd"), spaceAfter=4))

# --- v2.7.3 ---
story.append(Paragraph("v2.7.3 - Random Song Page + Amazon Music + Card UI", version_style))
story.append(Paragraph("March 16, 2026", version_sub))

sections_273 = [
    ("Random Hip Song", [
        "Redesigned as full-page view instead of inline result",
        "Shows song title, album name, and 5 large streaming service buttons",
        "Back button returns to home screen with no lingering result",
    ]),
    ("Streaming Services", [
        "Added Amazon Music as 5th streaming service (Random Song page + album modal)",
        "Modal now shows 6 links: Apple Music, Spotify, Tidal, YouTube Music, Amazon Music, Buy at TheHip.com",
    ]),
    ("Album Card UI", [
        "Removed scale hover effect that made art + info look like one button",
        "Added distinct hover states: art brightens, info gets red border-top accent",
        "Art and info now read as two separate interactive zones",
    ]),
]

for sec_title, items in sections_273:
    story.append(Paragraph(sec_title, section_style))
    for item in items:
        story.append(Paragraph(item, bullet_style, bulletText="\u2022"))

doc.build(story)
print(f"PDF saved to: {output_path}")
