// Checks the structured data Google reads for shops and restaurants. Not a full schema.org validator: it checks the
// properties that matter most for Product, Offer, BreadcrumbList and Restaurant, plus MenuItem (used for dishes).
const flatten = (d) => (Array.isArray(d) ? d.flatMap(flatten) : d && Array.isArray(d['@graph']) ? flatten(d['@graph']) : d && typeof d === 'object' ? [d] : []);
const typesOf = (n) => [].concat(n['@type'] || []).map(String);
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const issue = (code, severity, message) => ({ code, severity, message });

function checkOffer(o) {
  const types = typesOf(o);
  const price = types.includes('AggregateOffer') ? (o.lowPrice ?? o.price) : o.price;
  return has(price) && has(o.priceCurrency) ? null : issue('jsonld_offer_invalid', 'error', 'An Offer needs a price and a priceCurrency (e.g. NGN).');
}

export function validateJsonLd(blocks) {
  const issues = [];
  const types = [];
  for (const b of blocks) {
    if (b.error) { issues.push(issue('jsonld_invalid', 'error', `A JSON-LD block is not valid JSON (${b.error}).`)); continue; }
    for (const node of flatten(b.data)) {
      const ctx = JSON.stringify(node['@context'] ?? b.data?.['@context'] ?? '');
      if (!/schema\.org/i.test(ctx)) issues.push(issue('jsonld_context', 'warning', 'JSON-LD is missing "@context": "https://schema.org".'));
      for (const t of typesOf(node)) {
        types.push(t);
        if (t === 'Product' || t === 'MenuItem') {
          if (!has(node.name)) issues.push(issue('jsonld_product_invalid', 'error', `${t} is missing a name.`));
          const offers = [].concat(node.offers || []);
          if (!offers.length) issues.push(issue('jsonld_product_offer_missing', 'warning', `${t} has no offers (price) so it cannot show price rich results.`));
          for (const o of offers) { const bad = checkOffer(o); if (bad) issues.push(bad); }
        } else if (t === 'Offer' || t === 'AggregateOffer') {
          const bad = checkOffer(node);
          if (bad) issues.push(bad);
        } else if (t === 'BreadcrumbList') {
          const items = [].concat(node.itemListElement || []);
          const ok = items.length > 0 && items.every((it) => typeof it.position === 'number' && (has(it.name) || has(it.item?.name)));
          if (!ok) issues.push(issue('jsonld_breadcrumb_invalid', 'error', 'BreadcrumbList needs itemListElement entries that each have a numeric position and a name.'));
        } else if (['Restaurant', 'LocalBusiness', 'FoodEstablishment'].includes(t)) {
          if (!has(node.name) || !has(node.address)) issues.push(issue('jsonld_restaurant_incomplete', 'error', `${t} needs at least a name and an address.`));
        }
      }
    }
  }
  return { issues, types: [...new Set(types)] };
}
