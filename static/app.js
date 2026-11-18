/**
 * CardScan Pro - Native Mobile App Engine
 * High-Speed Spatial Vision & Pure On-Device / Cloud AI Architecture
 */

// Global State
const AppState = {
  activeView: 'home',
  scannedCards: [],
  selectedCardId: null,
  activeFilter: 'all', // 'all' | 'favorites' | 'recent'
  
  // Camera State
  cameraStream: null,
  facingMode: 'environment', // 'environment' | 'user'
  scanSide: 'front', // 'front' | 'back'
  scanMode: 'single', // 'single' | 'dual'
  capturedFrontBlob: null,
  capturedFrontDataUrl: null,
  capturedBackBlob: null,
  capturedBackDataUrl: null,

  // Theme & AI Engine
  theme: 'dark',
  customApiKey: localStorage.getItem('gemini_api_key') || '',
};

// Seed Starter Contacts (matching user reference screenshot)
const INITIAL_STARTER_CONTACTS = [
  {
    id: 'card_101',
    name: 'Anand Amit Negi',
    title: 'Associate Director',
    company: 'NIPPON GLOBAL SL. SPAIN',
    mobile: '+34644184661',
    officePhone: '+34912345678',
    phone: ['+34644184661', '+34912345678'],
    email: ['info@nipponglobal.es'],
    website: ['www.nipponglobal.es'],
    address: 'Calle Infanta Mercedes, 3, Valdemorillo, 28210 Madrid, Spain',
    notes: 'Head Office',
    favorite: true,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 4:50 PM',
    engine: 'Gemini 2.5 Flash Vision'
  },
  {
    id: 'card_102',
    name: 'Ankush Gupta',
    title: 'Exporter & Importer',
    company: 'Green Ocean',
    mobile: '+91 9825123456',
    officePhone: '',
    phone: ['+91 9825123456'],
    email: ['ankush@greenocean.in'],
    website: ['www.greenocean.in'],
    address: 'GIDC Industrial Estate, Surat, Gujarat 395006',
    notes: 'Textile and chemicals supplier',
    favorite: false,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 3:30 PM',
    engine: 'Gemini 2.5 Flash Vision'
  },
  {
    id: 'card_103',
    name: 'K.S.M Mohamed Saleem',
    title: 'MANAGING DIRECTOR',
    company: 'Bnazrum Agro Exports (P) Ltd.',
    mobile: '+91 9443123456',
    officePhone: '+91 4546251234',
    phone: ['+91 9443123456', '+91 4546251234'],
    email: ['saleem@bnazrumagro.com'],
    website: ['www.bnazrumagro.com'],
    address: 'Theni Main Road, Theni, Tamil Nadu, India',
    notes: 'Agricultural exports division',
    favorite: false,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 2:15 PM',
    engine: 'Gemini 2.5 Flash Vision'
  },
  {
    id: 'card_104',
    name: 'Onkar Jadhav',
    title: 'Director',
    company: 'Foodora IMPEX',
    mobile: '+91 9820011223',
    officePhone: '',
    phone: ['+91 9820011223'],
    email: ['onkar@foodoraimpex.com'],
    website: ['www.foodoraimpex.com'],
    address: 'APMC Market Sector 19, Vashi, Navi Mumbai 400703',
    notes: 'Spices and food grains import',
    favorite: false,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 1:40 PM',
    engine: 'Gemini 2.5 Flash Vision'
  },
  {
    id: 'card_105',
    name: 'Sagar Deswal',
    title: '',
    company: 'Sunshine Vegetables',
    mobile: '+91 8077924395',
    officePhone: '',
    phone: ['+91 8077924395'],
    email: ['deswal@sunshinevegetables.com'],
    website: [],
    address: 'Shed 44, New Subzi Mandi, Azadpur, Delhi 110033',
    notes: 'Vegetable supply contract',
    favorite: false,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 12:10 PM',
    engine: 'Gemini 2.5 Flash Vision'
  },
  {
    id: 'card_106',
    name: 'Yagnesh Chadotra',
    title: 'Managing Partner',
    company: 'Shree Ram Daliya Industries',
    mobile: '+91 9879055443',
    officePhone: '',
    phone: ['+91 9879055443'],
    email: ['shreeramdaliya@gmail.com'],
    website: [],
    address: 'Plot 12, Hapa Industrial Area, Jamnagar, Gujarat',
    notes: 'Pulses processing plant',
    favorite: false,
    photoDataUrl: '',
    scannedAt: 'Nov 14, 2026, 11:00 AM',
    engine: 'Gemini 2.5 Flash Vision'
  }
];

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedCards();
  initTheme();
  setupNavigation();
  setupEventListeners();
  checkBackendHealth();
  renderHomeView();
  renderContactsView();

  // Support direct view navigation via URL parameter e.g. ?view=contacts, ?view=detail, ?view=settings
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');
  if (requestedView) {
    if (requestedView === 'detail') {
      const cardId = urlParams.get('id') || (AppState.scannedCards[0] && AppState.scannedCards[0].id);
      if (cardId) openCardDetail(cardId);
      else switchView('home');
    } else {
      switchView(requestedView);
    }
  }
});

