﻿import * as ts from "typescript";
import * as errors from "./../../errors";
import {GlobalContainer} from "./../../GlobalContainer";
import {getNextNonWhitespacePos} from "./../../manipulation/textSeek";
import {Disposable, TypeGuards} from "./../../utils";
import {SourceFile} from "./../file";
import * as base from "./../base";
import {ConstructorDeclaration, MethodDeclaration} from "./../class";
import {FunctionDeclaration} from "./../function";
import {TypeAliasDeclaration} from "./../type";
import {InterfaceDeclaration} from "./../interface";
import {NamespaceDeclaration} from "./../namespace";
import {Symbol} from "./Symbol";

export class Node<NodeType extends ts.Node = ts.Node> implements Disposable {
    /** @internal */
    readonly global: GlobalContainer;
    /** @internal */
    private _compilerNode: NodeType | undefined;
    /** @internal */
    sourceFile: SourceFile;

    /**
     * Gets the underlying compiler node.
     */
    get compilerNode(): NodeType {
        if (this._compilerNode == null)
            throw new errors.InvalidOperationError("Attempted to get information from a node that was removed from the AST.");
        return this._compilerNode;
    }

    /**
     * Initializes a new instance.
     * @internal
     * @param global - Global container.
     * @param node - Underlying node.
     * @param sourceFile - Source file for the node.
     */
    constructor(
        global: GlobalContainer,
        node: NodeType,
        sourceFile: SourceFile
    ) {
        this.global = global;
        this._compilerNode = node;
        this.sourceFile = sourceFile;
    }

    /**
     * Releases the node from the cache and ast.
     * @internal
     */
    dispose() {
        for (const child of this.getChildren()) {
            child.dispose();
        }

        this.global.compilerFactory.removeNodeFromCache(this);
        this._compilerNode = undefined;
    }

    /**
     * Sets the source file.
     * @internal
     * @param sourceFile - Source file to set.
     */
    setSourceFile(sourceFile: SourceFile) {
        this.sourceFile = sourceFile;
        for (const child of this.getChildren())
            child.setSourceFile(sourceFile);
    }

    /**
     * Gets the syntax kind.
     */
    getKind() {
        return this.compilerNode.kind;
    }

    /**
     * Gets the syntax kind name.
     */
    getKindName() {
        return ts.SyntaxKind[this.compilerNode.kind];
    }

    /**
     * Gets the compiler symbol.
     */
    getSymbol(): Symbol | undefined {
        const boundSymbol = (this.compilerNode as any).symbol as ts.Symbol | undefined;
        if (boundSymbol != null)
            return this.global.compilerFactory.getSymbol(boundSymbol);

        const typeChecker = this.global.typeChecker;
        const typeCheckerSymbol = typeChecker.getSymbolAtLocation(this);
        if (typeCheckerSymbol != null)
            return typeCheckerSymbol;

        const nameNode = (this.compilerNode as any).name as ts.Node | undefined;
        if (nameNode != null)
            return this.global.compilerFactory.getNodeFromCompilerNode(nameNode, this.sourceFile).getSymbol();

        return undefined;
    }

    /**
     * If the node contains the provided range (inclusive).
     * @param pos - Start position.
     * @param end - End position.
     */
    containsRange(pos: number, end: number) {
        return this.getPos() <= pos && end <= this.getEnd();
    }

    /**
     * Gets the first child by a condition or throws.
     * @param condition - Condition.
     */
    getFirstChildOrThrow(condition?: (node: Node) => boolean) {
        const child = this.getFirstChild(condition);
        if (child == null)
            throw new errors.InvalidOperationError("Could not find a child that matched the specified condition.");
        return child;
    }

    /**
     * Gets the first child by a condition.
     * @param condition - Condition.
     */
    getFirstChild(condition?: (node: Node) => boolean) {
        for (const child of this.getChildrenIterator()) {
            if (condition == null || condition(child))
                return child;
        }
        return undefined;
    }

