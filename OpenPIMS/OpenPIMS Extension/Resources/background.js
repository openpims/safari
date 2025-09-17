// Background Script für OpenPIMS Safari Web Extension mit DNR

// Declarative Net Request Setup
if (browser.declarativeNetRequest) {
    
    // Dynamische User-Agent Rule für OpenPIMS URL
    async function addOpenPIMSUserAgentRule(openPimsUrl) {
        try {
            const ruleId = 1;
            
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
                            "value": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 OpenPIMS/1.0 (+${openPimsUrl})`
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
    
    // Prüfe beim Start ob User eingeloggt ist und erstelle Regel
    browser.storage.local.get(['openPimsUrl', 'isLoggedIn']).then(result => {
        if (result.isLoggedIn && result.openPimsUrl) {
            addOpenPIMSUserAgentRule(result.openPimsUrl).catch(() => {});
        }
    });
    
}

// Storage Listener für OpenPIMS-Konfiguration
browser.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.openPimsUrl) {
        // Aktualisiere User-Agent DNR Rule mit neuer URL
        if (browser.declarativeNetRequest && changes.openPimsUrl.newValue) {
            try {
                await addOpenPIMSUserAgentRule(changes.openPimsUrl.newValue);
            } catch (error) {
                // Silently handle error
            }
        } else if (browser.declarativeNetRequest && !changes.openPimsUrl.newValue) {
            // URL gelöscht - entferne die Regel
            try {
                await browser.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: [1]
                });
            } catch (error) {
                // Silently handle error
            }
        }
    }
});

// Message Handler für DNR-Verwaltung und Login
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
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

            // Erstelle dynamische DNR-Regel mit der erhaltenen URL
            try {
                await addOpenPIMSUserAgentRule(trimmedUrl);
            } catch (error) {
                // Silently handle error
            }

            sendResponse({ success: true, data: { token: trimmedUrl } });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }


});
