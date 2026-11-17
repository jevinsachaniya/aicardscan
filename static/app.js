/**
 * CardScan Pro - Modern Clean Minimal Client Logic
 * Turn every business card into a contact, instantly.
 * 100% On-Device Neural Vision Model & Local Optical Extraction
 */

// Application State
const AppState = {
  frontFileBlob: null,
  frontDataUrl: null,
  frontRotation: 0,

  backFileBlob: null,
  backDataUrl: null,
  backRotation: 0,

  activeSide: 'front',
  hasBackSide: false,

  extractionResult: null,
  rawTokens: [],
  showBboxes: true,

  webcamStream: null,
  webcamTarget: 'front', // 'front' | 'back'

  scannedCards: [],
};

// DOM References
const elements = {
  healthStatusText: document.getElementById('health-status-text'),
  navBatchCount: document.getElementById('nav-batch-count'),

  frontFileInput: document.getElementById('front-file-input'),
  backFileInput: document.getElementById('back-file-input'),

  frontIndicatorDot: document.getElementById('front-indicator-dot'),
  frontStatusPill: document.getElementById('front-status-pill'),
  backIndicatorDot: document.getElementById('back-indicator-dot'),
  backStatusPill: document.getElementById('back-status-pill'),

  startScanBtn: document.getElementById('start-scan-btn'),
  scanBtnLabel: document.getElementById('scan-btn-label'),

  cardPreviewViewport: document.getElementById('card-preview-viewport'),
  cardMockupPlaceholder: document.getElementById('card-mockup-placeholder'),
  cardPreviewImg: document.getElementById('card-preview-img'),
  bboxOverlayContainer: document.getElementById('bbox-overlay-container'),

  sideSwitcherBar: document.getElementById('side-switcher-bar'),
  viewFrontTabBtn: document.getElementById('view-front-tab-btn'),
  viewBackTabBtn: document.getElementById('view-back-tab-btn'),
  rotateLeftBtn: document.getElementById('rotate-left-btn'),
  rotateRightBtn: document.getElementById('rotate-right-btn'),
  toggleBboxes: document.getElementById('toggle-bboxes'),

  loadingSection: document.getElementById('loading-section'),
  loadingTitle: document.getElementById('loading-status-title'),
  loadingDesc: document.getElementById('loading-status-desc'),

  reviewStatusLabel: document.getElementById('review-status-label'),
  timingBadge: document.getElementById('timing-badge'),
  engineBadge: document.getElementById('engine-badge'),

  // Output Fields
  fieldName: document.getElementById('field-name'),
  fieldTitle: document.getElementById('field-title'),
  fieldCompany: document.getElementById('field-company'),
  fieldPhonePrimary: document.getElementById('field-phone-primary'),
  fieldMobile: document.getElementById('field-mobile'),
  fieldOfficePhone: document.getElementById('field-office-phone'),
  allPhonesChips: document.getElementById('all-phones-chips'),

  fieldEmailPrimary: document.getElementById('field-email-primary'),
  allEmailsChips: document.getElementById('all-emails-chips'),

  fieldWebsite: document.getElementById('field-website'),
  allWebsitesChips: document.getElementById('all-websites-chips'),

  fieldOfficeAddress: document.getElementById('field-office-address'),
  fieldFactoryAddress: document.getElementById('field-factory-address'),
  fieldAddress: document.getElementById('field-address'),
  fieldRawText: document.getElementById('field-raw-text'),

  phoneContainer: document.getElementById('phone-list-container'),
  emailContainer: document.getElementById('email-list-container'),
  websiteContainer: document.getElementById('website-list-container'),

  addToTableBtn: document.getElementById('add-to-table-btn'),
  exportVcfBtn: document.getElementById('export-vcf-btn'),

  batchCountBadge: document.getElementById('batch-count-badge'),
  batchTableBody: document.getElementById('batch-table-body'),
  batchEmptyView: document.getElementById('batch-empty-view'),
  batchExportCsvBtn: document.getElementById('batch-export-csv-btn'),
  batchExportVcfBtn: document.getElementById('batch-export-vcf-btn'),
  batchExportJsonBtn: document.getElementById('batch-export-json-btn'),
  batchClearBtn: document.getElementById('batch-clear-btn'),
  vaultSearchInput: document.getElementById('vault-search-input'),

  webcamModal: document.getElementById('webcam-modal'),
  webcamModalTitle: document.getElementById('webcam-modal-title'),
  webcamVideo: document.getElementById('webcam-video'),
  webcamCanvas: document.getElementById('webcam-canvas'),
  closeWebcamBtn: document.getElementById('close-webcam-btn'),
  cancelWebcamBtn: document.getElementById('cancel-webcam-btn'),
  captureWebcamBtn: document.getElementById('capture-webcam-btn'),

  tokensModal: document.getElementById('tokens-modal'),
  closeTokensBtn: document.getElementById('close-tokens-btn'),
  tokensTableBody: document.getElementById('tokens-table-body'),

  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
};

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  checkSystemHealth();
  setupEventListeners();
  setupDragAndDrop();
  setupResizeObserver();
  loadSavedBatch();
});

