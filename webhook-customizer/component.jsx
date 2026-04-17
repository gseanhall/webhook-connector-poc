const { useState, useRef, useEffect, useCallback, useMemo } = React;

/* ─── AppNeta field definitions ─── */
const APPNETA_FIELDS = [
  { name: "alarmId", desc: "Unique alarm identifier (UUID)" },
  { name: "alarmSeverity", desc: "Alarm severity (CRITICAL, MAJOR, MINOR, INFO)" },
  { name: "alarmType", desc: "Alarm type (e.g. QUALITY_OF_SERVICE)" },
  { name: "clearedTime", desc: "Alarm cleared timestamp" },
  { name: "connectorId", desc: "Connector ID" },
  { name: "connectorName", desc: "Connector name" },
  { name: "connectorType", desc: "Connector type (e.g. WEBHOOK)" },
  { name: "description", desc: "Alarm description / condition message" },
  { name: "firstViolationTime", desc: "First violation timestamp" },
  { name: "itemId", desc: "Monitored item ID" },
  { name: "itemName", desc: "Monitored item name (path name)" },
  { name: "itemType", desc: "Monitored item type (e.g. NETWORK_PATH)" },
  { name: "monitoringPointId", desc: "Monitoring point ID" },
  { name: "monitoringPointName", desc: "Monitoring point name" },
  { name: "noisyConditions", desc: "Noisy condition flags (array)" },
  { name: "orgId", desc: "Organization ID" },
  { name: "providerLink", desc: "Link to alarm details in AppNeta" },
  { name: "raisedTime", desc: "Alarm raised timestamp" },
  { name: "rule", desc: "Alarm rule name" },
  { name: "ruleId", desc: "Alarm rule ID" },
  { name: "state", desc: "Alarm state (RAISED, CLEARED)" },
  { name: "tags", desc: "Tags array ({category, value} objects)" },
  { name: "target", desc: "Target IP / FQDN / URL" },
];

/* ─── Built-in templates ─── */
const TEMPLATES = {
  default: {
    label: "Default",
    body: `{
  "alarmId": "{{alarmId}}",
  "alarmSeverity": "{{alarmSeverity}}",
  "alarmType": "{{alarmType}}",
  "clearedTime": "{{clearedTime}}",
  "connectorId": "{{connectorId}}",
  "connectorName": "{{connectorName}}",
  "connectorType": "{{connectorType}}",
  "description": "{{description}}",
  "firstViolationTime": "{{firstViolationTime}}",
  "itemId": "{{itemId}}",
  "itemName": "{{itemName}}",
  "itemType": "{{itemType}}",
  "monitoringPointId": "{{monitoringPointId}}",
  "monitoringPointName": "{{monitoringPointName}}",
  "orgId": "{{orgId}}",
  "providerLink": "{{providerLink}}",
  "raisedTime": "{{raisedTime}}",
  "rule": "{{rule}}",
  "ruleId": "{{ruleId}}",
  "state": "{{state}}",
  "target": "{{target}}"
}`,
  },
  slack: {
    label: "Slack",
    body: `{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "AppNeta Alarm: {{rule}}"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Status:* {{state}}" },
        { "type": "mrkdwn", "text": "*Severity:* {{alarmSeverity}}" }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "{{description}}"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Details" },
          "url": "{{providerLink}}"
        }
      ]
    }
  ]
}`,
  },
  splunk: {
    label: "Splunk HEC",
    body: `{
  "event": {
    "message": "{{description}}",
    "severity": "{{alarmSeverity}}",
    "source": "appneta",
    "sourcetype": "alarm",
    "fields": {
      "alarm_id": "{{alarmId}}",
      "rule_name": "{{rule}}",
      "target_host": "{{target}}",
      "status": "{{state}}",
      "timestamp": "{{raisedTime}}",
      "item_name": "{{itemName}}",
      "monitoring_point": "{{monitoringPointName}}"
    }
  },
  "host": "appneta",
  "source": "webhook",
  "sourcetype": "_json"
}`,
  },
  pagerduty: {
    label: "PagerDuty",
    body: `{
  "routing_key": "YOUR_ROUTING_KEY",
  "event_action": "trigger",
  "dedup_key": "{{alarmId}}",
  "payload": {
    "summary": "{{rule}}: {{description}}",
    "source": "appneta",
    "severity": "{{alarmSeverity}}",
    "component": "{{itemName}}",
    "group": "{{monitoringPointName}}",
    "class": "{{itemType}}",
    "custom_details": {
      "alarm_id": "{{alarmId}}",
      "target": "{{target}}",
      "monitoring_point": "{{monitoringPointName}}"
    }
  },
  "links": [
    {
      "href": "{{providerLink}}",
      "text": "View in AppNeta"
    }
  ]
}`,
  },
  teams: {
    label: "MS Teams",
    body: `{
  "@type": "MessageCard",
  "@context": "http://schema.org/extensions",
  "themeColor": "FF0000",
  "summary": "AppNeta Alarm: {{rule}}",
  "sections": [
    {
      "activityTitle": "{{rule}}",
      "activitySubtitle": "{{description}}",
      "facts": [
        { "name": "Severity", "value": "{{alarmSeverity}}" },
        { "name": "Item", "value": "{{itemName}}" },
        { "name": "Target", "value": "{{target}}" },
        { "name": "Status", "value": "{{state}}" },
        { "name": "Raised", "value": "{{raisedTime}}" }
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View Alert",
      "targets": [
        { "os": "default", "uri": "{{providerLink}}" }
      ]
    }
  ]
}`,
  },
};

/* ─── Default sample data (matches actual webhook payload) ─── */
const DEFAULT_SAMPLE_DATA = {
  alarmId: "2d91d550-933a-4a91-9e4a-ac90b561350a",
  alarmSeverity: "MAJOR",
  alarmType: "QUALITY_OF_SERVICE",
  clearedTime: "2026-04-17T19:25:02.178+0000",
  connectorId: "752",
  connectorName: "connector1",
  connectorType: "WEBHOOK",
  description: "Data Loss Any (default) is Greater Than Equal To 1 % for 1 out of 1 samples",
  firstViolationTime: "2026-04-17T19:22:01.623+0000",
  itemId: "122045793395906",
  itemName: "P18A06098 - ANN <-> www.groupon.com (single)",
  itemType: "NETWORK_PATH",
  monitoringPointId: "122045790940946",
  monitoringPointName: "P18A06098 - ANN",
  noisyConditions: ["daily", "burst"],
  orgId: "62813",
  providerLink: "https://dev-app-02.pm-dev.appneta.com/pvc/ngp/alarm/2d91d550-933a-4a91-9e4a-ac90b561350a?orgId=62813",
  raisedTime: "2026-04-17T19:24:02.228+0000",
  rule: "mp type filtering",
  ruleId: "3009",
  state: "CLEARED",
  tags: [{ category: "test.cat", value: "99" }],
  target: "www.groupon.com",
};
const DEFAULT_SAMPLE_TEXT = JSON.stringify(DEFAULT_SAMPLE_DATA, null, 2);

