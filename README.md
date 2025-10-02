# OpenPIMS Safari Extension

Automatic cookie banner blocking through domain-specific HMAC-SHA256 subdomain generation for Safari on macOS and iOS.

## Description

OpenPIMS Safari Extension blocks cookie banners by generating unique, domain-specific URLs using deterministic HMAC-SHA256 hashing. Each website you visit gets its own unique OpenPIMS identifier that rotates daily for enhanced privacy.

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
2. Open `OpenPIMS Safari Extension/OpenPIMS Safari Extension.xcodeproj` in Xcode
3. Build and run the project
4. Enable the extension in Safari → Settings → Extensions

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
- **Desktop Safari**: Uses declarativeNetRequest for User-Agent modification, content script overrides for headers
- **Mobile Safari**: Content script only implementation with fetch/XMLHttpRequest overrides

### Platform Capabilities
| Feature | Safari Desktop | Safari Mobile | Chromium | Firefox |
|---------|----------------|---------------|----------|---------|
| X-OpenPIMS Headers | ✅ | ✅ | ✅ | ✅ |
| Cookie Injection | ❌ | ✅ | ✅ | ✅ |
| User-Agent Modification | ✅ Domain-specific | ❌ | ✅ | ✅ |
| Implementation | declarativeNetRequest + content | content script only | Manifest V3 | Manifest V2 |

### API Response Format
```json
{
    "userId": "user123",
    "token": "secret_key_for_hmac",
    "domain": "openpims.de"
}
```

### Testing the API
```bash
curl -u "email@example.com:password" https://me.openpims.de
```

## Files

- `manifest.json` - Safari Web Extension manifest
- `background.js` - Background script with HMAC subdomain generation
- `action.html` - Popup interface (300px width)
- `options.js` - Login flow and storage management
- `styles.css` - Responsive popup styling
- `openpims.png` - Extension icon
- `content.js` - Content script for header/cookie injection

## Security

- **HMAC-SHA256** - Cryptographically secure subdomain generation
- **Daily Rotation** - Subdomains change every 24 hours
- **Domain Isolation** - Each website gets its own unique identifier
- **No Tracking** - No data collection or analytics
- **Local Processing** - All hashing done client-side

## Author

Stefan Böck

## Version

0.1.0

## License

See LICENSE file for details.
