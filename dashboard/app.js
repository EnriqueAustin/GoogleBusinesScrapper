// ===== State =====
let allLeads = [];
let filteredLeads = [];
let sortField = 'name';
let sortAsc = true;

// Column visibility state
const columnConfig = [
    { id: 'name', label: 'Name', visible: true, locked: true }, // Locked always visible
    { id: 'category', label: 'Category', visible: true },
    { id: 'address', label: 'Address', visible: true },
    { id: 'phone', label: 'Phone', visible: true },
    { id: 'website', label: 'Website', visible: true },
    { id: 'rating', label: 'Rating', visible: true },
    { id: 'reviewCount', label: 'Reviews', visible: true },
    { id: 'techStack', label: 'Tech Stack', visible: true },
    { id: 'seoStatus', label: 'SEO', visible: true },
    { id: 'query', label: 'Query', visible: true }
];

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);
const statsEls = {
    total: $('statTotal'),
    noWebsite: $('statNoWebsite'),
    withWebsite: $('statWithWebsite'),
    categories: $('statCategories'),
};
const filterEls = {
    search: $('filterSearch'),
    website: $('filterWebsite'),
    query: $('filterQuery'),
    category: $('filterCategory'),
    rating: $('filterRating'),
};
const tableBody = $('leadsBody');
const resultsCount = $('resultsCount');
const modalOverlay = $('modalOverlay');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const columnMenu = $('columnMenu');
const btnToggleColumns = $('btnToggleColumns');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    setupColumnMenu();
    await loadStats();
    await loadLeads();
    setupEventListeners();
});

