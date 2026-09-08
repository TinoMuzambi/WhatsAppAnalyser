# WhatsApp Chat Analyser

A privacy-first, browser-based dashboard for exploring exported WhatsApp conversations. Parsing and analysis happen entirely on the device: chat text is never uploaded or stored.

**Live app:** [whatsapp-analyser.vercel.app](https://whatsapp-analyser.vercel.app)

## Features

- Paste an export or open a `.txt` file
- Supports common iOS and Android export formats
- Works with individual and group chats
- Summarises messages, words, participants, active days, top contributors, common words, and activity by hour
- Ignores WhatsApp system events and media placeholders
- Uses no analytics, cookies, network requests, or runtime dependencies

In WhatsApp, open a chat, choose **Export chat**, and select **Without media**. The export remains in your browser for the current page session only.

## Develop

Serve the repository with any static file server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Test

```bash
npm test
```

The parser tests run with Node's built-in test runner; there are no packages to install.
