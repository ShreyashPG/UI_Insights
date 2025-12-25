"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
class PromptBuilder {
    buildAnalysisPrompt(input) {
        return `You are a UI analysis AI agent for the "UI Insight" VS Code extension.

Analyze the following React component and provide actionable UI improvement suggestions.

INPUT:
${JSON.stringify(input, null, 2)}

INSTRUCTIONS:
1. Analyze the component structure, layout patterns, and UI quality
2. Detect issues related to:
   - Excessive div nesting (depth > 5)
   - Missing semantic HTML elements
   - Accessibility problems (missing alt, aria-labels)
   - Inconsistent spacing (non-standard values)
   - Inline styles that should use ${input.preferences.styleSystem}
   - Opportunities for component extraction
   - Non-responsive layouts
3. Provide structured suggestions for improvements
4. If safe to refactor, provide clean JSX code following these rules:
   - Preserve ALL business logic, hooks, handlers, state
   - Maintain prop API stability
   - Use ${input.preferences.styleSystem} for styling
   - Apply consistent spacing scale (4, 8, 12, 16, 20, 24...)
   - Replace nested divs with semantic elements + flex/grid
   - Extract repeated patterns into reusable components
   - Add accessibility attributes where missing
   - Ensure code compiles and renders identically

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown fences):
{
  "patternsDetected": ["pattern1", "pattern2"],
  "issues": [
    {
      "description": "Issue description",
      "location": "Where it occurs",
      "severity": "low" | "medium" | "high"
    }
  ],
  "suggestions": [
    {
      "type": "layout" | "spacing" | "component" | "accessibility" | "visual-hierarchy",
      "message": "Suggestion message"
    }
  ],
  "refactoredCode": "Valid JSX string or null"
}

CRITICAL: Return pure JSON only. The refactoredCode must be a string containing valid JSX or null.`;
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=promptBuilder.js.map