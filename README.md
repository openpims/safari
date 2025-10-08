# OpenPIMS Safari Extension

Automatic cookie banner blocking through domain-specific HMAC-SHA256 subdomain generation for Safari on macOS and iOS.

## Description

OpenPIMS Safari Extension blocks cookie banners by modifying the User-Agent header with unique, domain-specific URLs using deterministic HMAC-SHA256 hashing. Each website you visit gets its own unique OpenPIMS identifier that rotates daily for enhanced privacy.

## Key Features

- **Automatic Cookie Banner Blocking** - No manual interaction needed
- **Domain-Specific Protection** - Each website gets a unique OpenPIMS URL
- **Daily Rotation** - Subdomains regenerate every 24 hours for privacy
- **HMAC-SHA256 Security** - Cryptographically secure subdomain generation
- **Cross-Platform** - Works on macOS and iOS
- **Zero Configuration** - Works immediately after login

## Demo

Available on the App Store: https://apps.apple.com/app/openpims/id6752671294

## Other Versions

- [Chromium Extension](https://github.com/openpims/chromium)
- [Firefox Extension](https://github.com/openpims/firefox)
- [mitmproxy Version](https://github.com/openpims/mitmproxy) - For users who prefer not to use browser extensions

## Installation

### Safari
1. Download from the Mac App Store or iOS App Store
2. Open the OpenPIMS Safari Extension app
3. Follow the instructions to enable the extension in Safari
4. Go to Safari → Settings → Extensions to enable OpenPIMS

### Development
1. Clone or download this repository
2. Open `OpenPIMS.xcodeproj` in Xcode
3. Select scheme: "OpenPIMS" (macOS) or "OpenPIMS Mobil" (iOS)
4. Build and run the project
5. Enable the extension in Safari → Settings → Extensions

## Usage

1. Click the OpenPIMS extension icon in the Safari toolbar
2. Enter your server URL (defaults to https://me.openpims.de)
3. Provide your email and password credentials
4. Click "Anmelden" to log in
5. The extension automatically blocks cookie banners on all websites

## Technical Details

### How It Works
The extension generates domain-specific subdomains using HMAC-SHA256:
- **Input**: `userId + visitedDomain + dayTimestamp`
- **Key**: User's secret token (from authentication)
- **Output**: 32-character hex subdomain (DNS compliant)
- **Result**: `https://{subdomain}.openpims.de` unique per domain

### Platform Implementation
- **Desktop Safari**: Uses declarativeNetRequest for User-Agent modification
- **Mobile Safari**: Uses WKWebView customUserAgent for User-Agent modification

### Platform Capabilities
| Feature | Safari Desktop | Safari Mobile | Chromium | Firefox |
|---------|----------------|---------------|----------|---------|
| User-Agent Modification | ✅ Domain-specific | ✅ Global | ✅ | ✅ |
| Implementation | declarativeNetRequest | WKWebView | Manifest V3 | Manifest V2 |

### API Response Format
```json
{
    "userId": "user123",
    "secret": "secret_key_for_hmac",
    "appDomain": "openpims.de"
}
```

**Note**: The token/secret is used exclusively for HMAC-SHA256 subdomain generation and is never displayed in the user interface.

### Testing the API
```bash
curl -u "email@example.com:password" https://me.openpims.de
```

## Project Structure

```
safari/
├── OpenPIMS.xcodeproj/              # Xcode project
├── OpenPIMS/                        # macOS App
│   ├── ViewController.swift         # Main app view controller
│   ├── AppDelegate.swift            # App lifecycle management
│   └── Resources/                   # App resources and UI
├── OpenPIMS Extension/              # macOS Extension
│   └── Resources/
│       ├── manifest.json            # Extension manifest
│       ├── background.js            # HMAC subdomain + declarativeNetRequest
│       ├── popup.html               # Popup UI
│       ├── popup.js                 # Login flow
│       ├── popup.css                # Popup styling
│       ├── content.js               # Logging only
│       └── images/                  # Extension icons
├── OpenPIMS Mobil/                  # iOS App
│   ├── ViewController.swift         # WKWebView + User-Agent setup
│   ├── AppDelegate.swift            # App lifecycle
│   ├── SceneDelegate.swift          # Scene lifecycle
│   └── Resources/                   # App resources and UI
├── OpenPIMS Mobil Extension/        # iOS Extension
│   └── Resources/
│       ├── manifest.json            # Extension manifest (persistent: false)
│       ├── background.js            # Shared with macOS
│       ├── popup.html               # Shared with macOS
│       ├── popup.js                 # Shared with macOS
│       ├── popup.css                # Shared with macOS
│       ├── content.js               # Logging only
│       └── images/                  # Extension icons
├── README.md
└── .gitignore
```

**Note**: macOS and iOS extensions share the same codebase with minimal platform-specific differences.

## Security

- **HMAC-SHA256** - Cryptographically secure subdomain generation
- **Daily Rotation** - Subdomains change every 24 hours
- **Domain Isolation** - Each website gets its own unique identifier
- **No Tracking** - No data collection or analytics
- **Local Processing** - All hashing done client-side

## Author

Stefan Böck

## Version

1.1 (Build 12)

## License

See LICENSE file for details.
