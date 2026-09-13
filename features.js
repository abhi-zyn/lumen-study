/* StudyForge feature pack: easy PDF upload, camera document scanner,
   public textbook library (admin-only uploads) and per-user Google Drive storage.
   Loaded by app.js, which passes in the small API it exposes as window.SF. */

const SF = window.SF
const $ = s => document.querySelector(s)
const esc = SF.esc
let sb = null
let isAdmin = false
let scanPages = []
let stream = null

/* ---------- tiny css (kept here so styles.css stays untouched) ---------- */
const css = [
  '.sf-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px}',
  '.sf-drop{border:1px dashed var(--line-2);border-radius:14px;padding:22px;text-align:center;color:var(--txt);background:var(--surface);cursor:pointer;transition:.15s}',
  '.sf-drop.over{border-color:var(--accent);background:var(--accent-soft)}',
  '.sf-drop small{display:block;opacity:.6;margin-top:4px}',
  '.sf-sub{font-size:12px;opacity:.6;margin:18px 0 10px;text-transform:uppercase;letter-spacing:.08em}',
  '.sf-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}',
  '.sf-row{display:flex;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px}',
  '.sf-row .sf-t{flex:1;min-width:0}',
  '.sf-row .sf-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.sf-row .sf-t span{font-size:12px;opacity:.6}',
  '.sf-chip{font-size:11px;border:1px solid var(--line-2);border-radius:999px;padding:3px 9px;opacity:.85}',
  '.sf-camwrap{position:relative;width:100%;max-width:760px;margin:0 auto}',
  '.sf-cam{width:100%;max-height:58vh;aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:#000;display:block;transition:filter .15s}',
  '.sf-shutter{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;border:4px solid rgba(255,255,255,.9);background:rgba(255,255,255,.3);cursor:pointer}',
  '.sf-shutter:active{transform:translateX(-50%) scale(.93)}',
  '.sf-shutter:disabled{opacity:.3;cursor:default}',
  '.sf-camhint{position:absolute;left:0;right:0;top:46%;text-align:center;color:#fff;opacity:.75;font-size:13px;pointer-events:none}',
  '.view[data-view="scan"],.view[data-view="docs"]{padding-bottom:160px}',
  '.sf-crop{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;overflow:auto}',
  '.sf-crop .box{position:relative;touch-action:none;line-height:0}',
  '.sf-crop img{max-width:92vw;max-height:62vh;border-radius:8px;display:block;user-select:none}',
  '.sf-crop .sel{position:absolute;border:2px solid var(--accent);background:rgba(124,156,255,.18);pointer-events:none}',
  '.sf-thumbs{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}',
  '.sf-thumb{position:relative;width:92px;height:122px;border-radius:8px;overflow:hidden;border:1px solid var(--line-2);cursor:pointer}',
  '.sf-thumb img{width:100%;height:100%;object-fit:cover}',
  '.sf-thumb button{position:absolute;top:3px;right:3px;border:0;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;width:20px;height:20px;line-height:1}',
  '.sf-msg{margin-top:12px;font-size:13px;opacity:.85}',
  '.sf-msg.err{color:var(--red)}',
].join('')

/* ---------- markup injected into the existing shell ---------- */
const booksExtra =
  '<div class="sf-bar">' +
  '<button class="btn btn-primary" id="sfLibAdd" hidden>Upload to library</button>' +
  '<button class="btn btn-ghost" id="sfGoScan">Scan with camera</button>' +
  '<button class="btn btn-ghost" id="sfGoDocs">My PDF notes</button>' +
  '<span class="sf-chip" id="sfLibRole">public library</span>' +
  '<input type="file" id="sfLibFile" accept="application/pdf" multiple hidden />' +
  '</div>' +
  '<div class="sf-msg" id="sfLibMsg" hidden></div>' +
  '<div class="grid books" id="sfLibGrid"></div>' +
  '<div class="sf-sub">On this device</div>'

