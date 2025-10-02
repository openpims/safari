console.log('🔄 CONTENT: OpenPIMS mobile content script loaded');

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

// Cookie-based OpenPIMS URL transmission with domain-specific subdomain generation
async function applyOpenPIMSCookie() {
    try {
        if (typeof browser !== 'undefined' && browser.storage) {
            const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);
            console.log('📦 CONTENT: Storage result:', result);

            if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
                console.log('🔧 CONTENT: User is logged in, generating domain-specific subdomain');

                // Get current domain
                const currentDomain = window.location.hostname;

                // Generate domain-specific subdomain
                const subdomain = await generateDeterministicSubdomain(
                    result.userId,
                    result.secret,
                    currentDomain
                );
                const openPimsUrl = `https://${subdomain}.${result.appDomain}`;

                // Set cookie with domain-specific OpenPIMS URL
                document.cookie = `x-openpims=${encodeURIComponent(openPimsUrl)}; path=/; SameSite=Lax`;

                console.log('✅ CONTENT: OpenPIMS cookie set for', currentDomain, ':', openPimsUrl);
            } else {
                console.log('🗑️ CONTENT: User not logged in, removing OpenPIMS cookie');

                // Remove cookie by setting expired date
                document.cookie = 'x-openpims=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

                console.log('✅ CONTENT: OpenPIMS cookie removed');
            }
        }
    } catch (error) {
        console.error('❌ CONTENT: Error setting OpenPIMS cookie:', error);
    }
}

// Apply OpenPIMS cookie immediately
applyOpenPIMSCookie();

// Also setup header injection for fetch and XMLHttpRequest
function setupHeaderInjection() {
    // Override fetch to add X-OpenPIMS header
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        if (!init) init = {};
        if (!init.headers) init.headers = {};

        // Get stored credentials
        const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);

        if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
            const currentDomain = window.location.hostname;
            const subdomain = await generateDeterministicSubdomain(
                result.userId,
                result.secret,
                currentDomain
            );
            const openPimsUrl = `https://${subdomain}.${result.appDomain}`;

            // Add X-OpenPIMS header
            if (init.headers instanceof Headers) {
                init.headers.set('X-OpenPIMS', openPimsUrl);
            } else if (typeof init.headers === 'object') {
                init.headers['X-OpenPIMS'] = openPimsUrl;
            }
        }

        return originalFetch.call(this, input, init);
    };

    // Override XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function() {
        this._openPimsHeaderSet = false;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = async function() {
        if (!this._openPimsHeaderSet) {
            const result = await browser.storage.local.get(['userId', 'secret', 'appDomain', 'isLoggedIn']);

            if (result.isLoggedIn && result.userId && result.secret && result.appDomain) {
                const currentDomain = window.location.hostname;
                const subdomain = await generateDeterministicSubdomain(
                    result.userId,
                    result.secret,
                    currentDomain
                );
                const openPimsUrl = `https://${subdomain}.${result.appDomain}`;

                this.setRequestHeader('X-OpenPIMS', openPimsUrl);
            }
        }
        return originalSend.apply(this, arguments);
    };

    console.log('✅ CONTENT: Header injection setup complete');
}

// Setup header injection immediately
setupHeaderInjection();

// Listen for storage changes to update cookie
if (typeof browser !== 'undefined' && browser.storage) {
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.userId || changes.secret || changes.appDomain || changes.isLoggedIn)) {
            console.log('🔄 CONTENT: Storage changed, updating OpenPIMS cookie');
            applyOpenPIMSCookie();
        }
    });
}

// Test initial communication
if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
        console.log("✅ CONTENT: Received hello response:", response);
    }).catch((error) => {
        console.error("❌ CONTENT: Error sending hello message:", error);
    });
}

// Listen for messages from the background script
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("🔄 CONTENT: Received request:", request);
    });
}

// Create a global function that the WebView can call
window.sendToExtension = function(data) {
    console.log('🔄 CONTENT: sendToExtension called with:', data);

    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        return browser.runtime.sendMessage(data)
            .then(response => {
                console.log('✅ CONTENT: Extension response:', response);
                return response;
            })
            .catch(error => {
                console.error('❌ CONTENT: Extension communication error:', error);
                throw error;
            });
    } else {
        console.error('❌ CONTENT: Browser runtime not available');
        return Promise.reject(new Error('Browser runtime not available'));
    }
};

console.log('🔄 CONTENT: Content script initialization complete');
