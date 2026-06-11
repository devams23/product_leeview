# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeeView (`product_leeview`) is a Chrome browser extension currently in early development. It uses Chrome Extension Manifest V3.

## Project Structure

- `app/client_browser_extension/` — Chrome extension source files
  - `manifest.json` — Extension manifest (V3), defines permissions and popup behavior
  - `popup.html` — Extension popup UI

## Development Workflow

### Loading the Extension (Local Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `app/client_browser_extension/` directory
4. The extension will appear in your toolbar; click it to test the popup

### Making Changes

- Edit files in `app/client_browser_extension/` directly — no build step is currently configured
- After saving changes, click the refresh icon on the extension card at `chrome://extensions/` to reload
- For `manifest.json` changes, the extension must be reloaded manually

## Architecture Notes

- **Manifest V3**: The extension follows Chrome's Manifest V3 format. Key implications:
  - Service workers are used for background scripts (not persistent background pages)
  - Content security policy is stricter than V2
  - `activeTab` permission is currently granted for accessing the current tab when the user invokes the extension

## Current State

This is a minimal starter extension with a single popup. Build tooling, testing, and CI are not yet configured.
