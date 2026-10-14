const pdfjs = window.pdfjsLib;
const { PDFDocument, degrees } = window.PDFLib;
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.js', document.currentScript.src).href;

const tools = {
  merge: { title: 'Merge PDFs', description: 'Bring files together, in the order you choose.', eyebrow: 'PDF WORKSPACE · 01' },
  split: { title: 'Split PDF', description: 'Pull out just the pages you need.', eyebrow: 'PDF WORKSPACE · 02' },
  organize: { title: 'Organize PDF', description: 'Reorder, rotate, or remove pages with a few moves.', eyebrow: 'PDF WORKSPACE · 03' },
};

const quotes = [
  ['Make room', 'for what', 'matters.'],
  ['Less paper', 'more room', 'to think.'],
  ['Good things', 'come in', 'order.'],
  ['Keep the', 'pages that', 'matter.'],
  ['One less', 'thing to', 'juggle.'],
  ['A little', 'order goes', 'a long way.'],
  ['Make your', 'next page', 'count.'],
  ['Bring the', 'whole story', 'together.'],
  ['Small edits,', 'big sigh', 'of relief.'],
  ['Paperwork,', 'meet your', 'match.'],
  ['Your pages,', 'your way,', 'your call.'],
  ['Cut the', 'clutter, keep', 'the good.'],
  ['Turn the', 'page on', 'busywork.'],
  ['Make files', 'fit the', 'way you work.'],
  ['Neat pages,', 'clear head,', 'carry on.'],
  ['A better', 'flow from', 'page one.'],
  ['Bring pages', 'together,', 'not stress.'],
  ['Good order', 'is its own', 'reward.'],
  ['Shape your', 'pages to', 'the moment.'],
  ['Keep it', 'together,', 'beautifully.'],
  ['Your PDFs,', 'minus the', 'fuss.'],
  ['Make the', 'mess make', 'sense.'],
  ['One tidy', 'document,', 'coming up.'],
  ['Arrange,', 'refine,', 'done.'],
  ['Pages in', 'place. You', 'in peace.'],
  ['Let the', 'pages fall', 'into place.'],
  ['A fresh', 'start for', 'every file.'],
  ['Less shuffling,', 'more', 'doing.'],
];

const state = { files: [], activeFileId: null, tool: 'merge', loading: false, noticeTimer: null, quoteIndex: 0 };
const elements = {
  fileInput: document.querySelector('#file-input'), topUpload: document.querySelector('#top-upload'), headingUpload: document.querySelector('#heading-upload'), emptyUpload: document.querySelector('#empty-upload'), panelUpload: document.querySelector('#panel-upload'), addMore: document.querySelector('#add-more'),
  empty: document.querySelector('#empty-state'), workspace: document.querySelector('#workspace'), title: document.querySelector('#tool-title'), eyebrow: document.querySelector('#tool-eyebrow'), description: document.querySelector('#tool-description'), quote: document.querySelector('#hero-quote'), count: document.querySelector('#file-count'), documentCount: document.querySelector('#document-count'), clear: document.querySelector('#clear-files'), documentList: document.querySelector('#document-list'), documentHint: document.querySelector('#document-hint'), activeName: document.querySelector('#active-file-name'), activeCount: document.querySelector('#active-page-count'), grid: document.querySelector('#page-grid'), gridHint: document.querySelector('#grid-hint'), caption: document.querySelector('#preview-caption'), actions: document.querySelector('#editor-actions'), primary: document.querySelector('#primary-action'), rangePanel: document.querySelector('#range-panel'), ranges: document.querySelector('#page-ranges'), rangeFeedback: document.querySelector('#range-feedback'), split: document.querySelector('#split-download'), noPages: document.querySelector('#no-pages'), notice: document.querySelector('#notice'),
};

const activeFile = () => state.files.find((file) => file.id === state.activeFileId) ?? state.files[0] ?? null;
const formatSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const safeBaseName = (name) => name.replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim() || 'document';

