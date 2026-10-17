import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DevicesClustersTree from '../src/components/DevicesClustersTree';
import type { Cluster } from '../src/utils/backendShared';

const endpointNumber = (value: number): Cluster['number'] => value;

function createCluster(endpoint: string, clusterName: string, attributeName: string, attributeValue: string, attributeLocalValue?: unknown): Cluster {
  return {
    endpoint,
    number: endpointNumber(Number(endpoint)),
    id: `Id${endpoint}`,
    deviceTypes: [0x0100],
    clusterName,
    clusterId: `${clusterName}-id`,
    attributeName,
    attributeId: `${attributeName}-id`,
    attributeValue,
    attributeLocalValue,
  };
}

describe('DevicesClustersTree', () => {
  afterEach(() => cleanup());

  it('should show a hint when no node is selected', () => {
    render(<DevicesClustersTree clusters={[]} />);
    expect(screen.getByText('Select a node in the tree to see its details.')).toBeInTheDocument();
  });

  it('should expand endpoint and cluster nodes and show the detail of each selected node', () => {
    const clusters = [
      createCluster('1', 'OnOff', 'onOff', 'false', false),
      createCluster('1', 'OnOff', 'onTime', '0', 0),
      createCluster('1', 'Descriptor', 'serverList', '[6]', [6]),
      createCluster('2', 'PowerSource', 'big', '1', BigInt(1)),
    ];
    render(<DevicesClustersTree clusters={clusters} />);

    // Endpoints are expanded by default, clusters are collapsed
    expect(screen.getByText('OnOff')).toBeInTheDocument();
    expect(screen.getByText('PowerSource')).toBeInTheDocument();
    expect(screen.queryByText('onTime')).toBeNull();

    // Endpoint node: a click collapses it, a second click expands it and shows the endpoint detail
    fireEvent.click(screen.getByRole('treeitem', { name: /Endpoint 1$/ }));
    expect(screen.queryByText('OnOff')).toBeNull();
    fireEvent.click(screen.getByRole('treeitem', { name: /Endpoint 1$/ }));
    expect(screen.getByText('0x0100')).toBeInTheDocument();
    expect(screen.getByText('OnOff')).toBeInTheDocument();

    // Cluster node: shows the attribute table and the attribute children
    fireEvent.click(screen.getByText('OnOff'));
    expect(screen.getByText('Cluster OnOff')).toBeInTheDocument();
    expect(screen.getAllByText('onTime').length).toBeGreaterThan(0);

    // Attribute node: shows path, value and raw value
    fireEvent.click(screen.getByRole('treeitem', { name: 'onOff' }));
    expect(screen.getByText('Attribute onOff')).toBeInTheDocument();
    expect(screen.getByText('Endpoint 1 › OnOff › onOff')).toBeInTheDocument();
    expect(screen.getAllByText('false', { selector: 'pre' })).toHaveLength(2);

    // Collapse the endpoint
    fireEvent.click(screen.getByRole('treeitem', { name: /Endpoint 1$/ }));
    expect(screen.queryByText('Descriptor')).toBeNull();

    // BigInt raw values are serialized
    fireEvent.click(screen.getByText('PowerSource'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'big' }));
    expect(screen.getByText('"1"')).toBeInTheDocument();
  });

  it('should keep the selection and refresh the value when the clusters change', () => {
    const { rerender } = render(<DevicesClustersTree clusters={[createCluster('1', 'OnOff', 'onOff', 'false', false)]} />);
    fireEvent.click(screen.getByText('OnOff'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'onOff' }));
    expect(screen.getAllByText('false', { selector: 'pre' })).toHaveLength(2);

    rerender(<DevicesClustersTree clusters={[createCluster('1', 'OnOff', 'onOff', 'true', true)]} />);
    expect(screen.getAllByText('true', { selector: 'pre' })).toHaveLength(2);
  });

  it('should render an empty detail when the selected node disappears', () => {
    const { rerender } = render(<DevicesClustersTree clusters={[createCluster('1', 'OnOff', 'onOff', 'false', false)]} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /Endpoint 1$/ }));
    rerender(<DevicesClustersTree clusters={[]} />);
    expect(screen.getByText('Select a node in the tree to see its details.')).toBeInTheDocument();
  });

  it('should show undefined when the raw value of an attribute is undefined', () => {
    render(<DevicesClustersTree clusters={[createCluster('1', 'OnOff', 'onOff', 'n/a')]} />);
    fireEvent.click(screen.getByText('OnOff'));
    fireEvent.click(screen.getByRole('treeitem', { name: 'onOff' }));
    expect(screen.getByText('undefined', { selector: 'pre' })).toBeInTheDocument();
  });

  it('should select and toggle a node with the Enter and Space keys and ignore other keys', () => {
    render(<DevicesClustersTree clusters={[createCluster('1', 'OnOff', 'onOff', 'false', false)]} />);
    const cluster = screen.getByRole('treeitem', { name: /OnOff$/ });
    expect(cluster).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(cluster, { key: 'a' });
    expect(screen.queryByText('Cluster OnOff')).toBeNull();

    fireEvent.keyDown(cluster, { key: 'Enter' });
    expect(screen.getByText('Cluster OnOff')).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'onOff' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('treeitem', { name: /OnOff$/ }), { key: ' ' });
    expect(screen.queryByRole('treeitem', { name: 'onOff' })).toBeNull();
  });
});
