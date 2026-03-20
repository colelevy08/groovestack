// Structured data (JSON-LD) for vinyl records (#24).
// Generates schema.org MusicAlbum markup for SEO.

export function recordToJsonLd(record) {
  if (!record) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: record.album,
    byArtist: {
      '@type': 'MusicGroup',
      name: record.artist,
    },
    datePublished: record.year ? String(record.year) : undefined,
    albumProductionType: 'StudioAlbum',
    albumReleaseType: 'AlbumRelease',
    genre: (record.tags || []).slice(0, 3).join(', ') || undefined,
    ...(record.forSale && record.price ? {
      offers: {
        '@type': 'Offer',
        price: String(record.price),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        itemCondition: record.condition === 'M' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      },
    } : {}),
    ...(record.rating ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: String(record.rating),
        bestRating: '5',
        ratingCount: '1',
      },
    } : {}),
  };
}

// Injects JSON-LD script into the document head (call once per page view)
export function injectJsonLd(data) {
  if (!data) return;

  // Remove any previous GrooveStack JSON-LD
  const existing = document.querySelector('script[data-gs-jsonld]');
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-gs-jsonld', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}
