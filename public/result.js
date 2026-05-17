const API_BASE = '/.netlify/functions';

async function loadResult() {
    const container = document.getElementById('resultContainer');
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const documentUID = pathParts[1];

    if (!documentUID) {
        container.innerHTML = '<div class="error">Invalid result URL</div>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/getResult/${encodeURIComponent(documentUID)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch result');
        }

        const result = await response.json();
        displayResult(result);
    } catch (error) {
        container.innerHTML = `<div class="error">Error: ${escapeHtml(error.message)}</div>`;
    }
}

function displayResult(result) {
    const container = document.getElementById('resultContainer');

    if (!result) {
        container.innerHTML = '<div class="error">No result data available</div>';
        return;
    }

    const analysisResults = result?.AnalysisResults;
    let html = '<div class="result-detail-card">';

    for (const [key, value] of Object.entries(result)) {
        if (key === 'AnalysisResults') {
            continue;
        }

        if (value !== null && value !== undefined && value !== '') {
            const displayKey = key.replace(/([A-Z])/g, ' $1').trim();
            const displayValue = typeof value === 'object' ? escapeHtml(JSON.stringify(value, null, 2)) : escapeHtml(String(value));
            html += `
                <div class="result-detail-row">
                    <span class="detail-key">${escapeHtml(displayKey)}:</span>
                    <span class="detail-value">${displayValue}</span>
                </div>
            `;
        }
    }

    html += '</div>';

    if (Array.isArray(analysisResults)) {
        html += renderAnalysisResultsTable(analysisResults);
    } else if (result.AnalysisResult) {
        html += `<div class="result-detail-card"><pre>${escapeHtml(JSON.stringify(result.AnalysisResult, null, 2))}</pre></div>`;
    }

    container.innerHTML = html;
}

function renderAnalysisResultsTable(items) {
    if (!items.length) {
        return '<div class="result-detail-card"><p>No analysis results available.</p></div>';
    }

    let rows = items.map(item => {
        const analyte = escapeHtml(String(item.Analyte ?? ''));
        const code = escapeHtml(String(item.AnalyteInternationalCode ?? ''));
        const unit = escapeHtml(String(item.AnalyteUnit ?? ''));
        const result = escapeHtml(String(item.Result ?? ''));

        return `
            <tr>
                <td>${analyte}</td>
                <td>${code}</td>
                <td>${unit}</td>
                <td>${result}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="result-detail-card analysis-table-card">
            <h2>Analysis Results</h2>
            <div class="analysis-results-table-wrapper">
                <table class="analysis-results-table">
                    <thead>
                        <tr>
                            <th>Analyte</th>
                            <th>AnalyteInternationalCode</th>
                            <th>AnalyteUnit</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', loadResult);
