//
//  ViewController.swift
//  OpenPIMS Mobil
//
//  Created by Stefan Böck on 17.09.25.
//

import UIKit
import WebKit
import SafariServices

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Enable JavaScript (using modern API for iOS 14+)
        if #available(iOS 14.0, *) {
            // JavaScript is enabled by default, but we can configure it per navigation if needed
            // The configuration will be set in the WKNavigationDelegate methods if needed
        } else {
            // Fallback for older iOS versions
            self.webView.configuration.preferences.javaScriptEnabled = true
        }

        // Enable JavaScript in WebView for debugging
        if #available(iOS 16.4, *) {
            self.webView.configuration.preferences.isElementFullscreenEnabled = true
        }

        // Enable developer extras for debugging
        #if DEBUG
        if #available(iOS 16.4, *) {
            self.webView.configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        }
        #endif

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false

        // Add message handlers once
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.configuration.userContentController.add(self, name: "consoleLog")

        // Set custom User-Agent if user is logged in
        setupUserAgent()

        // Load the main HTML file
        if #available(iOS 14.0, *) {
            // Use modern loading with WKWebpagePreferences
            let url = Bundle.main.url(forResource: "Main", withExtension: "html")!
            let preferences = WKWebpagePreferences()
            preferences.allowsContentJavaScript = true
            self.webView.configuration.defaultWebpagePreferences = preferences
            self.webView.loadFileURL(url, allowingReadAccessTo: Bundle.main.resourceURL!)
        } else {
            // Fallback for older iOS versions
            self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
        }
    }

    private func setupUserAgent() {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "isLoggedIn")
        let openPimsUrl = UserDefaults.standard.string(forKey: "openPimsToken")

        if isLoggedIn, let url = openPimsUrl, !url.isEmpty {
            let customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 OpenPIMS/1.0 (+\(url))"
            self.webView.customUserAgent = customUserAgent
            print("🔄 Swift: User-Agent set to: \(customUserAgent)")
        } else {
            self.webView.customUserAgent = nil
            print("🔄 Swift: User-Agent reset to default")
        }
    }


    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Override point for customization after page loads
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Handle console.log messages
        if message.name == "consoleLog" {
            print("📱 JS Console:", message.body)
            return
        }

        print("Received message from JavaScript: \(message.body)")

        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            print("Invalid message format")
            return
        }

        print("Action: \(action)")

        switch action {
        case "login":
            if let serverUrl = body["serverUrl"] as? String,
               let email = body["email"] as? String,
               let password = body["password"] as? String {
                print("Login attempt - Server: \(serverUrl), Email: \(email)")
                handleOpenPIMSLogin(serverUrl: serverUrl, email: email, password: password)
            } else {
                print("Missing login parameters")
                sendLoginResponse(success: false, error: "Fehlende Anmeldedaten", token: nil)
            }
        case "logout":
            print("Logout request")
            handleLogout()
        default:
            print("Unknown action: \(action)")
            break
        }
    }

    private func handleOpenPIMSLogin(serverUrl: String, email: String, password: String) {
        print("OpenPIMS login attempt for: \(email) at \(serverUrl)")

        guard let url = URL(string: serverUrl) else {
            sendLoginResponse(success: false, error: "Ungültige Server-URL", token: nil)
            return
        }

        // Create Basic Auth credentials like in the Desktop Extension
        let loginString = "\(email):\(password)"
        guard let loginData = loginString.data(using: .utf8) else {
            sendLoginResponse(success: false, error: "Fehler beim Erstellen der Authentifizierung", token: nil)
            return
        }
        let base64LoginString = loginData.base64EncodedString()

        // Create URL request with Basic Auth
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Basic \(base64LoginString)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30.0

        // Perform the login request
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("Login error: \(error.localizedDescription)")
                    self?.sendLoginResponse(success: false, error: "Verbindungsfehler: \(error.localizedDescription)", token: nil)
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.sendLoginResponse(success: false, error: "Ungültige Server-Antwort", token: nil)
                    return
                }

                if httpResponse.statusCode == 200 {
                    // Success - get the token from response body
                    if let data = data,
                       let token = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !token.isEmpty {

                        print("OpenPIMS login successful, token received")

                        // Store login data in UserDefaults
                        UserDefaults.standard.set(email, forKey: "openPimsEmail")
                        UserDefaults.standard.set(serverUrl, forKey: "openPimsServerUrl")
                        UserDefaults.standard.set(token, forKey: "openPimsToken")
                        UserDefaults.standard.set(true, forKey: "isLoggedIn")

                        // Update User-Agent directly
                        self?.setupUserAgent()

                        self?.sendLoginResponse(success: true, error: nil, token: token)
                    } else {
                        self?.sendLoginResponse(success: false, error: "Kein gültiger Token vom Server erhalten", token: nil)
                    }
                } else {
                    let errorMessage: String
                    switch httpResponse.statusCode {
                    case 401:
                        errorMessage = "Ungültige Anmeldedaten"
                    case 403:
                        errorMessage = "Zugriff verweigert"
                    case 404:
                        errorMessage = "Server nicht gefunden"
                    case 500...599:
                        errorMessage = "Server-Fehler (\(httpResponse.statusCode))"
                    default:
                        errorMessage = "Login fehlgeschlagen (\(httpResponse.statusCode))"
                    }
                    print("Login failed with status: \(httpResponse.statusCode)")
                    self?.sendLoginResponse(success: false, error: errorMessage, token: nil)
                }
            }
        }.resume()
    }

    private func sendLoginResponse(success: Bool, error: String?, token: String?) {
        var responseData: [String: Any] = [
            "success": success
        ]

        if let error = error {
            responseData["error"] = error
        }

        if let token = token {
            responseData["token"] = token
        }

        // Send response back to WebView using the global handler
        let script = """
            console.log('Swift sending response:', \(jsonString(from: responseData)));
            if (window.handleLoginResponse) {
                window.handleLoginResponse(\(jsonString(from: responseData)));
            } else {
                console.error('No handleLoginResponse function found');
            }
        """

        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("Error sending login response: \(error)")
                } else {
                    print("Login response sent successfully")
                }
            }
        }
    }

    private func handleLogout() {
        print("User logged out")
        // Clear login state from UserDefaults
        UserDefaults.standard.removeObject(forKey: "openPimsEmail")
        UserDefaults.standard.removeObject(forKey: "openPimsServerUrl")
        UserDefaults.standard.removeObject(forKey: "openPimsToken")
        UserDefaults.standard.set(false, forKey: "isLoggedIn")

        // Reset User-Agent to default
        setupUserAgent()
    }

    private func jsonString(from dictionary: [String: Any]) -> String {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: dictionary, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return "{}"
        }
        return jsonString
    }

}
