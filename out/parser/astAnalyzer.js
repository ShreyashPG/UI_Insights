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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTAnalyzer = void 0;
const parser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
class ASTAnalyzer {
    constructor() {
        this.elementTree = [];
        this.propsUsed = new Set();
        this.stateUsed = new Set();
        this.listPatterns = [];
        this.conditionalPatterns = [];
        this.maxNestingDepth = 0;
    }
    analyze(sourceCode, componentName) {
        this.reset();
        const ast = parser.parse(sourceCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
        (0, traverse_1.default)(ast, {
            FunctionDeclaration: (path) => {
                if (path.node.id?.name === componentName) {
                    this.analyzeFunctionComponent(path);
                }
            },
            VariableDeclarator: (path) => {
                if (t.isIdentifier(path.node.id) &&
                    path.node.id.name === componentName &&
                    t.isArrowFunctionExpression(path.node.init)) {
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
    reset() {
        this.elementTree = [];
        this.propsUsed.clear();
        this.stateUsed.clear();
        this.listPatterns = [];
        this.conditionalPatterns = [];
        this.maxNestingDepth = 0;
    }
    analyzeFunctionComponent(path) {
        const firstParam = path.node.params[0];
        // Fix TS2345: Guard to ensure param is Identifier or ObjectPattern
        if (firstParam && (t.isIdentifier(firstParam) || t.isObjectPattern(firstParam))) {
            this.extractProps(firstParam);
        }
        path.traverse({
            CallExpression: (callPath) => {
                this.analyzeHooks(callPath);
                this.detectListPatterns(callPath);
            },
            JSXElement: (jsxPath) => {
                if (jsxPath.parent.type === 'ReturnStatement') {
                    this.elementTree.push(this.buildElementTree(jsxPath.node, 0));
                }
            },
            ConditionalExpression: (condPath) => {
                this.detectConditionalPatterns(condPath, 'ternary');
            },
            LogicalExpression: (logPath) => {
                this.detectConditionalPatterns(logPath, 'logical');
            },
        });
    }
    analyzeArrowComponent(path) {
        const init = path.node.init;
        const firstParam = init.params[0];
        // Fix TS2345: Guard to ensure param is Identifier or ObjectPattern
        if (firstParam && (t.isIdentifier(firstParam) || t.isObjectPattern(firstParam))) {
            this.extractProps(firstParam);
        }
        if (t.isBlockStatement(init.body)) {
            path.traverse({
                CallExpression: (callPath) => {
                    this.analyzeHooks(callPath);
                    this.detectListPatterns(callPath);
                },
                JSXElement: (jsxPath) => {
                    if (jsxPath.parent.type === 'ReturnStatement') {
                        this.elementTree.push(this.buildElementTree(jsxPath.node, 0));
                    }
                },
            });
        }
        else if (t.isJSXElement(init.body)) {
            this.elementTree.push(this.buildElementTree(init.body, 0));
        }
    }
    extractProps(param) {
        if (t.isObjectPattern(param)) {
            param.properties.forEach((prop) => {
                if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                    this.propsUsed.add(prop.key.name);
                }
            });
        }
        else if (t.isIdentifier(param)) {
            this.propsUsed.add(param.name);
        }
    }
    analyzeHooks(path) {
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
    buildElementTree(node, depth) {
        if (depth > this.maxNestingDepth) {
            this.maxNestingDepth = depth;
        }
        const elementName = this.getElementName(node);
        const props = this.extractElementProps(node);
        const children = [];
        node.children.forEach((child) => {
            if (t.isJSXElement(child)) {
                children.push(this.buildElementTree(child, depth + 1));
            }
            else if (t.isJSXExpressionContainer(child)) {
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
    getElementName(node) {
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
    resolveMemberExpression(node) {
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
    extractElementProps(node) {
        const props = {};
        const openingElement = node.openingElement;
        openingElement.attributes.forEach((attr) => {
            if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
                const propName = attr.name.name;
                if (attr.value) {
                    if (t.isStringLiteral(attr.value)) {
                        props[propName] = attr.value.value;
                    }
                    else if (t.isJSXExpressionContainer(attr.value)) {
                        props[propName] = '<expression>';
                    }
                }
                else {
                    props[propName] = true;
                }
            }
        });
        return props;
    }
    detectListPatterns(path) {
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
    detectConditionalPatterns(path, type) {
        this.conditionalPatterns.push({
            type,
            location: `Line ${path.node.loc?.start.line ?? 'unknown'}`,
        });
    }
}
exports.ASTAnalyzer = ASTAnalyzer;
//# sourceMappingURL=astAnalyzer.js.map