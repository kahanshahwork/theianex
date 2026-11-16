// Structured data (JSON-LD) for each page. Built from what the page actually says, so the markup never drifts from the visible copy.
const strip = (h) => h
  .replace(/<mark class="tbc[^"]*\bnote\b[^"]*">[\s\S]*?<\/mark>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&rsquo;|&#8217;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/\s+/g, ' ').replace(/\s([.,;:?!])/g, '$1').trim();

const CRUMBS = {
  'why-ianex': 'Why Theianex', 'how-we-work': 'How we work', paraiq: 'ParaIQ', contact: 'Contact',
  'ai-statement-of-advice': 'Can AI write a Statement of Advice?', 'outsourcing-paraplanning': 'What to ask before you outsource paraplanning',
  privacy: 'Privacy Policy', terms: 'Terms',
};

export function schemaFor({ name, meta, body, site }) {
  const ctx = 'https://schema.org';
  const org = { '@id': site + '/#organization' };
  const url = site + (name === 'index' ? '/' : '/' + name);
  const out = [];

  if (name === 'index') {
    const offer = (n, d) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n, description: d } });
    out.push(
      { '@context': ctx, '@type': 'WebSite', '@id': site + '/#website', name: 'Theianex', alternateName: ['Theianex Pty Ltd', 'ParaIQ by Theianex'], url: site + '/', inLanguage: 'en-AU', publisher: org },
      {
        '@context': ctx, '@type': 'Organization', '@id': site + '/#organization', name: 'Theianex', legalName: 'Theianex Pty Ltd', url: site + '/',
        description: 'Theianex is a paraplanning company for Australian financial advisers, built around technology and supported by ParaIQ.',
        areaServed: { '@type': 'Country', name: 'Australia' }, taxID: '77703036355',
        knowsAbout: ['Paraplanning', 'Statement of Advice preparation', 'Record of Advice preparation', 'Financial advice document preparation', 'Client file review', 'AI-assisted paraplanning'],
      },
      {
        '@context': ctx, '@type': 'Service', '@id': site + '/#paraplanning', name: 'Paraplanning for Australian financial advisers', serviceType: 'Paraplanning', provider: org,
        areaServed: { '@type': 'Country', name: 'Australia' }, audience: { '@type': 'Audience', audienceType: 'Australian financial advisers and advice firms' },
        description: 'Advice document preparation, client file preparation, research and strategy support, and document review, carried out by paraplanners using ParaIQ and returned to the adviser for approval.',
        hasOfferCatalog: {
          '@type': 'OfferCatalog', name: 'What we prepare',
          itemListElement: [
            offer('Advice documentation', 'Statements of Advice (SOAs), Records of Advice (ROAs) and supporting advice documents.'),
            offer('Client file preparation', 'Fact-find reviews, client summaries and file notes.'),
            offer('Research and strategy support', 'Assigned investment and product research, and strategy documentation.'),
            offer('Document review', 'Checks for consistency, completeness and alignment with supplied information and adviser instructions.'),
          ],
        },
      },
    );
  } else if (name !== '404' && name !== 'thank-you') {
    out.push({
      '@context': ctx, '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Theianex', item: site + '/' },
        { '@type': 'ListItem', position: 2, name: CRUMBS[name] || meta.title, item: url },
      ],
    });
  }

  if (meta.schema === 'article') {
    out.push({
      '@context': ctx, '@type': 'Article', headline: (meta.headline || meta.title).slice(0, 110), description: meta.description,
      datePublished: meta.published, dateModified: meta.updated || meta.published, inLanguage: 'en-AU',
      mainEntityOfPage: url, author: { '@type': 'Organization', name: 'Theianex', url: site + '/' }, publisher: { '@type': 'Organization', name: 'Theianex', url: site + '/' },
      image: site + '/assets/og/theianex.png',
    });
  }

  /* FAQ: lifted from the visible <details class="faq-i"> blocks */
  const faq = [...body.matchAll(/<details class="faq-i[^"]*">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/details>/g)]
    .map((m) => ({ '@type': 'Question', name: strip(m[1]), acceptedAnswer: { '@type': 'Answer', text: strip(m[2]) } }));
  if (faq.length) out.push({ '@context': ctx, '@type': 'FAQPage', mainEntity: faq });

  return out.length ? '<script type="application/ld+json">' + JSON.stringify(out) + '</script>' : '';
}