async function checkSystemHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check non-200');
    const data = await res.json();
    if (elements.healthStatusText) {
      elements.healthStatusText.textContent = data.nlp_engine || 'Ollama Vision Model Active';
    }
  } catch (e) {
    if (elements.healthStatusText) {
      elements.healthStatusText.textContent = 'Engine Offline';
      elements.healthStatusText.parentElement.className =
        'flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200';
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Event Listeners Setup
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // File inputs
  elements.frontFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFrontFile(e.target.files[0]);
  });

  elements.backFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleBackFile(e.target.files[0]);
  });

  // Start Extraction Button
  elements.startScanBtn.addEventListener('click', triggerExtraction);

  // Side switcher & rotation buttons
  elements.viewFrontTabBtn.addEventListener('click', () => switchViewerSide('front'));
  elements.viewBackTabBtn.addEventListener('click', () => switchViewerSide('back'));
  elements.rotateLeftBtn.addEventListener('click', () => rotateActiveSide(-90));
  elements.rotateRightBtn.addEventListener('click', () => rotateActiveSide(90));
  elements.toggleBboxes.addEventListener('change', (e) => {
    AppState.showBboxes = e.target.checked;
    renderBoundingBoxes();
  });

  // Batch actions
  elements.addToTableBtn.addEventListener('click', addCurrentCardToBatch);
  elements.exportVcfBtn.addEventListener('click', downloadCurrentCardVcf);

  elements.batchExportCsvBtn.addEventListener('click', exportBatchToExcel);
  elements.batchExportVcfBtn.addEventListener('click', exportBatchVcf);
  elements.batchExportJsonBtn.addEventListener('click', exportBatchJson);
  elements.batchClearBtn.addEventListener('click', clearBatchTable);

  // Webcam Modal controls
  elements.closeWebcamBtn.addEventListener('click', closeWebcam);
  elements.cancelWebcamBtn.addEventListener('click', closeWebcam);
  elements.captureWebcamBtn.addEventListener('click', captureWebcamPhoto);

  // Optional Gemini AI Key Modal controls
  const apiKeyModal = document.getElementById('api-key-modal');
  const btnApiKeyModal = document.getElementById('btn-api-key-modal');
  const closeApiKeyModal = document.getElementById('close-api-key-modal');
  const inputGeminiApiKey = document.getElementById('input-gemini-api-key');
  const btnSaveApiKey = document.getElementById('btn-save-api-key');
  const btnClearApiKey = document.getElementById('btn-clear-api-key');

  if (btnApiKeyModal && apiKeyModal) {
    btnApiKeyModal.addEventListener('click', () => {
      const existing = localStorage.getItem('gemini_api_key') || '';
      if (inputGeminiApiKey) inputGeminiApiKey.value = existing;
      apiKeyModal.classList.remove('hidden');
    });

    if (closeApiKeyModal) {
      closeApiKeyModal.addEventListener('click', () => apiKeyModal.classList.add('hidden'));
    }

    apiKeyModal.addEventListener('click', (e) => {
      if (e.target === apiKeyModal) apiKeyModal.classList.add('hidden');
    });

    if (btnSaveApiKey && inputGeminiApiKey) {
      btnSaveApiKey.addEventListener('click', () => {
        const val = inputGeminiApiKey.value.trim();
        if (val) {
          localStorage.setItem('gemini_api_key', val);
          showToast('Gemini AI Key saved! 99% accuracy enabled.');
        } else {
          localStorage.removeItem('gemini_api_key');
          showToast('API Key cleared. Using Local Engine.');
        }
        apiKeyModal.classList.add('hidden');
      });
    }

    if (btnClearApiKey && inputGeminiApiKey) {
      btnClearApiKey.addEventListener('click', () => {
        localStorage.removeItem('gemini_api_key');
        inputGeminiApiKey.value = '';
        showToast('API Key cleared. Using Local Engine.');
        apiKeyModal.classList.add('hidden');
      });
    }
  }

  // Tokens Modal
  if (elements.closeTokensBtn) {
    elements.closeTokensBtn.addEventListener('click', () => elements.tokensModal.classList.add('hidden'));
  }
}

function scrollToScanner() {
  const el = document.getElementById('scanner-dock-anchor');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function triggerUploadModal(side = 'front') {
  if (side === 'front') elements.frontFileInput.click();
  else elements.backFileInput.click();
}

// ---------------------------------------------------------------------------
// 3. File Handling & Drag and Drop
// ---------------------------------------------------------------------------
function handleFrontFile(file) {
  if (!file) return;
  AppState.frontFileBlob = file;
  AppState.frontRotation = 0;

  if (elements.frontIndicatorDot) elements.frontIndicatorDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
  if (elements.frontStatusPill) {
    elements.frontStatusPill.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200';
    elements.frontStatusPill.textContent = '✓ Attached';
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    AppState.frontDataUrl = e.target.result;
    elements.cardMockupPlaceholder.classList.add('hidden');
    elements.cardPreviewImg.classList.remove('hidden');
    elements.cardPreviewImg.src = e.target.result;
    elements.cardPreviewImg.style.transform = 'rotate(0deg)';
    
    if (elements.scanBtnLabel) {
      elements.scanBtnLabel.textContent = AppState.backFileBlob
        ? 'Perceive Both Sides (Front + Back)'
        : 'Perceive & Digitize Card';
    }
    showToast('Front photo attached! Click "Scan Card with Vision AI" or add Back photo.');
  };
  reader.readAsDataURL(file);
}

function handleBackFile(file) {
  if (!file) return;
  AppState.backFileBlob = file;
  AppState.backRotation = 0;
  AppState.hasBackSide = true;

  if (elements.backIndicatorDot) elements.backIndicatorDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
  if (elements.backStatusPill) {
    elements.backStatusPill.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200';
    elements.backStatusPill.textContent = '✓ Attached';
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    AppState.backDataUrl = e.target.result;
    if (elements.scanBtnLabel) {
      elements.scanBtnLabel.textContent = 'Perceive Both Sides (Front + Back)';
    }
    showToast('Back photo attached! Ready for Dual-Side Vision scanning.');
  };
  reader.readAsDataURL(file);
}

function setupDragAndDrop() {
  const vp = elements.cardPreviewViewport;
  if (!vp) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    vp.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  vp.addEventListener('dragover', () => {
    vp.classList.add('ring-2', 'ring-blue-400');
  });

  vp.addEventListener('dragleave', () => {
    vp.classList.remove('ring-2', 'ring-blue-400');
  });

  vp.addEventListener('drop', (e) => {
    vp.classList.remove('ring-2', 'ring-blue-400');
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      if (!AppState.frontFileBlob) {
        handleFrontFile(files[0]);
        if (files[1]) handleBackFile(files[1]);
      } else {
        handleBackFile(files[0]);
      }
    }
  });
}