    /**
     * Gets the last child by a condition or throws.
     * @param condition - Condition.
     */
    getLastChildOrThrow(condition?: (node: Node) => boolean) {
        const child = this.getLastChild(condition);
        if (child == null)
            throw new errors.InvalidOperationError("Could not find a child that matched the specified condition.");
        return child;
    }

    /**
     * Gets the last child by a condition.
     * @param condition - Condition.
     */
    getLastChild(condition?: (node: Node) => boolean) {
        for (const child of this.getChildren().reverse()) {
            if (condition == null || condition(child))
                return child;
        }
        return undefined;
    }

    /**
     * Gets the first descendant by a condition or throws.
     * @param condition - Condition.
     */
    getFirstDescendantOrThrow(condition?: (node: Node) => boolean) {
        const descendant = this.getFirstDescendant(condition);
        if (descendant == null)
            throw new errors.InvalidOperationError("Could not find a descendant that matched the specified condition.");
        return descendant;
    }

    /**
     * Gets the first descendant by a condition.
     * @param condition - Condition.
     */
    getFirstDescendant(condition?: (node: Node) => boolean) {
        for (const descendant of this.getDescendantsIterator()) {
            if (condition == null || condition(descendant))
                return descendant;
        }
        return undefined;
    }

    /**
     * Offset this node's positions (pos and end) and all of its children by the given offset.
     * @internal
     * @param offset - Offset.
     */
    offsetPositions(offset: number) {
        this.compilerNode.pos += offset;
        this.compilerNode.end += offset;

        for (const child of this.getChildren()) {
            child.offsetPositions(offset);
        }
    }

    /**
     * Gets the previous sibling or throws.
     * @param condition - Optional condition for getting the previous sibling.
     */
    getPreviousSiblingOrThrow(condition?: (node: Node) => boolean) {
        const previousSibling = this.getPreviousSibling(condition);
        if (previousSibling == null)
            throw new errors.InvalidOperationError("Could not find the previous sibling.");
        return previousSibling;
    }

    /**
     * Gets the previous sibling.
     * @param condition - Optional condition for getting the previous sibling.
     */
    getPreviousSibling(condition?: (node: Node) => boolean) {
        for (const sibling of this.getPreviousSiblings()) {
            if (condition == null || condition(sibling))
                return sibling;
        }

        return undefined;
    }

    /**
     * Gets the next sibling or throws.
     * @param condition - Optional condition for getting the next sibling.
     */
    getNextSiblingOrThrow(condition?: (node: Node) => boolean) {
        const nextSibling = this.getNextSibling(condition);
        if (nextSibling == null)
            throw new errors.InvalidOperationError("Could not find the next sibling.");
        return nextSibling;
    }

    /**
     * Gets the next sibling.
     * @param condition - Optional condition for getting the previous sibling.
     */
    getNextSibling(condition?: (node: Node) => boolean) {
        for (const sibling of this.getNextSiblings()) {
            if (condition == null || condition(sibling))
                return sibling;
        }

        return undefined;
    }

    /**
     * Gets the previous siblings.
     *
     * Note: Closest sibling is the zero index.
     */
    getPreviousSiblings() {
        const parent = this.getParentSyntaxList() || this.getParentOrThrow();
        const previousSiblings: Node[] = [];

        for (const child of parent.getChildrenIterator()) {
            if (child === this)
                break;

            previousSiblings.splice(0, 0, child);
        }

        return previousSiblings;
    }

    /**
     * Gets the next siblings.
     *
     * Note: Closest sibling is the zero index.
     */
    getNextSiblings() {
        let foundChild = false;
        const nextSiblings: Node[] = [];
        const parent = this.getParentSyntaxList() || this.getParentOrThrow();

        for (const child of parent.getChildrenIterator()) {
            if (!foundChild) {
                foundChild = child === this;
                continue;
            }

            nextSiblings.push(child);
        }

        return nextSiblings;
    }

    /**
     * Gets the children of the node.
     */
    getChildren(): Node[] {
        return this.compilerNode.getChildren().map(n => this.global.compilerFactory.getNodeFromCompilerNode(n, this.sourceFile));
    }

