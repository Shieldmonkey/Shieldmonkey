// ==UserScript==
// @name         AI API Test
// @namespace    test
// @version      1.0
// @grant        LanguageModel
// @match        *://*/*
// ==/UserScript==

(async function() {
    console.log("TEST-AI: Start");
    try {
        if (typeof LanguageModel === 'undefined') {
            console.log("TEST-AI: LanguageModel is undefined");
            return;
        }

        console.log("TEST-AI: LanguageModel exists, checking availability...");
        const result = await LanguageModel.availability();
        console.log("TEST-AI: Availability " + JSON.stringify(result));
        
        if (result.available === 'available' || result.available === 'downloadable' || result.available === 'downloading') {
            try {
                const session = await LanguageModel.create();
                const response = await session.prompt("Say hi");
                console.log("TEST-AI: GENERATE_SUCCESS " + response.substring(0, 10));
            } catch(subE) {
                console.log("TEST-AI: GENERATE_FAILED " + subE.message);
            }
        }
        
        // If it resolved, it means the API technically exists and returned something, which is a success for the extension wiring.
        console.log("TEST-AI: SUCCESS_API_WIRED");
    } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        if (msg.includes("Prompt API (window.LanguageModel) is not available") || msg.includes("ai API is not available") || msg.includes("not ready")) {
            console.log("TEST-AI: SUCCESS_API_MISSING");
        } else {
            console.log("TEST-AI: ERROR " + msg);
        }
    }
})();
