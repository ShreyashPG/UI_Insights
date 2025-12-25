

import * as vscode from 'vscode';
import { UIInsightOutput } from '../types';

export class WebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  showResults(output: UIInsightOutput, componentName: string, context: vscode.ExtensionContext) {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'uiInsightResults',
        `UI Insight: ${componentName}`,
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    // CRITICAL FIX: Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        console.log('Webview message received:', message);
        if (message.command === 'applyRefactor') {
          vscode.commands.executeCommand('ui-insight.applyRefactor');
        } else if (message.command === 'copyCode') {
          vscode.env.clipboard.writeText(message.code);
          vscode.window.showInformationMessage('Code copied to clipboard!');
        }
      },
      undefined,
      context.subscriptions
    );

    this.panel.webview.html = this.getHtmlContent(output, componentName);
  }

  private getHtmlContent(output: UIInsightOutput, componentName: string): string {
    const issuesByServerity = {
      high: output.issues.filter((i) => i.severity === 'high'),
      medium: output.issues.filter((i) => i.severity === 'medium'),
      low: output.issues.filter((i) => i.severity === 'low'),
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Insight Results</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
    h3 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    .badge-pattern { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .badge-high { background: #f44336; color: white; }
    .badge-medium { background: #ff9800; color: white; }
    .badge-low { background: #2196f3; color: white; }
    .issue-item, .suggestion-item {
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 4px;
      border-left: 3px solid var(--vscode-button-background);
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .issue-high { border-left-color: #f44336; }
    .issue-medium { border-left-color: #ff9800; }
    .issue-low { border-left-color: #2196f3; }
    .location { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
    .code-block {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin-top: 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
      margin-right: 8px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <h1>UI Insight Analysis: ${componentName}</h1>

  <div class="section">
    <h2>Patterns Detected</h2>
    ${
      output.patternsDetected.length > 0
        ? output.patternsDetected.map((p) => `<span class="badge badge-pattern">${p}</span>`).join('')
        : '<p>No specific patterns detected.</p>'
    }
  </div>

  <div class="section">
    <h2>Issues Found (${output.issues.length})</h2>
    ${
      output.issues.length === 0
        ? '<p>No issues found. Component follows good UI practices!</p>'
        : `
        ${
          issuesByServerity.high.length > 0
            ? `
          <h3>High Severity</h3>
          ${issuesByServerity.high
            .map(
              (issue) => `
            <div class="issue-item issue-high">
              <div><strong>${issue.description}</strong></div>
              <div class="location">${issue.location}</div>
            </div>
          `
            )
            .join('')}
        `
            : ''
        }
        ${
          issuesByServerity.medium.length > 0
            ? `
          <h3>Medium Severity</h3>
          ${issuesByServerity.medium
            .map(
              (issue) => `
            <div class="issue-item issue-medium">
              <div><strong>${issue.description}</strong></div>
              <div class="location">${issue.location}</div>
            </div>
          `
            )
            .join('')}
        `
            : ''
        }
        ${
          issuesByServerity.low.length > 0
            ? `
          <h3>Low Severity</h3>
          ${issuesByServerity.low
            .map(
              (issue) => `
            <div class="issue-item issue-low">
              <div><strong>${issue.description}</strong></div>
              <div class="location">${issue.location}</div>
            </div>
          `
            )
            .join('')}
        `
            : ''
        }
      `
    }
  </div>

  <div class="section">
    <h2>Suggestions (${output.suggestions.length})</h2>
    ${
      output.suggestions.length === 0
        ? '<p>No additional suggestions.</p>'
        : output.suggestions
            .map(
              (s) => `
        <div class="suggestion-item">
          <div><span class="badge badge-pattern">${s.type}</span></div>
          <div>${s.message}</div>
        </div>
      `
            )
            .join('')
    }
  </div>

  ${
    output.refactoredCode
      ? `
    <div class="section">
      <h2>Refactored Code</h2>
      <button onclick="applyRefactor()">Apply Refactor</button>
      <button class="secondary" onclick="copyCode()">Copy Code</button>
      <div class="code-block"><pre id="refactoredCode">${this.escapeHtml(output.refactoredCode)}</pre></div>
    </div>
  `
      : ''
  }

  <script>
    const vscode = acquireVsCodeApi();
    
    function applyRefactor() {
      console.log('Apply Refactor button clicked');
      vscode.postMessage({ command: 'applyRefactor' });
    }
    
    function copyCode() {
      const code = document.getElementById('refactoredCode').textContent;
      vscode.postMessage({ 
        command: 'copyCode',
        code: code 
      });
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