    /**
     * @internal
     */
    *getChildrenIterator(): IterableIterator<Node> {
        for (const compilerChild of this.compilerNode.getChildren(this.sourceFile.compilerNode)) {
            yield this.global.compilerFactory.getNodeFromCompilerNode(compilerChild, this.sourceFile);
        }
    }

    /**
     * Gets the child syntax list or throws if it doesn't exist.
     */
    getChildSyntaxListOrThrow() {
        const syntaxList = this.getChildSyntaxList();
        if (syntaxList == null)
            throw new errors.InvalidOperationError("A child syntax list was expected.");
        return syntaxList;
    }

    /**
     * Gets the child syntax list if it exists.
     */
    getChildSyntaxList(): Node | undefined {
        let node: Node = this;
        if (TypeGuards.isBodyableNode(node) || TypeGuards.isBodiedNode(node)) {
            do {
                node = TypeGuards.isBodyableNode(node) ? node.getBodyOrThrow() : node.getBody();
            } while ((TypeGuards.isBodyableNode(node) || TypeGuards.isBodiedNode(node)) && (node.compilerNode as ts.Block).statements == null);
        }

        if (TypeGuards.isSourceFile(node) || TypeGuards.isBodyableNode(this) || TypeGuards.isBodiedNode(this))
            return node.getFirstChildByKind(ts.SyntaxKind.SyntaxList);

        let passedBrace = false;
        for (const child of node.getChildrenIterator()) {
            if (!passedBrace)
                passedBrace = child.getKind() === ts.SyntaxKind.FirstPunctuation;
            else if (child.getKind() === ts.SyntaxKind.SyntaxList)
                return child;
        }

        return undefined;
    }

    /**
     * Gets the node's descendants.
     */
    getDescendants(): Node[] {
        return Array.from(this.getDescendantsIterator());
    }

    /**
     * Gets the node's descendants as an iterator.
     * @internal
     */
    *getDescendantsIterator(): IterableIterator<Node> {
        for (const child of this.getChildrenIterator()) {
            yield child;

            for (const childChild of child.getDescendants())
                yield childChild;
        }
    }

    /**
     * Gets the child count.
     */
    getChildCount() {
        return this.compilerNode.getChildCount(this.sourceFile.compilerNode);
    }

    /**
     * Gets the child at the provided position, or undefined if not found.
     * @param pos - Position to search for.
     */
    getChildAtPos(pos: number): Node | undefined {
        if (pos < this.getPos() || pos >= this.getEnd())
            return undefined;

        for (const child of this.getChildrenIterator()) {
            if (pos >= child.getPos() && pos < child.getEnd())
                return child;
        }

        return undefined;
    }

    /**
     * Gets the most specific descendant at the provided position, or undefined if not found.
     * @param pos - Position to search for.
     */
    getDescendantAtPos(pos: number): Node | undefined {
        let node: Node | undefined;

        while (true) {
            const nextNode: Node | undefined = (node || this).getChildAtPos(pos);
            if (nextNode == null)
                return node;
            else
                node = nextNode;
        }
    }

    /**
     * Gets the start position with leading trivia.
     */
    getPos() {
        return this.compilerNode.pos;
    }

    /**
     * Gets the end position.
     */
    getEnd() {
        return this.compilerNode.end;
    }

    /**
     * Gets the start position without leading trivia.
     */
    getStart() {
        return this.compilerNode.getStart(this.sourceFile.compilerNode);
    }

    /**
     * Gets the first position that is not whitespace.
     */
    getNonWhitespaceStart() {
        return getNextNonWhitespacePos(this.sourceFile.getFullText(), this.getPos());
    }

    /**
     * Gets the width of the node (length without trivia).
     */
    getWidth() {
        return this.compilerNode.getWidth(this.sourceFile.compilerNode);
    }

    /**
     * Gets the full width of the node (length with trivia).
     */
    getFullWidth() {
        return this.compilerNode.getFullWidth();
    }

    /**
     * Gets the text without leading trivia.
     */
    getText() {
        return this.compilerNode.getText(this.sourceFile.compilerNode);
    }

    /**
     * Gets the full text with leading trivia.
     */
    getFullText() {
        return this.compilerNode.getFullText(this.sourceFile.compilerNode);
    }

