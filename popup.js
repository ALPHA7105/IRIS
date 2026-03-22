const auditBtn = document.getElementById('auditBtn');
const resultsDiv = document.getElementById('results');
const setupPage = document.getElementById('setupPage');
const mainPage = document.getElementById('mainPage');

// 1. Initial Load: Check for Key
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['gemini_key', 'lastScan']);
  
  if (data.gemini_key) {
    showMain(data.lastScan);
  } else {
    showSetup();
  }
});

function showMain(lastScan) {
  setupPage.style.display = 'none';
  mainPage.style.display = 'block';
  if (lastScan) displayResults(lastScan);
}

function showSetup() {
  setupPage.style.display = 'block';
  mainPage.style.display = 'none';
}

// Switch back to setup if they click "Update API Key"
document.getElementById('reconfigure').addEventListener('click', showSetup);

// 2. Save Key Logic
document.getElementById('saveKey').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  if (key) {
    chrome.storage.local.set({ gemini_key: key }, () => {
      showMain();
    });
  } else {
    alert("Please enter a valid key.");
  }
});

// 3. The single source of truth for showing results
function displayResults(results) {
  resultsDiv.innerHTML = "";
  
  // Create a summary count
  // 1. Calculate the Stats
  const fallacies = results.filter(r => !r.integrity_flag).length;
  const integrity = results.filter(r => r.integrity_flag).length;

  // 2. Add the Summary Header with SVG Icons (No Emojis!)
  const summary = document.createElement('div');
  summary.style = "padding:12px; background:#fff; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-around; font-size:11px; font-weight:bold; border: 1px solid #dadce0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  
  summary.innerHTML = `
    <div style="display:flex; align-items:center; color:#d93025;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#d93025" style="margin-right:5px;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      ${fallacies} Logic Breaches
    </div>
    <div style="display:flex; align-items:center; color:#1a73e8;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#1a73e8" style="margin-right:5px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      ${integrity} Integrity Breaches
    </div>
  `;
  resultsDiv.appendChild(summary);

  results.forEach(item => {
    const report = document.createElement('div');
    report.className = "report-item"; 
    
    // SVG Icons
    const warningIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#d93025" style="margin-right:5px; vertical-align:middle;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
    const globeIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1a73e8" style="margin-right:5px; vertical-align:middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;

    const isIntegrity = item.integrity_flag === true && item.fact_check;
    const activeIcon = isIntegrity ? globeIcon : warningIcon;
    const headerColor = isIntegrity ? "#1a73e8" : "#d93025";

    report.innerHTML = `
      <div style="font-weight:bold; color:${headerColor}; font-size:13px; display:flex; align-items:center;">
          ${activeIcon} ${item.tactic}
      </div>
      <p style="font-size:11px; margin:5px 0; color:#333; line-height:1.4;">${item.explanation}</p>
      ${isIntegrity ? `
        <div style="margin-top:8px; padding:8px; background:#f8f9fa; border-left:3px solid #1a73e8; font-size:10.5px; color:#1a73e8;">
          <strong>Integrity Audit:</strong> ${item.fact_check}
        </div>
      ` : ''}
    `;

    report.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "scrollTo", sentence: item.sentence });
      }
    });

    resultsDiv.appendChild(report);
  });
  resultsDiv.style.display = 'block';
}

