let notes = JSON.parse(localStorage.getItem('notes')) || [];
let editingId = null;
let currentMode = 'text';


function renderNotes() {

    updateTagFilter();
    

    const tagFilter = document.getElementById('tagFilter').value;
    const sortOption = document.getElementById('sortOption').value;
    

    const grid = document.getElementById('notesGrid');
    
    // фильтруем заметки
    let filteredNotes = notes.filter(note => {
        // Если тег не выбран, показываем все
        if (!tagFilter) return true;
        // Иначе проверяем, есть ли у заметки этот тег
        return note.tags && note.tags.includes(tagFilter);
    });
    
    // сортируем заметки
    filteredNotes = sortNotes(filteredNotes, sortOption);
    

    if (filteredNotes.length === 0) {
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
    let hasPinned = false;
    

    filteredNotes.forEach(note => {
      
        if (note.pinned && !hasPinned) {
            html += '<div class="section-title">📌 Закрепленные</div>';
            hasPinned = true;
        } else if (!note.pinned && hasPinned) {
            html += '<div class="section-title">📋 Остальные заметки</div>';
            hasPinned = 2;
        }
        

        const tagsHtml = note.tags && note.tags.length > 0 
            ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
            : '';
        
        // класс приоритета
        const priorityClass = `priority-${note.priority || 'medium'}`;
        const priorityText = {
            'high': '🔴 Высокий',
            'medium': '🟡 Средний',
            'low': '🟢 Низкий'
        }[note.priority || 'medium'];
        
      
        html += `
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
                <div class="note-title">${escapeHtml(note.title)}</div>
                <div class="note-content">${formatContent(note.content, note.mode)}</div>
                ${tagsHtml}
                <div class="note-date">${formatDate(note.date)}</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// Обновление тегов
function updateTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const currentValue = tagFilter.value;
    
    // Уникальные теги
    const allTags = new Set();
    notes.forEach(note => {
        if (note.tags) {
            note.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    // Сортировка тегов
    const sortedTags = Array.from(allTags).sort();
    
    tagFilter.innerHTML = '<option value="">Все теги</option>';
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilter.appendChild(option);
    });
    
    tagFilter.value = currentValue;
}

// Сортировка
function sortNotes(notesArray, sortOption) {
    return [...notesArray].sort((a, b) => {
        // Сортировка по приоритету (закреплённые всегда сверху)
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
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

// фильтры
function applyFilters() {
    renderNotes();
}

// форматирование содержимого 
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

// Функция форматирования даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Функции модального окна
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
    
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('noteTitle').focus();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingId = null;
}

// Закрытие окна при клике на фон
function closeModalOnOverlay(event) {
    if (event.target === event.currentTarget) {
        closeModal();
    }
}

// режим Текст/Список
function setMode(mode) {
    currentMode = mode;
    document.getElementById('textMode').classList.toggle('active', mode === 'text');
    document.getElementById('listMode').classList.toggle('active', mode === 'list');
    document.getElementById('contentLabel').textContent = mode === 'list' ? 'Элементы списка (каждый с новой строки)' : 'Содержание';
    document.getElementById('noteContent').placeholder = mode === 'list' ? 'Введите элементы списка...\nКаждый элемент с новой строки' : 'Введите текст заметки...';
}

// Сохрание заметки
function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const color = document.getElementById('noteColor').value;
    const pinColor = document.getElementById('pinColor').value;
    const textColor = document.getElementById('textColor').value;
    const priority = document.getElementById('notePriority').value;
    
    // Парсим теги: разбиваем по запятой, убираем пробелы и пустые значения
    const tagsInput = document.getElementById('noteTags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

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
                mode: currentMode,
                color,
                pinColor,
                textColor,
                priority,
                tags,
                date: new Date().toISOString()
            };
        }
    } else {
        const newNote = {
            id: Date.now(),
            title,
            content,
            mode: currentMode,
            color,
            pinColor,
            textColor,
            priority,
            tags,
            pinned: false,
            date: new Date().toISOString()
        };
        notes.unshift(newNote);
    }

    localStorage.setItem('notes', JSON.stringify(notes));
    renderNotes();
    closeModal();
}

// Функция редактирования заметки
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
    
    setMode(note.mode || 'text');
    document.getElementById('modalOverlay').classList.add('active');
}

// Функция переключения статуса закрепления
function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        localStorage.setItem('notes', JSON.stringify(notes));
        renderNotes();
    }
}

// Функция удаления заметки
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