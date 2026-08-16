## Chip tests

### Create and start the container (Linux, macOS, and Windows)

Run the `luligu/matterbridge:chip-test` docker image (already bundles a full Matterbridge instance built
from the `dev` branch, started with `--novirtual` — nothing local is installed, built, or mounted):

- frontend on port 8585
- container test logs directory mapped on ./temp directory

```shell
node scripts/run-matterbridge-chip-tests.mjs --start
```

### Run all configured tests inside the container

```shell
node scripts/run-matterbridge-chip-tests.mjs
```

### Manually run the tests inside the container

Open a shell in the container

```shell
docker exec -it chip-test bash
```

In the shell:

```bash
# Generic device composition and conformance
python3 src/python_testing/TC_DeviceBasicComposition.py
python3 src/python_testing/TC_DeviceConformance.py
python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true
```

### Stop the container

```shell
node scripts/run-matterbridge-chip-tests.mjs --stop
```

### Endpoint 0

Root node clusters:

- AccessControl
- AdministratorCommissioning
- BasicInformation
- Descriptor
- GeneralCommissioning
- GeneralDiagnostics
- GroupKeyManagement
- OperationalCredentials
- PowerSource

### Endpoint 1

Aggregator clusters:

- Descriptor

### Known Issues