const docsView =
  '<section class="view" data-view="docs">' +
  '<div class="view-head"><div><h2>PDF notes</h2>' +
  '<p class="muted">Your own PDFs \u2014 handwritten notes, question papers, scans. Separate from the shared textbook library.</p></div>' +
  '<label class="btn btn-primary">Add PDF<input type="file" id="sfDocFile" accept="application/pdf" multiple hidden /></label></div>' +
  '<div class="sf-bar"><span class="sf-chip" id="sfStoreChip">storage: checking\u2026</span>' +
  '<button class="btn btn-ghost sm" id="sfDriveConnect" hidden>Connect Google Drive</button>' +
  '<button class="btn btn-ghost sm" id="sfGoScan2">Scan a document</button></div>' +
  '<div class="sf-drop" id="sfDocDrop">Drop PDFs here or click to choose<small>Files go to your own Google Drive when connected, otherwise to your private Supabase folder</small></div>' +
  '<div class="sf-msg" id="sfDocMsg" hidden></div>' +
  '<div class="sf-sub">Saved documents</div>' +
  '<ul class="sf-list" id="sfDocList"></ul>' +
  '</section>'

const scanView =
  '<section class="view" data-view="scan">' +
  '<div class="view-head"><div><h2>Document scanner</h2>' +
  '<p class="muted">Photograph pages, clean them up, save as one PDF.</p></div></div>' +
  '<div class="sf-bar">' +
  '<button class="btn btn-primary" id="sfCamStart">Start camera</button>' +
  '<label class="btn btn-ghost">From gallery<input type="file" id="sfShotFile" accept="image/*" capture="environment" multiple hidden /></label>' +
  '<select class="select" id="sfFilter">' +
  '<option value="scan">Filter: Scan (crisp)</option>' +
  '<option value="gray">Filter: Greyscale</option>' +
  '<option value="bw">Filter: Black &amp; white</option>' +
  '<option value="original">Filter: Original colour</option>' +
  '</select></div>' +
  '<div class="sf-camwrap"><video class="sf-cam" id="sfCam" playsinline muted></video>' +
  '<button class="sf-shutter" id="sfShoot" disabled aria-label="Capture page"></button>' +
  '<div class="sf-camhint" id="sfCamHint">Tap here to start the camera</div></div>' +
  '<div class="sf-thumbs" id="sfThumbs"></div>' +
  '<div class="sf-bar" style="margin-top:16px">' +
  '<div class="field"><label>PDF name</label><input id="sfScanName" placeholder="Physics notes 13 Sep" /></div>' +
  '<select class="select" id="sfScanDest"><option value="note">Save to PDF notes</option>' +
  '<option value="library">Save to public library (admin)</option></select>' +
  '<button class="btn btn-primary" id="sfMakePdf" disabled>Make PDF</button>' +
  '<button class="btn btn-ghost" id="sfScanClear">Clear pages</button></div>' +
  '<div class="sf-msg" id="sfScanMsg" hidden></div>' +
  '</section>'

function inject() {
  const style = document.createElement('style'); style.textContent = css
  document.head.appendChild(style)

  const booksView = document.querySelector('.view[data-view="books"]')
  const wrap = document.createElement('div'); wrap.innerHTML = booksExtra
  booksView.insertBefore(wrap, $('#bookGrid'))
  $('#scroll').insertAdjacentHTML('beforeend', docsView + scanView)

  const booksNav = document.querySelectorAll('.nav-item[data-view="books"]')[0]
  const mk = (view, label) => {
    const b = document.createElement('button')
    b.className = 'nav-item'; b.dataset.view = view; b.textContent = label
    b.onclick = () => { location.hash = view; window.lumenGo(view) }
    return b
  }
  booksNav.parentNode.insertBefore(mk('docs', 'PDF notes'), booksNav.nextSibling)
  booksNav.parentNode.insertBefore(mk('scan', 'Scanner'), booksNav.nextSibling)
}

