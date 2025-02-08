// API endpoint configuration
const API_URL = 'http://localhost:3000/api/factcheck';

// DOM Elements
const initialView = document.querySelector('.initial-view');
const analysisView = document.querySelector('.analysis-view');
const analyzeButton = document.getElementById('analyze');
const loadingSection = document.getElementById('loading');
const errorSection = document.getElementById('error');
const resultsSection = document.getElementById('results');
const errorMessage = document.getElementById('error-message');
const reliabilityScore = document.getElementById('reliability-score');
const reliabilityExplanation = document.getElementById('reliability-explanation');
const factualStatus = document.getElementById('factual-status');
const analysis = document.getElementById('analysis');
const falseClaimsSection = document.getElementById('false-claims-section');
const falseClaims = document.getElementById('false-claims');
const sourcesSection = document.getElementById('sources-section');
const sources = document.getElementById('sources');

// Helper function to show/hide sections
function showSection(section) {
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  section.classList.remove('hidden');
}

// Helper function to switch views
function showAnalysisView() {
  initialView.classList.add('hidden');
  analysisView.classList.remove('hidden');
  document.body.classList.add('expanded');
}

// Helper function to create a false claim element
function createFalseClaimElement(claim) {
  const div = document.createElement('div');
  div.className = 'false-claim-item';
  div.innerHTML = `
    <div class="claim">Claim: ${claim.claim}</div>
    <div class="correction">Correction: ${claim.correction}</div>
  `;
  return div;
}

// Helper function to create a source element
function createSourceElement(source) {
  const div = document.createElement('div');
  div.className = 'source-item';
  div.innerHTML = `
    <a href="${source.url}" target="_blank" class="source-title">
      ${source.title}
    </a>
    <p class="source-relevance">${source.relevance}</p>
  `;
  return div;
}

// Function to update score circle color based on score
function updateScoreColor(score) {
  const scoreCircle = document.querySelector('.score-circle');
  scoreCircle.classList.remove('score-low', 'score-medium', 'score-high');
  
  if (score >= 8) {
    scoreCircle.classList.add('score-high');
  } else if (score >= 5) {
    scoreCircle.classList.add('score-medium');
  } else {
    scoreCircle.classList.add('score-low');
  }
}

// Function to update the UI with results
function displayResults(data) {
  reliabilityScore.textContent = data.reliability_score;
  updateScoreColor(data.reliability_score);
  reliabilityExplanation.textContent = data.reliability_explanation;
  
  // Update factual status
  factualStatus.className = data.is_factual
    ? 'status-box factual'
    : 'status-box non-factual';
  factualStatus.innerHTML = `
    <p class="${data.is_factual ? 'text-green-700' : 'text-red-700'} font-medium">
      ${data.is_factual ? 'Content is factual' : 'Content contains false claims'}
    </p>
  `;
  
  analysis.textContent = data.analysis;

  // Handle false claims
  if (data.false_claims && data.false_claims.length > 0) {
    falseClaims.innerHTML = '';
    data.false_claims.forEach(claim => {
      falseClaims.appendChild(createFalseClaimElement(claim));
    });
    falseClaimsSection.classList.remove('hidden');
  } else {
    falseClaimsSection.classList.add('hidden');
  }

  // Handle sources
  if (data.sources && data.sources.length > 0) {
    sources.innerHTML = '';
    data.sources.forEach(source => {
      sources.appendChild(createSourceElement(source));
    });
    sourcesSection.classList.remove('hidden');
  } else {
    sourcesSection.classList.add('hidden');
  }

  showSection(resultsSection);
}

// Function to handle errors
function handleError(error) {
  errorMessage.textContent = error;
  showSection(errorSection);
}

// Main analyze function
async function analyzePage() {
  try {
    showAnalysisView();
    showSection(loadingSection);
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Inject the content script if it hasn't been injected yet
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['extension/content.js']
    });

    // Wait a moment for the content script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Extract content from the page
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
    
    if (!response.success) {
      throw new Error(response.error);
    }

    // Send the content to our API
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'text',
        content: response.data.content,
      }),
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.json();
      throw new Error(error.error || 'Failed to analyze content');
    }

    const data = await apiResponse.json();
    displayResults(data);
  } catch (error) {
    handleError(error.message || 'An unexpected error occurred');
  }
}

// Event listeners
analyzeButton.addEventListener('click', analyzePage);

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  showSection(errorSection);
}); 