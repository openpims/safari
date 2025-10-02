//
//  SafariWebExtensionHandler.swift
//  OpenPIMS Mobil Extension
//
//  Created by Stefan Böck on 17.09.25.
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

        // Handle storage updates for User-Agent modification
        if let messageDict = message as? [String: Any],
           let action = messageDict["action"] as? String,
           action == "updateStorage" {

            let isLoggedIn = messageDict["isLoggedIn"] as? Bool ?? false
            let userId = messageDict["userId"] as? String
            let secret = messageDict["secret"] as? String
            let appDomain = messageDict["appDomain"] as? String

            // Store login state for extension access
            let sharedDefaults = UserDefaults(suiteName: "group.openPIMS.shared")
            sharedDefaults?.set(isLoggedIn, forKey: "isLoggedIn")

            if let uid = userId {
                sharedDefaults?.set(uid, forKey: "userId")
            } else {
                sharedDefaults?.removeObject(forKey: "userId")
            }

            if let sec = secret {
                sharedDefaults?.set(sec, forKey: "secret")
            } else {
                sharedDefaults?.removeObject(forKey: "secret")
            }

            if let domain = appDomain {
                sharedDefaults?.set(domain, forKey: "appDomain")
            } else {
                sharedDefaults?.removeObject(forKey: "appDomain")
            }

            os_log(.default, "Updated storage: logged in = %@, userId = %@", String(isLoggedIn), userId ?? "nil")
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: [ "echo": message ] ]
        } else {
            response.userInfo = [ "message": [ "echo": message ] ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
