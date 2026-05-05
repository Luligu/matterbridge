WORK IN PROGRESS

# Matter.js 0.17

This file summarizes the [matter.js 0.17](https://github.com/matter-js/matter.js/blob/main/CHANGELOG.md) deltas compared with Matter 0.16.11.

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

PowerSource.Attributes: the flattened full superset, not feature-specific
PowerSource.BaseAttributes: the always present attributes
PowerSource.WiredAttributes: only the Wired feature attributes
PowerSource.BaseAttributes & PowerSource.WiredAttributes: what a wired power source exposes

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

## Custom clusters

The way to create custom cluster in matter.js has changed.

In matter.js there are no more typescript source files for cluster types they are generated. The memory usage has dropped by around 20%-50% that is great.

I will leave (without exporting them) the three Matter 1.5.1 cluster I created for testing like example (branch dev-017).

## Implementation plan (work in progress)

I plan to release matter.js in Matterbridge 3.8.0.

At that point, all plugins should require Matterbridge 3.8.0 and make the refactor eventually required.
