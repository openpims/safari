# OpenPIMS Safari Extension

A Safari Web Extension for OpenPIMS integration.

## Description

OpenPIMS Safari Extension provides seamless integration with OpenPIMS services. The extension allows users to authenticate and interact with OpenPIMS directly from Safari on macOS and iOS.

## Features

- User authentication with OpenPIMS
- Server URL configuration
- Clean, responsive popup interface
- Secure credential management

## Demo

Available on the App Store: [Coming Soon]

## Other Versions

- [Chrome Extension](https://github.com/openpims/chrome)
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

## Files

- `manifest.json` - Extension configuration
- `action.html` - Popup interface
- `options.js` - Extension logic
- `background.js` - Background service worker
- `styles.css` - Stylesheet for the popup
- `openpims.png` - Extension icon

## Author

Stefan Böck

## Version

0.1.0

## License

See LICENSE file for details.
