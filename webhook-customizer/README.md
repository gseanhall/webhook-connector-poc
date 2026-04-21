# AppNeta Webhook Payload Customizer

A standalone tool for building, validating, and testing custom webhook payload templates with Handlebars.js support.

## Quick Start

```bash
GEMINI_API_KEY=YOUR-GEMINI-KEY python3 serve.py
```

Opens automatically at [http://localhost:8080](http://localhost:8080). Pass a custom port if needed:

```bash
GEMINI_API_KEY=YOUR-GEMINI-KEY python3 serve.py 3000
```

## Requirements

- Python 3.6+ (standard library only, no pip packages)
- A modern browser (Chrome, Firefox, Edge, Safari)
- Internet connection for CDN resources (React, Handlebars, fonts) on first load

## Features

- **Starter Templates** — Default, Slack, Splunk HEC, PagerDuty, MS Teams
- **AI Template Builder** — Paste a target JSON structure with inline comments, Claude maps AppNeta fields into it (requires Anthropic API access via claude.ai)
- **Handlebars.js Templates** — Full support for variables, conditionals, value mapping, and custom helpers
- **Template Validation** — Handlebars syntax check, JSON structure validation, rendered output preview
- **Webhook Tester** — Configure test targets, send rendered payloads, copy cURL commands
- **Autocomplete** — Type `{{` in the editor for inline field suggestions
- **Persistent Storage** — Test targets saved to localStorage, exportable/importable as JSON

## Available Handlebars Helpers

| Helper | Example | Description |
|--------|---------|-------------|
| `mapValue` | `{{mapValue alarmSeverity 'CRITICAL' '1' 'MAJOR' '2'}}` | Value remapping |
| `eq` / `ne` | `{{#if (eq type '1')}}raised{{/if}}` | Equality checks |
| `gt` / `lt` | `{{#if (gt value 100)}}high{{/if}}` | Numeric comparison |
| `or` / `and` | `{{#if (or (eq a '1') (eq b '2'))}}` | Logical operators |
| `lowercase` / `uppercase` | `{{lowercase alarmSeverity}}` | Case transform |
| `dateFormat` | `{{dateFormat raisedTime}}` | ISO → epoch seconds |
| `coalesce` | `{{coalesce clearedTime raisedTime}}` | First truthy value |

## Notes

- When running locally, the **Send** button in the Webhook Tester makes real HTTP requests (not blocked by CSP like in the Claude canvas)
- The **AI Template Builder** modal calls the Anthropic API — this works within Claude artifacts but may need an API key setup for standalone use
- Test target configurations persist in your browser's localStorage
- Use **Export/Import** to back up targets or share across browsers

## File Structure

```
webhook-customizer/
├── index.html    # Complete self-contained app (React + JSX compiled in-browser)
├── serve.py      # Python HTTP server with permissive CSP headers
└── README.md
```
