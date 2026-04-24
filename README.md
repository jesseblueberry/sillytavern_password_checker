# Blue PIN Lock

A SillyTavern UI extension that blocks the screen on startup and whenever the tab loses focus, then unlocks with the 4-character PIN `f1nn`.

After three wrong attempts, it locks for 5 minutes. The lockout timestamp is stored in `localStorage`, so refreshing the tab does not skip the timer.

## Install

Place this folder in either:

- `SillyTavern/public/scripts/extensions/third-party/blue-pin-lock`
- `SillyTavern/data/<your-user-handle>/extensions/blue-pin-lock`

Then restart or reload SillyTavern and enable the extension if needed.

## PIN

The current PIN is set near the top of `index.js`:

```js
const PIN_CODE = 'f1nn';
```

This is a client-side privacy lock, not serious cryptographic security. Anyone with direct file/devtools access can read or change it.