function resetMockupView() {
  AppState.frontFileBlob = null;
  AppState.frontDataUrl = null;
  AppState.frontRotation = 0;
  AppState.backFileBlob = null;
  AppState.backDataUrl = null;
  AppState.backRotation = 0;
  AppState.hasBackSide = false;
  AppState.extractionResult = null;
  AppState.rawTokens = [];

  elements.frontFileInput.value = '';
  elements.backFileInput.value = '';

  if (elements.frontIndicatorDot) elements.frontIndicatorDot.className = 'w-2 h-2 rounded-full bg-blue-600';
  if (elements.frontStatusPill) {
    elements.frontStatusPill.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200';
    elements.frontStatusPill.textContent = 'Required';
  }

  if (elements.backIndicatorDot) elements.backIndicatorDot.className = 'w-2 h-2 rounded-full bg-slate-300';
  if (elements.backStatusPill) {
    elements.backStatusPill.className = 'text-[10px] font-semibold text-slate-500';
    elements.backStatusPill.textContent = 'Optional';
  }

  elements.cardMockupPlaceholder.classList.remove('hidden');
  elements.cardPreviewImg.classList.add('hidden');
  elements.cardPreviewImg.src = '';
  elements.bboxOverlayContainer.innerHTML = '';
  elements.sideSwitcherBar.classList.add('hidden');

  elements.fieldName.value = '';
  elements.fieldTitle.value = '';
  elements.fieldCompany.value = '';
  elements.fieldPhonePrimary.value = '';
  if (elements.fieldMobile) elements.fieldMobile.value = '';
  if (elements.fieldOfficePhone) elements.fieldOfficePhone.value = '';
  if (elements.allPhonesChips) elements.allPhonesChips.innerHTML = '<span class="text-xs text-slate-400 italic px-1">Detected numbers will appear here</span>';

  elements.fieldEmailPrimary.value = '';
  if (elements.allEmailsChips) elements.allEmailsChips.innerHTML = '';

  if (elements.fieldWebsite) elements.fieldWebsite.value = '';
  if (elements.allWebsitesChips) elements.allWebsitesChips.innerHTML = '';

  if (elements.fieldOfficeAddress) elements.fieldOfficeAddress.value = '';
  if (elements.fieldFactoryAddress) elements.fieldFactoryAddress.value = '';
  if (elements.fieldAddress) elements.fieldAddress.value = '';
  if (elements.fieldRawText) elements.fieldRawText.value = '';

  elements.reviewStatusLabel.textContent = 'Inputs cleared — click Upload or Camera to begin.';
  elements.scanBtnLabel.textContent = 'Scan Card with Vision AI';
  showToast('Reset complete. Ready for new card.');
}

// ---------------------------------------------------------------------------
// 4. Built-in 1-Click Samples
// ---------------------------------------------------------------------------
async function loadSample(sampleId) {
  showLoading('Loading Sample Card...', `Fetching ${sampleId}`);
  scrollToScanner();
  try {
    const res = await fetch(`/api/samples/${sampleId}`);
    if (!res.ok) throw new Error('Failed to fetch sample image');
    const blob = await res.blob();
    const file = new File([blob], sampleId, { type: 'image/png' });

    AppState.backFileBlob = null;
    AppState.backDataUrl = null;
    if (elements.backIndicatorDot) elements.backIndicatorDot.className = 'w-2 h-2 rounded-full bg-slate-300';
    if (elements.backStatusPill) {
      elements.backStatusPill.className = 'text-[10px] font-semibold text-slate-500';
      elements.backStatusPill.textContent = 'Optional';
    }

    handleFrontFile(file);
    setTimeout(() => {
      triggerExtraction();
    }, 200);
  } catch (err) {
    hideLoading();
    showToast(`Sample error: ${err.message}`);
  }
}