/* ---------- helpers ---------- */
const msg = (sel, text, err) => {
  const el = $(sel); el.hidden = !text; el.textContent = text || ''
  el.classList.toggle('err', !!err)
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document'
const kb = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB')

function signIn(withDrive) {
  const options = { redirectTo: location.origin + location.pathname }
  if (withDrive) {
    options.scopes = 'https://www.googleapis.com/auth/drive.file'
    options.queryParams = { prompt: 'consent' }
  }
  return sb.auth.signInWithOAuth({ provider: 'google', options: options })
}

function driveToken() {
  const t = SF.LS.get('sf.gtoken', null)
  return t && t.exp > Date.now() ? t.token : null
}

async function driveFolderId(token) {
  const q = "name='StudyForge' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q), {
    headers: { Authorization: 'Bearer ' + token },
  })
  if (r.status === 401) throw new Error('drive-auth')
  const j = await r.json()
  if (j.files && j.files.length) return j.files[0].id
  const c = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'StudyForge', mimeType: 'application/vnd.google-apps.folder' }),
  })
  return (await c.json()).id
}

async function driveUpload(blob, name) {
  const token = driveToken()
  if (!token) throw new Error('drive-auth')
  const parent = await driveFolderId(token)
  const meta = new Blob([JSON.stringify({ name: name, parents: [parent] })], { type: 'application/json' })
  const form = new FormData()
  form.append('metadata', meta)
  form.append('file', blob, name)
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
  })
  if (r.status === 401) throw new Error('drive-auth')
  if (!r.ok) throw new Error('Drive upload failed (' + r.status + ')')
  return r.json()
}

async function driveBlobUrl(id) {
  const token = driveToken()
  if (!token) throw new Error('drive-auth')
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token },
  })
  if (r.status === 401) throw new Error('drive-auth')
  if (!r.ok) throw new Error('Could not read that file from Drive (' + r.status + ')')
  return URL.createObjectURL(await r.blob())
}

/* ---------- storage router ----------
   Public textbooks  -> Supabase bucket 'library' (admin uploads, everyone reads)
   Personal PDFs     -> the user's own Google Drive (drive.file scope)
                        falling back to their private Supabase folder */