// ---------------------------------------------------------------------------
// 1. Data Storage & Management
// ---------------------------------------------------------------------------
function loadSavedCards() {
  try {
    const raw = localStorage.getItem('cardscan_batch_cards');
    if (raw) {
      AppState.scannedCards = JSON.parse(raw);
    } else {
      AppState.scannedCards = INITIAL_STARTER_CONTACTS;
      saveCardsToStorage();
    }
  } catch (e) {
    AppState.scannedCards = INITIAL_STARTER_CONTACTS;
  }
}

function saveCardsToStorage() {
  try {
    localStorage.setItem('cardscan_batch_cards', JSON.stringify(AppState.scannedCards));
  } catch (e) {
    console.error('Storage quota exceeded or error saving:', e);
  }
}

function checkBackendHealth() {
  fetch('/api/health')
    .then(r => r.json())
    .then(data => {
      const label = document.getElementById('home-engine-label');
      if (label) {
        if (AppState.customApiKey) {
          label.textContent = 'Personal Gemini AI Key Active';
        } else {
          label.textContent = data.nlp_engine || 'Cloud AI (Gemini 2.5 Flash)';
        }
      }
    })
    .catch(() => {
      const label = document.getElementById('home-engine-label');
      if (label) label.textContent = 'Offline Engine (EasyOCR PyTorch)';
    });
}

// ---------------------------------------------------------------------------
// 2. Navigation & Views Switching
// ---------------------------------------------------------------------------
function switchView(viewName) {
  AppState.activeView = viewName;

  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => {
    v.classList.remove('active');
  });

  // Activate target view
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
  }

  // Handle bottom navigation bar visibility
  const navBar = document.getElementById('bottom-nav-bar');
  if (navBar) {
    if (viewName === 'home' || viewName === 'contacts') {
      navBar.classList.remove('hidden');
    } else {
      navBar.classList.add('hidden');
    }
  }

  // Update tab highlights
  const btnHome = document.getElementById('nav-btn-home');
  const btnContacts = document.getElementById('nav-btn-contacts');
  if (btnHome && btnContacts) {
    if (viewName === 'home') {
      btnHome.className = 'flex flex-col items-center gap-1 text-yellow-400 transition';
      btnContacts.className = 'flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition';
    } else if (viewName === 'contacts') {
      btnHome.className = 'flex flex-col items-center gap-1 text-zinc-400 hover:text-white transition';
      btnContacts.className = 'flex flex-col items-center gap-1 text-yellow-400 transition';
    }
  }

  // Special hooks for views
  if (viewName === 'camera') {
    startCamera();
  } else {
    stopCamera();
  }

  if (viewName === 'home') renderHomeView();
  if (viewName === 'contacts') renderContactsView();
}

function setupNavigation() {
  document.getElementById('nav-btn-home')?.addEventListener('click', () => switchView('home'));
  document.getElementById('nav-btn-contacts')?.addEventListener('click', () => switchView('contacts'));
  document.getElementById('nav-btn-camera')?.addEventListener('click', () => switchView('camera'));

  // Home view buttons
  document.getElementById('btn-home-scan')?.addEventListener('click', () => switchView('camera'));
  document.getElementById('btn-home-settings')?.addEventListener('click', () => switchView('settings'));
  document.getElementById('btn-home-see-all')?.addEventListener('click', () => switchView('contacts'));
  document.getElementById('btn-home-change-ai')?.addEventListener('click', () => switchView('settings'));

  // Contacts view buttons
  document.getElementById('btn-contacts-add')?.addEventListener('click', () => openNewContactForm());
  document.getElementById('btn-contacts-export-excel')?.addEventListener('click', () => exportToExcel());

  // Detail view buttons
  document.getElementById('btn-detail-back')?.addEventListener('click', () => {
    switchView('contacts');
  });

  // Settings view buttons
  document.getElementById('btn-settings-back')?.addEventListener('click', () => switchView('home'));

  // Camera close
  document.getElementById('btn-camera-close')?.addEventListener('click', () => switchView('home'));
}