// ===== API Calls =====
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        animateNumber(statsEls.total, stats.total);
        animateNumber(statsEls.noWebsite, stats.noWebsite);
        animateNumber(statsEls.withWebsite, stats.withWebsite);
        animateNumber(statsEls.categories, stats.categories);

        // Populate query filter dropdown
        const querySelect = filterEls.query;
        (stats.queryList || []).forEach(q => {
            const opt = document.createElement('option');
            opt.value = q;
            opt.textContent = q;
            querySelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadLeads() {
    try {
        const res = await fetch('/api/leads');
        allLeads = await res.json();
        applyFilters();
    } catch (err) {
        console.error('Failed to load leads:', err);
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Failed to load leads. Is the server running?</td></tr>';
    }
}

// ===== Animate Numbers =====
function animateNumber(el, target) {
    const duration = 600;
    const start = 0;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutQuart
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ===== Filtering =====
function applyFilters() {
    let leads = [...allLeads];

    // Website filter
    const ws = filterEls.website.value;
    if (ws === 'no') leads = leads.filter(l => !l.hasWebsite);
    else if (ws === 'yes') leads = leads.filter(l => l.hasWebsite);

    // Query filter
    const q = filterEls.query.value;
    if (q) leads = leads.filter(l => l.query === q);

    // Category filter
    const cat = filterEls.category.value.trim().toLowerCase();
    if (cat) leads = leads.filter(l => l.category && l.category.toLowerCase().includes(cat));

    // Rating filter
    const rating = filterEls.rating.value;
    if (rating) leads = leads.filter(l => l.rating !== 'N/A' && parseFloat(l.rating) >= parseFloat(rating));

    // Search filter
    const search = filterEls.search.value.trim().toLowerCase();
    if (search) {
        leads = leads.filter(l =>
            (l.name && l.name.toLowerCase().includes(search)) ||
            (l.address && l.address.toLowerCase().includes(search)) ||
            (l.phone && l.phone.toLowerCase().includes(search)) ||
            (l.category && l.category.toLowerCase().includes(search))
        );
    }

    filteredLeads = leads;
    sortLeads();
}

// ===== Sorting =====
function sortLeads() {
    filteredLeads.sort((a, b) => {
        let va = a[sortField] || '';
        let vb = b[sortField] || '';

        // Numeric fields
        if (sortField === 'rating' || sortField === 'reviewCount') {
            va = va === 'N/A' ? -1 : parseFloat(va);
            vb = vb === 'N/A' ? -1 : parseFloat(vb);
            return sortAsc ? va - vb : vb - va;
        }

        // String comparison
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
    });

    renderTable();
}

// ===== Render Table =====
function renderTable() {
    resultsCount.textContent = `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`;

    // Update TH visibility
    columnConfig.forEach(col => {
        const th = document.querySelector(`th[data-sort="${col.id}"]`);
        if (th) {
            th.style.display = col.visible ? '' : 'none';
        }
    });

    if (filteredLeads.length === 0) {
        // Count visible columns for colspan
        const visibleCols = columnConfig.filter(c => c.visible).length;
        tableBody.innerHTML = `<tr><td colspan="${visibleCols}" class="empty-state">No leads match your filters. Try adjusting them or run the scraper first.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filteredLeads.map((lead, idx) => {
        const websiteBadge = getWebsiteBadge(lead);
        let rowHtml = `<tr data-index="${idx}">`;

        columnConfig.forEach(col => {
            if (!col.visible) return;

            if (col.id === 'website') {
                rowHtml += `<td>${websiteBadge}</td>`;
            } else if (col.id === 'rating') {
                rowHtml += `<td>${lead.rating !== 'N/A' ? lead.rating + ' ★' : '—'}</td>`;
            } else if (col.id === 'reviewCount') {
                rowHtml += `<td>${lead.reviewCount !== 'N/A' ? parseInt(lead.reviewCount).toLocaleString() : '—'}</td>`;
            } else if (col.id === 'techStack' || col.id === 'seoStatus') {
                rowHtml += `<td title="${esc(lead[col.id])}">${esc(lead[col.id] || '')}</td>`;
            } else {
                rowHtml += `<td title="${esc(lead[col.id])}">${esc(lead[col.id] || '')}</td>`;
            }
        });

        rowHtml += `</tr>`;
        return rowHtml;
    }).join('');
}

function getWebsiteBadge(lead) {
    if (!lead.website || lead.website === 'None' || lead.website === 'N/A') {
        return '<span class="badge badge-no">✗ None</span>';
    }
    if (lead.website.includes('facebook.com') || lead.website.includes('instagram.com')) {
        return '<span class="badge badge-social">⚡ Social Only</span>';
    }
    return '<span class="badge badge-yes">✓ Has Site</span>';
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Modal =====
function showModal(lead) {
    modalTitle.textContent = lead.name || 'Unknown Business';

    const mapsQuery = encodeURIComponent(`${lead.name} ${lead.address}`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    modalBody.innerHTML = `
    <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${esc(lead.category)}</span></div>
    <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${esc(lead.address)}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${esc(lead.phone)}</span></div>
    <div class="detail-row"><span class="detail-label">Website</span><span class="detail-value">${lead.website && lead.website !== 'None' ? `<a href="${esc(lead.website)}" target="_blank" rel="noopener">${esc(lead.website)}</a>` : '<span class="badge badge-no">✗ No Website</span>'}</span></div>
    <div class="detail-row"><span class="detail-label">Website Status</span><span class="detail-value">${esc(lead.websiteStatus) || 'Not Scanned'}</span></div>
    <div class="detail-row"><span class="detail-label">Tech Stack</span><span class="detail-value">${esc(lead.techStack) || 'Not Scanned'}</span></div>
    <div class="detail-row"><span class="detail-label">SEO Status</span><span class="detail-value">${esc(lead.seoStatus) || 'Not Scanned'}</span></div>
    <div class="detail-row"><span class="detail-label">Socials</span><span class="detail-value">${esc(lead.socials) || 'None found'}</span></div>
    <div class="detail-row"><span class="detail-label">Rating</span><span class="detail-value">${lead.rating !== 'N/A' ? lead.rating + ' ★' : '—'} ${lead.reviewCount !== 'N/A' ? `(${parseInt(lead.reviewCount).toLocaleString()} reviews)` : ''}</span></div>
    <div class="detail-row"><span class="detail-label">Query</span><span class="detail-value">${esc(lead.query)}</span></div>
    <div class="detail-row"><span class="detail-label">Scraped</span><span class="detail-value">${lead.scrapedAt ? new Date(lead.scrapedAt).toLocaleString() : '—'}</span></div>
    <div class="modal-actions" style="margin-top: 15px;">
      <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-primary">📍 Open in Google Maps</a>
      ${lead.phone && lead.phone !== 'N/A' ? `<a href="tel:${lead.phone}" class="btn btn-ghost">📞 Call</a>` : ''}
      ${lead.website && lead.website !== 'None' ? `<button onclick="scanWebsite('${esc(lead.website)}')" class="btn btn-accent" id="btnScanWebsite">🔍 Scan Website Data</button>` : ''}
    </div>
  `;

    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

// ===== Actions =====
async function scanWebsite(website) {
    const btn = document.getElementById('btnScanWebsite');
    if (btn) btn.innerHTML = '⏳ Scanning...';
    try {
        const res = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ website })
        });

        if (!res.ok) throw new Error('Scan failed');

        const updatedLead = await res.json();

        // Update in memory
        const idx = allLeads.findIndex(l => l.website === website);
        if (idx !== -1) {
            allLeads[idx] = updatedLead;
            applyFilters(); // Re-render table
            showModal(updatedLead); // Re-render modal
        }
    } catch (err) {
        console.error(err);
        alert('Failed to scan website. Make sure the server is running.');
        if (btn) btn.innerHTML = '🔍 Scan Website Data';
    }
}

// ===== Columns Menu =====
function setupColumnMenu() {
    columnMenu.innerHTML = '';
    columnConfig.forEach((col, index) => {
        if (col.locked) return; // Don't show name column in toggle menu

        const label = document.createElement('label');
        label.className = 'dropdown-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = col.visible;
        checkbox.addEventListener('change', (e) => {
            col.visible = e.target.checked;
            renderTable();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(col.label));
        columnMenu.appendChild(label);
    });
}

// ===== CSV Export =====
function exportCsv() {
    if (filteredLeads.length === 0) return;

    const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Has Website', 'Rating', 'Reviews', 'Website Status', 'Tech Stack', 'SEO Status', 'Social Links', 'Query', 'Scraped At'];
    const rows = filteredLeads.map(l => [
        l.name, l.category, l.address, l.phone, l.website,
        l.hasWebsite ? 'Yes' : 'No', l.rating, l.reviewCount,
        l.websiteStatus || '', l.techStack || '', l.seoStatus || '', l.socials || '',
        l.query, l.scrapedAt
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Filter buttons
    $('btnApplyFilters').addEventListener('click', applyFilters);
    $('btnResetFilters').addEventListener('click', () => {
        filterEls.search.value = '';
        filterEls.website.value = 'all';
        filterEls.query.value = '';
        filterEls.category.value = '';
        filterEls.rating.value = '';
        applyFilters();
    });
    $('btnExportCsv').addEventListener('click', exportCsv);

    // Column Toggle Menu
    btnToggleColumns.addEventListener('click', (e) => {
        e.stopPropagation();
        columnMenu.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!columnMenu.contains(e.target) && e.target !== btnToggleColumns) {
            columnMenu.classList.remove('active');
        }
    });

    // Enter key on search
    filterEls.search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
    filterEls.category.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilters();
    });

    // Column sorting
    document.querySelectorAll('.leads-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortAsc = !sortAsc;
            } else {
                sortField = field;
                sortAsc = true;
            }
            // Update visual
            document.querySelectorAll('.leads-table th').forEach(h => h.classList.remove('sort-active'));
            th.classList.add('sort-active');
            sortLeads();
        });
    });

    // Table row click → modal
    tableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.index !== undefined) {
            showModal(filteredLeads[parseInt(row.dataset.index)]);
        }
    });

    // Close modal
    $('modalClose').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}
