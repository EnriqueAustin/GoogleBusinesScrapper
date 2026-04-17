(() => {
  const script = document.currentScript;
  const mode = script?.dataset?.b44Mode;
  const requestEvent = script?.dataset?.b44RequestEvent;
  const responseEvent = script?.dataset?.b44ResponseEvent;
  const eventName = script?.dataset?.b44Event;

  if (mode === "telemetry-helper") {
    if (!requestEvent || !responseEvent || window.__b44TestAnonUpload) return;

    window.__b44TestAnonUpload = (overrides = {}) => {
      const requestId = `b44_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return new Promise((resolve, reject) => {
        const onResponse = (event) => {
          const detail = event.detail || {};
          if (detail.requestId !== requestId) return;

          window.removeEventListener(responseEvent, onResponse);

          if (detail.ok) {
            resolve(detail.result);
            return;
          }

          reject(detail.error || "Telemetry test failed");
        };

        window.addEventListener(responseEvent, onResponse);
        window.dispatchEvent(new CustomEvent(requestEvent, {
          detail: { requestId, overrides }
        }));
      });
    };

    return;
  }

  if (!eventName) return;

  let detail = null;
  try {
    const editors = window?.monaco?.editor?.getEditors?.() || [];
    const visible =
      editors.find((editor) => {
        const node = editor?.getDomNode?.();
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) || editors[0];

    const model = visible?.getModel?.();
    if (model) {
      detail = {
        uri: String(model.uri || ""),
        value: typeof model.getValue === "function" ? model.getValue() : ""
      };
    }
  } catch {
    detail = null;
  }

  document.dispatchEvent(new CustomEvent(eventName, { detail }));
})();
