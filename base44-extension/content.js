class Base44Downloader{constructor(){console.log("\u2705 contentscript: Base44Downloader loaded"),this.extractedData={},this.isExtracting=!1,this.isPaused=!1,this.stopRequested=!1,this.exportingFlag=!1,this.inlineButtonObserver=null,this.inlineButtonHeartbeat=null,this.mountInlineButtons=null,this.inlineButtonsByKey=new Map,this.inlinePanelDebugSignature="",this.inlineButtonUiSignature="",this.inlineButtonEnabled=!0,this.consoleTelemetryRequestEvent="b44:telemetry-test-request",this.consoleTelemetryResponseEvent="b44:telemetry-test-response",this.stabilizeDelayMs=3800,this.reviewPromptConfig={minSuccessfulExports:3,cooldownMs:1e3*60*60*24*14,storeItemId:"ngbhbpaflbegfjgaibhldjlmmfonpief",localStorageKeys:{exportCount:"B44D_reviewPrompt.exportCount",dismissed:"B44D_reviewPrompt.dismissed",neverShowAgain:"B44D_reviewPrompt.neverShowAgain",reviewClicked:"B44D_reviewPrompt.reviewClicked",lastShownAt:"B44D_reviewPrompt.lastShownAt"},legacyLocalStorageKeys:{exportCount:"reviewPrompt.exportCount",dismissed:"reviewPrompt.dismissed",neverShowAgain:"reviewPrompt.neverShowAgain",reviewClicked:"reviewPrompt.reviewClicked",lastShownAt:"reviewPrompt.lastShownAt"}},this.options={cleanImports:!0,copyJsonOnly:!1,generateZip:!0,delayMs:600},this.dbClient=null,this.setupListeners(),this.setupConsoleTelemetryTester(),this.injectModalStyles(),this.setupInlineExportButton(),this.resumePendingExportFromStorage(),this.schedulePostLoadStabilization()}t(e,t,n){try{return chrome.i18n.getMessage(e,n)||t}catch{return t}}getTelemetryEndpoint(){return"https://base44downloader.vercel.app/api/export-telemetry"}async getOrCreateTelemetryInstallId(){const e="b44d_telemetryInstallId";try{const t=await chrome.storage.local.get(e);if(typeof t?.[e]=="string"&&t[e].trim())return t[e];const n=typeof crypto?.randomUUID=="function"?crypto.randomUUID():`b44d_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;return await chrome.storage.local.set({[e]:n}),n}catch(t){return console.warn("\u26A0\uFE0F Unable to read telemetry install id:",t),null}}getTelemetryExportMode(){return this.options.copyJsonOnly&&this.options.generateZip?"json_and_zip":this.options.copyJsonOnly?"json_only":this.options.generateZip?"zip_only":"selection_ready"}async sendExportTelemetry(e={}){const t=this.getTelemetryEndpoint();if(!t)return{ok:!1,error:"missing_endpoint"};const n=e.installId||await this.getOrCreateTelemetryInstallId();if(!n)return{ok:!1,error:"missing_install_id"};const o=this.getReviewPromptState(),r={event:"export_success",installId:n,exportMode:e.exportMode||this.getTelemetryExportMode(),extensionVersion:e.extensionVersion||chrome.runtime?.getManifest?.().version||"unknown",sentAt:e.sentAt||new Date().toISOString(),exportCount:Number.isFinite(e.exportCount)?e.exportCount:o.exportCount,reviewClicked:typeof e.reviewClicked=="boolean"?e.reviewClicked:o.reviewClicked},i=await fetch(t,{method:"POST",mode:"cors",credentials:"omit",keepalive:!0,headers:{"Content-Type":"application/json"},body:JSON.stringify(r)}),l=await i.text();let c=l;if(l)try{c=JSON.parse(l)}catch{c=l}return{ok:i.ok,status:i.status,statusText:i.statusText,endpoint:t,payload:r,body:c}}getTodayDateString(){const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}generateRandomTelemetryMinute(){return 660+Math.floor(Math.random()*120)}async getDailyTelemetryState(){const e={date:"b44d_telemetrySentDate",scheduledMinute:"b44d_telemetryScheduledMinute"};try{const t=await chrome.storage.local.get([e.date,e.scheduledMinute]);return{sentDate:t[e.date]||null,scheduledMinute:t[e.scheduledMinute]??null}}catch{return{sentDate:null,scheduledMinute:null}}}async markDailyTelemetrySent(e){await chrome.storage.local.set({b44d_telemetrySentDate:e})}async setScheduledMinute(e){await chrome.storage.local.set({b44d_telemetryScheduledMinute:e})}async trackSuccessfulExportTelemetry(){try{const e=this.getTodayDateString(),t=await this.getDailyTelemetryState();if(t.sentDate===e)return;let n=t.scheduledMinute;t.sentDate!==e&&(n===null||t.sentDate!==null)&&(n=this.generateRandomTelemetryMinute(),await this.setScheduledMinute(n));const o=new Date;if(o.getHours()*60+o.getMinutes()<n)return;const i=await this.sendExportTelemetry();i?.ok?await this.markDailyTelemetrySent(e):console.warn("\u26A0\uFE0F Export telemetry failed:",i)}catch(e){console.warn("\u26A0\uFE0F Export telemetry failed:",e)}}setupConsoleTelemetryTester(){const e=document.createElement("script");e.src=chrome.runtime.getURL("page-bridge.js"),e.dataset.b44Mode="telemetry-helper",e.dataset.b44RequestEvent=this.consoleTelemetryRequestEvent,e.dataset.b44ResponseEvent=this.consoleTelemetryResponseEvent,e.addEventListener("load",()=>e.remove(),{once:!0}),e.addEventListener("error",()=>e.remove(),{once:!0}),(document.head||document.documentElement).appendChild(e),window.addEventListener(this.consoleTelemetryRequestEvent,t=>{const n=t.detail||{},o=n.requestId,r=n.overrides||{};this.sendExportTelemetry(r).then(i=>{window.dispatchEvent(new CustomEvent(this.consoleTelemetryResponseEvent,{detail:{requestId:o,ok:!0,result:i}}))}).catch(i=>{window.dispatchEvent(new CustomEvent(this.consoleTelemetryResponseEvent,{detail:{requestId:o,ok:!1,error:i instanceof Error?i.message:String(i)}}))})})}setDbClient(e){this.dbClient=e,console.log("\u2705 DB client connected")}async saveFile(e,t){if(this.dbClient)try{await this.dbClient.get(e)?await this.dbClient.update(e,t):await this.dbClient.create(e,t),console.log(`\u{1F4BE} Saved ${e} to DB`)}catch(n){console.warn(`\u274C Failed saving ${e}: ${n.message}`)}}async saveAllToDb(){if(!(!this.extractedData||!this.dbClient))for(const[e,t]of Object.entries(this.extractedData))await this.saveFile(e,t)}async writeClipboardText(e){if(navigator.clipboard?.writeText)try{return await navigator.clipboard.writeText(e),!0}catch{}const t=document.createElement("textarea");return t.value=e,t.setAttribute("readonly","true"),t.style.position="fixed",t.style.opacity="0",document.body.appendChild(t),t.select(),document.execCommand("copy"),t.remove(),!0}setupListeners(){chrome.runtime.onMessage.addListener((e,t,n)=>{if(e.action==="START_EXTRACTION")return this.options={...this.options,...e.options||{}},this.startExtraction().then(o=>n({success:!0,data:o})).catch(o=>n({success:!1,message:o.message})),!0;if(e.action==="RUN_EXPORT_FLOW")return this.runInlineExportFlow(),n({ok:!0}),!1}),chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(Object.prototype.hasOwnProperty.call(e,"b44d_inlineButtonEnabled")&&(this.inlineButtonEnabled=e.b44d_inlineButtonEnabled.newValue!==!1,this.applyInlineButtonPreference()),Object.prototype.hasOwnProperty.call(e,"b44d_copyJsonOnly")&&(this.options.copyJsonOnly=!!e.b44d_copyJsonOnly.newValue),Object.prototype.hasOwnProperty.call(e,"b44d_generateZip")&&(this.options.generateZip=!!e.b44d_generateZip.newValue),Object.prototype.hasOwnProperty.call(e,"b44d_cleanImports")&&(this.options.cleanImports=!!e.b44d_cleanImports.newValue))}),window.addEventListener("beforeunload",e=>{this.isExtracting&&(e.preventDefault(),e.returnValue="",this.showWarningModal())})}async startExtraction(){if(this.isExtracting)throw new Error(this.t("extractionInProgress","An export is already running. Please wait."));this.isExtracting=!0,this.isPaused=!1,this.stopRequested=!1,this.extractedData={};try{console.log("\u{1F680} Base44 Downloader started",this.options);const e=this.getTreeContext();e&&await this.expandFoldersFast(e);const t=this.getFileEntries(e);if(t.length===0)console.warn("\u26A0\uFE0F No tree files found, using current editor fallback"),await this.extractCurrentFileOnly();else{console.log(`\u{1F4C2} Processing ${t.length} files`);for(let n=0;n<t.length;n++){await this.waitForResumeOrStop();const o=t[n],r=this.resolveFreshButton(e,o);if(!r){console.warn(`\u26A0\uFE0F Button not found for ${o.fullPath}`);continue}const i=await this.getEditorSignature();this.simulateClick(r);const l=await this.waitForEditorContent(i);if(!l){console.warn(`\u26A0\uFE0F Empty content for ${o.fullPath}`);continue}const c=this.options.cleanImports?this.cleanBase44(l,o.fullPath):l,d=this.ensureUniquePath(o.fullPath||this.buildPathFromUrl()||`file_${n+1}.js`);this.extractedData[d]=c,this.updateProgressUI(n+1,t.length,d),console.log(`\u2705 ${n+1}/${t.length} ${d}`)}}if(Object.keys(this.extractedData).length===0)throw this.stopRequested?new Error(this.t("exportCancelled","Export cancelled.")):new Error(this.t("noContentExtracted","No file content could be read. Try refreshing the page."));return this.extractedData}finally{this.isExtracting=!1,this.isPaused=!1,this.stopRequested=!1,this.updateInlineExportButtonState(),this.updateInlineButtonHeartbeat(),this.updateProgressControlsUI()}}updateProgressUI(e,t,n){let o=document.getElementById("b44-progress-bar"),r=document.getElementById("b44-progress-text");if(!o){const i=document.createElement("div");i.id="b44-progress-container",i.style.cssText="position:fixed;top:20px;left:50%;transform:translateX(-50%);width:min(560px,94vw);z-index:2147483647;background:linear-gradient(135deg,rgba(17,35,56,0.96),rgba(30,22,56,0.92));backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.16);border-radius:14px;padding:12px 14px;box-shadow:0 10px 26px rgba(0,0,0,0.34);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",i.innerHTML=`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:10px;">
          <div id="b44-progress-state" style="display:flex;align-items:center;gap:8px;color:#f6f7fb;font-size:12px;font-weight:700;letter-spacing:0.01em;">
            <span style="width:9px;height:9px;border-radius:999px;background:#ff8a57;box-shadow:0 0 0 0 rgba(255,138,87,0.7);animation:b44-pulse-dot 1.2s ease-in-out infinite;"></span>
            ${this.t("statusExtracting","Extracting...")}
          </div>
          <div style="font-size:11px;color:rgba(232,238,252,0.72);">${this.t("loaderSubtitle","This may take a moment")}</div>
        </div>
        <div id="b44-progress-text" style="margin-bottom:7px;font-size:12px;color:rgba(226,236,255,0.92);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        <div style="background:rgba(255,255,255,0.15);height:6px;border-radius:3px;overflow:hidden;">
          <div id="b44-progress-bar" style="width:0%;height:6px;background:linear-gradient(90deg,#f36a32,#ff9257);border-radius:3px;transition:width 0.3s ease;"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:9px;">
          <button id="b44-progress-pause" type="button" style="border:1px solid rgba(255,255,255,0.28);background:rgba(255,255,255,0.12);color:#ecf2ff;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">${this.t("pauseBtn","Pause")}</button>
          <button id="b44-progress-stop" type="button" style="border:1px solid rgba(255,120,120,0.36);background:rgba(255,84,84,0.16);color:#ffd6d6;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">${this.t("cancelBtn","Cancel")}</button>
        </div>
      `,document.body.appendChild(i),o=document.getElementById("b44-progress-bar"),r=document.getElementById("b44-progress-text");const l=document.getElementById("b44-progress-pause"),c=document.getElementById("b44-progress-stop");l&&(l.onclick=()=>this.togglePauseExtraction()),c&&(c.onclick=()=>this.stopExtraction())}o&&(o.style.width=`${e/t*100}%`),r&&(r.textContent=`${e} / ${t}: ${n}`),this.updateProgressControlsUI()}clearProgressUI(){document.getElementById("b44-progress-container")?.remove()}togglePauseExtraction(){this.isExtracting&&(this.isPaused=!this.isPaused,this.updateProgressControlsUI())}stopExtraction(){this.isExtracting&&(this.stopRequested=!0,this.isPaused=!1,this.updateProgressControlsUI())}updateProgressControlsUI(){const e=document.getElementById("b44-progress-pause"),t=document.getElementById("b44-progress-stop"),n=document.getElementById("b44-progress-state");e&&(e.textContent=this.isPaused?this.t("resumeBtn","Resume"):this.t("pauseBtn","Pause"),e.style.opacity=this.isExtracting?"1":"0.65"),t&&(t.textContent=this.t("cancelBtn","Cancel"),t.style.opacity=this.isExtracting?"1":"0.65"),n&&(n.lastChild.textContent=this.isPaused?this.t("statusPaused","Paused"):this.t("statusExtracting","Extracting..."))}async waitForResumeOrStop(){for(;this.isPaused&&!this.stopRequested;)await this.sleep(120);if(this.stopRequested)throw new Error(this.t("exportCancelled","Export cancelled."))}showFileSelectionModal(){const e=document.createElement("div");e.className="b44-modal-overlay";const n=Object.keys(this.extractedData).map(i=>`<label><input type="checkbox" data-file="${i}" checked> ${i}</label>`).join("<br>");e.innerHTML=`
      <div class="b44-modal">
        <div class="b44-title">${this.t("selectFilesTitle","Select files to export")}</div>
        <div class="b44-file-actions">
          <button type="button" class="b44-link-btn b44-select-all">${this.t("selectAll","All")}</button>
          <span class="b44-file-actions-sep">/</span>
          <button type="button" class="b44-link-btn b44-deselect-all">${this.t("deselectAll","None")}</button>
        </div>
        <div class="b44-msg">${n}</div>
        <div class="b44-btns">
          <button class="b44-btn b44-btn-cancel">${this.t("cancelBtn","Cancel")}</button>
          <button class="b44-btn b44-btn-close">${this.t("exportSelected","Export Selected")}</button>
        </div>
      </div>
    `,document.body.appendChild(e),setTimeout(()=>e.classList.add("active"),10),e.querySelector(".b44-btn-cancel").onclick=async()=>{await this.setExportingFlag(!1),e.remove()};const o=e.querySelector(".b44-select-all"),r=e.querySelector(".b44-deselect-all");o&&(o.onclick=()=>{e.querySelectorAll('input[type="checkbox"][data-file]').forEach(i=>{i.checked=!0})}),r&&(r.onclick=()=>{e.querySelectorAll('input[type="checkbox"][data-file]').forEach(i=>{i.checked=!1})}),e.querySelector(".b44-btn-close").onclick=async()=>{const i=Array.from(e.querySelectorAll('input[type="checkbox"]:checked')).map(c=>c.dataset.file);if(i.length===0)return;const l={};i.forEach(c=>l[c]=this.extractedData[c]),this.options.copyJsonOnly&&await this.writeClipboardText(JSON.stringify(l,null,2)),this.options.generateZip&&await this.downloadZip(l),this.handleSuccessfulExport(),await this.setExportingFlag(!1),e.remove(),console.log("\u2705 Export completato dai file selezionati")}}async runInlineExportFlow(){if(!this.isExtracting){if(!this.isCodePage(window.location.href)){const e=this.getCodeUrl(window.location.href);if(!e){console.warn("\u274C Cannot resolve code URL for this page"),await this.setExportingFlag(!1);return}await this.setExportingFlag(!0),console.log("\u21AA\uFE0F Redirecting to code workspace with exporting=true"),window.location.href=e;return}await this.executeExtractionFlow({autoFinalize:!1})}}async executeExtractionFlow({autoFinalize:e=!1}={}){if(this.isExtracting)return!1;try{if(await this.loadOptionsFromStorage(),await this.setExportingFlag(!0),!await this.waitForExtractionPanel())throw new Error(this.t("base44DetectedDesc","Open the code workspace first, then run export."));if(await this.startExtraction(),e){const n={...this.extractedData};this.options.copyJsonOnly&&await this.writeClipboardText(JSON.stringify(n,null,2)),this.options.generateZip&&await this.downloadZip(n),this.handleSuccessfulExport(),await this.setExportingFlag(!1),console.log("\u2705 Auto-export completed from storage flag")}else this.showFileSelectionModal();return!0}catch(t){return console.error("\u274C Export failed:",t),await this.setExportingFlag(!1),!1}finally{this.clearProgressUI(),typeof this.mountInlineButtons=="function"&&this.mountInlineButtons()}}async waitForExtractionPanel(e=15e3,t=200){const n=Date.now()+e;for(;Date.now()<n;){const o=this.getTreeContext();if(o&&this.getTreeButtons(o).length>0)return!0;await this.sleep(t)}return!1}async downloadZip(e){if(!e||!window.JSZip)return;const t=new JSZip;for(const[l,c]of Object.entries(e))t.file(l,c);const n=await t.generateAsync({type:"blob"}),o=URL.createObjectURL(n),r=new Date().toISOString().replace(/[:.]/g,"-"),i=document.createElement("a");i.href=o,i.download=`base44-export-${r}.zip`,i.click(),URL.revokeObjectURL(o)}getReviewPromptState(){const{localStorageKeys:e,legacyLocalStorageKeys:t}=this.reviewPromptConfig;let n;try{n=window.localStorage}catch{return{exportCount:0,dismissed:"",neverShowAgain:!1,reviewClicked:!1,lastShownAt:0}}Object.entries(e).forEach(([d,p])=>{const s=t[d];if(!s||n.getItem(p)!==null)return;const a=n.getItem(s);a!==null&&(n.setItem(p,a),n.removeItem(s))});const o=parseInt(n.getItem(e.exportCount)||"0",10),r=n.getItem(e.dismissed)||"",i=n.getItem(e.neverShowAgain)==="true",l=n.getItem(e.reviewClicked)==="true",c=parseInt(n.getItem(e.lastShownAt)||"0",10);return{exportCount:Number.isFinite(o)?o:0,dismissed:r,neverShowAgain:i,reviewClicked:l,lastShownAt:Number.isFinite(c)?c:0}}updateReviewPromptState(e={}){const{localStorageKeys:t}=this.reviewPromptConfig;try{Object.entries(e).forEach(([n,o])=>{const r=t[n];r&&window.localStorage.setItem(r,String(o))})}catch(n){console.warn("\u26A0\uFE0F Unable to persist review prompt state:",n)}}incrementSuccessfulExportCount(){const t=this.getReviewPromptState().exportCount+1;return this.updateReviewPromptState({exportCount:t}),t}shouldShowReviewPrompt(e=this.getReviewPromptState()){const{minSuccessfulExports:t,cooldownMs:n}=this.reviewPromptConfig;return e.exportCount<t||e.dismissed==="permanent"||e.neverShowAgain||e.reviewClicked?!1:e.lastShownAt?Date.now()-e.lastShownAt>=n:!0}getChromeWebStoreReviewUrl(){return`https://chromewebstore.google.com/detail/base44-downloader/${this.reviewPromptConfig.storeItemId}/reviews`}getExportSuccessDetail(){return this.options.copyJsonOnly&&this.options.generateZip?this.t("exportSuccessJsonAndZip","JSON copied and ZIP download started."):this.options.copyJsonOnly?this.t("exportSuccessJsonOnly","JSON copied and ready to paste."):this.options.generateZip?this.t("zipStarted","ZIP download started automatically."):this.t("exportSuccessReady","Your export is ready.")}handleSuccessfulExport(){const e=this.incrementSuccessfulExportCount(),t=this.getReviewPromptState(),n=this.shouldShowReviewPrompt({...t,exportCount:e});n&&this.updateReviewPromptState({lastShownAt:Date.now(),dismissed:"temporary"}),this.showExportDoneAnimation({reviewPromptVisible:n,exportCount:e}),this.trackSuccessfulExportTelemetry()}setupInlineExportButton(){const e=()=>{if(this.cleanupInlineLayoutWrappers(),!this.inlineButtonEnabled){this.hideInlineButtons();return}const t=Array.from(document.querySelectorAll("iframe")).filter(s=>(s.getAttribute("title")||"").trim().toLowerCase()==="app preview"),n=Array.from(document.querySelectorAll('[data-panel-collapsible="true"]')),o=`iframes:${t.length}|collapsible:${n.length}`;o!==this.inlinePanelDebugSignature&&(this.inlinePanelDebugSignature=o);const r=s=>{const a=document.createElement("div");return a.className="b44-inline-export-variants",a.dataset.b44Placement=s,["v1"].forEach(g=>{const u=document.createElement("button");u.type="button",u.className=`b44-inline-export-btn ${g}`,u.dataset.b44Placement=s,u.dataset.b44Variant=g,u.addEventListener("click",()=>this.runInlineExportFlow()),a.appendChild(u)}),a},i=(s,a,h)=>{const g=s.closest(".h-full.w-full.relative")||s.closest("[data-panel-group-id]")||s.parentElement;if(!(g instanceof HTMLElement))return;let u=Array.from(g.children).find(w=>w instanceof HTMLElement&&w.classList.contains("b44-inline-export-overlay")&&w.dataset.b44Key===a)||null;u||(u=document.createElement("div"),u.className="b44-inline-export-overlay",u.dataset.b44Key=a,g.appendChild(u)),h.parentElement!==u&&u.appendChild(h)},l=(s,a)=>{const h=[s.closest(".h-full.w-full.relative"),s.closest("[data-panel-group-id]"),document].filter(Boolean);for(const b of h){if(!b||typeof b.querySelector!="function")continue;const f=b.querySelector('[data-testid="editor-main-header"]');if(!(f instanceof HTMLElement))continue;const x=f.querySelector(".flex.flex-row.justify-end.items-center.gap-1");if(x instanceof HTMLElement)return a.classList.add("b44-inline-export-toolbar-group","b44-inline-export-dashboard-header-group"),a.classList.remove("b44-inline-export-panel-header-group"),a.parentElement!==x&&x.appendChild(a),!0}const g=[s.closest("[data-panel-group-id]"),s.parentElement,s.closest(".flex-1.overflow-x-auto"),document].filter(Boolean),u=[".flex.flex-row.justify-end.items-center.gap-1",".flex.flex-row.gap-2.items-stretch.justify-end",".flex.flex-row.justify-end.items-center"];for(const b of g)if(!(!b||typeof b.querySelectorAll!="function"))for(const f of u){const y=Array.from(b.querySelectorAll(f)).filter(m=>m instanceof HTMLElement&&m.querySelector('button[aria-label="Activity monitor"]')&&m.querySelector('button[aria-label="Export project as ZIP"]'))[0];if(y instanceof HTMLElement)return a.classList.add("b44-inline-export-toolbar-group"),a.parentElement!==y&&y.appendChild(a),!0}const v=Array.from(s.querySelectorAll(".flex.items-center.gap-1, .flex.items-center.gap-1\\.5")).filter(b=>{if(!(b instanceof HTMLElement))return!1;const f=Array.from(b.querySelectorAll("button"));if(f.length===0)return!1;const x=f.some(m=>(m.querySelector("svg")?.getAttribute("class")||"").includes("lucide-search")),y=f.some(m=>(m.querySelector("svg")?.getAttribute("class")||"").includes("lucide-panel-left-close"));return x||y})[0];return v instanceof HTMLElement?(a.classList.add("b44-inline-export-toolbar-group","b44-inline-export-panel-header-group"),a.classList.remove("b44-inline-export-dashboard-header-group"),a.parentElement!==v&&v.appendChild(a),!0):(a.classList.remove("b44-inline-export-toolbar-group","b44-inline-export-panel-header-group","b44-inline-export-dashboard-header-group"),!1)},c=new Set,d=n[0]||null,p=d?null:t[0]||null;if(d){const s="collapsible-0";let a=this.inlineButtonsByKey.get(s);a||(a=r("collapsible"),this.inlineButtonsByKey.set(s,a)),a.style.display="",c.add(s),l(d,a)||i(d,s,a)}else if(p){const s=p.parentElement;if(s){const a="preview-0";let h=this.inlineButtonsByKey.get(a);h||(h=r("preview"),this.inlineButtonsByKey.set(a,h)),h.style.display="",c.add(a),(h.nextElementSibling!==p||h.parentElement!==s)&&s.insertBefore(h,p)}}this.inlineButtonsByKey.forEach((s,a)=>{c.has(a)||(s.style.display="none")}),this.updateInlineExportButtonState()};this.mountInlineButtons=e,e(),this.inlineButtonObserver=new MutationObserver(t=>{t.every(o=>{if(o.type!=="childList")return!1;const r=o.target;return r instanceof Element&&(r.closest(".b44-inline-export-btn")||r.classList?.contains("b44-inline-export-btn"))})||e()}),this.inlineButtonObserver.observe(document.body,{childList:!0,subtree:!0})}hideInlineButtons(){this.inlineButtonsByKey.forEach(e=>{e.parentElement&&e.remove()}),this.cleanupInlineLayoutWrappers()}cleanupInlineLayoutWrappers(){document.querySelectorAll(".b44-code-layout-wrap").forEach(e=>{if(!(e instanceof HTMLElement))return;const t=e.querySelector(".b44-code-layout-body"),n=e.parentElement;if(!(!(t instanceof HTMLElement)||!n)){for(;t.firstChild;)n.insertBefore(t.firstChild,e);e.remove()}}),document.querySelectorAll(".b44-inline-export-overlay").forEach(e=>{e instanceof HTMLElement&&e.childElementCount===0&&e.remove()})}updateInlineButtonHeartbeat(){const e=this.exportingFlag||this.isExtracting;if(e&&!this.inlineButtonHeartbeat){this.inlineButtonHeartbeat=setInterval(()=>{typeof this.mountInlineButtons=="function"&&this.mountInlineButtons()},500);return}!e&&this.inlineButtonHeartbeat&&(clearInterval(this.inlineButtonHeartbeat),this.inlineButtonHeartbeat=null,typeof this.mountInlineButtons=="function"&&this.mountInlineButtons())}async setExportingFlag(e){this.exportingFlag=!!e,await chrome.storage.local.set({b44d_exporting:!!e}),console.log(`\u{1F5C2}\uFE0F storage.b44d_exporting=${!!e}`),this.updateInlineExportButtonState(),this.updateInlineButtonHeartbeat()}async getExportingFlag(){return!!(await chrome.storage.local.get("b44d_exporting"))?.b44d_exporting}async getInlineButtonEnabled(){return(await chrome.storage.local.get("b44d_inlineButtonEnabled"))?.b44d_inlineButtonEnabled!==!1}async loadOptionsFromStorage(){const e=await chrome.storage.local.get(["b44d_copyJsonOnly","b44d_generateZip","b44d_cleanImports"]);e.b44d_copyJsonOnly!==void 0&&(this.options.copyJsonOnly=e.b44d_copyJsonOnly),e.b44d_generateZip!==void 0&&(this.options.generateZip=e.b44d_generateZip),e.b44d_cleanImports!==void 0&&(this.options.cleanImports=e.b44d_cleanImports)}isCodePage(e){try{return new URL(e).pathname.includes("/editor/workspace/code")}catch{return!1}}getCodeUrl(e){try{const t=new URL(e),n=t.pathname.match(/\/apps\/([^/]+)/);if(!n)return null;const o=n[1],r=new URL(t.origin);r.pathname=`/apps/${o}/editor/workspace/code`;const i=t.searchParams.get("filePath");return i&&r.searchParams.set("filePath",i),r.toString()}catch{return null}}async resumePendingExportFromStorage(){if(!this.isCodePage(window.location.href))return;this.inlineButtonEnabled=await this.getInlineButtonEnabled(),await this.loadOptionsFromStorage(),this.applyInlineButtonPreference(),await this.sleep(this.stabilizeDelayMs);const e=await this.getExportingFlag();this.exportingFlag=e,this.updateInlineExportButtonState(),console.log(`\u{1F50E} contentscript auto-export check: exporting=${e}`),e&&await this.executeExtractionFlow({autoFinalize:!0})}schedulePostLoadStabilization(){this.isCodePage(window.location.href)&&setTimeout(()=>{this.applyInlineButtonPreference(),typeof this.mountInlineButtons=="function"&&this.mountInlineButtons()},this.stabilizeDelayMs)}applyInlineButtonPreference(){if(this.inlineButtonEnabled){typeof this.mountInlineButtons=="function"&&this.mountInlineButtons();return}this.hideInlineButtons()}updateInlineExportButtonState(){const e=Array.from(document.querySelectorAll(".b44-inline-export-btn"));if(e.length===0)return;const t=this.exportingFlag||this.isExtracting,n=t?this.t("statusExtracting","Exporting..."):this.t("startExport","Start Export"),o=`${t}|${n}`;this.inlineButtonUiSignature=o,e.forEach(r=>{r instanceof HTMLElement&&(r.dataset.b44UiSignature!==o&&(r.innerHTML=`
          <span class="b44-inline-export-action">${n}</span>
        `,r.dataset.b44UiSignature=o),r.classList.toggle("is-loading",t),r.disabled=t)})}showExportDoneAnimation({reviewPromptVisible:e=!1,exportCount:t=0}={}){const n=document.getElementById("b44-export-done");n&&n.remove();const o=chrome.runtime.getURL("icons/icon48.png"),r=this.t("brandName","Base44 Downloader"),i="https://ko-fi.com/codewithfra",l=this.getChromeWebStoreReviewUrl(),c=this.getExportSuccessDetail(),d=document.createElement("div");d.id="b44-export-done",d.className="b44-export-done",d.innerHTML=`
      <div class="b44-export-done-head">
        <img src="${o}" alt="${r}" class="b44-export-done-logo" />
        <div class="b44-export-done-brand-wrap">
          <div class="b44-export-done-brand">${r}</div>
          <div class="b44-export-done-brand-sub">${this.t("exportPanel","Export panel")}</div>
        </div>
        <button type="button" class="b44-export-done-close" aria-label="${this.t("closeBtn","Close")}">\u2715</button>
      </div>
      <div class="b44-export-done-main">
        <div>
          <div class="b44-export-done-text">${this.t("exportSuccess","Export completed successfully.")}</div>
          <div class="b44-export-done-sub">${c}</div>
        </div>
      </div>
      ${e?`
        <div class="b44-review-prompt">
          <div class="b44-review-prompt-copy">
            <div class="b44-review-prompt-title">${this.t("reviewPromptTitle","Has Base44 been useful for you?")}</div>
            <div class="b44-review-prompt-sub">${this.t("reviewPromptBody","If Base44 has already saved you a few manual exports, a quick review on the Chrome Web Store would mean a lot.")}</div>
          </div>
          <div class="b44-review-prompt-footer">
            <button type="button" class="b44-review-link" data-review-action="never">${this.t("reviewPromptNever","Don't show again")}</button>
            <div class="b44-review-prompt-actions">
              <button type="button" class="b44-review-btn b44-review-btn-secondary" data-review-action="not-now">${this.t("reviewPromptNotNow","Not now")}</button>
              <button type="button" class="b44-review-btn b44-review-btn-primary" data-review-action="leave-review">${this.t("reviewPromptCta","Leave a review")}</button>
            </div>
          </div>
        </div>
      `:`
        <div class="b44-export-done-support-row">
          <div class="b44-export-done-support-copy">${this.t("supportPrompt","Did this help?")}</div>
          <a
            href="${i}"
            target="_blank"
            rel="noreferrer"
            class="b44-export-done-support"
            aria-label="Support the project"
          >${this.t("supportCta","Support the project")}</a>
        </div>
      `}
      <div class="b44-export-done-spark b44-export-done-spark-a"></div>
      <div class="b44-export-done-spark b44-export-done-spark-b"></div>
      <div class="b44-export-done-spark b44-export-done-spark-c"></div>
    `,document.body.appendChild(d);let p=!1;const s=()=>{p||(p=!0,d.isConnected&&(d.classList.remove("show"),setTimeout(()=>{d.isConnected&&d.remove(),window.location.reload()},220)))},a=d.querySelector(".b44-export-done-close");a&&a.addEventListener("click",()=>{e&&this.updateReviewPromptState({dismissed:"temporary",lastShownAt:Date.now()}),s()}),e&&(d.querySelector('[data-review-action="leave-review"]')?.addEventListener("click",()=>{this.updateReviewPromptState({reviewClicked:!0,dismissed:"permanent",lastShownAt:Date.now()}),window.open(l,"_blank","noopener,noreferrer"),s()}),d.querySelector('[data-review-action="not-now"]')?.addEventListener("click",()=>{this.updateReviewPromptState({dismissed:"temporary",lastShownAt:Date.now()}),s()}),d.querySelector('[data-review-action="never"]')?.addEventListener("click",()=>{this.updateReviewPromptState({dismissed:"permanent",neverShowAgain:!0,lastShownAt:Date.now()}),s()})),requestAnimationFrame(()=>d.classList.add("show")),setTimeout(()=>{s()},1e4)}getTreeContext(){const e=document.querySelector('[role="tree"]');if(e)return{type:"role-tree",root:e};const t=Array.from(document.querySelectorAll("nav"));for(const n of t)if(Array.from(n.querySelectorAll("button")).some(o=>(o.getAttribute("style")||"").includes("padding-left")))return{type:"indent-nav",root:n};return null}getTreeButtons(e){return e?e.type==="role-tree"?Array.from(e.root.querySelectorAll('[role="treeitem"]')).filter(t=>this.getItemName(t)):Array.from(e.root.querySelectorAll("button")).filter(t=>(t.getAttribute("style")||"").includes("padding-left")):[]}isFolderButton(e,t){if(t?.type==="role-tree")return e.hasAttribute("aria-expanded");const n=e.firstElementChild;return!!n&&n.tagName.toLowerCase()==="svg"}getItemName(e){const t=e.getAttribute?.("aria-label");if(t?.trim())return t.trim();const n=e.querySelectorAll?e.querySelectorAll("span"):[];for(const o of n){const r=(o.textContent||"").trim();if(r)return r}return(e.textContent||"").trim().split(`
`)[0].trim()}getIndent(e){const t=(e.getAttribute?.("style")||"").match(/padding-left:\s*(\d+)/);return t?parseInt(t[1],10):0}async expandFoldersFast(e){const t=new Set;for(let n=0;n<30;n++){await this.waitForResumeOrStop();const o=this.getTreeButtons(e),r=[];for(let p=0;p<o.length;p++){const s=o[p];if(!this.isFolderButton(s,e))continue;const a=`${this.getIndent(s)}|${this.getItemName(s)}`;if(!t.has(a)){if(e.type==="role-tree"){s.getAttribute("aria-expanded")==="false"&&r.push({btn:s,key:a});continue}(p+1<o.length?this.getIndent(o[p+1]):-1)<=this.getIndent(s)&&r.push({btn:s,key:a})}}if(r.length===0)break;const i=o.length;for(const p of r)this.simulateClick(p.btn),await this.raf();let l=i,c=0;const d=Date.now()+5e3;for(;Date.now()<d;){await this.waitForResumeOrStop(),await this.sleep(80);const p=this.getTreeButtons(e).length;if(p===l){if(c++,c>=3)break}else c=0,l=p}l<=i&&r.forEach(p=>t.add(p.key))}}getFileEntries(e){if(!e)return[];const t=this.getTreeButtons(e),n=[],o=[];for(let r=0;r<t.length;r++){const i=t[r],l=this.getItemName(i),c=this.getIndent(i);for(;o.length>0&&o[o.length-1].indent>=c;)o.pop();if(this.isFolderButton(i,e)){o.push({name:l,indent:c});continue}const d=o.map(p=>p.name).join("/");n.push({fullPath:d?`${d}/${l}`:l,name:l,indent:c,index:r})}return n}resolveFreshButton(e,t){if(!e)return null;const n=this.getTreeButtons(e);if(t.index<n.length){const o=n[t.index];if(o&&!this.isFolderButton(o,e)&&this.getItemName(o)===t.name&&this.getIndent(o)===t.indent)return o}return n.find(o=>!this.isFolderButton(o,e)&&this.getItemName(o)===t.name&&this.getIndent(o)===t.indent)||null}async getEditorSignature(){const e=await this.readContent();return e?`${e.length}:${e.slice(0,120)}`:"empty"}async waitForEditorContent(e){const t=Date.now()+3500;for(;Date.now()<t;){await this.waitForResumeOrStop(),await this.sleep(70);const n=await this.readContent();if(!n)continue;const o=`${n.length}:${n.slice(0,120)}`;if(e==="empty"||o!==e)return n}return this.readContent()}async readContent(){const e=await this.getMonacoEditorValue();if(e)return e;const t=this.pickVisible(Array.from(document.querySelectorAll("textarea")));if(t?.value)return this.normalizeDomExtractedText(t.value);const n=Array.from(document.querySelectorAll(".monaco-editor .view-line")).map(i=>i.textContent||"").join(`
`).trim();if(n)return this.normalizeDomExtractedText(n);const o=this.pickVisible(Array.from(document.querySelectorAll("pre")));if(o)return this.normalizeDomExtractedText((o.innerText||o.textContent||"").trim());const r=this.pickVisible(Array.from(document.querySelectorAll('[contenteditable="true"]')));return r?this.normalizeDomExtractedText((r.innerText||r.textContent||"").trim()):""}async getMonacoEditorValue(){const e=await this.getMonacoSnapshotFromPageContext();return!e||typeof e.value!="string"?"":this.normalizeDomExtractedText(e.value)}async getMonacoSnapshotFromPageContext(){const e=`B44_MONACO_SNAPSHOT_${Math.random().toString(36).slice(2)}`;return new Promise(t=>{let n=!1;const o=()=>{clearTimeout(r),document.removeEventListener(e,i),l.remove()},r=setTimeout(()=>{n||(n=!0,o(),t(null))},400),i=c=>{n||(n=!0,o(),t(c.detail||null))};document.addEventListener(e,i,{once:!0});const l=document.createElement("script");l.src=chrome.runtime.getURL("page-bridge.js"),l.dataset.b44Event=e,l.addEventListener("load",()=>l.remove(),{once:!0}),l.addEventListener("error",()=>{n||(n=!0,o(),t(null))},{once:!0}),(document.head||document.documentElement).appendChild(l)})}normalizeDomExtractedText(e){return e?e.replace(/\u00a0/g," ").replace(/[\u200b\u200c\u200d\ufeff]/g,"").replace(/\r\n/g,`
`).replace(/\r/g,`
`):""}pickVisible(e){const t=e.filter(n=>{const o=n.getBoundingClientRect(),r=window.getComputedStyle(n);return o.width>0&&o.height>0&&r.visibility!=="hidden"&&r.display!=="none"});return t.length===0?null:t.sort((n,o)=>o.getBoundingClientRect().height-n.getBoundingClientRect().height)[0]}async extractCurrentFileOnly(){const e=await this.readContent();if(!e)throw new Error(this.t("noFilesFound","No files found. Make sure the code editor is open."));const t=this.buildPathFromUrl()||"current-file.js",n=this.options.cleanImports?this.cleanBase44(e,t):e;return this.extractedData[this.ensureUniquePath(t)]=n,this.extractedData}buildPathFromUrl(){try{const e=new URL(window.location.href).searchParams.get("filePath");return e?decodeURIComponent(e):""}catch{return""}}cleanBase44(e,t=""){if(!e)return e;if(this.isBase44ClientFile(t))return"export const db = { auth: { isAuthenticated: async ()=>false, me: async ()=>null }, entities: new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } }; export const base44=db; export default db;";let n=e.replace(/^import\s+.*['"]@base44\/.*['"];?\s*$/gm,"").replace(/^import\s+.*['"]@\/api\/base44Client['"];?\s*$/gm,"").replace(/^import\s+.*['"]\.{1,2}\/.*base44Client.*['"];?\s*$/gm,"").replace(/\bBase44\./g,"db.").replace(/\bbase44\./g,"db.").replace(/\n{3,}/g,`

`);const o=/\bdb\./.test(n),r=/\b(const|let|var)\s+db\b/.test(n)||/\bfunction\s+db\b/.test(n)||/\bimport\s+.*\bdb\b.*from\b/.test(n);return o&&!r&&(n=`const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

${n}`),n}isBase44ClientFile(e){return/(^|\/)base44Client\.(js|jsx|ts|tsx)$/i.test(e||"")}ensureUniquePath(e){if(!this.extractedData[e])return e;let t=2,n=`${e}__${t}`;for(;this.extractedData[n];)t++,n=`${e}__${t}`;return n}simulateClick(e){try{e.scrollIntoView({block:"nearest",behavior:"instant"})}catch{e.scrollIntoView({block:"nearest"})}const t=e.getBoundingClientRect(),n={bubbles:!0,cancelable:!0,view:window,clientX:t.left+t.width/2,clientY:t.top+t.height/2};typeof PointerEvent=="function"&&e.dispatchEvent(new PointerEvent("pointerdown",n)),e.dispatchEvent(new MouseEvent("mousedown",n)),typeof PointerEvent=="function"&&e.dispatchEvent(new PointerEvent("pointerup",n)),e.dispatchEvent(new MouseEvent("mouseup",n)),e.dispatchEvent(new MouseEvent("click",n))}sleep(e){return new Promise(t=>setTimeout(t,e))}raf(){return new Promise(e=>requestAnimationFrame(e))}injectModalStyles(){const e=document.createElement("style");e.textContent=`
      .b44-inline-export-btn {
        --b44-btn-bg-start: #f36a32;
        --b44-btn-bg-end: #ff9257;
        --b44-btn-text: #fff;
        --b44-btn-shadow: rgba(243, 106, 50, 0.35);
        --b44-btn-badge-bg: rgba(255, 255, 255, 0.2);
        align-self: center;
        margin: 4px auto 0;
        padding: 12px 16px;
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 10px;
        background: linear-gradient(130deg, var(--b44-btn-bg-start), var(--b44-btn-bg-end));
        color: var(--b44-btn-text);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.01em;
        cursor: pointer;
        box-shadow: 0 8px 20px var(--b44-btn-shadow);
        z-index: 20;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 42px;
        font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        position: relative;
      }
      .b44-inline-export-overlay {
        position: absolute;
        top: -10px;
        right: 24px;
        left: auto;
        transform: none;
        display: flex;
        justify-content: flex-end;
        z-index: 30;
        pointer-events: none;
      }
      .b44-inline-export-variants {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        z-index: 20;
      }
      .b44-inline-export-overlay .b44-inline-export-variants {
        pointer-events: auto;
        width: auto;
        padding: 0;
      }
      .b44-inline-export-toolbar-group {
        align-items: center;
        flex-wrap: nowrap;
        gap: 8px;
        margin-left: 8px;
        pointer-events: auto;
      }
      .b44-inline-export-panel-header-group {
        margin-left: 6px;
      }
      .b44-inline-export-dashboard-header-group {
        margin-left: 10px;
      }
      .b44-inline-export-variants[data-b44-placement="preview"] {
        position: sticky;
        top: 4px;
        width: 100%;
        padding: 2px 0 4px;
      }
      .b44-inline-export-variants[data-b44-placement="collapsible"] {
        width: auto;
        padding: 0;
      }
      .b44-inline-export-btn[data-b44-placement="collapsible"] {
        margin: 0;
        padding: 8px 12px;
        min-height: 32px;
      }
      .b44-inline-export-toolbar-group .b44-inline-export-btn[data-b44-placement="collapsible"] {
        box-shadow: none;
        border-radius: 10px;
      }
      .b44-inline-export-panel-header-group .b44-inline-export-btn[data-b44-placement="collapsible"] {
        min-height: 32px;
        padding: 6px 10px;
        font-size: 11px;
      }
      .b44-inline-export-panel-header-group .b44-inline-export-action {
        font-size: 12px;
      }
      .b44-inline-export-dashboard-header-group .b44-inline-export-btn[data-b44-placement="collapsible"] {
        margin: 0;
        min-height: 34px;
        padding: 8px 14px;
        box-shadow: 0 6px 16px rgba(243, 106, 50, 0.18);
        white-space: nowrap;
      }
      .b44-inline-export-btn.v1 {
        --b44-btn-bg-start: #f36a32;
        --b44-btn-bg-end: #ff9257;
      }
      .b44-inline-export-btn.v2 {
        --b44-btn-bg-start: #f06f35;
        --b44-btn-bg-end: #ff9a61;
      }
      .b44-inline-export-btn.v3 {
        --b44-btn-bg-start: #eb6630;
        --b44-btn-bg-end: #ff8e52;
      }
      .b44-inline-export-action { font-size: 14px; font-weight: 800; letter-spacing: 0.01em; }
      .b44-inline-export-btn:hover { filter: brightness(1.03); }
      .b44-inline-export-btn:active { transform: translateY(1px); }
      .b44-inline-export-btn.is-loading { cursor: default; opacity: 0.95; }
      .b44-inline-export-btn.is-loading::after {
        content: "";
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-left: 2px;
        border: 2px solid rgba(255,255,255,0.45);
        border-top-color: #fff;
        border-radius: 50%;
        animation: b44-spin 0.8s linear infinite;
        vertical-align: -2px;
      }
      @keyframes b44-spin { to { transform: rotate(360deg); } }
      @keyframes b44-pulse-dot {
        0% { box-shadow: 0 0 0 0 rgba(255,138,87,0.7); }
        80% { box-shadow: 0 0 0 9px rgba(255,138,87,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,138,87,0); }
      }
      .b44-export-done {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%) translateY(-12px) scale(0.985);
        z-index: 2147483647;
        width: min(520px, 94vw);
        background:
          radial-gradient(circle at 10% 10%, rgba(243,106,50,0.2), transparent 40%),
          radial-gradient(circle at 100% 0%, rgba(72,164,255,0.14), transparent 36%),
          linear-gradient(140deg, rgba(20,34,54,0.96), rgba(32,28,62,0.96));
        border: 1px solid rgba(255,255,255,0.24);
        border-radius: 16px;
        box-shadow: 0 16px 36px rgba(10, 8, 26, 0.5);
        color: #f7faff;
        padding: 15px 14px 20px;
        min-height: 152px;
        opacity: 0;
        transition: transform 0.25s ease, opacity 0.25s ease, filter 0.25s ease;
        filter: saturate(1.04);
        font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .b44-export-done.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
      .b44-export-done-head {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 14px;
        padding-right: 2px;
      }
      .b44-export-done-logo {
        width: 30px;
        height: 30px;
        object-fit: cover;
        border-radius: 6px;
        background: rgba(255,255,255,0.92);
        padding: 1px;
        box-shadow: 0 8px 20px rgba(7, 18, 38, 0.5);
      }
      .b44-export-done-brand-wrap { line-height: 1; }
      .b44-export-done-brand {
        font-weight: 800;
        font-size: 12px;
        color: #ffffff;
      }
      .b44-export-done-brand-sub {
        margin-top: 3px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 9px;
        color: rgba(236,244,255,0.72);
      }
      .b44-export-done-chip {
        margin-left: auto;
        font-size: 10px;
        font-weight: 700;
        border-radius: 999px;
        padding: 4px 8px;
        border: 1px solid rgba(255,255,255,0.24);
        background: rgba(255,255,255,0.08);
        color: rgba(247,250,255,0.92);
      }
      .b44-export-done-close {
        margin-left: auto;
        width: 28px;
        height: 28px;
        border: 1px solid rgba(255,255,255,0.28);
        border-radius: 999px;
        background: rgba(255,255,255,0.10);
        color: #f2f6ff;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .b44-export-done-close:hover { filter: brightness(1.08); }
      .b44-export-done-main {
        display: block;
      }
      .b44-export-done-text { font-size: 15px; font-weight: 800; line-height: 1.2; }
      .b44-export-done-sub { font-size: 12px; color: rgba(235, 242, 255, 0.78); margin-top: 5px; line-height: 1.35; }
      .b44-export-done-support-row {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }
      .b44-export-done-support-copy {
        font-size: 12px;
        line-height: 1.4;
        color: rgba(247,250,255,0.76);
        font-weight: 600;
      }
      .b44-export-done-support {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 999px;
        padding: 6px 12px;
        background: linear-gradient(130deg, rgba(243,106,50,0.92), rgba(255,146,87,0.9));
        color: #fff7f2;
        text-decoration: none;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.01em;
        box-shadow: 0 12px 24px rgba(243,106,50,0.22);
        transition: filter 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
      }
      .b44-export-done-support:hover {
        filter: brightness(1.05);
        transform: translateY(-1px);
        box-shadow: 0 16px 28px rgba(243,106,50,0.3);
      }
      .b44-review-prompt {
        margin-top: 18px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(8px);
      }
      .b44-review-prompt-copy {
        display: grid;
        gap: 4px;
      }
      .b44-review-prompt-title {
        font-size: 14px;
        font-weight: 800;
        color: #ffffff;
      }
      .b44-review-prompt-sub {
        font-size: 12px;
        line-height: 1.45;
        color: rgba(240,246,255,0.78);
      }
      .b44-review-prompt-actions {
        display: flex;
        gap: 10px;
        margin-top: 8px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .b44-review-btn {
        min-height: 36px;
        border-radius: 999px;
        padding: 8px 14px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease, border-color 0.18s ease;
      }
      .b44-review-btn:hover {
        filter: brightness(1.05);
        transform: translateY(-1px);
      }
      .b44-review-btn-primary {
        flex: 0 0 auto;
        min-width: 170px;
        border-color: rgba(255,205,180,0.32);
        background: linear-gradient(130deg, rgba(243,106,50,0.96), rgba(255,146,87,0.92));
        color: #fff8f3;
        box-shadow: 0 12px 24px rgba(243,106,50,0.2);
      }
      .b44-review-btn-secondary {
        flex: 0 0 auto;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.08);
        color: rgba(244,248,255,0.9);
      }
      .b44-review-prompt-footer {
        margin-top: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .b44-review-link {
        padding: 0;
        border: none;
        background: transparent;
        color: rgba(231,239,252,0.72);
        font-size: 11px;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: rgba(231,239,252,0.28);
        text-underline-offset: 0.18em;
        cursor: pointer;
      }
      .b44-review-link:hover {
        color: rgba(250,252,255,0.92);
        text-decoration-color: rgba(250,252,255,0.42);
      }
      .b44-export-done-spark {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #ffb286;
        opacity: 0;
        animation: b44-spark 0.9s ease-out forwards;
      }
      .b44-export-done-spark-a { top: 10px; right: 32px; }
      .b44-export-done-spark-b { top: 34px; right: 14px; animation-delay: 0.08s; }
      .b44-export-done-spark-c { top: 18px; right: 52px; animation-delay: 0.13s; }
      @keyframes b44-spark {
        0% { transform: translate(0, 0) scale(0.7); opacity: 0; }
        25% { opacity: 1; }
        100% { transform: translate(10px, -8px) scale(0.2); opacity: 0; }
      }
      .b44-modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(27,31,59,0.4); backdrop-filter: blur(4px); z-index:2147483647; display:flex; align-items:center; justify-content:center; opacity:0; transition: opacity 0.3s ease; }
      .b44-modal { background:white; padding:24px; border-radius:16px; width:min(420px,90vw); max-height:80vh; box-shadow:0 10px 30px rgba(0,0,0,0.2); text-align:left; transform:scale(0.9); transition: transform 0.3s ease; display:flex; flex-direction:column; }
      .b44-modal-overlay.active { opacity: 1; }
      .b44-modal-overlay.active .b44-modal { transform: scale(1); }
      .b44-title { font-size: 20px; font-weight: 800; color: #1B1F3B; margin-bottom: 8px; }
      .b44-file-actions { display:flex; align-items:center; gap:8px; margin: 0 0 10px; }
      .b44-link-btn { border:none; background:transparent; color:#f36a32; font-size:12px; font-weight:700; cursor:pointer; padding:0; }
      .b44-link-btn:hover { text-decoration: underline; }
      .b44-file-actions-sep { color:#94a3b8; font-size:12px; }
      .b44-msg { font-size: 13px; color: #666; margin-bottom: 16px; line-height: 1.5; max-height:300px; overflow-y:auto; padding-right:4px; }
      .b44-btns { display: flex; gap: 12px; }
      .b44-btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
      .b44-btn-cancel { background: #E0E4E8; color: #1B1F3B; }
      .b44-btn-close { background: linear-gradient(130deg, #f36a32, #ff9257); color: white; }
      .b44-btn:hover { filter: brightness(0.9); }
    `,document.head.appendChild(e)}showWarningModal(){const e=document.createElement("div");e.className="b44-modal-overlay";const t=chrome.i18n.getMessage("warningTitle")||"Warning!",n=chrome.i18n.getMessage("warningMessage")||"Closing this page will lose all extraction progress. Are you sure you want to leave?",o=chrome.i18n.getMessage("cancelBtn")||"Cancel",r=chrome.i18n.getMessage("closeAnywayBtn")||"Close Anyway";e.innerHTML=`
      <div class="b44-modal">
        <div class="b44-title">${t}</div>
        <div class="b44-msg">${n}</div>
        <div class="b44-btns">
          <button class="b44-btn b44-btn-cancel">${o}</button>
          <button class="b44-btn b44-btn-close">${r}</button>
        </div>
      </div>
    `,document.body.appendChild(e),setTimeout(()=>e.classList.add("active"),10),e.querySelector(".b44-btn-cancel").onclick=()=>{e.classList.remove("active"),setTimeout(()=>e.remove(),300)},e.querySelector(".b44-btn-close").onclick=()=>{this.isExtracting=!1,window.location.reload()}}}const downloader=new Base44Downloader;
