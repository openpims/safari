// Background Script für OpenPIMS Safari Web Extension (iOS Version)
// NOTE: Background scripts do not work in mobile Safari extensions!
// Header modification is handled by content.js via cookies instead.

console.log('📝 Background script loaded (but not functional in mobile Safari)');

// Hilfsfunktion für saubere Fehler
function createCleanError(message, status = null) {
    const error = new Error();
    error.message = message;
    if (status !== null) {
        error.status = status;
    }
    delete error.stack;
    return error;
}

// Simple message handler for login only (if it works)
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        if (request.greeting === "hello") {
            return Promise.resolve({ farewell: "goodbye" });
        }

        if (request.action === 'login') {
            try {
                const loginString = `${request.email}:${request.password}`;
                const base64LoginString = btoa(loginString);

                const loginResponse = await fetch(request.serverUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${base64LoginString}`
                    }
                });

                if (!loginResponse.ok) {
                    let errorMessage;
                    switch (loginResponse.status) {
                        case 401:
                            errorMessage = 'Ungültige E-Mail oder Passwort';
                            break;
                        case 403:
                            errorMessage = 'Zugriff verweigert';
                            break;
                        case 404:
                            errorMessage = 'Login-Service nicht erreichbar';
                            break;
                        case 500:
                            errorMessage = 'Server-Fehler, bitte versuchen Sie es später erneut';
                            break;
                        default:
                            errorMessage = `Login fehlgeschlagen (Status: ${loginResponse.status})`;
                    }
                    throw createCleanError(errorMessage, loginResponse.status);
                }

                const contentType = loginResponse.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await loginResponse.json();

                    if (!data.userId || !data.token || !data.domain) {
                        throw createCleanError('Keine gültige User-ID, Token oder Domain vom Server erhalten');
                    }

                    sendResponse({
                        success: true,
                        data: {
                            userId: data.userId,
                            secret: data.token,
                            appDomain: data.domain
                        }
                    });
                } else {
                    const text = await loginResponse.text();

                    try {
                        data = JSON.parse(text);

                        if (!data.userId || !data.token || !data.domain) {
                            throw createCleanError('Keine gültige User-ID, Token oder Domain vom Server erhalten');
                        }

                        sendResponse({
                            success: true,
                            data: {
                                userId: data.userId,
                                secret: data.token,
                                appDomain: data.domain
                            }
                        });
                    } catch (e) {
                        throw createCleanError('Server-Antwort hat falsches Format. Erwartet JSON mit userId, token und domain.');
                    }
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
    });
}