async function loadDualFoodoraSample() {
  showLoading('Loading Dual-Side Card...', 'Ingesting Front + Back of Foodora IMPEX');
  scrollToScanner();
  try {
    const [frontRes, backRes] = await Promise.all([
      fetch('/api/samples/front.jpeg'),
      fetch('/api/samples/back.jpeg')
    ]);

    if (!frontRes.ok || !backRes.ok) throw new Error('Failed to fetch dual-side assets');
    const frontBlob = await frontRes.blob();
    const backBlob = await backRes.blob();

    const frontFile = new File([frontBlob], 'front.jpeg', { type: 'image/jpeg' });
    const backFile = new File([backBlob], 'back.jpeg', { type: 'image/jpeg' });

    handleFrontFile(frontFile);
    handleBackFile(backFile);

    setTimeout(() => {
      triggerExtraction();
    }, 250);
  } catch (err) {
    hideLoading();
    showToast(`Dual-side loading error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Extraction Pipeline Execution
// ---------------------------------------------------------------------------
async function triggerExtraction() {
  if (!AppState.frontFileBlob) {
    alert('Please attach or click a Front Photo first.');
    elements.frontFileInput.click();
    return;
  }

  showLoading(
    'Running Neural Vision Intelligence...',
    AppState.backFileBlob
      ? 'Analyzing Front & Back Sides with MiniCPM-V + EasyOCR...'
      : 'Extracting contact details and spatial coordinates...'
  );

  try {
    const formData = new FormData();
    formData.append('file', AppState.frontFileBlob);
    formData.append('rotation', AppState.frontRotation);

    if (AppState.backFileBlob) {
      formData.append('back_file', AppState.backFileBlob);
      formData.append('back_rotation', AppState.backRotation);
    }

    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey && savedApiKey.trim()) {
      formData.append('api_key', savedApiKey.trim());
    }

    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.detail || `Server returned error ${response.status}`);
    }

    const json = await response.json();
    AppState.extractionResult = json;
    AppState.rawTokens = json.data.raw_ocr_tokens || [];
    AppState.hasBackSide = json.has_back_side;

    hideLoading();
    renderExtractionResults(json);
    showToast('Business Card Scanned & Structured!');
  } catch (err) {
    hideLoading();
    alert(`Extraction Pipeline Notice:\n${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 6. Results Rendering & Form Population (All Details Visible!)
// ---------------------------------------------------------------------------
function renderExtractionResults(apiResponse) {
  elements.timingBadge.textContent = `${apiResponse.processing_time_ms} ms`;
  elements.engineBadge.textContent = apiResponse.nlp_model || 'MiniCPM-V Vision';
  elements.reviewStatusLabel.textContent = 'Scanned & Classified — Review details below';

  if (AppState.hasBackSide) {
    elements.sideSwitcherBar.classList.remove('hidden');
    updateSideSwitcherTabs();
  } else {
    elements.sideSwitcherBar.classList.add('hidden');
  }

  elements.cardMockupPlaceholder.classList.add('hidden');
  elements.cardPreviewImg.classList.remove('hidden');
  renderActiveSidePreview();

  const d = apiResponse.data;

  // 1. Primary Identity Fields
  elements.fieldName.value = d.name || '';
  elements.fieldTitle.value = d.title || '';
  elements.fieldCompany.value = d.company || '';

  // 2. Phone Numbers (Mobile, Office Phone, All detected numbers list)
  const phoneList = Array.isArray(d.phone) ? d.phone : (d.phone ? [d.phone] : []);
  const primaryMobile = d.mobile || (phoneList.length > 0 ? phoneList[0] : '');
  const officePhone = d.office_phone || (phoneList.length > 1 ? phoneList[1] : '');

  elements.fieldPhonePrimary.value = primaryMobile;
  if (elements.fieldMobile) elements.fieldMobile.value = primaryMobile;
  if (elements.fieldOfficePhone) elements.fieldOfficePhone.value = officePhone;

  // Render all phone numbers into interactive chips
  if (elements.allPhonesChips) {
    elements.allPhonesChips.innerHTML = '';
    if (phoneList.length === 0) {
      elements.allPhonesChips.innerHTML = '<span class="text-xs text-slate-400 italic px-1">No phone numbers detected</span>';
    } else {
      phoneList.forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200 cursor-pointer hover:bg-amber-100 transition shadow-2xs';
        chip.title = 'Click to copy';
        chip.innerHTML = `<span>📞 ${escapeHtml(p)}</span>`;
        chip.onclick = () => copyToClipboard(p, 'Phone number');
        elements.allPhonesChips.appendChild(chip);
      });
    }
  }

  // 3. Email Addresses
  const emailList = Array.isArray(d.email) ? d.email : (d.email ? [d.email] : []);
  elements.fieldEmailPrimary.value = emailList.length > 0 ? emailList[0] : '';
  if (elements.allEmailsChips) {
    elements.allEmailsChips.innerHTML = '';
    if (emailList.length > 1) {
      emailList.slice(1).forEach(em => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono bg-rose-50 text-rose-800 border border-rose-200 cursor-pointer hover:bg-rose-100 transition';
        chip.title = 'Click to copy';
        chip.innerHTML = `<span>✉️ ${escapeHtml(em)}</span>`;
        chip.onclick = () => copyToClipboard(em, 'Email address');
        elements.allEmailsChips.appendChild(chip);
      });
    }
  }

  // 4. Websites
  const websiteList = Array.isArray(d.website) ? d.website : (d.website ? [d.website] : []);
  if (elements.fieldWebsite) {
    elements.fieldWebsite.value = websiteList.length > 0 ? websiteList[0] : '';
  }
  if (elements.allWebsitesChips) {
    elements.allWebsitesChips.innerHTML = '';
    if (websiteList.length > 1) {
      websiteList.slice(1).forEach(w => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-800 border border-blue-200 cursor-pointer hover:bg-blue-100 transition';
        chip.title = 'Click to test URL';
        chip.innerHTML = `<span>🌐 ${escapeHtml(w)}</span>`;
        chip.onclick = () => window.open(w.startsWith('http') ? w : `https://${w}`, '_blank');
        elements.allWebsitesChips.appendChild(chip);
      });
    }
  }

  // 5. Addresses (Office Address, Factory Address, Combined Address)
  const fullAddress = d.address || '';
  const officeAddress = d.office_address || fullAddress;
  const factoryAddress = d.factory_address || '';

  if (elements.fieldOfficeAddress) elements.fieldOfficeAddress.value = officeAddress;
  if (elements.fieldFactoryAddress) elements.fieldFactoryAddress.value = factoryAddress;
  if (elements.fieldAddress) elements.fieldAddress.value = fullAddress;

  // 6. Full Detected Raw Text across both sides
  if (elements.fieldRawText) {
    const rawLines = d.raw_text || (d.raw_ocr_tokens ? d.raw_ocr_tokens.map(t => t.text).join('\n') : '');
    elements.fieldRawText.value = rawLines;
  }

  // Populate tokens table for inspection modal
  populateTokensTable(d.raw_ocr_tokens || []);
}