    /**
     * Gets the combined modifier flags.
     */
    getCombinedModifierFlags() {
        return ts.getCombinedModifierFlags(this.compilerNode);
    }

    /**
     * @internal
     */
    replaceCompilerNode(compilerNode: NodeType) {
        this._compilerNode = compilerNode;
    }

    /**
     * Gets the source file.
     */
    getSourceFile(): SourceFile {
        return this.sourceFile;
    }

    /**
     * Gets a compiler node property wrapped in a Node.
     * @param propertyName - Property name.
     */
    getNodeProperty<KeyType extends keyof NodeType>(propertyName: KeyType) {
        // todo: once filtering keys by type is supported need to (1) make this only show keys that are of type ts.Node and (2) have ability to return an array of nodes.
        if ((this.compilerNode[propertyName] as any).kind == null)
            throw new errors.InvalidOperationError(`Attempted to get property '${propertyName}', but ${nameof<this>(n => n.getNodeProperty)} ` +
                `only works with properties that return a node.`);
        return this.global.compilerFactory.getNodeFromCompilerNode(this.compilerNode[propertyName], this.sourceFile) as Node<NodeType[KeyType]>;
    }

    /**
     * Goes up the tree getting all the parents in ascending order.
     */
    getParents() {
        return Array.from(this.getParentsIterator());
    }

    /**
     * @internal
     */
    *getParentsIterator() {
        let parent = (this as Node).getParent();
        while (parent != null) {
            yield parent;
            parent = parent!.getParent();
        }
    }

    /**
     * Get the node's parent.
     */
    getParent() {
        return (this.compilerNode.parent == null) ? undefined : this.global.compilerFactory.getNodeFromCompilerNode(this.compilerNode.parent, this.sourceFile);
    }

    /**
     * Gets the parent or throws an error if it doesn't exist.
     */
    getParentOrThrow() {
        const parentNode = this.getParent();
        if (parentNode == null)
            throw new errors.InvalidOperationError("A parent is required to do this operation.");
        return parentNode;
    }

    /**
     * Gets the last token of this node. Usually this is a close brace.
     */
    getLastToken() {
        const lastToken = this.compilerNode.getLastToken(this.sourceFile.compilerNode);
        /* istanbul ignore if */
        if (lastToken == null)
            throw new errors.NotImplementedError("Not implemented scenario where the last token does not exist");

        return this.global.compilerFactory.getNodeFromCompilerNode(lastToken, this.sourceFile);
    }

    /**
     * Gets if this node is in a syntax list.
     */
    isInSyntaxList() {
        return this.getParentSyntaxList() != null;
    }

    /**
     * Gets the parent if it's a syntax list or throws an error otherwise.
     */
    getParentSyntaxListOrThrow() {
        const parentSyntaxList = this.getParentSyntaxList();
        if (parentSyntaxList == null)
            throw new errors.InvalidOperationError("Expected the parent to be a syntax list.");
        return parentSyntaxList;
    }

    /**
     * Gets the parent if it's a syntax list.
     */
    getParentSyntaxList() {
        const parent = this.getParent();
        if (parent == null)
            return undefined;

        const pos = this.getPos();
        const end = this.getEnd();
        for (const child of parent.getChildren()) {
            if (child.getPos() > pos || child === this)
                return undefined;

            if (child.getKind() === ts.SyntaxKind.SyntaxList && child.getPos() <= pos && child.getEnd() >= end)
                return child;
        }

        return undefined; // shouldn't happen
    }

    /**
     * Gets the child index of this node relative to the parent.
     */
    getChildIndex() {
        const parent = this.getParentSyntaxList() || this.getParentOrThrow();
        let i = 0;
        for (const child of parent.getChildren()) {
            if (child === this)
                return i;
            i++;
        }

        /* istanbul ignore next */
        throw new errors.NotImplementedError("For some reason the child's parent did not contain the child.");
    }

