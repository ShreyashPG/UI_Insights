"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAgent = void 0;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const groq_sdk_1 = __importDefault(require("groq-sdk")); // 1. Import Groq
const promptBuilder_1 = require("./promptBuilder");
class AIAgent {
    constructor(provider, apiKey) {
        this.provider = provider;
        this.promptBuilder = new promptBuilder_1.PromptBuilder();
        // 3. Initialize based on provider
        if (provider === 'openai') {
            this.openai = new openai_1.default({ apiKey });
        }
        else if (provider === 'anthropic') {
            this.anthropic = new sdk_1.default({ apiKey });
        }
        else if (provider === 'groq') {
            this.groq = new groq_sdk_1.default({ apiKey });
        }
    }
    async analyze(input) {
        const prompt = this.promptBuilder.buildAnalysisPrompt(input);
        try {
            let response;
            if (this.provider === 'openai' && this.openai) {
                response = await this.callOpenAI(prompt);
            }
            else if (this.provider === 'anthropic' && this.anthropic) {
                response = await this.callAnthropic(prompt);
            }
            else if (this.provider === 'groq' && this.groq) {
                // 4. Route to Groq handler
                response = await this.callGroq(prompt);
            }
            else {
                throw new Error(`Provider ${this.provider} is not configured correctly.`);
            }
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('AI analysis failed:', error);
            return this.getFallbackOutput();
        }
    }
    // Groq Implementation (OpenAI Compatible)
    async callGroq(prompt) {
        const completion = await this.groq.chat.completions.create({
            // Llama 3.3 70B is excellent for UI and code analysis
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are a UI analysis expert. Return only valid JSON responses.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.2,
            // Groq supports JSON mode for structured output
            response_format: { type: 'json_object' },
        });
        return completion.choices[0].message.content || '{}';
    }
    async callOpenAI(prompt) {
        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: 'You are a UI analysis expert. Return only valid JSON responses.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
        });
        return completion.choices[0].message.content || '{}';
    }
    async callAnthropic(prompt) {
        const message = await this.anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const content = message.content[0];
        return content.type === 'text' ? content.text : '{}';
    }
    parseResponse(response) {
        const cleanedResponse = response.replace(/```json\n?|```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedResponse);
        return {
            patternsDetected: Array.isArray(parsed.patternsDetected) ? parsed.patternsDetected : [],
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
            refactoredCode: parsed.refactoredCode || null,
        };
    }
    getFallbackOutput() {
        return {
            patternsDetected: [],
            issues: [{ description: 'AI analysis unavailable. Check API configuration.', location: 'System', severity: 'low' }],
            suggestions: [],
            refactoredCode: null,
        };
    }
}
exports.AIAgent = AIAgent;
//# sourceMappingURL=aiAgent.js.map