// 4. Run Scan
auditBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.url.startsWith("chrome://")) {
    alert("Please go to a news website!");
    return;
  }

  auditBtn.disabled = true;
  auditBtn.innerText = "Connecting...";

  chrome.tabs.sendMessage(tab.id, { action: "getText" }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      alert("Please REFRESH the page.");
      auditBtn.disabled = false;
      auditBtn.innerText = "Run AI Scanner";
      return;
    }

    auditBtn.innerText = "Analyzing text...";
    const storage = await chrome.storage.local.get('gemini_key');
    
    try {
      const aiResponseArray = await callGemini(storage.gemini_key, response.text);
      await chrome.storage.local.set({ lastScan: aiResponseArray });
      displayResults(aiResponseArray);

      aiResponseArray.forEach(item => {
        chrome.tabs.sendMessage(tab.id, { action: "highlight", sentence: item.sentence });
      });

    } catch (error) {
      if (error.message.includes("429")) {
          alert("🚦 System Overloaded: Please wait 60 seconds.");
      } else if (error.message.includes("401") || error.message.includes("403")) {
          alert("🔑 Key Error: Returning to setup.");
          showSetup();
      } else {
          alert("📡 Error: " + error.message);
      }
    } finally {
      auditBtn.disabled = false;
      auditBtn.innerText = "Run AI Scanner";
    }
  });
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 1. Wipe the saved data from storage
  await chrome.storage.local.remove('lastScan');
  
  // 2. Clear the UI in the popup
  resultsDiv.innerHTML = "";
  resultsDiv.style.display = 'none';
  
  // 3. Tell the content script to remove the yellow <mark> tags
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "clearHighlights" });
  }
  
  // Reset button text just in case
  auditBtn.disabled = false;
  auditBtn.innerText = "Run AI Scanner";
});

async function callGemini(key, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const prompt = `You are a UNESCO Media Literacy and Forensic Expert, named Information & Reasoning Inconsistency Scanner (IRIS). Your task is to analyze the provided text for any logical fallacies, emotional manipulation tactics, or factual inaccuracies.
Analyze this text carefully and perform an exhaustive forensic examination of the provided text. Cross-reference claims against search results for factual accuracy.

Identify EVERY logical fallacy, instance of emotional priming, or rhetorical manipulation present. Find even the most subtle ones. Find as many as you can, around 10. For each manipulative sentence you find, provide:
- The exact sentence (word-for-word)
- The name of the fallacy/tactic
- A brief explanation of why this is manipulative
Include these in the explanation:
- Highlight phrases that indicate emotional manipulation
- Type (fear, anger, urgency) of emotional manipulation
- Why the author might have used this tactic (e.g., to distract, to oversimplify, to provoke outrage)
- Is the text one-sided?
- What viewpoints are missing?
- IMPORTANT: Keep the wording concise but informative, as if explaining to a student learning media literacy for the first time.

Return ONLY a JSON array of objects. Do not include any introductory text, summaries, or explanations. The format MUST be:
[
  {"sentence": "exact sentence", "tactic": "Name of Fallacy", "explanation": "Why it is manipulative", "integrity_flag": true/false, "fact_check": "Brief search-based truth"},
  ...
]

CRITICAL INTEGRITY AUDIT RULES:
1. You MUST use the google_search tool for EVERY claim in the text. USE YOUR SEARCH TOOL to verify claims. Use is EVERYTIME. If a claim contradicts current 2026 data or verified news, YOU MUST set 'integrity_flag' to true.
2. If 'integrity_flag' is true, the 'tactic' should be "Factual Inaccuracy" or "Misleading Claim."
3. ONLY set 'integrity_flag' to true if you find a SPECIFIC factual contradiction.
4. If a sentence is just a headline or you cannot verify it, set 'integrity_flag' to false and DO NOT provide a 'fact_check' string.
5. NEVER write 'I don't have access to internal reports' or 'I am an AI.' If you cannot verify a claim with a specific search result, simply set 'integrity_flag' to false and leave 'fact_check' empty. 
6. Your 'fact_check' must be a direct result of your search tool, e.g., 'Official records from [Source] show X instead of Y.'

CRITICAL VERBATIM RULE: 
The "sentence" MUST be a 100% EXACT, WORD-FOR-WORD snippet copied from the text below. Do not paraphrase. If you cannot find an exact sentence, do not include it.

Text: ${text.substring(0, 4000)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API Error ${response.status}`);
  }

  const jsonResponse = await response.json();
  let rawText = jsonResponse.candidates[0].content.parts[0].text;
  
  // --- THE CLEANER ---
  // This finds the first [ and the last ] and ignores everything else (like ```json)
  const start = rawText.indexOf('[');
  const end = rawText.lastIndexOf(']') + 1;
  
  if (start === -1 || end === 0) {
    console.error("Raw AI Output:", rawText);
    throw new Error("AI did not return a valid list. Try again.");
  }
  
  const cleanJson = rawText.substring(start, end);
  return JSON.parse(cleanJson);
}
