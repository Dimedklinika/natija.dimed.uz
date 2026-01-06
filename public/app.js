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

function showResults() {
    const session = getSession();
    if (!session) {
        showLogin();
        return;
    }

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('userName').textContent = session.name || session.phone || 'User';

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

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
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

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    showLogin();
});

// Search form handler
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phone = document.getElementById('patientPhone').value;
    const date = document.getElementById('date').value;
    
    const errorDiv = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsList = document.getElementById('resultsList');
    
    errorDiv.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    resultsList.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/getResults`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientPhone: phone, date: date || null })
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
});

function displayResults(results) {
    const container = document.getElementById('resultsContainer');
    const list = document.getElementById('resultsList');
    
    if (!results || results.length === 0) {
        list.innerHTML = '<p class="no-results">No results found.</p>';
        container.classList.remove('hidden');
        return;
    }
    
    list.innerHTML = results.map(result => `
        <div class="result-card">
            <div class="result-header">
                <h3>Result #${escapeHtml(result.Number || 'N/A')}</h3>
                <div class="result-date">${escapeHtml(result.date || 'N/A')}</div>
            </div>
            <div class="result-body">
                <div class="result-field">
                    <strong>Patient Phone:</strong> ${escapeHtml(result.PatientPhone || 'N/A')}
                </div>
                ${result.Patient ? `<div class="result-field"><strong>Patient:</strong> ${escapeHtml(String(result.Patient))}</div>` : ''}
                ${result.BiomaterialCollectTime ? `<div class="result-field"><strong>Biomaterial Collection Time:</strong> ${escapeHtml(String(result.BiomaterialCollectTime))}</div>` : ''}
                ${result.Biomaterial ? `<div class="result-field"><strong>Biomaterial:</strong> ${escapeHtml(String(result.Biomaterial))}</div>` : ''}
                ${result.AnalysisTime ? `<div class="result-field"><strong>Analysis Time:</strong> ${escapeHtml(String(result.AnalysisTime))}</div>` : ''}
                ${result.AccomplishedBy ? `<div class="result-field"><strong>Accomplished By:</strong> ${escapeHtml(String(result.AccomplishedBy))}</div>` : ''}
                ${result.Analysis ? `<div class="result-field"><strong>Analysis:</strong> ${escapeHtml(String(result.Analysis))}</div>` : ''}
                ${result.RawComputerResults ? `<div class="result-field"><strong>Raw Computer Results:</strong> <pre>${escapeHtml(JSON.stringify(result.RawComputerResults, null, 2))}</pre></div>` : ''}
                ${result.AnalysisResults ? `<div class="result-field"><strong>Analysis Results:</strong> <pre>${escapeHtml(JSON.stringify(result.AnalysisResults, null, 2))}</pre></div>` : ''}
            </div>
        </div>
    `).join('');
    
    container.classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize multi-language support
document.addEventListener('DOMContentLoaded', () => {
    initLanguage();
    initLanguageSelector();
});



