"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternDetector = void 0;
class PatternDetector {
    detectIssues(elementTree, nestingDepth) {
        const issues = [];
        // Check nesting depth
        if (nestingDepth > 7) {
            issues.push({
                description: `Excessive nesting depth (${nestingDepth}). Consider component extraction.`,
                location: 'Component structure',
                severity: 'high',
            });
        }
        else if (nestingDepth > 5) {
            issues.push({
                description: `Moderate nesting depth (${nestingDepth}). Consider flattening structure.`,
                location: 'Component structure',
                severity: 'medium',
            });
        }
        // Analyze element tree
        elementTree.forEach((node) => {
            this.analyzeNode(node, issues);
        });
        return issues;
    }
    analyzeNode(node, issues) {
        // Check for excessive divs
        if (node.type === 'div' && node.children.length === 1 && node.children[0].type === 'div') {
            issues.push({
                description: 'Nested divs without purpose. Consider using semantic HTML or removing wrapper.',
                location: `Element: ${node.type}`,
                severity: 'low',
            });
        }
        // Check for missing alt on images
        if (node.type === 'img' && !node.props.alt) {
            issues.push({
                description: 'Image missing alt attribute for accessibility.',
                location: `Element: img`,
                severity: 'high',
            });
        }
        // Check for buttons without aria-label
        if (node.type === 'button' && !node.props['aria-label'] && !this.hasTextContent(node)) {
            issues.push({
                description: 'Button without accessible label. Add aria-label or text content.',
                location: `Element: button`,
                severity: 'medium',
            });
        }
        // Check for inline styles
        if (node.props.style) {
            issues.push({
                description: 'Inline styles detected. Consider using utility classes or styled components.',
                location: `Element: ${node.type}`,
                severity: 'low',
            });
        }
        // Recurse through children
        node.children.forEach((child) => this.analyzeNode(child, issues));
    }
    hasTextContent(node) {
        return node.children.length > 0;
    }
    detectPatterns(elementTree) {
        const patterns = new Set();
        elementTree.forEach((node) => {
            this.detectNodePatterns(node, patterns);
        });
        return Array.from(patterns);
    }
    detectNodePatterns(node, patterns) {
        // Detect flex usage
        if (node.props.className && node.props.className.includes('flex')) {
            patterns.add('flex-layout');
        }
        // Detect grid usage
        if (node.props.className && node.props.className.includes('grid')) {
            patterns.add('grid-layout');
        }
        // Detect semantic HTML
        if (['section', 'article', 'nav', 'aside', 'header', 'footer'].includes(node.type)) {
            patterns.add('semantic-html');
        }
        // Detect spacing utilities
        if (node.props.className && /[mp][trblxy]?-\d+/.test(node.props.className)) {
            patterns.add('utility-spacing');
        }
        node.children.forEach((child) => this.detectNodePatterns(child, patterns));
    }
}
exports.PatternDetector = PatternDetector;
//# sourceMappingURL=patternDetector.js.map