﻿import * as ts from "typescript";
import * as errors from "./../../errors";
import {insertIntoCreatableSyntaxList, insertIntoParent, getEndIndexFromArray, insertIntoBracesOrSourceFileWithFillAndGetChildren, verifyAndGetIndex,
    removeStatementedNodeChild} from "./../../manipulation";
import {getNamedNodeByNameOrFindFunction, TypeGuards} from "./../../utils";
import {PropertyDeclarationStructure, MethodDeclarationStructure, ConstructorDeclarationStructure, ClassDeclarationStructure} from "./../../structures";
import {Node} from "./../common";
import {NamedNode, ExportableNode, ModifierableNode, AmbientableNode, DocumentationableNode, TypeParameteredNode, DecoratableNode, HeritageClauseableNode,
    ImplementsClauseableNode, TextInsertableNode} from "./../base";
import {AbstractableNode} from "./base";
import {SourceFile} from "./../file";
import {ParameterDeclaration} from "./../function";
import {ExpressionWithTypeArguments} from "./../type";
import {NamespaceChildableNode} from "./../namespace";
import {callBaseFill} from "./../callBaseFill";
import {ConstructorDeclaration} from "./ConstructorDeclaration";
import {MethodDeclaration} from "./MethodDeclaration";
import {PropertyDeclaration} from "./PropertyDeclaration";
import {GetAccessorDeclaration} from "./GetAccessorDeclaration";
import {SetAccessorDeclaration} from "./SetAccessorDeclaration";

export type ClassInstancePropertyTypes = PropertyDeclaration | GetAccessorDeclaration | SetAccessorDeclaration | ParameterDeclaration;
export type ClassInstanceMemberTypes = MethodDeclaration | ClassInstancePropertyTypes;
export type ClassStaticPropertyTypes = PropertyDeclaration | GetAccessorDeclaration | SetAccessorDeclaration;
export type ClassStaticMemberTypes = MethodDeclaration | ClassStaticPropertyTypes;
export type ClassMemberTypes = MethodDeclaration | PropertyDeclaration | GetAccessorDeclaration | SetAccessorDeclaration | ConstructorDeclaration | ParameterDeclaration;

export const ClassDeclarationBase = TextInsertableNode(ImplementsClauseableNode(HeritageClauseableNode(DecoratableNode(TypeParameteredNode(
    NamespaceChildableNode(DocumentationableNode(AmbientableNode(AbstractableNode(ExportableNode(ModifierableNode(NamedNode(Node)))))))
)))));
export class ClassDeclaration extends ClassDeclarationBase<ts.ClassDeclaration> {
    /**
     * Fills the node from a structure.
     * @param structure - Structure to fill.
     */
    fill(structure: Partial<ClassDeclarationStructure>) {
        callBaseFill(ClassDeclarationBase.prototype, this, structure);

        if (structure.extends != null)
            this.setExtends(structure.extends);
        if (structure.ctor != null)
            this.addConstructor(structure.ctor);
        if (structure.properties != null)
            this.addProperties(structure.properties);
        if (structure.methods != null)
            this.addMethods(structure.methods);

        return this;
    }

    /**
     * Sets the extends expression.
     * @param text - Text to set as the extends expression.
     */
    setExtends(text: string) {
        errors.throwIfNotStringOrWhitespace(text, nameof(text));

        const heritageClauses = this.getHeritageClauses();
        const extendsClause = heritageClauses.find(c => c.compilerNode.token === ts.SyntaxKind.ExtendsKeyword);
        if (extendsClause != null) {
            const childSyntaxList = extendsClause.getFirstChildByKindOrThrow(ts.SyntaxKind.SyntaxList);
            const childSyntaxListStart = childSyntaxList.getStart();
            insertIntoParent({
                parent: extendsClause,
                childIndex: childSyntaxList.getChildIndex(),
                insertItemsCount: 1,
                newText: text,
                insertPos: childSyntaxListStart,
                replacing: {
                    length: childSyntaxList.getEnd() - childSyntaxListStart,
                    nodes: [childSyntaxList]
                }
            });
            return this;
        }

        const implementsClause = heritageClauses.find(c => c.compilerNode.token === ts.SyntaxKind.ImplementsKeyword);
        let insertPos: number;
        if (implementsClause != null)
            insertPos = implementsClause.getStart();
        else
            insertPos = this.getFirstChildByKindOrThrow(ts.SyntaxKind.OpenBraceToken).getStart();

        const isLastSpace = /\s/.test(this.getSourceFile().getFullText()[insertPos - 1]);
        let newText = `extends ${text} `;
        if (!isLastSpace)
            newText = " " + newText;

        insertIntoCreatableSyntaxList({
            parent: this,
            insertPos,
            newText,
            syntaxList: implementsClause == null ? undefined : implementsClause.getParentSyntaxListOrThrow(),
            childIndex: 0,
            insertItemsCount: 1
        });

        return this;
    }

