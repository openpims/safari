# OpenPIMS Safari Extension - Development Guide

## Project Overview

Safari Web Extension for macOS and iOS that blocks cookie banners by modifying the User-Agent header with domain-specific OpenPIMS URLs.

## Architecture

### Shared Codebase Strategy
- **macOS Extension** (`OpenPIMS Extension/Resources/`)
- **iOS Extension** (`OpenPIMS Mobil Extension/Resources/`)
- Both extensions share the same JavaScript code with minimal platform-specific differences
- Single source of truth for background.js, popup.js, popup.html, popup.css

### Key Differences Between Platforms

#### macOS Extension
- Uses `declarativeNetRequest` API for User-Agent modification
- Creates **domain-specific** User-Agent rules per website
- Content script only for logging
- Manifest V3 with `persistent` background (default)

#### iOS Extension
- iOS app (`OpenPIMS Mobil/ViewController.swift`) sets `WKWebView.customUserAgent`
- **Global** User-Agent applied to all requests in the app's WebView
- Content script only for logging
- Manifest V3 with `"persistent": false` (required for iOS)

## Technical Implementation

### User-Agent Modification

#### Desktop (macOS)
```javascript
// background.js uses declarativeNetRequest to create domain-specific rules
await browser.declarativeNetRequest.updateDynamicRules({
    addRules: [{
        id: ruleId,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{
                header: 'User-Agent',
                operation: 'set',
                value: `Mozilla/5.0... OpenPIMS/1.0 (+https://${subdomain}.${appDomain})`
            }]
        },
        condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', ...]
        }
    }]
});
```

#### Mobile (iOS)
```swift
// ViewController.swift sets global User-Agent for WKWebView
let customUserAgent = "Mozilla/5.0... OpenPIMS/1.0 (+\(url))"
self.webView.customUserAgent = customUserAgent
```

### Domain-Specific Subdomain Generation

Uses HMAC-SHA256 with daily rotation:

```javascript
async function generateDeterministicSubdomain(userId, visitedDomain, secret, appDomain) {
    const dayTimestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const message = `${userId}-${visitedDomain}-${dayTimestamp}`;

    // HMAC-SHA256 with user's secret key
    const subdomain = await hmacSha256(message, secret);
    return `${subdomain}.${appDomain}`;
}
```

**Input**: `userId + visitedDomain + dayTimestamp`
**Key**: User's secret token (from server)
**Output**: 32-character hex subdomain (DNS compliant)
**Result**: `https://{subdomain}.openpims.de`

### Storage Synchronization

Login state stored in `browser.storage.local`:
- `userId` - User identifier
- `secret` - HMAC secret key
- `appDomain` - OpenPIMS domain (e.g., "openpims.de")
- `isLoggedIn` - Boolean login state

Both extensions and native apps sync via storage listeners:
```javascript
browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isLoggedIn) {
        if (changes.isLoggedIn.newValue === true) {
            // Create rules for all open tabs on login
        } else {
            // Remove all rules on logout
        }
    }
});
```

## File Structure

```
safari/                                # Project root (flat structure)
├── .git/
├── .gitignore
├── README.md
├── CLAUDE.md                          # This file (gitignored)
│
├── OpenPIMS.xcodeproj/                # Xcode project
│   ├── project.pbxproj                # Project configuration
│   └── xcshareddata/
│
├── OpenPIMS/                          # macOS App
│   ├── ViewController.swift           # Main macOS app UI
│   ├── AppDelegate.swift              # macOS app lifecycle
│   ├── Assets.xcassets/               # macOS app icons
│   ├── Resources/
│   │   ├── en.lproj/Main.html         # macOS app HTML UI
│   │   ├── Script.js                  # macOS app JavaScript
│   │   └── Style.css                  # macOS app styles
│   ├── en.lproj/Main.storyboard       # macOS storyboard
│   └── openPIMS.entitlements          # macOS entitlements
│
├── OpenPIMS Extension/                # macOS Extension
│   ├── SafariWebExtensionHandler.swift
│   ├── Info.plist
│   ├── openPIMS_Extension.entitlements
│   └── Resources/
│       ├── manifest.json              # Extension manifest
│       ├── background.js              # declarativeNetRequest + HMAC
│       ├── popup.html                 # Popup UI
│       ├── popup.js                   # Login flow
│       ├── popup.css                  # Popup styling
│       ├── content.js                 # Logging only
│       ├── _locales/                  # Localization
│       └── images/                    # Extension icons
│           ├── openpims.png
│           ├── openpims_48.png
│           ├── openpims_96.png
│           ├── openpims_128.png
│           ├── openpims_256.png
│           └── openpims_512.png
│
├── OpenPIMS Mobil/                    # iOS App
│   ├── ViewController.swift           # WKWebView + User-Agent setup
│   ├── AppDelegate.swift              # iOS app lifecycle
│   ├── SceneDelegate.swift            # Scene lifecycle
│   ├── Assets.xcassets/               # iOS app icons
│   ├── Resources/
│   │   ├── Base.lproj/Main.html       # iOS app HTML UI
│   │   └── Style.css                  # iOS app styles
│   ├── Base.lproj/
│   │   ├── Main.storyboard            # iOS main storyboard
│   │   └── LaunchScreen.storyboard    # iOS launch screen
│   └── Info.plist                     # iOS app Info.plist
│
├── OpenPIMS Mobil Extension/          # iOS Extension
│   ├── SafariWebExtensionHandler.swift
│   ├── Info.plist
│   └── Resources/
│       ├── manifest.json              # Extension manifest (persistent: false)
│       ├── background.js              # SHARED with macOS
│       ├── popup.html                 # SHARED with macOS
│       ├── popup.js                   # SHARED with macOS
│       ├── popup.css                  # SHARED with macOS
│       ├── content.js                 # Logging only
│       ├── _locales/                  # Localization
│       └── images/                    # Extension icons (same as macOS)
│
├── OpenPIMSTests/                     # macOS Tests
├── OpenPIMSUITests/                   # macOS UI Tests
├── OpenPIMS MobilTests/               # iOS Tests
└── OpenPIMS MobilUITests/             # iOS UI Tests
```

