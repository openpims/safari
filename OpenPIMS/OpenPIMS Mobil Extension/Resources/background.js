// Background Script für OpenPIMS Safari Web Extension (iOS Version)

console.log('=== OpenPIMS Mobile Extension background script loaded ===');

// Message Handler für Login (ohne DNR User-Agent, wird im WKWebView gesetzt)
if (browser.runtime && browser.runtime.onMessage) {
    console.log('Setting up message listener...');

    browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        console.log("=== BACKGROUND: Received request ===", request);
        console.log("Sender:", sender);

        if (request.greeting === "hello") {
            console.log("BACKGROUND: Responding to hello");
            return Promise.resolve({ farewell: "goodbye" });
        }

        if (request.action === 'login') {
            console.log("BACKGROUND: Processing login request");
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

                console.log("BACKGROUND: Login successful");
                sendResponse({ success: true, data: { token: trimmedUrl } });
            } catch (error) {
                console.error("BACKGROUND: Login error:", error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }

        console.log("BACKGROUND: Unknown action:", request.action);
    });
} else {
    console.error('browser.runtime.onMessage not available!');
}