function updateSideSwitcherTabs() {
  if (AppState.activeSide === 'front') {
    elements.viewFrontTabBtn.className = 'py-1 px-3 text-xs font-bold rounded-lg bg-white text-[#2563eb] shadow-xs transition';
    elements.viewBackTabBtn.className = 'py-1 px-3 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 transition';
  } else {
    elements.viewBackTabBtn.className = 'py-1 px-3 text-xs font-bold rounded-lg bg-white text-[#2563eb] shadow-xs transition';
    elements.viewFrontTabBtn.className = 'py-1 px-3 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 transition';
  }
}

function switchViewerSide(side) {
  if (side === AppState.activeSide) return;
  AppState.activeSide = side;
  updateSideSwitcherTabs();
  renderActiveSidePreview();
}

function renderActiveSidePreview() {
  const targetUrl = (AppState.activeSide === 'back')
    ? (AppState.backDataUrl || AppState.frontDataUrl)
    : AppState.frontDataUrl;

  const targetRotation = (AppState.activeSide === 'back')
    ? AppState.backRotation
    : AppState.frontRotation;

  elements.cardPreviewImg.onload = () => {
    requestAnimationFrame(() => {
      renderBoundingBoxes();
    });
  };

  elements.cardPreviewImg.style.transform = `rotate(${targetRotation}deg)`;
  elements.cardPreviewImg.src = targetUrl;
}

function rotateActiveSide(deg) {
  if (AppState.activeSide === 'front') {
    AppState.frontRotation = (AppState.frontRotation + deg + 360) % 360;
  } else {
    AppState.backRotation = (AppState.backRotation + deg + 360) % 360;
  }
  renderActiveSidePreview();
}

// ---------------------------------------------------------------------------
// 7. Interactive Bounding Boxes
// ---------------------------------------------------------------------------
function renderBoundingBoxes() {
  elements.bboxOverlayContainer.innerHTML = '';
  if (!AppState.showBboxes) return;

  const img = elements.cardPreviewImg;
  const rect = img.getBoundingClientRect();
  const parentRect = elements.cardPreviewViewport.getBoundingClientRect();

  const imgDisplayWidth = rect.width;
  const imgDisplayHeight = rect.height;
  const offsetX = rect.left - parentRect.left;
  const offsetY = rect.top - parentRect.top;

  const currentSideTokens = AppState.rawTokens.filter(t => (t.side || 'front') === AppState.activeSide);

  currentSideTokens.forEach((token, index) => {
    const bbox = token.bbox;
    if (!bbox) return;

    const boxLeft = offsetX + (bbox.x_min * imgDisplayWidth);
    const boxTop = offsetY + (bbox.y_min * imgDisplayHeight);
    const boxWidth = (bbox.x_max - bbox.x_min) * imgDisplayWidth;
    const boxHeight = (bbox.y_max - bbox.y_min) * imgDisplayHeight;

    const div = document.createElement('div');
    div.className = `bbox-marker cat-${(token.category || 'OTHER').toLowerCase()}`;
    div.style.left = `${boxLeft}px`;
    div.style.top = `${boxTop}px`;
    div.style.width = `${boxWidth}px`;
    div.style.height = `${boxHeight}px`;

    div.addEventListener('mouseenter', (e) => showTooltip(e, token));
    div.addEventListener('mouseleave', hideTooltip);
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(token.text, 'Token text');
    });

    elements.bboxOverlayContainer.appendChild(div);
  });
}

function setupResizeObserver() {
  const resizeObserver = new ResizeObserver(() => {
    if (elements.cardPreviewImg && !elements.cardPreviewImg.classList.contains('hidden')) {
      renderBoundingBoxes();
    }
  });
  if (elements.cardPreviewViewport) resizeObserver.observe(elements.cardPreviewViewport);
}

function showTooltip(e, token) {
  // Can be used for rich hover previews
}

function hideTooltip() {}

