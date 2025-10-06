// Background Script für OpenPIMS Safari Web Extension (iOS Version)
// Uses declarativeNetRequest to add cookies to all requests

console.log('📝 Background script loaded - using declarativeNetRequest for cookies');

// Deterministic subdomain generation with daily rotation
async function generateDeterministicSubdomain(userId, secret, domain) {
    const dayTimestamp = Math.floor(Math.floor(Date.now() / 1000) / 86400);
    const message = `${userId}${domain}${dayTimestamp}`;

    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    const secretData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
        'raw',
        secretData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.substring(0, 32);
}

// Hash function for consistent rule IDs
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Track domains with cookie rules
const domainsWithCookies = new Set();

// Add cookie rule for specific domain using declarativeNetRequest
async function addCookieForDomain(domain, userId, secret, appDomain) {
    if (!browser.declarativeNetRequest) {
        console.error('❌ declarativeNetRequest API not available');
        return false;
    }

    try {
        // Generate domain-specific subdomain
        const subdomain = await generateDeterministicSubdomain(userId, secret, domain);
        const openPimsUrl = `https://${subdomain}.${appDomain}`;

        // Generate unique rule ID based on domain (1-30000 range for dynamic rules)
        const ruleId = (hashCode(domain) % 29999) + 1;

        console.log(`🍪 Adding cookie rule for ${domain} with ID ${ruleId}`);

        // Remove existing rule if any
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId]
        });

        // Add new cookie rule
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                "id": ruleId,
                "priority": 1,
                "action": {
                    "type": "modifyHeaders",
                    "requestHeaders": [
                        {
                            "header": "Cookie",
                            "operation": "append",
                            "value": `x-openpims=${encodeURIComponent(openPimsUrl)}`
                        }
                    ]
                },
                "condition": {
                    "urlFilter": `||${domain}`,
                    "resourceTypes": [
                        "main_frame",
                        "sub_frame",
                        "xmlhttprequest",
                        "other"
                    ]
                }
            }]
        });

        domainsWithCookies.add(domain);
        console.log(`✅ Cookie rule successfully added for ${domain}`);

        return true;

    } catch (error) {
        console.error(`❌ Error adding cookie rule for ${domain}:`, error);
        return false;
    }
}

// Listen for page navigation to add cookies
if (browser.webNavigation) {
    browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
        // Only process main frame navigations
        if (details.frameId !== 0) return;

        try {
            const url = new URL(details.url);
            const domain = url.hostname;

            // Skip if we already have a cookie rule for this domain
            if (domainsWithCookies.has(domain)) {
                return;
            }

            // Get stored credentials
            const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);

            if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
                console.log(`🔄 Setting up cookie for new domain: ${domain}`);
                await addCookieForDomain(domain, result.userId, result.secret, result.appDomain);
            }
        } catch (error) {
            console.error('❌ Error in navigation listener:', error);
        }
    });
}

// Listen for storage changes (login/logout)
browser.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.isLoggedIn) {
        if (changes.isLoggedIn.newValue === false) {
            // User logged out - remove all cookie rules
            console.log('🔄 User logged out, removing all cookie rules');

            if (browser.declarativeNetRequest) {
                try {
                    const rules = await browser.declarativeNetRequest.getDynamicRules();
                    const ruleIds = rules.map(r => r.id);

                    if (ruleIds.length > 0) {
                        await browser.declarativeNetRequest.updateDynamicRules({
                            removeRuleIds: ruleIds
                        });
                        console.log(`✅ Removed ${ruleIds.length} cookie rules`);
                    }

                    domainsWithCookies.clear();
                } catch (error) {
                    console.error('❌ Error removing cookie rules:', error);
                }
            }
        }
    }
});

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