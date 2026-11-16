// ===== SUPPORT FORM FEATURE =====
// Support form dengan auto-detection tarikh dan hantar ke WhatsApp

// Support WhatsApp number akan di-fetch dari config, fallback ke default jika tidak ada
let SUPPORT_WHATSAPP_NUMBER = '60137426830'; // Default fallback

const SUPPORT_ISSUE_TYPES = [
  { id: 'bug-report', label: 'Laporan Bug / Masalah Teknikal' },
  { id: 'slow-order', label: 'Pesanan Lambat' },
  { id: 'scammer-report', label: 'Laporan Scammer' },
  { id: 'order-issue', label: 'Masalah Pesanan' },
  { id: 'payment-issue', label: 'Masalah Pembayaran' },
  { id: 'general', label: 'Pertanyaan Umum' }
];

function formatDate() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kuala_Lumpur'
  };
  return now.toLocaleDateString('ms-MY', options);
}

function openSupportForm() {
  const modal = document.getElementById('support-form-modal');
  if (!modal) return;
  
  // Reset form sebelum buka
  document.getElementById('support-form')?.reset();
  document.getElementById('support-name').focus();
  
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeSupportForm() {
  const modal = document.getElementById('support-form-modal');
  if (!modal) return;
  
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function submitSupportForm(event) {
  event.preventDefault();
  
  const form = document.getElementById('support-form');
  if (!form) return;
  
  // Ambil data dari form
  const name = document.getElementById('support-name')?.value?.trim() || '';
  const phone = document.getElementById('support-phone')?.value?.trim() || '';
  const issueType = document.getElementById('support-issue-type')?.value || '';
  const description = document.getElementById('support-description')?.value?.trim() || '';
  
  // Validasi
  if (!name || !phone || !issueType || !description) {
    toast('Sila isi semua ruangan yang diperlukan.', true);
    return;
  }
  
  if (phone.length < 10) {
    toast('Nomor WhatsApp tidak sah. Sila gunakan format yang betul.', true);
    return;
  }
  
  // Format nomor WhatsApp (buang simbol kecuali angka)
  const phoneClean = phone.replace(/\D/g, '');
  const whatsappPhone = phoneClean.startsWith('6') ? phoneClean : '6' + phoneClean.replace(/^0/, '');
  
  // Cari label untuk issue type
  const issueLabel = SUPPORT_ISSUE_TYPES.find(t => t.id === issueType)?.label || issueType;
  
  // Ambil date/time
  const submittedDateTime = formatDate();
  
  // Build message
  const message = `*H4SX STORE - SUPPORT REQUEST*\n\n` +
    `*Tarikh & Waktu Hantar:* ${submittedDateTime}\n` +
    `*Nama:* ${name}\n` +
    `*No. WhatsApp:* ${phone}\n` +
    `*Jenis Isu:* ${issueLabel}\n` +
    `*Pernyataan Masalah:*\n${description}`;
  
  // Encode message untuk URL
  const encodedMessage = encodeURIComponent(message);
  const waLink = `https://wa.me/${whatsappPhone}?text=${encodedMessage}`;
  
  // Show confirmation
  showSupportConfirmation(message, waLink, event);
}

function showSupportConfirmation(message, waLink, event) {
  const form = document.getElementById('support-form');
  const confirmDialog = document.getElementById('support-confirm-dialog');
  const confirmText = document.getElementById('support-confirm-text');
  const confirmSend = document.getElementById('support-confirm-send');
  const confirmCancel = document.getElementById('support-confirm-cancel');
  
  if (!confirmDialog || !confirmText || !confirmSend || !confirmCancel) return;
  
  // Display message
  confirmText.innerHTML = `
    <div class="support-confirm-preview">
      <strong>Pratonton mesej anda:</strong>
      <pre>${escapeHtml(message)}</pre>
    </div>
  `;
  
  // Clear previous handlers
  confirmSend.onclick = null;
  confirmCancel.onclick = null;
  
  // Set handlers
  confirmSend.onclick = () => {
    closeSupportConfirmation();
    closeSupportForm();
    window.open(waLink, '_blank');
    toast('Mesej sedang dibuka di WhatsApp. Pastikan pindahkan nomor yang betul jika diperlukan.');
    form.reset();
  };
  
  confirmCancel.onclick = () => {
    closeSupportConfirmation();
  };
  
  confirmDialog.classList.add('show');
  confirmDialog.setAttribute('aria-hidden', 'false');
}

function closeSupportConfirmation() {
  const confirmDialog = document.getElementById('support-confirm-dialog');
  if (confirmDialog) {
    confirmDialog.classList.remove('show');
    confirmDialog.setAttribute('aria-hidden', 'true');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize issue type dropdown
function initSupportForm() {
  const issueSelect = document.getElementById('support-issue-type');
  if (!issueSelect) return;
  
  // Clear existing options
  issueSelect.innerHTML = '<option value="">-- Pilih Jenis Isu --</option>';
  
  // Add options
  SUPPORT_ISSUE_TYPES.forEach(issue => {
    const option = document.createElement('option');
    option.value = issue.id;
    option.textContent = issue.label;
    issueSelect.appendChild(option);
  });
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // Try to get WhatsApp number from store config
    if (typeof currentStoreConfig !== 'undefined' && currentStoreConfig) {
      const configNum = currentStoreConfig.whatsapp_link 
        || currentStoreConfig.whatsappLink 
        || currentStoreConfig.whatsapp_number 
        || currentStoreConfig.whatsappNumber;
      
      if (configNum) {
        // Extract only numbers from the config
        const cleanNum = String(configNum).replace(/\D/g, '');
        if (cleanNum.length >= 10) {
          SUPPORT_WHATSAPP_NUMBER = cleanNum.replace(/^0/, '6');
        }
      }
    }
    initSupportForm();
  }, 100);
});
