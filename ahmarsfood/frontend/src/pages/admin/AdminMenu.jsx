import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { naira } from '../../utils/money';

const EMPTY = { name: '', category: '', price: '', prepTime: 15, description: '', isAvailable: true };

export default function AdminMenu() {
  const [foods, setFoods] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // 'new' | food id | null
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [offer, setOffer] = useState(null); // a dish that was just saved: offer SEO text for it
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const load = useCallback(async () => {
    try { const { data } = await api.get('/foods'); setFoods(data.foods); setCategories(data.categories); } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => { setBusy(true); setError(''); setNote(''); try { await fn(); await load(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); } };

  const startNew = () => { setEditing('new'); setForm({ ...EMPTY, category: categories[0] || '' }); setFile(null); setOffer(null); };
  const startEdit = (f) => { setEditing(f._id); setForm({ name: f.name, category: f.category, price: f.price, prepTime: f.prepTime, description: f.description || '', isAvailable: f.isAvailable }); setFile(null); setOffer(null); };

  const save = (e) => {
    e.preventDefault();
    act(async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (file) fd.append('image', file);
      const { data } = editing === 'new' ? await api.post('/foods', fd) : await api.put(`/foods/${editing}`, fd);
      setOffer({ id: data.food._id, name: data.food.name });
      setEditing(null);
    });
  };
  const toggle = (f) => act(() => api.patch(`/foods/${f._id}/availability`, { isAvailable: !f.isAvailable }));
  const remove = (f) => { if (window.confirm(`Delete "${f.name}" from the menu? This cannot be undone.`)) act(() => api.delete(`/foods/${f._id}`)); };
  const suggest = (id) => act(async () => { await api.post('/admin/seo/suggestions', { foodId: id }); setOffer(null); setNote('SEO text drafted. Review it on the SEO tab before it goes anywhere.'); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Menu</h1>
        <button className="btn-primary" onClick={startNew}>Add a dish</button>
      </div>
      {error && <p className="rounded-lg bg-chili/10 p-3 text-sm text-chili">{error}</p>}
      {note && <p className="rounded-lg bg-forest/10 p-3 text-sm text-forest-dark">{note}</p>}

      {offer && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-sunset">
          <p className="text-sm"><b>{offer.name}</b> is saved. Want the assistant to draft search-friendly text for it? You review it before anything changes.</p>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => suggest(offer.id)}>Suggest SEO text</button>
            <button className="btn-ghost" onClick={() => setOffer(null)}>No thanks</button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={save} className="card grid gap-4 sm:grid-cols-2">
          <h2 className="text-lg font-bold sm:col-span-2">{editing === 'new' ? 'New dish' : 'Edit dish'}</h2>
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} required /></div>
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={set('category')} required>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Price (₦)</label><input className="input" type="number" min="0" value={form.price} onChange={set('price')} required /></div>
          <div><label className="label">Minutes to prepare</label><input className="input" type="number" min="1" value={form.prepTime} onChange={set('prepTime')} /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} /></div>
          <div><label className="label">Photo (optional)</label><input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
          <label className="flex items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={form.isAvailable} onChange={set('isAvailable')} /> Available to order</label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save dish'}</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {!foods && !error && <p className="text-ink/60">Loading…</p>}
      <div className="space-y-2">
        {foods?.map((f) => (
          <div key={f._id} className="card flex flex-wrap items-center gap-3 !p-3">
            {f.image ? <img src={f.image} alt={f.name} className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-forest/10 text-2xl">🍲</div>}
            <div className="min-w-[10rem] flex-1">
              <p className="font-semibold">{f.name}</p>
              <p className="text-xs text-ink/60">{f.category} · {f.prepTime} min</p>
            </div>
            <p className="font-mono font-bold">{naira(f.price)}</p>
            <button className={`rounded-full px-3 py-1 text-xs font-bold ${f.isAvailable ? 'bg-forest/15 text-forest-dark' : 'bg-ink/10 text-ink/60'}`} disabled={busy} onClick={() => toggle(f)}>{f.isAvailable ? 'Available' : 'Sold out'}</button>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => startEdit(f)}>Edit</button>
            <button className="btn-ghost !px-3 !py-1.5" disabled={busy} onClick={() => suggest(f._id)}>SEO text</button>
            <button className="btn-ghost !px-3 !py-1.5 !text-chili" disabled={busy} onClick={() => remove(f)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