function showNotice(message, kind = 'info') {
  clearTimeout(state.noticeTimer);
  elements.notice.textContent = message;
  elements.notice.className = `notice notice-${kind}`;
  elements.notice.hidden = false;
  state.noticeTimer = setTimeout(() => { elements.notice.hidden = true; }, 6500);
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Working…';
  } else if (button.dataset.originalLabel) {
    button.innerHTML = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
  if (label) button.setAttribute('aria-label', label);
}

function setTool(tool) {
  rotateQuote();
  state.tool = tool;
  document.title = `${tools[tool].title} | PDFman`;
  document.querySelectorAll('.tool-tab').forEach((tab) => {
    const selected = tab.dataset.tool === tool;
    tab.classList.toggle('is-active', selected);
    selected ? tab.setAttribute('aria-current', 'page') : tab.removeAttribute('aria-current');
  });
  elements.title.textContent = tools[tool].title;
  elements.description.textContent = tools[tool].description;
  elements.eyebrow.textContent = tools[tool].eyebrow;
  elements.documentHint.textContent = tool === 'merge' ? 'Files combine from top to bottom.' : 'Select a PDF to preview its pages.';
  elements.gridHint.textContent = tool === 'organize' ? 'Drag to reorder · Use arrows for precision' : tool === 'split' ? 'Choose a page range above' : 'Preview of the selected PDF';
  elements.rangePanel.hidden = tool !== 'split' || !state.files.length;
  elements.primary.hidden = tool === 'split' || !state.files.length;
  elements.primary.innerHTML = tool === 'organize' ? 'Save organized PDF <span aria-hidden="true">↗</span>' : 'Merge PDFs <span aria-hidden="true">↗</span>';
  renderWorkspace();
}

function rotateQuote() {
  const [first, second, final] = quotes[state.quoteIndex];
  state.quoteIndex = (state.quoteIndex + 1) % quotes.length;
  elements.quote.replaceChildren(document.createTextNode(first), document.createElement('br'), document.createTextNode(second), document.createElement('br'));
  const emphasis = document.createElement('em');
  emphasis.textContent = final;
  elements.quote.append(emphasis);
  elements.quote.classList.remove('quote-change');
  void elements.quote.offsetWidth;
  elements.quote.classList.add('quote-change');
}

function openPicker() {
  if (!state.loading) elements.fileInput.click();
}

async function addFiles(fileList) {
  const candidates = [...fileList];
  elements.fileInput.value = '';
  const rejected = candidates.filter((file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'));
  const tooLarge = candidates.filter((file) => file.size > 100 * 1024 * 1024);
  const accepted = candidates.filter((file) => !rejected.includes(file) && !tooLarge.includes(file));
  if (rejected.length) showNotice(`${rejected.length} non-PDF ${rejected.length === 1 ? 'file was' : 'files were'} skipped.`, 'error');
  if (tooLarge.length) showNotice(`${tooLarge.map((file) => file.name).join(', ')} ${tooLarge.length === 1 ? 'is' : 'are'} over the 100 MB limit.`, 'error');
  if (!accepted.length) return;

  state.loading = true;
  [elements.topUpload, elements.headingUpload, elements.emptyUpload, elements.panelUpload, elements.addMore].forEach((button) => { if (button) button.disabled = true; });
  showNotice(`Reading ${accepted.length} ${accepted.length === 1 ? 'PDF' : 'PDFs'} for preview…`);
  for (const file of accepted) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const entry = { id: crypto.randomUUID(), file, bytes, pdf, pageCount: pdf.numPages, pages: Array.from({ length: pdf.numPages }, (_, index) => ({ sourcePage: index + 1, rotation: 0, deleted: false })) };
      state.files.push(entry);
      state.activeFileId = entry.id;
      renderWorkspace();
    } catch (error) {
      console.error('Could not open PDF:', error);
      showNotice(`${file.name} could not be opened. It may be damaged or password-protected.`, 'error');
    }
  }
  state.loading = false;
  [elements.topUpload, elements.headingUpload, elements.emptyUpload, elements.panelUpload, elements.addMore].forEach((button) => { if (button) button.disabled = false; });
  renderWorkspace();
  if (state.files.length && !elements.notice.classList.contains('notice-error')) elements.notice.hidden = true;
}