    /**
     * Gets the indentation text.
     */
    getIndentationText() {
        const sourceFileText = this.sourceFile.getFullText();
        const startLinePos = this.getStartLinePos();
        const startPos = this.getStart();
        let text = "";

        for (let i = startPos - 1; i >= startLinePos; i--) {
            const currentChar = sourceFileText[i];
            switch (currentChar) {
                case " ":
                case "\t":
                    text = currentChar + text;
                    break;
                case "\n":
                    return text;
                default:
                    text = "";
            }
        }

        return text;
    }

    /**
     * Gets the next indentation level text.
     */
    getChildIndentationText() {
        if (TypeGuards.isSourceFile(this))
            return "";

        return this.getIndentationText() + this.global.manipulationSettings.getIndentationText();
    }

    /**
     * Gets the position of the start of the line that this node is on.
     */
    getStartLinePos() {
        const sourceFileText = this.sourceFile.getFullText();
        const startPos = this.getStart();

        for (let i = startPos - 1; i >= 0; i--) {
            const currentChar = sourceFileText[i];
            if (currentChar === "\n")
                return i + 1;
        }

        return 0;
    }

    /**
     * Gets if this is the first node on the current line.
     */
    isFirstNodeOnLine() {
        const sourceFileText = this.sourceFile.getFullText();
        const startPos = this.getStart();

        for (let i = startPos - 1; i >= 0; i--) {
            const currentChar = sourceFileText[i];
            if (currentChar === " " || currentChar === "\t")
                continue;
            if (currentChar === "\n")
                return true;

            return false;
        }

        return false;
    }

    /**
     * Gets the children based on a kind.
     * @param kind - Syntax kind.
     */
    getChildrenOfKind(kind: ts.SyntaxKind) {
        return this.getChildren().filter(c => c.getKind() === kind);
    }

    /**
     * Gets the first child by syntax kind or throws an error if not found.
     * @param kind - Syntax kind.
     */
    getFirstChildByKindOrThrow(kind: ts.SyntaxKind) {
        const firstChild = this.getFirstChildByKind(kind);
        if (firstChild == null)
            throw new errors.InvalidOperationError(`A child of the kind ${ts.SyntaxKind[kind]} was expected.`);
        return firstChild;
    }

    /**
     * Gets the first child by syntax kind.
     * @param kind - Syntax kind.
     */
    getFirstChildByKind(kind: ts.SyntaxKind) {
        return this.getFirstChild(child => child.getKind() === kind);
    }

    /**
     * Gets the first child if it matches the specified syntax kind or throws an error if not found.
     * @param kind - Syntax kind.
     */
    getFirstChildIfKindOrThrow(kind: ts.SyntaxKind) {
        const firstChild = this.getFirstChildIfKind(kind);
        if (firstChild == null)
            throw new errors.InvalidOperationError(`A first child of the kind ${ts.SyntaxKind[kind]} was expected.`);
        return firstChild;
    }

    /**
     * Gets the first child if it matches the specified syntax kind.
     * @param kind - Syntax kind.
     */
    getFirstChildIfKind(kind: ts.SyntaxKind) {
        const firstChild = this.getFirstChild();
        return firstChild != null && firstChild.getKind() === kind ? firstChild : undefined;
    }

    /**
     * Gets the last child by syntax kind or throws an error if not found.
     * @param kind - Syntax kind.
     */
    getLastChildByKindOrThrow(kind: ts.SyntaxKind) {
        const lastChild = this.getLastChildByKind(kind);
        if (lastChild == null)
            throw new errors.InvalidOperationError(`A child of the kind ${ts.SyntaxKind[kind]} was expected.`);
        return lastChild;
    }

    /**
     * Gets the last child by syntax kind.
     * @param kind - Syntax kind.
     */
    getLastChildByKind(kind: ts.SyntaxKind) {
        return this.getLastChild(child => child.getKind() === kind);
    }

    /**
     * Gets the last child if it matches the specified syntax kind or throws an error if not found.
     * @param kind - Syntax kind.
     */
    getLastChildIfKindOrThrow(kind: ts.SyntaxKind) {
        const lastChild = this.getLastChildIfKind(kind);
        if (lastChild == null)
            throw new errors.InvalidOperationError(`A last child of the kind ${ts.SyntaxKind[kind]} was expected.`);
        return lastChild;
    }

