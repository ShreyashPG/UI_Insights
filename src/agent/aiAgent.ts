import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk'; // 1. Import Groq
import { ComponentInput, UIInsightOutput } from '../types';
import { PromptBuilder } from './promptBuilder';

export class AIAgent {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private groq?: Groq; // 2. Add Groq instance
  private provider: string;
  private promptBuilder: PromptBuilder;

  constructor(provider: string, apiKey: string) {
    this.provider = provider;
    this.promptBuilder = new PromptBuilder();

    // 3. Initialize based on provider
    if (provider === 'openai') {
      this.openai = new OpenAI({ apiKey });
    } else if (provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey });
    } else if (provider === 'groq') {
      this.groq = new Groq({ apiKey });
    }
  }

  async analyze(input: ComponentInput): Promise<UIInsightOutput> {
    const prompt = this.promptBuilder.buildAnalysisPrompt(input);

    try {
      let response: string;

      if (this.provider === 'openai' && this.openai) {
        response = await this.callOpenAI(prompt);
      } else if (this.provider === 'anthropic' && this.anthropic) {
        response = await this.callAnthropic(prompt);
      } else if (this.provider === 'groq' && this.groq) {
        // 4. Route to Groq handler
        response = await this.callGroq(prompt);
      } else {
        throw new Error(`Provider ${this.provider} is not configured correctly.`);
      }

      return this.parseResponse(response);
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.getFallbackOutput();
    }
  }

  // Groq Implementation (OpenAI Compatible)
  private async callGroq(prompt: string): Promise<string> {
    const completion = await this.groq!.chat.completions.create({
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

  private async callOpenAI(prompt: string): Promise<string> {
    const completion = await this.openai!.chat.completions.create({
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

  private async callAnthropic(prompt: string): Promise<string> {
    const message = await this.anthropic!.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = message.content[0];
    return content.type === 'text' ? content.text : '{}';
  }

  private parseResponse(response: string): UIInsightOutput {
    const cleanedResponse = response.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedResponse);

    return {
      patternsDetected: Array.isArray(parsed.patternsDetected) ? parsed.patternsDetected : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      refactoredCode: parsed.refactoredCode || null,
    };
  }

  private getFallbackOutput(): UIInsightOutput {
    return {
      patternsDetected: [],
      issues: [{ description: 'AI analysis unavailable. Check API configuration.', location: 'System', severity: 'low' }],
      suggestions: [],
      refactoredCode: null,
    };
  }
}