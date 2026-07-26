function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
        {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]
    ));
}

function formatBitrate(bps) {
    if (bps >= 1_000_000) return `${(bps / 1e6).toFixed(1)} Mbps`;
    if (bps > 0) return `${Math.round(bps / 1000)} kbps`;
    return '';
}

function layout({title, body}) {
    return `<!doctype html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="h-full bg-slate-950 text-slate-100 antialiased">
${body}
</body>
</html>`;
}

function navLink(href, label, active) {
    const isActive = active === href;
    const cls = isActive
        ? 'text-white border-b-2 border-indigo-500'
        : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent';
    return `<a href="${href}" class="text-sm pb-1 transition ${cls}">${escapeHtml(label)}</a>`;
}

function header({user, active = ''} = {}) {
    return `
<header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
  <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
    <div class="flex items-center gap-6">
      <a href="/playlists" class="flex items-center gap-2 group shrink-0">
        <span class="inline-block h-2 w-2 rounded-full bg-indigo-400"></span>
        <span class="text-sm uppercase tracking-widest text-slate-300 group-hover:text-white">AceStream Proxy</span>
      </a>
      <nav class="flex items-center gap-4">
        ${navLink('/playlists', 'Playlists', active)}
        ${navLink('/search', 'Search', active)}
        ${navLink('/settings', 'Settings', active)}
      </nav>
    </div>
    <div class="flex items-center gap-4 text-sm text-slate-400">
      <span id="engine-badge" class="hidden items-center gap-1.5 text-xs px-2 py-1 rounded-full border"></span>
      <span>Signed in as <span class="text-slate-200">${escapeHtml(user)}</span></span>
      <form method="post" action="/logout">
        <button class="text-slate-300 hover:text-white underline underline-offset-4 decoration-slate-600 hover:decoration-white">Sign out</button>
      </form>
    </div>
  </div>
</header>
<script>
(function() {
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  var badge = document.getElementById('engine-badge');
  if (!badge) return;
  fetch('/api/engine/status')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        badge.className = 'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-emerald-800 bg-emerald-950/40 text-emerald-400';
        badge.innerHTML = '<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>Engine ' + escHtml(d.version);
      } else {
        badge.className = 'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-rose-800 bg-rose-950/40 text-rose-400';
        badge.innerHTML = '<span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-400"></span>Engine offline';
      }
    })
    .catch(function() {
      badge.className = 'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-rose-800 bg-rose-950/40 text-rose-400';
      badge.innerHTML = '<span class="inline-block h-1.5 w-1.5 rounded-full bg-rose-400"></span>Engine offline';
    });
})();
</script>`;
}

function renderLogin({error} = {}) {
    const errorBlock = error
        ? `<div role="alert" class="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">${escapeHtml(error)}</div>`
        : '';
    return layout({
        title: 'AceStream Proxy — Sign in',
        body: `
<main class="min-h-full flex items-center justify-center p-6">
  <form method="post" action="/login" autocomplete="on"
        class="w-full max-w-sm bg-slate-900/60 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur p-8 space-y-6">
    <div>
      <div class="inline-flex items-center gap-2 text-indigo-400">
        <span class="inline-block h-2 w-2 rounded-full bg-indigo-400"></span>
        <span class="text-xs uppercase tracking-widest">AceStream Proxy</span>
      </div>
      <h1 class="mt-2 text-2xl font-semibold">Sign in</h1>
      <p class="mt-1 text-sm text-slate-400">Enter your credentials to continue.</p>
    </div>
    ${errorBlock}
    <label class="block">
      <span class="text-sm text-slate-300">Username</span>
      <input name="username" type="text" autocomplete="username" required autofocus
             class="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
    </label>
    <label class="block">
      <span class="text-sm text-slate-300">Password</span>
      <input name="password" type="password" autocomplete="current-password" required
             class="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
    </label>
    <button type="submit"
            class="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 px-4 py-2 text-sm font-medium transition">
      Sign in
    </button>
  </form>
</main>`,
    });
}

function parseFlash(flash) {
    if (!flash) return null;
    const [kind, ...rest] = String(flash).split(':');
    const target = rest.join(':');
    if (kind === 'created') return `Playlist created.`;
    if (kind === 'updated') return `Playlist settings saved.`;
    if (kind === 'stream-kind-saved') return 'Stream kind saved.';
    if (kind === 'category-added') return 'Category added.';
    if (kind === 'category-updated') return 'Category updated.';
    if (kind === 'category-removed') return 'Category removed.';
    if (kind === 'channel-added') return 'Channel added.';
    if (kind === 'channel-removed') return 'Channel removed.';
    if (kind === 'channel-updated') return 'Channel renamed.';
    if (kind === 'availability-refreshed') return 'Availability refreshed.';
    return null;
}

