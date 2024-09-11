function verifyPlyrid(plyrid) {
    // Convert plyrid to lowercase
    plyrid = plyrid.toLowerCase();

    // Check length conditions
    if (plyrid.length < 5 || plyrid.length > 32) {
        return false;
    }

    // Check characters and ensure dash is not at the beginning or end and no consecutive dashes
    if (!/^[a-z0-9](?!.*--)[a-z0-9-]*[a-z0-9]$/.test(plyrid)) {
        return false;
    }

    // Ensure plyrid contains at least one alphabetic character
    if (!/[a-z]/.test(plyrid)) {
        return false;
    }

    // Check if plyrid is not all numbers
    if (/^\d+$/.test(plyrid)) {
        return false;
    }

    // Return lowercase plyrid if all checks pass
    return plyrid;
}

const DEFAULT_AVATR = 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR';

function getAvatarUrl(avatar) {
    if (!avatar) {
        return DEFAULT_AVATR;
    }
    return avatar.startsWith('ipfs://') ? 'https://ipfs.plyr.network/ipfs/' + avatar.slice(7) : avatar;
}

const cache2fa = {};

function is2faUsed(plyrid, token) {
    const key = `${plyrid}-${token}`;
    if (cache2fa[key]) {
        if (cache2fa[key] + 60 * 5 * 1000 < Date.now()) {
            delete cache2fa[key];
            return false;
        }
        return true;
    }
    cache2fa[key] = Date.now();
    return false;
}

module.exports = { verifyPlyrid, getAvatarUrl, is2faUsed };