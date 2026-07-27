/* ============================================================
   Intern Demo — SPA controller
   Vanilla JS. Talks to /api/users. No page reloads.
   ============================================================ */
(() => {
    'use strict';

    const API = '/api/users';

    // ---------- State ----------
    let users = [];
    let currentQuery = '';
    let editingId = null;

    // ---------- DOM ----------
    const $ = sel => document.querySelector(sel);
    const grid       = $('#userGrid');
    const skeleton   = $('#skeleton');
    const emptyState = $('#emptyState');
    const noResults  = $('#noResults');
    const statCount  = $('#statCount');
    const searchEl   = $('#search');

    const userModal    = new bootstrap.Modal($('#userModal'));
    const deleteModal  = new bootstrap.Modal($('#deleteModal'));
    const modalTitle   = $('#userModalTitle');
    const modalSub     = $('#userModalSubtitle');
    const form         = $('#userForm');
    const fId          = $('#fId');
    const fName        = $('#fName');
    const fEmail       = $('#fEmail');
    const errName      = $('#errName');
    const errEmail     = $('#errEmail');
    const btnSubmit    = $('#btnSubmit');
    const delTargetName= $('#delTargetName');
    const btnConfirmDel= $('#btnConfirmDelete');

    // ---------- Avatar palette ----------
    const palette = [
        '#0071e3', '#5e5ce6', '#af52de', '#ff2d55',
        '#ff9500', '#34c759', '#00b894', '#5ac8fa'
    ];
    const hash = str => {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return Math.abs(h);
    };
    const colorFor = name => palette[hash(name || '') % palette.length];
    const initialOf = name => (name || '?').trim().charAt(0).toUpperCase();
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
        { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));

    // ---------- Toast ----------
    const toastContainer = $('#toastContainer');
    const iconFor = t => t === 'success' ? 'check-circle-fill'
                    : t === 'error'   ? 'exclamation-circle-fill'
                                       : 'info-circle-fill';
    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = 'toast align-items-center';
        el.setAttribute('role', 'alert');
        el.innerHTML = `
            <div class="toast-body">
                <i class="bi bi-${iconFor(type)} toast-icon ${type}"></i>
                <div class="flex-grow-1">${esc(msg)}</div>
                <button type="button" class="close-btn" aria-label="Close">&times;</button>
            </div>`;
        toastContainer.appendChild(el);
        const t = new bootstrap.Toast(el, { autohide: true, delay: 3500 });
        el.querySelector('.close-btn').addEventListener('click', () => t.hide());
        el.addEventListener('hidden.bs.toast', () => el.remove());
        t.show();
    }

    // ---------- Rendering ----------
    function render() {
        const q = currentQuery.trim().toLowerCase();
        const filtered = q
            ? users.filter(u =>
                (u.name  || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q))
            : users;

        skeleton.classList.add('d-none');
        emptyState.classList.toggle('d-none', users.length !== 0);
        noResults.classList.toggle('d-none', !(users.length > 0 && filtered.length === 0));
        grid.innerHTML = filtered.map(cardHtml).join('');
        statCount.textContent = users.length;

        // Wire per-card actions
        grid.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit)));
        });
        grid.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => openDelete(Number(btn.dataset.delete)));
        });
    }

    function cardHtml(u) {
        const color = colorFor(u.name);
        return `
        <div class="col-md-6 col-xl-4">
            <div class="glass-card user-card h-100" tabindex="0">
                <div class="avatar" style="background:${color}">${esc(initialOf(u.name))}</div>
                <div class="user-info">
                    <div class="user-name">${esc(u.name)}</div>
                    <div class="user-email" title="${esc(u.email)}">${esc(u.email)}</div>
                </div>
                <div class="actions">
                    <button class="icon-btn" title="Edit" data-edit="${u.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="icon-btn danger" title="Delete" data-delete="${u.id}">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ---------- API ----------
    async function apiRequest(url, options = {}) {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            ...options
        });
        if (res.status === 204) return null;
        let body = null;
        try { body = await res.json(); } catch { /* no json */ }
        if (!res.ok) {
            const err = new Error(body?.error || `Request failed (${res.status})`);
            err.fields = body?.fields || {};
            err.status = res.status;
            throw err;
        }
        return body;
    }

    async function loadUsers() {
        try {
            skeleton.classList.remove('d-none');
            grid.innerHTML = '';
            emptyState.classList.add('d-none');
            noResults.classList.add('d-none');
            users = await apiRequest(API);
            render();
        } catch (e) {
            skeleton.classList.add('d-none');
            toast('Failed to load users: ' + e.message, 'error');
        }
    }

    // ---------- Modal helpers ----------
    function clearErrors() {
        errName.textContent = ''; errEmail.textContent = '';
        fName.classList.remove('is-invalid');
        fEmail.classList.remove('is-invalid');
    }

    function showFieldErrors(fields) {
        clearErrors();
        if (fields.name) { errName.textContent = fields.name; fName.classList.add('is-invalid'); }
        if (fields.email){ errEmail.textContent = fields.email; fEmail.classList.add('is-invalid'); }
    }

    function openCreate() {
        editingId = null;
        modalTitle.textContent = 'Add User';
        modalSub.textContent = 'Create a new user record.';
        fId.value = ''; fName.value = ''; fEmail.value = '';
        clearErrors();
        setSubmitLabel('Create user');
        userModal.show();
        setTimeout(() => fName.focus(), 250);
    }

    function openEdit(id) {
        const u = users.find(x => x.id === id);
        if (!u) return;
        editingId = id;
        modalTitle.textContent = 'Edit User';
        modalSub.textContent   = `Update details for ${u.name}.`;
        fId.value    = u.id;
        fName.value  = u.name;
        fEmail.value = u.email;
        clearErrors();
        setSubmitLabel('Save changes');
        userModal.show();
        setTimeout(() => fName.focus(), 250);
    }

    function setSubmitLabel(text) { btnSubmit.querySelector('.btn-label').textContent = text; }

    function setLoading(btn, loading) {
        btn.disabled = loading;
        btn.querySelector('.btn-label').classList.toggle('d-none', loading);
        btn.querySelector('.btn-spinner').classList.toggle('d-none', !loading);
    }

    // ---------- Submit (create / update) ----------
    form.addEventListener('submit', async e => {
        e.preventDefault();
        clearErrors();
        const payload = { name: fName.value.trim(), email: fEmail.value.trim() };

        // Cheap client-side check for empty
        const clientErr = {};
        if (!payload.name)  clientErr.name  = 'Name is required';
        if (!payload.email) clientErr.email = 'Email is required';
        if (Object.keys(clientErr).length) { showFieldErrors(clientErr); return; }

        setLoading(btnSubmit, true);
        try {
            if (editingId) {
                const updated = await apiRequest(`${API}/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                users = users.map(u => u.id === editingId ? updated : u);
                toast(`"${updated.name}" was updated.`, 'success');
            } else {
                const created = await apiRequest(API, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                users = [...users, created];
                toast(`User "${created.name}" was created.`, 'success');
            }
            render();
            userModal.hide();
        } catch (err) {
            if (err.fields && Object.keys(err.fields).length) {
                showFieldErrors(err.fields);
            } else {
                toast(err.message, 'error');
            }
        } finally {
            setLoading(btnSubmit, false);
        }
    });

    // ---------- Delete ----------
    let deleteTargetId = null;
    function openDelete(id) {
        const u = users.find(x => x.id === id);
        if (!u) return;
        deleteTargetId = id;
        delTargetName.textContent = u.name;
        deleteModal.show();
    }

    btnConfirmDel.addEventListener('click', async () => {
        if (deleteTargetId == null) return;
        setLoading(btnConfirmDel, true);
        try {
            const u = users.find(x => x.id === deleteTargetId);
            await apiRequest(`${API}/${deleteTargetId}`, { method: 'DELETE' });
            users = users.filter(x => x.id !== deleteTargetId);
            render();
            deleteModal.hide();
            toast(`"${u?.name ?? 'User'}" was deleted.`, 'success');
        } catch (err) {
            toast('Failed to delete: ' + err.message, 'error');
        } finally {
            setLoading(btnConfirmDel, false);
            deleteTargetId = null;
        }
    });

    // ---------- Wire buttons ----------
    $('#btnNew').addEventListener('click', openCreate);
    $('#btnNewMobile').addEventListener('click', openCreate);
    $('#btnEmptyNew').addEventListener('click', openCreate);
    $('#btnRefresh').addEventListener('click', () => { loadUsers(); toast('Refreshed.', 'info'); });

    // ---------- Search ----------
    searchEl.addEventListener('input', () => {
        currentQuery = searchEl.value;
        render();
    });

    // ---------- Keyboard shortcuts ----------
    document.addEventListener('keydown', e => {
        const inField = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        const anyModalOpen = document.querySelector('.modal.show');
        if (inField || anyModalOpen) return;
        if (e.key === '/') { e.preventDefault(); searchEl.focus(); }
        else if (e.key.toLowerCase() === 'n') { e.preventDefault(); openCreate(); }
        else if (e.key.toLowerCase() === 'r') { e.preventDefault(); loadUsers(); }
    });

    // ---------- Boot ----------
    // Hydrate from the server-rendered (Thymeleaf) user list if present,
    // otherwise fall back to fetching from the API.
    if (Array.isArray(window.__INITIAL_USERS__)) {
        users = window.__INITIAL_USERS__;
        render();
    } else {
        loadUsers();
    }
})();
