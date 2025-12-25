

import * as vscode from 'vscode';
import { ASTAnalyzer } from './parser/astAnalyzer';
import { PatternDetector } from './parser/patternDetector';
import { AIAgent } from './agent/aiAgent';
import { WebviewProvider } from './ui/webview';
import { ComponentInput, UIInsightOutput } from './types';

// State to hold the most recent refactoring suggestion
let currentRefactoredCode: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('UI Insight extension activated');

  const webviewProvider = new WebviewProvider();

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
      const styleSystem = config.get<string>('styleSystem') || 'tailwind';
      const themeTone = config.get<string>('themeTone') || 'light';
      
      // Default to 'groq' as requested
      const aiProvider = config.get<string>('aiProvider') || 'groq'; 
      const apiKey = config.get<string>('apiKey') || '';

      if (!apiKey) {
        vscode.window.showErrorMessage(`Please configure your ${aiProvider.toUpperCase()} API key in settings`);
        return;
      }

      // 2. Local AST Analysis
      const astAnalyzer = new ASTAnalyzer();
      const metadata = astAnalyzer.analyze(sourceCode, componentName);

      // 3. Local Pattern/Issue Detection
      const patternDetector = new PatternDetector();
      const localIssues = patternDetector.detectIssues(metadata.elementTree, metadata.nestingDepth);
      const localPatterns = patternDetector.detectPatterns(metadata.elementTree);

      // 4. Prepare AI Agent Input
      const input: ComponentInput = {
        componentName,
        metadata,
        sourceCode,
        preferences: {
          styleSystem: styleSystem as any,
          themeTone: themeTone as any,
        },
      };

      // 5. Call AI Agent (Now supporting Groq)
      const aiAgent = new AIAgent(aiProvider, apiKey);
      const output = await aiAgent.analyze(input);

      // 6. Merge local rule-based analysis with AI-generated output
      output.issues = [...localIssues, ...output.issues];
      output.patternsDetected = [...new Set([...localPatterns, ...output.patternsDetected])];

      // Store the refactored code for the 'applyRefactor' command
      currentRefactoredCode = output.refactoredCode;

      // 7. Render Results in the Webview (FIXED: pass context)
      webviewProvider.showResults(output, componentName, context);

      vscode.window.showInformationMessage('Analysis complete!');
    } catch (error: any) {
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
    const fullRange = new vscode.Range(
        document.positionAt(0), 
        document.positionAt(document.getText().length)
    );

    const confirmation = await vscode.window.showWarningMessage(
      'This will replace your current code with the AI-optimized version. Make sure you can undo if needed. Continue?',
      { modal: true },
      'Yes, Apply',
      'Cancel'
    );

    if (confirmation === 'Yes, Apply') {
      try {
        const success = await editor.edit((editBuilder) => {
          editBuilder.replace(fullRange, currentRefactoredCode!);
        });

        if (success) {
          await document.save();
          vscode.window.showInformationMessage('✅ Refactor applied successfully!');
        } else {
          vscode.window.showErrorMessage('Failed to apply refactor');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error applying refactor: ${error.message}`);
      }
    }
  });

  // Register commands for disposal
  context.subscriptions.push(analyzeCommand, applyRefactorCommand);
}

export function deactivate() {
    // Clean up state if necessary
    currentRefactoredCode = null;
}