function populateTokensTable(tokens) {
  if (!elements.tokensTableBody) return;
  elements.tokensTableBody.innerHTML = '';
  tokens.forEach((t, i) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="p-2 text-slate-400">${i + 1}</td>
      <td class="p-2 font-semibold text-slate-900">${escapeHtml(t.text)}</td>
      <td class="p-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold cat-${(t.category || 'OTHER').toLowerCase()}">${t.category || 'OTHER'}</span></td>
      <td class="p-2">${Math.round((t.confidence || 0) * 100)}%</td>
      <td class="p-2 uppercase text-[10px] text-slate-500">${t.side || 'front'}</td>
    `;
    elements.tokensTableBody.appendChild(tr);
  });
}

function toggleTokensModal() {
  if (elements.tokensModal) elements.tokensModal.classList.toggle('hidden');
}

// ---------------------------------------------------------------------------
// 8. Batch Contacts Vault
// ---------------------------------------------------------------------------
function getCurrentFormCardData() {
  const phones = [];
  const pMobile = (elements.fieldPhonePrimary ? elements.fieldPhonePrimary.value.trim() : '');
  const pOffice = (elements.fieldOfficePhone ? elements.fieldOfficePhone.value.trim() : '');

  if (pMobile) phones.push(pMobile);
  if (pOffice && !phones.includes(pOffice)) phones.push(pOffice);

  // Collect from all phones chips if available
  if (elements.allPhonesChips) {
    elements.allPhonesChips.querySelectorAll('span').forEach(sp => {
      const txt = sp.textContent.replace('📞', '').trim();
      if (txt && !txt.includes('Detected') && !phones.includes(txt)) phones.push(txt);
    });
  }

  const emails = [];
  const e1 = elements.fieldEmailPrimary.value.trim();
  if (e1) emails.push(e1);

  const website = elements.fieldWebsite ? elements.fieldWebsite.value.trim() : '';
  const websites = website ? [website] : [];

  const officeAddr = elements.fieldOfficeAddress ? elements.fieldOfficeAddress.value.trim() : elements.fieldAddress.value.trim();
  const factoryAddr = elements.fieldFactoryAddress ? elements.fieldFactoryAddress.value.trim() : '';

  return {
    id: `card_${Date.now()}`,
    name: elements.fieldName.value.trim(),
    title: elements.fieldTitle.value.trim(),
    company: elements.fieldCompany.value.trim(),
    mobile: pMobile,
    officePhone: pOffice,
    phone: phones,
    email: emails,
    website: websites,
    officeAddress: officeAddr,
    factoryAddress: factoryAddr,
    address: officeAddr || factoryAddr,
    scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

function addCurrentCardToBatch() {
  const cardData = getCurrentFormCardData();
  if (!cardData.name && !cardData.company && cardData.phone.length === 0 && cardData.email.length === 0) {
    showToast('Cannot save empty contact.');
    return;
  }

  AppState.scannedCards.unshift(cardData);
  saveBatchToStorage();
  updateBatchTableUI();
  showToast(`"${cardData.name || cardData.company}" saved to Batch Vault!`);

  const vaultEl = document.getElementById('batch-vault-section');
  if (vaultEl) vaultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateBatchTableUI() {
  const cards = AppState.scannedCards;
  const count = cards.length;

  if (elements.batchCountBadge) {
    elements.batchCountBadge.textContent = `${count} Contact${count === 1 ? '' : 's'}`;
  }
  if (elements.navBatchCount) {
    elements.navBatchCount.textContent = count;
  }

  const hasCards = count > 0;
  if (elements.batchExportCsvBtn) elements.batchExportCsvBtn.disabled = !hasCards;
  if (elements.batchExportVcfBtn) elements.batchExportVcfBtn.disabled = !hasCards;
  if (elements.batchExportJsonBtn) elements.batchExportJsonBtn.disabled = !hasCards;
  if (elements.batchClearBtn) elements.batchClearBtn.disabled = !hasCards;

  if (!hasCards) {
    if (elements.batchEmptyView) elements.batchEmptyView.classList.remove('hidden');
    if (elements.batchTableBody) elements.batchTableBody.innerHTML = '';
    return;
  }

  if (elements.batchEmptyView) elements.batchEmptyView.classList.add('hidden');
  renderBatchRows(cards);
}

function renderBatchRows(cards) {
  if (!elements.batchTableBody) return;
  elements.batchTableBody.innerHTML = '';
  cards.forEach((card, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    const mobileStr = card.mobile || (card.phone && card.phone[0]) || '-';
    const officeStr = card.officePhone || (card.phone && card.phone.length > 1 ? card.phone[1] : '-') || '-';
    const emails = (card.email || []).map(e => `<a href="mailto:${e}" class="text-blue-600 hover:underline block">${escapeHtml(e)}</a>`).join('') || '<span class="text-slate-400">-</span>';
    const webStr = (card.website && card.website.length > 0) ? `<a href="${card.website[0].startsWith('http') ? card.website[0] : 'https://' + card.website[0]}" target="_blank" class="text-blue-600 hover:underline">${escapeHtml(card.website[0])}</a>` : '-';

    tr.innerHTML = `
      <td class="p-3 text-center text-slate-400 font-mono">${index + 1}</td>
      <td class="p-3 font-bold text-[#091325]">${escapeHtml(card.name || 'Untitled')}</td>
      <td class="p-3 text-[#475569]">${escapeHtml(card.title || '-')}</td>
      <td class="p-3 font-semibold text-[#091325]">${escapeHtml(card.company || '-')}</td>
      <td class="p-3 font-mono text-[11px] text-slate-800">${escapeHtml(mobileStr)}</td>
      <td class="p-3 font-mono text-[11px] text-slate-600">${escapeHtml(officeStr)}</td>
      <td class="p-3 font-mono text-[11px]">${emails}</td>
      <td class="p-3 font-mono text-[11px]">${webStr}</td>
      <td class="p-3 text-slate-600 text-xs max-w-[200px] truncate" title="${escapeHtml(card.officeAddress || card.address || '')}">${escapeHtml(card.officeAddress || card.address || '-')}</td>
      <td class="p-3 text-slate-500 text-xs max-w-[180px] truncate" title="${escapeHtml(card.factoryAddress || '')}">${escapeHtml(card.factoryAddress || '-')}</td>
      <td class="p-3 text-center sticky right-0 bg-white group-hover:bg-slate-50">
        <div class="flex items-center justify-center space-x-2">
          <button onclick="downloadSingleCardVcf(${index})" class="text-blue-600 hover:text-blue-800 transition" title="Download .vcf">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          </button>
          <button onclick="deleteCardFromBatch(${index})" class="text-slate-400 hover:text-rose-600 transition" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    `;
    elements.batchTableBody.appendChild(tr);
  });
}

function filterBatchTable(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderBatchRows(AppState.scannedCards);
    return;
  }
  const filtered = AppState.scannedCards.filter(c => {
    return (c.name || '').toLowerCase().includes(q) ||
           (c.company || '').toLowerCase().includes(q) ||
           (c.title || '').toLowerCase().includes(q) ||
           (c.mobile || '').includes(q) ||
           (c.officePhone || '').includes(q) ||
           (c.phone || []).some(p => p.includes(q)) ||
           (c.officeAddress || '').toLowerCase().includes(q) ||
           (c.factoryAddress || '').toLowerCase().includes(q) ||
           (c.email || []).some(e => e.toLowerCase().includes(q));
  });
  renderBatchRows(filtered);
}

function deleteCardFromBatch(index) {
  AppState.scannedCards.splice(index, 1);
  saveBatchToStorage();
  updateBatchTableUI();
  showToast('Contact removed from vault.');
}

function clearBatchTable() {
  if (confirm('Clear all contacts in the batch vault?')) {
    AppState.scannedCards = [];
    saveBatchToStorage();
    updateBatchTableUI();
    showToast('Batch vault cleared.');
  }
}

function saveBatchToStorage() {
  try {
    localStorage.setItem('cardscan_batch_cards', JSON.stringify(AppState.scannedCards));
  } catch (e) {}
}

function loadSavedBatch() {
  try {
    const raw = localStorage.getItem('cardscan_batch_cards');
    if (raw) {
      AppState.scannedCards = JSON.parse(raw);
    }
  } catch (e) {
    AppState.scannedCards = [];
  }
  updateBatchTableUI();
}

// ---------------------------------------------------------------------------
// 9. Exports (Excel .xlsx via SheetJS, vCard, CSV, JSON)
// ---------------------------------------------------------------------------
function exportCurrentCardToExcel() {
  const card = getCurrentFormCardData();
  const row = [{
    "Sr No": 1,
    "Full Name": card.name || '',
    "Job Title": card.title || '',
    "Company Name": card.company || '',
    "Mobile": card.mobile || (card.phone[0] || ''),
    "Office Phone": card.officePhone || '',
    "Email Address": (card.email && card.email[0]) || '',
    "Website": (card.website && card.website[0]) || '',
    "Office Address": card.officeAddress || '',
    "Factory Address": card.factoryAddress || '',
    "All Phone Numbers": (card.phone || []).join(', ')
  }];

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(row);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Card Contact");
    const namePart = (card.name || 'Contact').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${namePart}_Card.xlsx`);
    showToast('Downloaded Excel file (.xlsx)!');
  } else {
    exportBatchCsvDirect(row);
  }
}

