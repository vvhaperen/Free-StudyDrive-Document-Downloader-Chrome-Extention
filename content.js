
(function () {
  const urlPattern = /^https:\/\/www\.studydrive\.net\/[a-z]{2}\/doc\//i;
  const BUTTON_ID = "studydrive-download-btn";

  function isDocPage() {
    return urlPattern.test(window.location.href);
  }

  function ensureButton() {
    if (!isDocPage()) return;
    if (document.getElementById(BUTTON_ID)) return;
    if (!document.body) return;

    const button = createButton();
    document.body.appendChild(button);
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "dnbtn";
    button.style.backgroundColor = "green";
    button.style.color = "white";
    button.style.padding = "15px";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.position = "fixed";
    button.style.bottom = "20px";
    button.style.right = "20px";
    button.style.zIndex = "1000";
    button.style.transition = "transform 0.3s ease-in-out";

    const buttonText = document.createElement("span");
    buttonText.textContent = "Download Document";
    button.appendChild(buttonText);

    button.addEventListener("mouseenter", function () {
      button.style.transform = "scale(1.1)";
    });

    button.addEventListener("mouseleave", function () {
      button.style.transform = "scale(1)";
    });

    button.addEventListener("click", onDownloadClick);

    return button;
  }

  async function onDownloadClick() {
    try {
      console.log("[StudyDrive Download] Download button clicked");

      const result = await fetch(window.location.href, { credentials: "include" });
      if (!result.ok) {
        console.error("[StudyDrive Download] Failed to fetch page HTML", result.status, result.statusText);
        return;
      }
      const html = await result.text();

      const parsedLink = getDownloadLink(html);
      if (!parsedLink) {
        console.error("[StudyDrive Download] Download link not found");
        return;
      }

      const fileName = getFileName(html);
      if (!fileName) {
        console.error("[StudyDrive Download] File extension not supported (only .pdf)");
        return;
      }

      const downloadUrl = new URL(parsedLink, window.location.href).toString();

      if (!chrome?.runtime?.sendMessage) {
        console.error("[StudyDrive Download] chrome.runtime.sendMessage not available");
        return;
      }

      const resp = await chrome.runtime.sendMessage({
        type: "STUDYDRIVE_DOWNLOAD",
        url: downloadUrl,
        filename: fileName,
      });

      if (!resp?.ok) {
        console.error("[StudyDrive Download] Download failed", resp?.error || resp);
      }
    } catch (err) {
      console.error("[StudyDrive Download] Unexpected error", err);
    }
  }

  function getDownloadLink(html) {
    const linkMatch = /"file_preview"\s*:\s*("[^"]*")/.exec(html);
    if (!linkMatch) return null;
    try {
      return JSON.parse(linkMatch[1]);
    } catch {
      return null;
    }
  }

  function getFileName(html) {
    const fileNameMatch = /"filename"\s*:\s*("[^"]*")/.exec(html);
    if (!fileNameMatch) return "preview.pdf";

    let fileName = JSON.parse(fileNameMatch[1]);

    if (fileName.endsWith(".docx")) {
      fileName = fileName.slice(0, -5) + ".pdf";
    }

    if (!fileName.endsWith(".pdf")) {
      return null;
    }

    return fileName;
  }

  // SPA support: StudyDrive navigates without full reload.
  function hookHistory() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    history.pushState = function () {
      const ret = _pushState.apply(this, arguments);
      setTimeout(ensureButton, 0);
      return ret;
    };

    history.replaceState = function () {
      const ret = _replaceState.apply(this, arguments);
      setTimeout(ensureButton, 0);
      return ret;
    };

    window.addEventListener("popstate", function () {
      setTimeout(ensureButton, 0);
    });
  }

  hookHistory();
  ensureButton();
  // If body isn't ready yet, try again soon.
  const bodyWait = setInterval(() => {
    ensureButton();
    if (document.body && (!isDocPage() || document.getElementById(BUTTON_ID))) clearInterval(bodyWait);
  }, 500);
})();
