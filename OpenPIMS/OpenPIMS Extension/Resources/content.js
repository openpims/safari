// Content Script für OpenPIMS Safari Web Extension
console.log('🔄 CONTENT: OpenPIMS desktop content script loaded');

// Global variable to store current OpenPIMS URL
let currentOpenPimsUrl = null;

// Setup initial state
initializeHeaderInjection();

async function initializeHeaderInjection() {
    try {
        const result = await browser.storage.local.get(['openPimsUrl', 'isLoggedIn']);
        console.log('🔄 CONTENT: Storage result:', result);

        if (result.isLoggedIn && result.openPimsUrl) {
            setupOpenPIMSHeaderInjection(result.openPimsUrl);
        }
    } catch (error) {
        console.error('❌ CONTENT: Error getting storage:', error);
    }
}

// Listen for storage changes
if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, namespace) => {
        console.log('🔄 CONTENT: Storage changed:', changes, namespace);

        if (namespace === 'local' && (changes.openPimsUrl || changes.isLoggedIn)) {
            browser.storage.local.get(['openPimsUrl', 'isLoggedIn']).then(result => {
                console.log('🔄 CONTENT: Updated storage result:', result);

                if (result.isLoggedIn && result.openPimsUrl) {
                    setupOpenPIMSHeaderInjection(result.openPimsUrl);
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

function setupOpenPIMSHeaderInjection(openPimsUrl) {
    console.log('🔄 CONTENT: Setting up X-OpenPIMS header injection for:', openPimsUrl);

    // Store current URL
    currentOpenPimsUrl = openPimsUrl;

    // Remove any existing overrides first
    removeOpenPIMSHeaderInjection();

    // Override fetch
    window.originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (!init) init = {};
        if (!init.headers) init.headers = {};

        // Add X-OpenPIMS header
        if (init.headers instanceof Headers) {
            init.headers.set('X-OpenPIMS', currentOpenPimsUrl);
        } else if (typeof init.headers === 'object') {
            init.headers['X-OpenPIMS'] = currentOpenPimsUrl;
        }

        console.log('🔄 CONTENT: Adding X-OpenPIMS header to fetch request');
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

    XMLHttpRequest.prototype.send = function() {
        if (!this._openPimsHeaderSet && currentOpenPimsUrl) {
            this.setRequestHeader('X-OpenPIMS', currentOpenPimsUrl);
            console.log('🔄 CONTENT: Adding X-OpenPIMS header to XMLHttpRequest');
        }
        return originalSend.apply(this, arguments);
    };

    console.log('✅ CONTENT: X-OpenPIMS header injection setup complete');
}

function removeOpenPIMSHeaderInjection() {
    console.log('🔄 CONTENT: Removing X-OpenPIMS header injection');

    // Reset current URL
    currentOpenPimsUrl = null;

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