    /**
     * Gets the extends expression.
     */
    getExtends(): ExpressionWithTypeArguments | undefined {
        const heritageClauses = this.getHeritageClauses();
        const extendsClause = heritageClauses.find(c => c.compilerNode.token === ts.SyntaxKind.ExtendsKeyword);
        if (extendsClause == null)
            return undefined;

        const types = extendsClause.getTypes();
        return types.length === 0 ? undefined : types[0];
    }

    /**
     * Adds a constructor. Will remove the previous constructor if it exists.
     * @param structure - Structure of the constructor.
     */
    addConstructor(structure: ConstructorDeclarationStructure = {}) {
        return this.insertConstructor(getEndIndexFromArray(this.getBodyMembers()), structure);
    }

    /**
     * Inserts a constructor. Will remove the previous constructor if it exists.
     * @param index - Index to insert at.
     * @param structure - Structure of the constructor.
     */
    insertConstructor(index: number, structure: ConstructorDeclarationStructure = {}) {
        for (const c of this.getConstructors()) {
            c.remove();
        }

        const indentationText = this.getChildIndentationText();
        const newLineChar = this.global.manipulationSettings.getNewLineKind();
        const code = `${indentationText}constructor() {${newLineChar}${indentationText}}`;

        return insertIntoBracesOrSourceFileWithFillAndGetChildren<ConstructorDeclaration, ConstructorDeclarationStructure>({
            getIndexedChildren: () => this.getBodyMembers(),
            sourceFile: this.getSourceFile(),
            parent: this,
            index,
            childCodes: [code],
            structures: [structure],
            previousBlanklineWhen: () => true,
            nextBlanklineWhen: () => true,
            expectedKind: ts.SyntaxKind.Constructor,
            fillFunction: (node, struct) => node.fill(struct)
        })[0];
    }

    /**
     * Gets the constructor declarations.
     */
    getConstructors() {
        return this.getAllMembers().filter(m => TypeGuards.isConstructorDeclaration(m)) as ConstructorDeclaration[];
    }

    /**
     * Add property.
     * @param structure - Structure representing the property.
     */
    addProperty(structure: PropertyDeclarationStructure) {
        return this.addProperties([structure])[0];
    }

    /**
     * Add properties.
     * @param structures - Structures representing the properties.
     */
    addProperties(structures: PropertyDeclarationStructure[]) {
        return this.insertProperties(getEndIndexFromArray(this.getBodyMembers()), structures);
    }

    /**
     * Insert property.
     * @param index - Index to insert at.
     * @param structure - Structure representing the property.
     */
    insertProperty(index: number, structure: PropertyDeclarationStructure) {
        return this.insertProperties(index, [structure])[0];
    }

    /**
     * Insert properties.
     * @param index - Index to insert at.
     * @param structures - Structures representing the properties.
     */
    insertProperties(index: number, structures: PropertyDeclarationStructure[]) {
        const indentationText = this.getChildIndentationText();

        // create code
        const codes: string[] = [];
        for (const structure of structures) {
            let code = `${indentationText}`;
            if (structure.isStatic)
                code += "static ";
            code += structure.name;
            if (structure.hasQuestionToken)
                code += "?";
            if (structure.type != null && structure.type.length > 0)
                code += `: ${structure.type}`;
            code += ";";
            codes.push(code);
        }

        return insertIntoBracesOrSourceFileWithFillAndGetChildren<PropertyDeclaration, PropertyDeclarationStructure>({
            getIndexedChildren: () => this.getBodyMembers(),
            sourceFile: this.getSourceFile(),
            parent: this,
            index,
            childCodes: codes,
            structures,
            previousBlanklineWhen: n => TypeGuards.isBodyableNode(n) || TypeGuards.isBodiedNode(n),
            nextBlanklineWhen: n => TypeGuards.isBodyableNode(n) || TypeGuards.isBodiedNode(n),
            expectedKind: ts.SyntaxKind.PropertyDeclaration,
            fillFunction: (node, structure) => node.fill(structure)
        });
    }

