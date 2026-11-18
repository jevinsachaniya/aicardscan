/**
 * CardScan Pro - Modern Clean Minimal Client Engine
 * Full-featured on Desktop, Tablet, and Mobile Android/iOS PWA
 */

// Global Application State
const AppState = {
  activeMobileTab: 'scan', // 'scan' | 'contacts' | 'settings'
  scannedCards: [],
  selectedCardId: null,

  // Camera & Image State
  frontBlob: null,
  frontDataUrl: null,
  backBlob: null,
  backDataUrl: null,
  activePreviewSide: 'front', // 'front' | 'back'
  cardRotation: 0,

  // Live Webcam Stream
  webcamStream: null,
  facingMode: 'environment', // 'environment' | 'user'

  // AI Configuration
  customApiKey: localStorage.getItem('gemini_api_key') || '',
};

// Seed Starter Contacts
const DEFAULT_CONTACTS = [
  {
    id: 'card_101',
    name: 'Anand Amit Negi',
    title: 'Associate Director',
    company: 'NIPPON GLOBAL SL. SPAIN',
    mobile: '+34644184661',
    officePhone: '+34912345678',
    email: ['info@nipponglobal.es'],
    website: ['www.nipponglobal.es'],
    address: 'Calle Infanta Mercedes, 3, Valdemorillo, 28210 Madrid, Spain',
    notes: 'Head Office',
    photoDataUrl: '',
    scannedAt: 'Nov 18, 2026'
  },
  {
    id: 'card_102',
    name: 'Ankush Gupta',
    title: 'Exporter & Importer',
    company: 'Green Ocean',
    mobile: '+91 9825123456',
    officePhone: '',
    email: ['ankush@greenocean.in'],
    website: ['www.greenocean.in'],
    address: 'GIDC Industrial Estate, Surat, Gujarat 395006',
    notes: 'Textile and chemicals supplier',
    photoDataUrl: '',
    scannedAt: 'Nov 17, 2026'
  },
  {
    id: 'card_103',
    name: 'K.S.M Mohamed Saleem',
    title: 'MANAGING DIRECTOR',
    company: 'Bnazrum Agro Exports (P) Ltd.',
    mobile: '+91 9443123456',
    officePhone: '+91 4546251234',
    email: ['saleem@bnazrumagro.com'],
    website: ['www.bnazrumagro.com'],
    address: 'Theni Main Road, Theni, Tamil Nadu, India',
    notes: 'Agricultural exports division',
    photoDataUrl: '',
    scannedAt: 'Nov 16, 2026'
  },
  {
    id: 'card_104',
    name: 'Onkar Jadhav',
    title: 'Director',
    company: 'Foodora IMPEX',
    mobile: '+91 9820011223',
    officePhone: '',
    email: ['onkar@foodoraimpex.com'],
    website: ['www.foodoraimpex.com'],
    address: 'APMC Market Sector 19, Vashi, Navi Mumbai 400703',
    notes: 'Spices and food grains import',
    photoDataUrl: '',
    scannedAt: 'Nov 15, 2026'
  },
  {
    id: 'card_105',
    name: 'Sagar Deswal',
    title: 'Proprietor',
    company: 'Sunshine Vegetables',
    mobile: '+91 8077924395',
    officePhone: '',
    email: ['deswal@sunshinevegetables.com'],
    website: [],
    address: 'Shed 44, New Subzi Mandi, Azadpur, Delhi 110033',
    notes: 'Vegetable supply contract',
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026'
  },
  {
    id: 'card_106',
    name: 'Yagnesh Chadotra',
    title: 'Managing Partner',
    company: 'Shree Ram Daliya Industries',
    mobile: '+91 9879055443',
    officePhone: '',
    email: ['shreeramdaliya@gmail.com'],
    website: [],
    address: 'Plot 12, Hapa Industrial Area, Jamnagar, Gujarat',
    notes: 'Pulses processing plant',
    photoDataUrl: '',
    scannedAt: 'Nov 13, 2026'
  }
];

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedContacts();
  setupNavigationTabs();
  setupEventListeners();
  setupDragAndDrop();
  checkSystemHealth();
  renderVault();

  // Populate first contact in editor
  if (AppState.scannedCards.length > 0) {
    populateFormWithContact(AppState.scannedCards[0]);
  }

  // Handle Splash Screen Loader & Engaging Rotator
  const splash = document.getElementById('app-splash-screen');
  const splashText = document.getElementById('splash-status-text');
  if (splash) {
    const tips = [
      '⚡ Waking up Vision AI Engine...',
      '📷 Calibrating Neural OCR Lenses...',
      '🚀 Loading your Contacts Vault...',
      '✨ Ready to digitize cards!'
    ];
    let tipIdx = 0;
    const interval = setInterval(() => {
      tipIdx = (tipIdx + 1) % tips.length;
      if (splashText) splashText.textContent = tips[tipIdx];
    }, 350);

    setTimeout(() => {
      clearInterval(interval);
      splash.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => splash.remove(), 500);
    }, 1100);
  }
});

