"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const astAnalyzer_1 = require("./parser/astAnalyzer");
const patternDetector_1 = require("./parser/patternDetector");
const aiAgent_1 = require("./agent/aiAgent");
const webview_1 = require("./ui/webview");
// State to hold the most recent refactoring suggestion
let currentRefactoredCode = null;
function activate(context) {
    console.log('UI Insight extension activated');
    const webviewProvider = new webview_1.WebviewProvider();
    /**
     * Command: Analyze Component
     * Triggered to run AST analysis and AI insights on the active React component.
     */
    const analyzeCommand = vscode.commands.registerCommand('ui-insight.analyzeComponent', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const document = editor.document;
        const sourceCode = document.getText();
        // Basic check for React/JSX content
        const isReact = sourceCode.includes('React') ||
            sourceCode.includes('jsx') ||
            document.languageId === 'typescriptreact' ||
            document.languageId === 'javascriptreact';
        if (!isReact) {
            vscode.window.showWarningMessage('This does not appear to be a React component');
            return;
        }
        // Extract component name from filename
        const fileName = document.fileName.split(/[\\/]/).pop() || 'Component';
        const componentName = fileName.replace(/\.(tsx|jsx|ts|js)$/, '');
        vscode.window.showInformationMessage(`Analyzing ${componentName} with AI...`);
        try {
            // 1. Get Configuration
            const config = vscode.workspace.getConfiguration('uiInsight');
            const styleSystem = config.get('styleSystem') || 'tailwind';
            const themeTone = config.get('themeTone') || 'light';
            // Default to 'groq' as requested
            const aiProvider = config.get('aiProvider') || 'groq';
            const apiKey = config.get('apiKey') || '';
            if (!apiKey) {
                vscode.window.showErrorMessage(`Please configure your ${aiProvider.toUpperCase()} API key in settings`);
                return;
            }
            // 2. Local AST Analysis
            const astAnalyzer = new astAnalyzer_1.ASTAnalyzer();
            const metadata = astAnalyzer.analyze(sourceCode, componentName);
            // 3. Local Pattern/Issue Detection
            const patternDetector = new patternDetector_1.PatternDetector();
            const localIssues = patternDetector.detectIssues(metadata.elementTree, metadata.nestingDepth);
            const localPatterns = patternDetector.detectPatterns(metadata.elementTree);
            // 4. Prepare AI Agent Input
            const input = {
                componentName,
                metadata,
                sourceCode,
                preferences: {
                    styleSystem: styleSystem,
                    themeTone: themeTone,
                },
            };
            // 5. Call AI Agent (Now supporting Groq)
            const aiAgent = new aiAgent_1.AIAgent(aiProvider, apiKey);
            const output = await aiAgent.analyze(input);
            // 6. Merge local rule-based analysis with AI-generated output
            output.issues = [...localIssues, ...output.issues];
            output.patternsDetected = [...new Set([...localPatterns, ...output.patternsDetected])];
            // Store the refactored code for the 'applyRefactor' command
            currentRefactoredCode = output.refactoredCode;
            // 7. Render Results in the Webview (FIXED: pass context)
            webviewProvider.showResults(output, componentName, context);
            vscode.window.showInformationMessage('Analysis complete!');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
            console.error('Analysis error:', error);
        }
    });
    /**
     * Command: Apply Refactor
     * Replaces the current editor content with the AI's suggested code.
     */
    const applyRefactorCommand = vscode.commands.registerCommand('ui-insight.applyRefactor', async () => {
        console.log('Apply Refactor command triggered');
        if (!currentRefactoredCode) {
            vscode.window.showWarningMessage('No refactored code available. Please run analysis first.');
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found. Please open the file you want to refactor.');
            return;
        }
        const document = editor.document;
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        const confirmation = await vscode.window.showWarningMessage('This will replace your current code with the AI-optimized version. Make sure you can undo if needed. Continue?', { modal: true }, 'Yes, Apply', 'Cancel');
        if (confirmation === 'Yes, Apply') {
            try {
                const success = await editor.edit((editBuilder) => {
                    editBuilder.replace(fullRange, currentRefactoredCode);
                });
                if (success) {
                    await document.save();
                    vscode.window.showInformationMessage('✅ Refactor applied successfully!');
                }
                else {
                    vscode.window.showErrorMessage('Failed to apply refactor');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error applying refactor: ${error.message}`);
            }
        }
    });
    // Register commands for disposal
    context.subscriptions.push(analyzeCommand, applyRefactorCommand);
}
function deactivate() {
    // Clean up state if necessary
    currentRefactoredCode = null;
}
//# sourceMappingURL=extension.js.map