const SYSTEM_PROMPT = `You are a webhook payload template builder. The user has a monitoring application (AppNeta) that produces alarm/alert webhook data with these available fields:

${APPNETA_FIELDS.map((f) => `- {{${f.name}}}: ${f.desc}`).join("\n")}

The user will provide a sample JSON payload structure for a target system. The input may contain inline comments (// or /* */) mixed with the JSON — these are instructions from the user telling you how to handle specific fields, value formatting, or structural decisions. Treat every comment as a direct instruction and follow it precisely.

TEMPLATE ENGINE: Handlebars.js
The template engine is Handlebars.js. You may use any valid Handlebars syntax including:

BASIC SUBSTITUTION:
  {{fieldName}} — inserts the field value
  "{{alarmRuleName}}: {{alarmMessage}}" — concatenation within strings

AVAILABLE CUSTOM HELPERS:

  {{#if (eq fieldName 'value')}}...{{else}}...{{/if}}
    Equality comparison. Example:
    {{#if (eq type '1')}}raised{{else}}cleared{{/if}}

  {{mapValue fieldName 'MATCH1' 'result1' 'MATCH2' 'result2' ... 'defaultValue'}}
    Maps a field's value to a different value. If the field matches MATCH1, outputs result1, etc.
    If no match is found and an odd final argument is present, that is the default.
    Example for severity remapping:
    {{mapValue alarmSeverity 'CRITICAL' '1' 'MAJOR' '2' 'MINOR' '3' 'INFO' '4' '0'}}

  {{lowercase fieldName}} — converts to lowercase
  {{uppercase fieldName}} — converts to uppercase
  {{dateFormat fieldName}} — formats ISO timestamp to epoch seconds

  {{#if fieldName}}...{{/if}} — conditional block (truthy check)
  {{#unless fieldName}}...{{/unless}} — inverse conditional
  {{#if (ne fieldName 'value')}}...{{/if}} — not-equal comparison
  {{#if (gt fieldName value)}}...{{/if}} — greater than (numeric)
  {{#if (lt fieldName value)}}...{{/if}} — less than (numeric)
  {{#if (or (eq fieldName 'a') (eq fieldName 'b'))}}...{{/if}} — logical OR
  {{#if (and condition1 condition2)}}...{{/if}} — logical AND
  {{coalesce field1 field2 'fallback'}} — first truthy value

CRITICAL QUOTING RULE:
Because the output is a JSON document, Handlebars helper arguments MUST use SINGLE QUOTES, never double quotes.
Double quotes inside a JSON string value would break the JSON structure.
CORRECT:   "severity": "{{mapValue alarmSeverity 'CRITICAL' '1' 'MAJOR' '2'}}"
WRONG:     "severity": "{{mapValue alarmSeverity "CRITICAL" "1" "MAJOR" "2"}}"
This applies to ALL helpers: mapValue, eq, ne, coalesce, and any helper that takes string arguments.

IMPORTANT RULES:
- Always use SINGLE QUOTES for string arguments inside Handlebars helpers. This is mandatory.
- Always use valid Handlebars syntax. Do NOT invent helpers that aren't listed above.
- Do NOT use {{#switch}}, {{#case}}, or any unlisted block helpers — they don't exist.
- For value remapping/transformation, prefer the {{mapValue ...}} helper — it's the cleanest approach.
- NEVER add disclaimers, commentary, or explanatory text. Return ONLY the JSON template.
- NEVER say the system "doesn't support" conditional logic — it does via Handlebars.

Your job is to:
1. Parse the JSON structure (ignoring comment syntax) and understand its schema and purpose.
2. Read and obey all inline comments as mapping/formatting instructions.
3. Map the AppNeta fields into the appropriate places using Handlebars template syntax.
4. Keep all structural elements, required fixed values, and format-specific keys intact.
5. Use the most semantically appropriate AppNeta field for each slot.
6. Where the target expects display text, compose readable strings from multiple fields.
7. Preserve configuration-specific fields (like routing_key, index, etc.) as placeholders.
8. Use helpers (mapValue, eq, lowercase, etc.) when the user's instructions call for value transformation.

Return ONLY valid JSON — the completed template. No comments, no markdown fences, no explanation, no disclaimers.`;

/* ═══════════════════════════════════════════════════
   Customizer Modal (AI-powered template generator)
   ═══════════════════════════════════════════════════ */