function playlistCard({playlist, baseUrl}) {
    const idAttr = escapeHtml(playlist.id);
    const url = `${baseUrl}/${playlist.id}/playlist.m3u8`;
    const urlHtml = escapeHtml(url);
    const catCount = (playlist.categories || []).length;
    const chCount = (playlist.channels || []).length;
    const stats = `${catCount} categor${catCount === 1 ? 'y' : 'ies'} · ${chCount} channel${chCount === 1 ? '' : 's'}`;
    return `
<div class="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4">
  <div class="flex-1 min-w-0 space-y-1.5">
    <h3 class="text-sm font-semibold">${escapeHtml(playlist.name)}</h3>
    <p class="text-xs text-slate-500">${stats}</p>
    <div class="flex items-center gap-2">
      <a class="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate max-w-sm"
         href="/${idAttr}/playlist.m3u8">${urlHtml}</a>
      <button type="button" data-copy="${urlHtml}"
              class="shrink-0 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5">Copy</button>
    </div>
  </div>
  <div class="flex items-center gap-4 shrink-0">
    <a href="/playlists/${idAttr}"
       class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium">Configure</a>
    <form method="post" action="/playlists/${idAttr}/delete"
          onsubmit="return confirm('Delete this playlist? The public URL will stop working.');">
      <button class="text-sm text-rose-400 hover:text-rose-300">Delete</button>
    </form>
  </div>
</div>`;
}

function renderPlaylists({user, playlists = [], baseUrl, flash, error} = {}) {
    const flashMsg = parseFlash(flash);
    const flashBlock = flashMsg
        ? `<div role="status" class="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2">${escapeHtml(flashMsg)}</div>`
        : '';
    const errorBlock = error
        ? `<div role="alert" class="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">${escapeHtml(error)}</div>`
        : '';

    const table = playlists.length ? `
<div class="space-y-3">${playlists.map((p) => playlistCard({playlist: p, baseUrl})).join('')}</div>` : `
<div class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center text-slate-400">
  No playlists yet. Create one to get started.
</div>`;

    return layout({
        title: 'AceStream Proxy — Playlists',
        body: `
${header({user, active: '/playlists'})}
<main class="max-w-6xl mx-auto px-6 py-8 space-y-6">
  ${flashBlock}${errorBlock}
  <section class="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
    <div>
      <h1 class="text-2xl font-semibold">Playlists</h1>
      <p class="mt-1 text-sm text-slate-400 max-w-xl">
        Each playlist gets a random public URL. The ID doubles as a bearer token — anyone with the link can fetch the playlist, so treat it like a password.
      </p>
    </div>
    <form method="post" action="/playlists" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <label class="sm:w-64">
        <span class="sr-only">Name</span>
        <input name="name" placeholder="Playlist name (optional)"
               class="w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
      </label>
      <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium">Create</button>
    </form>
  </section>
  ${table}
</main>
<script>
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });
</script>
`,
    });
}

function pickLogoUrl(icons) {
    if (!Array.isArray(icons) || icons.length === 0) return '';
    const primary = icons.find((i) => i && i.type === 0 && i.url);
    if (primary) return primary.url;
    const any = icons.find((i) => i && i.url);
    return any ? any.url : '';
}

function statusPill(status) {
    if (status === 2) return `<span class="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded px-1.5 py-0.5"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>Green</span>`;
    if (status === 1) return `<span class="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded px-1.5 py-0.5"><span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>Yellow</span>`;
    return `<span class="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded px-1.5 py-0.5"><span class="h-1.5 w-1.5 rounded-full bg-slate-500"></span>Unknown</span>`;
}

function availabilityBar(v) {
    const val = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    const pct = Math.round(val * 100);
    const color = pct >= 66 ? 'bg-emerald-500' : pct >= 33 ? 'bg-amber-500' : 'bg-rose-500';
    return `<div class="flex items-center gap-2">
      <div class="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full ${color}" style="width: ${pct}%"></div>
      </div>
      <span class="text-xs text-slate-400 tabular-nums">${pct}%</span>
    </div>`;
}

