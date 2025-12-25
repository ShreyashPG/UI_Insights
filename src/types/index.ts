export interface ASTNode {
  type: string;
  name: string;
  props: Record<string, any>;
  children: ASTNode[];
  depth: number;
}

export interface ListPattern {
  type: 'map' | 'forEach' | 'manual';
  itemCount: number;
  location: string;
}

export interface ConditionalPattern {
  type: 'ternary' | 'logical' | 'if-statement';
  location: string;
}

export interface ComponentMetadata {
  elementTree: ASTNode[];
  propsUsed: string[];
  stateUsed: string[];
  listPatterns: ListPattern[];
  conditionalPatterns: ConditionalPattern[];
  nestingDepth: number;
}

export interface ComponentInput {
  componentName: string;
  metadata: ComponentMetadata;
  sourceCode: string;
  preferences: {
    styleSystem: 'tailwind' | 'styled-components' | 'css-modules';
    themeTone: 'light' | 'dark';
  };
}

export interface Issue {
  description: string;
  location: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Suggestion {
  type: 'layout' | 'spacing' | 'component' | 'accessibility' | 'visual-hierarchy';
  message: string;
}

export interface UIInsightOutput {
  patternsDetected: string[];
  issues: Issue[];
  suggestions: Suggestion[];
  refactoredCode: string | null;
}