function renderWorkspace() {
  const hasFiles = state.files.length > 0;
  elements.empty.hidden = hasFiles;
  elements.workspace.hidden = !hasFiles;
  elements.count.textContent = `${state.files.length} ${state.files.length === 1 ? 'file' : 'files'}`;
  elements.documentCount.textContent = state.files.length;
  elements.clear.disabled = !hasFiles || state.loading;
  elements.primary.hidden = !hasFiles || state.tool === 'split';
  elements.rangePanel.hidden = !hasFiles || state.tool !== 'split';
  if (!hasFiles) {
    elements.documentList.replaceChildren();
    elements.grid.replaceChildren();
    return;
  }
  renderDocuments();
  renderPages();
  renderActions();
}

function renderDocuments() {
  elements.documentList.replaceChildren();
  state.files.forEach((file, index) => {
    const item = document.createElement('li');
    item.className = `document-item${file.id === activeFile()?.id ? ' is-selected' : ''}`;
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'document-select';
    select.setAttribute('aria-label', `Preview ${file.file.name}`);
    select.innerHTML = `<span class="document-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6m-6 3h6" /></svg></span><span class="document-text"><strong></strong><small></small></span>`;
    select.querySelector('strong').textContent = file.file.name;
    select.querySelector('small').textContent = `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'} · ${formatSize(file.file.size)}`;
    select.addEventListener('click', () => { state.activeFileId = file.id; renderWorkspace(); });
    const order = document.createElement('div');
    order.className = 'document-controls';
    if (state.tool === 'merge') {
      order.append(makeIconButton('Move file up', '↑', () => moveFile(index, -1), index === 0));
      order.append(makeIconButton('Move file down', '↓', () => moveFile(index, 1), index === state.files.length - 1));
    }
    order.append(makeIconButton(`Remove ${file.file.name}`, '×', () => removeFile(file.id), false, 'remove-icon'));
    item.append(select, order);
    elements.documentList.append(item);
  });
}

function makeIconButton(label, glyph, action, disabled = false, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mini-icon ${extraClass}`;
  button.textContent = glyph;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.disabled = disabled;
  button.addEventListener('click', action);
  return button;
}

function moveFile(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.files.length) return;
  [state.files[index], state.files[target]] = [state.files[target], state.files[index]];
  renderWorkspace();
}

function removeFile(id) {
  const index = state.files.findIndex((file) => file.id === id);
  if (index < 0) return;
  state.files[index].pdf.destroy();
  state.files.splice(index, 1);
  if (state.activeFileId === id) state.activeFileId = state.files[Math.min(index, state.files.length - 1)]?.id ?? null;
  renderWorkspace();
}

function renderActions() {
  const file = activeFile();
  elements.activeName.textContent = file.file.name;
  elements.activeCount.textContent = `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}`;
  elements.actions.replaceChildren();
  if (state.tool === 'organize') {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'button button-quiet reset-pages';
    reset.textContent = 'Reset pages';
    reset.title = 'Restore original page order and rotations';
    reset.addEventListener('click', () => {
      file.pages = Array.from({ length: file.pageCount }, (_, index) => ({ sourcePage: index + 1, rotation: 0, deleted: false }));
      renderPages();
    });
    elements.actions.append(reset);
  }
}

function renderPages() {
  const file = activeFile();
  if (!file) return;
  const visiblePages = file.pages.filter((page) => !page.deleted);
  elements.caption.textContent = state.tool === 'merge' ? 'PAGE PREVIEW · SELECTED PDF' : state.tool === 'split' ? 'PAGE PREVIEW · RANGE SELECTION' : `PAGE ORDER · ${visiblePages.length} PAGES`;
  elements.noPages.hidden = visiblePages.length !== 0;
  elements.grid.hidden = visiblePages.length === 0;
  elements.grid.replaceChildren();
  visiblePages.forEach((page, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.dataset.pageIndex = index;
    card.dataset.sourcePage = page.sourcePage;
    if (state.tool === 'organize') {
      card.draggable = true;
      card.classList.add('is-draggable');
      card.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; card.classList.add('is-dragging'); });
      card.addEventListener('dragend', () => { card.classList.remove('is-dragging'); document.querySelectorAll('.page-card').forEach((node) => node.classList.remove('is-drop-target')); });
      card.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; card.classList.add('is-drop-target'); });
      card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
      card.addEventListener('drop', (event) => {
        event.preventDefault(); card.classList.remove('is-drop-target');
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from) && from !== index) { const [moved] = visiblePages.splice(from, 1); visiblePages.splice(index, 0, moved); file.pages = visiblePages.concat(file.pages.filter((candidate) => candidate.deleted)); renderPages(); }
      });
    }
    const preview = document.createElement('div');
    preview.className = 'page-preview';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Preview of page ${page.sourcePage}`);
    preview.append(canvas);
    const number = document.createElement('div');
    number.className = 'page-number';
    number.innerHTML = `<span>PAGE <b>${String(page.sourcePage).padStart(2, '0')}</b></span><span>${String(index + 1).padStart(2, '0')} / ${String(visiblePages.length).padStart(2, '0')}</span>`;
    card.append(preview, number);
    if (state.tool === 'organize') {
      const controls = document.createElement('div');
      controls.className = 'page-controls';
      controls.append(makeIconButton(`Move page ${index + 1} left`, '←', () => movePage(file, index, -1), index === 0));
      controls.append(makeIconButton(`Move page ${index + 1} right`, '→', () => movePage(file, index, 1), index === visiblePages.length - 1));
      controls.append(makeIconButton(`Rotate page ${index + 1} left`, '↶', () => { page.rotation = (page.rotation + 270) % 360; renderPages(); }, false));
      controls.append(makeIconButton(`Delete page ${index + 1}`, '×', () => { page.deleted = true; renderPages(); }, false, 'remove-icon'));
      card.append(controls);
    }
    elements.grid.append(card);
    renderThumbnail(file.pdf, page.sourcePage, canvas, page.rotation);
  });
}