async function savePersonal(blob, title, kind, pages) {
  let row = { title: title, kind: kind || 'note', pages: pages || 0, size_bytes: blob.size }
  if (driveToken()) {
    const f = await driveUpload(blob, slug(title) + '.pdf')
    row.source = 'drive'; row.drive_id = f.id
  } else {
    const path = SF.state.user.id + '/' + Date.now() + '-' + slug(title) + '.pdf'
    const up = await sb.storage.from('textbooks').upload(path, blob, { contentType: 'application/pdf' })
    if (up.error) throw new Error(up.error.message)
    row.source = 'supabase'; row.storage_path = path
  }
  const res = await sb.from('documents').insert(row).select().single()
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function saveLibrary(blob, title, pages) {
  const path = 'books/' + Date.now() + '-' + slug(title) + '.pdf'
  const up = await sb.storage.from('library').upload(path, blob, { contentType: 'application/pdf' })
  if (up.error) throw new Error(up.error.message)
  const res = await sb.from('library_books')
    .insert({ title: title, storage_path: path, pages: pages || 0, cover_hue: Math.floor(Math.random() * 360) })
    .select().single()
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ---------- public library view ---------- */
async function renderLibrary() {
  if (!sb) { $('#sfLibGrid').innerHTML = '<p class="muted">Sign in to load the shared library.</p>'; return }
  const { data, error } = await sb.from('library_books').select('*').order('created_at', { ascending: false })
  if (error) { msg('#sfLibMsg', error.message, true); return }
  if (!data.length) {
    $('#sfLibGrid').innerHTML = '<p class="muted">No shared textbooks yet' + (isAdmin ? ' \u2014 use "Upload to library".' : '.') + '</p>'
    return
  }
  $('#sfLibGrid').innerHTML = data.map(b =>
    '<article class="book" data-lib="' + b.id + '">' +
    '<div class="cover" style="background:linear-gradient(150deg,hsl(' + b.cover_hue + ' 52% 30%),hsl(' + ((b.cover_hue + 40) % 360) + ' 45% 18%))">&#9776;</div>' +
    '<div class="book-body"><div class="book-t">' + esc(b.title) + '</div>' +
    '<div class="book-s">shared' + (b.pages ? ' \u00b7 ' + b.pages + ' pages' : '') + '</div></div></article>').join('')
  $('#sfLibGrid').querySelectorAll('[data-lib]').forEach(el => {
    el.onclick = () => {
      const b = data.filter(x => x.id === el.dataset.lib)[0]
      const url = sb.storage.from('library').getPublicUrl(b.storage_path).data.publicUrl
      SF.openPdfUrl(b.title, url, 'lib-' + b.id)
    }
  })
}

/* ---------- personal PDF notes view ---------- */
async function renderDocs() {
  const chip = $('#sfStoreChip')
  const onDrive = !!driveToken()
  chip.textContent = onDrive ? 'storage: your Google Drive' : 'storage: private Supabase folder'
  $('#sfDriveConnect').hidden = onDrive
  if (!sb || !SF.state.user) { $('#sfDocList').innerHTML = '<li class="muted">Sign in to save PDFs.</li>'; return }
  const { data, error } = await sb.from('documents').select('*').order('created_at', { ascending: false })
  if (error) { msg('#sfDocMsg', error.message, true); return }
  if (!data.length) { $('#sfDocList').innerHTML = '<li class="muted">Nothing saved yet.</li>'; return }
  $('#sfDocList').innerHTML = data.map(d =>
    '<li class="sf-row" data-doc="' + d.id + '">' +
    '<div class="sf-t"><b>' + esc(d.title) + '</b><span>' + d.kind + ' \u00b7 ' +
    (d.size_bytes ? kb(d.size_bytes) + ' \u00b7 ' : '') + new Date(d.created_at).toLocaleDateString() + '</span></div>' +
    '<span class="sf-chip">' + (d.source === 'drive' ? 'Drive' : 'Supabase') + '</span>' +
    '<button class="btn btn-ghost sm" data-opendoc="' + d.id + '">Open</button>' +
    '<button class="x" data-deldoc="' + d.id + '" title="Delete">&times;</button></li>').join('')
  $('#sfDocList').querySelectorAll('[data-opendoc]').forEach(btn => {
    btn.onclick = async () => {
      const d = data.filter(x => x.id === btn.getAttribute('data-opendoc'))[0]
      try {
        let url
        if (d.source === 'drive') url = await driveBlobUrl(d.drive_id)
        else {
          const signed = await sb.storage.from('textbooks').createSignedUrl(d.storage_path, 3600)
          if (signed.error) throw new Error(signed.error.message)
          url = signed.data.signedUrl
        }
        SF.openPdfUrl(d.title, url, 'doc-' + d.id)
      } catch (err) { msg('#sfDocMsg', err.message === 'drive-auth' ? 'Google Drive access expired \u2014 press Connect Google Drive again.' : err.message, true) }
    }
  })
  $('#sfDocList').querySelectorAll('[data-deldoc]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-deldoc')
      const d = data.filter(x => x.id === id)[0]
      if (!confirm('Delete "' + d.title + '" from StudyForge?')) return
      if (d.source === 'supabase' && d.storage_path) await sb.storage.from('textbooks').remove([d.storage_path])
      await sb.from('documents').delete().eq('id', id)
      renderDocs()
    }
  })
}

async function addFiles(files, dest) {
  const list = Array.prototype.slice.call(files).filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name))
  if (!list.length) return
  const target = dest === 'library' ? '#sfLibMsg' : '#sfDocMsg'
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    msg(target, 'Uploading ' + f.name + ' (' + (i + 1) + '/' + list.length + ')\u2026')
    try {
      const title = f.name.replace(/\.pdf$/i, '')
      if (dest === 'library') await saveLibrary(f, title, 0)
      else await savePersonal(f, title, 'note', 0)
    } catch (err) {
      msg(target, (err.message === 'drive-auth' ? 'Google Drive access expired \u2014 press Connect Google Drive again.' : err.message), true)
      return
    }
  }
  msg(target, 'Saved ' + list.length + ' file' + (list.length > 1 ? 's' : '') + '.')
  if (dest === 'library') renderLibrary(); else renderDocs()
}

