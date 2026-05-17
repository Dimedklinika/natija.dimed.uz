const API_BASE = '/.netlify/functions';

// Multi-language support
let translations = {};
let currentLanguage = 'uz'; // Default to Uzbek

// Load translations for a language
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load translations for ${lang}`);
        }
        translations = await response.json();
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        updateLanguage();
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to Uzbek if current language fails
        if (lang !== 'uz') {
            await loadTranslations('uz');
        }
    }
}

// Get translation for a key
function t(key) {
    return translations[key] || key;
}

// Update all elements with data-i18n attributes
function updateLanguage() {
    // Update HTML content (allows translations with HTML, e.g., links)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
        const key = element.getAttribute('data-i18n-html');
        element.innerHTML = t(key);
    });

    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });

    // Update document language
    document.documentElement.lang = currentLanguage;

    // Update language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = currentLanguage;
    }
}

// Initialize language
function initLanguage() {
    // Check saved language preference
    const savedLang = localStorage.getItem('language');

    // Detect browser language
    const browserLang = navigator.language.split('-')[0]; // Get primary language code

    // Priority: saved preference > browser language > default (uz)
    const langToLoad = savedLang || (['uz', 'ru', 'en'].includes(browserLang) ? browserLang : 'uz');

    loadTranslations(langToLoad);
}

// Language selector handler
function initLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            loadTranslations(e.target.value);
        });
    }
}

// Session management
function getSession() {
    const sessionStr = localStorage.getItem('session');
    return sessionStr ? JSON.parse(sessionStr) : null;
}

function setSession(user) {
    localStorage.setItem('session', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('session');
}

function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('resultsSection').classList.add('hidden');
}

async function loadUserResults() {
    const session = getSession();
    if (!session || !session.phone) {
        console.error('No session or phone number available');
        return;
    }

    const resultsList = document.getElementById('resultsList');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorDiv = document.getElementById('errorMessage');

    try {
        errorDiv.classList.add('hidden');

        const response = await fetch(`${API_BASE}/getResults`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.phone}` // Use session phone as auth token
            },
            body: JSON.stringify({ Phone: session.phone, date: null })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch results');
        }

        const results = await response.json();
        displayResults(results);

    } catch (error) {
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.remove('hidden');
        resultsList.innerHTML = '';
    }
}

function showResults() {
    const session = getSession();
    if (!session) {
        showLogin();
        return;
    }

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('userName').textContent = session.name || 'User';

    if (session.phone) {
      document.getElementById('userName').textContent += ` (${session.phone})`;
    }

    // Load user's results automatically
    loadUserResults();
}

// Initialize - check if user is logged in
const session = getSession();
if (session) {
    showResults();
} else {
    showLogin();
}

function displayResults(results) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');

    if (!results || results.length === 0) {
        list.innerHTML = '<p data-i18n="no-results" class="no-results">Natijalar topilmadi.</p>';
        container.classList.remove('hidden');
        return;
    }

    // Store results globally for access in click handlers
    window.currentResults = results;

    const itemsHtml = results.map((result, idx) => {
        const documentUID = result.DocumentUID || `result-${idx}`;
        const label = escapeHtml(result.PatientName || `Natija ${idx + 1}`);
        const dateText = escapeHtml(result.Date || result.RegisteredDate || result.CompletedDate || 'Sanasiz');
        const resultUrl = `/result/${encodeURIComponent(documentUID)}`;
        return `
            <li class="result-item">
                <a class="result-link-item" href="${resultUrl}">${label} (${dateText})</a>
            </li>
        `;
    }).join('');

    list.innerHTML = `<ul class="result-link-list">${itemsHtml}</ul>`;
    container.classList.remove('hidden');
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize multi-language support
// Check if DOM is already loaded and initialize immediately if so
function initializeApp() {
    console.log('Initializing app...');
    initLanguage();
    initLanguageSelector();
    
    // Add event listeners after DOM is loaded
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = document.getElementById('verificationCode').value.trim();
            const errorDiv = document.getElementById('loginError');
            
            errorDiv.classList.add('hidden');
            
            if (!code || code.length !== 6) {
                errorDiv.textContent = t('invalidCode');
                errorDiv.classList.remove('hidden');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/verifyLogin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Verification failed');
                }
                
                if (data.success && data.user) {
                    setSession(data.user);
                    showResults();
                    document.getElementById('verificationCode').value = '';
                } else {
                    throw new Error('Invalid response from server');
                }
                
            } catch (error) {
                errorDiv.textContent = `Error: ${error.message}`;
                errorDiv.classList.remove('hidden');
            }
        });
    }

    // Logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            showLogin();
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded (this script is at the end of body)
    initializeApp();
}



