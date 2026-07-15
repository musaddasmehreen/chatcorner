const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const {search, replace} of replacements) {
        if (typeof search === 'string') {
            content = content.split(search).join(replace); // globally replace exact strings
        } else {
            content = content.replace(search, replace);
        }
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("[DUPLICATE-FIX] Updated " + filePath);
    }
}

const projects = [
    'C:\\\\Users\\\\HP\\\\.gemini\\\\antigravity\\\\scratch\\\\chatcorner',
    'C:\\\\Users\\\\HP\\\\.gemini\\\\antigravity\\\\scratch\\\\chatcorner-android\\\\www',
    'C:\\\\Users\\\\HP\\\\.gemini\\\\antigravity\\\\scratch\\\\chatcorner-android\\\\android\\\\app\\\\src\\\\main\\\\assets\\\\public'
];

// Phase 1: Fix duplicates
for (const proj of projects) {
    replaceInFile(proj + '/js/config.js', [
        { search: "const sbClient = window.sbClient;", replace: "var sbClient = window.sbClient;" },
        { search: "const POST_LOGIN_REDIRECT_KEY = ", replace: "var POST_LOGIN_REDIRECT_KEY = " }
    ]);

    replaceInFile(proj + '/js/chat-v3.js', [
        { search: /function randomColor\(\) \{\s*const colors = \['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1'\];\s*return colors\[Math\.floor\(Math\.random\(\) \* colors\.length\)\];\s*\}\s*/g, replace: "" },
        { search: "window.isUserIgnored = isUserIgnored;\nwindow.setUserIgnored = setUserIgnored;", replace: "" },
        { search: "window.toggleRadioControls = toggleRadioControls;", replace: "" },
        { search: "window.onRadioCategoryChange = onRadioCategoryChange;", replace: "" },
        { search: "window.stopRadioPlayer = stopRadioPlayer;", replace: "" },
        { search: "window.onRadioVolumeChange = onRadioVolumeChange;", replace: "" },
        { search: "window.toggleRadioMute = toggleRadioMute;", replace: "" },
        { search: "window.clearScreenLocally = clearScreenLocally;", replace: "" },
        { search: "window.enterIPTVRoom = enterIPTVRoom;", replace: "" },
        { search: "window.exitIPTVRoom = exitIPTVRoom;", replace: "" },
        { search: "window.exitIPTVRoomAndShowRooms = exitIPTVRoomAndShowRooms;", replace: "" },
        { search: "window.closeRoomPasswordPrompt = closeRoomPasswordPrompt;", replace: "" },
        { search: "window.closeRoomLockSetup = closeRoomLockSetup;", replace: "" },
        { search: "window.handleMenuLockToggle = handleMenuLockToggle;", replace: "" },
        { search: "window.showRoomContextMenu = showRoomContextMenu;", replace: "" },
        { search: "window.enterLudoRoom = enterLudoRoom;", replace: "" },
        { search: "window.exitLudoRoom = exitLudoRoom;", replace: "" }
    ]);

    replaceInFile(proj + '/js/pm.js', [
        { search: "window.stopPmRealtime = stopPmRealtime;", replace: "" },
        { search: "window.refreshPmIgnoreState = refreshPmIgnoreState;", replace: "" }
    ]);
}