/* ---------- camera scanner ---------- */
function applyFilter(ctx, w, h, mode) {
  if (mode === 'original') return
  const img = ctx.getImageData(0, 0, w, h), d = img.data
  const g = new Uint8ClampedArray(w * h)
  let min = 255, max = 0
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    g[p] = v; if (v < min) min = v; if (v > max) max = v
  }
  if (mode === 'gray') {
    for (let i = 0, p = 0; i < d.length; i += 4, p++) { d[i] = d[i + 1] = d[i + 2] = g[p] }
  } else if (mode === 'scan') {
    const range = Math.max(1, max - min)
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let v = ((g[p] - min) / range) * 255
      v = (v - 128) * 1.45 + 148
      v = v < 0 ? 0 : v > 255 ? 255 : v
      d[i] = d[i + 1] = d[i + 2] = v
    }
  } else if (mode === 'bw') {
    const hist = new Array(256).fill(0)
    for (let p = 0; p < g.length; p++) hist[g[p]]++
    let total = 0
    for (let t = 0; t < 256; t++) total += t * hist[t]
    let sumB = 0, wB = 0, best = 0, thr = 128
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue
      const wF = g.length - wB; if (!wF) break
      sumB += t * hist[t]
      const between = wB * wF * Math.pow(sumB / wB - (total - sumB) / wF, 2)
      if (between > best) { best = between; thr = t }
    }
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = g[p] > thr ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
  ctx.putImageData(img, 0, 0)
}

const loadImg = src => new Promise((res, rej) => {
  const i = new Image()
  i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image.'))
  i.src = src
})

// Live preview filter: CSS approximation of the pixel filters used for the PDF.
const camCss = mode =>
  mode === 'scan' ? 'grayscale(1) contrast(1.55) brightness(1.12)'
    : mode === 'gray' ? 'grayscale(1)'
      : mode === 'bw' ? 'grayscale(1) contrast(6) brightness(1.06)'
        : 'none'

async function reprocess(p) {
  const img = await loadImg(p.raw)
  const c = p.crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(c.w)); cv.height = Math.max(1, Math.round(c.h))
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height)
  applyFilter(ctx, cv.width, cv.height, p.filter)
  p.data = cv.toDataURL('image/jpeg', 0.86); p.w = cv.width; p.h = cv.height
}

async function pushScan(source, w, h) {
  const max = 1600
  const scale = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale); c.height = Math.round(h * scale)
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height)
  const p = { raw: c.toDataURL('image/jpeg', 0.92), filter: $('#sfFilter').value, crop: null }
  scanPages.push(p)
  await reprocess(p)
  renderThumbs()
}

function renderThumbs() {
  $('#sfThumbs').innerHTML = scanPages.map((p, i) =>
    '<div class="sf-thumb" data-crop="' + i + '" title="Tap to crop"><img src="' + p.data + '" alt="page ' + (i + 1) + '" />' +
    '<button data-drop="' + i + '" title="Remove">&times;</button></div>').join('')
  $('#sfThumbs').querySelectorAll('[data-drop]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); scanPages.splice(Number(b.dataset.drop), 1); renderThumbs() }
  })
  $('#sfThumbs').querySelectorAll('[data-crop]').forEach(t => {
    t.onclick = () => openCrop(Number(t.dataset.crop))
  })
  $('#sfMakePdf').disabled = scanPages.length === 0
  if (scanPages.length) msg('#sfScanMsg', scanPages.length + ' page(s) ready \u00b7 tap a page to crop or re-filter it.')
}

