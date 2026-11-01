#!/usr/bin/env python3
"""Build The Hip Compendium v3.0 Feature Guide PDF"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus.flowables import Flowable

# Register Poppins fonts
pdfmetrics.registerFont(TTFont('Poppins', '/Library/Fonts/Poppins-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Poppins-Bold', '/Library/Fonts/Poppins-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Poppins-SemiBold', '/Library/Fonts/Poppins-SemiBold.ttf'))
pdfmetrics.registerFont(TTFont('Poppins-Light', '/Library/Fonts/Poppins-Light.ttf'))

# Brand colors
DARK_PURPLE = HexColor('#140038')
RED = HexColor('#C8102E')
GOLD = HexColor('#D4A017')
DARK_BG = HexColor('#0e0b16')
TEXT_DARK = HexColor('#1a1a1a')
TEXT_MED = HexColor('#444444')
TEXT_LIGHT = HexColor('#666666')
LIGHT_BG = HexColor('#f5f5f5')
BORDER = HexColor('#e0e0e0')

W, H = letter

# Styles
styles = {
    'cover_title': ParagraphStyle(
        'cover_title', fontName='Poppins-Bold', fontSize=36,
        textColor=white, alignment=TA_CENTER, leading=42, spaceAfter=8
    ),
    'cover_sub': ParagraphStyle(
        'cover_sub', fontName='Poppins-Light', fontSize=16,
        textColor=HexColor('#ccbbee'), alignment=TA_CENTER, leading=22
    ),
    'cover_bottom': ParagraphStyle(
        'cover_bottom', fontName='Poppins', fontSize=9,
        textColor=HexColor('#9988bb'), alignment=TA_CENTER, leading=14
    ),
    'section_title': ParagraphStyle(
        'section_title', fontName='Poppins-Bold', fontSize=20,
        textColor=RED, alignment=TA_LEFT, leading=26, spaceBefore=0, spaceAfter=14
    ),
    'subsection': ParagraphStyle(
        'subsection', fontName='Poppins-SemiBold', fontSize=12,
        textColor=TEXT_DARK, leading=16, spaceBefore=14, spaceAfter=6
    ),
    'body': ParagraphStyle(
        'body', fontName='Poppins', fontSize=9.5,
        textColor=TEXT_MED, leading=15, spaceAfter=6
    ),
    'bullet': ParagraphStyle(
        'bullet', fontName='Poppins', fontSize=9.5,
        textColor=TEXT_MED, leading=15, spaceAfter=4,
        leftIndent=18, bulletIndent=6
    ),
    'stat_label': ParagraphStyle(
        'stat_label', fontName='Poppins-Light', fontSize=8,
        textColor=TEXT_LIGHT, leading=10, alignment=TA_CENTER
    ),
    'stat_value': ParagraphStyle(
        'stat_value', fontName='Poppins-Bold', fontSize=18,
        textColor=RED, leading=22, alignment=TA_CENTER
    ),
    'footer': ParagraphStyle(
        'footer', fontName='Poppins-Light', fontSize=7,
        textColor=TEXT_LIGHT, alignment=TA_CENTER
    ),
    'new_badge': ParagraphStyle(
        'new_badge', fontName='Poppins-Bold', fontSize=8,
        textColor=white, leading=10
    ),
}


class ColoredBackground(Flowable):
    """Full-page colored background for cover."""
    def __init__(self, color, width, height):
        Flowable.__init__(self)
        self.color = color
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(-1*inch, -1*inch, self.width + 2*inch, self.height + 2*inch, fill=1, stroke=0)


class HorizontalLine(Flowable):
    """Simple horizontal rule."""
    def __init__(self, width, color=BORDER, thickness=0.5):
        Flowable.__init__(self)
        self.width = width
        self.color = color
        self.thickness = thickness

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)

    def wrap(self, availWidth, availHeight):
        return (self.width, self.thickness + 4)


def add_footer(canvas, doc):
    """Add footer to interior pages."""
    if doc.page > 1:
        canvas.saveState()
        canvas.setFont('Poppins-Light', 7)
        canvas.setFillColor(TEXT_LIGHT)
        canvas.drawCentredString(W/2, 0.5*inch,
            f"The Hip Compendium - v3.0 Feature Guide  |  thehipexperience.tthpods.com  |  Page {doc.page}")
        # Red accent line
        canvas.setStrokeColor(RED)
        canvas.setLineWidth(0.5)
        canvas.line(0.75*inch, 0.7*inch, W - 0.75*inch, 0.7*inch)
        canvas.restoreState()


def build_cover(story):
    """Build the cover page."""
    story.append(Spacer(1, 2.2*inch))

    # Red accent line above title
    story.append(HorizontalLine(2*inch, RED, 2))
    story.append(Spacer(1, 20))

    story.append(Paragraph("THE HIP", styles['cover_title']))
    story.append(Paragraph("COMPENDIUM", styles['cover_title']))
    story.append(Spacer(1, 16))

    story.append(HorizontalLine(2*inch, RED, 2))
    story.append(Spacer(1, 24))

    story.append(Paragraph("Complete Feature Guide  -  v3.0", styles['cover_sub']))
    story.append(Spacer(1, 8))
    story.append(Paragraph("The Tragically Hip  -  Canada's Band", styles['cover_sub']))

    story.append(Spacer(1, 2.5*inch))

    story.append(Paragraph("Built by the TTH Podcast Series", styles['cover_bottom']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("thehipexperience.tthpods.com", styles['cover_bottom']))

    story.append(PageBreak())


def bullet(text):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", styles['bullet'])


def stat_box(value, label):
    """Create a stat box for the stats row."""
    return [
        Paragraph(str(value), styles['stat_value']),
        Paragraph(label, styles['stat_label'])
    ]


def build_stats_row(story, stats):
    """Build a row of stat boxes."""
    data = [[]]
    for val, lbl in stats:
        data[0].append([
            Paragraph(str(val), styles['stat_value']),
            Spacer(1, 2),
            Paragraph(lbl, styles['stat_label'])
        ])

    col_width = 5.5*inch / len(stats)
    t = Table(data, colWidths=[col_width] * len(stats))
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))


def build_page2(story):
    """What Is The Hip Compendium?"""
    story.append(Paragraph("WHAT IS THE HIP COMPENDIUM?", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "The Hip Compendium is a free, interactive web app built for fans of The Tragically Hip. "
        "It is the most comprehensive digital resource for the band's complete recorded output - "
        "26 official releases, 169 studio tracks, solo discographies for all five members, "
        "1,358 live setlists, a lyrics search engine, fan-ranked song countdown, and streaming "
        "links to every major platform.",
        styles['body']
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Built by jD from the TTH Podcast Series, the app brings together data from multiple "
        "sources including the TTH Podcast Series Complete Discography v6.0, the 2024-25 fan-voted "
        "TTH Top 40 Countdown, setlist.fm, Hipbase.com, and The Hip Archive.",
        styles['body']
    ))

    story.append(Spacer(1, 16))

    # Stats row
    build_stats_row(story, [
        ('26', 'RELEASES'),
        ('169', 'STUDIO TRACKS'),
        ('1,358', 'LIVE SHOWS'),
        ('5', 'SOLO CAREERS'),
    ])

    story.append(Spacer(1, 10))
    story.append(Paragraph("KEY HIGHLIGHTS", styles['subsection']))
    story.append(bullet("Complete discography spanning 1984 to 2026 across 7 release categories"))
    story.append(bullet("Interactive album modals with artwork, metadata, streaming links, and track listings"))
    story.append(bullet("Live performance statistics for every studio track, sourced from two independent databases"))
    story.append(bullet("Full-text lyrics search across all 169 studio songs"))
    story.append(bullet("Setlist explorer with filtering by year, tour, city, and song"))
    story.append(bullet("Solo project discographies for Gord Downie, Rob Baker, Paul Langlois, Gord Sinclair, and Johnny Fay"))
    story.append(bullet("Fan-ranked TTH Top 40 Countdown with the complete 169-song voting results"))
    story.append(bullet("Spotify Connect integration for in-app playback"))
    story.append(bullet("Installable as a mobile app (PWA) on iOS and Android"))
    story.append(bullet("Fully accessible with keyboard navigation, screen reader support, and reduced motion mode"))

    story.append(PageBreak())


def build_page3(story):
    """The Discography"""
    story.append(Paragraph("THE DISCOGRAPHY", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "The core of the app is the complete Tragically Hip discography - every official release "
        "from the 1987 self-titled EP through the 2024 No Dress Rehearsal documentary, organized "
        "into seven browsable categories.",
        styles['body']
    ))
    story.append(Spacer(1, 10))

    # Category grid
    cats = [
        ('13', 'Studio Albums', 'Up to Here (1989) through Man Machine Poem (2016)'),
        ('8', 'Live Albums', 'Live Between Us (1997) through Killer Whales (2022)'),
        ('1', 'Compilation', 'Yer Favourites (2005) - fan-voted greatest hits'),
        ('5', 'Box Sets', 'Hipeponymous through Up to Here 35th Anniversary'),
        ('2', 'EPs', 'Self-Titled (1987) and Saskadelphia (2021)'),
        ('6', 'Video Releases', 'Heksenketel (1993) through No Dress Rehearsal (2024)'),
    ]

    for num, cat, desc in cats:
        story.append(Paragraph(f"<b>{num} {cat}</b>  -  {desc}", styles['body']))

    story.append(Spacer(1, 14))
    story.append(Paragraph("ALBUM DETAILS", styles['subsection']))
    story.append(Paragraph(
        "Every album opens in a detailed modal view with the following information:",
        styles['body']
    ))
    story.append(bullet("Album artwork with gradient fallback"))
    story.append(bullet("Release date, label, and producer credits"))
    story.append(bullet("Canadian chart position and certification (Diamond, Platinum, Gold)"))
    story.append(bullet("Juno Award wins with year and category"))
    story.append(bullet("Full album description and historical context"))
    story.append(bullet("Streaming links to Apple Music, Spotify, Tidal, YouTube Music, Amazon Music, and TheHip.com"))
    story.append(bullet("Singles list with TTH Top 40 rankings"))
    story.append(bullet("Complete track listing with interactive flip cards (see next page)"))

    story.append(Spacer(1, 14))
    story.append(Paragraph("VISUAL TIMELINE", styles['subsection']))
    story.append(Paragraph(
        "All 26 releases are plotted on a scrollable horizontal timeline spanning 1984 to 2025. "
        "Each release appears as a card with artwork, title, and type badge. Key milestones are "
        "marked including the band's formation in Kingston, the final show on August 20, 2016, "
        "and Gord Downie's passing on October 17, 2017. The timeline is scrollable by drag, "
        "mouse wheel, or keyboard.",
        styles['body']
    ))

    story.append(PageBreak())


def build_page4(story):
    """Live Performance Stats"""
    story.append(Paragraph("LIVE PERFORMANCE STATS", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        '<font color="#C8102E"><b>NEW IN v3.0</b></font>',
        ParagraphStyle('badge', fontName='Poppins-Bold', fontSize=9, textColor=RED, leading=12)
    ))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Click any track in an album modal and the tile flips over to reveal live performance "
        "statistics. Data is sourced from two independent databases and cross-referenced for accuracy.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("DATA SOURCES", styles['subsection']))
    story.append(bullet("<b>Hipbase.com</b> (Lance Robinson) - 276 songs across 1,003 documented shows"))
    story.append(bullet("<b>setlist.fm</b> - 1,358 setlists with 300 unique songs (208 originals, 92 covers)"))
    story.append(bullet("169 studio tracks cross-referenced with <b>100% match rate</b> across both sources"))
    story.append(bullet("163 tracks matched in both sources; 6 matched Hipbase only"))

    story.append(Spacer(1, 10))
    story.append(Paragraph("STATS ON EACH FLIP CARD", styles['subsection']))
    story.append(bullet("<b>Times Played</b> - best estimate from both sources, highlighted in gold"))
    story.append(bullet("<b>As Opener</b> - number of times the song opened a show"))
    story.append(bullet("<b>As Encore</b> - number of times played as an encore"))
    story.append(bullet("<b>First Played</b> - earliest documented live performance"))
    story.append(bullet("<b>Last Played</b> - most recent documented performance"))
    story.append(bullet("<b>Sources</b> - which databases contributed to the stats"))
    story.append(bullet("<b>Frequency Bar</b> - visual indicator showing play count relative to the most-performed song"))

    story.append(Spacer(1, 10))
    story.append(Paragraph("TOP 10 MOST-PLAYED SONGS", styles['subsection']))

    top10 = [
        ['#', 'Song', 'Album', 'Plays'],
        ['1', 'New Orleans Is Sinking', 'Up to Here', '836'],
        ['2', 'At the Hundredth Meridian', 'Fully Completely', '781'],
        ['3', 'Grace, Too', 'Day for Night', '719'],
        ['4', 'Ahead by a Century', 'Trouble at the Henhouse', '699'],
        ['5', 'Courage (for Hugh MacLennan)', 'Fully Completely', '651'],
        ['6', 'Poets', 'Phantom Power', '611'],
        ['7', 'Fully Completely', 'Fully Completely', '587'],
        ['8', 'Bobcaygeon', 'Phantom Power', '575'],
        ['9', 'Gift Shop', 'Trouble at the Henhouse', '571'],
        ['10', 'Nautical Disaster', 'Day for Night', '532'],
    ]

    t = Table(top10, colWidths=[0.35*inch, 2.2*inch, 2.1*inch, 0.6*inch])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,0), 'Poppins-Bold'),
        ('FONTNAME', (0,1), (-1,-1), 'Poppins'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('BACKGROUND', (0,0), (-1,0), RED),
        ('TEXTCOLOR', (0,1), (-1,-1), TEXT_MED),
        ('BACKGROUND', (0,1), (-1,-1), LIGHT_BG),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_BG, white]),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (3,0), (3,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.25, BORDER),
    ]))
    story.append(t)

    story.append(PageBreak())


def build_page5(story):
    """TTH Top 40"""
    story.append(Paragraph("TTHTOP40 FAN COUNTDOWN", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "The TTH Top 40 is a fan-voted countdown of the greatest Tragically Hip songs, "
        "conducted during the 2024-25 season by the TTH Podcast Series. The full results "
        "are built into the app as an interactive, browsable section.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("FEATURES", styles['subsection']))
    story.append(bullet("Top 40 songs displayed as ranked cards with song title, album name, and year"))
    story.append(bullet("Color-coded badges: gold for Top 40 entries, red for songs ranked beyond 40"))
    story.append(bullet("Expandable 'Full 169' section revealing every song that received at least one vote"))
    story.append(bullet("Album breakdown showing which records contributed the most ranked songs"))
    story.append(bullet("Badges appear throughout the app - in album modals, track listings, and singles sections"))

    story.append(Spacer(1, 10))
    story.append(Paragraph("THE TOP 10", styles['subsection']))

    top10 = [
        ('1', 'Grace, Too', 'Day for Night'),
        ('2', 'Ahead by a Century', 'Trouble at the Henhouse'),
        ('3', 'Bobcaygeon', 'Phantom Power'),
        ('4', 'Nautical Disaster', 'Day for Night'),
        ('5', 'Wheat Kings', 'Fully Completely'),
        ('6', 'Fiddler\'s Green', 'Phantom Power'),
        ('7', 'Escape Is at Hand for the Travellin\' Man', 'Phantom Power'),
        ('8', 'Locked in the Trunk of a Car', 'Fully Completely'),
        ('9', 'Fireworks', 'Phantom Power'),
        ('10', 'Courage (for Hugh MacLennan)', 'Fully Completely'),
    ]

    for rank, title, album in top10:
        story.append(Paragraph(
            f'<b>#{rank}</b>  -  {title}  <font color="#666666">({album})</font>',
            styles['body']
        ))

    story.append(PageBreak())


def build_page6(story):
    """Streaming & Spotify"""
    story.append(Paragraph("STREAMING &amp; SPOTIFY INTEGRATION", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Every album and track in the app links to all major streaming platforms, with smart "
        "features that remember your preferences and get you listening faster.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("SUPPORTED SERVICES", styles['subsection']))
    story.append(bullet("Apple Music"))
    story.append(bullet("Spotify (with direct track URLs for hundreds of songs)"))
    story.append(bullet("Tidal"))
    story.append(bullet("YouTube Music"))
    story.append(bullet("Amazon Music"))
    story.append(bullet("TheHip.com and Gordieland.com for direct purchase"))

    story.append(Spacer(1, 10))
    story.append(Paragraph("SMART PREFERENCE SYSTEM", styles['subsection']))
    story.append(Paragraph(
        "Click any streaming service once and it becomes your default across the entire app. "
        "Your preferred service is highlighted with a visual ring indicator and moved to the "
        "front of the options list. The preference persists for your session.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("SPOTIFY CONNECT", styles['subsection']))
    story.append(Paragraph(
        "For Spotify Premium users, the app supports direct playback via the Spotify Web "
        "Playback SDK. Connect your Spotify account using secure PKCE OAuth 2.0 authentication "
        "(no password shared with the app) and play tracks directly from any album modal.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("TRACK STREAMING ICON", styles['subsection']))
    story.append(Paragraph(
        "Every track in the app has a small streaming icon on the right side of the row. "
        "If you have a preferred service set, one click opens that song on your service. "
        "If no preference is set, clicking the icon opens a service picker with all five options.",
        styles['body']
    ))

    story.append(PageBreak())


def build_page7(story):
    """Lyrics Search"""
    story.append(Paragraph("LYRICS SEARCH", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Search across the complete lyrics of all 169 Tragically Hip studio songs. "
        "Find any word, phrase, or reference instantly.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("FEATURES", styles['subsection']))
    story.append(bullet("Full-text search across all 169 studio song lyrics"))
    story.append(bullet("Case-insensitive keyword and phrase matching"))
    story.append(bullet("Results show matching lyric excerpts with the search term highlighted in context"))
    story.append(bullet("Album breakdown showing which records contain matches"))
    story.append(bullet("Results count summary"))
    story.append(bullet("Lyrics index cached locally in your browser for fast repeat searches"))
    story.append(bullet("Option to rebuild the index from source if needed"))

    story.append(Spacer(1, 20))

    # Setlist Explorer on same page
    story.append(Paragraph("SETLIST EXPLORER", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Browse 1,358 documented Tragically Hip live shows from 1985 to 2016. "
        "Powered by setlist.fm data.",
        styles['body']
    ))

    story.append(Spacer(1, 10))
    story.append(Paragraph("FEATURES", styles['subsection']))
    story.append(bullet("Filter by year, tour name, or city"))
    story.append(bullet("Text search across venues, cities, and songs"))
    story.append(bullet("Top songs analysis from your filtered results"))
    story.append(bullet("Expandable setlist cards showing the complete song list for each show"))
    story.append(bullet("Summary stats for filtered results (show count, date range)"))
    story.append(bullet("Results pagination for large result sets"))

    story.append(PageBreak())


def build_page8(story):
    """Solo Projects"""
    story.append(Paragraph("SOLO PROJECTS", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "Complete solo discographies for all five members of The Tragically Hip. Each member "
        "has a dedicated section with a biography, album grid, and full album modals with "
        "the same level of detail as the main Hip discography.",
        styles['body']
    ))

    story.append(Spacer(1, 10))

    members = [
        ('Gord Downie', '9 releases (2001-2026)',
         'Coke Machine Glow, Battle of the Nudes, The Grand Bounce, And the Conquering Sun (with The Sadies), '
         'Secret Path, Introduce Yerself, Away Is Mine, Lustre Parfait, Live at 6 O\'Clock. '
         'Includes posthumous releases and the Secret Path multimedia project.'),
        ('Rob Baker', '3 releases (2006-2021)',
         'Stripper\'s Union: Local 518, The Deuce, The Undertaking. Side project with Craig Northey.'),
        ('Paul Langlois', '4 releases (2010-2026)',
         'Fix This Head, Not Guilty, Guess What (Paul Langlois Band), Smooth Rock Falls.'),
        ('Gord Sinclair', '2 releases (2020-2023)',
         'Taxi Dancers, In Continental Drift.'),
        ('Johnny Fay', '1 release (2025)',
         'Mercury Sea - 6-track ambient EP mixed by David Botrill.'),
    ]

    for name, count, desc in members:
        story.append(Paragraph(f"<b>{name}</b>  -  {count}", styles['body']))
        story.append(Paragraph(desc, ParagraphStyle(
            'member_desc', parent=styles['body'], leftIndent=18, fontSize=8.5,
            textColor=TEXT_LIGHT, spaceAfter=8
        )))

    story.append(PageBreak())


def build_page9(story):
    """Additional Features"""
    story.append(Paragraph("ADDITIONAL FEATURES", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    features = [
        ('Random Hip Song',
         'One-click random track selector from the full 169-song studio catalog. '
         'Opens a modal with the song title, album name, and streaming links.'),
        ('Tour Map',
         'Interactive map of Tragically Hip tour dates and venues across North America and beyond. '
         'Available as a dedicated page linked from the main navigation.'),
        ('Yer Hip Links',
         'Curated collection of Hip-related resources, fan communities, and official sites. '
         'A one-stop directory for everything Tragically Hip on the web.'),
        ('Installable App (PWA)',
         'Full Progressive Web App support. Install the Hip Compendium directly to your iOS or '
         'Android home screen for an app-like experience with instant access.'),
        ('Accessibility',
         'Built with accessibility as a priority. Full keyboard navigation with roving tabindex, '
         'ARIA labels on all interactive elements, screen reader support, focus management in modals, '
         'and a reduced motion mode that disables animations for users who prefer it.'),
        ('Responsive Design',
         'Optimized layouts for desktop, tablet, and mobile. Album grids, modals, and navigation '
         'adapt to any screen size. Touch-friendly controls on mobile devices.'),
        ('Pre-Launch Beta Gate',
         'Password-protected access during the beta period with a countdown timer to the v3.0 '
         'launch date. Provides controlled early access for testers.'),
    ]

    for title, desc in features:
        story.append(Paragraph(f"<b>{title}</b>", styles['subsection']))
        story.append(Paragraph(desc, styles['body']))

    story.append(PageBreak())


def build_page10(story):
    """Credits"""
    story.append(Paragraph("CREDITS &amp; DATA SOURCES", styles['section_title']))
    story.append(HorizontalLine(5.5*inch, RED, 1))
    story.append(Spacer(1, 12))

    story.append(Paragraph("DATA SOURCES", styles['subsection']))
    story.append(bullet("<b>TTH Podcast Series Complete Discography v6.0</b> - primary album and track dataset"))
    story.append(bullet("<b>2024-25 TTH Top 40 Countdown</b> - fan-voted song rankings"))
    story.append(bullet("<b>setlist.fm</b> - 1,358 live setlists and performance data"))
    story.append(bullet("<b>Hipbase.com</b> (Lance Robinson) - comprehensive live performance database"))
    story.append(bullet("<b>The Hip Archive</b> (Darrin Cappe) - additional research and verification"))

    story.append(Spacer(1, 14))
    story.append(Paragraph("BUILT BY", styles['subsection']))
    story.append(Paragraph(
        "<b>Design &amp; Content:</b>  TTH Podcast Series",
        styles['body']
    ))
    story.append(Paragraph(
        "<b>Code:</b>  Claude",
        styles['body']
    ))
    story.append(Paragraph(
        "<b>Created by:</b>  jD",
        styles['body']
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("CONTACT", styles['subsection']))
    story.append(Paragraph("jd@tthpods.com  |  tthpods.com", styles['body']))
    story.append(Paragraph("thehipexperience.tthpods.com", styles['body']))

    story.append(Spacer(1, 1.5*inch))
    story.append(HorizontalLine(2*inch, RED, 1))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "The Tragically Hip  -  Kingston, Ontario  -  1984 to Forever",
        ParagraphStyle('closing', fontName='Poppins-Light', fontSize=9,
                      textColor=TEXT_LIGHT, alignment=TA_CENTER, leading=14)
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Gord Downie (1964-2017)",
        ParagraphStyle('gord', fontName='Poppins-SemiBold', fontSize=9,
                      textColor=RED, alignment=TA_CENTER, leading=14)
    ))


# Build the PDF
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'The Hip Compendium - v3.0 Feature Guide.pdf')

doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    topMargin=0.75*inch,
    bottomMargin=0.85*inch,
    leftMargin=0.75*inch,
    rightMargin=0.75*inch,
)

story = []

# Cover page uses a custom page template
def cover_page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_PURPLE)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Add subtle accent lines
    canvas.setStrokeColor(HexColor('#2a0060'))
    canvas.setLineWidth(0.25)
    for y in range(0, int(H), 40):
        canvas.line(0, y, W, y)
    canvas.restoreState()

def interior_page(canvas, doc):
    add_footer(canvas, doc)

# Build all pages
build_cover(story)
build_page2(story)
build_page3(story)
build_page4(story)
build_page5(story)
build_page6(story)
build_page7(story)
build_page8(story)
build_page9(story)
build_page10(story)

# Build with page templates
doc.build(story, onFirstPage=cover_page_bg, onLaterPages=interior_page)

print(f"PDF created: {output_path}")