// ---------------------------------------------------------------------------
// 1. Data Storage & System Health
// ---------------------------------------------------------------------------
function loadSavedContacts() {
  try {
    const raw = localStorage.getItem('cardscan_batch_cards');
    if (raw) {
      AppState.scannedCards = JSON.parse(raw);
    } else {
      AppState.scannedCards = DEFAULT_CONTACTS;
      saveContactsToStorage();
    }
  } catch (e) {
    AppState.scannedCards = DEFAULT_CONTACTS;
  }
}

function saveContactsToStorage() {
  try {
    localStorage.setItem('cardscan_batch_cards', JSON.stringify(AppState.scannedCards));
  } catch (e) {}
}

async function checkSystemHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const statusText = AppState.customApiKey
      ? 'Personal Gemini Key Active'
      : (data.nlp_engine || 'Cloud AI (Gemini 2.5)');
    
    document.getElementById('header-ai-status').textContent = statusText;
    const mobLabel = document.getElementById('settings-mobile-ai-status');
    if (mobLabel) mobLabel.textContent = statusText;
  } catch (e) {
    document.getElementById('header-ai-status').textContent = 'Offline Engine (EasyOCR)';
  }
}

// ---------------------------------------------------------------------------
// 2. Navigation Tabs (Mobile & Responsive)
// ---------------------------------------------------------------------------
function setupNavigationTabs() {
  const tabScan = document.getElementById('tab-btn-scan');
  const tabContacts = document.getElementById('tab-btn-contacts');
  const tabSettings = document.getElementById('tab-btn-settings');

  tabScan?.addEventListener('click', () => switchMobileTab('scan'));
  tabContacts?.addEventListener('click', () => switchMobileTab('contacts'));
  tabSettings?.addEventListener('click', () => switchMobileTab('settings'));
}