function tagPills(items, {emphasis = false} = {}) {
    const cls = emphasis
        ? 'text-[10px] uppercase tracking-wider text-indigo-300 bg-indigo-950/40 border border-indigo-900/60 rounded px-1.5 py-0.5'
        : 'text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900/60 border border-slate-800 rounded px-1.5 py-0.5';
    return (items || [])
        .filter(Boolean)
        .map((v) => `<span class="${cls}">${escapeHtml(v)}</span>`)
        .join(' ');
}

function paginationLink({form, page, label, disabled}) {
    const params = new URLSearchParams();
    if (form.query) params.set('q', form.query);
    if (form.category) params.set('category', form.category);
    if (form.target) params.set('target', form.target);
    params.set('page_size', String(form.pageSize));
    params.set('page', String(page));
    const cls = disabled
        ? 'text-sm text-slate-600 bg-slate-900/40 border border-slate-800 rounded px-3 py-1.5 cursor-not-allowed'
        : 'text-sm text-slate-200 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-700 rounded px-3 py-1.5';
    if (disabled) return `<span class="${cls}">${escapeHtml(label)}</span>`;
    return `<a href="/search?${params.toString()}" class="${cls}">${escapeHtml(label)}</a>`;
}

function buildTargetOptions(playlists, selectedValue) {
    return playlists
        .filter((p) => p.categories && p.categories.length > 0)
        .map((p) => {
            const opts = p.categories.map((c) => {
                const value = `${p.id}:${c.id}`;
                const selected = value === selectedValue ? ' selected' : '';
                return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(c.name)}</option>`;
            }).join('');
            return `<optgroup label="${escapeHtml(p.name)}">${opts}</optgroup>`;
        }).join('');
}

function addToPlaylistForm({item, resultName, resultIcon, targetOptions, form, hasTargets, hasPinnedTarget}) {
    if (!hasTargets) {
        return `<a href="/playlists" class="shrink-0 text-xs text-slate-400 hover:text-slate-200 underline">Create a category…</a>`;
    }
    const backFields = [
        ['q', form.query],
        ['category', form.category],
        ['page', form.page],
        ['page_size', form.pageSize],
    ]
        .filter(([, v]) => v !== undefined && v !== '' && v !== 0)
        .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(String(v))}">`)
        .join('');
    const placeholder = hasPinnedTarget ? '' : `<option value="">Add to…</option>`;
    return `
<form method="post" action="/search/add-channel" class="flex items-center gap-1">
  ${backFields}
  <input type="hidden" name="name" value="${escapeHtml(resultName)}">
  <input type="hidden" name="infohash" value="${escapeHtml(item.infohash)}">
  <input type="hidden" name="bitrate" value="${escapeHtml(String(item.bitrate || 0))}">
  ${resultIcon ? `<input type="hidden" name="icon" value="${escapeHtml(resultIcon)}">` : ''}
  <select name="target" required class="text-xs bg-slate-950 border border-slate-800 hover:border-slate-600 rounded px-2 py-1 max-w-[10rem] truncate">
    ${placeholder}
    ${targetOptions}
  </select>
  <button class="shrink-0 text-xs text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-700 rounded px-2 py-1">Add</button>
</form>`;
}

function renderResultCard({result, targetOptions, hasTargets, hasPinnedTarget, form, bulkEnabled}) {
    const logo = pickLogoUrl(result.icons);
    const logoHtml = logo
        ? `<img src="${escapeHtml(logo)}" alt="" onerror="this.style.display='none'" class="h-10 w-10 rounded object-contain bg-slate-950 border border-slate-800 shrink-0">`
        : `<div class="h-10 w-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs shrink-0">—</div>`;

    const items = (result.items || []).map((it) => {
        const langs = tagPills(it.languages);
        const countries = tagPills(it.countries, {emphasis: true});
        const cats = tagPills(it.categories);
        const tags = [langs, countries, cats].filter(Boolean).join(' ');
        const streams = it.streams || [];
        const bulkCheckbox = bulkEnabled && it.infohash
            ? `<label class="shrink-0 inline-flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
    <input form="bulk-add-form" type="checkbox" name="channels"
           value="${escapeHtml(JSON.stringify({name: result.name || '(unnamed)', infohash: it.infohash, icon: logo, bitrate: it.bitrate || 0}))}"
           data-bulk-channel class="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500">
    Select
  </label>`
            : '';
        const streamButtons = streams.length === 0
            ? `<span class="shrink-0 text-xs text-slate-500 italic">no stream base configured</span>`
            : streams.map((s) => `
    <button type="button" data-copy="${escapeHtml(s.url)}"
            title="${escapeHtml(s.url)}"
            class="shrink-0 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1">Copy ${escapeHtml(s.label)}</button>
    <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener"
       title="${escapeHtml(s.url)}"
       class="shrink-0 text-xs text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-700 rounded px-2 py-1">Open ${escapeHtml(s.label)}</a>`).join('');
        return `
<li class="flex flex-col gap-2 rounded-lg bg-slate-950/50 border border-slate-800 p-3 md:flex-row md:items-center md:gap-4">
  <div class="min-w-0 flex-1">
    <div class="font-mono text-xs text-slate-300 break-all">${escapeHtml(it.infohash || '')}</div>
    ${it.bitrate ? `<div class="text-xs text-slate-500 mt-0.5">${formatBitrate(it.bitrate)}</div>` : ''}
    ${it.name && it.name !== result.name ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml(it.name)}</div>` : ''}
    ${tags ? `<div class="mt-2 flex flex-wrap gap-1">${tags}</div>` : ''}
  </div>
  <div class="flex flex-col gap-1 md:items-end">
    ${statusPill(it.status)}
    ${availabilityBar(it.availability)}
  </div>
  <div class="flex flex-wrap items-center gap-2 md:ml-2">
    ${bulkCheckbox}
    ${addToPlaylistForm({item: it, resultName: result.name || '(unnamed)', resultIcon: logo, targetOptions, form, hasTargets, hasPinnedTarget})}
    ${streamButtons}
  </div>
</li>`;
    }).join('');

    return `
<article class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
  <header class="flex items-start gap-3">
    ${logoHtml}
    <div class="min-w-0 flex-1">
      <h3 class="text-base font-semibold truncate">${escapeHtml(result.name || '(unnamed)')}</h3>
      <p class="text-xs text-slate-500 mt-0.5">${(result.items || []).length} stream${(result.items || []).length === 1 ? '' : 's'}</p>
    </div>
  </header>
  <ul class="space-y-2">${items}</ul>
</article>`;
}

function renderSearch({user, form, target = null, categories, pageSizeOptions, results, total, time, error, flash, playlists = [], hasAnyStreamBase = true} = {}) {
    const categoryOptions = [
        `<option value="">All categories</option>`,
        ...categories.map((c) => `<option value="${escapeHtml(c.key)}"${form.category === c.key ? ' selected' : ''}>${escapeHtml(c.label)}</option>`),
    ].join('');

    const pageSizeSelect = pageSizeOptions
        .map((n) => `<option value="${n}"${form.pageSize === n ? ' selected' : ''}>${n} / page</option>`)
        .join('');

    const flashMsg = (() => {
        if (!flash) return null;
        const [kind, added, skipped] = String(flash).split(':');
        if (kind === 'added') return 'Channel added to playlist.';
        if (kind === 'bulk-added') {
            return `Added ${added} channel${added === '1' ? '' : 's'}${skipped === '0' ? '.' : `; skipped ${skipped} duplicate${skipped === '1' ? '' : 's'}.`}`;
        }
        return null;
    })();

    const pinnedTargetValue = target ? target.value : '';
    const hasPinnedTarget = Boolean(target);
    const targetOptions = buildTargetOptions(playlists, pinnedTargetValue);
    const hasTargets = targetOptions.length > 0;
    const bulkForm = target && results && results.length > 0 ? `
<form id="bulk-add-form" method="post" action="/search/add-channels" class="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-900/60 bg-indigo-950/20 px-3 py-2">
  <input type="hidden" name="target" value="${escapeHtml(target.value)}">
  <input type="hidden" name="q" value="${escapeHtml(form.query)}">
  <input type="hidden" name="category" value="${escapeHtml(form.category)}">
  <input type="hidden" name="page" value="${escapeHtml(String(form.page))}">
  <input type="hidden" name="page_size" value="${escapeHtml(String(form.pageSize))}">
  <label class="inline-flex items-center gap-2 text-sm text-indigo-100 cursor-pointer">
    <input type="checkbox" data-bulk-select-all class="rounded border-indigo-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500">
    Select all on this page
  </label>
  <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium">Add selected</button>
</form>` : '';

    const pinnedBanner = target ? (() => {
        const params = new URLSearchParams();
        if (form.query) params.set('q', form.query);
        if (form.category) params.set('category', form.category);
        params.set('page_size', String(form.pageSize));
        return `
<div role="status" class="flex items-center justify-between gap-3 text-sm text-indigo-200 bg-indigo-950/40 border border-indigo-900/60 rounded-lg px-3 py-2">
  <span>Adding channels to <span class="font-semibold text-white">${escapeHtml(target.playlistName)}</span> → <span class="font-semibold text-white">${escapeHtml(target.categoryName)}</span>. Every Add button below uses this target.</span>
  <a href="/search?${params.toString()}" class="shrink-0 text-xs text-indigo-300 hover:text-indigo-100 underline">Clear</a>
</div>`;
    })() : '';

    const flashBlock = flashMsg
        ? `<div role="status" class="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2">${escapeHtml(flashMsg)}</div>`
        : '';
    const errorBlock = error
        ? `<div role="alert" class="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">${escapeHtml(error)}</div>`
        : '';

    let body;
    if (results === null && !error) {
        body = `
<div class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center text-slate-400">
  Enter a query or pick a category, then hit Search.
</div>`;
    } else if (results && results.length === 0) {
        body = `
<div class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center text-slate-400">
  No results for the current filter.
</div>`;
    } else if (results) {
        const cards = results.map((r) => renderResultCard({result: r, targetOptions, hasTargets, hasPinnedTarget, form, bulkEnabled: Boolean(target)})).join('');
        const from = form.page * form.pageSize + 1;
        const to = Math.min(total, from + results.length - 1);
        const hasNext = (form.page + 1) * form.pageSize < total;
        const summary = `<div class="text-xs text-slate-400">Showing ${from}–${to} of ${total} · ${time.toFixed(2)}s</div>`;
        const pager = `
<div class="flex items-center justify-between gap-3 pt-2">
  ${summary}
  <div class="flex items-center gap-2">
    ${paginationLink({form, page: Math.max(0, form.page - 1), label: '← Prev', disabled: form.page === 0})}
    <span class="text-xs text-slate-500">Page ${form.page + 1}</span>
    ${paginationLink({form, page: form.page + 1, label: 'Next →', disabled: !hasNext})}
  </div>
</div>`;
        body = `
<div class="space-y-4">
  ${summary}
  <div class="space-y-3">${cards}</div>
  ${pager}
</div>`;
    } else {
        body = '';
    }

    return layout({
        title: 'AceStream Proxy — Search',
        body: `
${header({user, active: '/search'})}
<main class="max-w-6xl mx-auto px-6 py-8 space-y-6">
  ${flashBlock}
  ${pinnedBanner}
  ${!hasAnyStreamBase ? `<div role="status" class="text-sm text-amber-300 bg-amber-950/40 border border-amber-900/60 rounded-lg px-3 py-2">No stream base URL configured. Set one in <a href="/settings" class="underline">Settings</a> to enable Copy/Open.</div>` : ''}
  <section>
    <h1 class="text-2xl font-semibold">Search channels</h1>
    <p class="mt-1 text-sm text-slate-400 max-w-2xl">
      Queries the AceStream engine's <code class="text-slate-300">/search</code> endpoint directly.
      Leave the query blank and pick a category to browse.
    </p>
  </section>
  <form method="get" action="/search" class="flex flex-col md:flex-row gap-2 md:items-end">
    <label class="flex-1">
      <span class="text-xs uppercase tracking-wide text-slate-500">Query</span>
      <input type="search" name="q" value="${escapeHtml(form.query)}" placeholder="e.g. discovery, cnn, дом кино"
             class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
    </label>
    <label class="md:w-52">
      <span class="text-xs uppercase tracking-wide text-slate-500">Category</span>
      <select name="category"
              class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
        ${categoryOptions}
      </select>
    </label>
    <label class="md:w-40">
      <span class="text-xs uppercase tracking-wide text-slate-500">Page size</span>
      <select name="page_size"
              class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm">
        ${pageSizeSelect}
      </select>
    </label>
    <input type="hidden" name="page" value="0">
    ${hasPinnedTarget ? `<input type="hidden" name="target" value="${escapeHtml(pinnedTargetValue)}">` : ''}
    <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium">Search</button>
  </form>
  ${errorBlock}
  ${bulkForm}
  ${body}
</main>
<script>
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-bulk-select-all]')) return;
    document.querySelectorAll('[data-bulk-channel]').forEach((checkbox) => {
      checkbox.checked = e.target.checked;
    });
  });
</script>
`,
    });
}

function renderPlaylistDetail({user, playlist, baseUrl, lastBuiltAt, fileBytes, flash, error} = {}) {
    const idAttr = escapeHtml(playlist.id);
    const url = `${baseUrl}/${playlist.id}/playlist.m3u8`;
    const urlHtml = escapeHtml(url);

    const flashMsg = parseFlash(flash);
    const flashBlock = flashMsg
        ? `<div role="status" class="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2">${escapeHtml(flashMsg)}</div>`
        : '';
    const errorBlock = error
        ? `<div role="alert" class="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">${escapeHtml(error)}</div>`
        : '';

    const buildStatus = lastBuiltAt
        ? `Last built ${escapeHtml(lastBuiltAt)} · ${fileBytes} bytes`
        : 'Not built yet';

    const categoryOptions = playlist.categories
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
        .join('');

    const categoriesSection = playlist.categories.length
        ? `<ul class="divide-y divide-slate-800">${playlist.categories.map((c) => `
<li class="py-3 flex items-center gap-3 flex-wrap">
  <form method="post" action="/playlists/${idAttr}/categories/${escapeHtml(c.id)}/update" class="flex items-center gap-2 flex-1 min-w-0">
    <input name="name" value="${escapeHtml(c.name)}" required
           class="flex-1 min-w-0 rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm">
    <button class="text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1">Save</button>
  </form>
  <a href="/search?target=${idAttr}%3A${escapeHtml(c.id)}"
     class="text-xs text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-700 rounded px-2 py-1">Search &amp; add channels →</a>
  <form method="post" action="/playlists/${idAttr}/categories/${escapeHtml(c.id)}/delete"
        onsubmit="return confirm('Remove category and all its channels?');">
    <button class="text-xs text-rose-400 hover:text-rose-300">Delete</button>
  </form>
</li>`).join('')}</ul>`
        : `<p class="text-sm text-slate-500">No categories yet. Add one below.</p>`;

    const channelsByCategory = new Map(playlist.categories.map((c) => [c.id, []]));
    for (const ch of playlist.channels) {
        if (!channelsByCategory.has(ch.categoryId)) channelsByCategory.set(ch.categoryId, []);
        channelsByCategory.get(ch.categoryId).push(ch);
    }
    const categoriesById = new Map(playlist.categories.map((c) => [c.id, c]));
    const channelGroups = [...channelsByCategory.entries()]
        .filter(([, list]) => list.length > 0)
        .map(([cid, list]) => {
            const catName = categoriesById.get(cid)?.name || '(unknown)';
            const rows = list.map((ch) => {
                const avail = ch.availability;
                let dotColor;
                if (avail === null || avail === undefined) dotColor = 'bg-slate-500';
                else if (avail >= 0.8) dotColor = 'bg-emerald-400';
                else if (avail >= 0.5) dotColor = 'bg-amber-400';
                else dotColor = 'bg-rose-400';
                const bitrateText = ch.bitrate ? formatBitrate(ch.bitrate) : '';
                return `
<tr class="border-t border-slate-800">
  <td class="px-3 py-2">
    <form method="post" action="/playlists/${idAttr}/channels/${escapeHtml(ch.id)}/update" class="flex items-center gap-2">
      <input name="name" value="${escapeHtml(ch.name)}" required
             class="flex-1 min-w-0 rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-2 py-1 text-sm">
      <button class="shrink-0 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1">Save</button>
    </form>
  </td>
  <td class="px-3 py-2 font-mono text-xs text-slate-400 break-all">${escapeHtml(ch.infohash)}</td>
  <td class="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
    <div class="flex items-center gap-1.5">
      <span class="inline-block h-1.5 w-1.5 rounded-full ${dotColor} shrink-0"></span>
      <span>${bitrateText ? escapeHtml(bitrateText) : '—'}</span>
    </div>
  </td>
  <td class="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">${escapeHtml(ch.addedAt)}</td>
  <td class="px-3 py-2 text-right">
    <form method="post" action="/playlists/${idAttr}/channels/${escapeHtml(ch.id)}/delete">
      <button class="text-xs text-rose-400 hover:text-rose-300">Remove</button>
    </form>
  </td>
</tr>`;
            }).join('');
            return `
<section class="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
  <header class="px-3 py-2 bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">${escapeHtml(catName)} · ${list.length}</header>
  <table class="min-w-full text-sm">
    <thead class="text-xs text-slate-500">
      <tr>
        <th class="text-left px-3 py-2 font-medium">Name</th>
        <th class="text-left px-3 py-2 font-medium">Infohash</th>
        <th class="text-left px-3 py-2 font-medium">Bitrate</th>
        <th class="text-left px-3 py-2 font-medium">Added</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
        }).join('');

    const channelsSection = playlist.channels.length
        ? `<div class="space-y-3">${channelGroups}</div>`
        : `<p class="text-sm text-slate-500">No channels yet. Add one below${playlist.categories.length ? '' : ' after creating a category'}.</p>`;

    const addChannelForm = playlist.categories.length
        ? `<form method="post" action="/playlists/${idAttr}/channels" class="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px_auto] gap-2 items-end">
  <label>
    <span class="text-xs uppercase tracking-wide text-slate-500">Channel name</span>
    <input name="name" required class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm">
  </label>
  <label>
    <span class="text-xs uppercase tracking-wide text-slate-500">Infohash (40 hex)</span>
    <input name="infohash" required pattern="[0-9a-fA-F]{40}" title="40 hex chars"
           class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm font-mono">
  </label>
  <label>
    <span class="text-xs uppercase tracking-wide text-slate-500">Category</span>
    <select name="categoryId" required class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm">
      ${categoryOptions}
    </select>
  </label>
  <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium">Add channel</button>
</form>`
        : `<p class="text-sm text-slate-500">Create a category first.</p>`;

    return layout({
        title: `AceStream Proxy — ${playlist.name}`,
        body: `
${header({user, active: '/playlists'})}
<main class="max-w-5xl mx-auto px-6 py-8 space-y-6">
  <nav class="text-sm text-slate-400"><a href="/playlists" class="hover:text-slate-200">Playlists</a> <span class="text-slate-600 mx-1">/</span> <span class="text-slate-200">${escapeHtml(playlist.name)}</span></nav>
  ${flashBlock}${errorBlock}

  <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
    <h1 class="text-xl font-semibold">${escapeHtml(playlist.name)}</h1>

    <form method="post" action="/playlists/${idAttr}/update"
          class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
      <label>
        <span class="text-xs uppercase tracking-wide text-slate-500">Name</span>
        <input name="name" value="${escapeHtml(playlist.name)}" required
               class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm">
      </label>
      <label>
        <span class="text-xs uppercase tracking-wide text-slate-500">ID (bearer token)</span>
        <input name="id" value="${idAttr}" pattern="[a-z0-9]{4,64}" required title="4–64 chars of a–z or 0–9"
               class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm font-mono">
      </label>
      <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium">Save</button>
    </form>

    <div class="space-y-1.5 pt-1 border-t border-slate-800">
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-slate-500 w-10 shrink-0">M3U</span>
        <a class="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate" href="/${idAttr}/playlist.m3u8">${urlHtml}</a>
        <button type="button" data-copy="${urlHtml}"
                class="shrink-0 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5">Copy</button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wide text-slate-500 w-10 shrink-0">EPG</span>
        <a class="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate" href="/iptv/epg.xml">${escapeHtml(baseUrl)}/iptv/epg.xml</a>
        <button type="button" data-copy="${escapeHtml(baseUrl)}/iptv/epg.xml"
                class="shrink-0 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-1.5 py-0.5">Copy</button>
      </div>
    </div>

    <div class="flex items-center justify-between pt-1 border-t border-slate-800">
      <form method="post" action="/playlists/${idAttr}/stream-kind" class="flex items-center gap-4">
        <span class="text-xs uppercase tracking-wide text-slate-500">Stream</span>
        <label class="inline-flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" name="streamKind" value="ts" ${playlist.streamKind !== 'hls' ? 'checked' : ''} class="accent-indigo-500">
          MPEG-TS
        </label>
        <label class="inline-flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="radio" name="streamKind" value="hls" ${playlist.streamKind === 'hls' ? 'checked' : ''} class="accent-indigo-500">
          HLS
        </label>
        <button class="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-xs">Save</button>
      </form>
      <p class="text-xs text-slate-600">${escapeHtml(buildStatus)}</p>
    </div>
  </section>

  <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Categories</h2>
      <span class="text-xs text-slate-500">${playlist.categories.length} total</span>
    </div>
    ${categoriesSection}
    <form method="post" action="/playlists/${idAttr}/categories" class="flex items-center gap-2 pt-2 border-t border-slate-800">
      <input name="name" placeholder="New category name" required
             class="flex-1 rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 text-sm">
      <button class="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-sm">Add category</button>
    </form>
  </section>

  <section class="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Channels</h2>
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500">${playlist.channels.length} total</span>
        <form method="post" action="/playlists/${idAttr}/refresh-availability">
          <button class="text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1">Refresh availability</button>
        </form>
      </div>
    </div>
    ${channelsSection}
    <div class="pt-2 border-t border-slate-800">${addChannelForm}</div>
  </section>
</main>
<script>
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });
</script>
`,
    });
}