async function openCrop(i) {
  const p = scanPages[i]
  const img = await loadImg(p.raw)
  const wrap = document.createElement('div')
  wrap.className = 'sf-crop'
  wrap.innerHTML =
    '<div class="box"><img src="' + p.raw + '" alt="page" /><div class="sel" hidden></div></div>' +
    '<div class="sf-bar" style="justify-content:center;margin:0">' +
    '<select class="select" id="sfCropFilter">' +
    '<option value="scan">Scan (crisp)</option><option value="gray">Greyscale</option>' +
    '<option value="bw">Black &amp; white</option><option value="original">Original colour</option></select>' +
    '<button class="btn btn-primary" id="sfCropOk">Apply</button>' +
    '<button class="btn btn-ghost" id="sfCropReset">Full page</button>' +
    '<button class="btn btn-ghost" id="sfCropCancel">Cancel</button></div>' +
    '<div class="sf-msg" style="color:#fff">Drag across the image to keep only the page area.</div>'
  document.body.appendChild(wrap)
  const im = wrap.querySelector('img'), sel = wrap.querySelector('.sel')
  wrap.querySelector('#sfCropFilter').value = p.filter
  let sx = 0, sy = 0, rect = null, drag = false
  const at = e => {
    const r = im.getBoundingClientRect()
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
      vw: r.width, vh: r.height,
    }
  }
  im.addEventListener('pointerdown', e => { e.preventDefault(); const q = at(e); sx = q.x; sy = q.y; drag = true; sel.hidden = false })
  wrap.addEventListener('pointermove', e => {
    if (!drag) return
    e.preventDefault()
    const q = at(e)
    const x = Math.min(sx, q.x), y = Math.min(sy, q.y), w = Math.abs(q.x - sx), h = Math.abs(q.y - sy)
    sel.style.left = x + 'px'; sel.style.top = y + 'px'; sel.style.width = w + 'px'; sel.style.height = h + 'px'
    rect = { x: x, y: y, w: w, h: h, vw: q.vw, vh: q.vh }
  })
  wrap.addEventListener('pointerup', () => { drag = false })
  wrap.querySelector('#sfCropReset').onclick = () => { rect = null; p.crop = null; sel.hidden = true }
  wrap.querySelector('#sfCropCancel').onclick = () => wrap.remove()
  wrap.querySelector('#sfCropOk').onclick = async () => {
    p.filter = wrap.querySelector('#sfCropFilter').value
    if (rect && rect.w > 12 && rect.h > 12) {
      const k = img.naturalWidth / rect.vw
      p.crop = { x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k }
    }
    wrap.remove()
    await reprocess(p)
    renderThumbs()
  }
}

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve()
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = res; s.onerror = () => rej(new Error('Could not load the PDF builder.'))
    document.head.appendChild(s)
  })
}

async function buildPdf() {
  await loadJsPdf()
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297, M = 6
  scanPages.forEach((p, i) => {
    if (i) doc.addPage()
    const ratio = Math.min((PW - M * 2) / p.w, (PH - M * 2) / p.h)
    const w = p.w * ratio, h = p.h * ratio
    doc.addImage(p.data, 'JPEG', (PW - w) / 2, (PH - h) / 2, w, h)
  })
  return doc.output('blob')
}

async function startCam() {
  const v = $('#sfCam')
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg('#sfScanMsg', 'This browser has no camera API' + (location.protocol === 'https:' ? '' : ' \u2014 the page must be served over https') + '. Use "From gallery" instead.', true)
    return
  }
  const tries = [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ]
  let lastErr = null
  for (let i = 0; i < tries.length; i++) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(tries[i])
      break
    } catch (err) { lastErr = err; stream = null }
  }
  if (!stream) {
    const name = lastErr && lastErr.name
    const why = name === 'NotAllowedError' ? 'permission was denied \u2014 tap the padlock in the address bar and allow Camera, then press Start camera again'
      : name === 'NotFoundError' ? 'no camera was found on this device'
      : name === 'NotReadableError' ? 'another app is already using the camera'
      : (lastErr ? lastErr.message : 'unknown error')
    msg('#sfScanMsg', 'Camera could not start: ' + why + '. You can still use "From gallery" to pick photos.', true)
    return
  }
  v.srcObject = stream
  v.setAttribute('autoplay', '')
  v.setAttribute('playsinline', '')
  v.muted = true
  try { await v.play() } catch (e) { /* Safari resolves on user gesture */ }
  $('#sfShoot').disabled = false
  $('#sfCamHint').hidden = true
  msg('#sfScanMsg', 'Frame a page and tap the round shutter. Add as many pages as you like.')
}

async function stopCam() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  const shoot = $('#sfShoot'); if (shoot) shoot.disabled = true
  const hint = $('#sfCamHint'); if (hint) hint.hidden = false
}