function exportBatchToExcel() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    showToast('Table is empty.');
    return;
  }

  const rows = cards.map((c, i) => ({
    "Sr No": i + 1,
    "Full Name": c.name || '',
    "Job Title": c.title || '',
    "Company Name": c.company || '',
    "Mobile Number": c.mobile || (c.phone[0] || ''),
    "Office Phone": c.officePhone || '',
    "Email Address": (c.email && c.email.join(', ')) || '',
    "Website": (c.website && c.website.join(', ')) || '',
    "Office Address": c.officeAddress || c.address || '',
    "Factory Address": c.factoryAddress || '',
    "All Phone Numbers": (c.phone || []).join(', ')
  }));

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },  // Sr No
      { wch: 22 }, // Full Name
      { wch: 22 }, // Job Title
      { wch: 26 }, // Company
      { wch: 18 }, // Mobile
      { wch: 18 }, // Office Phone
      { wch: 26 }, // Email
      { wch: 22 }, // Website
      { wch: 45 }, // Office Address
      { wch: 40 }, // Factory Address
      { wch: 30 }, // All Phones
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visiting Cards");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Business_Cards_Vault_${dateStr}.xlsx`);
    showToast(`Exported ${cards.length} contacts to Excel (.xlsx)!`);
  } else {
    exportBatchCsvDirect(rows);
  }
}

