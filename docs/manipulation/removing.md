---
title: Removing
---

## Removing

Given the source file for following code:

```typescript
enum MyEnum {
    myMember
}
```

Removing can be done as follows:

```typescript
const member = sourceFile.getEnum("MyEnum")!.getMember("myMember")!;
member.remove();
```

So the file above would now contain the following code:

```typescript
enum MyEnum {
}
```

### Support

Currently removing is implemented individually for each kind of node. If you find something is not implemented, please open an issue on github.
