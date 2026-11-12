const ORDER = { error: 0, warning: 1, info: 2 };
const key = (url, code) => `${url}\u0000${code}`;

// Turns the latest run's per-page audits into "template -> issue -> pages", and compares with the previous run so a
// regression (an issue that was not there last time) stands out. Pure function: no database needed.
export function groupReport(latest, previous = [], run = null) {
  const totals = { pages: latest.length, error: 0, warning: 0, info: 0 };
  const templates = new Map();
  for (const page of latest) {
    const t = templates.get(page.template) || { template: page.template, pages: 0, issueCount: 0, issues: new Map() };
    t.pages += 1;
    for (const i of page.issues) {
      totals[i.severity] += 1;
      t.issueCount += 1;
      const e = t.issues.get(i.code) || { code: i.code, severity: i.severity, message: i.message, count: 0, urls: [] };
      e.count += 1;
      e.urls.push(page.url);
      t.issues.set(i.code, e);
    }
    templates.set(page.template, t);
  }

  const before = new Set(previous.flatMap((p) => p.issues.map((i) => key(p.url, i.code))));
  const now = new Set(latest.flatMap((p) => p.issues.map((i) => key(p.url, i.code))));
  const sev = new Map(latest.flatMap((p) => p.issues.map((i) => [key(p.url, i.code), i.severity])));
  const prevSev = new Map(previous.flatMap((p) => p.issues.map((i) => [key(p.url, i.code), i.severity])));
  const split = (k) => { const [url, code] = k.split('\u0000'); return { url, code }; };

  return {
    run,
    totals,
    templates: [...templates.values()]
      .map((t) => ({ ...t, issues: [...t.issues.values()].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.count - a.count) }))
      .sort((a, b) => b.issueCount - a.issueCount),
    changes: {
      compared: previous.length > 0,
      newIssues: previous.length ? [...now].filter((k) => !before.has(k)).map((k) => ({ ...split(k), severity: sev.get(k) })) : [],
      fixedIssues: previous.length ? [...before].filter((k) => !now.has(k)).map((k) => ({ ...split(k), severity: prevSev.get(k) })) : [],
    },
  };
}
