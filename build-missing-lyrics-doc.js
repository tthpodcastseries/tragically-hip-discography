const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle } = require('docx');

const albums = [
  { name: 'Up to Here', year: '1989', songs: [
    "I'll Believe in You (Or I'll Be Leaving You Tonight)",
    "She Didn't Know",
    "Another Midnight"
  ]},
  { name: 'Road Apples', year: '1991', songs: [
    "Born in the Water",
    "Fiddler's Green"
  ]},
  { name: 'Fully Completely', year: '1992', songs: [
    "We'll Go, Too",
    "Fifty-Mission Cap"
  ]},
  { name: 'Day for Night', year: '1994', songs: [
    "Grace, Too",
    "An Inch an Hour",
    "Titanic Terrarium"
  ]},
  { name: 'Trouble at the Henhouse', year: '1996', songs: [
    "Don't Wake Daddy",
    "700 Ft. Ceiling",
    "Apartment Song",
    "Let's Stay Engaged",
    "Sherpa",
    "Put It Off"
  ]},
  { name: 'Phantom Power', year: '1998', songs: [
    "Save the Planet",
    "Membership",
    "Vapour Trails",
    "The Rules",
    "Chagrin Falls",
    "Emperor Penguin"
  ]},
  { name: 'In Violet Light', year: '2002', songs: [
    "It's a Good Life If You Don't Weaken",
    "Silver Jet",
    "All Tore Up",
    "Leave",
    "A Beautiful Thing",
    "The Dark Canuck"
  ]},
  { name: 'In Between Evolution', year: '2004', songs: [
    "Summer's Killing Us",
    "Gus: The Polar Bear from Central Park",
    "It Can't Be Nashville Every Night",
    "You're Everywhere",
    "As Makeshift As We Are",
    "Mean Streak",
    "The Heart of the Melt",
    "Are We Family",
    "Goodnight Josephine"
  ]},
  { name: 'World Container', year: '2006', songs: [
    "Luv (sic)",
    "The Kids Don't Get It",
    "Last Night I Dreamed You Didn't Love Me",
    "The Drop-Off"
  ]},
  { name: 'We Are the Same', year: '2009', songs: [
    "Honey, Please"
  ]},
  { name: 'The Tragically Hip (EP)', year: '1987', songs: [
    "I'm a Werewolf, Baby"
  ]},
  { name: 'Saskadelphia', year: '2021', songs: [
    "Ouch",
    "Just as Well"
  ]},
];

const totalSongs = albums.reduce((sum, a) => sum + a.songs.length, 0);

const children = [];

// Title
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: 'TTH Discography Web App', font: 'Poppins', size: 36, bold: true, color: 'D9D9D9' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: [new TextRun({ text: 'Missing Lyrics Checklist', font: 'Poppins', size: 28, color: 'D4A017' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 400 },
  children: [new TextRun({ text: `${totalSongs} songs across ${albums.length} albums`, font: 'Poppins', size: 20, color: '999999' })]
}));

// Divider
children.push(new Paragraph({
  spacing: { after: 300 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } },
  children: []
}));

// Albums
albums.forEach(album => {
  // Album heading
  children.push(new Paragraph({
    spacing: { before: 280, after: 60 },
    children: [
      new TextRun({ text: album.name, font: 'Poppins', size: 24, bold: true, color: 'D9D9D9' }),
      new TextRun({ text: `  (${album.year})`, font: 'Poppins', size: 20, color: '777777' }),
    ]
  }));

  // Songs
  album.songs.forEach(song => {
    children.push(new Paragraph({
      spacing: { after: 60 },
      indent: { left: 360 },
      numbering: { reference: 'checklist', level: 0 },
      children: [new TextRun({ text: song, font: 'Poppins', size: 20, color: 'BBBBBB' })]
    }));
  });
});

// Footer note
children.push(new Paragraph({
  spacing: { before: 500 },
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: '333333', space: 1 } },
  children: []
}));
children.push(new Paragraph({
  spacing: { before: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Paste lyrics for any of these songs and they can be added to data/lyrics.json', font: 'Poppins', size: 18, color: '777777', italics: true })]
}));

const doc = new Document({
  numbering: {
    config: [{
      reference: 'checklist',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '\u25A1',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      }
    },
    children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = '/Users/jd/Documents/Discography Web App/TTH Discography - Missing Lyrics Checklist.docx';
  fs.writeFileSync(outPath, buffer);
  console.log('Written to: ' + outPath);
});