function CustomizerModal({ open, onClose, onApply }) {
  const [inputJson, setInputJson] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const resultRef = useRef(null);

  if (!open) return null;

  const handleTransform = async () => {
    const trimmed = inputJson.trim();
    if (!trimmed) { setError("Paste a sample JSON payload to transform."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          userMessage: `Map AppNeta webhook fields into this target JSON payload structure using {{fieldName}} template syntax. Follow any inline comments as instructions:\n\n${trimmed}`,
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const text = data.text;
      if (!text) throw new Error("Empty response from server");
      let pretty;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {
        const stripped = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        try { pretty = JSON.stringify(JSON.parse(stripped), null, 2); } catch { pretty = stripped; }
      }
      setResult(pretty);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { setError(e.message || "Something went wrong."); }
    finally { setLoading(false); }
  };

  const handleApplyAndClose = () => {
    if (result) { onApply(result); }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", width: "min(780px, 92vw)", maxHeight: "88vh", background: "#fff",
        borderRadius: 10, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
        fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif", color: "#374151",
      }}>
        {/* Modal header */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.01em" }}>AI Template Builder</div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 1 }}>Paste a target payload with inline comments — AI maps AppNeta fields into it</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {/* Input */}
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>Target payload with optional instructions</div>
          <textarea
            value={inputJson}
            onChange={(e) => { setInputJson(e.target.value); setError(null); }}
            placeholder={`Paste your target JSON structure below. You can add\ncomments or instructions anywhere using // or /* */\nto guide how fields get mapped:\n\n{\n  "event": {\n    "summary": "...",  // combine rule name + message here\n    "severity": "...", // use lowercase: info, warning, critical\n    "source": "appneta",\n    "timestamp": "...",\n    /* include all monitoring point details\n       in this details block */\n    "details": {\n      "target": "...",\n      "path": "..."\n    }\n  }\n}`}
            spellCheck={false}
            style={{
              width: "100%", minHeight: 260, background: "#fafbfc", border: "1px solid #d1d5db", borderRadius: 4,
              color: "#1e293b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.55,
              padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
            onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, lineHeight: 1.45 }}>
            Use <code style={{ color: "#2563eb", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>// inline comments</code> or <code style={{ color: "#2563eb", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>/* block comments */</code> to guide field mapping, value formatting, or structural decisions.
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 4, padding: "8px 12px", marginTop: 10, fontSize: 12, color: "#dc2626" }}>
              ⚠ {error}
            </div>
          )}

          {/* Generate */}
          <button onClick={handleTransform} disabled={loading || !inputJson.trim()} style={{
            background: loading ? "#f3f4f6" : "#2563eb", color: loading ? "#9ca3af" : "#fff",
            border: "none", borderRadius: 4, padding: "9px 22px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            cursor: loading || !inputJson.trim() ? "not-allowed" : "pointer", marginTop: 12,
            display: "flex", alignItems: "center", gap: 8, opacity: !inputJson.trim() && !loading ? 0.4 : 1,
          }}>
            {loading && <span style={{ width: 14, height: 14, border: "2px solid #9ca3af", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "cmspin 0.7s linear infinite" }} />}
            {loading ? "Mapping fields..." : "Generate Template"}
          </button>
          <style>{`@keyframes cmspin { to { transform: rotate(360deg); } }`}</style>

          {/* Result */}
          {result && (
            <div ref={resultRef} style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>Generated Template</div>
              <div style={{ background: "#fafbfc", border: "1px solid #d1d5db", borderRadius: 4, padding: 14, overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                <HighlightedJson code={result} />
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "0 0 10px 10px", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "#fff", border: "1px solid #d1d5db", color: "#374151", fontSize: 13, fontWeight: 500, padding: "7px 18px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleApplyAndClose} disabled={!result} style={{
            background: result ? "#2563eb" : "#f3f4f6", color: result ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 4, padding: "7px 20px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            cursor: result ? "pointer" : "not-allowed",
          }}>Apply Template</button>
        </div>
      </div>
    </div>
  );
}

/* ─── JSON syntax highlighter (for the modal) ─── */
function HighlightedJson({ code }) {
  if (!code) return null;
  return (
    <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {code.split("\n").map((line, i) => {
        const segments = [];
        const hbsRegex = /\{\{.*?\}\}/g;
        let match, lastIdx = 0;
        while ((match = hbsRegex.exec(line)) !== null) {
          if (match.index > lastIdx) segments.push({ type: "text", val: line.slice(lastIdx, match.index) });
          const expr = match[0];
          const isBlock = /^\{\{[#/]/.test(expr) || expr === "{{else}}";
          const simpleVar = expr.match(/^\{\{(\w+)\}\}$/);
          const fieldName = simpleVar ? simpleVar[1] : null;
          segments.push({ type: isBlock ? "helper" : "var", val: expr, field: fieldName });
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < line.length) segments.push({ type: "text", val: line.slice(lastIdx) });
        return (
          <div key={i} style={{ minHeight: 19 }}>
            {segments.map((seg, j) =>
              seg.type === "var" || seg.type === "helper" ? (
                <span key={j}
                  title={seg.field ? (APPNETA_FIELDS.find((f) => f.name === seg.field)?.desc || seg.field) : seg.val}
                  style={{
                    background: seg.type === "helper" ? "#f3e8ff" : "#dbeafe",
                    color: seg.type === "helper" ? "#7c3aed" : "#1d4ed8",
                    borderRadius: 3, padding: "1px 4px",
                    fontWeight: 600, cursor: "help",
                    border: `1px solid ${seg.type === "helper" ? "#e9d5ff" : "#bfdbfe"}`,
                  }}>{seg.val}</span>
              ) : (
                <span key={j} style={{ color: "#374151" }}>{seg.val}</span>
              )
            )}
          </div>
        );
      })}
    </pre>
  );
}

/* ═══════════════════════════════════════════════════
   Main AppNeta Connector Page
   ═══════════════════════════════════════════════════ */
function ConnectorPage() {
  const [webhookName, setWebhookName] = useState("WebHook 1");
  const [enabled, setEnabled] = useState(true);
  const [httpMethod, setHttpMethod] = useState("Post");
  const [targetUrl, setTargetUrl] = useState("Foo.com");
  const [auth, setAuth] = useState("None");
  const [body, setBody] = useState(TEMPLATES.default.body);
  const [activeWebhook, setActiveWebhook] = useState(0);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [lintResult, setLintResult] = useState(null); // { ok, errors[] }
  const [handlebarsResult, setHandlebarsResult] = useState(null); // { ok, output, error }
  const [handlebarsReady, setHandlebarsReady] = useState(false);

  // Autocomplete state
  const [acOpen, setAcOpen] = useState(false);
  const [acFilter, setAcFilter] = useState("");
  const [acIndex, setAcIndex] = useState(0);
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });
  const [acTriggerStart, setAcTriggerStart] = useState(null); // cursor position of `{{`
  const [acViaButton, setAcViaButton] = useState(false); // opened via toolbar button
  const bodyRef = useRef(null);
  const acListRef = useRef(null);
  const tplMenuRef = useRef(null);

  // Webhook tester state
  const [testTargets, setTestTargets] = useState([]);
  const [editingTarget, setEditingTarget] = useState(null); // target being edited or 'new'
  const [sendResults, setSendResults] = useState({}); // { [targetId]: { status, statusText, body, time, error } }
  const [sendingId, setSendingId] = useState(null);
  const [testerExpanded, setTesterExpanded] = useState(false);
  const importRef = useRef(null);

  // Editable sample data
  const [sampleExpanded, setSampleExpanded] = useState(false);
  const [sampleDataText, setSampleDataText] = useState(DEFAULT_SAMPLE_TEXT);
  const [sampleDataError, setSampleDataError] = useState(null);
  const sampleData = useMemo(() => {
    try { return JSON.parse(sampleDataText); }
    catch { return DEFAULT_SAMPLE_DATA; }
  }, [sampleDataText]);
  const isSampleCustom = sampleDataText !== DEFAULT_SAMPLE_TEXT;

  const registerHelpers = (Hbs) => {
    if (Hbs._appnetaHelpersRegistered) return;
    // eq: {{#if (eq field "value")}}
    Hbs.registerHelper("eq", (a, b) => a === b);
    // ne: {{#if (ne field "value")}}
    Hbs.registerHelper("ne", (a, b) => a !== b);
    // gt / lt
    Hbs.registerHelper("gt", (a, b) => Number(a) > Number(b));
    Hbs.registerHelper("lt", (a, b) => Number(a) < Number(b));
    // or / and
    Hbs.registerHelper("or", function () {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.some(Boolean);
    });
    Hbs.registerHelper("and", function () {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.every(Boolean);
    });
    // mapValue: {{mapValue field "K1" "V1" "K2" "V2" ... "default"}}
    Hbs.registerHelper("mapValue", function () {
      const args = Array.prototype.slice.call(arguments, 0, -1); // drop options
      const field = args[0];
      for (let i = 1; i < args.length - 1; i += 2) {
        if (String(field) === String(args[i])) return args[i + 1];
      }
      // odd remaining arg = default
      if (args.length > 1 && args.length % 2 === 0) return args[args.length - 1];
      return field;
    });
    // lowercase / uppercase
    Hbs.registerHelper("lowercase", (v) => (v || "").toString().toLowerCase());
    Hbs.registerHelper("uppercase", (v) => (v || "").toString().toUpperCase());
    // dateFormat: ISO string → epoch seconds
    Hbs.registerHelper("dateFormat", (v) => {
      if (!v) return "";
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : Math.floor(d.getTime() / 1000);
    });
    // coalesce: first truthy value
    Hbs.registerHelper("coalesce", function () {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      for (const a of args) { if (a) return a; }
      return "";
    });
    Hbs._appnetaHelpersRegistered = true;
  };

  // Load Handlebars.js (with inline fallback)
  useEffect(() => {
    if (window.Handlebars) { registerHelpers(window.Handlebars); setHandlebarsReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js";
    s.onload = () => { registerHelpers(window.Handlebars); setHandlebarsReady(true); };
    s.onerror = () => {
      // Fallback: minimal Handlebars-compatible compile function (no helpers)
      window.Handlebars = {
        compile: (tpl) => (ctx) => tpl.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const k = key.trim();
          return ctx[k] !== undefined ? ctx[k] : `{{${k}}}`;
        }),
        registerHelper: () => {},
        _appnetaHelpersRegistered: true,
      };
      setHandlebarsReady(true);
    };
    document.head.appendChild(s);
  }, []);

  // ─── Autocomplete logic ───
  const getCaretCoords = useCallback(() => {
    const ta = bodyRef.current;
    if (!ta) return { top: 0, left: 0 };
    // Create mirror div to measure caret position
    const mirror = document.createElement("div");
    const style = window.getComputedStyle(ta);
    const props = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing",
      "wordSpacing", "textIndent", "padding", "border", "boxSizing", "whiteSpace", "wordWrap", "overflowWrap"];
    props.forEach((p) => (mirror.style[p] = style[p]));
    mirror.style.width = ta.offsetWidth + "px";
    mirror.style.position = "absolute";
    mirror.style.left = "-9999px";
    mirror.style.top = "-9999px";
    mirror.style.visibility = "hidden";
    mirror.style.overflow = "hidden";

    const text = ta.value.substring(0, ta.selectionStart);
    mirror.textContent = text;
    const marker = document.createElement("span");
    marker.textContent = "|";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const coords = {
      top: markerRect.top - mirrorRect.top - ta.scrollTop,
      left: markerRect.left - mirrorRect.left - ta.scrollLeft,
    };
    document.body.removeChild(mirror);
    return coords;
  }, []);

  const acFiltered = APPNETA_FIELDS.filter((f) =>
    !acFilter || f.name.toLowerCase().includes(acFilter.toLowerCase()) || f.desc.toLowerCase().includes(acFilter.toLowerCase())
  );

  const closeAc = useCallback(() => {
    setAcOpen(false);
    setAcFilter("");
    setAcIndex(0);
    setAcTriggerStart(null);
    setAcViaButton(false);
  }, []);

  const insertField = useCallback((fieldName, fromButton) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = acTriggerStart;
    const cursorPos = ta.selectionStart;
    let before, after, insert;

    if (fromButton && start === null) {
      // Opened via button — insert full {{fieldName}} at cursor
      before = body.substring(0, cursorPos);
      after = body.substring(cursorPos);
      insert = `{{${fieldName}}}`;
    } else if (start !== null) {
      // Triggered by typing {{ — replace from trigger position
      before = body.substring(0, start);
      after = body.substring(cursorPos);
      insert = `{{${fieldName}}}`;
    } else {
      return;
    }

    const newBody = before + insert + after;
    setBody(newBody);
    closeAc();
    setLintResult(null);
    setHandlebarsResult(null);

    // Restore focus and cursor position
    setTimeout(() => {
      ta.focus();
      const newPos = (before || "").length + insert.length;
      ta.selectionStart = ta.selectionEnd = newPos;
    }, 0);
  }, [body, acTriggerStart, closeAc]);

  const handleBodyChange = useCallback((e) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setBody(val);
    setLintResult(null);
    setHandlebarsResult(null);

    // Check if we just typed `{{`
    if (cursor >= 2 && val.substring(cursor - 2, cursor) === "{{") {
      const coords = getCaretCoords();
      setAcTriggerStart(cursor - 2);
      setAcFilter("");
      setAcIndex(0);
      setAcPos(coords);
      setAcOpen(true);
      setAcViaButton(false);
      return;
    }

    // If autocomplete is open, update filter
    if (acOpen && acTriggerStart !== null && !acViaButton) {
      const typed = val.substring(acTriggerStart + 2, cursor);
      // Close if user deleted back past the trigger or typed `}}`
      if (cursor <= acTriggerStart + 1 || typed.includes("}")) {
        closeAc();
      } else {
        setAcFilter(typed);
        setAcIndex(0);
      }
    }
  }, [acOpen, acTriggerStart, acViaButton, getCaretCoords, closeAc]);

  const handleBodyKeyDown = useCallback((e) => {
    if (!acOpen) return;
    const filtered = APPNETA_FIELDS.filter((f) =>
      !acFilter || f.name.toLowerCase().includes(acFilter.toLowerCase()) || f.desc.toLowerCase().includes(acFilter.toLowerCase())
    );
    if (filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertField(filtered[acIndex].name, acViaButton);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAc();
    }
  }, [acOpen, acFilter, acIndex, acViaButton, insertField, closeAc]);

  // Scroll active item into view
  useEffect(() => {
    if (acOpen && acListRef.current) {
      const item = acListRef.current.children[acIndex];
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [acIndex, acOpen]);

  const handleToolbarInsert = () => {
    const ta = bodyRef.current;
    if (!ta) return;
    ta.focus();
    const cursor = ta.selectionStart;
    const coords = getCaretCoords();
    setAcTriggerStart(null); // null signals "via button"
    setAcFilter("");
    setAcIndex(0);
    setAcPos(coords);
    setAcOpen(true);
    setAcViaButton(true);
  };

  const webhooks = [
    { name: "WebHook 1", status: "green" },
    { name: "WebHook 2", status: "red" },
    { name: "WebHook 3", status: "gray" },
  ];

  const loadTemplate = (key) => {
    if (TEMPLATES[key]) {
      setBody(TEMPLATES[key].body);
      setLintResult(null);
      setHandlebarsResult(null);
    }
    setShowTemplateMenu(false);
  };

  const handleApplyCustomTemplate = (template) => {
    setBody(template);
    setLintResult(null);
    setHandlebarsResult(null);
  };

  // Close template menu on outside click
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handler = (e) => {
      if (tplMenuRef.current && !tplMenuRef.current.contains(e.target)) setShowTemplateMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplateMenu]);

  // ─── Webhook Tester: Storage ───
  const STORAGE_KEY = "webhook-test-targets";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTestTargets(JSON.parse(stored));
    } catch { /* no saved targets yet */ }
  }, []);

  const saveTargets = (targets) => {
    setTestTargets(targets);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(targets)); } catch (e) { console.error("Save failed:", e); }
  };

  const newTarget = () => ({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: "",
    url: "",
    method: "POST",
    headers: [{ key: "Content-Type", value: "application/json" }],
    authType: "none", // none | bearer | header
    authToken: "",
    authHeaderName: "",
    authHeaderValue: "",
  });

  const handleSaveTarget = (target) => {
    const existing = testTargets.findIndex((t) => t.id === target.id);
    let updated;
    if (existing >= 0) {
      updated = [...testTargets];
      updated[existing] = target;
    } else {
      updated = [...testTargets, target];
    }
    saveTargets(updated);
    setEditingTarget(null);
  };

  const handleDeleteTarget = (id) => {
    saveTargets(testTargets.filter((t) => t.id !== id));
    setSendResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleExportTargets = () => {
    const blob = new Blob([JSON.stringify(testTargets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "webhook-test-targets.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTargets = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          // Merge: keep existing, add new by id
          const existingIds = new Set(testTargets.map((t) => t.id));
          const merged = [...testTargets, ...imported.filter((t) => !existingIds.has(t.id))];
          saveTargets(merged);
        }
      } catch { alert("Invalid JSON file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const renderPayload = () => {
    if (!window.Handlebars || !body.trim()) return null;
    try {
      const processed = preprocessTemplate(body);
      const template = window.Handlebars.compile(processed);
      return template(sampleData);
    } catch { return null; }
  };

  const [copyFeedback, setCopyFeedback] = useState({}); // { [key]: true }
  const flashCopy = (key) => {
    setCopyFeedback((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopyFeedback((p) => ({ ...p, [key]: false })), 1600);
  };

  const generateCurl = (target) => {
    const payload = renderPayload();
    if (!payload) return null;
    const parts = [`curl -X ${target.method}`];
    parts.push(`  '${target.url}'`);
    // Headers
    const allHeaders = {};
    target.headers.forEach((h) => { if (h.key?.trim()) allHeaders[h.key.trim()] = h.value; });
    if (target.authType === "bearer" && target.authToken) {
      allHeaders["Authorization"] = `Bearer ${target.authToken}`;
    } else if (target.authType === "header" && target.authHeaderName) {
      allHeaders[target.authHeaderName] = target.authHeaderValue;
    }
    Object.entries(allHeaders).forEach(([k, v]) => {
      parts.push(`  -H '${k}: ${v}'`);
    });
    // Escape single quotes in payload for shell
    const escaped = payload.replace(/'/g, "'\\''");
    parts.push(`  -d '${escaped}'`);
    return parts.join(" \\\n");
  };

  const handleCopyCurl = (target) => {
    const curl = generateCurl(target);
    if (!curl) { alert("Template render failed. Validate first."); return; }
    navigator.clipboard.writeText(curl).then(() => flashCopy(`curl-${target.id}`));
  };

  const handleCopyPayload = (targetKey) => {
    const payload = renderPayload();
    if (!payload) { alert("Template render failed. Validate first."); return; }
    // Pretty-print if valid JSON
    let output;
    try { output = JSON.stringify(JSON.parse(payload), null, 2); } catch { output = payload; }
    navigator.clipboard.writeText(output).then(() => flashCopy(targetKey || "payload-global"));
  };

  const handleSendTest = async (target) => {
    const payload = renderPayload();
    if (!payload) {
      setSendResults((p) => ({ ...p, [target.id]: { error: "Template render failed. Validate first." } }));
      return;
    }
    setSendingId(target.id);
    setSendResults((p) => ({ ...p, [target.id]: null }));
    const startTime = performance.now();
    try {
      const headers = {};
      target.headers.forEach((h) => { if (h.key?.trim()) headers[h.key.trim()] = h.value; });
      if (target.authType === "bearer" && target.authToken) {
        headers["Authorization"] = `Bearer ${target.authToken}`;
      } else if (target.authType === "header" && target.authHeaderName) {
        headers[target.authHeaderName] = target.authHeaderValue;
      }
      const resp = await fetch(target.url, {
        method: target.method,
        headers,
        body: payload,
      });
      const elapsed = Math.round(performance.now() - startTime);
      let respBody;
      try { respBody = await resp.text(); } catch { respBody = "(unable to read response)"; }
      setSendResults((p) => ({
        ...p,
        [target.id]: { status: resp.status, statusText: resp.statusText, body: respBody, time: elapsed },
      }));
    } catch (e) {
      const elapsed = Math.round(performance.now() - startTime);
      setSendResults((p) => ({
        ...p,
        [target.id]: { error: e.message || "Network error", time: elapsed },
      }));
    } finally {
      setSendingId(null);
    }
  };

  // Pre-process template: unescape \" to " inside {{...}} expressions
  // This handles the case where users paste JSON-escaped quotes inside Handlebars helpers
  const preprocessTemplate = (tpl) => {
    return tpl.replace(/\{\{(.*?)\}\}/g, (match, inner) => {
      // Replace escaped double quotes with single quotes inside Handlebars expressions
      const fixed = inner.replace(/\\"/g, "'");
      return `{{${fixed}}}`;
    });
  };

  const handleLint = () => {
    if (!body.trim()) {
      setLintResult({ ok: false, errors: [{ msg: "Body is empty." }] });
      return;
    }
    const results = [];
    let rendered = null;
    const processed = preprocessTemplate(body);
    const wasFixed = processed !== body;

    if (wasFixed) {
      results.push({ msg: 'Auto-fixed: converted escaped quotes (\\") to single quotes (\') inside Handlebars expressions', type: "warn" });
    }

    // Step 1: Handlebars syntax check
    if (window.Handlebars) {
      try {
        const template = window.Handlebars.compile(processed);
        results.push({ msg: "Handlebars syntax is valid", type: "pass" });
        try {
          rendered = template(sampleData);
        } catch (e) {
          results.push({ msg: `Handlebars render error: ${e.message}`, type: "error" });
        }
      } catch (e) {
        const lineMatch = e.message.match(/line (\d+)/i);
        results.push({ msg: `Handlebars syntax error: ${e.message}`, type: "error" });
        if (lineMatch) results.push({ msg: `At line ${lineMatch[1]}`, type: "hint" });
        setLintResult({ ok: false, errors: results });
        return;
      }
    } else {
      results.push({ msg: "Handlebars not loaded — skipping syntax check", type: "warn" });
    }

    // Step 2: JSON structure check (on rendered output if available, else regex-sanitized)
    const jsonSource = rendered || body.replace(/\{\{[^}]*\}\}/g, '"__placeholder__"');
    try {
      JSON.parse(jsonSource);
      results.push({ msg: rendered ? "Rendered output is valid JSON" : "JSON structure appears valid", type: "pass" });
    } catch (e) {
      const posMatch = e.message.match(/position (\d+)/i);
      results.push({ msg: `JSON parse error${rendered ? " in rendered output" : ""}: ${e.message}`, type: "error" });
      if (posMatch && rendered) {
        const pos = parseInt(posMatch[1]);
        // Show context around the error position
        const start = Math.max(0, pos - 30);
        const end = Math.min(rendered.length, pos + 30);
        const ctx = rendered.substring(start, end);
        results.push({ msg: `Near: ...${ctx}...`, type: "hint" });
      }
    }

    // Step 3: Variable / helper recognition
    const knownNames = new Set(APPNETA_FIELDS.map(f => f.name));
    const knownHelpers = new Set(["if", "unless", "each", "with", "else", "eq", "ne", "gt", "lt", "or", "and", "mapValue", "lowercase", "uppercase", "dateFormat", "coalesce"]);
    const varRegex = /\{\{[#/]?(\w+)/g;
    let m;
    const unknowns = [];
    const foundVars = new Set();
    const foundHelpers = new Set();
    while ((m = varRegex.exec(body)) !== null) {
      const name = m[1];
      if (knownNames.has(name)) {
        foundVars.add(name);
      } else if (knownHelpers.has(name)) {
        foundHelpers.add(name);
      } else if (name !== "else") {
        const lineNum = body.substring(0, m.index).split("\n").length;
        unknowns.push({ msg: `Unknown identifier: "${name}"`, line: lineNum, type: "warn" });
      }
    }
    if (unknowns.length > 0) {
      results.push(...unknowns);
    }
    const varCount = foundVars.size;
    const helperCount = foundHelpers.size;
    const parts = [];
    if (varCount > 0) parts.push(`${varCount} field variable(s)`);
    if (helperCount > 0) parts.push(`${helperCount} helper(s): ${[...foundHelpers].join(", ")}`);
    if (parts.length > 0) results.push({ msg: parts.join(" · "), type: "pass" });

    const hasErrors = results.some(r => r.type === "error");
    setLintResult({ ok: !hasErrors, errors: results });
  };

  const handleHandlebarsRender = () => {
    if (!body.trim()) {
      setHandlebarsResult({ ok: false, error: "Body is empty." });
      return;
    }
    if (!window.Handlebars) {
      setHandlebarsResult({ ok: false, error: "Handlebars.js is still loading..." });
      return;
    }
    const processed = preprocessTemplate(body);
    try {
      const template = window.Handlebars.compile(processed);
      const rendered = template(sampleData);
      // Try to parse as JSON for pretty-printing
      let pretty;
      try {
        pretty = JSON.stringify(JSON.parse(rendered), null, 2);
      } catch {
        pretty = rendered;
      }
      setHandlebarsResult({ ok: true, output: pretty });
    } catch (e) {
      setHandlebarsResult({ ok: false, error: `Handlebars compilation error: ${e.message}` });
    }
  };

  const handleValidateAll = () => {
    handleLint();
    handleHandlebarsRender();
  };

  const statusColors = { green: "#22c55e", red: "#ef4444", gray: "#9ca3af" };
  const inputStyle = {
    width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13.5,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif", outline: "none", boxSizing: "border-box", color: "#1e293b",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 };
  const sectionTitle = { fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "22px 0 10px" };

  return (
    <div style={{ fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", color: "#374151" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── Top Nav ─── */}
      <nav style={{ background: "#1e3a5f", color: "#fff", display: "flex", alignItems: "center", height: 44, padding: "0 16px", fontSize: 13.5, gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 28 }}>
          <div style={{ width: 22, height: 22, background: "#22c55e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>A</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>AppNeta</span>
        </div>
        {["Alarms", "Dashboards", "Experience", "Delivery", "Usage", "Reports"].map((item) => (
          <div key={item} style={{ padding: "0 12px", height: 44, display: "flex", alignItems: "center", cursor: "pointer", fontSize: 13, fontWeight: 500, opacity: 0.85, position: "relative" }}>
            {item}{["Alarms", "Dashboards", "Experience", "Delivery", "Usage", "Reports"].includes(item) && <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.6 }}>▼</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, opacity: 0.8 }}>
          <span>⚙</span><span>?</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, background: "#22c55e", borderRadius: "50%", width: 8, height: 8, display: "inline-block" }} />12,000
            <span style={{ fontSize: 10, background: "#ef4444", borderRadius: "50%", width: 8, height: 8, display: "inline-block", marginLeft: 8 }} />12,000
          </div>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>SH</div>
        </div>
      </nav>

      {/* ─── Page Header ─── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18, opacity: 0.4 }}>←</span>
        <span style={{ fontSize: 11, opacity: 0.4, marginRight: 2 }}>⚙</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Connector</h1>
      </div>

      {/* ─── Main Layout ─── */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 100px)" }}>
        {/* Sidebar */}
        <div style={{ width: 180, background: "#fff", borderRight: "1px solid #e5e7eb", padding: "12px 0", flexShrink: 0 }}>
          <button style={{
            margin: "0 12px 12px", background: "#fff", border: "1px solid #2563eb", color: "#2563eb",
            borderRadius: 4, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>Add WebHook</button>
          {webhooks.map((wh, i) => (
            <div key={i} onClick={() => setActiveWebhook(i)} style={{
              padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13,
              background: activeWebhook === i ? "#eff6ff" : "transparent", borderRight: activeWebhook === i ? "3px solid #2563eb" : "3px solid transparent",
              fontWeight: activeWebhook === i ? 600 : 400, color: "#374151",
            }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusColors[wh.status], flexShrink: 0 }} />
              {wh.name}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "0 32px 40px", maxWidth: 860, overflowY: "auto" }}>
          {/* General info bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #e5e7eb", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 600, color: "#374151", fontSize: 14 }}>General</span>
              <span>Last Updated <b>@ Jun 4, 2025 2:21:30 PM</b></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#6b7280" }}>
              <span>ErrorCount: <b>2,000</b></span>
              <span>LastStatus: <b>200</b></span>
              <span>LastSuccess: <b>Jun 4, 2026</b></span>
              <span>LastFailure: <b>Jun 2, 2026</b></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span>FireCount:</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />12,000</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />12,000</span>
            </div>
          </div>

          {/* Name */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <label style={labelStyle}>Name</label>
              <span style={{ fontSize: 11, color: "#ef4444" }}>Required</span>
            </div>
            <input value={webhookName} onChange={(e) => setWebhookName(e.target.value)} style={inputStyle} />
          </div>

          {/* Enabled */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Enabled</label>
            <button onClick={() => setEnabled(!enabled)} style={{
              width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative",
              background: enabled ? "#2563eb" : "#d1d5db", transition: "background 0.2s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2,
                left: enabled ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* HTTP Method + URL */}
          <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
            <div style={{ width: 120 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <label style={labelStyle}>HTTP Method</label>
                <span style={{ fontSize: 10, color: "#ef4444" }}>Required</span>
              </div>
              <select value={httpMethod} onChange={(e) => setHttpMethod(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option>Post</option><option>Put</option><option>Patch</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <label style={labelStyle}>Target URL</label>
                <span style={{ fontSize: 10, color: "#ef4444" }}>Required</span>
              </div>
              <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Auth */}
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Authentication</label>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              {["None", "Basic", "Header", "Bearer token"].map((a) => (
                <label key={a} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="auth" checked={auth === a} onChange={() => setAuth(a)} style={{ accentColor: "#2563eb" }} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* Inventory */}
          <h3 style={sectionTitle}>Inventory</h3>
          <div style={{ fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b>Include</b>
              <button onClick={() => {}} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: "#2563eb" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
              </button>
              <span style={{ color: "#6b7280", fontSize: 12 }}>All Inventory</span>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>Select which items the connector will apply to.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FilterChip label="Add filter..." isAdd />
              <FilterChip label="Severity = All" active />
              <span style={{ fontSize: 12, color: "#2563eb", cursor: "pointer" }}>✕ Clear</span>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <b>Exclude</b>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 8px" }}>Select which items the connector will not apply to.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FilterChip label="Add filter..." isAdd />
              <FilterChip label="Severity = Info" removable />
              <FilterChip label="Network Path = Qux" removable />
              <span style={{ fontSize: 12, color: "#2563eb", cursor: "pointer" }}>✕ Clear</span>
            </div>
          </div>

          {/* Message */}
          <h3 style={sectionTitle}>Message</h3>

          {/* Template loader */}
          <div style={{ marginBottom: 14, position: "relative", display: "inline-block" }} ref={tplMenuRef}>
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              style={{
                background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
                padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
              onMouseLeave={(e) => { if (!showTemplateMenu) { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#374151"; } }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>📄</span>
              Load Starter Template
              <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 2 }}>▼</span>
            </button>

            {showTemplateMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                background: "#fff", border: "1px solid #d1d5db", borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
                padding: "4px 0", width: 240, fontFamily: "inherit",
              }}>
                <div style={{ padding: "6px 12px 4px", fontSize: 10.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Replace body with template
                </div>
                {[
                  { key: "default", label: "Default", desc: "Standard AppNeta webhook" },
                  { key: "slack", label: "Slack", desc: "Block Kit message" },
                  { key: "splunk", label: "Splunk HEC", desc: "HTTP Event Collector" },
                  { key: "pagerduty", label: "PagerDuty", desc: "Events API v2" },
                  { key: "teams", label: "MS Teams", desc: "MessageCard format" },
                ].map((t) => (
                  <div
                    key={t.key}
                    onClick={() => loadTemplate(t.key)}
                    style={{
                      padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "baseline", gap: 8,
                      transition: "background 0.08s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{t.label}</span>
                    <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{t.desc}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />
                <div
                  onClick={() => { setShowTemplateMenu(false); setShowCustomizer(true); }}
                  style={{
                    padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.08s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>✦ Custom (AI Builder)</span>
                  <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Paste &amp; map</span>
                </div>
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <label style={labelStyle}>Body</label>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleToolbarInsert(); }}
                style={{
                  background: "#fff", border: "1px solid #d1d5db", color: "#6b7280", borderRadius: 4,
                  padding: "3px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.color = "#6b7280"; }}
                title="Insert a template variable (or type {{ in the editor)"
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11 }}>{"{}"}</span>
                Insert Variable
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={handleBodyChange}
                onKeyDown={handleBodyKeyDown}
                onBlur={() => { setTimeout(() => { if (acViaButton) return; if (!acListRef.current?.matches(":hover")) closeAc(); }, 150); }}
                spellCheck={false}
                placeholder="Enter your webhook payload template here... Type {{ to insert a variable."
                style={{
                  width: "100%", minHeight: 340, background: "#fafbfc", border: "1px solid #d1d5db", borderRadius: 4,
                  color: "#1e293b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.55,
                  padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              />

              {/* Autocomplete dropdown */}
              {acOpen && (
                <div
                  ref={acListRef}
                  style={{
                    position: "absolute",
                    top: Math.min(acPos.top + 22, 300),
                    left: Math.min(Math.max(acPos.left, 0), 400),
                    width: 320,
                    maxHeight: 220,
                    overflowY: "auto",
                    background: "#fff",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
                    zIndex: 100,
                    padding: "4px 0",
                    fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
                  }}
                >
                  {acFilter === "" && !acViaButton && (
                    <div style={{ padding: "5px 12px 4px", fontSize: 10.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      Type to filter · ↑↓ navigate · Enter to insert
                    </div>
                  )}
                  {acViaButton && (
                    <div style={{ padding: "4px 12px" }}>
                      <input
                        autoFocus
                        value={acFilter}
                        onChange={(e) => { setAcFilter(e.target.value); setAcIndex(0); }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") { e.preventDefault(); setAcIndex((p) => Math.min(p + 1, acFiltered.length - 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setAcIndex((p) => Math.max(p - 1, 0)); }
                          else if (e.key === "Enter" && acFiltered.length > 0) { e.preventDefault(); insertField(acFiltered[acIndex].name, true); }
                          else if (e.key === "Escape") { e.preventDefault(); closeAc(); bodyRef.current?.focus(); }
                        }}
                        placeholder="Search fields..."
                        style={{
                          width: "100%", padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: 3,
                          fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#1e293b",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                        onBlur={() => { setTimeout(() => { if (!acListRef.current?.matches(":hover") && !acListRef.current?.contains(document.activeElement)) closeAc(); }, 150); }}
                      />
                    </div>
                  )}
                  {acFiltered.map((f, i) => (
                    <div
                      key={f.name}
                      onMouseDown={(e) => { e.preventDefault(); insertField(f.name, acViaButton); }}
                      onMouseEnter={() => setAcIndex(i)}
                      style={{
                        padding: "6px 12px",
                        cursor: "pointer",
                        background: i === acIndex ? "#eff6ff" : "transparent",
                        borderLeft: i === acIndex ? "2px solid #2563eb" : "2px solid transparent",
                        display: "flex", alignItems: "baseline", gap: 8,
                        transition: "background 0.08s",
                      }}
                    >
                      <code style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600,
                        color: i === acIndex ? "#1d4ed8" : "#374151", whiteSpace: "nowrap",
                      }}>
                        {f.name}
                      </code>
                      <span style={{ fontSize: 11.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.desc}
                      </span>
                    </div>
                  ))}
                  {acFiltered.length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>No matching fields</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sample Data */}
          <div style={{ marginTop: 18, marginBottom: 4 }}>
            <div
              onClick={() => setSampleExpanded(!sampleExpanded)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <h3 style={{ ...sectionTitle, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, transform: sampleExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                Sample Data
                {sampleDataError && <span style={{ fontSize: 11, fontWeight: 500, color: "#dc2626" }}>— Invalid JSON</span>}
                {!sampleDataError && isSampleCustom && <span style={{ fontSize: 11, fontWeight: 500, color: "#2563eb" }}>— Custom</span>}
              </h3>
            </div>

            {sampleExpanded && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>
                    Paste a real webhook payload to use for template rendering and test sends.
                  </span>
                  {isSampleCustom && (
                    <button
                      onClick={() => { setSampleDataText(DEFAULT_SAMPLE_TEXT); setSampleDataError(null); setLintResult(null); setHandlebarsResult(null); }}
                      style={{
                        background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
                        padding: "4px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >Reset to Default</button>
                  )}
                  <button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(sampleDataText);
                        setSampleDataText(JSON.stringify(parsed, null, 2));
                        setSampleDataError(null);
                      } catch { /* leave as-is if invalid */ }
                    }}
                    style={{
                      background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
                      padding: "4px 12px", fontSize: 12, fontWeight: 500, cursor: sampleDataError ? "not-allowed" : "pointer",
                      fontFamily: "inherit", opacity: sampleDataError ? 0.4 : 1,
                    }}
                    disabled={!!sampleDataError}
                  >Format JSON</button>
                </div>
                <textarea
                  value={sampleDataText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSampleDataText(val);
                    setLintResult(null);
                    setHandlebarsResult(null);
                    try { JSON.parse(val); setSampleDataError(null); }
                    catch (err) { setSampleDataError(err.message); }
                  }}
                  spellCheck={false}
                  style={{
                    width: "100%", minHeight: 220, background: "#fafbfc",
                    border: `1px solid ${sampleDataError ? "#fca5a5" : "#d1d5db"}`, borderRadius: 4,
                    color: "#1e293b", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.55,
                    padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = sampleDataError ? "#ef4444" : "#2563eb")}
                  onBlur={(e) => (e.target.style.borderColor = sampleDataError ? "#fca5a5" : "#d1d5db")}
                />
                {sampleDataError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>
                    Parse error: {sampleDataError}
                  </div>
                )}
                {!sampleDataError && isSampleCustom && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#6b7280" }}>
                    Using custom sample data. Template will render with these values.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Validation */}
          <h3 style={sectionTitle}>Validation</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={handleValidateAll} style={{
              background: "#2563eb", color: "#fff", border: "none", borderRadius: 4,
              padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6,
            }}>▶ Validate &amp; Render</button>
            <button onClick={handleLint} style={{
              background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
              padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>Validate Template</button>
            <button onClick={handleHandlebarsRender} disabled={!handlebarsReady} style={{
              background: "#fff", border: "1px solid #d1d5db", color: handlebarsReady ? "#374151" : "#9ca3af", borderRadius: 4,
              padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: handlebarsReady ? "pointer" : "not-allowed", fontFamily: "inherit",
            }}>Render Handlebars</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: lintResult && handlebarsResult ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 8 }}>
            {/* Lint Results */}
            {lintResult && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{lintResult.ok ? "✅" : "❌"}</span>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Template Validation</label>
                </div>
                <div style={{
                  background: "#fff", border: `1px solid ${lintResult.ok ? "#86efac" : "#fca5a5"}`,
                  borderRadius: 4, padding: 12, fontSize: 12.5, lineHeight: 1.7,
                }}>
                  {lintResult.errors.map((e, i) => {
                    const color = e.type === "pass" ? "#16a34a" : e.type === "warn" ? "#d97706" : e.type === "hint" ? "#6b7280" : "#dc2626";
                    const icon = e.type === "pass" ? "✓" : e.type === "warn" ? "⚠" : e.type === "hint" ? "→" : "✕";
                    return (
                      <div key={i} style={{ color, display: "flex", alignItems: "flex-start", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                        <span style={{ flexShrink: 0, width: 14, textAlign: "center" }}>{icon}</span>
                        <span>{e.msg}{e.line ? ` (line ${e.line})` : ""}</span>
                      </div>
                    );
                  })}
                  {/* Show fix button if escaped quotes were auto-corrected */}
                  {preprocessTemplate(body) !== body && (
                    <button
                      onClick={() => { setBody(preprocessTemplate(body)); setLintResult(null); setHandlebarsResult(null); }}
                      style={{
                        marginTop: 8, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e",
                        borderRadius: 4, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Fix: Convert escaped quotes (\") → single quotes (') in body
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Handlebars Render */}
            {handlebarsResult && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{handlebarsResult.ok ? "✅" : "❌"}</span>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Handlebars Render</label>
                </div>
                {handlebarsResult.ok ? (
                  <div style={{
                    background: "#fff", border: "1px solid #86efac", borderRadius: 4, padding: 12,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.55,
                    whiteSpace: "pre-wrap", color: "#1e293b", overflowX: "auto", maxHeight: 340, overflowY: "auto",
                  }}>
                    {handlebarsResult.output}
                  </div>
                ) : (
                  <div style={{
                    background: "#fff", border: "1px solid #fca5a5", borderRadius: 4, padding: 12,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.5,
                    color: "#dc2626", whiteSpace: "pre-wrap",
                  }}>
                    {handlebarsResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sample data reference */}
          {(lintResult || handlebarsResult) && (
            <details style={{ marginTop: 8, marginBottom: 8 }}>
              <summary style={{ fontSize: 11.5, color: "#6b7280", cursor: "pointer", fontWeight: 500, userSelect: "none" }}>
                View sample data used for rendering
              </summary>
              <div style={{
                marginTop: 6, background: "#fafbfc", border: "1px solid #e5e7eb", borderRadius: 4, padding: 12,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6,
                whiteSpace: "pre-wrap", color: "#374151", maxHeight: 200, overflowY: "auto",
              }}>
                {JSON.stringify(sampleData, null, 2)}
              </div>
            </details>
          )}

          {/* ═══ Webhook Tester ═══ */}
          <div style={{ marginTop: 28, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <div
              onClick={() => setTesterExpanded(!testerExpanded)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
            >
              <h3 style={{ ...sectionTitle, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, transform: testerExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                Webhook Tester
                <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>
                  {testTargets.length > 0 ? `(${testTargets.length} target${testTargets.length !== 1 ? "s" : ""})` : ""}
                </span>
              </h3>
            </div>

            {testerExpanded && (
              <div style={{ marginTop: 12 }}>
                {/* Toolbar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => setEditingTarget(newTarget())} style={{
                    background: "#2563eb", color: "#fff", border: "none", borderRadius: 4,
                    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>+ Add Target</button>
                  {testTargets.length > 0 && (
                    <button onClick={handleExportTargets} style={{
                      background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
                      padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}>Export</button>
                  )}
                  <button onClick={() => importRef.current?.click()} style={{
                    background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
                    padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  }}>Import</button>
                  <input ref={importRef} type="file" accept=".json" onChange={handleImportTargets} style={{ display: "none" }} />
                  <div style={{ flex: 1 }} />
                  <button onClick={() => handleCopyPayload()} style={{
                    background: copyFeedback["payload-global"] ? "#f0fdf4" : "#fff",
                    border: `1px solid ${copyFeedback["payload-global"] ? "#86efac" : "#d1d5db"}`,
                    color: copyFeedback["payload-global"] ? "#16a34a" : "#374151", borderRadius: 4,
                    padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}>{copyFeedback["payload-global"] ? "✓ Copied" : "Copy Rendered Payload"}</button>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12, marginTop: -6 }}>
                  Uses sample data to render the template. Send directly or copy a cURL command.
                </div>

                {/* Target list */}
                {testTargets.length === 0 && !editingTarget && (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No test targets configured. Click "Add Target" to get started.
                  </div>
                )}

                {testTargets.map((t) => (
                  <div key={t.id} style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                    padding: "10px 14px", marginBottom: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                          background: "#dbeafe", color: "#1d4ed8", borderRadius: 3, padding: "2px 6px",
                          whiteSpace: "nowrap",
                        }}>{t.method}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{t.name || "Untitled"}</span>
                        <span style={{
                          fontSize: 11.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>{t.url}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={() => handleCopyCurl(t)}
                          style={{
                            background: copyFeedback[`curl-${t.id}`] ? "#f0fdf4" : "#fff",
                            border: `1px solid ${copyFeedback[`curl-${t.id}`] ? "#86efac" : "#d1d5db"}`,
                            color: copyFeedback[`curl-${t.id}`] ? "#16a34a" : "#374151",
                            borderRadius: 4, padding: "4px 10px", fontSize: 12, fontWeight: 500,
                            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          }}
                        >
                          {copyFeedback[`curl-${t.id}`] ? "✓ Copied" : "cURL"}
                        </button>
                        <button
                          onClick={() => handleSendTest(t)}
                          disabled={sendingId === t.id}
                          style={{
                            background: sendingId === t.id ? "#f3f4f6" : "#16a34a", color: sendingId === t.id ? "#9ca3af" : "#fff",
                            border: "none", borderRadius: 4, padding: "4px 12px", fontSize: 12, fontWeight: 600,
                            cursor: sendingId === t.id ? "not-allowed" : "pointer", fontFamily: "inherit",
                          }}
                        >
                          {sendingId === t.id ? "Sending..." : "Send"}
                        </button>
                        <button onClick={() => setEditingTarget({ ...t })} style={{
                          background: "#fff", border: "1px solid #d1d5db", color: "#6b7280", borderRadius: 4,
                          padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                        }}>Edit</button>
                        <button onClick={() => handleDeleteTarget(t.id)} style={{
                          background: "#fff", border: "1px solid #d1d5db", color: "#ef4444", borderRadius: 4,
                          padding: "4px 8px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                        }}>✕</button>
                      </div>
                    </div>

                    {/* Send result */}
                    {sendResults[t.id] && (
                      <div style={{ marginTop: 8, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
                        {sendResults[t.id].error ? (
                          <div style={{ fontSize: 12, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>✕</span>
                            <span>{sendResults[t.id].error}</span>
                            {sendResults[t.id].time && <span style={{ color: "#9ca3af" }}>({sendResults[t.id].time}ms)</span>}
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 4 }}>
                              <span style={{
                                fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                                color: sendResults[t.id].status < 300 ? "#16a34a" : sendResults[t.id].status < 400 ? "#d97706" : "#dc2626",
                              }}>
                                {sendResults[t.id].status} {sendResults[t.id].statusText}
                              </span>
                              <span style={{ color: "#9ca3af", fontSize: 11 }}>{sendResults[t.id].time}ms</span>
                            </div>
                            {sendResults[t.id].body && (
                              <details>
                                <summary style={{ fontSize: 11, color: "#6b7280", cursor: "pointer" }}>Response body</summary>
                                <pre style={{
                                  marginTop: 4, background: "#fafbfc", border: "1px solid #e5e7eb", borderRadius: 3,
                                  padding: 8, fontSize: 11, lineHeight: 1.4, fontFamily: "'JetBrains Mono', monospace",
                                  color: "#374151", maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap",
                                }}>{sendResults[t.id].body}</pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* cURL preview */}
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 11.5, color: "#6b7280", cursor: "pointer", fontWeight: 500, userSelect: "none" }}>
                        View cURL command
                      </summary>
                      <div style={{ position: "relative", marginTop: 6 }}>
                        <pre style={{
                          background: "#1e293b", borderRadius: 4, padding: "12px 14px",
                          fontSize: 11.5, lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace",
                          color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-all",
                          maxHeight: 200, overflowY: "auto", margin: 0,
                        }}>
                          {generateCurl(t) || "Template render failed — validate first."}
                        </pre>
                        <button
                          onClick={() => handleCopyCurl(t)}
                          style={{
                            position: "absolute", top: 6, right: 6,
                            background: copyFeedback[`curl-${t.id}`] ? "#16a34a" : "rgba(255,255,255,0.12)",
                            border: "none", borderRadius: 3, padding: "3px 8px",
                            fontSize: 11, color: "#fff", cursor: "pointer", fontFamily: "inherit",
                            transition: "all 0.15s",
                          }}
                        >
                          {copyFeedback[`curl-${t.id}`] ? "✓" : "Copy"}
                        </button>
                      </div>
                    </details>
                  </div>
                ))}

                {/* Edit / New target form */}
                {editingTarget && (
                  <TargetEditor
                    target={editingTarget}
                    onSave={handleSaveTarget}
                    onCancel={() => setEditingTarget(null)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
            <button style={{
              background: "#ef4444", color: "#fff", border: "none", borderRadius: 4,
              padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Delete</button>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{
                background: "#fff", color: "#2563eb", border: "1px solid #d1d5db", borderRadius: 4,
                padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 4,
                padding: "8px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Customizer Modal */}
      <CustomizerModal
        open={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        onApply={handleApplyCustomTemplate}
      />
    </div>
  );
}

/* ─── Reusable filter chip ─── */
function FilterChip({ label, active, removable, isAdd }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: isAdd ? "#fff" : active ? "#dbeafe" : "#f3f4f6",
      border: `1px solid ${isAdd ? "#d1d5db" : active ? "#93c5fd" : "#d1d5db"}`,
      borderRadius: 4, padding: "4px 10px", fontSize: 12, color: isAdd ? "#6b7280" : "#374151",
      cursor: "pointer",
    }}>
      {isAdd && <span style={{ color: "#6b7280", marginRight: 2 }}>▼</span>}
      {!isAdd && <span style={{ color: "#6b7280", marginRight: 2 }}>▼</span>}
      {label}
      {removable && <span style={{ marginLeft: 4, color: "#9ca3af", fontWeight: 700 }}>✕</span>}
    </div>
  );
}

/* ─── Target editor form ─── */
function TargetEditor({ target, onSave, onCancel }) {
  const [t, setT] = useState({ ...target });
  const update = (key, val) => setT((p) => ({ ...p, [key]: val }));
  const updateHeader = (i, key, val) => {
    const h = [...t.headers];
    h[i] = { ...h[i], [key]: val };
    setT((p) => ({ ...p, headers: h }));
  };
  const addHeader = () => setT((p) => ({ ...p, headers: [...p.headers, { key: "", value: "" }] }));
  const removeHeader = (i) => setT((p) => ({ ...p, headers: p.headers.filter((_, j) => j !== i) }));

  const fieldFont = "'Source Sans 3', 'Segoe UI', system-ui, sans-serif";
  const inp = {
    width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13,
    fontFamily: fieldFont, outline: "none", boxSizing: "border-box", color: "#1e293b",
  };
  const lbl = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 3 };

  return (
    <div style={{
      background: "#f9fafb", border: "1px solid #d1d5db", borderRadius: 6, padding: 16, marginBottom: 10,
      fontFamily: fieldFont,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
        {target.name ? `Edit: ${target.name}` : "New Test Target"}
      </div>

      {/* Name + Method */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Name</label>
          <input value={t.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Slack #alerts" style={inp} />
        </div>
        <div style={{ width: 100 }}>
          <label style={lbl}>Method</label>
          <select value={t.method} onChange={(e) => update("method", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            <option>POST</option><option>PUT</option><option>PATCH</option>
          </select>
        </div>
      </div>

      {/* URL */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>URL</label>
        <input
          value={t.url} onChange={(e) => update("url", e.target.value)}
          placeholder="https://hooks.slack.com/services/T00.../B00.../xxxx"
          style={{ ...inp, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
        />
      </div>

      {/* Auth */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Authentication</label>
        <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 6 }}>
          {[
            { val: "none", label: "None" },
            { val: "bearer", label: "Bearer Token" },
            { val: "header", label: "Custom Header" },
          ].map((a) => (
            <label key={a.val} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="radio" name={`auth-${t.id}`} checked={t.authType === a.val} onChange={() => update("authType", a.val)} style={{ accentColor: "#2563eb" }} />
              {a.label}
            </label>
          ))}
        </div>
        {t.authType === "bearer" && (
          <input value={t.authToken || ""} onChange={(e) => update("authToken", e.target.value)} placeholder="Bearer token" style={{ ...inp, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
        )}
        {t.authType === "header" && (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={t.authHeaderName || ""} onChange={(e) => update("authHeaderName", e.target.value)} placeholder="Header name" style={{ ...inp, flex: 1 }} />
            <input value={t.authHeaderValue || ""} onChange={(e) => update("authHeaderValue", e.target.value)} placeholder="Header value" style={{ ...inp, flex: 2, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
          </div>
        )}
      </div>

      {/* Headers */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={lbl}>Headers</label>
          <button onClick={addHeader} style={{
            background: "none", border: "none", color: "#2563eb", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", padding: 0,
          }}>+ Add header</button>
        </div>
        {t.headers.map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
            <input value={h.key} onChange={(e) => updateHeader(i, "key", e.target.value)} placeholder="Key" style={{ ...inp, flex: 1, fontSize: 12 }} />
            <input value={h.value} onChange={(e) => updateHeader(i, "value", e.target.value)} placeholder="Value" style={{ ...inp, flex: 2, fontSize: 12 }} />
            <button onClick={() => removeHeader(i)} style={{
              background: "none", border: "none", color: "#9ca3af", fontSize: 14, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}>✕</button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{
          background: "#fff", border: "1px solid #d1d5db", color: "#374151", borderRadius: 4,
          padding: "6px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>Cancel</button>
        <button
          onClick={() => onSave(t)}
          disabled={!t.name.trim() || !t.url.trim()}
          style={{
            background: t.name.trim() && t.url.trim() ? "#2563eb" : "#d1d5db",
            color: t.name.trim() && t.url.trim() ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 4, padding: "6px 18px", fontSize: 13, fontWeight: 600,
            cursor: t.name.trim() && t.url.trim() ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}
        >Save Target</button>
      </div>
    </div>
  );
}
