let notes = JSON.parse(localStorage.getItem('notes')) || [];
let editingId = null;
let currentMode = 'text';
let searchQuery = '';

function renderNotes() {
    const grid = document.getElementById('notesGrid');

    let filteredNotes = [];
    let query = searchQuery.toLowerCase().trim().replace('#', '');

    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];
        
        let titleMatch = note.title.toLowerCase().includes(query);
        let contentMatch = note.content.toLowerCase().includes(query);
        
        let tagsArray = (note.tags || '').toLowerCase().split(' ').map(t => t.replace('#', '').trim());
        let tagsMatch = tagsArray.includes(query); 
        if (titleMatch || contentMatch || tagsMatch) {
            filteredNotes.push(note);
        }
    }
    
    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon"></div>
                <h3>Пока нет заметок</h3>
                <p>Создайте свою первую заметку!</p>
            </div>
        `;
        return;
    }

    if (filteredNotes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">🔍</div>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить запрос.</p>
            </div>
        `;
        return;
    }
    
    const sortedNotes = [...filteredNotes].sort((a, b) => {    
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    let html = '';
    let hasPinned = false;
    
    sortedNotes.forEach(note => {
                let tagsHtml = '';
        if (note.tags && note.tags.trim() !== '') {
            let words = note.tags.split(' ');
            tagsHtml = '<div style="margin-top: auto; padding-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">';
            for (let j = 0; j < words.length; j++) {
                let word = words[j].trim();
                if (word !== '') {
                    if (!word.startsWith('#')) { word = '#' + word; }
                    tagsHtml += `<span style="background: rgba(0,0,0,0.06); padding: 2px 8px; border-radius: 12px; font-size: 13px; font-weight: bold; color: inherit;">${escapeHtml(word)}</span>`;
                }
            }
            tagsHtml += '</div>';
        }

        if (note.pinned && !hasPinned) {
            html += '<div class="section-title">📌 Закрепленные</div>';
            hasPinned = true;
        } else if (!note.pinned && hasPinned) {
            html += '<div class="section-title"> Остальные заметки</div>';
            hasPinned = 2;
        }
        
        html += `
            <div class="note-card ${note.pinned ? 'pinned' : ''}" 
                 style="--note-bg: ${note.color || '#ffffff'}; 
                        --pin-bg: ${note.pinColor || '#e1f5fe'}; 
                        --pin-border: ${note.pinColor || '#81d4fa'};
                        --text-color: ${note.textColor || '#5a6c7d'};">
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
                <div class="note-title">${escapeHtml(note.title)}</div>
                <div class="note-content">${formatContent(note.content, note.mode)}</div>
                ${tagsHtml}
                <div class="note-date">${formatDate(note.date)}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

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
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function openModal() {
    editingId = null;
    document.getElementById('modalHeader').textContent = 'Создание заметки';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.querySelector('.btn-save').textContent = 'Создать';
    setMode('text');
    
    document.getElementById('noteColor').value = '#ffffff';
    document.getElementById('pinColor').value = '#e1f5fe';
    document.getElementById('textColor').value = '#5a6c7d';
    
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('noteTitle').focus();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
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
    const tags = document.getElementById('noteTags').value.trim();
    const color = document.getElementById('noteColor').value;
    const pinColor = document.getElementById('pinColor').value;
    const textColor = document.getElementById('textColor').value;

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
                title,
                content,
                tags
                mode: currentMode,
                color: color,
                pinColor: pinColor,
                textColor: textColor,
                date: new Date().toISOString()
            };
        }
    } else {
        const newNote = {
            id: Date.now(),
            title,
            content,
            tags: tags,
            mode: currentMode,
            color: color,
            pinColor: pinColor,
            textColor: textColor,
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
    document.getElementById('noteTags').value = note.tags || '';
    document.querySelector('.btn-save').textContent = 'Сохранить';
    
    document.getElementById('noteColor').value = note.color || '#ffffff';
    document.getElementById('pinColor').value = note.pinColor || '#e1f5fe';
    document.getElementById('textColor').value = note.textColor || '#5a6c7d';
    
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

renderNotes();
function handleSearch(event) {
    searchQuery = event.target.value;
    renderNotes(); 
}
