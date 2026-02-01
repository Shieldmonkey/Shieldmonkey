// ==UserScript==
// @name        Token Validation Test
// @namespace   http://tampermonkey.net/
// @version     1.0
// @description Test script for token validation
// @author      ShieldMonkey
// @match       https://shieldmonkey.github.io/Shieldmonkey/*
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

(async function() {
    'use strict';

    console.log("Token Validation Test Script Running");

    try {
        await GM_setValue("testKey", "testValue");
        const val = await GM_getValue("testKey");
        if (val === "testValue") {
            console.log("[PASS] Initial GM_setValue/getValue success");
        } else {
            console.error("[FAIL] Initial GM_getValue mismatch");
        }
    } catch (e) {
        console.error("[FAIL] Initial GM operation failed: " + e.message);
    }

    // Expose a function via event listener (since window is isolated)
    window.addEventListener('TryGMCall', async function() {
        console.log("tryGMCall started via event");
        try {
            await GM_setValue("testKey2", "testValue2");
            console.log("[UNEXPECTED] GM_setValue succeeded after invalidation");
        } catch (e) {
            if (e.includes("Access denied") || e.includes("Invalid script token")) {
                console.log("[PASS] GM_setValue failed as expected: " + e);
            } else {
                console.log("[FAIL] GM_setValue failed with unexpected error: " + e);
            }
        }
    });
})();
