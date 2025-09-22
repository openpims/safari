// Background Script für OpenPIMS Safari Web Extension mit DNR

// Dynamische User-Agent Rule für OpenPIMS URL
async function addOpenPIMSUserAgentRule(openPimsUrl) {
    if (!browser.declarativeNetRequest) {
        throw new Error('declarativeNetRequest not available');
    }

    try {
        const ruleId = 100;

        // Entferne existierende Regel falls vorhanden
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId]
        }).catch(() => {}); // Ignoriere Fehler falls Regel nicht existiert

        // Füge neue Regel hinzu
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                "id": ruleId,
                "priority": 1,
                "action": {
                    "type": "modifyHeaders",
                    "requestHeaders": [{
                        "header": "User-Agent",
                        "operation": "set",
                        "value": `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 OpenPIMS/1.0 (+${openPimsUrl})`
                    }]
                },
                "condition": {
                    "urlFilter": "|http*",
                    "resourceTypes": ["main_frame", "xmlhttprequest", "sub_frame", "script", "stylesheet", "image", "font", "media", "other"]
                }
            }]
        });

        return ruleId;

    } catch (error) {
        throw error;
    }
}

// Declarative Net Request Setup
if (browser.declarativeNetRequest) {

    // Prüfe beim Start ob User eingeloggt ist und erstelle Regel
    browser.storage.local.get(['openPimsUrl', 'isLoggedIn']).then(result => {
        if (result.isLoggedIn && result.openPimsUrl) {
            addOpenPIMSUserAgentRule(result.openPimsUrl).catch(() => {});
        }
    });

}

// Storage Listener für OpenPIMS-Konfiguration
browser.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && (changes.openPimsUrl || changes.isLoggedIn)) {
        // Aktualisiere User-Agent DNR Rule
        if (browser.declarativeNetRequest) {
            try {
                // Hole aktuelle Werte
                const result = await browser.storage.local.get(['openPimsUrl', 'isLoggedIn']);

                if (result.isLoggedIn && result.openPimsUrl) {
                    // User ist eingeloggt und hat URL - erstelle Regel
                    await addOpenPIMSUserAgentRule(result.openPimsUrl);
                } else {
                    // User ist ausgeloggt oder hat keine URL - entferne Regel
                    await browser.declarativeNetRequest.updateDynamicRules({
                        removeRuleIds: [100]
                    });
                }
            } catch (error) {
                // Silently handle error
            }
        }
    }
});

// Message Handler für DNR-Verwaltung und Login
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("Received request: ", request);

    if (request.greeting === "hello")
        return Promise.resolve({ farewell: "goodbye" });

    if (request.action === 'login') {
        try {
            // Login-Anfrage an OpenPIMS Server (GET mit Basic Auth wie in Swift)
            const loginString = `${request.email}:${request.password}`;
            const base64LoginString = btoa(loginString);

            const loginResponse = await fetch(request.serverUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${base64LoginString}`
                }
            });

            if (!loginResponse.ok) {
                throw new Error(`Login fehlgeschlagen: ${loginResponse.status}`);
            }

            const openPimsUrl = await loginResponse.text();
            const trimmedUrl = openPimsUrl.trim();

            if (!trimmedUrl) {
                throw new Error('No valid URL received from server');
            }

            sendResponse({ success: true, data: { token: trimmedUrl } });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});
