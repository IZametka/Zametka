const storedNotes = localStorage.getItem('notes');
let notes = storedNotes ? JSON.parse(storedNotes) : [];
let editingId = null;
let currentMode = 'text';
let searchDebounceTimer = null;

function renderNotes() {
    updateTagFilter();

    const tagFilter = document.getElementById('tagFilter').value;
    const sortOption = document.getElementById('sortOption').value;
    const textSearch = document.getElementById('textSearch').value.trim().toLowerCase();
    const grid = document.getElementById('notesGrid');

    let filteredNotes = notes.filter(note => {
        if (tagFilter && (!note.tags || !note.tags.includes(tagFilter))) return false;
        if (textSearch) {
            const title = (note.title || '').toLowerCase();
            const content = (note.content || '').toLowerCase();
            const tags = (note.tags || []).join(' ').toLowerCase();
            if (!title.includes(textSearch) && 
                !content.includes(textSearch) && 
                !tags.includes(textSearch)) return false;
        }
        return true;
    });

    const pinned = filteredNotes.filter(n => n.pinned);
    const unpinned = filteredNotes.filter(n => !n.pinned);

    const sortedPinned = sortNotes(pinned, sortOption);
    const sortedUnpinned = sortNotes(unpinned, sortOption);

    if (sortedPinned.length === 0 && sortedUnpinned.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">📭</div>
                <h3>Заметки не найдены</h3>
                <p>Попробуйте изменить фильтры или создайте новую заметку</p>
            </div>
        `;
        return;
    }

    let html = '';

    if (sortedPinned.length > 0) {
        html += '<div class="section-title">📌 Закрепленные</div>';
        sortedPinned.forEach(note => {
            html += renderNoteCard(note, textSearch);
        });
    }

    if (sortedUnpinned.length > 0) {
        html += '<div class="section-title">📋 Остальные заметки</div>';
        sortedUnpinned.forEach(note => {
            html += renderNoteCard(note, textSearch);
        });
    }

    grid.innerHTML = html;
}

function renderNoteCard(note, searchQuery = '') {
    const tagsHtml = note.tags && note.tags.length > 0 
        ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';
    
    const priorityClass = `priority-${note.priority || 'medium'}`;
    const priorityText = {
        'high': '🔴 Высокий',
        'medium': '🟡 Средний',
        'low': '🟢 Низкий'
    }[note.priority || 'medium'];

    const titleHtml = searchQuery 
        ? highlightText(escapeHtml(note.title), searchQuery)
        : escapeHtml(note.title);
    
    const contentHtml = searchQuery
        ? highlightText(formatContent(note.content, note.mode), searchQuery)
        : formatContent(note.content, note.mode);

    return `
        <div class="note-card ${note.pinned ? 'pinned' : ''}" 
            style="--note-bg: ${note.color || '#ffffff'}; 
                    --pin-bg: ${note.pinColor || '#e1f5fe'}; 
                    --pin-border: ${note.pinColor || '#81d4fa'};
                    --text-color: ${note.textColor || '#5a6c7d'};">
            <div class="priority-indicator ${priorityClass}">${priorityText}</div>
            ${note.pinned ? '<div class="pin-indicator">📌</div>' : ''}
            <div class="note-actions">
                <button class="btn-icon ${note.pinned ? 'btn-pin active' : 'btn-pin'}" 
                        onclick="togglePin(${note.id})" 
                        title="${note.pinned ? 'Открепить' : 'Закрепить'}">
                    ${note.pinned ? '📌' : '📍'}
                </button>
                <button class="btn-icon" onclick="editNote(${note.id})" title="Редактировать">✏️</button>
                <button class="btn-icon btn-delete" onclick="deleteNote(${note.id})" title="Удалить">🗑️</button>
            </div>
            <div class="note-title">${titleHtml}</div>
            <div class="note-content">${contentHtml}</div>
            ${tagsHtml}
            <div class="note-date">${formatDate(note.date)}</div>
        </div>
    `;
}

function highlightText(html, query) {
    if (!query) return html;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return html.replace(regex, '<mark>$1</mark>');
}

function getAllTags() {
    const tags = new Set();
    notes.forEach(note => {
        if (note.tags) {
            note.tags.forEach(tag => tags.add(tag));
        }
    });
    return Array.from(tags).sort();
}

function onTagsInput() {
    showTagSuggestions();
}

function showTagSuggestions() {
    const input = document.getElementById('noteTags');
    const suggestionsBox = document.getElementById('tagSuggestions');
    const value = input.value;

    const parts = value.split(',');
    const currentTag = parts[parts.length - 1].trim().toLowerCase();

    const allTags = getAllTags();
    const alreadyAdded = parts.slice(0, -1).map(p => p.trim().toLowerCase()).filter(Boolean);
    
    const suggestions = allTags.filter(tag => 
        tag.toLowerCase().includes(currentTag) && 
        !alreadyAdded.includes(tag.toLowerCase())
    );

    if (currentTag === '' && suggestions.length === 0) {
        hideTagSuggestions();
        return;
    }

    const items = suggestions.length > 0 
        ? suggestions.map(tag => {
            const highlighted = highlightTag(tag, currentTag);
            return `<div class="tag-suggestion-item" onclick="addTagSuggestion('${escapeAttr(tag)}')">${highlighted}</div>`;
            }).join('')
        : '<div class="no-suggestions">Нет подходящих тегов</div>';

    suggestionsBox.innerHTML = items;
    suggestionsBox.classList.add('visible');
}

function highlightTag(tag, query) {
    if (!query) return escapeHtml(tag);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapeHtml(tag).replace(regex, '<mark>$1</mark>');
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function addTagSuggestion(tag) {
    const input = document.getElementById('noteTags');
    const parts = input.value.split(',');
    parts[parts.length - 1] = tag;
    input.value = parts.join(', ').replace(/\s*,\s*/g, ', ') + ', ';
    hideTagSuggestions();
    input.focus();
    updateCharCounter('noteTags', 'tagsCounter', 150);
}

function hideTagSuggestions() {
    document.getElementById('tagSuggestions').classList.remove('visible');
}

function updateTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const currentValue = tagFilter.value;
    const allTags = getAllTags();

    tagFilter.innerHTML = '<option value="">Все теги</option>';
    allTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilter.appendChild(option);
    });
    tagFilter.value = currentValue;
}

function sortNotes(notesArray, sortOption) {
    return [...notesArray].sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };

        switch(sortOption) {
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'priority-desc':
                if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return new Date(b.date) - new Date(a.date);
            case 'priority-asc':
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return new Date(b.date) - new Date(a.date);
            default:
                return new Date(b.date) - new Date(a.date);
        }
    });
}

function updateCharCounter(inputId, counterId, max) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) return;
    
    const currentLength = input.value.length;
    counter.textContent = `${currentLength}/${max}`;
    
    counter.classList.remove('warning', 'danger');
    
    const percent = currentLength / max;
    if (percent >= 0.95) {
        counter.classList.add('danger');
    } else if (percent >= 0.8) {
        counter.classList.add('warning');
    }
}

function applyFilters() {
    renderNotes();
}

function applyFiltersDebounced() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        renderNotes();
    }, 250);
}

document.addEventListener('click', (e) => {
    const tagsInput = document.getElementById('noteTags');
    const suggestionsBox = document.getElementById('tagSuggestions');
    if (tagsInput && suggestionsBox && 
        !tagsInput.contains(e.target) && 
        !suggestionsBox.contains(e.target)) {
        hideTagSuggestions();
    }
});

function formatContent(content, mode) {
    if (mode === 'list') {
        const items = content.split('\n').filter(item => item.trim());
        if (items.length === 0) return escapeHtml(content);
        return '<ul>' + items.map(item => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
    }
    return escapeHtml(content);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function openModal() {
    editingId = null;
    document.getElementById('modalHeader').textContent = 'Создание заметки';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteTags').value = '';
    document.getElementById('notePriority').value = 'medium';
    document.querySelector('.btn-save').textContent = 'Создать';
    setMode('text');
    
    document.getElementById('noteColor').value = '#ffffff';
    document.getElementById('pinColor').value = '#e1f5fe';
    document.getElementById('textColor').value = '#5a6c7d';

    updateCharCounter('noteTitle', 'titleCounter', 100);
    updateCharCounter('noteContent', 'contentCounter', 2000);
    updateCharCounter('noteTags', 'tagsCounter', 150);
    
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('noteTitle').focus();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    hideTagSuggestions();
    editingId = null;
}

function closeModalOnOverlay(event) {
    if (event.target === event.currentTarget) {
        closeModal();
    }
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('textMode').classList.toggle('active', mode === 'text');
    document.getElementById('listMode').classList.toggle('active', mode === 'list');
    document.getElementById('contentLabel').textContent = mode === 'list' ? 'Элементы списка (каждый с новой строки)' : 'Содержание';
    document.getElementById('noteContent').placeholder = mode === 'list' ? 'Введите элементы списка...\nКаждый элемент с новой строки' : 'Введите текст заметки...';
}

function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const color = document.getElementById('noteColor').value;
    const pinColor = document.getElementById('pinColor').value;
    const textColor = document.getElementById('textColor').value;
    const priority = document.getElementById('notePriority').value;
    const tagsInput = document.getElementById('noteTags').value.trim();

    let tags = [];
    if (tagsInput) {
        const rawTags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
        for (const tag of rawTags) {
            if (tag.length > 15) {
                alert(`Тег "${tag}" слишком длинный (максимум 15 символов).`);
                return;
            }
            tags.push(tag);
        }
        if (tags.length > 10) {
            alert('Можно добавить максимум 10 тегов.');
            return;
        }
    }

    if (title.length > 100) {
        alert('Название не может быть длиннее 100 символов.');
        return;
    }
    if (content.length > 2000) {
        alert('Содержание не может быть длиннее 2000 символов.');
        return;
    }

    if (!title) {
        alert('Введите название заметки');
        document.getElementById('noteTitle').focus();
        return;
    }
    if (!content) {
        alert('Введите содержание заметки');
        document.getElementById('noteContent').focus();
        return;
    }

    if (editingId) {
        const index = notes.findIndex(n => n.id === editingId);
        if (index !== -1) {
            notes[index] = {
                ...notes[index],
                title, content, mode: currentMode,
                color, pinColor, textColor,
                priority, tags,
                date: new Date().toISOString()
            };
        }
    } else {
        const newNote = {
            id: Date.now(),
            title, content, mode: currentMode,
            color, pinColor, textColor,
            priority, tags,
            pinned: false,
            date: new Date().toISOString()
        };
        notes.unshift(newNote);
    }

    localStorage.setItem('notes', JSON.stringify(notes));
    renderNotes();
    closeModal();
}

function editNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    editingId = id;
    document.getElementById('modalHeader').textContent = 'Редактирование заметки';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteTags').value = note.tags ? note.tags.join(', ') : '';
    document.getElementById('notePriority').value = note.priority || 'medium';
    document.querySelector('.btn-save').textContent = 'Сохранить';
    
    document.getElementById('noteColor').value = note.color || '#ffffff';
    document.getElementById('pinColor').value = note.pinColor || '#e1f5fe';
    document.getElementById('textColor').value = note.textColor || '#5a6c7d';

    updateCharCounter('noteTitle', 'titleCounter', 100);
    updateCharCounter('noteContent', 'contentCounter', 2000);
    updateCharCounter('noteTags', 'tagsCounter', 150);
    
    setMode(note.mode || 'text');
    document.getElementById('modalOverlay').classList.add('active');
}

function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
    }
}

function deleteNote(id) {
    if (confirm('Удалить эту заметку?')) {
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const popaZ = document.getElementById('popa-Z');
    const popaAudio = document.getElementById('popa-Audio');


    if (popaZ && popaAudio) {
        popaZ.addEventListener('click', () => {
            if (popaAudio.paused) {
                popaAudio.play().catch(error => {
                    console.log('Ошибка воспроизведения (проверь файл anthem.mp3):', error);
                });
            } else {
                popaAudio.pause();
                popaAudio.currentTime = 0;
            }
        });
    } else {
        console.error('Ошибка: Не найден элемент с id="popa-Z" или id="popa-Audio" в HTML');
    }
});

// --- ЛОГИКА СЕКРЕТНЫХ ЗАМЕТОК ---

// Переменные
let secretNotes = JSON.parse(localStorage.getItem('secret_notes')) || [];
let failedAttempts = parseInt(localStorage.getItem('secret_failed_attempts')) || 0;

// Элементы DOM
const secretTrigger = document.getElementById('secret-trigger');
const secretModal = document.getElementById('secretModal');
const loginScreen = document.getElementById('secret-login-screen');
const setupScreen = document.getElementById('secret-setup-screen');
const contentScreen = document.getElementById('secret-content-screen');
const errorText = document.getElementById('secret-error');

// 1. Открытие модалки
if (secretTrigger) {
    secretTrigger.addEventListener('click', () => {
        openSecretModal();
    });
}

function openSecretModal() {
    loginScreen.style.display = 'none';
    setupScreen.style.display = 'none';
    contentScreen.style.display = 'none';
    if(errorText) errorText.style.display = 'none';

    const savedPassword = localStorage.getItem('secret_archive_password');

    if (savedPassword) {
        loginScreen.style.display = 'block';
        document.getElementById('secret-password-input').value = '';
        document.getElementById('secret-password-input').focus();
        if (errorText) errorText.style.display = 'none';
        
        updateAttemptsUI();
    } else {
        setupScreen.style.display = 'block';
        document.getElementById('secret-new-password').value = '';
        document.getElementById('secret-new-password').focus();
    }
    secretModal.classList.add('active');
}

function closeSecretModal() {
    secretModal.classList.remove('active');
    failedAttempts = 0;
    localStorage.setItem('secret_failed_attempts', 0);
}

// 2. Создание пароля
function setSecretPassword() {
    const newPass = document.getElementById('secret-new-password').value;
    if (newPass.length < 1) {
        alert('Пароль не может быть пустым!');
        return;
    }
    localStorage.setItem('secret_archive_password', newPass);
    localStorage.setItem('secret_failed_attempts', 0);
    alert('Пароль установлен!');
    closeSecretModal();
}

// 3. Проверка пароля + Самоуничтожение
function checkSecretPassword() {
    const inputPass = document.getElementById('secret-password-input').value;
    const savedPass = localStorage.getItem('secret_archive_password');

    if (inputPass === savedPass) {
        localStorage.setItem('secret_failed_attempts', 0);
        loginScreen.style.display = 'none';
        contentScreen.style.display = 'block';
        renderSecretNotes();
    } else {
        failedAttempts++;
        localStorage.setItem('secret_failed_attempts', failedAttempts);
        updateAttemptsUI();
        document.getElementById('secret-password-input').value = '';
        document.getElementById('secret-password-input').focus();

        if (failedAttempts >= 3) {
            localStorage.removeItem('secret_notes');
            localStorage.removeItem('secret_archive_password');
            localStorage.setItem('secret_failed_attempts', 0);
            alert(' ДОСТУП ЗАПРЕЩЕН: Архив уничтожен!');
            closeSecretModal();
            location.reload();
        }
    }
}

function updateAttemptsUI() {
    const errorText = document.getElementById('secret-error');
    if (!errorText) return;
    if (failedAttempts > 0) {
        errorText.style.display = 'block';
        errorText.textContent = `Неверный пароль! Осталось попыток: ${4 - failedAttempts}`;
    } else {
        errorText.style.display = 'none';
    }
}
// Открыть форму
function openSecretNoteForm() {
    const form = document.getElementById('secret-note-form');
    if (form) {
        form.style.display = 'block';
        document.getElementById('secret-note-title').focus();
    }
}

// Закрыть форму и очистить
function closeSecretNoteForm() {
    const form = document.getElementById('secret-note-form');
    if (form) {
        form.style.display = 'none';
        document.getElementById('secret-note-title').value = '';
        document.getElementById('secret-note-content').value = '';
    }
}

// Сохранить заметку
function saveSecretNote() {
    const title = document.getElementById('secret-note-title').value.trim();
    const content = document.getElementById('secret-note-content').value.trim();

    if (!title || !content) {
        alert('Заполните название и текст!');
        return;
    }

    const newNote = {
        id: Date.now(),
        title: title,
        content: content,
        date: new Date().toISOString()
    };

    secretNotes.unshift(newNote);
    localStorage.setItem('secret_notes', JSON.stringify(secretNotes));
    
    renderSecretNotes();
    closeSecretNoteForm();
}

// Удалить заметку
function deleteSecretNote(id) {
    if (confirm('Удалить эту секретную заметку?')) {
        secretNotes = secretNotes.filter(n => n.id !== id);
        localStorage.setItem('secret_notes', JSON.stringify(secretNotes));
        renderSecretNotes();
    }
}

// Отрисовка списка
function renderSecretNotes() {
    const list = document.getElementById('secret-notes-list');
    if (!list) return;
    
    if (secretNotes.length === 0) {
        list.innerHTML = '<p style="color:#888; text-align:center; padding: 20px;">Архив пуст.</p>';
        return;
    }

    let html = '';
    secretNotes.forEach(note => {
        html += `
        <div style="background:#fff; padding:15px; margin-bottom:10px; border-radius:8px; border-left: 4px solid #d32f2f; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: relative;">
            <!-- Кнопка удаления -->
            <button onclick="deleteSecretNote(${note.id})" 
                    style="position:absolute; top: 10px; right: 10px; 
                    background: #ffebee; border: none; 
                    border-radius: 6px; padding: 6px 10px; 
                    cursor: pointer; color: #d32f2f;
                    font-size: 18px; line-height: 1;
                    transition: all 0.2s;
                    z-index: 10;">
                    🗑️
            </button>
            
            <div style="font-weight:bold; margin-bottom:8px; padding-right: 40px;">
                ${escapeHtml(note.title)}
            </div>
            <div style="color:#666; font-size:14px; white-space:pre-wrap; line-height:1.4;">
                ${escapeHtml(note.content)}
            </div>
            <div style="font-size:11px; color:#999; margin-top:10px; text-align:right;">
                ${formatDate(note.date)}
            </div>
        </div>
        `;
    });
    list.innerHTML = html;
}

    let html = '';
    secretNotes.forEach(note => {
        html += `
        <div style="background:#fff; padding:12px; margin-bottom:10px; border-radius:8px; border-left: 4px solid #d32f2f; box-shadow: 0 2px 5px rgba(0,0,0,0.05); position: relative;">
            <div style="font-weight:bold; margin-bottom:5px;">${escapeHtml(note.title)}</div>
            <div style="color:#666; font-size:14px; white-space:pre-wrap;">${escapeHtml(note.content)}</div>
            <button onclick="deleteSecretNote(${note.id})" style="position:absolute; top: 5px; right: 5px; background: #ffebee; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; color: #d32f2f;">️</button>
        </div>
        `;
    });



// Обработка Enter
if (document.getElementById('secret-password-input')) {
    document.getElementById('secret-password-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') checkSecretPassword();
    });
}
if (document.getElementById('secret-new-password')) {
    document.getElementById('secret-new-password').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') setSecretPassword();
    });
}



renderNotes();