function switchMobileTab(tabKey) {
  AppState.activeMobileTab = tabKey;

  const btnScan = document.getElementById('tab-btn-scan');
  const btnContacts = document.getElementById('tab-btn-contacts');
  const btnSettings = document.getElementById('tab-btn-settings');

  const secScan = document.getElementById('section-scan-workspace');
  const secContacts = document.getElementById('section-contacts-vault');
  const secSettings = document.getElementById('section-settings');

  // Reset tab button styles
  [btnScan, btnContacts, btnSettings].forEach(btn => {
    if (btn) btn.className = 'mobile-tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900';
  });

  // Hide all sections on mobile
  if (secScan) secScan.classList.remove('active');
  if (secContacts) secContacts.classList.remove('active');
  if (secSettings) secSettings.classList.remove('active');

  if (tabKey === 'scan') {
    if (btnScan) btnScan.className = 'mobile-tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold text-center transition flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700';
    if (secScan) secScan.classList.add('active');
    setTimeout(() => {
      secScan?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else if (tabKey === 'contacts') {
    if (btnContacts) btnContacts.className = 'mobile-tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold text-center transition flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700';
    if (secContacts) secContacts.classList.add('active');
    renderVault();
    setTimeout(() => {
      secContacts?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else if (tabKey === 'settings') {
    if (btnSettings) btnSettings.className = 'mobile-tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-bold text-center transition flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700';
    if (secSettings) secSettings.classList.add('active');
    setTimeout(() => {
      secSettings?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}

// ---------------------------------------------------------------------------
// 3. Card Preview, Upload, & Camera
// ---------------------------------------------------------------------------
function setupDragAndDrop() {
  const dropzone = document.getElementById('card-drop-viewport');
  if (!dropzone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  dropzone.addEventListener('dragover', () => dropzone.classList.add('border-blue-500', 'bg-blue-50/50'));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-blue-500', 'bg-blue-50/50'));
  dropzone.addEventListener('drop', (e) => {
    dropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageFile(files[0], AppState.activePreviewSide);
    }
  });

  dropzone.addEventListener('click', (e) => {
    // If clicked directly on the drop area (not on toolbar)
    if (e.target.id === 'card-drop-viewport' || e.target.closest('#preview-placeholder')) {
      document.getElementById('input-front-file')?.click();
    }
  });
}

function handleImageFile(file, side = 'front') {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    if (side === 'front') {
      AppState.frontBlob = file;
      AppState.frontDataUrl = e.target.result;
      AppState.activePreviewSide = 'front';
      displayCardPreview(e.target.result);
      showToast('Front photo attached! Click "Scan Card with Vision AI"');
    } else {
      AppState.backBlob = file;
      AppState.backDataUrl = e.target.result;
      AppState.activePreviewSide = 'back';
      displayCardPreview(e.target.result);
      showToast('Back photo attached!');
    }
    updateSideBadge();
  };
  reader.readAsDataURL(file);
}

function displayCardPreview(dataUrl) {
  const img = document.getElementById('card-preview-image');
  const placeholder = document.getElementById('preview-placeholder');

  if (img && placeholder) {
    img.src = dataUrl;
    img.classList.remove('hidden');
    img.style.transform = `rotate(${AppState.cardRotation}deg)`;
    placeholder.classList.add('hidden');
  }
}

function updateSideBadge() {
  const badge = document.getElementById('badge-side-status');
  const btnFront = document.getElementById('btn-show-front');
  const btnBack = document.getElementById('btn-show-back');

  if (AppState.activePreviewSide === 'front') {
    if (badge) badge.textContent = AppState.frontBlob ? 'Front Attached ✓' : 'Front Side';
    if (btnFront) btnFront.className = 'px-3 py-1.5 rounded-lg font-bold bg-blue-600 text-white transition';
    if (btnBack) btnBack.className = 'px-3 py-1.5 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition';
    if (AppState.frontDataUrl) displayCardPreview(AppState.frontDataUrl);
    else clearPreviewDisplay();
  } else {
    if (badge) badge.textContent = AppState.backBlob ? 'Back Attached ✓' : 'Back Side (Empty)';
    if (btnFront) btnFront.className = 'px-3 py-1.5 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition';
    if (btnBack) btnBack.className = 'px-3 py-1.5 rounded-lg font-bold bg-blue-600 text-white transition';
    if (AppState.backDataUrl) displayCardPreview(AppState.backDataUrl);
    else clearPreviewDisplay();
  }
}

function clearPreviewDisplay() {
  const img = document.getElementById('card-preview-image');
  const placeholder = document.getElementById('preview-placeholder');
  if (img) {
    img.src = '';
    img.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// 4. Live Webcam Modal Scanner
// ---------------------------------------------------------------------------
async function openWebcam() {
  const modal = document.getElementById('modal-webcam');
  const video = document.getElementById('webcam-video');
  if (!modal || !video) return;

  try {
    if (AppState.webcamStream) stopWebcam();

    const constraints = {
      video: {
        facingMode: { ideal: AppState.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    AppState.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = AppState.webcamStream;
    await video.play();
    modal.classList.remove('hidden');
    document.getElementById('perm-camera-label').textContent = 'Allowed / Active';
  } catch (err) {
    console.warn('Camera access unavailable:', err);
    document.getElementById('perm-camera-label').textContent = 'Blocked or Unavailable';
    showToast('Direct camera access blocked. Opening file upload gallery...');
    document.getElementById('input-front-file')?.click();
  }
}

function stopWebcam() {
  if (AppState.webcamStream) {
    AppState.webcamStream.getTracks().forEach(t => t.stop());
    AppState.webcamStream = null;
  }
  document.getElementById('modal-webcam')?.classList.add('hidden');
}

function captureWebcamPhoto() {
  const video = document.getElementById('webcam-video');
  const canvas = document.getElementById('webcam-canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (blob) {
      handleImageFile(blob, AppState.activePreviewSide);
      stopWebcam();
    }
  }, 'image/jpeg', 0.90);
}

// ---------------------------------------------------------------------------
// 5. Vision AI Extraction Execution
// ---------------------------------------------------------------------------
async function triggerExtraction() {
  if (!AppState.frontBlob && !AppState.backBlob) {
    showToast('Please capture or upload a business card photo first.');
    document.getElementById('input-front-file')?.click();
    return;
  }

  const btn = document.getElementById('btn-start-extract');
  const label = document.getElementById('btn-extract-label');
  const laser = document.getElementById('laser-beam');

  btn.disabled = true;
  label.textContent = 'Analyzing Card with AI Vision...';
  laser?.classList.remove('hidden');

  try {
    const formData = new FormData();
    const frontImg = AppState.frontBlob || AppState.backBlob;
    if (frontImg) {
      formData.append('file', frontImg, 'card_front.jpg');
      formData.append('front_file', frontImg, 'card_front.jpg');
    }
    if (AppState.backBlob) {
      formData.append('back_file', AppState.backBlob, 'card_back.jpg');
    }
    if (AppState.customApiKey) {
      formData.append('api_key', AppState.customApiKey);
      formData.append('custom_api_key', AppState.customApiKey);
    }

    const res = await fetch('/api/extract', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Extraction failed: ${errText}`);
    }

    const result = await res.json();
    const d = result.data || {};

    const extractedContact = {
      id: `card_${Date.now()}`,
      name: d.name || '',
      title: d.title || '',
      company: d.company || '',
      mobile: d.mobile || (d.phone && d.phone[0]) || '',
      officePhone: d.office_phone || (d.phone && d.phone[1]) || '',
      email: d.email || [],
      website: d.website || [],
      address: d.office_address || d.address || '',
      notes: d.notes || '',
      photoDataUrl: AppState.frontDataUrl || '',
      scannedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    // Save and populate
    AppState.scannedCards.unshift(extractedContact);
    saveContactsToStorage();
    populateFormWithContact(extractedContact);
    renderVault();

    showToast(`Digitized successfully: ${extractedContact.name || extractedContact.company || 'New Contact'}! 🎉`);
  } catch (err) {
    console.error('Extraction error:', err);
    alert('Extraction Error: ' + err.message);
  } finally {
    btn.disabled = false;
    label.textContent = 'Scan Card with Vision AI';
    laser?.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// 6. Contact Form & Profile Hero
// ---------------------------------------------------------------------------
function populateFormWithContact(c) {
  if (!c) return;
  AppState.selectedCardId = c.id;

  const initial = (c.name || c.company || 'C').trim().charAt(0).toUpperCase();
  document.getElementById('hero-avatar').textContent = initial;
  document.getElementById('hero-name').textContent = c.name || 'Unnamed Contact';
  document.getElementById('hero-title').textContent = c.title || 'Contact';
  document.getElementById('hero-company').textContent = c.company || 'Organization';

  // Form Fields
  document.getElementById('form-name').value = c.name || '';
  document.getElementById('form-title').value = c.title || '';
  document.getElementById('form-company').value = c.company || '';
  document.getElementById('form-mobile').value = c.mobile || (c.phone && c.phone[0]) || '';
  document.getElementById('form-office-phone').value = c.officePhone || '';
  document.getElementById('form-email').value = (c.email && c.email[0]) || '';
  document.getElementById('form-address').value = c.address || '';
  document.getElementById('form-website').value = (c.website && c.website[0]) || '';
  document.getElementById('form-notes').value = c.notes || '';

  // Setup Quick Actions
  setupQuickActions(c);
}

function setupQuickActions(c) {
  const phone = c.mobile || c.officePhone || '';
  const email = (c.email && c.email[0]) || '';
  const address = c.address || '';

  // Call
  document.getElementById('quick-action-call').onclick = () => {
    if (phone) window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
    else showToast('No phone number available.');
  };

  // WhatsApp
  document.getElementById('quick-action-whatsapp').onclick = () => {
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${clean}`, '_blank');
    } else {
      showToast('No phone number for WhatsApp.');
    }
  };

  // Email
  document.getElementById('quick-action-email').onclick = () => {
    if (email) window.location.href = `mailto:${email}`;
    else showToast('No email address available.');
  };

  // Map
  document.getElementById('quick-action-map').onclick = () => {
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    } else {
      showToast('No address available.');
    }
  };

  // Save .vcf
  document.getElementById('quick-action-vcard').onclick = () => {
    downloadContactVcf(c);
  };

  // QR Code
  document.getElementById('quick-action-qr').onclick = () => {
    showContactQr(c);
  };
}

function saveCurrentFormToVault() {
  const name = document.getElementById('form-name').value.trim();
  const title = document.getElementById('form-title').value.trim();
  const company = document.getElementById('form-company').value.trim();
  const mobile = document.getElementById('form-mobile').value.trim();
  const officePhone = document.getElementById('form-office-phone').value.trim();
  const email = document.getElementById('form-email').value.trim();
  const address = document.getElementById('form-address').value.trim();
  const website = document.getElementById('form-website').value.trim();
  const notes = document.getElementById('form-notes').value.trim();

  if (!name && !company && !mobile && !email) {
    showToast('Please enter at least a Name, Company, or Phone number.');
    return;
  }

  const existing = AppState.scannedCards.find(c => c.id === AppState.selectedCardId);
  if (existing) {
    existing.name = name;
    existing.title = title;
    existing.company = company;
    existing.mobile = mobile;
    existing.officePhone = officePhone;
    existing.email = email ? [email] : [];
    existing.address = address;
    existing.website = website ? [website] : [];
    existing.notes = notes;
    populateFormWithContact(existing);
    showToast('Contact updated in vault!');
  } else {
    const newId = `card_${Date.now()}`;
    const newContact = {
      id: newId,
      name,
      title,
      company,
      mobile,
      officePhone,
      email: email ? [email] : [],
      address,
      website: website ? [website] : [],
      notes,
      photoDataUrl: AppState.frontDataUrl || '',
      scannedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    AppState.scannedCards.unshift(newContact);
    AppState.selectedCardId = newId;
    populateFormWithContact(newContact);
    showToast('Contact saved to vault!');
  }

  saveContactsToStorage();
  renderVault();
}

// ---------------------------------------------------------------------------
// 7. Contacts Vault Rendering (Desktop Table & Mobile Cards)
// ---------------------------------------------------------------------------
function renderVault() {
  const cards = AppState.scannedCards;
  const count = cards.length;

  document.getElementById('badge-total-contacts').textContent = `${count} Contact${count === 1 ? '' : 's'}`;
  const mobBadge = document.getElementById('mobile-tab-badge');
  if (mobBadge) mobBadge.textContent = count;

  const searchInput = document.getElementById('input-search-vault');
  const query = (searchInput?.value || '').toLowerCase().trim();

  let filtered = [...cards];
  if (query) {
    filtered = filtered.filter(c => {
      const name = (c.name || '').toLowerCase();
      const comp = (c.company || '').toLowerCase();
      const title = (c.title || '').toLowerCase();
      const phone = (c.mobile || c.officePhone || '').toLowerCase();
      const email = ((c.email || []).join(' ')).toLowerCase();
      return name.includes(query) || comp.includes(query) || title.includes(query) || phone.includes(query) || email.includes(query);
    });
  }

  const tbody = document.getElementById('desktop-vault-tbody');
  const mobileContainer = document.getElementById('mobile-vault-cards');
  const emptyView = document.getElementById('vault-empty-view');

  if (filtered.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }
  emptyView?.classList.add('hidden');

  // 1. Render Desktop Table Rows
  if (tbody) {
    tbody.innerHTML = '';
    filtered.forEach((card, index) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition cursor-pointer';
      tr.onclick = () => {
        populateFormWithContact(card);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      const initial = (card.name || card.company || 'C').trim().charAt(0).toUpperCase();
      const phone = card.mobile || card.officePhone || '-';
      const email = (card.email && card.email[0]) || '-';

      tr.innerHTML = `
        <td class="p-3 text-center text-slate-400 font-mono font-medium">${index + 1}</td>
        <td class="p-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              ${initial}
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 truncate">${escapeHtml(card.name || 'Untitled')}</p>
            </div>
          </div>
        </td>
        <td class="p-3">
          <p class="font-semibold text-slate-800 truncate">${escapeHtml(card.company || '-')}</p>
          <p class="text-[11px] text-slate-400 truncate">${escapeHtml(card.title || '-')}</p>
        </td>
        <td class="p-3 font-mono text-[11px] font-semibold text-slate-700">${escapeHtml(phone)}</td>
        <td class="p-3 text-slate-600">${escapeHtml(email)}</td>
        <td class="p-3 text-slate-500 text-[11px] max-w-[200px] truncate" title="${escapeHtml(card.address || '')}">${escapeHtml(card.address || '-')}</td>
        <td class="p-3 text-center" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="downloadContactVcfById('${card.id}')" class="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition" title="Save .vcf">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </button>
            <button onclick="deleteContactById('${card.id}')" class="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 2. Render Mobile Cards
  if (mobileContainer) {
    mobileContainer.innerHTML = '';
    filtered.forEach(card => {
      const initial = (card.name || card.company || 'C').trim().charAt(0).toUpperCase();
      const phone = card.mobile || card.officePhone || '';
      const email = (card.email && card.email[0]) || '';

      const cardEl = document.createElement('div');
      cardEl.className = 'p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3';
      cardEl.onclick = () => {
        populateFormWithContact(card);
        switchMobileTab('scan');
        setTimeout(() => {
          document.getElementById('form-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      };

      cardEl.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
              ${initial}
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-slate-900 truncate">${escapeHtml(card.name || 'Unnamed')}</h3>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(card.company || card.title || 'Contact')}</p>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-blue-600">Edit ›</span>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs" onclick="event.stopPropagation()">
          <span class="font-mono text-slate-700 font-semibold">${escapeHtml(phone || email || 'No direct phone')}</span>
          <div class="flex items-center gap-2">
            ${phone ? `<a href="tel:${phone}" class="p-2 rounded-xl bg-emerald-50 text-emerald-700">📞</a>` : ''}
            ${phone ? `<a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="p-2 rounded-xl bg-green-50 text-green-700">💬</a>` : ''}
            <button onclick="downloadContactVcfById('${card.id}')" class="p-2 rounded-xl bg-blue-50 text-blue-700">💾</button>
          </div>
        </div>
      `;
      mobileContainer.appendChild(cardEl);
    });
  }
}

function deleteContactById(id) {
  const card = AppState.scannedCards.find(c => c.id === id);
  if (!card) return;

  if (confirm(`Delete "${card.name || card.company}" from vault?`)) {
    AppState.scannedCards = AppState.scannedCards.filter(c => c.id !== id);
    saveContactsToStorage();
    renderVault();
    showToast('Contact removed from vault.');
  }
}

function clearAllVault() {
  if (confirm('Are you sure you want to clear all contacts in the vault?')) {
    AppState.scannedCards = [];
    saveContactsToStorage();
    renderVault();
    showToast('All contacts cleared.');
  }
}

// ---------------------------------------------------------------------------
// 8. Excel & Export Functions
// ---------------------------------------------------------------------------
function exportToExcel() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    showToast('Vault is empty. No contacts to export.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('SheetJS Excel library is loading, please try again in 2 seconds.');
    return;
  }

  const rows = cards.map((c, i) => ({
    '#': i + 1,
    'Full Name': c.name || '',
    'Designation / Title': c.title || '',
    'Company': c.company || '',
    'Mobile Phone': c.mobile || (c.phone && c.phone[0]) || '',
    'Office Phone': c.officePhone || (c.phone && c.phone[1]) || '',
    'Email Address': (c.email || []).join('; '),
    'Office Address': c.address || '',
    'Website': (c.website || []).join('; '),
    'Notes / Remarks': c.notes || '',
    'Date Added': c.scannedAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column auto-sizing
  worksheet['!cols'] = [
    { wch: 4 },
    { wch: 22 },
    { wch: 22 },
    { wch: 26 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 38 },
    { wch: 24 },
    { wch: 20 },
    { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

  const filename = `CardScan_Contacts_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
  showToast(`Excel downloaded! (${cards.length} contacts)`);
}

function exportToCsv() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    showToast('No contacts to export.');
    return;
  }

  const headers = ['Name', 'Title', 'Company', 'Mobile', 'Office Phone', 'Email', 'Address', 'Website', 'Notes'];
  const csvRows = cards.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${(c.company || '').replace(/"/g, '""')}"`,
    `"${(c.mobile || '').replace(/"/g, '""')}"`,
    `"${(c.officePhone || '').replace(/"/g, '""')}"`,
    `"${((c.email || []).join('; ')).replace(/"/g, '""')}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    `"${((c.website || []).join('; ')).replace(/"/g, '""')}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CardScan_Contacts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV file downloaded!');
}

function downloadContactVcf(c) {
  const name = c.name || c.company || 'Contact';
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    c.company ? `ORG:${c.company}` : '',
    c.title ? `TITLE:${c.title}` : '',
    c.mobile ? `TEL;TYPE=CELL:${c.mobile}` : '',
    c.officePhone ? `TEL;TYPE=WORK:${c.officePhone}` : '',
    (c.email && c.email[0]) ? `EMAIL;TYPE=INTERNET:${c.email[0]}` : '',
    (c.website && c.website[0]) ? `URL:${c.website[0]}` : '',
    c.address ? `ADR;TYPE=WORK:;;${c.address.replace(/[\n\r]+/g, ', ')};;;;` : '',
    c.notes ? `NOTE:${c.notes}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Saved to Contacts (.vcf downloaded)!');
}

function downloadContactVcfById(id) {
  const c = AppState.scannedCards.find(card => card.id === id);
  if (c) downloadContactVcf(c);
}

function exportBatchVcf() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    showToast('No contacts to export.');
    return;
  }

  const vcfBlocks = cards.map(c => {
    const name = c.name || c.company || 'Contact';
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      c.company ? `ORG:${c.company}` : '',
      c.title ? `TITLE:${c.title}` : '',
      c.mobile ? `TEL;TYPE=CELL:${c.mobile}` : '',
      c.officePhone ? `TEL;TYPE=WORK:${c.officePhone}` : '',
      (c.email && c.email[0]) ? `EMAIL;TYPE=INTERNET:${c.email[0]}` : '',
      (c.website && c.website[0]) ? `URL:${c.website[0]}` : '',
      c.address ? `ADR;TYPE=WORK:;;${c.address.replace(/[\n\r]+/g, ', ')};;;;` : '',
      c.notes ? `NOTE:${c.notes}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
  }).join('\r\n\r\n');

  const blob = new Blob([vcfBlocks], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CardScan_All_Contacts.vcf`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('All contacts exported to Address Book (.vcf)!');
}

function showContactQr(c) {
  const qrBox = document.getElementById('qr-box');
  const modal = document.getElementById('modal-qr');
  if (!qrBox || !modal) return;

  qrBox.innerHTML = '';
  const name = c.name || c.company || 'Contact';
  const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${c.company || ''}\nTEL:${c.mobile || ''}\nEMAIL:${(c.email && c.email[0]) || ''}\nEND:VCARD`;

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrBox, {
      text: vcf,
      width: 160,
      height: 160,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }
  modal.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// 9. AI Engine Key Modal Setup
// ---------------------------------------------------------------------------
function openApiKeyModal() {
  const modal = document.getElementById('modal-api-engine');
  const input = document.getElementById('input-modal-api-key');
  const banner = document.getElementById('modal-engine-banner');
  const text = document.getElementById('modal-engine-banner-text');

  if (input) input.value = AppState.customApiKey;
  if (banner && text) {
    if (AppState.customApiKey) {
      banner.className = 'p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2.5';
      text.innerHTML = '<strong>Priority Active:</strong> Using your Personal Gemini API Key.';
    } else {
      banner.className = 'p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5';
      text.innerHTML = '<strong>Priority Active:</strong> Built-in Default Cloud AI (Gemini 2.5 Flash). No key required!';
    }
  }

  modal?.classList.remove('hidden');
}

function closeApiKeyModal() {
  document.getElementById('modal-api-engine')?.classList.add('hidden');
}

function savePersonalKey() {
  const input = document.getElementById('input-modal-api-key');
  const val = input ? input.value.trim() : '';
  if (val) {
    AppState.customApiKey = val;
    localStorage.setItem('gemini_api_key', val);
    showToast('Personal Gemini API Key saved!');
  } else {
    resetDefaultKey();
  }
  closeApiKeyModal();
  checkSystemHealth();
}

function resetDefaultKey() {
  AppState.customApiKey = '';
  localStorage.removeItem('gemini_api_key');
  const input = document.getElementById('input-modal-api-key');
  if (input) input.value = '';
  showToast('Reset to built-in Default Cloud AI.');
  closeApiKeyModal();
  checkSystemHealth();
}

function testCameraPermission() {
  openWebcam();
}

// ---------------------------------------------------------------------------
// 10. General Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Front & Back side switcher
  document.getElementById('btn-show-front')?.addEventListener('click', () => {
    AppState.activePreviewSide = 'front';
    updateSideBadge();
  });
  document.getElementById('btn-show-back')?.addEventListener('click', () => {
    AppState.activePreviewSide = 'back';
    updateSideBadge();
  });

  // Rotation
  document.getElementById('btn-rotate-card')?.addEventListener('click', () => {
    AppState.cardRotation = (AppState.cardRotation + 90) % 360;
    const img = document.getElementById('card-preview-image');
    if (img) img.style.transform = `rotate(${AppState.cardRotation}deg)`;
  });

  // Clear Photos
  document.getElementById('btn-clear-preview')?.addEventListener('click', () => {
    AppState.frontBlob = null;
    AppState.frontDataUrl = null;
    AppState.backBlob = null;
    AppState.backDataUrl = null;
    AppState.cardRotation = 0;
    updateSideBadge();
    showToast('Photos cleared.');
  });

  // File Inputs
  document.getElementById('btn-browse-gallery')?.addEventListener('click', () => {
    document.getElementById('input-front-file')?.click();
  });

  document.getElementById('input-front-file')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0], AppState.activePreviewSide);
    }
  });

  // Live Camera
  document.getElementById('btn-open-camera-modal')?.addEventListener('click', openWebcam);
  document.getElementById('btn-close-webcam')?.addEventListener('click', stopWebcam);
  document.getElementById('btn-cancel-webcam')?.addEventListener('click', stopWebcam);
  document.getElementById('btn-snap-shutter')?.addEventListener('click', captureWebcamPhoto);
  document.getElementById('btn-flip-lens')?.addEventListener('click', () => {
    AppState.facingMode = AppState.facingMode === 'environment' ? 'user' : 'environment';
    openWebcam();
  });

  // Extraction trigger
  document.getElementById('btn-start-extract')?.addEventListener('click', triggerExtraction);

  // Form actions
  document.getElementById('btn-save-to-vault')?.addEventListener('click', saveCurrentFormToVault);
  document.getElementById('btn-new-card')?.addEventListener('click', () => {
    AppState.selectedCardId = null;
    document.getElementById('form-name').value = '';
    document.getElementById('form-title').value = '';
    document.getElementById('form-company').value = '';
    document.getElementById('form-mobile').value = '';
    document.getElementById('form-office-phone').value = '';
    document.getElementById('form-email').value = '';
    document.getElementById('form-address').value = '';
    document.getElementById('form-website').value = '';
    document.getElementById('form-notes').value = '';

    document.getElementById('hero-avatar').textContent = '+';
    document.getElementById('hero-name').textContent = 'New Business Card';
    document.getElementById('hero-title').textContent = 'Fill details or scan photo';
    document.getElementById('hero-company').textContent = 'Company';
    showToast('Ready for new contact entry.');
  });

  // Vault Actions
  document.getElementById('input-search-vault')?.addEventListener('input', renderVault);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-quick-export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-export-csv')?.addEventListener('click', exportToCsv);
  document.getElementById('btn-export-all-vcf')?.addEventListener('click', exportBatchVcf);
  document.getElementById('btn-clear-vault')?.addEventListener('click', clearAllVault);

  // AI Modal
  document.getElementById('btn-open-api-modal')?.addEventListener('click', openApiKeyModal);
  document.getElementById('btn-close-api-modal')?.addEventListener('click', closeApiKeyModal);
  document.getElementById('btn-modal-save-key')?.addEventListener('click', savePersonalKey);
  document.getElementById('btn-modal-reset-key')?.addEventListener('click', resetDefaultKey);

  // QR Modal
  document.getElementById('btn-close-qr')?.addEventListener('click', () => {
    document.getElementById('modal-qr')?.classList.add('hidden');
  });
}

// ---------------------------------------------------------------------------
// 11. Utilities
// ---------------------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  if (!toast || !txt) return;

  txt.textContent = msg;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
  }, 2600);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