/* ---------- wiring ---------- */
function wire() {
  $('#sfGoScan').onclick = () => { location.hash = 'scan'; window.lumenGo('scan') }
  $('#sfGoScan2').onclick = () => { location.hash = 'scan'; window.lumenGo('scan') }
  $('#sfGoDocs').onclick = () => { location.hash = 'docs'; window.lumenGo('docs') }
  $('#sfLibAdd').onclick = () => $('#sfLibFile').click()
  $('#sfLibFile').onchange = e => { addFiles(e.target.files, 'library'); e.target.value = '' }
  $('#sfDocFile').onchange = e => { addFiles(e.target.files, 'docs'); e.target.value = '' }

  const drop = $('#sfDocDrop')
  drop.onclick = () => $('#sfDocFile').click()
  ;['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over') }))
  ;['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over') }))
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files, 'docs'))

  // Plain Google sign-in (no Drive scope): Google blocks the sign-in screen if a
  // sensitive scope is requested before the Drive API/scope is approved.
  $('#authBtn').onclick = async () => {
    if (!sb) { window.lumenGo('settings'); return }
    if (SF.state.user) { await sb.auth.signOut(); location.reload(); return }
    signIn(false)
  }
  $('#sfDriveConnect').onclick = () => {
    if (!sb) { window.lumenGo('settings'); return }
    msg('#sfDocMsg', 'Asking Google for Drive access\u2026 if this is blocked, enable the Drive API and add the drive.file scope in Google Cloud first.')
    signIn(true)
  }

  $('#sfCamStart').onclick = startCam
  $('#sfCam').onclick = () => { if (!stream) startCam() }
  $('#sfShoot').onclick = e => {
    e.stopPropagation()
    const v = $('#sfCam')
    if (!v.videoWidth) return
    pushScan(v, v.videoWidth, v.videoHeight)
  }
  $('#sfCam').style.filter = camCss($('#sfFilter').value)
  $('#sfFilter').onchange = () => { $('#sfCam').style.filter = camCss($('#sfFilter').value) }
  $('#sfShotFile').onchange = async e => {
    const files = Array.prototype.slice.call(e.target.files)
    e.target.value = ''
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i])
      try { const img = await loadImg(url); await pushScan(img, img.naturalWidth, img.naturalHeight) } catch (err) { msg('#sfScanMsg', err.message, true) }
      URL.revokeObjectURL(url)
    }
  }
  $('#sfScanClear').onclick = () => { scanPages = []; renderThumbs() }
  $('#sfMakePdf').onclick = async () => {
    if (!scanPages.length) return
    const dest = $('#sfScanDest').value
    const title = ($('#sfScanName').value || 'Scan ' + new Date().toLocaleDateString()).trim()
    if (dest === 'library' && !isAdmin) { msg('#sfScanMsg', 'Only the library admin can publish to the shared library.', true); return }
    msg('#sfScanMsg', 'Building PDF from ' + scanPages.length + ' page(s)\u2026')
    try {
      const blob = await buildPdf()
      if (dest === 'library') await saveLibrary(blob, title, scanPages.length)
      else await savePersonal(blob, title, 'scan', scanPages.length)
      scanPages = []; renderThumbs(); $('#sfScanName').value = ''
      await stopCam()
      msg('#sfScanMsg', 'Saved "' + title + '".')
      if (dest === 'library') renderLibrary(); else renderDocs()
    } catch (err) {
      msg('#sfScanMsg', err.message === 'drive-auth' ? 'Google Drive access expired \u2014 press Connect Google Drive again.' : err.message, true)
    }
  }

  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1)
    if (v === 'docs') renderDocs()
    if (v === 'books') renderLibrary()
    if (v !== 'scan') stopCam()
  })
}

/* ---------- boot ---------- */
async function boot() {
  inject(); wire()
  for (let i = 0; i < 40 && !SF.client(); i++) await new Promise(r => setTimeout(r, 250))
  sb = SF.client()
  if (!sb) return
  wire()
  for (let i = 0; i < 20 && !SF.state.user; i++) await new Promise(r => setTimeout(r, 250))
  if (SF.state.user) {
    const res = await sb.rpc('is_admin')
    isAdmin = res.data === true
  }
  $('#sfLibAdd').hidden = !isAdmin
  $('#sfLibRole').textContent = isAdmin ? 'admin \u00b7 you can publish' : 'public library \u00b7 read only'
  renderLibrary(); renderDocs()
}

boot()
