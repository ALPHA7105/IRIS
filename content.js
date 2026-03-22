chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getText") {
    sendResponse({ text: document.body.innerText });
  } 

  if (request.action === "highlight" || request.action === "scrollTo") {
    // Clean the AI's quote: remove extra spaces and punctuation at the ends
    const fullQuote = request.sentence.trim().replace(/[.!?]$/, "");
    if (fullQuote.length < 5) return true; // Ignore tiny fragments

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while(node = walker.nextNode()) {
      const nodeText = node.textContent.replace(/\s+/g, ' ');
      
      // Look for the quote inside the text node
      if (nodeText.includes(fullQuote)) {
        const parent = node.parentNode;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) continue;

        if (request.action === "highlight") {
          const span = document.createElement('span');
          // Escape special characters for Regex
          const escaped = fullQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          
          span.innerHTML = node.textContent.replace(regex, (match) => 
            `<mark style="background: yellow; color: black; font-weight: bold; padding: 2px; border-radius: 3px;">${match}</mark>`
          );
          parent.replaceChild(span, node);
        }

        if (request.action === "scrollTo") {
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          parent.style.outline = "5px solid #d93025";
          parent.style.transition = "outline 0.3s";
          setTimeout(() => parent.style.outline = "none", 3000);
        }
        break; 
      }
    }
  }
  return true;
});