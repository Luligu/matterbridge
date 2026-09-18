#
#    Write the Binding cluster (0x001E) Binding attribute on any endpoint that hosts a client cluster.
#
#    Cluster-agnostic helper for the Python test framework's fabric, which chip-tool cannot reach (it has no
#    access to the framework's own root CA in admin_storage.json). See chipTests.md, section
#    "Bind a client cluster", for the chip-tool equivalent used on its own fabric.
#
#    The Binding attribute is fabric-scoped, so this only ever reads and replaces the entries belonging to the
#    fabric it runs on; entries owned by other fabrics are left untouched.
#
#    Copy into the container, run, delete:
#
#      docker cp docker/chip-test/bind.py chip-test:/root/connectedhomeip/src/python_testing/__bind.py
#      docker exec chip-test python3 src/python_testing/__bind.py \
#        --int-arg source_endpoint:1609 --string-arg 'targets:[{"endpoint": 1607, "cluster": 1366}]'
#      docker exec chip-test rm -f /root/connectedhomeip/src/python_testing/__bind.py
#
#    Arguments:
#
#      --int-arg source_endpoint:<n>   Required. Endpoint hosting the client cluster, i.e. the endpoint whose
#                                      Binding table is written.
#      --string-arg targets:<json>     Required. JSON list of binding targets. Each entry is either unicast
#                                      ("endpoint", plus optional "node" defaulting to the DUT node id) or
#                                      group ("group"), with an optional "cluster" narrowing the binding to a
#                                      single client cluster. Pass [] to clear this fabric's bindings.
#      --bool-arg append:true          Optional. Merge with this fabric's existing entries instead of
#                                      replacing them. Defaults to replacing.
#
#    Examples:
#
#      # Bind the Chime client on endpoint 1609 to the Chime server on endpoint 1607 (cluster 0x0556 = 1366).
#      --int-arg source_endpoint:1609 --string-arg 'targets:[{"endpoint": 1607, "cluster": 1366}]'
#
#      # Bind every client cluster on endpoint 5 to endpoint 12 of another node.
#      --int-arg source_endpoint:5 --string-arg 'targets:[{"node": 2, "endpoint": 12}]'
#
#      # Add a group binding without dropping what this fabric already has.
#      --int-arg source_endpoint:5 --string-arg 'targets:[{"group": 1}]' --bool-arg append:true
#
#      # Clear this fabric's bindings on endpoint 1609.
#      --int-arg source_endpoint:1609 --string-arg 'targets:[]'
#

import json

import matter.clusters as Clusters
from matter.interaction_model import Status
from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main
from mobly import asserts

TargetStruct = Clusters.Binding.Structs.TargetStruct


class Bind(MatterBaseTest):
    def _read_targets(self, spec, default_node):
        """Turn the --string-arg targets JSON into a list of TargetStruct."""
        try:
            entries = json.loads(spec)
        except json.JSONDecodeError as err:
            asserts.fail(f"targets is not valid JSON: {err}")
        asserts.assert_true(isinstance(entries, list), "targets must be a JSON list")

        targets = []
        for entry in entries:
            asserts.assert_true(isinstance(entry, dict), f"each target must be a JSON object, got {entry!r}")
            unknown = set(entry) - {"node", "group", "endpoint", "cluster"}
            asserts.assert_false(unknown, f"unknown target fields {sorted(unknown)} in {entry!r}")

            group = entry.get("group")
            endpoint = entry.get("endpoint")
            # TargetStruct is either a group binding or a unicast one, never both (Binding cluster, 1.6.0).
            if group is not None:
                asserts.assert_true(endpoint is None and "node" not in entry,
                                    f"group target must not carry node/endpoint: {entry!r}")
                targets.append(TargetStruct(group=group, cluster=entry.get("cluster")))
            else:
                asserts.assert_true(endpoint is not None, f"unicast target needs an endpoint: {entry!r}")
                targets.append(TargetStruct(node=entry.get("node", default_node), endpoint=endpoint,
                                            cluster=entry.get("cluster")))
        return targets

    async def _read_binding(self, endpoint):
        """Read the Binding attribute, fabric-filtered to this fabric's own entries."""
        report = await self.default_controller.ReadAttribute(
            self.dut_node_id, [(endpoint, Clusters.Binding.Attributes.Binding)])
        return report[endpoint][Clusters.Binding][Clusters.Binding.Attributes.Binding]

    @async_test_body
    async def test_bind(self):
        params = self.matter_test_config.global_test_params
        asserts.assert_in("source_endpoint", params, "missing --int-arg source_endpoint:<n>")
        asserts.assert_in("targets", params, "missing --string-arg targets:<json>")
        source_endpoint = params["source_endpoint"]
        append = params.get("append", False)

        targets = self._read_targets(params["targets"], self.dut_node_id)

        before = await self._read_binding(source_endpoint)
        print(f"Binding on endpoint {source_endpoint} before: {before}")

        # Writing a fabric-scoped list replaces only this fabric's entries, so "append" means resending the
        # ones already read back above alongside the new targets.
        if append:
            targets = [TargetStruct(node=t.node, group=t.group, endpoint=t.endpoint, cluster=t.cluster)
                       for t in before] + targets

        result = await self.default_controller.WriteAttribute(
            self.dut_node_id, [(source_endpoint, Clusters.Binding.Attributes.Binding(targets))])
        for status in result:
            asserts.assert_equal(status.Status, Status.Success,
                                 f"write of Binding on endpoint {source_endpoint} failed: {status}")

        after = await self._read_binding(source_endpoint)
        print(f"Binding on endpoint {source_endpoint} after: {after}")


if __name__ == "__main__":
    default_matter_test_main()