function movePage(file, index, delta) {
  const visible = file.pages.filter((page) => !page.deleted);
  const target = index + delta;
  if (target < 0 || target >= visible.length) return;
  [visible[index], visible[target]] = [visible[target], visible[index]];
  file.pages = visible.concat(file.pages.filter((page) => page.deleted));
  renderPages();
}

async function renderThumbnail(pdf, pageNumber, canvas, rotation) {
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + rotation + 360) % 360 });
    const scale = Math.min(250 / viewport.width, 320 / viewport.height, 1.4);
    const scaled = page.getViewport({ scale, rotation: (page.rotate + rotation + 360) % 360 });
    const context = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    await page.render({ canvasContext: context, viewport: scaled }).promise;
  } catch (error) { console.warn(`Could not render page ${pageNumber}:`, error); }
}

function parseRanges(input, pageCount) {
  const chunks = input.split(',').map((part) => part.trim()).filter(Boolean);
  if (!chunks.length) throw new Error('Enter at least one page number or range.');
  const pages = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`“${chunk}” is not a valid page or range.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) throw new Error(`Pages must be between 1 and ${pageCount}.`);
    if (start > end) throw new Error('In a range, the first page must come before the last.');
    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  return pages;
}

function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function mergePdfs() {
  if (state.files.length < 2) { showNotice('Add at least two PDFs to merge.', 'error'); return; }
  setBusy(elements.primary, true);
  try {
    const merged = await PDFDocument.create();
    for (const file of state.files) {
      const source = await PDFDocument.load(file.bytes.slice());
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    downloadPdf(await merged.save(), `${safeBaseName(state.files[0].file.name)}_merged.pdf`);
    showNotice(`Merged ${state.files.length} PDFs into a new download. Your originals were not changed.`, 'success');
  } catch (error) { console.error('Merge failed:', error); showNotice('These PDFs could not be merged. One may be damaged or password-protected.', 'error'); }
  finally { setBusy(elements.primary, false); }
}

async function splitPdf() {
  const file = activeFile();
  if (!file) return;
  let pageIndices;
  try { pageIndices = parseRanges(elements.ranges.value, file.pageCount); elements.rangeFeedback.textContent = `${pageIndices.length} ${pageIndices.length === 1 ? 'page' : 'pages'} selected`; elements.rangeFeedback.classList.remove('has-error'); }
  catch (error) { elements.rangeFeedback.textContent = error.message; elements.rangeFeedback.classList.add('has-error'); return; }
  setBusy(elements.split, true);
  try {
    const source = await PDFDocument.load(file.bytes.slice());
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, pageIndices);
    pages.forEach((page) => output.addPage(page));
    downloadPdf(await output.save(), `${safeBaseName(file.file.name)}_pages.pdf`);
    showNotice(`Downloaded ${pageIndices.length} selected ${pageIndices.length === 1 ? 'page' : 'pages'} as a new PDF.`, 'success');
  } catch (error) { console.error('Split failed:', error); showNotice('The selected pages could not be extracted from this PDF.', 'error'); }
  finally { setBusy(elements.split, false); }
}

async function organizePdf() {
  const file = activeFile();
  if (!file) return;
  const pagesToKeep = file.pages.filter((page) => !page.deleted);
  if (!pagesToKeep.length) { showNotice('Keep at least one page in the organized PDF.', 'error'); return; }
  setBusy(elements.primary, true);
  try {
    const source = await PDFDocument.load(file.bytes.slice());
    const output = await PDFDocument.create();
    const copied = await output.copyPages(source, pagesToKeep.map((page) => page.sourcePage - 1));
    copied.forEach((page, index) => {
      const originalRotation = page.getRotation().angle;
      page.setRotation(degrees((originalRotation + pagesToKeep[index].rotation + 360) % 360));
      output.addPage(page);
    });
    downloadPdf(await output.save(), `${safeBaseName(file.file.name)}_organized.pdf`);
    showNotice(`Saved ${pagesToKeep.length} arranged ${pagesToKeep.length === 1 ? 'page' : 'pages'} as a new PDF.`, 'success');
  } catch (error) { console.error('Organize failed:', error); showNotice('This PDF could not be organized. It may be damaged or password-protected.', 'error'); }
  finally { setBusy(elements.primary, false); }
}

document.querySelectorAll('.tool-tab').forEach((tab) => tab.addEventListener('click', () => setTool(tab.dataset.tool)));
[elements.topUpload, elements.headingUpload, elements.emptyUpload, elements.panelUpload, elements.addMore].forEach((button) => button.addEventListener('click', openPicker));
elements.fileInput.addEventListener('change', () => addFiles(elements.fileInput.files));
elements.clear.addEventListener('click', () => {
  state.files.forEach((file) => file.pdf.destroy());
  state.files = [];
  state.activeFileId = null;
  elements.ranges.value = '';
  renderWorkspace();
});
elements.primary.addEventListener('click', () => state.tool === 'organize' ? organizePdf() : mergePdfs());
elements.split.addEventListener('click', splitPdf);
elements.ranges.addEventListener('input', () => { elements.rangeFeedback.textContent = 'Enter page numbers or ranges separated by commas.'; elements.rangeFeedback.classList.remove('has-error'); });
document.querySelectorAll('[data-range]').forEach((button) => button.addEventListener('click', () => {
  const file = activeFile();
  if (!file) return;
  if (button.dataset.range === 'all') elements.ranges.value = file.pageCount === 1 ? '1' : `1-${file.pageCount}`;
  else elements.ranges.value = Array.from({ length: file.pageCount }, (_, index) => index + 1).filter((page) => button.dataset.range === 'odd' ? page % 2 === 1 : page % 2 === 0).join(', ');
  elements.ranges.dispatchEvent(new Event('input'));
}));

const dropSurface = elements.empty;
['dragenter', 'dragover'].forEach((eventName) => dropSurface.addEventListener(eventName, (event) => { event.preventDefault(); dropSurface.classList.add('is-drag-over'); }));
['dragleave', 'drop'].forEach((eventName) => dropSurface.addEventListener(eventName, (event) => { event.preventDefault(); if (eventName === 'drop') addFiles(event.dataTransfer.files); dropSurface.classList.remove('is-drag-over'); }));
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => { if (!dropSurface.contains(event.target)) { event.preventDefault(); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); } });

setTool('merge');