**Key Points**:
- **Flat structure**: All folders at same level (no nested OpenPIMS/OpenPIMS)
- **Shared code**: Extensions share background.js, popup.*, content.js
- **Platform differences**: Only manifest.json (persistent flag) and User-Agent implementation differ

## Build System

### Version Management
```bash
# Set marketing version (CFBundleShortVersionString)
agvtool new-marketing-version 1.1

# Set build number (CFBundleVersion)
agvtool new-version -all 11
```

### Building

**Working Directory**: `/Users/portalix/Projects/safari/`

#### macOS
```bash
cd /Users/portalix/Projects/safari
xcodebuild -project OpenPIMS.xcodeproj \
    -scheme "OpenPIMS" \
    -configuration Release \
    build
```

#### iOS
```bash
cd /Users/portalix/Projects/safari
xcodebuild -project OpenPIMS.xcodeproj \
    -scheme "OpenPIMS Mobil" \
    -configuration Release \
    -sdk iphonesimulator \
    build
```

## Code Evolution

### Removed Features (as of 2025-10-07)

#### ❌ X-OpenPIMS HTTP Header
- **Removed**: HTTP header injection in content.js
- **Reason**: Redundant - declarativeNetRequest handles User-Agent for ALL requests automatically
- **Previously**: Only worked for fetch()/XHR, required override code

#### ❌ Cookie-Based Approach
- **Removed**: `setOpenPIMSCookie()` and `removeOpenPIMSCookie()` functions
- **Reason**: Cookie is a forbidden header in Safari, not reliable
- **Previously**: iOS used cookie approach, removed 57 lines from ViewController.swift

### Current Implementation
- ✅ **User-Agent modification only**
- ✅ macOS: Domain-specific via declarativeNetRequest
- ✅ iOS: Global via WKWebView.customUserAgent
- ✅ Content script: Logging only, no header manipulation

## Permissions

### Required Permissions
```json
{
    "permissions": [
        "declarativeNetRequest",
        "declarativeNetRequestWithHostAccess",
        "storage",
        "webNavigation",
        "tabs"
    ]
}
```

- `declarativeNetRequest` - User-Agent modification on macOS
- `storage` - Store login credentials and state
- `webNavigation` - Detect navigation for rule creation
- `tabs` - Query open tabs on login to create rules

## Common Issues

### Multiple Info.plist Commands Error
**Problem**: Xcode builds fail with "Multiple commands produce Info.plist"

**Solution**: Add exception in project.pbxproj:
```
AF310A462E7B573400721E0E /* Exceptions */ = {
    isa = PBXFileSystemSynchronizedBuildFileExceptionSet;
    membershipExceptions = (
        Info.plist,
    );
    target = AF310A272E7B573400721E0E /* OpenPIMS Mobil Extension */;
};
```

### App Store Version Validation
**Problem**: "CFBundleShortVersionString must be higher than previously approved version"

**Solution**: Use agvtool to increment version:
```bash
agvtool new-marketing-version 1.1
agvtool new-version -all 11
```

## Testing

1. Build both macOS and iOS targets
2. Enable extension in Safari → Settings → Extensions
3. Click extension icon, enter credentials
4. Visit websites, verify User-Agent in DevTools
5. Check Console for logging messages

## Git Workflow

### Ignored Files (.gitignore)
```
.DS_Store
*.xcuserstate
xcuserdata/
DerivedData/
*.xcodeproj/project.xcworkspace/xcuserdata/
```

### Clean State
```bash
# Remove all .DS_Store files
find . -name ".DS_Store" -delete

# Remove Xcode user state
git rm --cached *.xcuserstate
```

## Version History

- **1.1 (Build 11)** - 2025-10-07
  - Removed X-OpenPIMS HTTP header injection (redundant with User-Agent)
  - Removed cookie-based approach (forbidden header in Safari)
  - Simplified content.js to logging only (35 lines vs 203 lines)
  - Flattened project structure (moved from OpenPIMS/OpenPIMS to safari/)
  - Removed duplicate icon files (icon-*.png, toolbar-icon.svg)
  - Updated README.md and created CLAUDE.md

- **1.0 (Build 10)** - Initial App Store release
  - Deterministic subdomain generation with HMAC-SHA256
  - declarativeNetRequest for macOS User-Agent modification
  - WKWebView customUserAgent for iOS
  - Shared codebase between macOS and iOS extensions
