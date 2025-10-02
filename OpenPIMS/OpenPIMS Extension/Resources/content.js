// Content Script für OpenPIMS Safari Web Extension
console.log('🔄 CONTENT: OpenPIMS desktop content script loaded');

// Global variables to store credentials
let userCredentials = null; // {userId, secret, appDomain}

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

// Setup initial state
initializeHeaderInjection();

async function initializeHeaderInjection() {
    try {
        const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);
        console.log('🔄 CONTENT: Storage result:', result);

        if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
            userCredentials = {
                userId: result.userId,
                secret: result.secret,
                appDomain: result.appDomain
            };
            setupOpenPIMSHeaderInjection();
        }
    } catch (error) {
        console.error('❌ CONTENT: Error getting storage:', error);
    }
}

// Listen for storage changes
if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, namespace) => {
        console.log('🔄 CONTENT: Storage changed:', changes, namespace);

        if (namespace === 'local' && (changes.userId || changes.secret || changes.appDomain || changes.isLoggedIn)) {
            browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']).then(result => {
                console.log('🔄 CONTENT: Updated storage result:', result);

                if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
                    userCredentials = {
                        userId: result.userId,
                        secret: result.secret,
                        appDomain: result.appDomain
                    };
                    setupOpenPIMSHeaderInjection();
                } else {
                    removeOpenPIMSHeaderInjection();
                }
            }).catch(error => {
                console.error('❌ CONTENT: Error updating from storage:', error);
            });
        }
    });
} else {
    console.error('❌ CONTENT: Storage API not available');
}

function setupOpenPIMSHeaderInjection() {
    console.log('🔄 CONTENT: Setting up domain-specific X-OpenPIMS header and User-Agent injection');

    // Remove any existing overrides first
    removeOpenPIMSHeaderInjection();

    // Override navigator.userAgent for domain-specific User-Agent
    if (userCredentials) {
        const currentDomain = window.location.hostname;

        // Generate domain-specific subdomain synchronously for initial setup
        generateDeterministicSubdomain(
            userCredentials.userId,
            userCredentials.secret,
            currentDomain
        ).then(subdomain => {
            const openPimsUrl = `https://${subdomain}.${userCredentials.appDomain}`;

            // Override userAgent getter
            Object.defineProperty(navigator, 'userAgent', {
                get: function() {
                    const originalUA = navigator.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
                    return `${originalUA} OpenPIMS/1.0 (+${openPimsUrl})`;
                },
                configurable: true
            });

            console.log('✅ CONTENT: User-Agent override set with domain-specific URL:', openPimsUrl);
        });
    }

    // Override fetch
    window.originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        if (!init) init = {};
        if (!init.headers) init.headers = {};

        if (userCredentials) {
            // Generate domain-specific subdomain
            const currentDomain = window.location.hostname;
            const subdomain = await generateDeterministicSubdomain(
                userCredentials.userId,
                userCredentials.secret,
                currentDomain
            );
            const openPimsUrl = `https://${subdomain}.${userCredentials.appDomain}`;

            // Add X-OpenPIMS header
            if (init.headers instanceof Headers) {
                init.headers.set('X-OpenPIMS', openPimsUrl);
            } else if (typeof init.headers === 'object') {
                init.headers['X-OpenPIMS'] = openPimsUrl;
            }

            console.log('🔄 CONTENT: Adding domain-specific X-OpenPIMS header to fetch:', openPimsUrl);
        }

        return window.originalFetch.call(this, input, init);
    };

    // Override XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const originalSend = XMLHttpRequest.prototype.send;

    window.originalXHROpen = originalOpen;
    window.originalXHRSetRequestHeader = originalSetRequestHeader;
    window.originalXHRSend = originalSend;

    XMLHttpRequest.prototype.open = function() {
        this._openPimsHeaderSet = false;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (name.toLowerCase() === 'x-openpims') {
            this._openPimsHeaderSet = true;
        }
        return originalSetRequestHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = async function() {
        if (!this._openPimsHeaderSet && userCredentials) {
            const currentDomain = window.location.hostname;
            const subdomain = await generateDeterministicSubdomain(
                userCredentials.userId,
                userCredentials.secret,
                currentDomain
            );
            const openPimsUrl = `https://${subdomain}.${userCredentials.appDomain}`;

            this.setRequestHeader('X-OpenPIMS', openPimsUrl);
            console.log('🔄 CONTENT: Adding domain-specific X-OpenPIMS header to XMLHttpRequest:', openPimsUrl);
        }
        return originalSend.apply(this, arguments);
    };

    console.log('✅ CONTENT: Domain-specific X-OpenPIMS header injection setup complete');
}

function removeOpenPIMSHeaderInjection() {
    console.log('🔄 CONTENT: Removing X-OpenPIMS header injection');

    // Reset credentials
    userCredentials = null;

    // Restore original fetch
    if (window.originalFetch) {
        window.fetch = window.originalFetch;
        delete window.originalFetch;
    }

    // Restore original XMLHttpRequest
    if (window.originalXHROpen) {
        XMLHttpRequest.prototype.open = window.originalXHROpen;
        XMLHttpRequest.prototype.setRequestHeader = window.originalXHRSetRequestHeader;
        XMLHttpRequest.prototype.send = window.originalXHRSend;
        delete window.originalXHROpen;
        delete window.originalXHRSetRequestHeader;
        delete window.originalXHRSend;
    }

    console.log('✅ CONTENT: X-OpenPIMS header injection removed');
}