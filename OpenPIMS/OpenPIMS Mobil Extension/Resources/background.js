// Background Script für OpenPIMS Safari Web Extension (iOS Version)
// NOTE: Background scripts do not work in mobile Safari extensions!
// User-Agent modification is handled by content.js instead.

console.log('📝 Background script loaded (but not functional in mobile Safari)');

// Simple message handler for login only (if it works)
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.greeting === "hello") {
            return Promise.resolve({ farewell: "goodbye" });
        }

        if (request.action === 'login') {
            try {
                // Login-Anfrage an OpenPIMS Server (GET mit Basic Auth)
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
}