    /**
     * Gets the first instance property by name.
     * @param name - Name.
     */
    getInstanceProperty(name: string): ClassInstancePropertyTypes | undefined;
    /**
     * Gets the first instance property by a find function.
     * @param findFunction - Function to find an instance property by.
     */
    getInstanceProperty(findFunction: (prop: ClassInstancePropertyTypes) => boolean): ClassInstancePropertyTypes | undefined;
    getInstanceProperty(nameOrFindFunction: string | ((prop: ClassInstancePropertyTypes) => boolean)): ClassInstancePropertyTypes | undefined {
        return getNamedNodeByNameOrFindFunction(this.getInstanceProperties(), nameOrFindFunction);
    }

    /**
     * Gets the class instance property declarations.
     */
    getInstanceProperties(): ClassInstancePropertyTypes[] {
        return this.getInstanceMembers()
            .filter(m => isClassPropertyType(m)) as ClassInstancePropertyTypes[];
    }

    /**
     * Gets the first static property by name.
     * @param name - Name.
     */
    getStaticProperty(name: string): ClassStaticPropertyTypes | undefined;
    /**
     * Gets the first static property by a find function.
     * @param findFunction - Function to find a static property by.
     */
    getStaticProperty(findFunction: (prop: ClassStaticPropertyTypes) => boolean): ClassStaticPropertyTypes | undefined;
    getStaticProperty(nameOrFindFunction: string | ((prop: ClassStaticPropertyTypes) => boolean)): ClassStaticPropertyTypes | undefined {
        return getNamedNodeByNameOrFindFunction(this.getStaticProperties(), nameOrFindFunction);
    }

    /**
     * Gets the class instance property declarations.
     */
    getStaticProperties(): ClassStaticPropertyTypes[] {
        return this.getStaticMembers()
            .filter(m => isClassPropertyType(m)) as ClassStaticPropertyTypes[];
    }

    /**
     * Add method.
     * @param structure - Structure representing the method.
     */
    addMethod(structure: MethodDeclarationStructure) {
        return this.addMethods([structure])[0];
    }

    /**
     * Add methods.
     * @param structures - Structures representing the methods.
     */
    addMethods(structures: MethodDeclarationStructure[]) {
        return this.insertMethods(getEndIndexFromArray(this.getBodyMembers()), structures);
    }

    /**
     * Insert method.
     * @param index - Index to insert at.
     * @param structure - Structure representing the method.
     */
    insertMethod(index: number, structure: MethodDeclarationStructure) {
        return this.insertMethods(index, [structure])[0];
    }

    /**
     * Insert methods.
     * @param index - Index to insert at.
     * @param structures - Structures representing the methods.
     */
    insertMethods(index: number, structures: MethodDeclarationStructure[]) {
        const indentationText = this.getChildIndentationText();
        const newLineChar = this.global.manipulationSettings.getNewLineKind();
        const isAmbient = this.isAmbient();

        // create code
        const codes: string[] = [];
        for (const structure of structures) {
            let code = indentationText;
            if (structure.isStatic)
                code += "static ";
            code += `${structure.name}()`;
            if (structure.returnType != null && structure.returnType.length > 0)
                code += `: ${structure.returnType}`;

            if (isAmbient)
                code += ";";
            else
                code += ` {` + newLineChar + indentationText + `}`;

            codes.push(code);
        }

        // insert, fill, and get created nodes
        return insertIntoBracesOrSourceFileWithFillAndGetChildren<MethodDeclaration, MethodDeclarationStructure>({
            getIndexedChildren: () => this.getBodyMembers(),
            sourceFile: this.getSourceFile(),
            parent: this,
            index,
            childCodes: codes,
            structures,
            previousBlanklineWhen: () => !isAmbient,
            nextBlanklineWhen: () => !isAmbient,
            separatorNewlineWhen: () => !isAmbient,
            expectedKind: ts.SyntaxKind.MethodDeclaration,
            fillFunction: (node, structure) => node.fill(structure)
        });
    }

    /**
     * Gets the first instance method by name.
     * @param name - Name.
     */
    getInstanceMethod(name: string): MethodDeclaration | undefined;
    /**
     * Gets the first instance method by a find function.
     * @param findFunction - Function to find an instance method by.
     */
    getInstanceMethod(findFunction: (method: MethodDeclaration) => boolean): MethodDeclaration | undefined;
    getInstanceMethod(nameOrFindFunction: string | ((method: MethodDeclaration) => boolean)): MethodDeclaration | undefined {
        return getNamedNodeByNameOrFindFunction(this.getInstanceMethods(), nameOrFindFunction);
    }

