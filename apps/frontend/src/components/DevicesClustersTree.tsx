// React
import { memo, useMemo, useState } from 'react';

import { type Cluster } from '../utils/backendShared';

interface ClusterGroup {
  name: string;
  id: string;
  attributes: Cluster[];
}

interface EndpointGroup {
  endpoint: string;
  id: string;
  deviceTypes: number[];
  clusters: ClusterGroup[];
}

type TreeNode =
  | { kind: 'endpoint'; key: string; group: EndpointGroup }
  | { kind: 'cluster'; key: string; group: EndpointGroup; cluster: ClusterGroup }
  | { kind: 'attribute'; key: string; group: EndpointGroup; cluster: ClusterGroup; attribute: Cluster };

const hex = (num: number) => `0x${num.toString(16).padStart(4, '0')}`;
const endpointKey = (endpoint: string) => `ep:${endpoint}`;
const clusterKey = (endpoint: string, cluster: string) => `cl:${endpoint}::${cluster}`;
const attributeKey = (endpoint: string, cluster: string, attribute: string) => `at:${endpoint}::${cluster}::${attribute}`;

/**
 * Group the flat cluster rows of the /api/clusters response into endpoint > cluster > attribute
 *
 * @param {Cluster[]} clusters The flat rows received from the backend.
 * @returns {EndpointGroup[]} The endpoints in the order of the first row that mentions them.
 */
function groupClusters(clusters: Cluster[]): EndpointGroup[] {
  const endpoints = new Map<string, EndpointGroup>();
  for (const row of clusters) {
    let group = endpoints.get(row.endpoint);
    if (!group) {
      group = { endpoint: row.endpoint, id: row.id, deviceTypes: row.deviceTypes, clusters: [] };
      endpoints.set(row.endpoint, group);
    }
    let cluster = group.clusters.find((c) => c.name === row.clusterName);
    if (!cluster) {
      cluster = { name: row.clusterName, id: row.clusterId, attributes: [] };
      group.clusters.push(cluster);
    }
    cluster.attributes.push(row);
  }
  return [...endpoints.values()];
}

const rowStyle = (selected: boolean, depth: number): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: `2px 8px 2px ${8 + depth * 16}px`,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '14px',
  backgroundColor: selected ? 'var(--table-selected-bg-color)' : 'transparent',
});

const labelStyle: React.CSSProperties = { color: 'var(--secondary-color)', paddingRight: '16px', verticalAlign: 'top', whiteSpace: 'nowrap' };

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={labelStyle}>{label}</td>
      <td style={{ wordBreak: 'break-all' }}>{children}</td>
    </tr>
  );
}

