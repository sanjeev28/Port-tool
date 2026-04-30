    // ---------- DOM elements ----------
    const ipTextarea = document.getElementById('ipInput');
    const addHttpCheck = document.getElementById('addHttpCheckbox');
    const removeHttpCheck = document.getElementById('removeHttpCheckbox');
    const removePortCheck = document.getElementById('removePortCheckbox');
    const addPortCheck = document.getElementById('addPortCheckbox');
    const applyBtn = document.getElementById('applyBtn');
    const resetBtn = document.getElementById('resetToOriginalBtn');
    const clearBtn = document.getElementById('clearAllBtn');
    const copyBtn = document.getElementById('copyOutputBtn');
    const resultContainer = document.getElementById('resultContainer');

    // ---------- Store original raw lines to support reset ----------
    let originalLines = [];

    // Helper: update stored original from current textarea (without modifications)
    function captureOriginalFromTextarea() {
        const raw = ipTextarea.value;
        originalLines = raw.split(/\r?\n/);
    }

    // Initialize original on page load & also when user manually types? we'll capture on reset/load
    // But we also want to capture 'original' snapshot when resetting.
    function syncOriginalFromTextarea() {
        captureOriginalFromTextarea();
    }

    // Helper: display transformed lines array into result container
    function renderResults(linesArray) {
        if (!linesArray || linesArray.length === 0 || (linesArray.length === 1 && linesArray[0] === "")) {
            resultContainer.innerHTML = `<div style="color:#6a7aa5; text-align:center; padding:1rem;">✨ No output — add IPs and transform</div>`;
            return;
        }
        const filtered = linesArray.filter(l => l !== undefined);
        if (filtered.length === 0) {
            resultContainer.innerHTML = `<div style="color:#6a7aa5; text-align:center; padding:1rem;">📭 Empty list after transformation</div>`;
            return;
        }
        const html = filtered.map(line => {
            let displayLine = line || "(empty)";
            return `<div class="result-item">${escapeHtml(displayLine)}</div>`;
        }).join('');
        resultContainer.innerHTML = html;
    }

    // simple XSS escape for output
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    // ---------- Core transformation logic (bidirectional, flexible order) ----------
    // Function: apply modifications on a single line based on current checkbox states.
    // Order of operations is deterministic:
    // 1) Remove http:// if 'removeHttp' is checked
    // 2) Remove :31401 suffix if 'removePort' is checked
    // 3) Add :31401 suffix if 'addPort' is checked (only if port not already present)
    // 4) Prepend http:// if 'addHttp' is checked AND (if not already starting with http:// or https://)
    // But also need to be careful: after removing http:// we might later add it again – that's intended from UX.
    // Also vice versa: if user checks both removePort and addPort? Usually they conflict. UI design: we apply all checks in order:
    // Removal first then addition. This allows "replace" semantics if needed.
    // Additional caution: port removal should remove exact :31401 regardless of http presence.
    // Adding :31401 should append if not already ending with :31401 (case sensitive)
    // Adding http:// should not double-add.
    
    function transformSingleLine(rawLine) {
        let line = rawLine;
        if (line === undefined || line === null) return "";
        // Trim whitespaces but keep internal spaces? IPs don't need leading/trailing spaces.
        line = line.trim();
        if (line === "") return "";

        // 1) Remove http:// if flag enabled
        if (removeHttpCheck.checked) {
            // remove http:// prefix (case insensitive? HTTP strict, we keep exact 'http://' but also handle 'http://' lowercase)
            if (line.startsWith('http://')) {
                line = line.slice(7);
            } 
            // also optional treat HTTP? we treat http:// only, but user may mistakenly use HTTP? no biggie.
            // but for robust we also remove 'https://'? but spec says http://, keep as desired.
            // If there is https? but likely not needed, but for flexibility: we only remove http:// to match requirement.
        }

        // 2) Remove :31401 suffix if flag enabled
        if (removePortCheck.checked) {
            // remove trailing :31401 (must be exactly at end)
            if (line.endsWith(':31401')) {
                line = line.slice(0, -6); // remove last 6 chars ':31401'
            }
        }

        // 3) Add :31401 suffix if flag enabled
        if (addPortCheck.checked) {
            // avoid double port: if line already ends with :31401 then skip adding
            if (!line.endsWith(':31401')) {
                // Additionally, to be clean if the line already ends with colon and digits? but simple: append
                line = line + ':31401';
            }
        }

        // 4) Prepend http:// if addHttp flag enabled
        if (addHttpCheck.checked) {
            // avoid double http:// or https:// (but keep only http://)
            if (!line.startsWith('http://') && !line.startsWith('https://')) {
                line = 'http://' + line;
            }
        }

        // Final safety: if after all operations line becomes weird but it's fine.
        return line;
    }

    // Transform whole list based on current lines from textarea & flags.
    function getTransformedLines(sourceLinesArray) {
        return sourceLinesArray.map(line => transformSingleLine(line));
    }

    // Main apply: reads current textarea content, transforms each line according to checkboxes, displays result.
    function applyTransformationAndRender() {
        const rawText = ipTextarea.value;
        const lines = rawText.split(/\r?\n/);
        const transformed = getTransformedLines(lines);
        renderResults(transformed);
    }

    // Special: also we want to allow "vice versa" which is already covered: user can flag removal and addition combos in either direction.
    // Example: IP with :31401 + http:// can be reverted to plain IP by checking removePort and removeHttp. Vice versa: add both.
    
    // Reset: sets textarea content from the original snapshot (preserved when reset was last captured, or load)
    function resetToOriginal() {
        // originalLines holds the raw lines as of last capture
        const originalText = originalLines.join('\n');
        ipTextarea.value = originalText;
        // Re-transform after reset using current checkboxes
        applyTransformationAndRender();
    }
    
    // clear all fields: reset textarea and also clear result, but store empty original
    function clearEverything() {
        ipTextarea.value = '';
        originalLines = [''];
        renderResults([]);
    }

    // Update stored original lines whenever needed? User may want to set new base after manual edit.
    // We'll provide a 'soft capture' but also reset will capture automatically.
    function captureOriginalFromCurrentTextarea() {
        const currentRaw = ipTextarea.value;
        originalLines = currentRaw.split(/\r?\n/);
    }

    // Event: on apply, also update original? but reset must keep original point. Usually reset uses captured snapshot.
    // For consistency when user types new IPs, they might want to reset to state after last "reset capture" or after load.
    // Better UX: On page load capture. Also if user clicks "reset" we set back to last capture. And if user wants to set current as baseline,
    // but no explicit "set baseline" but typical behavior: "reset" returns to last captured when page loaded or after clear? 
    // We'll also allow that clicking "Apply" doesn't change original. Reset returns to last captured textarea content manually?
    // To make intuitive: the 'reset' returns to the textarea content that was present when the page loaded or last time clear/reset actions.
    // But also user can manually edit, if they want to reset to original *initial IPs*, that is okay.
    // For dynamic use, we also add a small shift: if clear is called, original lines become empty. Good.
    // Also we add an option: When 'Reset' clicked, we revert textarea to originalLines, then reapply transformation.
    
    function initOriginalFromCurrent() {
        captureOriginalFromCurrentTextarea();
        applyTransformationAndRender(); // render initial result.
    }

    // Also Sync original to textarea after some operations? not necessary, but keep Reset straightforward.
    // For better user control, we also add a 'capture as original' behavior? Not required but many tools have.
    // However spec requires :31401 add/remove, vice versa, and http:// toggle, transform button.
    // Reset will revert any edits to the original lines.
    
    // Additional helper: when user manually modifies textarea, they might want to re-transform? optional, but to match expected we leave it.
    // Provide extra event: pressing transform reads current textarea and displays, without affecting stored original.
    
    // Wiring:
    applyBtn.addEventListener('click', () => {
        // just transform based on current textarea, render
        applyTransformationAndRender();
    });
    
    resetBtn.addEventListener('click', () => {
        // revert textarea to originalLines (snapshot)
        const originalText = originalLines.join('\n');
        ipTextarea.value = originalText;
        // after resetting text, re-transform using checkboxes.
        applyTransformationAndRender();
    });
    
    clearBtn.addEventListener('click', () => {
        ipTextarea.value = '';
        originalLines = [''];
        renderResults([]);
    });
    
    copyBtn.addEventListener('click', () => {
        // copy current displayed results
        const resultDivs = document.querySelectorAll('#resultContainer .result-item');
        if (!resultDivs.length) {
            // maybe empty message
            const textToCopy = "";
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "Copied!";
                setTimeout(() => { copyBtn.innerText = originalText; }, 1200);
            }).catch(() => alert("Could not copy"));
            return;
        }
        const linesArray = Array.from(resultDivs).map(div => div.innerText.trim());
        const copyText = linesArray.join('\n');
        navigator.clipboard.writeText(copyText).then(() => {
            const oldText = copyBtn.innerText;
            copyBtn.innerText = "✓ Copied!";
            setTimeout(() => { copyBtn.innerText = oldText; }, 1500);
        }).catch(() => alert("Failed to copy"));
    });
    
    // Helper also for checkboxes: when changing any, optionally we can auto-refresh? many tools require manual transform. 
    // But we could live: user clicks transform (manual). But we also add convenience that any checkbox click refresh preview? optional but not mandatory.
    // To improve UX, make transform reflect automatically on checkbox change? but spec says "make a tool using html css js which add the :31401 ... also option to add http://"
    // Transform button does main job. However we can add auto-update to show instant preview? better.
    // Since it's more intuitive, we attach event to checkboxes to automatically re-transform if they want.
    // But not overcomplicate: we add an 'auto update on checkbox change' to demonstrate reactive.
    function autoUpdateOnCheckboxChange() {
        applyTransformationAndRender();
    }
    
    addHttpCheck.addEventListener('change', autoUpdateOnCheckboxChange);
    removeHttpCheck.addEventListener('change', autoUpdateOnCheckboxChange);
    removePortCheck.addEventListener('change', autoUpdateOnCheckboxChange);
    addPortCheck.addEventListener('change', autoUpdateOnCheckboxChange);
    
    // Also update on textarea input, but we don't want to overload but for better we could but manual transform is robust.
    // However add event to let user see live transformation? optional but can be useful, but may conflict with reset original baseline.
    // Better: keep explicit transform button, but auto-update on checkbox is enough. Textarea manual then click transform.
    // Also for ease: live transformation if user wants we provide keyup? but spec requires explicit tool, we already guarantee transform button.
    // but for luxury we add optional "live preview" but not needed. Let's also add something: when textarea changes we will NOT auto-transform,
    // to respect original concept: explicitly press "Transform IPs". BUT we do enable real time when checkboxes changed.
    // Final touches: when reset and clear, proper behavior.
    
    // Capture original on page load.
    const initialTextareaValue = ipTextarea.value;
    originalLines = initialTextareaValue.split(/\r?\n/);
    // if initial textarea is empty, we still have one empty line. fine
    applyTransformationAndRender();
    
    // Ensure reset works with dynamic state: after clear, reset must be empty? According to our clear overwrites originalLines to [''], so reset will give empty. Good.
    // If user manually edit text without reset, they can click reset to revert to first loaded IPs.
    // For "vice versa means remove :31401 or http:// both or any one option" fully supported: uncheck add, check removePort, etc.
    // Example: text like http://0:0:0:0:31401 -> remove port + remove http returns original 0:0:0:0. or only remove port returns http://0:0:0:0, etc.
    
    // Additional edge: our transformation treat removal of http:// first, then port removal ensures that an address like http://10.0.0.1:31401 after removal yields 10.0.0.1 (since http:// stripped then :31401 stripped) then add port or http again accordingly.
    // Also add port respects not double-appending. Good.
    // Also ensure multiple line handling: blank lines remain blank lines in output.
    // For "0:0:0:0" to "0:0:0:0:31401" -> with add port flag yields exactly 0:0:0:0:31401, and http prefix optional.
    // IPV6 style: 2001:db8::1 becomes 2001:db8::1:31401 when adding port, but note this is ambiguous but user requirement just appends port.
    // Perfectly fit the spec.
    
    // If removePort and addPort both selected, remove then add, could produce same as only add but port removed first. For line ending with :31401, it removes then adds back -> same. For line without port, just adds.
    // handle http removal and addition together, user may choose to replace schema.
    console.log("Tool ready: IP + :31401 + http:// manager | vice versa support");
    
    // Additional subtle: remove "http://" then later add "http://" if both boxes ticked? That is allowed, but output may re-add http:// after removal, can create toggling. Use cases.
    // add also capability: reset with current textarea snapshot to unify
    window.addEventListener('load', () => {
        // final double-check consistency
        applyTransformationAndRender();
    });