    /**
     * Gets the last child if it matches the specified syntax kind.
     * @param kind - Syntax kind.
     */
    getLastChildIfKind(kind: ts.SyntaxKind) {
        const lastChild = this.getLastChild();
        return lastChild != null && lastChild.getKind() === kind ? lastChild : undefined;
    }

    /**
     * Gets the previous sibiling if it matches the specified kind, or throws.
     * @param kind - Kind to check.
     */
    getPreviousSiblingIfKindOrThrow(kind: ts.SyntaxKind) {
        const previousSibling = this.getPreviousSiblingIfKind(kind);
        if (previousSibling == null)
            throw new errors.InvalidOperationError(`A previous sibling of kind ${ts.SyntaxKind[kind]} was expected.`);
        return previousSibling;
    }

    /**
     * Gets the next sibiling if it matches the specified kind, or throws.
     * @param kind - Kind to check.
     */
    getNextSiblingIfKindOrThrow(kind: ts.SyntaxKind) {
        const nextSibling = this.getNextSiblingIfKind(kind);
        if (nextSibling == null)
            throw new errors.InvalidOperationError(`A next sibling of kind ${ts.SyntaxKind[kind]} was expected.`);
        return nextSibling;
    }

    /**
     * Gets the previous sibling if it matches the specified kind.
     * @param kind - Kind to check.
     */
    getPreviousSiblingIfKind(kind: ts.SyntaxKind) {
        const previousSibling = this.getPreviousSibling();
        return previousSibling != null && previousSibling.getKind() === kind ? previousSibling : undefined;
    }

    /**
     * Gets the next sibling if it matches the specified kind.
     * @param kind - Kind to check.
     */
    getNextSiblingIfKind(kind: ts.SyntaxKind) {
        const nextSibling = this.getNextSibling();
        return nextSibling != null && nextSibling.getKind() === kind ? nextSibling : undefined;
    }

    /**
     * Gets the parent if it's a certain syntax kind.
     */
    getParentIfKind(kind: ts.SyntaxKind) {
        const parentNode = this.getParent();
        return parentNode == null || parentNode.getKind() !== kind ? undefined : parentNode;
    }

    /**
     * Gets the parent if it's a certain syntax kind of throws.
     */
    getParentIfKindOrThrow(kind: ts.SyntaxKind) {
        const parentNode = this.getParentIfKind(kind);
        if (parentNode == null)
            throw new errors.InvalidOperationError(`A parent with a syntax kind of ${ts.SyntaxKind[kind]} is required to do this operation.`);
        return parentNode;
    }

    /**
     * Gets the first parent by syntax kind or throws if not found.
     * @param kind - Syntax kind.
     */
    getFirstParentByKindOrThrow(kind: ts.SyntaxKind) {
        const parentNode = this.getFirstParentByKind(kind);
        if (parentNode == null)
            throw new errors.InvalidOperationError(`A parent of kind ${ts.SyntaxKind[kind]} is required to do this operation.`);
        return parentNode;
    }

    /**
     * Get the first parent by syntax kind.
     * @param kind - Syntax kind.
     */
    getFirstParentByKind(kind: ts.SyntaxKind) {
        for (const parent of this.getParents()) {
            if (parent.getKind() === kind)
                return parent;
        }
        return undefined;
    }

    /**
     * Gets the first descendant by syntax kind or throws.
     * @param kind - Syntax kind.
     */
    getFirstDescendantByKindOrThrow(kind: ts.SyntaxKind) {
        const descendant = this.getFirstDescendantByKind(kind);
        if (descendant == null)
            throw new errors.InvalidOperationError(`A descendant of kind ${ts.SyntaxKind[kind]} is required to do this operation.`);
        return descendant;
    }

    /**
     * Gets the first descendant by syntax kind.
     * @param kind - Syntax kind.
     */
    getFirstDescendantByKind(kind: ts.SyntaxKind) {
        for (const descendant of this.getDescendantsIterator()) {
            if (descendant.getKind() === kind)
                return descendant;
        }
        return undefined;
    }
}