// ---------------------------------------------------------------------------
// 3. Home View Renderer
// ---------------------------------------------------------------------------
function renderHomeView() {
  const cards = AppState.scannedCards;
  const totalCards = cards.length;
  const favCards = cards.filter(c => c.favorite).length;

  document.getElementById('home-total-cards').textContent = totalCards;
  document.getElementById('home-fav-cards').textContent = favCards;

  const listContainer = document.getElementById('home-recent-list');
  const emptyView = document.getElementById('home-empty-view');

  if (totalCards === 0) {
    listContainer.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }

  emptyView?.classList.add('hidden');
  listContainer.innerHTML = '';

  // Show top 6 recent scans
  const recent = cards.slice(0, 6);
  recent.forEach(card => {
    const initial = (card.name || card.company || 'C').trim().charAt(0).toUpperCase();
    const item = document.createElement('div');
    item.className = 'bg-[#1e1e22] hover:bg-[#25252a] border border-[#2e2e36] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-sm';
    item.onclick = () => openCardDetail(card.id);

    item.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-12 h-12 rounded-full bg-yellow-400 text-black font-extrabold text-lg flex items-center justify-center shrink-0 shadow-sm">
          ${initial}
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-bold text-white truncate">${escapeHtml(card.name || 'Unnamed Contact')}</h3>
          <p class="text-xs text-zinc-400 truncate mt-0.5">${escapeHtml(card.company || card.title || 'Business Contact')}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-zinc-500 shrink-0">
        ${card.favorite ? '<span class="text-yellow-400 text-xs">★</span>' : ''}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// 4. Contacts View Renderer & Search Filter
// ---------------------------------------------------------------------------
function renderContactsView() {
  const cards = AppState.scannedCards;
  const countLabel = document.getElementById('contacts-count-label');
  if (countLabel) countLabel.textContent = `${cards.length} contact${cards.length === 1 ? '' : 's'}`;

  const searchInput = document.getElementById('contacts-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();

  let filtered = [...cards];

  // Apply Filter Chips
  if (AppState.activeFilter === 'favorites') {
    filtered = filtered.filter(c => c.favorite);
  }

  // Apply Search Query
  if (query) {
    filtered = filtered.filter(c => {
      const name = (c.name || '').toLowerCase();
      const comp = (c.company || '').toLowerCase();
      const title = (c.title || '').toLowerCase();
      const phones = (c.phone || []).join(' ');
      const emails = (c.email || []).join(' ').toLowerCase();
      return name.includes(query) || comp.includes(query) || title.includes(query) || phones.includes(query) || emails.includes(query);
    });
  }

  const container = document.getElementById('contacts-list-container');
  const emptyView = document.getElementById('contacts-empty-view');

  if (!container) return;
  container.innerHTML = '';

  if (filtered.length === 0) {
    emptyView?.classList.remove('hidden');
    return;
  }
  emptyView?.classList.add('hidden');

  // Sort Alphabetically
  filtered.sort((a, b) => (a.name || a.company || '').localeCompare(b.name || b.company || ''));

  // Group by First Letter
  let currentLetter = '';
  filtered.forEach(card => {
    const letter = (card.name || card.company || '#').trim().charAt(0).toUpperCase();

    if (letter !== currentLetter && /[A-Z]/.test(letter)) {
      currentLetter = letter;
      const letterHeader = document.createElement('div');
      letterHeader.className = 'text-xs font-black text-yellow-400 px-2 pt-2 tracking-wider';
      letterHeader.textContent = currentLetter;
      container.appendChild(letterHeader);
    }

    const initial = (card.name || card.company || 'C').trim().charAt(0).toUpperCase();
    const row = document.createElement('div');
    row.className = 'bg-[#1e1e22] hover:bg-[#25252a] border border-[#2e2e36] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition shadow-sm';
    row.onclick = () => openCardDetail(card.id);

    const sub = [card.company, card.title].filter(Boolean).join(' • ');

    row.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-11 h-11 rounded-full bg-yellow-400 text-black font-extrabold text-base flex items-center justify-center shrink-0">
          ${initial}
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-bold text-white truncate">${escapeHtml(card.name || 'Unnamed')}</h3>
          <p class="text-xs text-zinc-400 truncate mt-0.5">${escapeHtml(sub || 'Contact')}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="event.stopPropagation(); toggleFavorite('${card.id}')" class="p-1.5 rounded-full hover:bg-zinc-800 transition">
          <svg class="w-4 h-4 ${card.favorite ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function toggleFavorite(id) {
  const card = AppState.scannedCards.find(c => c.id === id);
  if (!card) return;
  card.favorite = !card.favorite;
  saveCardsToStorage();
  renderHomeView();
  renderContactsView();

  // Support direct view navigation via URL parameter e.g. ?view=contacts, ?view=detail, ?view=settings
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');
  if (requestedView) {
    if (requestedView === 'detail') {
      const cardId = urlParams.get('id') || (AppState.scannedCards[0] && AppState.scannedCards[0].id);
      if (cardId) openCardDetail(cardId);
      else switchView('home');
    } else {
      switchView(requestedView);
    }
  }
  if (AppState.selectedCardId === id) updateDetailFavIcon(card.favorite);
  showToast(card.favorite ? 'Marked as Favorite ⭐' : 'Removed from Favorites');
}

// ---------------------------------------------------------------------------
// 5. Card Detail / Result View
// ---------------------------------------------------------------------------
function openCardDetail(id) {
  const card = AppState.scannedCards.find(c => c.id === id);
  if (!card) return;

  AppState.selectedCardId = id;

  // Set Profile Hero
  const initial = (card.name || card.company || 'C').trim().charAt(0).toUpperCase();
  document.getElementById('detail-avatar').textContent = initial;
  document.getElementById('detail-name').textContent = card.name || 'Unnamed Contact';
  document.getElementById('detail-title').textContent = card.title || 'Business Professional';

  // Company Pill
  const pillText = document.getElementById('detail-company-text');
  const pillBox = document.getElementById('detail-company-pill');
  if (card.company) {
    pillText.textContent = card.company;
    pillBox.parentElement.classList.remove('hidden');
  } else {
    pillBox.parentElement.classList.add('hidden');
  }

  // Favorite Icon
  updateDetailFavIcon(card.favorite);

  // Field Values
  const primaryPhone = card.mobile || (card.phone && card.phone[0]) || '';
  const primaryEmail = (card.email && card.email[0]) || '';
  const primaryAddr = card.address || card.officeAddress || '';

  document.getElementById('detail-val-email').textContent = primaryEmail || 'Not available';
  document.getElementById('detail-val-phone').textContent = primaryPhone || 'Not available';
  document.getElementById('detail-val-address').textContent = primaryAddr || 'Not available';
  document.getElementById('detail-val-notes').textContent = card.notes || 'None';
  document.getElementById('detail-val-date').textContent = card.scannedAt || new Date().toLocaleString();
  document.getElementById('detail-val-engine').textContent = card.engine || 'Gemini 2.5 Flash Vision';

  // Photo
  const photoBox = document.getElementById('detail-card-photo-box');
  const photoImg = document.getElementById('detail-val-photo');
  if (card.photoDataUrl) {
    photoImg.src = card.photoDataUrl;
    photoBox.classList.remove('hidden');
  } else {
    photoBox.classList.add('hidden');
  }

  // Quick Action Buttons
  setupDetailActions(card, primaryPhone, primaryEmail, primaryAddr);

  switchView('detail');
}

function updateDetailFavIcon(isFav) {
  const favIcon = document.getElementById('detail-fav-icon');
  if (favIcon) {
    if (isFav) {
      favIcon.setAttribute('fill', '#000000');
    } else {
      favIcon.setAttribute('fill', 'none');
    }
  }
}

function setupDetailActions(card, phone, email, address) {
  // Call
  document.getElementById('action-call').onclick = () => {
    if (phone) window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
    else showToast('No phone number available.');
  };

  // WhatsApp
  document.getElementById('action-whatsapp').onclick = () => {
    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${clean}`, '_blank');
    } else {
      showToast('No phone number for WhatsApp.');
    }
  };

  // SMS
  document.getElementById('action-sms').onclick = () => {
    if (phone) window.location.href = `sms:${phone.replace(/\s+/g, '')}`;
    else showToast('No phone number for SMS.');
  };

  // Email
  document.getElementById('action-email').onclick = () => {
    if (email) window.location.href = `mailto:${email}`;
    else showToast('No email address available.');
  };

  // Map
  document.getElementById('action-map').onclick = () => {
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    } else {
      showToast('No address available.');
    }
  };

  // Save to Contacts (vCard)
  document.getElementById('action-save-vcard').onclick = () => {
    downloadContactVcf(card);
  };

  // Top Action Icons
  document.getElementById('btn-detail-fav').onclick = () => {
    toggleFavorite(card.id);
  };

  document.getElementById('btn-detail-edit').onclick = () => {
    openEditContactForm(card);
  };

  document.getElementById('btn-detail-qr').onclick = () => {
    showContactQr(card);
  };

  document.getElementById('btn-detail-share').onclick = () => {
    shareContact(card);
  };

  document.getElementById('btn-detail-delete').onclick = () => {
    if (confirm(`Delete "${card.name || card.company}" from saved cards?`)) {
      AppState.scannedCards = AppState.scannedCards.filter(c => c.id !== card.id);
      saveCardsToStorage();
      showToast('Contact deleted.');
      switchView('contacts');
    }
  };
}

// ---------------------------------------------------------------------------
// 6. Camera & Card Scanning Engine
// ---------------------------------------------------------------------------
async function startCamera() {
  const video = document.getElementById('camera-video');
  if (!video) return;

  try {
    if (AppState.cameraStream) {
      stopCamera();
    }

    const constraints = {
      video: {
        facingMode: { ideal: AppState.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    AppState.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = AppState.cameraStream;
    await video.play();
    document.getElementById('perm-camera-status').textContent = 'Granted / Active';
  } catch (err) {
    console.warn('Camera access error or unsupported:', err);
    document.getElementById('perm-camera-status').textContent = 'Blocked or Unavailable';
    showToast('Camera access blocked. Tap the Gallery icon to upload a photo.');
  }
}

function stopCamera() {
  if (AppState.cameraStream) {
    AppState.cameraStream.getTracks().forEach(track => track.stop());
    AppState.cameraStream = null;
  }
}

async function captureFromCamera() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    // Fallback: trigger file input if video feed isn't active
    document.getElementById('camera-file-input')?.click();
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (AppState.scanMode === 'dual' && AppState.scanSide === 'front') {
      AppState.capturedFrontBlob = blob;
      AppState.capturedFrontDataUrl = dataUrl;
      AppState.scanSide = 'back';
      document.getElementById('btn-camera-side-badge').textContent = 'BACK';
      showToast('Front captured! Now frame and snap the Back side.');
      return;
    }

    if (AppState.scanMode === 'dual' && AppState.scanSide === 'back') {
      AppState.capturedBackBlob = blob;
      AppState.capturedBackDataUrl = dataUrl;
      processExtractedCard(AppState.capturedFrontBlob, AppState.capturedBackBlob, AppState.capturedFrontDataUrl);
      return;
    }

    // Standard Single Side Scan
    processExtractedCard(blob, null, dataUrl);
  }, 'image/jpeg', 0.88);
}

async function processExtractedCard(frontBlob, backBlob, photoDataUrl) {
  const overlay = document.getElementById('camera-loading-overlay');
  overlay?.classList.remove('hidden');

  try {
    const formData = new FormData();
    formData.append('front_file', frontBlob, 'card_front.jpg');

    if (backBlob) {
      formData.append('back_file', backBlob, 'card_back.jpg');
    }

    if (AppState.customApiKey) {
      formData.append('custom_api_key', AppState.customApiKey);
    }

    const res = await fetch('/api/extract', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Extraction failed (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const data = json.data || {};

    const newCard = {
      id: `card_${Date.now()}`,
      name: data.name || '',
      title: data.title || '',
      company: data.company || '',
      mobile: data.mobile || (data.phone && data.phone[0]) || '',
      officePhone: data.office_phone || (data.phone && data.phone[1]) || '',
      phone: data.phone || [],
      email: data.email || [],
      website: data.website || [],
      address: data.office_address || data.address || '',
      officeAddress: data.office_address || '',
      factoryAddress: data.factory_address || '',
      notes: data.notes || '',
      favorite: false,
      photoDataUrl: photoDataUrl || '',
      scannedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      engine: json.nlp_model || (AppState.customApiKey ? 'Personal Gemini API' : 'Gemini 2.5 Flash Cloud AI')
    };

    AppState.scannedCards.unshift(newCard);
    saveCardsToStorage();

    // Reset Camera State
    AppState.scanSide = 'front';
    AppState.capturedFrontBlob = null;
    AppState.capturedBackBlob = null;
    document.getElementById('btn-camera-side-badge').textContent = 'FRONT';

    overlay?.classList.add('hidden');
    stopCamera();

    showToast('Card digitized successfully! 🎉');
    openCardDetail(newCard.id);
  } catch (err) {
    console.error('Extraction error:', err);
    overlay?.classList.add('hidden');
    alert('Extraction Error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// 7. Edit & Add Contact Forms
// ---------------------------------------------------------------------------
function openNewContactForm() {
  AppState.selectedCardId = null;
  document.getElementById('edit-header-title').textContent = 'New Contact';

  document.getElementById('edit-input-name').value = '';
  document.getElementById('edit-input-title').value = '';
  document.getElementById('edit-input-company').value = '';
  document.getElementById('edit-input-mobile').value = '';
  document.getElementById('edit-input-office-phone').value = '';
  document.getElementById('edit-input-email').value = '';
  document.getElementById('edit-input-website').value = '';
  document.getElementById('edit-input-address').value = '';
  document.getElementById('edit-input-notes').value = '';

  switchView('edit');
}

function openEditContactForm(card) {
  AppState.selectedCardId = card.id;
  document.getElementById('edit-header-title').textContent = 'Edit Contact';

  document.getElementById('edit-input-name').value = card.name || '';
  document.getElementById('edit-input-title').value = card.title || '';
  document.getElementById('edit-input-company').value = card.company || '';
  document.getElementById('edit-input-mobile').value = card.mobile || (card.phone && card.phone[0]) || '';
  document.getElementById('edit-input-office-phone').value = card.officePhone || '';
  document.getElementById('edit-input-email').value = (card.email && card.email[0]) || '';
  document.getElementById('edit-input-website').value = (card.website && card.website[0]) || '';
  document.getElementById('edit-input-address').value = card.address || card.officeAddress || '';
  document.getElementById('edit-input-notes').value = card.notes || '';

  switchView('edit');
}

function saveContactForm() {
  const name = document.getElementById('edit-input-name').value.trim();
  const title = document.getElementById('edit-input-title').value.trim();
  const company = document.getElementById('edit-input-company').value.trim();
  const mobile = document.getElementById('edit-input-mobile').value.trim();
  const officePhone = document.getElementById('edit-input-office-phone').value.trim();
  const email = document.getElementById('edit-input-email').value.trim();
  const website = document.getElementById('edit-input-website').value.trim();
  const address = document.getElementById('edit-input-address').value.trim();
  const notes = document.getElementById('edit-input-notes').value.trim();

  if (!name && !company && !mobile && !email) {
    alert('Please enter at least a Name, Company, or Phone number.');
    return;
  }

  const phones = [];
  if (mobile) phones.push(mobile);
  if (officePhone && !phones.includes(officePhone)) phones.push(officePhone);

  const emails = email ? [email] : [];
  const websites = website ? [website] : [];

  if (AppState.selectedCardId) {
    // Update existing
    const card = AppState.scannedCards.find(c => c.id === AppState.selectedCardId);
    if (card) {
      card.name = name;
      card.title = title;
      card.company = company;
      card.mobile = mobile;
      card.officePhone = officePhone;
      card.phone = phones;
      card.email = emails;
      card.website = websites;
      card.address = address;
      card.officeAddress = address;
      card.notes = notes;
    }
  } else {
    // Create new
    const newId = `card_${Date.now()}`;
    const newCard = {
      id: newId,
      name,
      title,
      company,
      mobile,
      officePhone,
      phone: phones,
      email: emails,
      website: websites,
      address,
      officeAddress: address,
      notes,
      favorite: false,
      photoDataUrl: '',
      scannedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      engine: 'Manual Entry'
    };
    AppState.scannedCards.unshift(newCard);
    AppState.selectedCardId = newId;
  }

  saveCardsToStorage();
  showToast('Contact saved!');
  openCardDetail(AppState.selectedCardId);
}

// ---------------------------------------------------------------------------
// 8. Exporting (Excel, CSV, vCard)
// ---------------------------------------------------------------------------
function exportToExcel() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    alert('No contacts to export.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('SheetJS Excel engine loading... please wait a moment.');
    return;
  }

  // Format dataset for clean professional Excel workbook
  const data = cards.map((c, i) => ({
    '#': i + 1,
    'Full Name': c.name || '',
    'Designation / Title': c.title || '',
    'Company': c.company || '',
    'Mobile Phone': c.mobile || (c.phone && c.phone[0]) || '',
    'Office Phone': c.officePhone || (c.phone && c.phone[1]) || '',
    'Email Address': (c.email || []).join('; '),
    'Website': (c.website || []).join('; '),
    'Office Address': c.address || c.officeAddress || '',
    'Notes': c.notes || '',
    'Date Scanned': c.scannedAt || '',
    'AI Engine': c.engine || 'CardScan Pro'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Column width auto-sizing
  worksheet['!cols'] = [
    { wch: 4 },  // #
    { wch: 22 }, // Full Name
    { wch: 22 }, // Designation
    { wch: 26 }, // Company
    { wch: 18 }, // Mobile Phone
    { wch: 18 }, // Office Phone
    { wch: 28 }, // Email
    { wch: 24 }, // Website
    { wch: 38 }, // Address
    { wch: 20 }, // Notes
    { wch: 22 }, // Date
    { wch: 20 }  // Engine
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Scanned Contacts');

  const filename = `CardScan_Contacts_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
  showToast(`Excel spreadsheet exported! (${cards.length} contacts)`);
}

function exportToCsv() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    alert('No contacts to export.');
    return;
  }

  const headers = ['Name', 'Title', 'Company', 'Mobile', 'Office Phone', 'Email', 'Website', 'Address', 'Notes'];
  const rows = cards.map(c => [
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${(c.company || '').replace(/"/g, '""')}"`,
    `"${(c.mobile || (c.phone && c.phone[0]) || '').replace(/"/g, '""')}"`,
    `"${(c.officePhone || '').replace(/"/g, '""')}"`,
    `"${((c.email || []).join('; ')).replace(/"/g, '""')}"`,
    `"${((c.website || []).join('; ')).replace(/"/g, '""')}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CardScan_Contacts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV export downloaded!');
}

function downloadContactVcf(card) {
  const name = card.name || card.company || 'Contact';
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    card.company ? `ORG:${card.company}` : '',
    card.title ? `TITLE:${card.title}` : '',
    card.mobile ? `TEL;TYPE=CELL:${card.mobile}` : '',
    card.officePhone ? `TEL;TYPE=WORK:${card.officePhone}` : '',
    (card.email && card.email[0]) ? `EMAIL;TYPE=INTERNET:${card.email[0]}` : '',
    (card.website && card.website[0]) ? `URL:${card.website[0]}` : '',
    card.address ? `ADR;TYPE=WORK:;;${card.address.replace(/[\n\r]+/g, ', ')};;;;` : '',
    card.notes ? `NOTE:${card.notes}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Added to Contacts (.vcf downloaded)!');
}

function exportBatchVcf() {
  const cards = AppState.scannedCards;
  if (!cards || cards.length === 0) {
    alert('No contacts to export.');
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

// ---------------------------------------------------------------------------
// 9. QR Code & Sharing
// ---------------------------------------------------------------------------
function showContactQr(card) {
  const qrBox = document.getElementById('qr-code-box');
  const modal = document.getElementById('modal-qr');
  if (!qrBox || !modal) return;

  qrBox.innerHTML = '';

  const name = card.name || card.company || 'Contact';
  const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${card.company || ''}\nTEL:${card.mobile || ''}\nEMAIL:${(card.email && card.email[0]) || ''}\nEND:VCARD`;

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrBox, {
      text: vcf,
      width: 170,
      height: 170,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrBox.innerHTML = `<p class="text-xs text-black">Scan Contact: ${name}</p>`;
  }

  modal.classList.remove('hidden');
}

function shareContact(card) {
  const text = `${card.name || 'Contact'} - ${card.company || ''}\nPhone: ${card.mobile || (card.phone && card.phone[0]) || ''}\nEmail: ${(card.email && card.email[0]) || ''}\nAddress: ${card.address || ''}`;

  if (navigator.share) {
    navigator.share({
      title: card.name || card.company || 'Business Card Contact',
      text: text
    }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text);
    showToast('Contact details copied to clipboard!');
  }
}

// ---------------------------------------------------------------------------
// 10. Event Listeners & Modals Setup
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Shutter button
  document.getElementById('btn-camera-shutter')?.addEventListener('click', captureFromCamera);

  // Gallery button in camera view
  document.getElementById('btn-camera-gallery')?.addEventListener('click', () => {
    document.getElementById('gallery-file-input')?.click();
  });

  // Camera file pickers
  document.getElementById('gallery-file-input')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        processExtractedCard(file, null, ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('camera-file-input')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        processExtractedCard(file, null, ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Flip Camera
  document.getElementById('btn-camera-flip')?.addEventListener('click', () => {
    AppState.facingMode = AppState.facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  // Mode switcher (single vs dual)
  document.getElementById('mode-single-side')?.addEventListener('click', (e) => {
    AppState.scanMode = 'single';
    e.target.className = 'px-4 py-1 rounded-full font-bold bg-yellow-400 text-black transition';
    document.getElementById('mode-dual-side').className = 'px-4 py-1 rounded-full font-semibold text-zinc-400 hover:text-white transition';
  });

  document.getElementById('mode-dual-side')?.addEventListener('click', (e) => {
    AppState.scanMode = 'dual';
    e.target.className = 'px-4 py-1 rounded-full font-bold bg-yellow-400 text-black transition';
    document.getElementById('mode-single-side').className = 'px-4 py-1 rounded-full font-semibold text-zinc-400 hover:text-white transition';
  });

  // Search input & Clear
  const searchInput = document.getElementById('contacts-search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  searchInput?.addEventListener('input', (e) => {
    if (clearBtn) {
      if (e.target.value) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    renderContactsView();
  });
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderContactsView();
  });

  // Filter Chips
  document.getElementById('filter-chip-all')?.addEventListener('click', () => {
    AppState.activeFilter = 'all';
    highlightFilterChip('filter-chip-all');
    renderContactsView();
  });
  document.getElementById('filter-chip-favs')?.addEventListener('click', () => {
    AppState.activeFilter = 'favorites';
    highlightFilterChip('filter-chip-favs');
    renderContactsView();
  });

  // Edit Page Save / Cancel
  document.getElementById('btn-edit-save')?.addEventListener('click', saveContactForm);
  document.getElementById('btn-edit-cancel')?.addEventListener('click', () => {
    if (AppState.selectedCardId) switchView('detail');
    else switchView('contacts');
  });

  // QR Modal Close
  document.getElementById('btn-close-qr')?.addEventListener('click', () => {
    document.getElementById('modal-qr')?.classList.add('hidden');
  });

  // Settings Actions
  document.getElementById('btn-settings-export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-settings-export-csv')?.addEventListener('click', exportToCsv);
  document.getElementById('btn-settings-export-vcf')?.addEventListener('click', exportBatchVcf);
  document.getElementById('btn-settings-clear-all')?.addEventListener('click', () => {
    if (confirm('Clear all contacts? This action cannot be undone.')) {
      AppState.scannedCards = [];
      saveCardsToStorage();
      renderHomeView();
      renderContactsView();
      showToast('All contacts cleared.');
    }
  });

  // Test Camera
  document.getElementById('btn-test-camera')?.addEventListener('click', () => {
    switchView('camera');
  });

  // Theme Toggle
  document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);

  // AI API Key Modal
  document.getElementById('btn-settings-ai-key')?.addEventListener('click', openApiKeyModal);
  document.getElementById('btn-close-api-key-modal')?.addEventListener('click', closeApiKeyModal);
  document.getElementById('btn-save-custom-api-key')?.addEventListener('click', saveApiKey);
  document.getElementById('btn-reset-default-api-key')?.addEventListener('click', resetApiKey);
}

function highlightFilterChip(activeId) {
  ['filter-chip-all', 'filter-chip-favs', 'filter-chip-companies', 'filter-chip-recent'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === activeId) {
      el.className = 'filter-chip active shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-400 text-black';
    } else {
      el.className = 'filter-chip shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-[#1e1e22] text-zinc-400 hover:text-white border border-[#2e2e36]';
    }
  });
}

// ---------------------------------------------------------------------------
// 11. Theme & Settings Helpers
// ---------------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem('cardscan_theme') || 'dark';
  AppState.theme = saved;
  applyTheme(saved);
}

function toggleTheme() {
  const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
  AppState.theme = newTheme;
  localStorage.setItem('cardscan_theme', newTheme);
  applyTheme(newTheme);
  showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} theme`);
}

function applyTheme(theme) {
  const label = document.getElementById('current-theme-label');
  if (label) label.textContent = theme === 'dark' ? 'Dark Mode (Default)' : 'Light Mode';
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

function openApiKeyModal() {
  const modal = document.getElementById('modal-api-key');
  const input = document.getElementById('input-custom-api-key');
  if (input) input.value = AppState.customApiKey;
  modal?.classList.remove('hidden');
}

function closeApiKeyModal() {
  document.getElementById('modal-api-key')?.classList.add('hidden');
}

function saveApiKey() {
  const input = document.getElementById('input-custom-api-key');
  const val = input ? input.value.trim() : '';
  if (val) {
    AppState.customApiKey = val;
    localStorage.setItem('gemini_api_key', val);
    showToast('Personal Gemini Key saved!');
  } else {
    resetApiKey();
  }
  closeApiKeyModal();
  checkBackendHealth();
}

function resetApiKey() {
  AppState.customApiKey = '';
  localStorage.removeItem('gemini_api_key');
  const input = document.getElementById('input-custom-api-key');
  if (input) input.value = '';
  showToast('Reset to built-in Default Cloud AI.');
  closeApiKeyModal();
  checkBackendHealth();
}

// ---------------------------------------------------------------------------
// 12. UI Toast & Utilities
// ---------------------------------------------------------------------------
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-message');
  if (!toast || !text) return;

  text.textContent = msg;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-3');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-3');
  }, 2800);
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
