 //
//  SafariWebExtensionHandler.swift
//  OpenPIMS Extension
//
//  Created by Stefan Böck on 12.09.25.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        // Handle different message types
        if let messageDict = message as? [String: Any] {
            if let action = messageDict["action"] as? String {
                switch action {
                case "login":
                    handleLogin(messageDict: messageDict, context: context)
                    return
                case "getOpenPimsUrl":
                    handleGetOpenPimsUrl(context: context)
                    return
                case "setHeaderRule":
                    handleSetHeaderRule(messageDict: messageDict, context: context)
                    return
                default:
                    break
                }
            }
        }

        // Default echo response
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: [ "echo": message ] ]
        } else {
            response.userInfo = [ "message": [ "echo": message ] ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }
    
    private func handleLogin(messageDict: [String: Any], context: NSExtensionContext) {
        guard let email = messageDict["email"] as? String,
              let password = messageDict["password"] as? String,
              let serverUrl = messageDict["serverUrl"] as? String else {
            sendErrorResponse("Missing login credentials", context: context)
            return
        }
        
        os_log(.default, "Processing login request for email: %@", email)
        
        guard let url = URL(string: serverUrl) else {
            sendErrorResponse("Invalid server URL", context: context)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Basic Auth
        let loginString = "\(email):\(password)"
        if let loginData = loginString.data(using: .utf8) {
            let base64LoginString = loginData.base64EncodedString()
            request.setValue("Basic \(base64LoginString)", forHTTPHeaderField: "Authorization")
        }
        
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.sendErrorResponse(error.localizedDescription, context: context)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.sendErrorResponse("Invalid response", context: context)
                    return
                }
                
                guard httpResponse.statusCode == 200 else {
                    let errorMsg = "Login failed with status \(httpResponse.statusCode)"
                    self?.sendErrorResponse(errorMsg, context: context)
                    return
                }
                
                guard let data = data,
                      let openPimsUrl = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) else {
                    self?.sendErrorResponse("No valid URL received from server", context: context)
                    return
                }
                
                // Store in UserDefaults
                UserDefaults.standard.set(openPimsUrl, forKey: "openPimsUrl")
                UserDefaults.standard.set(email, forKey: "email")
                UserDefaults.standard.set(serverUrl, forKey: "serverUrl")
                UserDefaults.standard.set(true, forKey: "isLoggedIn")
                
                os_log(.default, "Login successful, stored URL: %@", openPimsUrl)
                
                self?.sendSuccessResponse(["token": openPimsUrl], context: context)
            }
        }
        
        task.resume()
    }
    
    private func handleGetOpenPimsUrl(context: NSExtensionContext) {
        let isLoggedIn = UserDefaults.standard.bool(forKey: "isLoggedIn")
        let openPimsUrl = UserDefaults.standard.string(forKey: "openPimsUrl")
        let email = UserDefaults.standard.string(forKey: "email")
        let serverUrl = UserDefaults.standard.string(forKey: "serverUrl")
        
        let responseData: [String: Any] = [
            "isLoggedIn": isLoggedIn,
            "openPimsUrl": openPimsUrl ?? "",
            "email": email ?? "",
            "serverUrl": serverUrl ?? ""
        ]
        
        sendSuccessResponse(responseData, context: context)
    }
    
    private func handleSetHeaderRule(messageDict: [String: Any], context: NSExtensionContext) {
        guard let url = messageDict["url"] as? String else {
            sendErrorResponse("Missing URL for header rule", context: context)
            return
        }
        
        // Store the URL for header injection
        UserDefaults.standard.set(url, forKey: "currentHeaderUrl")
        os_log(.default, "Header rule set for URL: %@", url)
        
        sendSuccessResponse(["message": "Header rule updated"], context: context)
    }
    
    private func sendSuccessResponse(_ data: [String: Any], context: NSExtensionContext) {
        let response = NSExtensionItem()
        let responseData: [String: Any] = ["success": true, "data": data]
        
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseData]
        } else {
            response.userInfo = ["message": responseData]
        }
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    private func sendErrorResponse(_ error: String, context: NSExtensionContext) {
        let response = NSExtensionItem()
        let responseData: [String: Any] = ["success": false, "error": error]
        
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseData]
        } else {
            response.userInfo = ["message": responseData]
        }
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