function renderSettings({user, raw, effective, defaults, flash, error} = {}) {
    const flashBlock = flash === 'saved'
        ? `<div role="status" class="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900/60 rounded-lg px-3 py-2">Settings saved.</div>`
        : '';
    const errorBlock = error
        ? `<div role="alert" class="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">${escapeHtml(error)}</div>`
        : '';

    function field({name, label, help, value, placeholder, type = 'text', pattern}) {
        const patternAttr = pattern ? ` pattern="${escapeHtml(pattern)}"` : '';
        const typeAttr = type === 'number' ? ' inputmode="numeric"' : '';
        return `
<label class="block space-y-1">
  <span class="text-sm text-slate-300">${escapeHtml(label)}</span>
  <input type="${type}" name="${name}" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(placeholder || '')}"${patternAttr}${typeAttr}
         class="mt-1 w-full rounded-md bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 px-3 py-2 text-sm font-mono">
  ${help ? `<span class="block text-xs text-slate-500">${help}</span>` : ''}
</label>`;
    }

    return layout({
        title: 'AceStream Proxy — Settings',
        body: `
${header({user, active: '/settings'})}
<main class="max-w-3xl mx-auto px-6 py-8 space-y-6">
  ${flashBlock}${errorBlock}
  <section>
    <h1 class="text-2xl font-semibold">Settings</h1>
    <p class="mt-1 text-sm text-slate-400 max-w-2xl">
      Runtime overrides for the AceStream engine and streaming URLs. Blank fields fall back to the env-var defaults shown in the placeholder.
    </p>
  </section>

  <form method="post" action="/settings" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
    <h2 class="text-lg font-semibold">AceStream engine</h2>
    ${field({
        name: 'engineSearchUrl',
        label: 'Engine API URL (/search)',
        placeholder: defaults.engineSearchUrl,
        value: raw.engineSearchUrl || defaults.engineSearchUrl,
        help: `Env default: <code class="text-slate-300">${escapeHtml(defaults.engineSearchUrl)}</code>. Clear to fall back to it.`,
    })}
    ${field({
        name: 'pageSize',
        label: 'Search page size (1–200)',
        type: 'number',
        placeholder: String(defaults.pageSize),
        value: raw.pageSize || defaults.pageSize,
        help: `Env default: <code class="text-slate-300">${escapeHtml(String(defaults.pageSize))}</code>. Clear to fall back to it.`,
        pattern: '[0-9]+',
    })}

    <hr class="border-slate-800">
    <h2 class="text-lg font-semibold">Streaming endpoints</h2>
    <p class="text-xs text-slate-500">Base URLs the proxy writes into each M3U line as <code class="text-slate-300">{base}?infohash=…</code>. Per-playlist Stream flavor picks which one is used.</p>
    ${field({
        name: 'streamBaseTs',
        label: 'MPEG-TS over HTTP (TCP)',
        placeholder: defaults.streamBaseTs,
        value: raw.streamBaseTs || defaults.streamBaseTs,
        help: `Env default: <code class="text-slate-300">${escapeHtml(defaults.streamBaseTs)}</code>. Typical acexy value: <code class="text-slate-300">http://&lt;host&gt;:6879/ace/getstream</code>.`,
    })}
    ${field({
        name: 'streamBaseHls',
        label: 'HLS (m3u8)',
        placeholder: 'http://192.168.1.7:6878/ace/manifest.m3u8',
        value: raw.streamBaseHls,
        help: `Optional. Set when you want playlists to emit HLS URLs. Effective: <code class="text-slate-300">${escapeHtml(effective.streamBaseHls || '(none)')}</code>`,
    })}

    <hr class="border-slate-800">
    <h2 class="text-lg font-semibold">Public base URL</h2>
    <p class="text-xs text-slate-500">The URL clients use to reach this proxy. Written into each playlist as <code class="text-slate-300">url-tvg="{base}/iptv/epg.xml"</code> so IPTV clients auto-load our EPG. Leave blank to use the configured default.</p>
    ${field({
        name: 'publicBaseUrl',
        label: 'Public base URL',
        placeholder: 'http://192.168.1.7:6880',
        value: raw.publicBaseUrl,
        help: `Effective: <code class="text-slate-300">${escapeHtml(effective.publicBaseUrl)}</code>`,
    })}

    <div>
      <button class="rounded-md bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium">Save settings</button>
    </div>
  </form>
</main>
`,
    });
}

module.exports = {renderLogin, renderPlaylists, renderPlaylistDetail, renderSearch, renderSettings, escapeHtml};