    /**
     * Gets the class instance method declarations.
     */
    getInstanceMethods(): MethodDeclaration[] {
        return this.getInstanceMembers().filter(m => m instanceof MethodDeclaration) as MethodDeclaration[];
    }

    /**
     * Gets the first static method by name.
     * @param name - Name.
     */
    getStaticMethod(name: string): MethodDeclaration | undefined;
    /**
     * Gets the first static method by a find function.
     * @param findFunction - Function to find a static method by.
     */
    getStaticMethod(findFunction: (method: MethodDeclaration) => boolean): MethodDeclaration | undefined;
    getStaticMethod(nameOrFindFunction: string | ((method: MethodDeclaration) => boolean)): MethodDeclaration | undefined {
        return getNamedNodeByNameOrFindFunction(this.getStaticMethods(), nameOrFindFunction);
    }

    /**
     * Gets the class instance method declarations.
     */
    getStaticMethods(): MethodDeclaration[] {
        return this.getStaticMembers().filter(m => m instanceof MethodDeclaration) as MethodDeclaration[];
    }

    /**
     * Gets the first instance member by name.
     * @param name - Name.
     */
    getInstanceMember(name: string): ClassInstanceMemberTypes | undefined;
    /**
     * Gets the first instance member by a find function.
     * @param findFunction - Function to find the instance member by.
     */
    getInstanceMember(findFunction: (member: ClassInstanceMemberTypes) => boolean): ClassInstanceMemberTypes | undefined;
    getInstanceMember(nameOrFindFunction: string | ((member: ClassInstanceMemberTypes) => boolean)): ClassInstanceMemberTypes | undefined {
        return getNamedNodeByNameOrFindFunction(this.getInstanceMembers(), nameOrFindFunction);
    }

    /**
     * Gets the instance members.
     */
    getInstanceMembers() {
        return this.getAllMembers().filter(m => !TypeGuards.isConstructorDeclaration(m) && (m instanceof ParameterDeclaration || !m.isStatic())) as ClassInstanceMemberTypes[];
    }

    /**
     * Gets the first static member by name.
     * @param name - Name.
     */
    getStaticMember(name: string): ClassStaticMemberTypes | undefined;
    /**
     * Gets the first static member by a find function.
     * @param findFunction - Function to find an static method by.
     */
    getStaticMember(findFunction: (member: ClassStaticMemberTypes) => boolean): ClassStaticMemberTypes | undefined;
    getStaticMember(nameOrFindFunction: string | ((member: ClassStaticMemberTypes) => boolean)): ClassStaticMemberTypes | undefined {
        return getNamedNodeByNameOrFindFunction(this.getStaticMembers(), nameOrFindFunction);
    }

    /**
     * Gets the static members.
     */
    getStaticMembers() {
        return this.getAllMembers().filter(m => !TypeGuards.isConstructorDeclaration(m) && !(m instanceof ParameterDeclaration) && m.isStatic()) as ClassStaticMemberTypes[];
    }

    /**
     * Gets the constructors, methods, properties, and class parameter properties.
     */
    getAllMembers() {
        const members = this.getBodyMembers();
        const implementationCtors = members.filter(c => TypeGuards.isConstructorDeclaration(c) && c.isImplementation()) as ConstructorDeclaration[];
        for (const ctor of implementationCtors) {
            // insert after the constructor
            let insertIndex = members.indexOf(ctor) + 1;
            for (const param of ctor.getParameters()) {
                if (param.isParameterProperty()) {
                    members.splice(insertIndex, 0, param);
                    insertIndex++;
                }
            }
        }

        return members;
    }

    /**
     * Removes this class declaration.
     */
    remove() {
        removeStatementedNodeChild(this);
    }

    private getBodyMembers() {
        const members = this.compilerNode.members.map(m => this.global.compilerFactory.getNodeFromCompilerNode(m, this.sourceFile)) as ClassMemberTypes[];

        // filter out the method declarations or constructor declarations without a body if not ambient
        return this.isAmbient() ? members : members.filter(m => !(m instanceof ConstructorDeclaration || m instanceof MethodDeclaration) || m.isImplementation());
    }
}

function getBodyMembers(this: ClassDeclaration) {

}

function isClassPropertyType(m: Node) {
    return m instanceof PropertyDeclaration || m instanceof SetAccessorDeclaration || m instanceof GetAccessorDeclaration || m instanceof ParameterDeclaration;
}