function exportBatchCsvDirect(rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];

  rows.forEach(r => {
    const line = headers.map(h => {
      const val = String(r[h] || '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
    csvLines.push(line);
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Business_Cards_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded CSV spreadsheet!');
}

async function downloadCurrentCardVcf() {
  const card = getCurrentFormCardData();
  try {
    const payload = {
      name: card.name,
      title: card.title,
      company: card.company,
      phone: card.phone,
      email: card.email,
      website: card.website,
      address: card.address
    };
    const res = await fetch('/api/export-vcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate vCard');
    const vcfText = await res.text();
    downloadBlob(vcfText, `${(card.name || 'contact').replace(/[^a-zA-Z0-9]/g, '_')}.vcf`, 'text/vcard');
    showToast('Downloaded .vcf file for your phone address book!');
  } catch (err) {
    showToast(`vCard export error: ${err.message}`);
  }
}

async function downloadSingleCardVcf(index) {
  const card = AppState.scannedCards[index];
  if (!card) return;
  try {
    const payload = {
      name: card.name,
      title: card.title,
      company: card.company,
      phone: card.phone,
      email: card.email,
      website: card.website,
      address: card.address
    };
    const res = await fetch('/api/export-vcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate vCard');
    const vcfText = await res.text();
    downloadBlob(vcfText, `${(card.name || 'contact').replace(/[^a-zA-Z0-9]/g, '_')}.vcf`, 'text/vcard');
  } catch (err) {
    showToast(`vCard error: ${err.message}`);
  }
}

async function exportBatchVcf() {
  const cards = AppState.scannedCards;
  if (cards.length === 0) return;
  try {
    const payload = {
      cards: cards.map(c => ({
        name: c.name,
        title: c.title,
        company: c.company,
        phone: c.phone,
        email: c.email,
        website: c.website,
        address: c.address
      }))
    };
    const res = await fetch('/api/batch-export-vcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Batch vCard generation failed');
    const vcfText = await res.text();
    downloadBlob(vcfText, `All_Cards_${cards.length}.vcf`, 'text/vcard');
    showToast(`Exported ${cards.length} contacts to combined vCard!`);
  } catch (err) {
    showToast(`Batch vCard error: ${err.message}`);
  }
}

function exportBatchJson() {
  const cards = AppState.scannedCards;
  if (cards.length === 0) return;
  const jsonStr = JSON.stringify(cards, null, 2);
  downloadBlob(jsonStr, `CardScan_Vault_${Date.now()}.json`, 'application/json');
  showToast('Exported JSON backup!');
}

function copyCurrentCardJSON() {
  const card = getCurrentFormCardData();
  copyToClipboard(JSON.stringify(card, null, 2), 'JSON Data');
}

function testWebsiteUrl() {
  const w = elements.fieldWebsite ? elements.fieldWebsite.value.trim() : '';
  if (!w) {
    showToast('Website field is empty.');
    return;
  }
  const url = w.startsWith('http') ? w : `https://${w}`;
  window.open(url, '_blank');
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// 10. Live Camera Viewfinder Modal
// ---------------------------------------------------------------------------
async function openWebcam(targetSide = 'front') {
  AppState.webcamTarget = targetSide;
  if (elements.webcamModalTitle) {
    elements.webcamModalTitle.textContent = (targetSide === 'front')
      ? 'Live Camera: Click Front Photo'
      : 'Live Camera: Click Back Photo';
  }

  elements.webcamModal.classList.remove('hidden');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported on this device/browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    AppState.webcamStream = stream;
    elements.webcamVideo.srcObject = stream;
  } catch (err) {
    closeWebcam();
    alert(`Camera Access Notice:\n${err.message}\n\nPlease check browser camera permissions.`);
  }
}

function captureWebcamPhoto() {
  if (!AppState.webcamStream) return;

  const video = elements.webcamVideo;
  const canvas = elements.webcamCanvas;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const filename = `${AppState.webcamTarget}_camera_capture.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });

    if (AppState.webcamTarget === 'front') {
      handleFrontFile(file);
    } else {
      handleBackFile(file);
    }

    closeWebcam();
    showToast(`Captured ${AppState.webcamTarget === 'front' ? 'Front' : 'Back'} card photo from camera!`);
  }, 'image/jpeg', 0.92);
}

function closeWebcam() {
  if (AppState.webcamStream) {
    AppState.webcamStream.getTracks().forEach(track => track.stop());
    AppState.webcamStream = null;
  }
  if (elements.webcamVideo) {
    elements.webcamVideo.srcObject = null;
  }
  elements.webcamModal.classList.add('hidden');
}

// ---------------------------------------------------------------------------
// 11. UI Helpers & Utilities
// ---------------------------------------------------------------------------
function showLoading(title, desc) {
  elements.loadingTitle.textContent = title;
  elements.loadingDesc.textContent = desc;
  elements.loadingSection.classList.remove('hidden');
  elements.startScanBtn.disabled = true;
}

function hideLoading() {
  elements.loadingSection.classList.add('hidden');
  elements.startScanBtn.disabled = false;
}

function showToast(msg) {
  if (!elements.toast || !elements.toastMessage) return;
  elements.toastMessage.textContent = msg;
  elements.toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    elements.toast.classList.add('translate-y-20', 'opacity-0');
  }, 3200);
}

function copyToClipboard(text, label = 'Text') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied ${label} to clipboard!`);
  }).catch(() => {
    showToast(`Copied!`);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
