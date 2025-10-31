# ⚠️ DEPRECATED - This repository is deprecated

## 🚨 This browser-specific repository is no longer maintained!

### ➡️ Please use the new unified repository instead:
## **https://github.com/openpims/extensions**

---

## Why the change?

We've migrated to a unified codebase that supports all browsers from a single repository:
- ✅ **One codebase** for Chrome, Firefox, Safari, Edge, Brave, Opera
- ✅ **Modern stack** with WXT framework and TypeScript
- ✅ **Easier maintenance** - updates apply to all browsers at once
- ✅ **Better performance** - 50% smaller bundle size
- ✅ **No more Xcode** for development (only for final packaging)

## Migration Guide

### For Users:
1. Uninstall the old Safari extension
2. Install the new extension from: [Coming Soon to App Store]
3. Your settings will be automatically migrated

### For Developers:
```bash
# Clone the new unified repository
git clone https://github.com/openpims/extensions.git
cd extensions

# Install dependencies
npm install

# Run development mode for Safari
npm run dev:safari

# Build for Safari
npm run build:safari

# Convert to Xcode project (for App Store submission)
xcrun safari-web-extension-converter .output/safari-mv2
```

## What's improved in v2.0?

- 🚀 No more Swift code needed - pure Web Extension
- 📦 Bundle size: 150KB → 76KB (49% smaller)
- 🔒 Better security with daily token rotation
- 🌐 Cross-browser compatibility from single codebase
- 📱 **Full iOS/iPadOS Safari support**
- ⚡ Faster development without Xcode

## Safari-specific improvements

- Native Web Extension (no Swift wrapper needed)
- iOS and iPadOS support out of the box
- Non-persistent background script for better battery life
- Maintained Manifest V2 compatibility
- Simplified development workflow

## Support

- New Repository: https://github.com/openpims/extensions
- Issues: https://github.com/openpims/extensions/issues
- Website: https://openpims.de

---

**This repository is archived and read-only. No further updates will be made here.**

Last version in this repository: v1.1.0
New unified version: v2.0.0+