﻿import * as ts from "typescript";
import {Constructor} from "./../../../Constructor";
import * as errors from "./../../../errors";
import {InitializerExpressionableNodeStructure} from "./../../../structures";
import {callBaseFill} from "./../../callBaseFill";
import {insertIntoParent, removeChildren} from "./../../../manipulation";
import {Node, Expression} from "./../../common";

export type InitializerExpressionedExtensionType = Node<ts.Node & { initializer?: ts.Expression; }>;

export interface InitializerExpressionableNode {
    /**
     * Gets if this is an InitializerExpressionableNode.
     */
    isInitializerExpressionableNode(): this is InitializerExpressionableNode;
    /**
     * Gets if node has an initializer.
     */
    hasInitializer(): boolean;
    /**
     * Gets the initializer.
     */
    getInitializer(): Expression | undefined;
    /**
     * Removes the initailizer.
     */
    removeInitializer(): this;
    /**
     * Sets the initializer.
     * @param text - New text to set for the initializer.
     */
    setInitializer(text: string): this;
}

export function InitializerExpressionableNode<T extends Constructor<InitializerExpressionedExtensionType>>(Base: T): Constructor<InitializerExpressionableNode> & T {
    return class extends Base implements InitializerExpressionableNode {
        isInitializerExpressionableNode() {
            return true;
        }

        hasInitializer() {
            return this.compilerNode.initializer != null;
        }

        getInitializer() {
            return this.compilerNode.initializer == null ? undefined :
                (this.global.compilerFactory.getNodeFromCompilerNode(this.compilerNode.initializer, this.sourceFile) as Expression);
        }

        removeInitializer() {
            const initializer = this.getInitializer();
            if (initializer == null)
                return this;
            const previousSibling = initializer.getPreviousSibling();

            /* istanbul ignore if */
            if (previousSibling == null || previousSibling.getKind() !== ts.SyntaxKind.FirstAssignment)
                throw errors.getNotImplementedForSyntaxKindError(this.getKind());

            removeChildren({
                children: [previousSibling, initializer],
                removePrecedingSpaces: true
            });
            return this;
        }

        setInitializer(text: string) {
            errors.throwIfNotStringOrWhitespace(text, nameof(text));

            if (this.hasInitializer())
                this.removeInitializer();

            const semiColonToken = this.getLastChildIfKind(ts.SyntaxKind.SemicolonToken);

            insertIntoParent({
                insertPos: semiColonToken != null ? semiColonToken.getPos() : this.getEnd(),
                childIndex: semiColonToken != null ? semiColonToken.getChildIndex() : this.getChildCount(),
                insertItemsCount: 2,
                parent: this,
                newText: ` = ${text}`
            });
            return this;
        }

        fill(structure: Partial<InitializerExpressionableNodeStructure>) {
            callBaseFill(Base.prototype, this, structure);

            if (structure.initializer != null)
                this.setInitializer(structure.initializer);

            return this;
        }
    };
}
