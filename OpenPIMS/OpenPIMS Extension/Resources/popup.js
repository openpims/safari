// OpenPIMS Extension Popup

// Browser API Polyfill für Safari-Kompatibilität
const browserAPI = (() => {
    if (typeof browser !== 'undefined') {
        return browser;
    } else if (typeof chrome !== 'undefined') {
        return chrome;
    } else {
        throw new Error('Keine Browser Extension API verfügbar');
    }
})();


// Lade die gespeicherten Daten und prüfe Login-Status
browserAPI.storage.local.get(['userId', 'isLoggedIn', 'email', 'serverUrl'], (result) => {
    const loggedInContent = document.getElementById('loggedInContent');
    const loginForm = document.getElementById('loginForm');
    const urlElement = document.getElementById('url');

    if (result.isLoggedIn && result.userId) {
        urlElement.innerHTML = `
            <div style="margin-bottom: 10px;">Angemeldet als: ${result.email || 'Unbekannt'}</div>
            <div style="font-size: 0.9em; color: #666;">Server: ${result.serverUrl || 'https://me.openpims.de'}</div>
        `;
        loggedInContent.classList.remove('hidden');
        loginForm.classList.add('hidden');
    } else {
        loggedInContent.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
});

// DOM Ready Event
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    if (!loginButton) {
        return;
    }

    // Login-Button Event Listener
    loginButton.addEventListener('click', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const serverUrl = document.getElementById('serverUrl').value;
        const errorMessage = document.getElementById('errorMessage');
        const loginButton = document.getElementById('loginButton');

        // UI-Status zurücksetzen
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
        loginButton.disabled = true;
        loginButton.textContent = 'Anmeldung läuft...';

        if (!email || !password || !serverUrl) {
            errorMessage.textContent = 'Bitte füllen Sie alle Felder aus.';
            errorMessage.classList.add('visible');
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
            return;
        }

        try {
            const response = await new Promise((resolve, reject) => {
                browserAPI.runtime.sendMessage({
                    action: 'login',
                    email: email,
                    password: password,
                    serverUrl: serverUrl
                }, response => {
                    if (browserAPI.runtime.lastError) {
                        reject(new Error(browserAPI.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (!response.success) {
                throw new Error(response.error);
            }

            const data = response.data;

            await browserAPI.storage.local.set({
                userId: data.userId,
                secret: data.secret,
                appDomain: data.appDomain,
                email: email,
                serverUrl: serverUrl,
                isLoggedIn: true
            });

            // UI aktualisieren
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('loggedInContent').classList.remove('hidden');
            document.getElementById('url').innerHTML = `
                <div style="margin-bottom: 10px;">Angemeldet als: ${email}</div>
                <div style="font-size: 0.9em; color: #666;">Server: ${serverUrl}</div>
            `;
            
            
        } catch (error) {
            // Nur die UI aktualisieren, keine Protokollierung
            errorMessage.textContent = error.message;
            errorMessage.classList.add('visible');
            
            // Setze das Passwort-Feld zurück
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        } finally {
            // UI-Status zurücksetzen
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
    });

    // Logout-Button Event Listener
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {

                // Lösche die gespeicherten Daten
                await browserAPI.storage.local.remove(['userId', 'secret', 'appDomain', 'isLoggedIn', 'email', 'serverUrl']);
                
                // Aktualisiere die Anzeige
                const loggedInContent = document.getElementById('loggedInContent');
                const loginForm = document.getElementById('loginForm');
                const urlElement = document.getElementById('url');
                const emailInput = document.getElementById('email');
                const passwordInput = document.getElementById('password');
                const errorMessage = document.getElementById('errorMessage');

                // Setze Formularfelder zurück
                emailInput.value = '';
                passwordInput.value = '';
                errorMessage.textContent = '';
                errorMessage.classList.remove('visible');

                loggedInContent.classList.add('hidden');
                loginForm.classList.remove('hidden');
                urlElement.textContent = '';
            } catch (error) {
                // Silently handle logout errors
            }
        });
    }
});
