const EXTENSION_NAME = 'blue-pin-lock';
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;

const STORAGE_KEYS = {
    pin: `${EXTENSION_NAME}:pin`,
    lockedUntil: `${EXTENSION_NAME}:lockedUntil`,
    attempts: `${EXTENSION_NAME}:attempts`,
};

let overlay;
let input;
let statusText;
let attemptText;
let countdownText;
let digits = [];
let countdownTimer;
let isUnlocked = false;
let isInitialized = false;
let setupPin = '';

function getPin() {
    return localStorage.getItem(STORAGE_KEYS.pin);
}

function setPin(pin) {
    localStorage.setItem(STORAGE_KEYS.pin, pin);
}

function hasPin() {
    return Boolean(getPin());
}

function getLockedUntil() {
    return Number(localStorage.getItem(STORAGE_KEYS.lockedUntil) || 0);
}

function setLockedUntil(timestamp) {
    localStorage.setItem(STORAGE_KEYS.lockedUntil, String(timestamp));
}

function clearLockedUntil() {
    localStorage.removeItem(STORAGE_KEYS.lockedUntil);
}

function getAttempts() {
    const attempts = Number(localStorage.getItem(STORAGE_KEYS.attempts) || 0);
    return Math.max(0, Math.min(MAX_ATTEMPTS, attempts));
}

function setAttempts(attempts) {
    localStorage.setItem(STORAGE_KEYS.attempts, String(attempts));
}

function clearAttempts() {
    localStorage.removeItem(STORAGE_KEYS.attempts);
}

function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function isLockoutActive() {
    return getLockedUntil() > Date.now();
}

function setStatus(message, mode = 'info') {
    statusText.textContent = message;
    overlay.dataset.pinState = mode;
}

function updateDigits(value = input.value) {
    digits.forEach((digit, index) => {
        digit.textContent = value[index] ? '•' : '';
        digit.classList.toggle('is-filled', Boolean(value[index]));
    });
}

function clearEntry() {
    input.value = '';
    updateDigits('');
}

function updateAttemptText(attemptsRemaining) {
    if (attemptsRemaining === '') {
        attemptText.textContent = '';
        return;
    }

    attemptText.textContent = `${attemptsRemaining} ${attemptsRemaining === 1 ? 'try' : 'tries'} left`;
}

function stopCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = undefined;
    }
}

function updateLockoutDisplay() {
    const remaining = getLockedUntil() - Date.now();

    if (remaining <= 0) {
        stopCountdown();
        clearLockedUntil();
        overlay.classList.remove('is-locked-out');
        input.disabled = false;
        input.focus({ preventScroll: true });
        setStatus('Okay, try again. Carefully this time.', 'info');
        clearAttempts();
        updateAttemptText(MAX_ATTEMPTS);
        countdownText.textContent = '';
        return;
    }

    overlay.classList.add('is-locked-out');
    input.disabled = true;
    clearEntry();
    setStatus('Too many guesses. Locked for 5 minutes.', 'error');
    countdownText.textContent = formatRemaining(remaining);
    updateAttemptText(0);
}

function showLockout() {
    updateLockoutDisplay();
    stopCountdown();
    countdownTimer = setInterval(updateLockoutDisplay, 500);
}

function startLockout() {
    setLockedUntil(Date.now() + LOCKOUT_MS);
    clearAttempts();
    showLockout();
}

function showLock(reason = 'startup') {
    if (!overlay) {
        return;
    }

    isUnlocked = false;
    document.documentElement.classList.add('blue-pin-lock-active');
    overlay.hidden = false;
    overlay.dataset.reason = reason;
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    if (!hasPin()) {
        showSetup();
        return;
    }

    if (isLockoutActive()) {
        showLockout();
        return;
    }

    stopCountdown();
    overlay.classList.remove('is-locked-out', 'is-shaking');
    overlay.dataset.mode = 'unlock';
    input.disabled = false;
    clearEntry();
    updateAttemptText(MAX_ATTEMPTS - getAttempts());
    countdownText.textContent = '';
    overlay.querySelector('.bpl-kicker').textContent = 'SillyTavern is sealed';
    overlay.querySelector('#blue-pin-lock-title').textContent = 'PIN required';
    overlay.querySelector('.bpl-copy').textContent = 'Four characters. Three chances. No pressure, obviously.';
    overlay.querySelector('.bpl-submit').textContent = 'Unlock';
    input.setAttribute('aria-label', 'PIN code');
    setStatus(reason === 'focus-return' ? 'Welcome back. PIN, please.' : 'Enter your PIN to unlock SillyTavern.', 'info');
    setTimeout(() => input.focus({ preventScroll: true }), 150);
}

