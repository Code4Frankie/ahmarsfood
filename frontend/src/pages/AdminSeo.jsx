import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { usePageMeta } from '../hooks/usePageMeta.js';

const CHIP = { error: 'bg-chili/15 text-chili', warning: 'bg-gold/40 text-ink', info: 'bg-ink/10 text-ink/70' };
const when = (d) => (d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function SuggestionCard({ s, busy, onDecide }) {
  const [title, setTitle] = useState(s.suggested.title || '');
  const [description, setDescription] = useState(s.suggested.description || '');
  const isFood = s.targetType === 'food';
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{isFood ? `Dish: ${s.label}` : `Page: ${s.label}`}</p>
        <span className="rounded-full bg-sunset/20 px-2 py-0.5 text-xs font-bold text-sunset-dark">Waiting for you</span>
      </div>
      {s.current?.description && <p className="text-xs text-ink/60">Now: {s.current.description}</p>}
      <div><label className="label">Title</label><input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label className="label">Description ({description.length}/155)</label><textarea className="input" rows={3} maxLength={155} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <p className="text-xs text-ink/60">
        {isFood ? 'Approving saves this description on the dish. Nothing else changes.' : 'Approving keeps this wording. Page tags live in the website code, so give approved text to your developer to paste in.'}
      </p>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => onDecide(s._id, 'approve', { title, description })}>Approve</button>
        <button className="btn-ghost" disabled={busy} onClick={() => onDecide(s._id, 'reject')}>Reject</button>
      </div>
    </div>
  );
}

export default function AdminSeo() {
  usePageMeta({ title: 'SEO report | Ahmars Food', noindex: true });
  const [report, setReport] = useState(undefined);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [foods, setFoods] = useState([]);
  const [foodId, setFoodId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, s, f] = await Promise.all([api.get('/admin/seo/report'), api.get('/admin/seo/suggestions', { params: { status: 'pending' } }), api.get('/foods')]);
      setReport(r.data.report); setMessage(r.data.message || ''); setSuggestions(s.data.suggestions); setFoods(f.data.foods);
    } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true); setError(''); setNote('');
    try { await fn(); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const decide = (id, decision, changes) => act(() => api.patch(`/admin/seo/suggestions/${id}`, { decision, ...changes }));
  const suggestDish = () => act(() => api.post('/admin/seo/suggestions', { foodId }));
  const queuePages = () => act(async () => {
    const { data } = await api.post('/admin/seo/suggestions/from-report');
    setNote(`Queued ${data.created.length} page(s)${data.skippedAlreadyQueued ? `; ${data.skippedAlreadyQueued} already queued` : ''}.`);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">SEO report</h1>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {report === undefined && !error && <p className="text-ink/60">Loading…</p>}
      {report === null && <p className="card text-ink/70">{message}</p>}

      {report && (
        <>
          <div className="card space-y-3">
            <p className="text-sm text-ink/70">
              Last crawl: <b>{when(report.run?.finishedAt)}</b> · {report.totals.pages} pages · {report.run?.renderJs ? 'rendered with JavaScript (like Google)' : 'without JavaScript'}
            </p>
            <div className="flex flex-wrap gap-2 text-sm font-bold">
              <span className={`rounded-full px-3 py-1 ${CHIP.error}`}>{report.totals.error} errors</span>
              <span className={`rounded-full px-3 py-1 ${CHIP.warning}`}>{report.totals.warning} warnings</span>
              <span className={`rounded-full px-3 py-1 ${CHIP.info}`}>{report.totals.info} notes</span>
            </div>
            {report.run?.truncated && <p className="text-sm text-chili">The crawl stopped at its page limit, so some pages are missing.</p>}
            {report.changes.compared ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Since the previous crawl: {report.changes.newIssues.length} new, {report.changes.fixedIssues.length} fixed</summary>
                <ul className="mt-2 space-y-1">
                  {report.changes.newIssues.map((c, i) => <li key={`n${i}`} className="text-chili">New: {c.code} on {new URL(c.url).pathname}</li>)}
                  {report.changes.fixedIssues.map((c, i) => <li key={`f${i}`} className="text-forest-dark">Fixed: {c.code} on {new URL(c.url).pathname}</li>)}
                </ul>
              </details>
            ) : <p className="text-sm text-ink/60">This is the first crawl, so there is nothing to compare with yet.</p>}
          </div>

          {report.templates.map((t) => (
            <section key={t.template} className="card">
              <h2 className="text-lg font-bold capitalize">{t.template} <span className="text-sm font-normal text-ink/60">· {t.pages} page(s), {t.issueCount} issue(s)</span></h2>
              {t.issues.length === 0 && <p className="mt-2 text-sm text-forest-dark">No issues.</p>}
              <ul className="mt-3 space-y-3">
                {t.issues.map((i) => (
                  <li key={i.code} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[i.severity]}`}>{i.severity}</span>
                      <code className="font-mono text-xs">{i.code}</code>
                      <span className="text-ink/50">× {i.count}</span>
                    </div>
                    <p className="mt-1 text-ink/70">{i.message}</p>
                    <details className="mt-1"><summary className="cursor-pointer text-xs text-forest-dark">Pages</summary><ul className="mt-1 text-xs text-ink/60">{i.urls.map((u) => <li key={u}>{u}</li>)}</ul></details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Suggested SEO text</h2>
        <p className="text-sm text-ink/70">The assistant drafts titles and descriptions. Nothing goes live until you approve it.</p>
        <div className="card flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="label">Suggest text for a dish</label>
            <select className="input" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
              <option value="">Choose a dish…</option>
              {foods.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          </div>
          <button className="btn-primary" disabled={busy || !foodId} onClick={suggestDish}>Suggest</button>
          <button className="btn-ghost" disabled={busy || !report} onClick={queuePages}>Queue pages missing a description</button>
        </div>
        {note && <p className="text-sm text-forest-dark">{note}</p>}
        {suggestions.length === 0 && <p className="text-sm text-ink/60">Nothing waiting for review.</p>}
        {suggestions.map((s) => <SuggestionCard key={s._id} s={s} busy={busy} onDecide={decide} />)}
      </section>
    </div>
  );
}
