# Matter.js 0.17.x

This file summarizes the [matter.js 0.17.x](https://github.com/matter-js/matter.js/blob/main/CHANGELOG.md) deltas compared with matter.js 0.16.11.

It focuses only on the changes that matter for Matterbridge.

## Deprecated and modified cluster types

- All cluster types had .Cluster and .Complete (e.g. PowerSource.Cluster and PowerSource.Complete). Now .Cluster and .Complete are deprecated and resolve to the main cluster type (e.g. PowerSource.Cluster = PowerSource). Use directly PowerSource.

- Also using the whole word PowerSourceCluster is now deprecated (e.g. PowerSourceCluster = PowerSource). Use directly PowerSource.

- All clusters with features had .with(...) (e.g. PowerSource.Cluster.with(PowerSource.Feature.Wired)). Now .with(...) is deprecated and resolve to the complete instance (PowerSource.Cluster.with(PowerSource.Feature.Wired) = PowerSource). There is no more feature-gated typing in with(). Use directly PowerSource.

You can just have the single types:

```typescript
type WiredAttrs = PowerSource.WiredAttributes;
type BaseWiredAttrs = PowerSource.BaseAttributes & PowerSource.WiredAttributes;
```

The important distinction is:

PowerSource.Attributes: the flattened full superset, not feature-specific.

PowerSource.BaseAttributes: the always present attributes.

PowerSource.WiredAttributes: only the Wired feature attributes.

PowerSource.BaseAttributes & PowerSource.WiredAttributes: what a wired power source exposes.

## Removed without deprecation notice

- The whole ClusterRegistry class is gone: use getClusterNameById() to obtain the cluster name given a ClusterId.

- The common namespace tags were renamed (the `Common` prefix was added):

| Old name (matter.js ≤ 0.16) | New name (matter.js 0.17)    |
| --------------------------- | ---------------------------- |
| `AreaNamespaceTag`          | `CommonAreaNamespaceTag`     |
| `ClosureTag`                | `CommonClosureTag`           |
| `CompassDirectionTag`       | `CommonCompassDirectionTag`  |
| `CompassLocationTag`        | `CommonCompassLocationTag`   |
| `DirectionTag`              | `CommonDirectionTag`         |
| `LandmarkNamespaceTag`      | `CommonLandmarkNamespaceTag` |
| `LevelTag`                  | `CommonLevelTag`             |
| `LocationTag`               | `CommonLocationTag`          |
| `NumberTag`                 | `CommonNumberTag`            |
| `PositionTag`               | `CommonPositionTag`          |
| `RelativePositionTag`       | `CommonRelativePositionTag`  |

- Matterbridge re export the old namespace tags as deprecated for compatibility with existing code.

## The ClusterType "deprecation" (mostly cosmetic)

In your editor you will see `ClusterType` shown with a strikethrough almost everywhere it is used (imports, type annotations, our own helper types). This looks alarming, but in almost every case it is a false alarm. Here is what is really going on.

### Why everything looks deprecated

`ClusterType` is not one thing. It is a single name that matter.js declares three times and merges together:

- a **function** `ClusterType(...)` you can call,
- an **interface** `ClusterType` you can use as a type,
- a **namespace** `ClusterType` that holds sub-types like `ClusterType.Attribute`.

In the 0.17 refactor matter.js marked **one** of those declarations as deprecated: the old `ClusterType(options)` function that took a hand-written options bag (the replacement is `ClusterType(model)`).

TypeScript has a rule: if **any** declaration of a merged name is deprecated, the editor draws the strikethrough on **every** use of that name — even when you are only using the parts that are perfectly current. So the strikethrough you see on the `ClusterType` interface and on `ClusterType.Attribute` is "bleeding" from the deprecated function. It is a display artifact, not a real warning about your code.

### What is actually deprecated vs. what is fine

Deprecated (avoid in new code):

- `ClusterType(options)` — the old options-bag factory. Use `ClusterType(model)` instead.
- `ClusterType.AttributeValues<T>` and `ClusterType.CommandsOf<T>` — kept only for external compatibility.
- `ClusterType.WithCompat<...>` — explicitly **scheduled for removal in matter.js 0.18**.
- the whole `RetiredClusterType` namespace.

Not deprecated (current API, safe to keep using):

- the `ClusterType` interface and `ClusterTyping`,
- `ClusterType.Attribute`, `.Command`, `.Event`, `.Concrete`, `.Feature`,
- `ClusterType.AttributeObjects`, `.CommandObjects`, `.EventObjects`, `.Features`,
- the new `ClusterType(model)` factory overload.

### What Matterbridge actually relies on

- Using `ClusterType` as a **type** (for example `Behavior.Type | ClusterType | ClusterId | string` in the endpoint and helper signatures, or `ClusterType.Attribute<infer JsType>` in our typed-attribute helpers) is fine. It uses only the non-deprecated interface/namespace; the strikethrough there is pure cosmetic bleed.

### Takeaway

The `ClusterType` strikethrough is mostly noise caused by how TypeScript marks merged declarations. The current type-level API is fine to keep using.

## Custom clusters

The way to create custom cluster in matter.js has changed.

In matter.js there are no more typescript source files for cluster types: they are generated. The memory usage has dropped by around 20%-50% that is great.

I will leave (without exporting them) the three Matter 1.5.1 cluster I created for testing like example of custom clusters.

## Implementation plan

Matterbridge 3.8.0 has been published with matter.js 0.17.1.

Matterbridge 3.9.0 has been published with matter.js 0.17.2.

All plugins should require Matterbridge 3.8.0 or 3.9.0 and make the refactor eventually required.
