class TaskList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    this.customOptions = this.loadCustomOptions();
    this.theme = localStorage.getItem('taskListTheme') || 'light';

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="styles.css?v=20260408-1">

      <div class="topbar">
        <button id="themeToggle" class="theme-toggle" type="button"></button>
      </div>

      <div class="toolbar" id="toolbar" style="display:none;">
        <button id="bulkDone">Выполнить</button>
        <button class="danger" id="bulkDelete">Удалить</button>
      </div>

      <div class="form">
        <input id="date" type="datetime-local">

        <select id="user">
          <option value="">Ответственный</option>
          <option>Жасмин Мусаева</option>
          <option>Иван Иванов</option>
          <option value="add">Добавить вариант</option>
        </select>

        <select id="type">
          <option value="">Тип</option>
          <option>Звонок</option>
          <option>Письмо</option>
          <option>Встреча</option>
          <option value="add">Добавить вариант</option>
        </select>

        <input id="text" placeholder="Текст задачи">

        <button id="addTask" disabled>Добавить задачу</button>
        <div id="hint" class="hint" style="display:none;">Введите текст задачи</div>
      </div>

      <div class="table">
        <div class="header">
          <div><input type="checkbox" id="selectAll"></div>
          <div class="header-cell">Дата<div class="resizer" data-col="date"></div></div>
          <div class="header-cell">Ответственный<div class="resizer" data-col="user"></div></div>
          <div class="header-cell">Тип<div class="resizer" data-col="type"></div></div>
          <div class="header-cell">Текст задачи<div class="resizer" data-col="text"></div></div>
        </div>
        <div id="list"></div>
      </div>
    `;

    this.renderCustomOptions('user', this.customOptions.users);
    this.renderCustomOptions('type', this.customOptions.types);
    this.applyTheme(this.theme);
  }

  connectedCallback() {
    this.initResize();

    const textInput = this.shadowRoot.getElementById('text');
    const addBtn = this.shadowRoot.getElementById('addTask');
    const dateInput = this.shadowRoot.getElementById('date');
    const userSelect = this.shadowRoot.getElementById('user');
    const typeSelect = this.shadowRoot.getElementById('type');

    textInput.addEventListener('input', () => {
      addBtn.disabled = !textInput.value.trim();
      this.shadowRoot.getElementById('hint').style.display = 'none';
    });

    dateInput.addEventListener('click', () => this.openDatePicker(dateInput));
    dateInput.addEventListener('focus', () => this.openDatePicker(dateInput));

    userSelect.addEventListener('change', () => {
      this.handleAddOption('user', 'users', 'Имя ответственного');
    });

    typeSelect.addEventListener('change', () => {
      this.handleAddOption('type', 'types', 'Тип задачи');
    });

    this.shadowRoot.getElementById('addTask').onclick = () => this.addFromForm();
    this.shadowRoot.getElementById('bulkDelete').onclick = () => this.bulkDelete();
    this.shadowRoot.getElementById('bulkDone').onclick = () => this.bulkDone();
    this.shadowRoot.getElementById('selectAll').onclick = event => this.selectAll(event);
    this.shadowRoot.getElementById('themeToggle').onclick = () => this.toggleTheme();

    this.tasks.forEach(task => this.renderTask(task));
  }

  openDatePicker(dateInput) {
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
    }
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';
    const themeToggle = this.shadowRoot.getElementById('themeToggle');

    this.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('dark-theme-page', isDark);
    themeToggle.textContent = isDark ? '☀' : '☾';
    themeToggle.title = isDark
      ? 'Включить светлую тему'
      : 'Включить темную тему';
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('taskListTheme', this.theme);
    this.applyTheme(this.theme);
  }

  save() {
    localStorage.setItem('tasks', JSON.stringify(this.tasks));
  }

  saveCustomOptions() {
    localStorage.setItem('taskListCustomOptions', JSON.stringify(this.customOptions));
  }

  loadCustomOptions() {
    const savedOptions = JSON.parse(localStorage.getItem('taskListCustomOptions') || '{}');

    return {
      users: Array.isArray(savedOptions.users) ? savedOptions.users : [],
      types: Array.isArray(savedOptions.types) ? savedOptions.types : []
    };
  }

  addFromForm() {
    const get = id => this.shadowRoot.getElementById(id).value;

    const task = {
      id: Date.now(),
      date: get('date'),
      user: get('user'),
      type: get('type'),
      text: get('text').trim(),
      done: false
    };

    if (!task.text) {
      this.shadowRoot.getElementById('hint').style.display = 'block';
      return;
    }

    this.tasks.push(task);
    this.save();
    this.renderTask(task);

    ['date', 'user', 'type', 'text'].forEach(id => {
      this.shadowRoot.getElementById(id).value = '';
    });

    this.shadowRoot.getElementById('addTask').disabled = true;
  }

  handleAddOption(selectId, optionGroup, label) {
    const select = this.shadowRoot.getElementById(selectId);

    if (select.value !== 'add') return;

    this.openOptionModal(selectId, optionGroup, label);
  }

  openOptionModal(selectId, optionGroup, label) {
    const select = this.shadowRoot.getElementById(selectId);
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">Добавить вариант</div>
        <div class="modal-date">${this.escapeHtml(label)}</div>
        <input id="optionValue" class="modal-input">
        <div id="optionHint" class="hint" style="display:none;">Введите значение</div>

        <div class="modal-actions">
          <button id="cancel" type="button">Отмена</button>
          <button id="save" type="button">Добавить</button>
        </div>
      </div>
    `;

    const close = () => {
      select.value = '';
      modal.remove();
    };

    const save = () => {
      const input = modal.querySelector('#optionValue');
      const hint = modal.querySelector('#optionHint');
      const value = input.value.trim();

      if (!value) {
        hint.style.display = 'block';
        input.focus();
        return;
      }

      const existingOption = this.findOption(selectId, value);

      if (existingOption) {
        select.value = existingOption.value;
        modal.remove();
        return;
      }

      this.customOptions[optionGroup].push(value);
      this.renderOption(selectId, value);
      this.saveCustomOptions();
      select.value = value;
      modal.remove();
    };

    modal.onclick = event => {
      if (event.target === modal) close();
    };

    modal.querySelector('#cancel').onclick = close;
    modal.querySelector('#save').onclick = save;
    modal.querySelector('#optionValue').addEventListener('input', () => {
      modal.querySelector('#optionHint').style.display = 'none';
    });
    modal.querySelector('#optionValue').addEventListener('keydown', event => {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') close();
    });

    this.shadowRoot.appendChild(modal);
    modal.querySelector('#optionValue').focus();
  }

  renderCustomOptions(selectId, options) {
    options.forEach(option => {
      if (!this.hasOption(selectId, option)) {
        this.renderOption(selectId, option);
      }
    });
  }

  renderOption(selectId, value) {
    const select = this.shadowRoot.getElementById(selectId);
    const addOption = select.querySelector('option[value="add"]');
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.insertBefore(option, addOption);
  }

  hasOption(selectId, value) {
    const options = [...this.shadowRoot.getElementById(selectId).options];
    return options.some(option => option.value.toLowerCase() === value.toLowerCase());
  }

  findOption(selectId, value) {
    const options = [...this.shadowRoot.getElementById(selectId).options];
    return options.find(option => option.value.toLowerCase() === value.toLowerCase());
  }

  formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  renderTask(task) {
    const row = document.createElement('div');
    row.className = task.done ? 'row done' : 'row';
    row.dataset.id = task.id;

    row.innerHTML = `
      <input type="checkbox">
      <div>${this.escapeHtml(this.formatDate(task.date))}</div>
      <div>${this.escapeHtml(task.user || '')}</div>
      <div>${this.escapeHtml(task.type || '')}</div>
      <div>${this.escapeHtml(task.text)}</div>
    `;

    const checkbox = row.querySelector('input');
    checkbox.addEventListener('change', () => {
      row.classList.toggle('selected', checkbox.checked);
      this.updateToolbar();
    });

    row.addEventListener('click', event => {
      if (event.target.tagName.toLowerCase() === 'input') return;
      this.openModal(row);
    });

    this.shadowRoot.getElementById('list').appendChild(row);
  }

  selectAll(event) {
    const checked = event.target.checked;

    this.shadowRoot.querySelectorAll('.row').forEach(row => {
      const checkbox = row.querySelector('input');
      checkbox.checked = checked;
      row.classList.toggle('selected', checked);
    });

    this.updateToolbar();
  }

  updateToolbar() {
    const toolbar = this.shadowRoot.getElementById('toolbar');
    const selected = this.getSelected();
    toolbar.style.display = selected.length ? 'flex' : 'none';
    this.syncSelectAll(selected);
  }

  getSelected() {
    return [...this.shadowRoot.querySelectorAll('.row')]
      .filter(row => row.querySelector('input').checked);
  }

  syncSelectAll(selected = this.getSelected()) {
    const selectAll = this.shadowRoot.getElementById('selectAll');
    const rows = this.shadowRoot.querySelectorAll('.row');

    selectAll.checked = rows.length > 0 && selected.length === rows.length;
  }

  openModal(row) {
    const id = row.dataset.id;
    const task = this.tasks.find(item => item.id == id);

    if (!task) return;

    const isDone = row.classList.contains('done');
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">${this.escapeHtml(task.text)}</div>
        <div class="modal-date">${this.escapeHtml(this.formatDate(task.date))}</div>

        <div class="modal-actions">
          ${!isDone ? '<button id="done">Выполнить</button>' : ''}
          <button id="delete" class="danger">Удалить</button>
        </div>
      </div>
    `;

    modal.onclick = event => {
      if (event.target === modal) modal.remove();
    };

    if (!isDone) {
      modal.querySelector('#done').onclick = () => {
        const checkbox = row.querySelector('input');
        checkbox.checked = false;
        row.classList.remove('selected');
        row.classList.add('done');

        task.done = true;
        this.save();
        this.updateToolbar();
        modal.remove();
      };
    }

    modal.querySelector('#delete').onclick = () => {
      this.tasks = this.tasks.filter(item => item.id != id);
      row.remove();
      this.save();
      this.updateToolbar();
      modal.remove();
    };

    this.shadowRoot.appendChild(modal);
  }

  bulkDone() {
    this.shadowRoot.querySelectorAll('.row').forEach(row => {
      const checkbox = row.querySelector('input');

      if (checkbox.checked) {
        const task = this.tasks.find(item => item.id == row.dataset.id);

        checkbox.checked = false;
        row.classList.remove('selected');
        row.classList.add('done');

        if (task) task.done = true;
      }
    });

    this.save();
    this.updateToolbar();
  }

  bulkDelete() {
    this.tasks = this.tasks.filter(task => {
      const row = this.shadowRoot.querySelector(`[data-id='${task.id}']`);
      const checkbox = row?.querySelector('input');

      if (checkbox && checkbox.checked) {
        row.remove();
        return false;
      }

      return true;
    });

    this.save();
    this.updateToolbar();
  }

  initResize() {
    const resizers = this.shadowRoot.querySelectorAll('.resizer');

    resizers.forEach(resizer => {
      let startX;
      let startWidth;
      const col = resizer.dataset.col;

      const onMouseMove = event => {
        const dx = event.clientX - startX;
        const newWidth = Math.max(60, startWidth + dx);
        this.style.setProperty(`--col-${col}`, `${newWidth}px`);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      resizer.addEventListener('mousedown', event => {
        startX = event.clientX;
        const style = getComputedStyle(this);
        startWidth = parseInt(style.getPropertyValue(`--col-${col}`), 10) || 150;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
}

customElements.define('task-list', TaskList);
