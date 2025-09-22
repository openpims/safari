console.log('🔄 CONTENT: OpenPIMS mobile content script loaded');
console.log('🔄 CONTENT: browser available:', typeof browser);
console.log('🔄 CONTENT: browser.runtime available:', typeof browser !== 'undefined' && typeof browser.runtime);

// Test initial communication
if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
        console.log("✅ CONTENT: Received hello response:", response);
    }).catch((error) => {
        console.error("❌ CONTENT: Error sending hello message:", error);
    });
}

// Listen for messages from the background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("🔄 CONTENT: Received request:", request);
});

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

console.log('🔄 CONTENT: Global sendToExtension function created');
