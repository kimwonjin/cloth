// Integration tests for RLS policies, triggers and storage rules.
// Runs against a local Supabase: `npx supabase start && npm run test:db`.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_ANON_KEY;
if (!KEY) throw new Error('Set SUPABASE_ANON_KEY (see `npx supabase status`).');

const run = Date.now().toString().slice(-8);

async function signUp(phone) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `u${phone}@phone.mycloset.app`,
    password: `mycloset-phone-${phone}`,
  });
  assert.equal(error, null);
  return { client, id: data.user.id };
}

const ok = (res) => {
  assert.equal(res.error, null, res.error?.message);
  return res.data;
};

describe('closet RLS', () => {
  let a;
  let b;
  let aTop;
  let aPrivateTop;
  let publicOutfit;
  let privateOutfit;

  before(async () => {
    a = await signUp(`0101${run}`);
    b = await signUp(`0102${run}`);
    aTop = ok(await a.client.from('clothes').insert({ image_path: `${a.id}/t.jpg`, category: 'top', color: 'white' }).select().single());
    aPrivateTop = ok(await a.client.from('clothes').insert({ image_path: `${a.id}/p.jpg`, category: 'top', color: 'red' }).select().single());
    publicOutfit = ok(await a.client.from('outfits').insert({ visibility: 'public' }).select().single());
    ok(await a.client.from('outfit_items').insert({ outfit_id: publicOutfit.id, clothing_id: aTop.id, slot: 'top' }));
    privateOutfit = ok(await a.client.from('outfits').insert({}).select().single());
    ok(await a.client.from('outfit_items').insert({ outfit_id: privateOutfit.id, clothing_id: aPrivateTop.id, slot: 'top' }));
  });

  it('creates a profile with a default nickname for each new user', async () => {
    const p = ok(await a.client.from('profiles').select('*').eq('id', a.id).single());
    assert.match(p.nickname, /^옷장러[0-9a-f]{4}$/);
  });

  it('sets published_at when an outfit is public and clears it when private', async () => {
    assert.ok(publicOutfit.published_at);
    assert.equal(privateOutfit.published_at, null);
  });

  it('shows public outfits to others but hides private ones', async () => {
    const rows = ok(await b.client.from('outfits').select('id').in('id', [publicOutfit.id, privateOutfit.id]));
    assert.deepEqual(rows.map((r) => r.id), [publicOutfit.id]);
  });

  it('shows clothes only when they are in a public outfit', async () => {
    const rows = ok(await b.client.from('clothes').select('id').eq('user_id', a.id));
    assert.deepEqual(rows.map((r) => r.id), [aTop.id]);
  });

  it('embeds items and owner nickname for public outfits', async () => {
    ok(await a.client.from('profiles').update({ nickname: '에이' }).eq('id', a.id));
    const o = ok(
      await b.client
        .from('outfits')
        .select('id, profile:profiles!outfits_user_id_fkey(nickname), items:outfit_items(slot, clothing:clothes(id))')
        .eq('id', publicOutfit.id)
        .single()
    );
    assert.equal(o.profile.nickname, '에이');
    assert.equal(o.items[0].clothing.id, aTop.id);
  });

  it("prevents editing someone else's outfit or profile", async () => {
    const upd = await b.client.from('outfits').update({ visibility: 'private' }).eq('id', publicOutfit.id).select();
    assert.deepEqual(upd.data, []);
    const prof = await b.client.from('profiles').update({ nickname: 'hacked' }).eq('id', a.id).select();
    assert.deepEqual(prof.data, []);
    const del = await b.client.from('clothes').delete().eq('id', aTop.id).select();
    assert.deepEqual(del.data, []);
  });

  it("prevents building an outfit from someone else's clothes", async () => {
    const mine = ok(await b.client.from('outfits').insert({}).select().single());
    const res = await b.client.from('outfit_items').insert({ outfit_id: mine.id, clothing_id: aTop.id, slot: 'top' });
    assert.ok(res.error, 'expected RLS violation');
    const res2 = await b.client
      .from('outfit_items')
      .insert({ outfit_id: publicOutfit.id, clothing_id: aTop.id, slot: 'top' });
    assert.ok(res2.error, 'expected RLS violation');
  });

  it('prevents creating rows on behalf of another user', async () => {
    const res = await b.client.from('clothes').insert({ user_id: a.id, image_path: 'x', category: 'top' });
    assert.ok(res.error);
  });

  it('keeps like_count in sync and allows only visible outfits', async () => {
    ok(await b.client.from('outfit_likes').insert({ outfit_id: publicOutfit.id }));
    let o = ok(await a.client.from('outfits').select('like_count').eq('id', publicOutfit.id).single());
    assert.equal(o.like_count, 1);
    ok(await b.client.from('outfit_likes').delete().eq('outfit_id', publicOutfit.id));
    o = ok(await a.client.from('outfits').select('like_count').eq('id', publicOutfit.id).single());
    assert.equal(o.like_count, 0);
    const res = await b.client.from('outfit_likes').insert({ outfit_id: privateOutfit.id });
    assert.ok(res.error, 'cannot like a private outfit');
  });

  it('keeps board saves private and blocks saving private outfits', async () => {
    ok(await b.client.from('board_saves').insert({ outfit_id: publicOutfit.id }));
    const seenByA = ok(await a.client.from('board_saves').select('*'));
    assert.equal(seenByA.length, 0);
    const res = await b.client.from('board_saves').insert({ outfit_id: privateOutfit.id });
    assert.ok(res.error);
  });

  it('isolates wear logs and allows one per day (upsert replaces)', async () => {
    ok(await a.client.from('wear_logs').upsert({ worn_on: '2026-10-01', outfit_id: privateOutfit.id }, { onConflict: 'user_id,worn_on' }));
    ok(await a.client.from('wear_logs').upsert({ worn_on: '2026-10-01', outfit_id: publicOutfit.id }, { onConflict: 'user_id,worn_on' }));
    const mine = ok(await a.client.from('wear_logs').select('*'));
    assert.equal(mine.length, 1);
    assert.equal(mine[0].outfit_id, publicOutfit.id);
    const theirs = ok(await b.client.from('wear_logs').select('*'));
    assert.equal(theirs.length, 0);
  });

  it('keeps the wear log when its outfit is deleted (outfit_id set null)', async () => {
    const tmp = ok(await a.client.from('outfits').insert({}).select().single());
    ok(await a.client.from('wear_logs').upsert({ worn_on: '2026-10-02', outfit_id: tmp.id }, { onConflict: 'user_id,worn_on' }));
    ok(await a.client.from('outfits').delete().eq('id', tmp.id));
    const log = ok(await a.client.from('wear_logs').select('*').eq('worn_on', '2026-10-02').single());
    assert.equal(log.outfit_id, null);
  });

  it('removes outfit items when a clothing item is deleted', async () => {
    const c = ok(await a.client.from('clothes').insert({ image_path: `${a.id}/d.jpg`, category: 'shoes' }).select().single());
    ok(await a.client.from('outfit_items').insert({ outfit_id: privateOutfit.id, clothing_id: c.id, slot: 'shoes' }));
    ok(await a.client.from('clothes').delete().eq('id', c.id));
    const items = ok(await a.client.from('outfit_items').select('*').eq('clothing_id', c.id));
    assert.equal(items.length, 0);
  });

  it('rejects invalid categories and seasons', async () => {
    const r1 = await a.client.from('clothes').insert({ image_path: 'x', category: 'hat' });
    assert.ok(r1.error);
    const r2 = await a.client.from('clothes').insert({ image_path: 'x', category: 'top', seasons: ['monsoon'] });
    assert.ok(r2.error);
  });

  it('lets users upload only into their own storage folder', async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const own = await a.client.storage.from('clothes').upload(`${a.id}/x-${run}.png`, png, { contentType: 'image/png' });
    assert.equal(own.error, null, own.error?.message);
    const other = await b.client.storage.from('clothes').upload(`${a.id}/y-${run}.png`, png, { contentType: 'image/png' });
    assert.ok(other.error, 'expected upload into another user folder to fail');
    const ootdOther = await b.client.storage.from('ootd').createSignedUrl(`${a.id}/x.png`, 60);
    assert.ok(ootdOther.error, 'cannot sign URLs for others’ private OOTD photos');
  });
});
