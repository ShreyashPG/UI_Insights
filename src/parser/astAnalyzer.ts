import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import {
  ASTNode,
  ComponentMetadata,
  ListPattern,
  ConditionalPattern,
} from '../types';

export class ASTAnalyzer {
  private elementTree: ASTNode[] = [];
  private propsUsed: Set<string> = new Set();
  private stateUsed: Set<string> = new Set();
  private listPatterns: ListPattern[] = [];
  private conditionalPatterns: ConditionalPattern[] = [];
  private maxNestingDepth: number = 0;

  analyze(sourceCode: string, componentName: string): ComponentMetadata {
    this.reset();

    const ast = parser.parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      FunctionDeclaration: (path: NodePath<t.FunctionDeclaration>) => {
        if (path.node.id?.name === componentName) {
          this.analyzeFunctionComponent(path);
        }
      },
      VariableDeclarator: (path: NodePath<t.VariableDeclarator>) => {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === componentName &&
          t.isArrowFunctionExpression(path.node.init)
        ) {
          this.analyzeArrowComponent(path);
        }
      },
    });

    return {
      elementTree: this.elementTree,
      propsUsed: Array.from(this.propsUsed),
      stateUsed: Array.from(this.stateUsed),
      listPatterns: this.listPatterns,
      conditionalPatterns: this.conditionalPatterns,
      nestingDepth: this.maxNestingDepth,
    };
  }

  private reset() {
    this.elementTree = [];
    this.propsUsed.clear();
    this.stateUsed.clear();
    this.listPatterns = [];
    this.conditionalPatterns = [];
    this.maxNestingDepth = 0;
  }

  private analyzeFunctionComponent(path: NodePath<t.FunctionDeclaration>) {
    const firstParam = path.node.params[0];
    // Fix TS2345: Guard to ensure param is Identifier or ObjectPattern
    if (firstParam && (t.isIdentifier(firstParam) || t.isObjectPattern(firstParam))) {
      this.extractProps(firstParam);
    }

    path.traverse({
      CallExpression: (callPath: NodePath<t.CallExpression>) => {
        this.analyzeHooks(callPath);
        this.detectListPatterns(callPath);
      },
      JSXElement: (jsxPath: NodePath<t.JSXElement>) => {
        if (jsxPath.parent.type === 'ReturnStatement') {
          this.elementTree.push(this.buildElementTree(jsxPath.node, 0));
        }
      },
      ConditionalExpression: (condPath: NodePath<t.ConditionalExpression>) => {
        this.detectConditionalPatterns(condPath, 'ternary');
      },
      LogicalExpression: (logPath: NodePath<t.LogicalExpression>) => {
        this.detectConditionalPatterns(logPath, 'logical');
      },
    });
  }

  private analyzeArrowComponent(path: NodePath<t.VariableDeclarator>) {
    const init = path.node.init as t.ArrowFunctionExpression;

    const firstParam = init.params[0];
    // Fix TS2345: Guard to ensure param is Identifier or ObjectPattern
    if (firstParam && (t.isIdentifier(firstParam) || t.isObjectPattern(firstParam))) {
      this.extractProps(firstParam);
    }

    if (t.isBlockStatement(init.body)) {
      path.traverse({
        CallExpression: (callPath: NodePath<t.CallExpression>) => {
          this.analyzeHooks(callPath);
          this.detectListPatterns(callPath);
        },
        JSXElement: (jsxPath: NodePath<t.JSXElement>) => {
          if (jsxPath.parent.type === 'ReturnStatement') {
            this.elementTree.push(this.buildElementTree(jsxPath.node, 0));
          }
        },
      });
    } else if (t.isJSXElement(init.body)) {
      this.elementTree.push(this.buildElementTree(init.body, 0));
    }
  }

  private extractProps(param: t.Identifier | t.ObjectPattern) {
    if (t.isObjectPattern(param)) {
      param.properties.forEach((prop) => {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
          this.propsUsed.add(prop.key.name);
        }
      });
    } else if (t.isIdentifier(param)) {
      this.propsUsed.add(param.name);
    }
  }

  private analyzeHooks(path: NodePath<t.CallExpression>) {
    const callee = path.node.callee;
    if (t.isIdentifier(callee) && callee.name === 'useState') {
      const parent = path.parent;
      if (t.isVariableDeclarator(parent) && t.isArrayPattern(parent.id)) {
        parent.id.elements.forEach((elem) => {
          if (t.isIdentifier(elem)) {
            this.stateUsed.add(elem.name);
          }
        });
      }
    }
  }

  private buildElementTree(node: t.JSXElement, depth: number): ASTNode {
    if (depth > this.maxNestingDepth) {
      this.maxNestingDepth = depth;
    }

    const elementName = this.getElementName(node);
    const props = this.extractElementProps(node);
    const children: ASTNode[] = [];

    node.children.forEach((child) => {
      if (t.isJSXElement(child)) {
        children.push(this.buildElementTree(child, depth + 1));
      } else if (t.isJSXExpressionContainer(child)) {
        if (t.isJSXElement(child.expression)) {
          children.push(this.buildElementTree(child.expression, depth + 1));
        }
      }
    });

    return {
      type: elementName,
      name: elementName,
      props,
      children,
      depth,
    };
  }

  private getElementName(node: t.JSXElement): string {
    const openingElement = node.openingElement;

    if (t.isJSXIdentifier(openingElement.name)) {
      return openingElement.name.name;
    }

    if (t.isJSXMemberExpression(openingElement.name)) {
      // Fix TS2339: Use recursive resolver for Member Expressions
      return this.resolveMemberExpression(openingElement.name);
    }

    return 'unknown';
  }

  /**
   * Recursively resolves JSX member expressions (e.g., UI.Button or UI.Theme.Button)
   */
  private resolveMemberExpression(node: t.JSXMemberExpression | t.JSXIdentifier): string {
    if (t.isJSXIdentifier(node)) {
      return node.name;
    }
    if (t.isJSXMemberExpression(node)) {
      // node.object can be another JSXMemberExpression or JSXIdentifier
      const obj = this.resolveMemberExpression(node.object);
      const prop = node.property.name;
      return `${obj}.${prop}`;
    }
    return 'unknown';
  }

  private extractElementProps(node: t.JSXElement): Record<string, any> {
    const props: Record<string, any> = {};
    const openingElement = node.openingElement;

    openingElement.attributes.forEach((attr) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const propName = attr.name.name;

        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            props[propName] = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            props[propName] = '<expression>';
          }
        } else {
          props[propName] = true;
        }
      }
    });

    return props;
  }

  private detectListPatterns(path: NodePath<t.CallExpression>) {
    const callee = path.node.callee;

    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const method = callee.property.name;

      if (method === 'map' || method === 'forEach') {
        this.listPatterns.push({
          type: method,
          itemCount: -1,
          location: `Line ${path.node.loc?.start.line ?? 'unknown'}`,
        });
      }
    }
  }

  private detectConditionalPatterns(
    path: NodePath<t.ConditionalExpression | t.LogicalExpression>,
    type: 'ternary' | 'logical'
  ) {
    this.conditionalPatterns.push({
      type,
      location: `Line ${path.node.loc?.start.line ?? 'unknown'}`,
    });
  }
}