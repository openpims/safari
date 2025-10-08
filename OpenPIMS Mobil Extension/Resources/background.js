// Background Script für OpenPIMS Safari Web Extension mit DNR

// Deterministic subdomain generation with daily rotation
async function generateDeterministicSubdomain(userId, secret, domain) {
    const dayTimestamp = Math.floor(Math.floor(Date.now() / 1000) / 86400);
    const message = `${userId}${domain}${dayTimestamp}`;

    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    const secretData = encoder.encode(secret);

    // Use browser's crypto API
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
    return hash;
}

// Track domains with rules
const domainsWithRules = new Set();

// Add domain-specific User-Agent rule
async function addDomainSpecificUserAgentRule(domain, userId, secret, appDomain) {
    if (!browser.declarativeNetRequest) {
        throw new Error('declarativeNetRequest not available');
    }

    try {
        // Generate domain-specific subdomain
        const subdomain = await generateDeterministicSubdomain(userId, secret, domain);
        const openPimsUrl = `https://${subdomain}.${appDomain}`;

        // Generate unique rule ID based on domain
        const ruleId = Math.abs(hashCode(domain)) % 10000 + 1;

        // Create domain-specific rule
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId],
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
                    "urlFilter": `*://${domain}/*`,
                    "resourceTypes": ["main_frame", "xmlhttprequest", "sub_frame", "script", "stylesheet", "image", "font", "media", "other"]
                }
            }]
        });

        domainsWithRules.add(domain);
        console.log(`User-Agent rule for ${domain} created: ${openPimsUrl}`);

    } catch (error) {
        console.error('Error creating User-Agent rule:', error);
        throw error;
    }
}

// Listen for webNavigation events to detect new domains
if (browser.webNavigation) {
    browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
        if (details.frameId !== 0) return; // Only process main frame

        try {
            const url = new URL(details.url);
            const domain = url.hostname;

            // Skip if rule already exists for this domain
            if (domainsWithRules.has(domain)) {
                return;
            }

            // Get stored credentials
            const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);

            if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
                await addDomainSpecificUserAgentRule(domain, result.userId, result.secret, result.appDomain);
            }
        } catch (error) {
            console.error('Error in webNavigation listener:', error);
        }
    });
}

// Storage Listener for login/logout
browser.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.isLoggedIn) {
        if (changes.isLoggedIn.newValue === false) {
            // User logged out - remove all rules
            if (browser.declarativeNetRequest) {
                const rules = await browser.declarativeNetRequest.getDynamicRules();
                const ruleIds = rules.map(r => r.id);
                if (ruleIds.length > 0) {
                    await browser.declarativeNetRequest.updateDynamicRules({
                        removeRuleIds: ruleIds
                    });
                }
                domainsWithRules.clear();
            }
        } else if (changes.isLoggedIn.newValue === true) {
            // User logged in - create rules for all currently open tabs
            console.log('User logged in, creating rules for open tabs');

            try {
                const result = await browser.storage.local.get(['userId', 'secret', 'appDomain']);

                if (result.userId && result.secret && result.appDomain && browser.tabs) {
                    const tabs = await browser.tabs.query({});

                    for (const tab of tabs) {
                        if (tab.url) {
                            try {
                                const url = new URL(tab.url);
                                const domain = url.hostname;

                                // Skip if rule already exists or if it's a browser internal page
                                if (domainsWithRules.has(domain) || url.protocol === 'chrome:' || url.protocol === 'about:' || url.protocol === 'safari-extension:') {
                                    continue;
                                }

                                await addDomainSpecificUserAgentRule(domain, result.userId, result.secret, result.appDomain);
                            } catch (e) {
                                console.error('Error creating rule for tab:', tab.url, e);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error creating rules for open tabs:', error);
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
                throw new Error(errorMessage);
            }

            const contentType = loginResponse.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await loginResponse.json();

                if (!data.userId || !data.token || !data.domain) {
                    throw new Error('Keine gültige User-ID, Token oder Domain vom Server erhalten');
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
                        throw new Error('Keine gültige User-ID, Token oder Domain vom Server erhalten');
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
                    throw new Error('Server-Antwort hat falsches Format. Erwartet JSON mit userId, token und domain.');
                }
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});