function Detail({ node }: { node: TreeNode | undefined }) {
  if (!node) return <div style={{ padding: '10px', color: 'var(--secondary-color)' }}>Select a node in the tree to see its details.</div>;
  if (node.kind === 'endpoint') {
    return (
      <div style={{ padding: '10px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Endpoint {node.group.endpoint}</h3>
        <table>
          <tbody>
            <DetailRow label="Id">{node.group.id}</DetailRow>
            <DetailRow label="Device types">{node.group.deviceTypes.map(hex).join(', ')}</DetailRow>
            <DetailRow label="Clusters">{node.group.clusters.length}</DetailRow>
          </tbody>
        </table>
      </div>
    );
  }
  if (node.kind === 'cluster') {
    return (
      <div style={{ padding: '10px' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>Cluster {node.cluster.name}</h3>
        <table style={{ marginBottom: '12px' }}>
          <tbody>
            <DetailRow label="Endpoint">{node.group.endpoint}</DetailRow>
            <DetailRow label="Cluster ID">{node.cluster.id}</DetailRow>
          </tbody>
        </table>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...labelStyle, textAlign: 'left' }}>Attribute</th>
              <th style={{ ...labelStyle, textAlign: 'left' }}>ID</th>
              <th style={{ ...labelStyle, textAlign: 'left' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {node.cluster.attributes.map((a) => (
              <tr key={a.attributeName} style={{ borderTop: '1px solid var(--table-border-color)' }}>
                <td>{a.attributeName}</td>
                <td>{a.attributeId}</td>
                <td style={{ wordBreak: 'break-all' }}>{a.attributeValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const { attribute } = node;
  return (
    <div style={{ padding: '10px' }}>
      <h3 style={{ margin: '0 0 8px 0' }}>Attribute {attribute.attributeName}</h3>
      <table style={{ marginBottom: '12px' }}>
        <tbody>
          <DetailRow label="Path">{`Endpoint ${node.group.endpoint} › ${node.cluster.name} › ${attribute.attributeName}`}</DetailRow>
          <DetailRow label="Cluster ID">{attribute.clusterId}</DetailRow>
          <DetailRow label="Attribute ID">{attribute.attributeId}</DetailRow>
          <DetailRow label="Device types">{node.group.deviceTypes.map(hex).join(', ')}</DetailRow>
        </tbody>
      </table>
      <div style={{ color: 'var(--secondary-color)' }}>Value</div>
      <pre style={{ margin: '4px 0 12px 0', padding: '8px', border: '1px solid var(--table-border-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {attribute.attributeValue}
      </pre>
      <div style={{ color: 'var(--secondary-color)' }}>Raw (attributeLocalValue)</div>
      <pre style={{ margin: '4px 0 0 0', padding: '8px', border: '1px solid var(--table-border-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {JSON.stringify(attribute.attributeLocalValue, (_key, value) => (typeof value === 'bigint' ? value.toString() : (value as unknown)), 2) ?? 'undefined'}
      </pre>
    </div>
  );
}

interface DevicesClustersTreeProps {
  clusters: Cluster[];
}

/**
 * Render the clusters of the selected device as a tree (endpoint > cluster > attribute) with a detail panel
 *
 * @param {DevicesClustersTreeProps} props The flat cluster rows. Live attribute updates re-render through the same array.
 * @returns {React.JSX.Element} The tree on the left and the detail of the selected node on the right.
 */
function DevicesClustersTree({ clusters }: DevicesClustersTreeProps): React.JSX.Element {
  // Keys toggled by the user away from their default state: endpoints are expanded by default, clusters collapsed.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const isExpanded = (key: string) => key.startsWith('ep:') !== toggled.has(key);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const endpoints = useMemo(() => groupClusters(clusters), [clusters]);
  const nodes = useMemo(() => {
    const map = new Map<string, TreeNode>();
    for (const group of endpoints) {
      map.set(endpointKey(group.endpoint), { kind: 'endpoint', key: endpointKey(group.endpoint), group });
      for (const cluster of group.clusters) {
        const ck = clusterKey(group.endpoint, cluster.name);
        map.set(ck, { kind: 'cluster', key: ck, group, cluster });
        for (const attribute of cluster.attributes) {
          const ak = attributeKey(group.endpoint, cluster.name, attribute.attributeName);
          map.set(ak, { kind: 'attribute', key: ak, group, cluster, attribute });
        }
      }
    }
    return map;
  }, [endpoints]);

  const select = (key: string) => {
    setSelectedKey(key);
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRow = (key: string, depth: number, label: string, expandable: boolean) => (
    <div
      key={key}
      role="treeitem"
      aria-selected={selectedKey === key}
      aria-expanded={expandable ? isExpanded(key) : undefined}
      style={rowStyle(selectedKey === key, depth)}
      onClick={() => select(key)}
    >
      <span style={{ width: '12px' }}>{expandable ? (isExpanded(key) ? '▾' : '▸') : ''}</span>
      {label}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flex: '1 1 auto', minHeight: 0, width: '100%', overflow: 'hidden', color: 'var(--div-text-color)' }}>
      <div role="tree" style={{ flex: '0 0 30%', minWidth: '200px', overflowX: 'hidden', overflowY: 'auto', borderRight: '2px solid var(--main-grey-color)' }}>
        {endpoints.map((group) => {
          const ek = endpointKey(group.endpoint);
          return [
            renderRow(ek, 0, `Endpoint ${group.endpoint}`, true),
            ...(isExpanded(ek)
              ? group.clusters.flatMap((cluster) => {
                  const ck = clusterKey(group.endpoint, cluster.name);
                  return [
                    renderRow(ck, 1, cluster.name, true),
                    ...(isExpanded(ck) ? cluster.attributes.map((a) => renderRow(attributeKey(group.endpoint, cluster.name, a.attributeName), 2, a.attributeName, false)) : []),
                  ];
                })
              : []),
          ];
        })}
      </div>
      <div style={{ flex: '1 1 auto', overflowX: 'hidden', overflowY: 'auto' }}>
        <Detail node={selectedKey ? nodes.get(selectedKey) : undefined} />
      </div>
    </div>
  );
}

export default memo(DevicesClustersTree);