function showSetup(confirming = false) {
    stopCountdown();
    overlay.classList.remove('is-locked-out', 'is-shaking');
    overlay.dataset.mode = confirming ? 'setup-confirm' : 'setup';
    input.disabled = false;
    clearEntry();
    updateAttemptText('');
    countdownText.textContent = '';
    overlay.querySelector('.bpl-kicker').textContent = 'First run setup';
    overlay.querySelector('#blue-pin-lock-title').textContent = confirming ? 'Confirm PIN' : 'Choose PIN';
    overlay.querySelector('.bpl-copy').textContent = confirming
        ? 'Type it one more time so future-you does not get betrayed.'
        : 'Pick any four letters or numbers. Keep it memorable.';
    overlay.querySelector('.bpl-submit').textContent = confirming ? 'Save PIN' : 'Continue';
    input.setAttribute('aria-label', confirming ? 'Confirm new PIN' : 'New PIN');
    setStatus(confirming ? 'Confirm the same four characters.' : 'Choose your four-character passcode.', 'info');
    setTimeout(() => input.focus({ preventScroll: true }), 150);
}

function hideLock() {
    isUnlocked = true;
    stopCountdown();
    overlay.classList.remove('is-visible', 'is-shaking');
    document.documentElement.classList.remove('blue-pin-lock-active');
    setTimeout(() => {
        if (isUnlocked) {
            overlay.hidden = true;
        }
    }, 240);
}

function shake() {
    overlay.classList.remove('is-shaking');
    void overlay.offsetWidth;
    overlay.classList.add('is-shaking');
}

function submitPin() {
    if (overlay.dataset.mode !== 'setup' && overlay.dataset.mode !== 'setup-confirm' && isLockoutActive()) {
        updateLockoutDisplay();
        return;
    }

    const value = input.value.toLowerCase();

    if (value.length !== PIN_LENGTH) {
        shake();
        setStatus('Four characters. I believe in you, tragically.', 'error');
        input.focus({ preventScroll: true });
        return;
    }

    if (overlay.dataset.mode === 'setup') {
        setupPin = value;
        showSetup(true);
        return;
    }

    if (overlay.dataset.mode === 'setup-confirm') {
        if (value !== setupPin) {
            setupPin = '';
            shake();
            showSetup(false);
            setStatus('Those did not match. Fresh start, because betrayal hurts.', 'error');
            return;
        }

        setPin(value);
        setupPin = '';
        clearAttempts();
        clearLockedUntil();
        setStatus('PIN saved. You are in.', 'success');
        setTimeout(hideLock, 220);
        return;
    }

    const attempts = getAttempts() + 1;
    setAttempts(attempts);

    if (value === getPin()) {
        clearAttempts();
        clearLockedUntil();
        setStatus('Unlocked. Go make questionable chat decisions.', 'success');
        setTimeout(hideLock, 180);
        return;
    }

    const attemptsRemaining = MAX_ATTEMPTS - attempts;
    shake();
    clearEntry();

    if (attemptsRemaining <= 0) {
        startLockout();
        return;
    }

    updateAttemptText(attemptsRemaining);
    setStatus('Nope. That is not the magic nonsense.', 'error');
    input.focus({ preventScroll: true });
}

function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'blue-pin-lock';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'blue-pin-lock-title');

    overlay.innerHTML = `
        <div class="bpl-stars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
        </div>
        <section class="bpl-panel">
            <p class="bpl-kicker">SillyTavern is sealed</p>
            <h1 id="blue-pin-lock-title">PIN required</h1>
            <p class="bpl-copy">Four characters. Three chances. No pressure, obviously.</p>
            <div class="bpl-digits" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
            </div>
            <input
                class="bpl-input"
                inputmode="text"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                maxlength="4"
                aria-label="PIN code"
            >
            <button class="bpl-submit" type="button">Unlock</button>
            <p class="bpl-status" aria-live="polite"></p>
            <div class="bpl-meta">
                <span class="bpl-attempts"></span>
                <span class="bpl-countdown" aria-live="polite"></span>
            </div>
        </section>
    `;

    document.body.appendChild(overlay);

    input = overlay.querySelector('.bpl-input');
    statusText = overlay.querySelector('.bpl-status');
    attemptText = overlay.querySelector('.bpl-attempts');
    countdownText = overlay.querySelector('.bpl-countdown');
    digits = Array.from(overlay.querySelectorAll('.bpl-digits span'));

    overlay.querySelector('.bpl-submit').addEventListener('click', submitPin);
    input.addEventListener('input', () => {
        input.value = input.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, PIN_LENGTH);
        updateDigits();

        if (input.value.length === PIN_LENGTH) {
            submitPin();
        }
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitPin();
        }
    });

    overlay.addEventListener('pointerdown', event => {
        if (event.target.closest('.bpl-digits') || event.target.closest('.bpl-panel')) {
            if (!event.target.closest('.bpl-submit')) {
                input.focus({ preventScroll: true });
            }
        }

        if (!event.target.closest('.bpl-panel')) {
            input.focus({ preventScroll: true });
            shake();
        }
    });
}

function bindFocusEvents() {
    window.addEventListener('blur', () => {
        if (isUnlocked) {
            showLock('window-blur');
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            showLock('tab-hidden');
            return;
        }

        if (!isUnlocked) {
            showLock('focus-return');
        }
    });

    window.addEventListener('focus', () => {
        if (!isUnlocked) {
            showLock('focus-return');
        }
    });
}

export function onActivate() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;
    createOverlay();
    bindFocusEvents();
    showLock('startup');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onActivate, { once: true });
} else {
    onActivate();
}
